import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

function formatDateSwedish(date: Date): string {
  return date.toLocaleDateString("sv-SE", {
    weekday: "long", year: "numeric", month: "long", day: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
}

// ── Fulfillment helpers ─────────────────────────────────────────────

async function fulfillEvent(supabase: any, payment: any) {
  const meta = payment.metadata;
  const userId = payment.member_id;
  const ticketCount = parseInt(meta.ticket_count || "1", 10);
  const attendeeNames: string[] = meta.attendee_names ? JSON.parse(meta.attendee_names) : [];

  const { data: eventDates } = await supabase
    .from("event_dates").select("id, start_at, end_at")
    .eq("event_id", meta.event_id).order("start_at", { ascending: true });

  const { data: currentEvent } = await supabase
    .from("events").select("sold_count, title, start_at")
    .eq("id", meta.event_id).single();

  const datesToBook = eventDates?.length ? eventDates : [{ id: null, start_at: currentEvent?.start_at, end_at: null }];

  for (const eventDate of datesToBook) {
    for (let i = 0; i < ticketCount; i++) {
      const attendeeName = attendeeNames[i] || `Person ${i + 1}`;
      await supabase.from("event_bookings").insert({
        member_id: userId, event_id: meta.event_id,
        event_date_id: eventDate.id, status: "confirmed", payment_status: "paid",
        ticket_count: 1, checkins_allowed: 1, checkins_used: 0,
        attendee_names: [attendeeName], qr_payload: crypto.randomUUID(),
      });
    }
  }

  if (currentEvent) {
    const totalSold = ticketCount * datesToBook.length;
    await supabase.from("events").update({ sold_count: currentEvent.sold_count + totalSold }).eq("id", meta.event_id);
  }

  await recordPayment(supabase, userId, payment.amount_cents, `Event: ${currentEvent?.title || "Event"}`);

  // Send email
  const { data: profile } = await supabase.from("profiles").select("full_name, email").eq("id", userId).single();
  const { data: authUser } = await supabase.auth.admin.getUserById(userId);
  const email = profile?.email || authUser?.user?.email;
  const name = profile?.full_name || email?.split("@")[0] || "Dansare";

  if (email) {
    const formattedDates = datesToBook.map((d: any) => d.start_at ? formatDateSwedish(new Date(d.start_at)) : "TBD");
    const attendeeStr = attendeeNames.length > 0 ? attendeeNames.join(", ") : name;
    const totalBookings = ticketCount * datesToBook.length;
    await sendConfirmationEmail(email, "Eventbokning bekräftad / Event booking confirmed", name, {
      type: "event", eventName: currentEvent?.title || "Event",
      dates: formattedDates, ticketCount, attendeeNames: attendeeStr, totalBookings,
      amountCents: payment.amount_cents, orderId: `swish:${payment.payment_request_id}`,
    });
  }
}

async function fulfillStandaloneTickets(supabase: any, payment: any) {
  const meta = payment.metadata;
  const userId = payment.member_id;
  const ticketCount = parseInt(meta.ticket_count || "1", 10);

  const expiresAt = new Date();
  expiresAt.setMonth(expiresAt.getMonth() + 3);

  await supabase.from("tickets").insert({
    member_id: userId, course_id: null, source_course_id: null,
    status: "valid", qr_payload: crypto.randomUUID(),
    total_tickets: ticketCount, tickets_used: 0,
    order_id: `swish:${payment.payment_request_id}`,
    expires_at: expiresAt.toISOString(),
  });

  await recordPayment(supabase, userId, payment.amount_cents, `Klippkort: ${ticketCount} st`);

  const { data: profile } = await supabase.from("profiles").select("full_name, email").eq("id", userId).single();
  const { data: authUser } = await supabase.auth.admin.getUserById(userId);
  const email = profile?.email || authUser?.user?.email;
  const name = profile?.full_name || email?.split("@")[0] || "Dansare";

  if (email) {
    await sendConfirmationEmail(email, "Biljettköp bekräftat / Ticket purchase confirmed", name, {
      type: "standalone_tickets", ticketCount,
      expiryDate: expiresAt.toLocaleDateString("sv-SE"),
      amountCents: payment.amount_cents, orderId: `swish:${payment.payment_request_id}`,
    });
  }
}

async function fulfillLesson(supabase: any, payment: any) {
  const meta = payment.metadata;
  const userId = payment.member_id;
  const ticketType = meta.ticket_type || "single";
  const checkinsAllowed = ticketType === "couple" ? 2 : ticketType === "trio" ? 3 : 1;

  await supabase.from("lesson_bookings").insert({
    member_id: userId, lesson_id: meta.lesson_id,
    ticket_type: ticketType, checkins_allowed: checkinsAllowed,
    qr_payload: crypto.randomUUID(), status: "valid",
  });

  await recordPayment(supabase, userId, payment.amount_cents, `Drop-in: ${ticketType}`);

  const { data: lesson } = await supabase
    .from("course_lessons").select("title, starts_at, course_id")
    .eq("id", meta.lesson_id).single();

  let courseName = "Kurs";
  if (lesson?.course_id) {
    const { data: course } = await supabase.from("courses").select("title").eq("id", lesson.course_id).single();
    if (course) courseName = course.title;
  }

  const { data: profile } = await supabase.from("profiles").select("full_name, email").eq("id", userId).single();
  const { data: authUser } = await supabase.auth.admin.getUserById(userId);
  const email = profile?.email || authUser?.user?.email;
  const name = profile?.full_name || email?.split("@")[0] || "Dansare";

  if (email) {
    const lessonDate = lesson?.starts_at ? formatDateSwedish(new Date(lesson.starts_at)) : "TBD";
    await sendConfirmationEmail(email, "Drop-in bokning bekräftad / Drop-in booking confirmed", name, {
      type: "lesson", courseName, lessonTitle: lesson?.title || "Lektion",
      lessonDate, ticketType,
      amountCents: payment.amount_cents, orderId: `swish:${payment.payment_request_id}`,
    });
  }
}

async function fulfillCourse(supabase: any, payment: any) {
  const meta = payment.metadata;
  const userId = payment.member_id;
  const selectedClassIds: string[] = meta.selected_class_ids ? JSON.parse(meta.selected_class_ids) : [];

  const { data: course } = await supabase.from("courses").select("*").eq("id", meta.course_id).single();
  if (!course) throw new Error("Course not found");

  // Check existing ticket
  const { data: existingTicket } = await supabase
    .from("tickets").select("id")
    .eq("member_id", userId).eq("course_id", meta.course_id).single();
  if (existingTicket) {
    console.log("[swish-callback] Ticket already exists for course, skipping");
    return;
  }

  let totalTickets = 0;
  const isPackageOrBundle = selectedClassIds.length > 0;

  if (isPackageOrBundle) {
    const selectionsToInsert = selectedClassIds.map((classId: string) => ({
      member_id: userId, course_id: meta.course_id,
      class_id: classId, order_id: `swish:${payment.payment_request_id}`,
    }));
    await supabase.from("course_class_selections").insert(selectionsToInsert);

    const { data: lessons } = await supabase
      .from("course_lessons").select("id, class_id")
      .in("class_id", selectedClassIds);

    totalTickets = lessons?.length || selectedClassIds.length * 8;

    if (lessons?.length) {
      const bookings = lessons.map((l: any) => ({
        member_id: userId, lesson_id: l.id,
        ticket_type: "package_auto", checkins_allowed: 1,
        checkins_used: 1, status: "used", qr_payload: crypto.randomUUID(),
      }));
      await supabase.from("lesson_bookings").insert(bookings);
    }
  } else {
    const { count } = await supabase
      .from("course_lessons").select("*", { count: "exact", head: true })
      .eq("course_id", meta.course_id);
    totalTickets = count || 10;
  }

  const expiresAt = course.ends_at
    ? new Date(course.ends_at).toISOString()
    : new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString();

  await supabase.from("tickets").insert({
    member_id: userId, course_id: meta.course_id,
    source_course_id: meta.course_id, status: "valid",
    qr_payload: crypto.randomUUID(), total_tickets: totalTickets,
    tickets_used: 0, expires_at: expiresAt,
  });

  await recordPayment(supabase, userId, payment.amount_cents, `Kurs: ${course.title}`);

  const { data: profile } = await supabase.from("profiles").select("full_name, email").eq("id", userId).single();
  const { data: authUser } = await supabase.auth.admin.getUserById(userId);
  const email = profile?.email || authUser?.user?.email;
  const name = profile?.full_name || email?.split("@")[0] || "Dansare";

  if (email) {
    await sendConfirmationEmail(email, "Kursköp bekräftat / Course purchase confirmed", name, {
      type: "course", courseName: course.title, ticketCount: totalTickets,
      expiryDate: new Date(expiresAt).toLocaleDateString("sv-SE"),
      amountCents: payment.amount_cents, orderId: `swish:${payment.payment_request_id}`,
    });
  }
}

async function recordPayment(supabase: any, memberId: string, amountCents: number, description: string) {
  await supabase.from("payments").insert({
    member_id: memberId,
    amount_cents: amountCents,
    currency: "SEK",
    status: "completed",
    description: `[Swish] ${description}`,
  });
}

async function sendConfirmationEmail(to: string, subject: string, customerName: string, data: any) {
  try {
    const amountStr = ((data.amountCents || 0) / 100).toFixed(0) + " SEK";
    let descriptionSv = "";
    let descriptionEn = "";
    let receiptDescription = "";

    if (data.type === "event") {
      descriptionSv = `Event: ${data.eventName}\nAntal biljetter: ${data.ticketCount}\nDeltagare: ${data.attendeeNames}`;
      descriptionEn = `Event: ${data.eventName}\nTickets: ${data.ticketCount}\nAttendees: ${data.attendeeNames}`;
      receiptDescription = `Event: ${data.eventName} (${data.ticketCount} biljett/er)`;
    } else if (data.type === "standalone_tickets") {
      descriptionSv = `Klippkort: ${data.ticketCount} st\nGiltig till: ${data.expiryDate}`;
      descriptionEn = `Ticket package: ${data.ticketCount}\nValid until: ${data.expiryDate}`;
      receiptDescription = `Klippkort (${data.ticketCount} st)`;
    } else if (data.type === "lesson") {
      const ticketLabel = data.ticketType === "couple" ? "Par" : data.ticketType === "trio" ? "Trio" : "Singel";
      descriptionSv = `Drop-in (${ticketLabel}): ${data.courseName} - ${data.lessonTitle}\nDatum: ${data.lessonDate}`;
      descriptionEn = `Drop-in (${ticketLabel}): ${data.courseName} - ${data.lessonTitle}\nDate: ${data.lessonDate}`;
      receiptDescription = `Drop-in (${ticketLabel}): ${data.courseName}`;
    } else if (data.type === "course") {
      descriptionSv = `Kurs: ${data.courseName}\nAntal klipp: ${data.ticketCount}\nGiltig till: ${data.expiryDate}`;
      descriptionEn = `Course: ${data.courseName}\nTickets: ${data.ticketCount}\nValid until: ${data.expiryDate}`;
      receiptDescription = `Kurs: ${data.courseName}`;
    }

    const html = `<!doctype html><html lang="sv"><head><meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/><title>DanceVida</title></head>
<body style="margin:0;padding:0;background:#f5f7fb;">
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f5f7fb;">
<tr><td align="center" style="padding:24px 12px;">
<table role="presentation" width="600" cellspacing="0" cellpadding="0" style="width:600px;max-width:600px;background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 8px 24px rgba(16,24,40,0.08);">
<tr><td style="padding:22px 24px;background:linear-gradient(135deg,#111827,#16a34a);">
<div style="font-family:Arial,sans-serif;font-size:18px;color:#fff;font-weight:700;">DanceVida</div>
<div style="font-family:Arial,sans-serif;font-size:13px;color:rgba(255,255,255,0.85);margin-top:4px;">Betalning via Swish ✓</div>
</td></tr>
<tr><td style="padding:26px 24px;">
<div style="font-family:Arial,sans-serif;font-size:22px;color:#111827;font-weight:800;">Tack, ${customerName}! 🎉</div>
<div style="font-family:Arial,sans-serif;font-size:14px;color:#374151;margin-top:10px;white-space:pre-line;">${descriptionSv}</div>
<div style="margin-top:16px;padding:16px;background:#f0fdf4;border:1px solid #bbf7d0;border-radius:12px;">
<div style="font-family:Arial,sans-serif;font-size:14px;color:#166534;font-weight:700;">✓ Betald med Swish: ${amountStr}</div>
</div>
<div style="font-family:Arial,sans-serif;font-size:13px;color:#374151;margin-top:14px;">
QR-koden finns i vår portal. Logga in på <a href="https://cms.dancevida.se/" style="color:#16a34a;">cms.dancevida.se</a> → <strong>Tickets</strong>.
</div>
<hr style="border:none;border-top:1px solid #e5e7eb;margin:22px 0 16px 0;"/>
<div style="font-family:Arial,sans-serif;font-size:18px;color:#111827;font-weight:800;">Thank you, ${customerName}! 🎉</div>
<div style="font-family:Arial,sans-serif;font-size:14px;color:#374151;margin-top:10px;white-space:pre-line;">${descriptionEn}</div>
<div style="font-family:Arial,sans-serif;font-size:13px;color:#374151;margin-top:14px;">
Your QR code is in our portal. Log in at <a href="https://cms.dancevida.se/" style="color:#16a34a;">cms.dancevida.se</a> → <strong>Tickets</strong>.
</div>
</td></tr>
<tr><td style="padding:18px 24px 24px;border-top:1px solid #e5e7eb;">
<div style="font-family:Arial,sans-serif;font-size:12px;color:#6b7280;">DanceVida · Gamlestadsvägen 14, 415 02 Göteborg · 073-702 11 34</div>
</td></tr>
</table></td></tr></table></body></html>`;

    const receiptData = {
      customerName, customerEmail: to,
      date: new Date().toLocaleDateString("sv-SE"),
      items: [{ description: receiptDescription, quantity: 1, unitPrice: data.amountCents || 0, currency: "SEK" }],
      totalAmount: data.amountCents || 0, currency: "SEK",
      orderId: data.orderId,
      companyInfo: { name: "DanceVida", address: "Gamlestadsv. 14, 415 02 Göteborg", phone: "073-702 11 34" },
    };

    await fetch(`${supabaseUrl}/functions/v1/send-email`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ to, subject, html, receipt: receiptData }),
    });

    console.log("[swish-callback] Email sent to:", to);
  } catch (e) {
    console.error("[swish-callback] Email failed:", e);
  }
}

// ── Main handler ────────────────────────────────────────────────────

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabase = createClient(supabaseUrl, supabaseServiceKey, { auth: { persistSession: false } });

  try {
    const callback = await req.json();
    console.log("[swish-callback] Received:", JSON.stringify(callback));

    const swishId = callback.id; // Same UUID we sent
    const swishStatus = callback.status; // PAID, DECLINED, ERROR, CANCELLED

    if (!swishId || !swishStatus) {
      throw new Error("Missing id or status in callback");
    }

    // Find our payment record
    const { data: payment, error: findError } = await supabase
      .from("swish_payments")
      .select("*")
      .eq("payment_request_id", swishId)
      .single();

    if (findError || !payment) {
      console.error("[swish-callback] Payment not found for ID:", swishId);
      return new Response(JSON.stringify({ error: "Payment not found" }), {
        status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Prevent double-processing
    if (payment.status === "PAID") {
      console.log("[swish-callback] Already processed:", swishId);
      return new Response(JSON.stringify({ ok: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Update payment status
    await supabase.from("swish_payments").update({
      status: swishStatus,
      swish_callback_data: callback,
      updated_at: new Date().toISOString(),
    }).eq("id", payment.id);

    // Only fulfill on PAID
    if (swishStatus === "PAID") {
      console.log("[swish-callback] Fulfilling payment type:", payment.payment_type);

      switch (payment.payment_type) {
        case "event":
          await fulfillEvent(supabase, payment);
          break;
        case "standalone_tickets":
          await fulfillStandaloneTickets(supabase, payment);
          break;
        case "lesson":
          await fulfillLesson(supabase, payment);
          break;
        case "course":
          await fulfillCourse(supabase, payment);
          break;
        default:
          console.warn("[swish-callback] Unknown payment_type:", payment.payment_type);
      }
    }

    return new Response(JSON.stringify({ ok: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("[swish-callback] Error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
