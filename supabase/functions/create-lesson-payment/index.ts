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
    Deno.env.get("SUPABASE_ANON_KEY") ?? ""
  );

  try {
    const authHeader = req.headers.get("Authorization")!;
    const token = authHeader.replace("Bearer ", "");
    const { data } = await supabaseClient.auth.getUser(token);
    const user = data.user;
    
    if (!user?.email) {
      throw new Error("User not authenticated");
    }

    const { lesson_id, ticket_type } = await req.json();

    if (!lesson_id || !ticket_type) {
      throw new Error("Missing lesson_id or ticket_type");
    }

    if (!['single', 'couple'].includes(ticket_type)) {
      throw new Error("Invalid ticket_type");
    }

    // Fetch lesson details
    const { data: lesson, error: lessonError } = await supabaseClient
      .from("course_lessons")
      .select("id, title, starts_at, course_id, courses(title)")
      .eq("id", lesson_id)
      .single();

    if (lessonError || !lesson) {
      throw new Error("Lesson not found");
    }

    const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") || "", {
      apiVersion: "2025-08-27.basil",
    });

    // Check if customer exists
    const customers = await stripe.customers.list({ email: user.email, limit: 1 });
    let customerId;
    if (customers.data.length > 0) {
      customerId = customers.data[0].id;
    }

    // Determine price based on ticket type
    const priceData = ticket_type === 'single' 
      ? { amount: 15000, description: "Drop-in Single Ticket" }
      : { amount: 25000, description: "Drop-in Couple Ticket" };

    // Search for existing product
    const products = await stripe.products.search({
      query: `metadata['ticket_type']:'${ticket_type}' AND active:'true'`,
    });

    let priceId;
    
    if (products.data.length > 0) {
      const product = products.data[0];
      const prices = await stripe.prices.list({ product: product.id, active: true, limit: 1 });
      if (prices.data.length > 0) {
        priceId = prices.data[0].id;
      }
    }

    if (!priceId) {
      // Create product and price
      const product = await stripe.products.create({
        name: priceData.description,
        metadata: {
          ticket_type: ticket_type,
        },
      });

      const price = await stripe.prices.create({
        product: product.id,
        unit_amount: priceData.amount,
        currency: "sek",
      });

      priceId = price.id;
    }

    // Create checkout session
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
      success_url: `${req.headers.get("origin")}/schema?payment=success&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${req.headers.get("origin")}/schema`,
      metadata: {
        lesson_id: lesson_id,
        ticket_type: ticket_type,
      },
    });

    return new Response(
      JSON.stringify({ url: session.url, sessionId: session.id }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      }
    );
  } catch (error: any) {
    console.error("Error creating lesson payment:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 500,
      }
    );
  }
});