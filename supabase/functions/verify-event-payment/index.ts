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
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
  );

  try {
    const authHeader = req.headers.get("Authorization")!;
    const token = authHeader.replace("Bearer ", "");
    const { data } = await supabaseClient.auth.getUser(token);
    const user = data.user;
    if (!user) throw new Error("User not authenticated");

    const { session_id } = await req.json();
    if (!session_id) throw new Error("Missing session_id");

    console.log("Verifying payment for session:", session_id);

    const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") || "", {
      apiVersion: "2025-08-27.basil",
    });

    // Retrieve the checkout session
    const session = await stripe.checkout.sessions.retrieve(session_id);

    console.log("Session status:", session.payment_status);

    if (session.payment_status !== "paid") {
      return new Response(
        JSON.stringify({ error: "Payment not completed" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400 }
      );
    }

    // Get event_id from metadata
    const event_id = session.metadata?.event_id;
    if (!event_id) {
      throw new Error("Event ID not found in session metadata");
    }

    console.log("Payment verified for event:", event_id);

    // Check if booking already exists
    const { data: existingBooking } = await supabaseClient
      .from("event_bookings")
      .select("id")
      .eq("member_id", user.id)
      .eq("event_id", event_id)
      .single();

    if (existingBooking) {
      console.log("Booking already exists:", existingBooking.id);
      return new Response(
        JSON.stringify({ 
          success: true, 
          booking_id: existingBooking.id,
          already_exists: true 
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
      );
    }

    // Create booking with QR code
    const { data: booking, error: bookingError } = await supabaseClient
      .from("event_bookings")
      .insert({
        member_id: user.id,
        event_id: event_id,
        status: "confirmed",
        payment_status: "paid",
      })
      .select()
      .single();

    if (bookingError) throw bookingError;

    console.log("Booking created:", booking.id);

    // Increment sold_count - fetch current value then increment
    const { data: currentEvent } = await supabaseClient
      .from("events")
      .select("sold_count")
      .eq("id", event_id)
      .single();
    
    if (currentEvent) {
      await supabaseClient
        .from("events")
        .update({ sold_count: currentEvent.sold_count + 1 })
        .eq("id", event_id);
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        booking_id: booking.id,
        qr_payload: booking.qr_payload 
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
    );
  } catch (error) {
    console.error("Error verifying payment:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
    );
  }
});
