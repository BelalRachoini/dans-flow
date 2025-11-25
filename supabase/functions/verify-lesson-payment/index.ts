import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

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

    if (!user) {
      throw new Error("User not authenticated");
    }

    const { session_id } = await req.json();

    if (!session_id) {
      throw new Error("Missing session_id");
    }

    const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") || "", {
      apiVersion: "2025-08-27.basil",
    });

    // Retrieve the session
    const session = await stripe.checkout.sessions.retrieve(session_id);

    if (session.payment_status !== "paid") {
      throw new Error("Payment not completed");
    }

    const lesson_id = session.metadata?.lesson_id;
    const ticket_type = session.metadata?.ticket_type;

    if (!lesson_id || !ticket_type) {
      throw new Error("Missing lesson_id or ticket_type in session metadata");
    }

    // Use service role to create booking
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

    // Check if booking already exists
    const { data: existingBooking } = await supabaseAdmin
      .from("lesson_bookings")
      .select("id")
      .eq("member_id", user.id)
      .eq("lesson_id", lesson_id)
      .eq("qr_payload", session.id)
      .maybeSingle();

    if (existingBooking) {
      return new Response(
        JSON.stringify({ success: true, booking: existingBooking }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 200,
        }
      );
    }

    // Determine checkins_allowed based on ticket_type
    const checkins_allowed = ticket_type === 'couple' ? 2 : 1;

    // Create booking
    const { data: booking, error: bookingError } = await supabaseAdmin
      .from("lesson_bookings")
      .insert({
        member_id: user.id,
        lesson_id: lesson_id,
        ticket_type: ticket_type,
        checkins_allowed: checkins_allowed,
        qr_payload: session.id,
        status: 'valid',
      })
      .select()
      .single();

    if (bookingError) {
      throw bookingError;
    }

    return new Response(
      JSON.stringify({ success: true, booking }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      }
    );
  } catch (error: any) {
    console.error("Error verifying lesson payment:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 500,
      }
    );
  }
});