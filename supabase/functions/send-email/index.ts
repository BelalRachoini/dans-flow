import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { SMTPClient } from "https://deno.land/x/denomailer@1.6.0/mod.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { to, subject, html } = await req.json();
    
    if (!to || !subject || !html) {
      throw new Error("Missing required fields: to, subject, html");
    }
    
    console.log(`[send-email] Sending email to: ${to}, subject: ${subject}`);
    
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
      to: to,
      subject: subject,
      html: html,
    });
    
    await client.close();
    
    console.log(`[send-email] Email sent successfully to: ${to}`);
    
    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error: unknown) {
    console.error("[send-email] Error:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return new Response(JSON.stringify({ error: errorMessage }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
