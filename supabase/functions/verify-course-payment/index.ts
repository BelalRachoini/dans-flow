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

    console.log("Verifying course payment for session:", session_id);

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

    // Get course_id from metadata
    const course_id = session.metadata?.course_id;
    if (!course_id) {
      throw new Error("Course ID not found in session metadata");
    }

    console.log("Payment verified for course:", course_id);

    // Get course details
    const { data: course } = await supabaseClient
      .from("courses")
      .select("*")
      .eq("id", course_id)
      .single();

    if (!course) throw new Error("Course not found");

    // Check if ticket already exists
    const { data: existingTicket } = await supabaseClient
      .from("tickets")
      .select("id")
      .eq("member_id", user.id)
      .eq("course_id", course_id)
      .single();

    if (existingTicket) {
      console.log("Ticket already exists:", existingTicket.id);
      return new Response(
        JSON.stringify({ 
          success: true, 
          ticket_id: existingTicket.id,
          already_exists: true 
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
      );
    }

    // Count course lessons to determine total_tickets
    const { count: lessonsCount } = await supabaseClient
      .from("course_lessons")
      .select("*", { count: "exact", head: true })
      .eq("course_id", course_id);

    const total_tickets = lessonsCount || 10;

    // Calculate expiry date based on course end date (or 3 months if no end date)
    const expires_at = course.ends_at 
      ? new Date(course.ends_at).toISOString()
      : new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString();

    // Create ticket with QR code
    const { data: ticket, error: ticketError } = await supabaseClient
      .from("tickets")
      .insert({
        member_id: user.id,
        course_id: course_id,
        source_course_id: course_id,
        status: "valid",
        qr_payload: crypto.randomUUID(),
        total_tickets: total_tickets,
        tickets_used: 0,
        expires_at: expires_at,
      })
      .select()
      .single();

    if (ticketError) throw ticketError;

    console.log("Ticket created:", ticket.id);

    return new Response(
      JSON.stringify({ 
        success: true, 
        ticket_id: ticket.id,
        qr_payload: ticket.qr_payload,
        total_tickets: total_tickets
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
    );
  } catch (error) {
    console.error("Error verifying course payment:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
    );
  }
});
