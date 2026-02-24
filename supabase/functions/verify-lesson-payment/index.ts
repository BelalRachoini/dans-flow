import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

function buildLessonEmail(customerName: string, lessonTitle: string, courseName: string, lessonDate: string, ticketType: string): string {
  const ticketLabel = ticketType === 'couple' ? 'Par / Couple' : 'Singel / Single';

  return `<!doctype html>
<html lang="sv">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width,initial-scale=1" />
    <meta name="x-apple-disable-message-reformatting" />
    <title>DanceVida – Drop-in bokning</title>
  </head>
  <body style="margin:0;padding:0;background:#f5f7fb;">
    <div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent;">
      Tack for din drop-in bokning hos DanceVida.
    </div>
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f5f7fb;">
      <tr>
        <td align="center" style="padding:24px 12px;">
          <table role="presentation" width="600" cellspacing="0" cellpadding="0"
            style="width:600px;max-width:600px;background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 8px 24px rgba(16,24,40,0.08);">
            <!-- Header -->
            <tr>
              <td style="padding:22px 24px;background:linear-gradient(135deg,#111827,#f59e0b);">
                <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
                  <tr>
                    <td align="left" style="vertical-align:middle;">
                      <div style="font-family:Arial,Helvetica,sans-serif;font-size:18px;line-height:22px;color:#ffffff;font-weight:700;">DanceVida</div>
                      <div style="font-family:Arial,Helvetica,sans-serif;font-size:13px;line-height:18px;color:rgba(255,255,255,0.85);margin-top:4px;">Bekraftelse pa drop-in</div>
                    </td>
                    <td align="right" style="vertical-align:middle;">
                      <img src="https://cms.dancevida.se/logo.png" width="44" height="44" alt="DanceVida" style="display:block;border:0;border-radius:10px;background:#ffffff1a;" />
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
            <!-- Body -->
            <tr>
              <td style="padding:26px 24px 20px 24px;">
                <!-- Swedish -->
                <div style="font-family:Arial,Helvetica,sans-serif;font-size:22px;line-height:28px;color:#111827;font-weight:800;">Tack for din bokning! 🎶</div>
                <div style="font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:22px;color:#374151;margin-top:10px;">Har ar en sammanfattning av ditt drop-in kop:</div>
                <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin-top:16px;background:#f8fafc;border:1px solid #e5e7eb;border-radius:14px;">
                  <tr>
                    <td style="padding:16px;">
                      <div style="font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:18px;color:#111827;font-weight:700;">Drop-in detaljer</div>
                      <div style="font-family:Arial,Helvetica,sans-serif;font-size:13px;line-height:20px;color:#374151;margin-top:8px;">
                        <strong>Kurs:</strong> ${courseName}<br/>
                        <strong>Lektion:</strong> ${lessonTitle}<br/>
                        <strong>Datum:</strong> ${lessonDate}<br/>
                        <strong>Biljetttyp:</strong> ${ticketLabel}
                      </div>
                    </td>
                  </tr>
                </table>
                <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin-top:14px;">
                  <tr>
                    <td>
                      <div style="font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:22px;color:#111827;font-weight:700;">Din biljett & QR-kod</div>
                      <div style="font-family:Arial,Helvetica,sans-serif;font-size:13px;line-height:20px;color:#374151;margin-top:6px;">
                        QR-koden finns i var portal. Logga in pa <a href="https://cms.dancevida.se/" style="color:#d97706;text-decoration:underline;">https://cms.dancevida.se/</a> och ga till <strong>Tickets</strong>.
                      </div>
                    </td>
                  </tr>
                </table>
                <table role="presentation" cellspacing="0" cellpadding="0" style="margin-top:16px;">
                  <tr>
                    <td align="left">
                      <a href="https://cms.dancevida.se/" style="display:inline-block;font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:18px;color:#ffffff;text-decoration:none;background:#d97706;padding:12px 16px;border-radius:12px;font-weight:700;">Logga in & oppna Tickets</a>
                    </td>
                  </tr>
                </table>
                <hr style="border:none;border-top:1px solid #e5e7eb;margin:22px 0 16px 0;" />
                <!-- English -->
                <div style="font-family:Arial,Helvetica,sans-serif;font-size:18px;line-height:24px;color:#111827;font-weight:800;">Thank you for your booking! 🎶</div>
                <div style="font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:22px;color:#374151;margin-top:10px;">Here's a summary of your drop-in purchase:</div>
                <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin-top:16px;background:#f8fafc;border:1px solid #e5e7eb;border-radius:14px;">
                  <tr>
                    <td style="padding:16px;">
                      <div style="font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:18px;color:#111827;font-weight:700;">Drop-in details</div>
                      <div style="font-family:Arial,Helvetica,sans-serif;font-size:13px;line-height:20px;color:#374151;margin-top:8px;">
                        <strong>Course:</strong> ${courseName}<br/>
                        <strong>Lesson:</strong> ${lessonTitle}<br/>
                        <strong>Date:</strong> ${lessonDate}<br/>
                        <strong>Ticket type:</strong> ${ticketLabel}
                      </div>
                    </td>
                  </tr>
                </table>
                <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin-top:14px;">
                  <tr>
                    <td>
                      <div style="font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:22px;color:#111827;font-weight:700;">Your ticket & QR code</div>
                      <div style="font-family:Arial,Helvetica,sans-serif;font-size:13px;line-height:20px;color:#374151;margin-top:6px;">
                        Your QR code is available in our portal. Log in at <a href="https://cms.dancevida.se/" style="color:#d97706;text-decoration:underline;">https://cms.dancevida.se/</a> and go to <strong>Tickets</strong>.
                      </div>
                    </td>
                  </tr>
                </table>
                <table role="presentation" cellspacing="0" cellpadding="0" style="margin-top:16px;">
                  <tr>
                    <td align="left">
                      <a href="https://cms.dancevida.se/" style="display:inline-block;font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:18px;color:#ffffff;text-decoration:none;background:#111827;padding:12px 16px;border-radius:12px;font-weight:700;">Log in & open Tickets</a>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
            <!-- Footer -->
            <tr>
              <td style="padding:18px 24px 24px 24px;background:#ffffff;">
                <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border-top:1px solid #e5e7eb;">
                  <tr>
                    <td style="padding-top:14px;">
                      <div style="font-family:Arial,Helvetica,sans-serif;font-size:12px;line-height:18px;color:#6b7280;">DanceVida · Gamlestadsvagen 14, 415 02 Goteborg · 073-702 11 34</div>
                      <div style="font-family:Arial,Helvetica,sans-serif;font-size:12px;line-height:18px;color:#6b7280;margin-top:6px;">Fragor? Svara pa detta mejl eller ring oss. / Questions? Reply to this email or call us.</div>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;
}

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

    // Record payment
    const amountCents = session.amount_total || 0;
    const currency = (session.currency || 'sek').toUpperCase();

    await supabaseAdmin
      .from('payments')
      .insert({
        member_id: user.id,
        amount_cents: amountCents,
        currency: currency,
        status: 'completed',
        description: `Drop-in lesson: ${ticket_type}`,
      });

    // Fetch lesson + course details for email
    const { data: lesson } = await supabaseAdmin
      .from("course_lessons")
      .select("title, starts_at, course_id")
      .eq("id", lesson_id)
      .single();

    let courseName = "Kurs";
    if (lesson?.course_id) {
      const { data: course } = await supabaseAdmin
        .from("courses")
        .select("title")
        .eq("id", lesson.course_id)
        .single();
      if (course) courseName = course.title;
    }

    const lessonTitle = lesson?.title || "Lektion";
    const lessonDate = lesson?.starts_at
      ? new Date(lesson.starts_at).toLocaleDateString("sv-SE", { weekday: "long", year: "numeric", month: "long", day: "numeric", hour: "2-digit", minute: "2-digit" })
      : "TBD";

    // Get user profile for email
    const { data: profile } = await supabaseAdmin
      .from("profiles")
      .select("full_name")
      .eq("id", user.id)
      .single();

    const customerName = profile?.full_name || user.email?.split("@")[0] || "Dansare";

    // Send confirmation email with receipt
    if (user.email) {
      try {
        const emailHtml = buildLessonEmail(customerName, lessonTitle, courseName, lessonDate, ticket_type);

        const receiptData = {
          customerName,
          customerEmail: user.email,
          date: new Date().toLocaleDateString('sv-SE'),
          items: [{
            description: `Drop-in: ${courseName} - ${lessonTitle} (${ticket_type === 'couple' ? 'Par' : 'Singel'})`,
            quantity: 1,
            unitPrice: amountCents,
            currency,
          }],
          totalAmount: amountCents,
          currency,
          orderId: session.id,
          companyInfo: { name: 'DanceVida', address: 'Gamlestadsv. 14, 415 02 Goteborg', phone: '073-702 11 34' },
        };

        const emailResponse = await fetch(`${supabaseUrl}/functions/v1/send-email`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            to: user.email,
            subject: `Drop-in bokning bekraftad / Drop-in booking confirmed`,
            html: emailHtml,
            receipt: receiptData,
          }),
        });

        if (emailResponse.ok) {
          console.log("Lesson confirmation email sent to:", user.email);
        } else {
          const emailError = await emailResponse.text();
          console.error("Email send failed:", emailError);
        }
      } catch (emailError) {
        console.error("Failed to send lesson email:", emailError);
      }
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
