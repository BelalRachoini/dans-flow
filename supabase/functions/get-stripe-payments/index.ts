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
    { auth: { persistSession: false } }
  );

  try {
    // Authenticate admin user
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("No authorization header");

    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: userError } = await supabaseClient.auth.getUser(token);
    if (userError || !user) throw new Error("User not authenticated");

    const { data: isAdmin } = await supabaseClient.rpc("has_role", { _user_id: user.id, _role: "admin" });
    if (!isAdmin) throw new Error("Unauthorized: Admin access required");

    // Get query parameters
    const url = new URL(req.url);
    const limit = parseInt(url.searchParams.get("limit") || "100");
    const startingAfter = url.searchParams.get("starting_after");

    const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") || "", {
      apiVersion: "2025-08-27.basil",
    });

    // Fetch payment intents WITH expanded latest_charge for billing details
    const paymentIntentsParams: any = {
      limit: Math.min(limit, 100),
      expand: ["data.latest_charge"],
    };
    if (startingAfter) paymentIntentsParams.starting_after = startingAfter;

    const paymentIntents = await stripe.paymentIntents.list(paymentIntentsParams);

    // Batch-fetch all profiles by user_id from metadata
    const userIds = paymentIntents.data
      .map((pi: any) => pi.metadata?.user_id)
      .filter((id: string) => id && id !== "unknown");
    
    const uniqueUserIds = [...new Set(userIds)];
    
    let profileMap: Record<string, { full_name: string | null; email: string | null }> = {};
    if (uniqueUserIds.length > 0) {
      const { data: profiles } = await supabaseClient
        .from("profiles")
        .select("id, full_name, email")
        .in("id", uniqueUserIds);
      
      if (profiles) {
        for (const p of profiles) {
          profileMap[p.id] = { full_name: p.full_name, email: p.email };
        }
      }
    }

    // Enrich payments
    const enrichedPayments = await Promise.all(
      paymentIntents.data.map(async (pi: any) => {
        const metadata = pi.metadata || {};
        const latestCharge = pi.latest_charge;
        const billing = latestCharge?.billing_details;

        // 1. Resolve customer name/email from profile, then billing, then Stripe customer
        let customerName = "Unknown";
        let customerEmail = "unknown@example.com";

        const profile = metadata.user_id ? profileMap[metadata.user_id] : null;
        if (profile?.full_name) {
          customerName = profile.full_name;
          customerEmail = profile.email || customerEmail;
        } else if (billing?.name || billing?.email) {
          customerName = billing.name || customerName;
          customerEmail = billing.email || customerEmail;
        } else if (pi.customer) {
          try {
            const customer = await stripe.customers.retrieve(pi.customer as string);
            if (customer && !customer.deleted) {
              customerName = customer.name || customerName;
              customerEmail = customer.email || customerEmail;
            }
          } catch (_e) { /* ignore */ }
        }

        // 2. Determine payment type and description from metadata
        let paymentType = "other";
        let description = pi.description || "Payment";

        if (metadata.payment_type === "standalone_tickets") {
          paymentType = "tickets";
          description = `Klippkort: ${metadata.ticket_count || "?"} st`;
        } else if (metadata.lesson_id) {
          paymentType = "lesson";
          try {
            const { data: lesson } = await supabaseClient
              .from("course_lessons")
              .select("title, courses!inner(title)")
              .eq("id", metadata.lesson_id)
              .single();
            const ticketLabel = metadata.ticket_type === "couple" ? "Par" : "Singel";
            if (lesson?.courses) {
              description = `Drop-in (${ticketLabel}): ${(lesson.courses as any).title} - ${lesson.title || "Lektion"}`;
            } else {
              description = `Drop-in (${ticketLabel})`;
            }
          } catch (_e) {
            description = `Drop-in: ${metadata.ticket_type === "couple" ? "Par" : "Singel"}`;
          }
        } else if (metadata.event_id) {
          paymentType = "event";
          try {
            const { data: event } = await supabaseClient
              .from("events").select("title").eq("id", metadata.event_id).single();
            if (event) description = `Event: ${event.title}`;
          } catch (_e) { /* ignore */ }
        } else if (metadata.course_id) {
          paymentType = "course";
          try {
            const { data: course } = await supabaseClient
              .from("courses").select("title").eq("id", metadata.course_id).single();
            if (course) description = `Kurs: ${course.title}`;
            else description = "Kurs";
          } catch (_e) { description = "Kurs"; }
        } else if (metadata.subscription_id || pi.invoice) {
          paymentType = "membership";
          description = "Medlemskap";
        }

        // 3. Map status
        let status: "paid" | "pending" | "failed";
        switch (pi.status) {
          case "succeeded": status = "paid"; break;
          case "processing":
          case "requires_payment_method":
          case "requires_confirmation":
          case "requires_action": status = "pending"; break;
          default: status = "failed"; break;
        }

        return {
          id: pi.id,
          userId: metadata.user_id || "unknown",
          userName: customerName,
          userEmail: customerEmail,
          amountSEK: pi.amount / 100,
          type: paymentType,
          status,
          description,
          createdAt: new Date(pi.created * 1000).toISOString(),
          paidAt: latestCharge?.created ? new Date(latestCharge.created * 1000).toISOString() : undefined,
          method: latestCharge?.payment_method_details?.type || "card",
          stripePaymentIntentId: pi.id,
          stripeCustomerId: pi.customer as string || undefined,
        };
      })
    );

    return new Response(
      JSON.stringify({ payments: enrichedPayments, has_more: paymentIntents.has_more }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
    );
  } catch (error) {
    console.error("[get-stripe-payments] Error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
    );
  }
});
