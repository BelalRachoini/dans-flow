import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseClient = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    {
      auth: {
        persistSession: false,
      },
    }
  );

  try {
    console.log("[get-stripe-payments] Function started");

    // Authenticate admin user
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("No authorization header");

    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: userError } = await supabaseClient.auth.getUser(token);
    
    if (userError || !user) {
      throw new Error("User not authenticated");
    }

    // Check if user is admin using the has_role function with user ID
    const { data: isAdmin, error: adminCheckError } = await supabaseClient
      .rpc("has_role", {
        _user_id: user.id,
        _role: "admin"
      });

    if (adminCheckError) {
      console.error("[get-stripe-payments] Admin check error:", adminCheckError);
      throw new Error("Failed to verify admin status");
    }

    if (!isAdmin) {
      throw new Error("Unauthorized: Admin access required");
    }

    console.log("[get-stripe-payments] Admin verified:", user.email);

    // Get query parameters
    const url = new URL(req.url);
    const limit = parseInt(url.searchParams.get("limit") || "100");
    const startingAfter = url.searchParams.get("starting_after");

    // Initialize Stripe
    const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") || "", {
      apiVersion: "2025-08-27.basil",
    });

    // Fetch payment intents
    const paymentIntentsParams: any = {
      limit: Math.min(limit, 100),
    };

    if (startingAfter) {
      paymentIntentsParams.starting_after = startingAfter;
    }

    const paymentIntents = await stripe.paymentIntents.list(paymentIntentsParams);
    console.log("[get-stripe-payments] Found", paymentIntents.data.length, "payment intents");

    // Fetch customer details and enrich payment data
    const enrichedPayments = await Promise.all(
      paymentIntents.data.map(async (pi: Stripe.PaymentIntent) => {
        let customerName = "Unknown";
        let customerEmail = "unknown@example.com";

        if (pi.customer) {
          try {
            const customer = await stripe.customers.retrieve(pi.customer as string);
            if (customer && !customer.deleted) {
              customerName = customer.name || "Unknown";
              customerEmail = customer.email || "unknown@example.com";
            }
          } catch (error) {
            console.error("[get-stripe-payments] Error fetching customer:", error);
          }
        } else if (pi.charges?.data?.[0]?.billing_details) {
          const billing = pi.charges.data[0].billing_details;
          customerName = billing.name || "Unknown";
          customerEmail = billing.email || "unknown@example.com";
        }

        // Determine payment type from metadata
        const metadata = pi.metadata || {};
        let paymentType = "other";
        let description = pi.description || "Payment";

        if (metadata.event_id) {
          paymentType = "event";
          // Try to fetch event title
          try {
            const { data: event } = await supabaseClient
              .from("events")
              .select("title")
              .eq("id", metadata.event_id)
              .single();
            if (event) {
              description = `Event: ${event.title}`;
            }
          } catch (error) {
            console.error("[get-stripe-payments] Error fetching event:", error);
          }
        } else if (metadata.course_id) {
          paymentType = "course";
        } else if (metadata.subscription_id || pi.invoice) {
          paymentType = "membership";
        }

        // Map Stripe status to our status
        let status: "paid" | "pending" | "failed";
        switch (pi.status) {
          case "succeeded":
            status = "paid";
            break;
          case "processing":
          case "requires_payment_method":
          case "requires_confirmation":
          case "requires_action":
            status = "pending";
            break;
          case "canceled":
          case "requires_capture":
          default:
            status = "failed";
            break;
        }

        return {
          id: pi.id,
          userId: metadata.user_id || "unknown",
          userName: customerName,
          userEmail: customerEmail,
          amountSEK: pi.amount / 100, // Convert from cents
          type: paymentType,
          status: status,
          description: description,
          createdAt: new Date(pi.created * 1000).toISOString(),
          paidAt: pi.charges?.data?.[0]?.created 
            ? new Date(pi.charges.data[0].created * 1000).toISOString() 
            : undefined,
          method: pi.charges?.data?.[0]?.payment_method_details?.type || "card",
          stripePaymentIntentId: pi.id,
          stripeCustomerId: pi.customer as string || undefined,
        };
      })
    );

    console.log("[get-stripe-payments] Enriched", enrichedPayments.length, "payments");

    return new Response(
      JSON.stringify({ 
        payments: enrichedPayments,
        has_more: paymentIntents.has_more,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      }
    );
  } catch (error) {
    console.error("[get-stripe-payments] Error:", error);
    return new Response(
      JSON.stringify({ 
        error: error instanceof Error ? error.message : "Unknown error" 
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 500,
      }
    );
  }
});
