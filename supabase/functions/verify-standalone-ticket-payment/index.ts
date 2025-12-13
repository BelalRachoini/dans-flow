import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function buildTicketEmail(customerName: string, ticketCount: number, expiryDate: string): string {
  return `<!doctype html>
<html lang="sv">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width,initial-scale=1" />
    <meta name="x-apple-disable-message-reformatting" />
    <title>DanceVida – Biljettköp</title>
  </head>

  <body style="margin:0;padding:0;background:#f5f7fb;">
    <div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent;">
      Tack för ditt biljettköp hos DanceVida – se dina biljetter i portalen under Tickets.
    </div>

    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f5f7fb;">
      <tr>
        <td align="center" style="padding:24px 12px;">
          <table role="presentation" width="600" cellspacing="0" cellpadding="0"
            style="width:600px;max-width:600px;background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 8px 24px rgba(16,24,40,0.08);">

            <!-- Header -->
            <tr>
              <td style="padding:22px 24px;background:linear-gradient(135deg,#111827,#a855f7);">
                <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
                  <tr>
                    <td align="left" style="vertical-align:middle;">
                      <div style="font-family:Arial,Helvetica,sans-serif;font-size:18px;line-height:22px;color:#ffffff;font-weight:700;">
                        DanceVida
                      </div>
                      <div style="font-family:Arial,Helvetica,sans-serif;font-size:13px;line-height:18px;color:rgba(255,255,255,0.85);margin-top:4px;">
                        Bekräftelse på biljettköp
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
                  Tack! Dina biljetter är klara ✅
                </div>

                <div style="font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:22px;color:#374151;margin-top:10px;">
                  Här är en snabb överblick av ditt köp:
                </div>

                <table role="presentation" width="100%" cellspacing="0" cellpadding="0"
                  style="margin-top:16px;background:#f8fafc;border:1px solid #e5e7eb;border-radius:14px;">
                  <tr>
                    <td style="padding:16px;">
                      <div style="font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:18px;color:#111827;font-weight:700;">
                        Biljettinfo
                      </div>
                      <div style="font-family:Arial,Helvetica,sans-serif;font-size:13px;line-height:20px;color:#374151;margin-top:8px;">
                        <strong>Antal biljetter:</strong> ${ticketCount}<br/>
                        <strong>Giltig till:</strong> ${expiryDate}
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
                        <a href="https://cms.dancevida.se/" style="color:#7c3aed;text-decoration:underline;">https://cms.dancevida.se/</a>
                        och gå till <strong>Tickets</strong> för att se dina biljetter.
                      </div>
                    </td>
                  </tr>
                </table>

                <table role="presentation" cellspacing="0" cellpadding="0" style="margin-top:16px;">
                  <tr>
                    <td align="left">
                      <a href="https://cms.dancevida.se/"
                        style="display:inline-block;font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:18px;color:#ffffff;text-decoration:none;background:#7c3aed;padding:12px 16px;border-radius:12px;font-weight:700;">
                        Logga in & öppna Tickets
                      </a>
                    </td>
                  </tr>
                </table>

                <hr style="border:none;border-top:1px solid #e5e7eb;margin:22px 0 16px 0;" />

                <!-- English -->
                <div style="font-family:Arial,Helvetica,sans-serif;font-size:18px;line-height:24px;color:#111827;font-weight:800;">
                  Thank you! Your tickets are ready ✅
                </div>

                <div style="font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:22px;color:#374151;margin-top:10px;">
                  Here's a quick summary of your purchase:
                </div>

                <table role="presentation" width="100%" cellspacing="0" cellpadding="0"
                  style="margin-top:16px;background:#f8fafc;border:1px solid #e5e7eb;border-radius:14px;">
                  <tr>
                    <td style="padding:16px;">
                      <div style="font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:18px;color:#111827;font-weight:700;">
                        Ticket details
                      </div>
                      <div style="font-family:Arial,Helvetica,sans-serif;font-size:13px;line-height:20px;color:#374151;margin-top:8px;">
                        <strong>Number of tickets:</strong> ${ticketCount}<br/>
                        <strong>Valid until:</strong> ${expiryDate}
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
                        <a href="https://cms.dancevida.se/" style="color:#7c3aed;text-decoration:underline;">https://cms.dancevida.se/</a>
                        and go to <strong>Tickets</strong> to view your tickets.
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

    // Get user info for email
    const { data: userData } = await supabaseClient.auth.admin.getUserById(userId);
    const { data: profile } = await supabaseClient
      .from("profiles")
      .select("full_name")
      .eq("id", userId)
      .single();

    const customerName = profile?.full_name || userData?.user?.email?.split("@")[0] || "Dansare";
    const expiryDateFormatted = expiresAt.toLocaleDateString("sv-SE");

    // Send confirmation email
    if (userData?.user?.email) {
      try {
        const emailHtml = buildTicketEmail(customerName, ticketCount, expiryDateFormatted);
        const emailResponse = await fetch(`${Deno.env.get("SUPABASE_URL")}/functions/v1/send-email`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            to: userData.user.email,
            subject: `Biljettköp bekräftat / Ticket purchase confirmed`,
            html: emailHtml
          })
        });
        
        if (emailResponse.ok) {
          console.log("Ticket confirmation email sent to:", userData.user.email);
        } else {
          const emailError = await emailResponse.text();
          console.error("Email send failed:", emailError);
        }
      } catch (emailError) {
        console.error("Failed to send ticket email:", emailError);
        // Don't fail the whole request if email fails
      }
    }

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
