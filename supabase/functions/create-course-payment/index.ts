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
    if (!user?.email) throw new Error("User not authenticated");

    const { course_id } = await req.json();
    if (!course_id) throw new Error("Missing course_id");

    console.log("Creating payment for course:", course_id);

    // Fetch course details
    const { data: course, error: courseError } = await supabaseClient
      .from("courses")
      .select("*")
      .eq("id", course_id)
      .single();

    if (courseError || !course) throw new Error("Course not found");

    console.log("Course found:", course.title, "Price:", course.price_cents);

    const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") || "", {
      apiVersion: "2025-08-27.basil",
    });

    // Find or create Stripe customer
    const customers = await stripe.customers.list({ email: user.email, limit: 1 });
    let customerId: string | undefined;
    if (customers.data.length > 0) {
      customerId = customers.data[0].id;
    }

    // Search for existing product
    const products = await stripe.products.search({
      query: `metadata['course_id']:'${course_id}'`,
    });

    let priceId: string;

    if (products.data.length > 0) {
      // Use existing product
      const product = products.data[0];
      console.log("Found existing product:", product.id);
      
      const prices = await stripe.prices.list({ product: product.id, limit: 1 });
      if (prices.data.length === 0) {
        throw new Error("No price found for existing product");
      }
      priceId = prices.data[0].id;
    } else {
      // Create new product and price
      console.log("Creating new product for course");
      const product = await stripe.products.create({
        name: course.title,
        description: course.description || undefined,
        metadata: { course_id: course_id },
      });

      const price = await stripe.prices.create({
        product: product.id,
        unit_amount: course.price_cents,
        currency: "sek",
      });
      priceId = price.id;
      console.log("Created product and price:", product.id, price.id);
    }

    // Create checkout session
    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      customer_email: customerId ? undefined : user.email,
      line_items: [{ price: priceId, quantity: 1 }],
      mode: "payment",
      success_url: `${req.headers.get("origin")}/payment-success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${req.headers.get("origin")}/payment-cancelled`,
      metadata: {
        course_id: course_id,
        user_id: user.id,
      },
    });

    console.log("Checkout session created:", session.id);

    return new Response(
      JSON.stringify({ url: session.url, session_id: session.id }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
    );
  } catch (error) {
    console.error("Error creating course payment:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
    );
  }
});
