import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const COMPANY_INFO = {
  name: 'DanceVida',
  address: 'Gamlestadsv. 14, 415 02 Goteborg',
  phone: '073-702 11 34',
};

function qrBlock(payload: string, label: string): string {
  const url = `https://api.qrserver.com/v1/create-qr-code/?size=240x240&data=${encodeURIComponent(payload)}`;
  return `<div style="text-align:center;margin:14px 0;padding:14px;background:#f8fafc;border:1px solid #e5e7eb;border-radius:12px;">
    <div style="font-size:13px;color:#374151;margin-bottom:8px;font-weight:600;">${label}</div>
    <img src="${url}" alt="QR" width="240" height="240" style="display:inline-block;border-radius:8px;background:#fff;padding:8px;" />
  </div>`;
}

async function sendEmailWithReceipt(payload: {
  to: string;
  subject: string;
  html: string;
  receipt?: unknown;
}) {
  try {
    await fetch(`${Deno.env.get("SUPABASE_URL")}/functions/v1/send-email`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
  } catch (err) {
    console.error("Failed to send confirmation email:", err);
  }
}

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
      attendee_names,
    } = await req.json();

    if (!item_type || !user_id || !amount_cents) {
      throw new Error("Missing required fields: item_type, user_id, amount_cents");
    }

    // Parse attendee_names safely (accept array or JSON-encoded string)
    let attendeeNamesArr: string[] = [];
    try {
      if (Array.isArray(attendee_names)) {
        attendeeNamesArr = attendee_names.filter((n) => typeof n === "string");
      } else if (typeof attendee_names === "string" && attendee_names.trim()) {
        const parsed = JSON.parse(attendee_names);
        if (Array.isArray(parsed)) attendeeNamesArr = parsed.filter((n) => typeof n === "string");
      }
    } catch (_e) {
      attendeeNamesArr = [];
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
              attendee_names: [
                (attendeeNamesArr[i] && attendeeNamesArr[i].trim()) ||
                  customer_name ||
                  `Person ${i + 1}`,
              ],
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

      // Record payment for admin/finance visibility
      await supabaseClient.from("payments").insert({
        member_id: user_id,
        amount_cents,
        currency: "SEK",
        status: "paid",
        description: `Event: ${currentEvent?.title || "okänt"}`,
        payment_method: "swish",
        payment_type: "event",
        order_id: wp_order_id ? `swish:${wp_order_id}` : null,
      });

      // Build a richer confirmation email
      const datesList = datesToBook
        .map((d) => {
          if (!d.start_at) return '';
          try {
            return `<li>${new Date(d.start_at).toLocaleDateString('sv-SE', {
              weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
              hour: '2-digit', minute: '2-digit',
            })}</li>`;
          } catch { return ''; }
        })
        .filter(Boolean)
        .join('');

      const attendeesList = (attendeeNamesArr.length > 0 ? attendeeNamesArr : [customer_name])
        .filter(Boolean)
        .map((n, i) => `<li>Person ${i + 1}: ${n}</li>`)
        .join('');

      const totalQRs = ticketCount * datesToBook.length;
      const multiDayNote = datesToBook.length > 1
        ? `<p style="background:#fef3c7;padding:10px 12px;border-radius:8px;font-size:13px;color:#374151;">⚠️ Du har fått ${totalQRs} separata QR-koder – en per person per dag. Visa rätt QR-kod vid entrén varje dag.</p>`
        : '';

      // QR blocks (createdBookings order: per-date, per-person)
      const qrBlocksHtml = createdBookings.map((b, idx) => {
        const dateIdx = Math.floor(idx / ticketCount);
        const personIdx = idx % ticketCount;
        const dateLabel = datesToBook[dateIdx]?.start_at
          ? new Date(datesToBook[dateIdx].start_at).toLocaleDateString('sv-SE', {
              weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit',
            })
          : 'Event';
        const name = (attendeeNamesArr[personIdx] && attendeeNamesArr[personIdx].trim()) || customer_name || `Person ${personIdx + 1}`;
        return qrBlock(b.qr_payload, `${name} – ${dateLabel}`);
      }).join('');

      const emailHtml = `<!doctype html><html><body style="font-family:Arial,sans-serif;background:#f5f7fb;margin:0;padding:24px;">
        <div style="max-width:600px;margin:0 auto;background:#fff;border-radius:14px;overflow:hidden;box-shadow:0 8px 24px rgba(0,0,0,0.06);">
          <div style="padding:22px 24px;background:linear-gradient(135deg,#0f172a,#c59333);color:#fff;">
            <div style="font-size:18px;font-weight:700;">DanceVida</div>
            <div style="font-size:13px;opacity:0.85;margin-top:4px;">Bekräftelse på eventköp (Swish)</div>
          </div>
          <div style="padding:24px;">
            <h1 style="margin:0 0 8px;font-size:22px;color:#111827;">Du är bokad! 🎉</h1>
            <p style="margin:0 0 16px;color:#374151;font-size:14px;">Tack ${customer_name || ''}! Här är din bekräftelse för <strong>${currentEvent?.title || 'eventet'}</strong>.</p>
            <div style="background:#f8fafc;border:1px solid #e5e7eb;border-radius:12px;padding:14px 16px;margin-bottom:14px;">
              <strong style="font-size:14px;color:#111827;">Datum</strong>
              <ul style="margin:6px 0 0;padding-left:18px;color:#374151;font-size:13px;">${datesList || '<li>Se eventdetaljer i portalen</li>'}</ul>
              <p style="margin:10px 0 0;color:#374151;font-size:13px;"><strong>Antal biljetter:</strong> ${ticketCount} person(er) × ${datesToBook.length} dag(ar) = ${totalQRs} QR-koder</p>
            </div>
            <div style="background:#f8fafc;border:1px solid #e5e7eb;border-radius:12px;padding:14px 16px;margin-bottom:14px;">
              <strong style="font-size:14px;color:#111827;">Deltagare</strong>
              <ul style="margin:6px 0 0;padding-left:18px;color:#374151;font-size:13px;">${attendeesList}</ul>
            </div>
            ${multiDayNote}
            <h2 style="margin:18px 0 6px;font-size:16px;color:#111827;">Dina QR-koder</h2>
            <p style="color:#374151;font-size:13px;margin:0 0 8px;">Visa rätt QR-kod vid entrén. Kvitto bifogas som PDF.</p>
            ${qrBlocksHtml}
            <p style="margin-top:18px;">
              <a href="https://cms.dancevida.se/biljetter" style="display:inline-block;background:#c59333;color:#fff;text-decoration:none;padding:12px 18px;border-radius:10px;font-weight:700;font-size:14px;">Visa mina biljetter</a>
            </p>
          </div>
        </div>
      </body></html>`;

      const totalUnits = ticketCount * datesToBook.length;
      await sendEmailWithReceipt({
        to: customer_email,
        subject: `Eventbokning bekräftad: ${currentEvent?.title}`,
        html: emailHtml,
        receipt: {
          customerName: customer_name || '',
          customerEmail: customer_email,
          date: new Date().toLocaleDateString('sv-SE'),
          items: [{
            description: `Event: ${currentEvent?.title || 'okänt'} (${ticketCount} pers × ${datesToBook.length} dag)`,
            quantity: totalUnits,
            unitPrice: Math.round(amount_cents / Math.max(totalUnits, 1)),
            currency: 'SEK',
          }],
          totalAmount: amount_cents,
          currency: 'SEK',
          orderId: wp_order_id ? `swish:${wp_order_id}` : `swish:${createdBookings[0]?.id || ''}`,
          companyInfo: COMPANY_INFO,
        },
      });

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

      await supabaseClient.from("payments").insert({
        member_id: user_id,
        amount_cents,
        currency: "SEK",
        status: "paid",
        description: `Kurs: ${course.title}`,
        payment_method: "swish",
        payment_type: "course",
        order_id: wp_order_id ? `swish:${wp_order_id}` : null,
      });

      const courseHtml = `<!doctype html><html><body style="font-family:Arial,sans-serif;background:#f5f7fb;margin:0;padding:24px;"><div style="max-width:600px;margin:0 auto;background:#fff;border-radius:14px;overflow:hidden;box-shadow:0 8px 24px rgba(0,0,0,0.06);"><div style="padding:22px 24px;background:linear-gradient(135deg,#0f172a,#c59333);color:#fff;"><div style="font-size:18px;font-weight:700;">DanceVida</div><div style="font-size:13px;opacity:0.85;margin-top:4px;">Kursköp bekräftat (Swish)</div></div><div style="padding:24px;color:#374151;font-size:14px;"><h1 style="margin:0 0 8px;font-size:22px;color:#111827;">Tack ${customer_name}! 🎉</h1><p>Ditt kursköp för <strong>${course.title}</strong> är bekräftat. Använd QR-koden nedan vid incheckning. Kvitto bifogas som PDF.</p>${qrBlock(ticket.qr_payload, `Klippkort – ${course.title}`)}<p style="margin-top:18px;"><a href="https://cms.dancevida.se/biljetter" style="display:inline-block;background:#c59333;color:#fff;text-decoration:none;padding:12px 18px;border-radius:10px;font-weight:700;">Visa mina biljetter</a></p></div></div></body></html>`;

      await sendEmailWithReceipt({
        to: customer_email,
        subject: `Kursköp bekräftat: ${course.title}`,
        html: courseHtml,
        receipt: {
          customerName: customer_name || '',
          customerEmail: customer_email,
          date: new Date().toLocaleDateString('sv-SE'),
          items: [{
            description: `Kurs: ${course.title}`,
            quantity: 1,
            unitPrice: amount_cents,
            currency: 'SEK',
          }],
          totalAmount: amount_cents,
          currency: 'SEK',
          orderId: wp_order_id ? `swish:${wp_order_id}` : `swish:${ticket.id}`,
          companyInfo: COMPANY_INFO,
        },
      });

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

      await supabaseClient.from("payments").insert({
        member_id: user_id,
        amount_cents,
        currency: "SEK",
        status: "paid",
        description: `Klippkort: ${ticketCount} st`,
        payment_method: "swish",
        payment_type: "tickets",
        order_id: orderTag,
      });

      const ticketHtml = `<!doctype html><html><body style="font-family:Arial,sans-serif;background:#f5f7fb;margin:0;padding:24px;"><div style="max-width:600px;margin:0 auto;background:#fff;border-radius:14px;overflow:hidden;box-shadow:0 8px 24px rgba(0,0,0,0.06);"><div style="padding:22px 24px;background:linear-gradient(135deg,#0f172a,#c59333);color:#fff;"><div style="font-size:18px;font-weight:700;">DanceVida</div><div style="font-size:13px;opacity:0.85;margin-top:4px;">Biljetter bekräftade (Swish)</div></div><div style="padding:24px;color:#374151;font-size:14px;"><h1 style="margin:0 0 8px;font-size:22px;color:#111827;">Tack ${customer_name}! 🎉</h1><p>Dina <strong>${ticketCount} klipp</strong> är bekräftade och giltiga i 3 månader. Använd QR-koden nedan vid incheckning. Kvitto bifogas som PDF.</p>${qrBlock(ticket.qr_payload, `Klippkort (${ticketCount} klipp)`)}<p style="margin-top:18px;"><a href="https://cms.dancevida.se/biljetter" style="display:inline-block;background:#c59333;color:#fff;text-decoration:none;padding:12px 18px;border-radius:10px;font-weight:700;">Visa mina biljetter</a></p></div></div></body></html>`;

      await sendEmailWithReceipt({
        to: customer_email,
        subject: `Biljetter bekräftade / Tickets confirmed`,
        html: ticketHtml,
        receipt: {
          customerName: customer_name || '',
          customerEmail: customer_email,
          date: new Date().toLocaleDateString('sv-SE'),
          items: [{
            description: `Klippkort: ${ticketCount} st`,
            quantity: ticketCount,
            unitPrice: Math.round(amount_cents / Math.max(ticketCount, 1)),
            currency: 'SEK',
          }],
          totalAmount: amount_cents,
          currency: 'SEK',
          orderId: orderTag || `swish:${ticket.id}`,
          companyInfo: COMPANY_INFO,
        },
      });

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
