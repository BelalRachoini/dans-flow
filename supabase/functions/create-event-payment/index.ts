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

    // Get event_id from request
    const { event_id } = await req.json();
    if (!event_id) throw new Error("event_id is required");

    console.log("[create-event-payment] Processing payment for event:", event_id);

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

    // Check if event is sold out
    if (event.sold_count >= event.capacity) {
      throw new Error("Event is sold out");
    }

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

    // Search for existing product for this event
    const products = await stripe.products.search({
      query: `metadata['event_id']:'${event_id}'`,
      limit: 1,
    });

    let priceId;
    
    if (products.data.length > 0) {
      // Use existing product
      const product = products.data[0];
      console.log("[create-event-payment] Found existing product:", product.id);
      
      const prices = await stripe.prices.list({
        product: product.id,
        active: true,
        limit: 1,
      });
      
      if (prices.data.length > 0) {
        priceId = prices.data[0].id;
        console.log("[create-event-payment] Using existing price:", priceId);
      }
    }

    // Create product and price if not exists
    if (!priceId) {
      console.log("[create-event-payment] Creating new product and price");
      
      const product = await stripe.products.create({
        name: event.title,
        description: event.description.substring(0, 500),
        images: event.image_url ? [event.image_url] : [],
        metadata: {
          event_id: event_id,
          venue: event.venue,
        },
      });

      const price = await stripe.prices.create({
        product: product.id,
        unit_amount: event.price_cents,
        currency: event.currency.toLowerCase(),
        metadata: {
          event_id: event_id,
        },
      });

      priceId = price.id;
      console.log("[create-event-payment] Created product:", product.id, "and price:", priceId);
    }

    // Create checkout session
    const origin = req.headers.get("origin") || "http://localhost:8080";
    
    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      customer_email: customerId ? undefined : user.email,
      line_items: [
        {
          price: priceId,
          quantity: 1,
        },
      ],
      mode: "payment",
      success_url: `${origin}/events?payment=success&session_id={CHECKOUT_SESSION_ID}&event_id=${event_id}`,
      cancel_url: `${origin}/events?payment=cancelled`,
      metadata: {
        event_id: event_id,
        user_id: user.id,
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
