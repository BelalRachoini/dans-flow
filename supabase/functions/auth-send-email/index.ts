import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { SMTPClient } from "https://deno.land/x/denomailer@1.6.0/mod.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function buildSignupEmail(email: string, confirmationUrl: string): string {
  return `<!doctype html>
<html lang="sv">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width,initial-scale=1" />
    <meta name="x-apple-disable-message-reformatting" />
    <title>DanceVida – Välkommen</title>
  </head>

  <body style="margin:0;padding:0;background:#f5f7fb;">
    <div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent;">
      Välkommen till DanceVida! Bekräfta din e-postadress för att komma igång.
    </div>

    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f5f7fb;">
      <tr>
        <td align="center" style="padding:24px 12px;">
          <table role="presentation" width="600" cellspacing="0" cellpadding="0"
            style="width:600px;max-width:600px;background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 8px 24px rgba(16,24,40,0.08);">

            <!-- Header -->
            <tr>
              <td style="padding:22px 24px;background:linear-gradient(135deg,#111827,#c59333);">
                <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
                  <tr>
                    <td align="left" style="vertical-align:middle;">
                      <div style="font-family:Arial,Helvetica,sans-serif;font-size:18px;line-height:22px;color:#ffffff;font-weight:700;">
                        DanceVida
                      </div>
                      <div style="font-family:Arial,Helvetica,sans-serif;font-size:13px;line-height:18px;color:rgba(255,255,255,0.85);margin-top:4px;">
                        Bekräfta din e-postadress
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
                  Välkommen till DanceVida! 💃🕺
                </div>

                <div style="font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:22px;color:#374151;margin-top:10px;">
                  Tack för att du registrerade dig! Klicka på knappen nedan för att bekräfta din e-postadress och aktivera ditt konto.
                </div>

                <table role="presentation" cellspacing="0" cellpadding="0" style="margin-top:20px;">
                  <tr>
                    <td align="left">
                      <a href="${confirmationUrl}"
                        style="display:inline-block;font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:18px;color:#ffffff;text-decoration:none;background:#c59333;padding:14px 24px;border-radius:12px;font-weight:700;">
                        Bekräfta e-postadress
                      </a>
                    </td>
                  </tr>
                </table>

                <div style="font-family:Arial,Helvetica,sans-serif;font-size:13px;line-height:20px;color:#6b7280;margin-top:16px;">
                  Om knappen inte fungerar, kopiera och klistra in denna länk i din webbläsare:<br/>
                  <a href="${confirmationUrl}" style="color:#c59333;word-break:break-all;">${confirmationUrl}</a>
                </div>

                <hr style="border:none;border-top:1px solid #e5e7eb;margin:22px 0 16px 0;" />

                <!-- English -->
                <div style="font-family:Arial,Helvetica,sans-serif;font-size:18px;line-height:24px;color:#111827;font-weight:800;">
                  Welcome to DanceVida! 💃🕺
                </div>

                <div style="font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:22px;color:#374151;margin-top:10px;">
                  Thank you for signing up! Click the button below to confirm your email address and activate your account.
                </div>

                <table role="presentation" cellspacing="0" cellpadding="0" style="margin-top:20px;">
                  <tr>
                    <td align="left">
                      <a href="${confirmationUrl}"
                        style="display:inline-block;font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:18px;color:#ffffff;text-decoration:none;background:#111827;padding:14px 24px;border-radius:12px;font-weight:700;">
                        Confirm Email Address
                      </a>
                    </td>
                  </tr>
                </table>

                <div style="font-family:Arial,Helvetica,sans-serif;font-size:13px;line-height:20px;color:#6b7280;margin-top:16px;">
                  If the button doesn't work, copy and paste this link into your browser:<br/>
                  <a href="${confirmationUrl}" style="color:#c59333;word-break:break-all;">${confirmationUrl}</a>
                </div>

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

function buildRecoveryEmail(email: string, recoveryUrl: string): string {
  return `<!doctype html>
<html lang="sv">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width,initial-scale=1" />
    <meta name="x-apple-disable-message-reformatting" />
    <title>DanceVida – Återställ lösenord</title>
  </head>

  <body style="margin:0;padding:0;background:#f5f7fb;">
    <div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent;">
      Återställ ditt lösenord för DanceVida.
    </div>

    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f5f7fb;">
      <tr>
        <td align="center" style="padding:24px 12px;">
          <table role="presentation" width="600" cellspacing="0" cellpadding="0"
            style="width:600px;max-width:600px;background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 8px 24px rgba(16,24,40,0.08);">

            <!-- Header -->
            <tr>
              <td style="padding:22px 24px;background:linear-gradient(135deg,#111827,#ef4444);">
                <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
                  <tr>
                    <td align="left" style="vertical-align:middle;">
                      <div style="font-family:Arial,Helvetica,sans-serif;font-size:18px;line-height:22px;color:#ffffff;font-weight:700;">
                        DanceVida
                      </div>
                      <div style="font-family:Arial,Helvetica,sans-serif;font-size:13px;line-height:18px;color:rgba(255,255,255,0.85);margin-top:4px;">
                        Återställ lösenord
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
                  Återställ ditt lösenord 🔐
                </div>

                <div style="font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:22px;color:#374151;margin-top:10px;">
                  Vi har tagit emot en begäran om att återställa ditt lösenord. Klicka på knappen nedan för att skapa ett nytt lösenord.
                </div>

                <table role="presentation" cellspacing="0" cellpadding="0" style="margin-top:20px;">
                  <tr>
                    <td align="left">
                      <a href="${recoveryUrl}"
                        style="display:inline-block;font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:18px;color:#ffffff;text-decoration:none;background:#ef4444;padding:14px 24px;border-radius:12px;font-weight:700;">
                        Återställ lösenord
                      </a>
                    </td>
                  </tr>
                </table>

                <div style="font-family:Arial,Helvetica,sans-serif;font-size:13px;line-height:20px;color:#6b7280;margin-top:16px;">
                  Om du inte begärde detta, kan du ignorera detta mejl. Länken är giltig i 24 timmar.
                </div>

                <hr style="border:none;border-top:1px solid #e5e7eb;margin:22px 0 16px 0;" />

                <!-- English -->
                <div style="font-family:Arial,Helvetica,sans-serif;font-size:18px;line-height:24px;color:#111827;font-weight:800;">
                  Reset your password 🔐
                </div>

                <div style="font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:22px;color:#374151;margin-top:10px;">
                  We received a request to reset your password. Click the button below to create a new password.
                </div>

                <table role="presentation" cellspacing="0" cellpadding="0" style="margin-top:20px;">
                  <tr>
                    <td align="left">
                      <a href="${recoveryUrl}"
                        style="display:inline-block;font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:18px;color:#ffffff;text-decoration:none;background:#111827;padding:14px 24px;border-radius:12px;font-weight:700;">
                        Reset Password
                      </a>
                    </td>
                  </tr>
                </table>

                <div style="font-family:Arial,Helvetica,sans-serif;font-size:13px;line-height:20px;color:#6b7280;margin-top:16px;">
                  If you didn't request this, you can safely ignore this email. The link is valid for 24 hours.
                </div>

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

function buildMagicLinkEmail(email: string, magicLinkUrl: string): string {
  return `<!doctype html>
<html lang="sv">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width,initial-scale=1" />
    <meta name="x-apple-disable-message-reformatting" />
    <title>DanceVida – Logga in</title>
  </head>

  <body style="margin:0;padding:0;background:#f5f7fb;">
    <div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent;">
      Logga in på DanceVida med denna länk.
    </div>

    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f5f7fb;">
      <tr>
        <td align="center" style="padding:24px 12px;">
          <table role="presentation" width="600" cellspacing="0" cellpadding="0"
            style="width:600px;max-width:600px;background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 8px 24px rgba(16,24,40,0.08);">

            <!-- Header -->
            <tr>
              <td style="padding:22px 24px;background:linear-gradient(135deg,#111827,#c59333);">
                <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
                  <tr>
                    <td align="left" style="vertical-align:middle;">
                      <div style="font-family:Arial,Helvetica,sans-serif;font-size:18px;line-height:22px;color:#ffffff;font-weight:700;">
                        DanceVida
                      </div>
                      <div style="font-family:Arial,Helvetica,sans-serif;font-size:13px;line-height:18px;color:rgba(255,255,255,0.85);margin-top:4px;">
                        Magisk inloggningslänk
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
                  Logga in på DanceVida ✨
                </div>

                <div style="font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:22px;color:#374151;margin-top:10px;">
                  Klicka på knappen nedan för att logga in på ditt konto. Länken är giltig i 1 timme.
                </div>

                <table role="presentation" cellspacing="0" cellpadding="0" style="margin-top:20px;">
                  <tr>
                    <td align="left">
                      <a href="${magicLinkUrl}"
                        style="display:inline-block;font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:18px;color:#ffffff;text-decoration:none;background:#c59333;padding:14px 24px;border-radius:12px;font-weight:700;">
                        Logga in
                      </a>
                    </td>
                  </tr>
                </table>

                <hr style="border:none;border-top:1px solid #e5e7eb;margin:22px 0 16px 0;" />

                <!-- English -->
                <div style="font-family:Arial,Helvetica,sans-serif;font-size:18px;line-height:24px;color:#111827;font-weight:800;">
                  Log in to DanceVida ✨
                </div>

                <div style="font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:22px;color:#374151;margin-top:10px;">
                  Click the button below to log in to your account. The link is valid for 1 hour.
                </div>

                <table role="presentation" cellspacing="0" cellpadding="0" style="margin-top:20px;">
                  <tr>
                    <td align="left">
                      <a href="${magicLinkUrl}"
                        style="display:inline-block;font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:18px;color:#ffffff;text-decoration:none;background:#111827;padding:14px 24px;border-radius:12px;font-weight:700;">
                        Log In
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

  try {
    const payload = await req.json();
    
    console.log("[auth-send-email] Received auth email request:", JSON.stringify({
      email_type: payload.email_data?.email_action_type,
      user_email: payload.user?.email,
    }));

    const user = payload.user;
    const emailData = payload.email_data;
    
    if (!user?.email || !emailData) {
      throw new Error("Missing user email or email data");
    }

    const email = user.email;
    const emailType = emailData.email_action_type;
    const tokenHash = emailData.token_hash;
    const redirectTo = emailData.redirect_to || "https://cms.dancevida.se";
    
    // Build the confirmation/action URL
    let actionUrl = "";
    let subject = "";
    let htmlContent = "";

    switch (emailType) {
      case "signup":
      case "email_change":
        actionUrl = `${redirectTo}?token_hash=${tokenHash}&type=${emailType}`;
        subject = "Bekräfta din e-post / Confirm your email - DanceVida";
        htmlContent = buildSignupEmail(email, actionUrl);
        break;
      case "recovery":
        actionUrl = `${redirectTo}?token_hash=${tokenHash}&type=recovery`;
        subject = "Återställ lösenord / Reset password - DanceVida";
        htmlContent = buildRecoveryEmail(email, actionUrl);
        break;
      case "magiclink":
        actionUrl = `${redirectTo}?token_hash=${tokenHash}&type=magiclink`;
        subject = "Logga in / Log in - DanceVida";
        htmlContent = buildMagicLinkEmail(email, actionUrl);
        break;
      case "invite":
        actionUrl = `${redirectTo}?token_hash=${tokenHash}&type=invite`;
        subject = "Du är inbjuden / You're invited - DanceVida";
        htmlContent = buildSignupEmail(email, actionUrl);
        break;
      default:
        console.log(`[auth-send-email] Unknown email type: ${emailType}, using default signup template`);
        actionUrl = `${redirectTo}?token_hash=${tokenHash}&type=${emailType}`;
        subject = "DanceVida";
        htmlContent = buildSignupEmail(email, actionUrl);
    }

    console.log(`[auth-send-email] Sending ${emailType} email to: ${email}`);

    const client = new SMTPClient({
      connection: {
        hostname: Deno.env.get("SMTP_HOST") || "send.one.com",
        port: parseInt(Deno.env.get("SMTP_PORT") || "465"),
        tls: true,
        auth: {
          username: Deno.env.get("SMTP_USER") || "",
          password: Deno.env.get("SMTP_PASSWORD") || "",
        },
      },
    });

    const fromName = Deno.env.get("SMTP_FROM_NAME") || "Dance Vida Tickets";
    const fromEmail = Deno.env.get("SMTP_FROM_EMAIL") || "tickets@dancevida.se";

    await client.send({
      from: `${fromName} <${fromEmail}>`,
      to: email,
      subject: subject,
      html: htmlContent,
    });
    
    await client.close();
    
    console.log(`[auth-send-email] Email sent successfully to: ${email}`);

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error: unknown) {
    console.error("[auth-send-email] Error:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return new Response(JSON.stringify({ error: errorMessage }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
