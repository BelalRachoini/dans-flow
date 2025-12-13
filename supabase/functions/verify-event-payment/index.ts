import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function buildEventEmail(customerName: string, eventName: string, eventDate: string, ticketCount: number, attendeeNames: string): string {
  return `<!doctype html>
<html lang="sv">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width,initial-scale=1" />
    <meta name="x-apple-disable-message-reformatting" />
    <title>DanceVida – Eventköp</title>
  </head>

  <body style="margin:0;padding:0;background:#f5f7fb;">
    <div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent;">
      Bekräftelse: ${eventName} – ${eventDate}. Se biljetter i portalen under Tickets.
    </div>

    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f5f7fb;">
      <tr>
        <td align="center" style="padding:24px 12px;">
          <table role="presentation" width="600" cellspacing="0" cellpadding="0"
            style="width:600px;max-width:600px;background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 8px 24px rgba(16,24,40,0.08);">

            <!-- Header -->
            <tr>
              <td style="padding:22px 24px;background:linear-gradient(135deg,#0f172a,#22c55e);">
                <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
                  <tr>
                    <td align="left" style="vertical-align:middle;">
                      <div style="font-family:Arial,Helvetica,sans-serif;font-size:18px;line-height:22px;color:#ffffff;font-weight:700;">
                        DanceVida
                      </div>
                      <div style="font-family:Arial,Helvetica,sans-serif;font-size:13px;line-height:18px;color:rgba(255,255,255,0.85);margin-top:4px;">
                        Bekräftelse på eventköp
                      </div>
                    </td>
                    <td align="right" style="vertical-align:middle;">
                      <img src="https://cms.dancevida.se/logo.png" width="44" height="44" alt="DanceVida"
                        style="display:block;border:0;border-radius:10px;background:#ffffff1a;" />
                    </td>
                  </tr>
                </table>
              </td>
            </tr>

            <!-- Body -->
            <tr>
              <td style="padding:26px 24px 20px 24px;">
                <!-- Swedish -->
                <div style="font-family:Arial,Helvetica,sans-serif;font-size:22px;line-height:28px;color:#111827;font-weight:800;">
                  Du är bokad! 🎉
                </div>

                <div style="font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:22px;color:#374151;margin-top:10px;">
                  Tack för ditt köp. Här är din bekräftelse för eventet:
                </div>

                <table role="presentation" width="100%" cellspacing="0" cellpadding="0"
                  style="margin-top:16px;background:#f8fafc;border:1px solid #e5e7eb;border-radius:14px;">
                  <tr>
                    <td style="padding:16px;">
                      <div style="font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:18px;color:#111827;font-weight:700;">
                        Eventdetaljer
                      </div>
                      <div style="font-family:Arial,Helvetica,sans-serif;font-size:13px;line-height:20px;color:#374151;margin-top:8px;">
                        <strong>Event:</strong> ${eventName}<br/>
                        <strong>Datum & tid:</strong> ${eventDate}<br/>
                        <strong>Antal biljetter:</strong> ${ticketCount}
                      </div>
                    </td>
                  </tr>
                </table>

                <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin-top:14px;">
                  <tr>
                    <td>
                      <div style="font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:22px;color:#111827;font-weight:700;">
                        Deltagare
                      </div>
                      <div style="font-family:Arial,Helvetica,sans-serif;font-size:13px;line-height:20px;color:#374151;margin-top:6px;">
                        ${attendeeNames}
                      </div>
                    </td>
                  </tr>
                </table>

                <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin-top:14px;">
                  <tr>
                    <td>
                      <div style="font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:22px;color:#111827;font-weight:700;">
                        Din biljett & QR-kod
                      </div>
                      <div style="font-family:Arial,Helvetica,sans-serif;font-size:13px;line-height:20px;color:#374151;margin-top:6px;">
                        QR-koden finns i vår portal (inte i detta mejl). Logga in på
                        <a href="https://cms.dancevida.se/" style="color:#16a34a;text-decoration:underline;">https://cms.dancevida.se/</a>
                        och gå till <strong>Tickets</strong> för att se din biljett.
                      </div>
                    </td>
                  </tr>
                </table>

                <table role="presentation" cellspacing="0" cellpadding="0" style="margin-top:16px;">
                  <tr>
                    <td align="left">
                      <a href="https://cms.dancevida.se/"
                        style="display:inline-block;font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:18px;color:#ffffff;text-decoration:none;background:#16a34a;padding:12px 16px;border-radius:12px;font-weight:700;">
                        Logga in & öppna Tickets
                      </a>
                    </td>
                  </tr>
                </table>

                <hr style="border:none;border-top:1px solid #e5e7eb;margin:22px 0 16px 0;" />

                <!-- English -->
                <div style="font-family:Arial,Helvetica,sans-serif;font-size:18px;line-height:24px;color:#111827;font-weight:800;">
                  You're booked! 🎉
                </div>

                <div style="font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:22px;color:#374151;margin-top:10px;">
                  Thanks for your purchase. Here's your event confirmation:
                </div>

                <table role="presentation" width="100%" cellspacing="0" cellpadding="0"
                  style="margin-top:16px;background:#f8fafc;border:1px solid #e5e7eb;border-radius:14px;">
                  <tr>
                    <td style="padding:16px;">
                      <div style="font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:18px;color:#111827;font-weight:700;">
                        Event details
                      </div>
                      <div style="font-family:Arial,Helvetica,sans-serif;font-size:13px;line-height:20px;color:#374151;margin-top:8px;">
                        <strong>Event:</strong> ${eventName}<br/>
                        <strong>Date & time:</strong> ${eventDate}<br/>
                        <strong>Ticket count:</strong> ${ticketCount}
                      </div>
                    </td>
                  </tr>
                </table>

                <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin-top:14px;">
                  <tr>
                    <td>
                      <div style="font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:22px;color:#111827;font-weight:700;">
                        Attendees
                      </div>
                      <div style="font-family:Arial,Helvetica,sans-serif;font-size:13px;line-height:20px;color:#374151;margin-top:6px;">
                        ${attendeeNames}
                      </div>
                    </td>
                  </tr>
                </table>

                <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin-top:14px;">
                  <tr>
                    <td>
                      <div style="font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:22px;color:#111827;font-weight:700;">
                        Your ticket & QR code
                      </div>
                      <div style="font-family:Arial,Helvetica,sans-serif;font-size:13px;line-height:20px;color:#374151;margin-top:6px;">
                        Your QR code is available in our portal (not in this email). Log in at
                        <a href="https://cms.dancevida.se/" style="color:#16a34a;text-decoration:underline;">https://cms.dancevida.se/</a>
                        and go to <strong>Tickets</strong> to view your ticket.
                      </div>
                    </td>
                  </tr>
                </table>

                <table role="presentation" cellspacing="0" cellpadding="0" style="margin-top:16px;">
                  <tr>
                    <td align="left">
                      <a href="https://cms.dancevida.se/"
                        style="display:inline-block;font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:18px;color:#ffffff;text-decoration:none;background:#111827;padding:12px 16px;border-radius:12px;font-weight:700;">
                        Log in & open Tickets
                      </a>
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
                      <div style="font-family:Arial,Helvetica,sans-serif;font-size:12px;line-height:18px;color:#6b7280;">
                        DanceVida · Gamlestadsvägen 14, 415 02 Göteborg · 073-702 11 34
                      </div>
                      <div style="font-family:Arial,Helvetica,sans-serif;font-size:12px;line-height:18px;color:#6b7280;margin-top:6px;">
                        Frågor? Svara på detta mejl eller ring oss. / Questions? Reply to this email or call us.
                      </div>
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

    // Get event_id and multi-ticket data from metadata
    const event_id = session.metadata?.event_id;
    const ticket_count = parseInt(session.metadata?.ticket_count || "1", 10);
    const attendee_names = JSON.parse(session.metadata?.attendee_names || "[]");
    
    if (!event_id) {
      throw new Error("Event ID not found in session metadata");
    }

    console.log("Payment verified for event:", event_id, "tickets:", ticket_count);

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

    // Create booking with QR code and multi-ticket data
    const { data: booking, error: bookingError } = await supabaseClient
      .from("event_bookings")
      .insert({
        member_id: user.id,
        event_id: event_id,
        status: "confirmed",
        payment_status: "paid",
        ticket_count: ticket_count,
        checkins_allowed: ticket_count,
        checkins_used: 0,
        attendee_names: attendee_names,
      })
      .select()
      .single();

    if (bookingError) throw bookingError;

    console.log("Booking created:", booking.id, "with", ticket_count, "tickets");

    // Increment sold_count by ticket_count
    const { data: currentEvent } = await supabaseClient
      .from("events")
      .select("sold_count, title, start_at")
      .eq("id", event_id)
      .single();
    
    if (currentEvent) {
      await supabaseClient
        .from("events")
        .update({ sold_count: currentEvent.sold_count + ticket_count })
        .eq("id", event_id);
    }

    // Get user profile for email
    const { data: profile } = await supabaseClient
      .from("profiles")
      .select("full_name")
      .eq("id", user.id)
      .single();

    const customerName = profile?.full_name || user.email?.split("@")[0] || "Dansare";
    const eventDate = currentEvent?.start_at 
      ? new Date(currentEvent.start_at).toLocaleDateString("sv-SE", { 
          weekday: "long", 
          year: "numeric", 
          month: "long", 
          day: "numeric", 
          hour: "2-digit", 
          minute: "2-digit" 
        })
      : "TBD";
    const attendeeNamesStr = attendee_names.length > 0 ? attendee_names.join(", ") : customerName;

    // Send confirmation email
    try {
      const emailHtml = buildEventEmail(
        customerName, 
        currentEvent?.title || "Event", 
        eventDate, 
        ticket_count, 
        attendeeNamesStr
      );
      const emailResponse = await fetch(`${Deno.env.get("SUPABASE_URL")}/functions/v1/send-email`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          to: user.email,
          subject: `Eventbokning bekräftad: ${currentEvent?.title || "Event"} / Event booking confirmed`,
          html: emailHtml
        })
      });
      
      if (emailResponse.ok) {
        console.log("Event confirmation email sent to:", user.email);
      } else {
        const emailError = await emailResponse.text();
        console.error("Email send failed:", emailError);
      }
    } catch (emailError) {
      console.error("Failed to send event email:", emailError);
      // Don't fail the whole request if email fails
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        booking_id: booking.id,
        qr_payload: booking.qr_payload,
        ticket_count: ticket_count,
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
