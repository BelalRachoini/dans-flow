import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const SWISH_API_URL = "https://cpc.getswish.net/swish-cpcapi/api/v2/paymentrequests";
const PAYEE_ALIAS = "1230344705";

/**
 * Extract individual PEM blocks from a string that may contain one or more
 * PEM-encoded certificates/keys. Preserves headers and base64 content as-is.
 */
function extractPemBlocks(raw: string): string[] {
  const blocks: string[] = [];
  const regex = /-----BEGIN [A-Z ]+-----[\s\S]*?-----END [A-Z ]+-----/g;
  let match: RegExpExecArray | null;
  while ((match = regex.exec(raw)) !== null) {
    blocks.push(match[0].trim());
  }
  return blocks;
}

/**
 * Ensure raw secret content is valid PEM. If it already contains PEM markers,
 * return as-is. Otherwise wrap the base64 content with the given type markers.
 */
function normalizePem(raw: string, type: string): string {
  const trimmed = raw.trim();
  if (trimmed.startsWith("-----BEGIN ")) {
    return trimmed;
  }
  // Raw base64 without headers — wrap it
  const cleanBase64 = trimmed.replace(/\s+/g, "");
  const lines: string[] = [];
  for (let i = 0; i < cleanBase64.length; i += 64) {
    lines.push(cleanBase64.substring(i, i + 64));
  }
  return `-----BEGIN ${type}-----\n${lines.join("\n")}\n-----END ${type}-----`;
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

    console.log("[create-swish-payment] Payload built, payment ID:", paymentRequestId);

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

    // Normalize cert and key (single PEM blocks)
    const certPem = normalizePem(certRaw, "CERTIFICATE");
    const keyPem = normalizePem(keyRaw, "PRIVATE KEY");

    // Extract CA certs as individual PEM blocks (handles bundles)
    const caCerts = extractPemBlocks(caRaw);
    if (caCerts.length === 0) {
      // Fallback: maybe raw base64 without headers
      const fallback = normalizePem(caRaw, "CERTIFICATE");
      caCerts.push(fallback);
    }

    console.log("[create-swish-payment] Certs loaded — cert PEM:", certPem.substring(0, 40) + "...", "key PEM:", keyPem.substring(0, 40) + "...", "CA blocks:", caCerts.length);

    // Create HTTP client with mTLS
    console.log("[create-swish-payment] Creating HTTP client...");
    const httpClient = Deno.createHttpClient({
      certChain: certPem,
      privateKey: keyPem,
      caCerts: caCerts,
    });
    console.log("[create-swish-payment] HTTP client created successfully");

    // Call Swish API
    console.log("[create-swish-payment] Calling Swish API...");
    const swishResponse = await fetch(`${SWISH_API_URL}/${paymentRequestId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(swishPayload),
      // @ts-ignore Deno unstable API
      client: httpClient,
    });

    console.log("[create-swish-payment] Swish response status:", swishResponse.status);

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

    console.log("[create-swish-payment] DB record saved successfully");

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
