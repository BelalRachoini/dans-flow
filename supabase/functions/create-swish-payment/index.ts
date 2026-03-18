import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const SWISH_API_URL = "https://cpc.getswish.net/swish-cpcapi/api/v2/paymentrequests";
const PAYEE_ALIAS = "1230344705";

/**
 * Strictly canonicalize a single PEM block:
 * 1. Extract the label (CERTIFICATE, PRIVATE KEY, etc.)
 * 2. Strip everything except base64 characters
 * 3. Re-wrap at 64 chars per line with proper headers
 */
function canonicalizeSinglePem(block: string): string {
  // Extract the label from BEGIN line
  const labelMatch = block.match(/-----BEGIN ([A-Z ]+)-----/);
  if (!labelMatch) {
    throw new Error("No PEM BEGIN marker found in block");
  }
  const label = labelMatch[1];

  // Remove headers/footers
  let body = block
    .replace(/-----BEGIN [A-Z ]+-----/g, "")
    .replace(/-----END [A-Z ]+-----/g, "");

  // Strip ALL whitespace (spaces, newlines, tabs, carriage returns)
  body = body.replace(/\s+/g, "");

  // Re-wrap at 64 characters per line
  const lines: string[] = [];
  for (let i = 0; i < body.length; i += 64) {
    lines.push(body.substring(i, i + 64));
  }

  return `-----BEGIN ${label}-----\n${lines.join("\n")}\n-----END ${label}-----`;
}

/**
 * Extract and canonicalize all PEM blocks from a raw string.
 * Handles bundles (multiple certs in one string).
 */
function extractAndCanonicalizeBlocks(raw: string): string[] {
  const regex = /-----BEGIN [A-Z ]+-----[\s\S]*?-----END [A-Z ]+-----/g;
  const matches = raw.match(regex);

  if (!matches || matches.length === 0) {
    // Maybe raw base64 without headers — wrap as CERTIFICATE
    const clean = raw.trim().replace(/\s+/g, "");
    const lines: string[] = [];
    for (let i = 0; i < clean.length; i += 64) {
      lines.push(clean.substring(i, i + 64));
    }
    return [`-----BEGIN CERTIFICATE-----\n${lines.join("\n")}\n-----END CERTIFICATE-----`];
  }

  return matches.map((block) => canonicalizeSinglePem(block));
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

    // Strictly canonicalize all PEM material
    const certBlocks = extractAndCanonicalizeBlocks(certRaw);
    const keyBlocks = extractAndCanonicalizeBlocks(keyRaw);
    const caBlocks = extractAndCanonicalizeBlocks(caRaw);

    // certChain = all cert blocks joined; privateKey = first key block
    const certPem = certBlocks.join("\n");
    const keyPem = keyBlocks[0];

    console.log("[create-swish-payment] Canonicalized — cert blocks:", certBlocks.length,
      "key blocks:", keyBlocks.length, "CA blocks:", caBlocks.length,
      "cert length:", certPem.length, "key length:", keyPem.length,
      "CA lengths:", caBlocks.map(b => b.length));

    // Create HTTP client with mTLS
    console.log("[create-swish-payment] Creating HTTP client...");
    const httpClient = Deno.createHttpClient({
      certChain: certPem,
      privateKey: keyPem,
      caCerts: caBlocks,
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
