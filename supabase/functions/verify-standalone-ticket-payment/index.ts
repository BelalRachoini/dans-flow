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
    const { sessionId } = await req.json();

    const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") || "", { 
      apiVersion: "2025-08-27.basil" 
    });

    const session = await stripe.checkout.sessions.retrieve(sessionId);

    if (session.payment_status !== 'paid') {
      throw new Error('Payment not completed');
    }

    const userId = session.metadata?.user_id;
    const ticketCount = parseInt(session.metadata?.ticket_count || '1');

    if (!userId) throw new Error('User ID not found in session metadata');

    // Calculate expiry date (3 months from now)
    const expiresAt = new Date();
    expiresAt.setMonth(expiresAt.getMonth() + 3);

    // Create ticket package
    const { data: ticket, error: ticketError } = await supabaseClient
      .from('tickets')
      .insert({
        member_id: userId,
        course_id: null,
        source_course_id: null,
        status: 'valid',
        qr_payload: crypto.randomUUID(),
        total_tickets: ticketCount,
        tickets_used: 0,
        order_id: `standalone:${session.id}`,
        expires_at: expiresAt.toISOString()
      })
      .select()
      .single();

    if (ticketError) throw ticketError;

    // Record payment
    await supabaseClient
      .from('payments')
      .insert({
        member_id: userId,
        amount_cents: session.amount_total || 0,
        currency: (session.currency || 'sek').toUpperCase(),
        status: 'completed',
        description: `Standalone ${ticketCount} ticket${ticketCount > 1 ? 's' : ''} package`
      });

    return new Response(JSON.stringify({ 
      success: true, 
      ticket_id: ticket.id,
      tickets: ticketCount 
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error) {
    console.error("Error verifying standalone ticket payment:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error occurred";
    return new Response(JSON.stringify({ error: errorMessage }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
