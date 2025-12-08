import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseClient = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_ANON_KEY") ?? ""
  );

  try {
    console.log("[create-event-payment] Function started");

    // Authenticate user
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("No authorization header");

    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: userError } = await supabaseClient.auth.getUser(token);
    
    if (userError || !user?.email) {
      throw new Error("User not authenticated");
    }

    console.log("[create-event-payment] User authenticated:", user.email);

    // Get request body
    const { event_id, ticket_count = 1, attendee_names = [] } = await req.json();
    if (!event_id) throw new Error("event_id is required");

    // Validate ticket_count
    const validatedTicketCount = Math.min(Math.max(1, ticket_count), 3);
    console.log("[create-event-payment] Processing payment for event:", event_id, "tickets:", validatedTicketCount);

    // Fetch event details
    const { data: event, error: eventError } = await supabaseClient
      .from("events")
      .select("*")
      .eq("id", event_id)
      .single();

    if (eventError || !event) {
      throw new Error("Event not found");
    }

    console.log("[create-event-payment] Event found:", event.title);

    // Check if event has enough capacity
    const availableSpots = event.capacity - event.sold_count;
    if (availableSpots < validatedTicketCount) {
      throw new Error(`Not enough spots available. Only ${availableSpots} spots left.`);
    }

    // Calculate price based on ticket count
    let totalPriceCents: number;
    if (validatedTicketCount === 1) {
      totalPriceCents = event.price_cents;
    } else if (validatedTicketCount === 2) {
      // Use couple price if set, otherwise double the single price
      totalPriceCents = event.couple_price_cents ?? (event.price_cents * 2);
    } else {
      // Use trio price if set, otherwise triple the single price
      totalPriceCents = event.trio_price_cents ?? (event.price_cents * 3);
    }

    console.log("[create-event-payment] Total price cents:", totalPriceCents);

    // Initialize Stripe
    const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") || "", {
      apiVersion: "2025-08-27.basil",
    });

    // Check if customer exists
    const customers = await stripe.customers.list({ 
      email: user.email, 
      limit: 1 
    });
    
    let customerId;
    if (customers.data.length > 0) {
      customerId = customers.data[0].id;
      console.log("[create-event-payment] Existing customer found:", customerId);
    } else {
      console.log("[create-event-payment] New customer will be created by Stripe");
    }

    // Create product name based on ticket count
    const productName = validatedTicketCount === 1 
      ? event.title 
      : `${event.title} (${validatedTicketCount} tickets)`;

    // Create a new price for this specific purchase
    console.log("[create-event-payment] Creating checkout session with price:", totalPriceCents);

    // Create checkout session with price_data (dynamic pricing)
    const origin = req.headers.get("origin") || "http://localhost:8080";
    
    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      customer_email: customerId ? undefined : user.email,
      line_items: [
        {
          price_data: {
            currency: event.currency.toLowerCase(),
            product_data: {
              name: productName,
              description: `${validatedTicketCount} ticket(s) for ${event.title}`,
              metadata: {
                event_id: event_id,
              },
            },
            unit_amount: totalPriceCents,
          },
          quantity: 1,
        },
      ],
      mode: "payment",
      success_url: `${origin}/payment-success?session_id={CHECKOUT_SESSION_ID}&type=event`,
      cancel_url: `${origin}/payment-cancelled`,
      metadata: {
        event_id: event_id,
        user_id: user.id,
        ticket_count: validatedTicketCount.toString(),
        attendee_names: JSON.stringify(attendee_names),
      },
    });

    console.log("[create-event-payment] Checkout session created:", session.id);

    return new Response(
      JSON.stringify({ 
        url: session.url,
        session_id: session.id 
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      }
    );
  } catch (error) {
    console.error("[create-event-payment] Error:", error);
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