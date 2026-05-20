// Server-to-server Swish reconciliation webhook.
// WordPress (or any backend with the shared token) POSTs a paid Swish purchase here.
// We persist a swish_payments row + create the bookings/tickets via the same logic as
// verify-swish-payment — independent of any browser redirect.
//
// Auth: header `x-swish-reconcile-token` MUST match the SWISH_RECONCILE_TOKEN secret.
// Payload: { item_type, item_id, user_id, customer_email, customer_name, amount_cents,
//            quantity?, wp_order_id, attendee_names? }  (single)
//          OR { batch: [ ...same... ] }
//
// Returns: { results: [{ wp_order_id, ok, ... }] }

import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-swish-reconcile-token",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const TOKEN = Deno.env.get("SWISH_RECONCILE_TOKEN") ?? "";

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  // Auth via shared token
  if (!TOKEN) {
    return json({ error: "Server misconfigured: SWISH_RECONCILE_TOKEN not set" }, 500);
  }
  const presented = req.headers.get("x-swish-reconcile-token");
  if (presented !== TOKEN) {
    return json({ error: "Unauthorized" }, 401);
  }

  let body: any;
  try { body = await req.json(); } catch { return json({ error: "Invalid JSON" }, 400); }

  const items: any[] = Array.isArray(body?.batch) ? body.batch : [body];

  const results: any[] = [];
  for (const entry of items) {
    try {
      const r = await fetch(`${SUPABASE_URL}/functions/v1/verify-swish-payment`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          // service role auth for internal call
          Authorization: `Bearer ${SERVICE_KEY}`,
        },
        body: JSON.stringify(entry),
      });
      const text = await r.text();
      results.push({
        wp_order_id: entry.wp_order_id ?? null,
        ok: r.ok,
        status: r.status,
        response: safeParse(text),
      });
    } catch (e) {
      results.push({
        wp_order_id: entry.wp_order_id ?? null,
        ok: false,
        error: e instanceof Error ? e.message : String(e),
      });
    }
  }

  return json({ results }, 200);
});

function json(b: unknown, status = 200) {
  return new Response(JSON.stringify(b), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function safeParse(s: string) {
  try { return JSON.parse(s); } catch { return s; }
}
