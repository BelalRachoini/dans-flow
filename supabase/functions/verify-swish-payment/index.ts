import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
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
    const {
      item_type,
      item_id,
      user_id,
      customer_email,
      customer_name,
      amount_cents,
      quantity,
      wp_order_id,
    } = await req.json();

    if (!item_type || !user_id || !amount_cents) {
      throw new Error("Missing required fields: item_type, user_id, amount_cents");
    }

    // ── EVENT ──
    if (item_type === "event") {
      if (!item_id) throw new Error("Missing item_id for event");

      // Idempotency: check existing booking
      const { data: existing } = await supabaseClient
        .from("event_bookings")
        .select("id")
        .eq("member_id", user_id)
        .eq("event_id", item_id);

      if (existing && existing.length > 0) {
        return new Response(
          JSON.stringify({ success: true, already_exists: true }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
        );
      }

      const { data: eventDates } = await supabaseClient
        .from("event_dates")
        .select("id, start_at, end_at")
        .eq("event_id", item_id)
        .order("start_at", { ascending: true });

      const { data: currentEvent } = await supabaseClient
        .from("events")
        .select("sold_count, title, start_at")
        .eq("id", item_id)
        .single();

      const datesToBook = eventDates && eventDates.length > 0
        ? eventDates
        : [{ id: null, start_at: currentEvent?.start_at, end_at: null }];

      const ticketCount = quantity || 1;
      const createdBookings = [];

      for (const eventDate of datesToBook) {
        for (let i = 0; i < ticketCount; i++) {
          const { data: booking, error } = await supabaseClient
            .from("event_bookings")
            .insert({
              member_id: user_id,
              event_id: item_id,
              event_date_id: eventDate.id,
              status: "confirmed",
              payment_status: "paid",
              ticket_count: 1,
              checkins_allowed: 1,
              checkins_used: 0,
              attendee_names: [customer_name || `Person ${i + 1}`],
              qr_payload: crypto.randomUUID(),
            })
            .select()
            .single();

          if (error) throw error;
          createdBookings.push(booking);
        }
      }

      if (currentEvent) {
        await supabaseClient
          .from("events")
          .update({ sold_count: currentEvent.sold_count + (ticketCount * datesToBook.length) })
          .eq("id", item_id);
      }

      // Send confirmation email
      try {
        await fetch(`${Deno.env.get("SUPABASE_URL")}/functions/v1/send-email`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            to: customer_email,
            subject: `Eventbokning bekräftad: ${currentEvent?.title}`,
            html: `<p>Tack ${customer_name}! Din bokning för ${currentEvent?.title} är bekräftad. Logga in på <a href="https://cms.dancevida.se">cms.dancevida.se</a> för att se dina biljetter och QR-koder.</p>`,
          }),
        });
      } catch (emailErr) {
        console.error("Failed to send confirmation email:", emailErr);
      }

      return new Response(
        JSON.stringify({ success: true, bookings: createdBookings.length }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
      );
    }

    // ── COURSE ──
    if (item_type === "course") {
      if (!item_id) throw new Error("Missing item_id for course");

      // Idempotency: check existing ticket for this course
      const { data: existing } = await supabaseClient
        .from("tickets")
        .select("id")
        .eq("member_id", user_id)
        .eq("course_id", item_id)
        .maybeSingle();

      if (existing) {
        return new Response(
          JSON.stringify({ success: true, already_exists: true }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
        );
      }

      const { data: course } = await supabaseClient
        .from("courses")
        .select("*")
        .eq("id", item_id)
        .single();

      if (!course) throw new Error("Course not found");

      const { count: lessonsCount } = await supabaseClient
        .from("course_lessons")
        .select("*", { count: "exact", head: true })
        .eq("course_id", item_id);

      const total_tickets = lessonsCount || 10;
      const expires_at = course.ends_at
        ? new Date(course.ends_at).toISOString()
        : new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString();

      const { data: ticket, error } = await supabaseClient
        .from("tickets")
        .insert({
          member_id: user_id,
          course_id: item_id,
          source_course_id: item_id,
          status: "valid",
          qr_payload: crypto.randomUUID(),
          total_tickets,
          tickets_used: 0,
          expires_at,
        })
        .select()
        .single();

      if (error) throw error;

      try {
        await fetch(`${Deno.env.get("SUPABASE_URL")}/functions/v1/send-email`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            to: customer_email,
            subject: `Kursköp bekräftat: ${course.title}`,
            html: `<p>Tack ${customer_name}! Ditt kursköp för ${course.title} är bekräftat. Logga in på <a href="https://cms.dancevida.se">cms.dancevida.se</a> för att se din biljett.</p>`,
          }),
        });
      } catch (emailErr) {
        console.error("Failed to send confirmation email:", emailErr);
      }

      return new Response(
        JSON.stringify({ success: true, ticket_id: ticket.id }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
      );
    }

    // ── STANDALONE TICKET ──
    if (item_type === "ticket") {
      const ticketCount = quantity || 1;
      const orderTag = wp_order_id ? `swish:${wp_order_id}` : null;

      // Idempotency: check by order_id if we have a wp_order_id
      if (orderTag) {
        const { data: existing } = await supabaseClient
          .from("tickets")
          .select("id")
          .eq("order_id", orderTag)
          .maybeSingle();

        if (existing) {
          return new Response(
            JSON.stringify({ success: true, already_exists: true }),
            { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
          );
        }
      }

      const expiresAt = new Date();
      expiresAt.setMonth(expiresAt.getMonth() + 3);

      const { data: ticket, error } = await supabaseClient
        .from("tickets")
        .insert({
          member_id: user_id,
          course_id: null,
          source_course_id: null,
          status: "valid",
          qr_payload: crypto.randomUUID(),
          total_tickets: ticketCount,
          tickets_used: 0,
          order_id: orderTag,
          expires_at: expiresAt.toISOString(),
        })
        .select()
        .single();

      if (error) throw error;

      try {
        await fetch(`${Deno.env.get("SUPABASE_URL")}/functions/v1/send-email`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            to: customer_email,
            subject: `Biljetter bekräftade / Tickets confirmed`,
            html: `<p>Tack ${customer_name}! Dina ${ticketCount} biljetter är bekräftade. Logga in på <a href="https://cms.dancevida.se">cms.dancevida.se</a> för att se dem.</p>`,
          }),
        });
      } catch (emailErr) {
        console.error("Failed to send confirmation email:", emailErr);
      }

      return new Response(
        JSON.stringify({ success: true, ticket_id: ticket.id }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
      );
    }

    throw new Error(`Unknown item_type: ${item_type}`);

  } catch (error) {
    console.error("Error in verify-swish-payment:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
    );
  }
});
