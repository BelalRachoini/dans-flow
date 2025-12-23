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

    const { course_id, selected_class_ids } = await req.json();
    if (!course_id) throw new Error("Missing course_id");

    console.log("Creating payment for course:", course_id);
    console.log("Selected class IDs:", selected_class_ids);

    // Fetch course details
    const { data: course, error: courseError } = await supabaseClient
      .from("courses")
      .select("*")
      .eq("id", course_id)
      .single();

    if (courseError || !course) throw new Error("Course not found");

    // Calculate final price with discount
    let finalPrice = course.price_cents;
    
    if (course.discount_type === 'percent' && course.discount_value > 0) {
      finalPrice = Math.round(course.price_cents * (1 - course.discount_value / 100));
    } else if (course.discount_type === 'amount' && course.discount_value > 0) {
      finalPrice = Math.max(course.price_cents - course.discount_value, 100); // Minimum 1 SEK
    }

    console.log("Course found:", course.title, "Original Price:", course.price_cents, "Final Price:", finalPrice, "Is package:", course.is_package);

    // Validate package selection
    if (course.is_package) {
      if (!selected_class_ids || selected_class_ids.length === 0) {
        throw new Error("Package courses require class selection");
      }
      if (selected_class_ids.length > (course.max_selections || 2)) {
        throw new Error(`Maximum ${course.max_selections || 2} classes allowed`);
      }
      
      // Validate that selected classes belong to this course
      const { data: validClasses, error: classError } = await supabaseClient
        .from("course_classes")
        .select("id")
        .eq("course_id", course_id)
        .in("id", selected_class_ids);
      
      if (classError) throw classError;
      if (!validClasses || validClasses.length !== selected_class_ids.length) {
        throw new Error("Invalid class selection");
      }
    }

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
      
      // Update product to remove description if it exists
      if (product.description) {
        await stripe.products.update(product.id, {
          description: '',
        });
        console.log("Cleared description for existing product");
      }
      
      const prices = await stripe.prices.list({ product: product.id, active: true, limit: 10 });
      
      // Check if existing price matches the final calculated price (with discount applied)
      const matchingPrice = prices.data.find((p: { unit_amount: number | null }) => p.unit_amount === finalPrice);
      
      if (matchingPrice) {
        // Price matches - use existing price
        priceId = matchingPrice.id;
        console.log("Using existing price:", priceId, "for amount:", finalPrice);
      } else {
        // No matching price - create new price for existing product
        console.log("No matching price found. Creating new price for amount:", finalPrice);
        
        const newPrice = await stripe.prices.create({
          product: product.id,
          unit_amount: finalPrice,
          currency: "sek",
        });
        priceId = newPrice.id;
        console.log("Created new price:", priceId);
      }
    } else {
      // Create new product and price
      console.log("Creating new product for course");
      const product = await stripe.products.create({
        name: course.title,
        metadata: { course_id: course_id },
      });

      const price = await stripe.prices.create({
        product: product.id,
        unit_amount: finalPrice,
        currency: "sek",
      });
      priceId = price.id;
      console.log("Created product and price:", product.id, price.id);
    }

    // Create checkout session with class selection in metadata
    const sessionMetadata: Record<string, string> = {
      course_id: course_id,
      user_id: user.id,
    };

    // Store selected class IDs in metadata for package courses
    if (course.is_package && selected_class_ids) {
      sessionMetadata.selected_class_ids = JSON.stringify(selected_class_ids);
      sessionMetadata.is_package = "true";
    }

    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      customer_email: customerId ? undefined : user.email,
      line_items: [{ price: priceId, quantity: 1 }],
      mode: "payment",
      success_url: `${req.headers.get("origin")}/payment-success?session_id={CHECKOUT_SESSION_ID}&type=course`,
      cancel_url: `${req.headers.get("origin")}/payment-cancelled`,
      metadata: sessionMetadata,
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
