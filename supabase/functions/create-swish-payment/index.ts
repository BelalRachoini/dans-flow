import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const SWISH_API_URL = "https://cpc.getswish.net/swish-cpcapi/api/v2/paymentrequests";
const PAYEE_ALIAS = "1230344705";

function ensurePem(content: string, type: string): string {
  let trimmed = content.trim();
  
  // Strip existing PEM headers/footers to get raw base64
  const beginTag = `-----BEGIN ${type}-----`;
  const endTag = `-----END ${type}-----`;
  if (trimmed.startsWith("-----BEGIN")) {
    trimmed = trimmed
      .replace(/-----BEGIN [A-Z ]+-----/g, "")
      .replace(/-----END [A-Z ]+-----/g, "")
      .trim();
  }
  
  // Remove all whitespace from the base64 body, then re-chunk into 64-char lines
  const rawBase64 = trimmed.replace(/\s+/g, "");
  const lines: string[] = [];
  for (let i = 0; i < rawBase64.length; i += 64) {
    lines.push(rawBase64.substring(i, i + 64));
  }
  
  return `${beginTag}\n${lines.join("\n")}\n${endTag}`;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Authenticate user
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: claimsError } = await supabase.auth.getClaims(token);
    if (claimsError || !claimsData?.claims) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const userId = claimsData.claims.sub as string;

    const { payment_type, amount_sek, metadata } = await req.json();

    if (!payment_type || !amount_sek || amount_sek <= 0) {
      throw new Error("Missing payment_type or invalid amount_sek");
    }

    console.log("[create-swish-payment] User:", userId, "Type:", payment_type, "Amount:", amount_sek);

    // Generate Swish payment request ID (UUID without hyphens, uppercase)
    const paymentRequestId = crypto.randomUUID().replace(/-/g, "").toUpperCase();

    const callbackUrl = `${Deno.env.get("SUPABASE_URL")}/functions/v1/swish-callback`;

    // Build Swish request payload
    const swishPayload = {
      payeeAlias: PAYEE_ALIAS,
      amount: amount_sek.toFixed(2),
      currency: "SEK",
      callbackUrl,
      message: (metadata?.message || "DanceVida betalning").substring(0, 50),
      payeePaymentReference: paymentRequestId.substring(0, 35),
    };

    console.log("[create-swish-payment] Calling Swish API:", paymentRequestId);

    // Load mTLS certificates
    const certRaw = Deno.env.get("SWISH_CERT");
    const keyRaw = Deno.env.get("SWISH_KEY");
    const caRaw = Deno.env.get("SWISH_CA");

    if (!certRaw || !keyRaw || !caRaw) {
      const missing = [
        !certRaw && "SWISH_CERT",
        !keyRaw && "SWISH_KEY",
        !caRaw && "SWISH_CA",
      ].filter(Boolean);
      console.error("[create-swish-payment] Missing secrets:", missing);
      throw new Error(`Missing Swish certificate secrets: ${missing.join(", ")}`);
    }

    const certPem = ensurePem(certRaw, "CERTIFICATE");
    const keyPem = ensurePem(keyRaw, "PRIVATE KEY");
    const caPem = ensurePem(caRaw, "CERTIFICATE");

    // Create HTTP client with mTLS
    const httpClient = Deno.createHttpClient({
      certChain: certPem,
      privateKey: keyPem,
      caCerts: [caPem],
    });

    // Call Swish API
    const swishResponse = await fetch(`${SWISH_API_URL}/${paymentRequestId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(swishPayload),
      // @ts-ignore Deno unstable API
      client: httpClient,
    });

    if (swishResponse.status !== 201) {
      const errorBody = await swishResponse.text();
      console.error("[create-swish-payment] Swish API error:", swishResponse.status, errorBody);
      throw new Error(`Swish API error: ${swishResponse.status} - ${errorBody}`);
    }

    // Try to get payment request token from response
    let paymentRequestToken = "";
    try {
      const responseBody = await swishResponse.json();
      paymentRequestToken = responseBody?.paymentRequestToken || "";
    } catch {
      // Response might be empty for 201
    }

    console.log("[create-swish-payment] Swish payment created:", paymentRequestId, "Token:", paymentRequestToken ? "yes" : "no");

    // Save to swish_payments table using service role
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      { auth: { persistSession: false } }
    );

    const { error: insertError } = await supabaseAdmin
      .from("swish_payments")
      .insert({
        member_id: userId,
        payment_request_id: paymentRequestId,
        payment_type,
        amount_cents: Math.round(amount_sek * 100),
        currency: "SEK",
        status: "CREATED",
        metadata: metadata || {},
      });

    if (insertError) {
      console.error("[create-swish-payment] DB insert error:", insertError);
      throw new Error("Failed to save payment record");
    }

    httpClient.close();

    return new Response(
      JSON.stringify({
        paymentRequestId,
        paymentRequestToken,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      }
    );
  } catch (error) {
    console.error("[create-swish-payment] Error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 500,
      }
    );
  }
});
