// Daily drift monitor: compares paid swish_payments (type=event) to event_bookings.
// If there are payments without matching bookings, sends an alert email.
//
// Trigger via cron (pg_cron) or external scheduler. No body required.

import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const ALERT_TO = "info@tropicalstudios.se";

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const supa = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();

  const { data: payments, error } = await supa
    .from("swish_payments")
    .select("id, member_id, amount_cents, metadata, payment_request_id, created_at")
    .eq("payment_type", "event")
    .gte("created_at", since)
    .in("status", ["paid", "succeeded", "ok"]);

  if (error) return json({ error: error.message }, 500);

  const drift: any[] = [];
  for (const p of payments ?? []) {
    const eventId = (p.metadata as any)?.item_id;
    if (!eventId) continue;
    const wpOrder = (p.metadata as any)?.wp_order_id ?? p.payment_request_id;
    const ref = `swish:${wpOrder}`;
    const { count } = await supa
      .from("event_bookings")
      .select("id", { count: "exact", head: true })
      .eq("event_id", eventId)
      .eq("member_id", p.member_id)
      .eq("payment_reference", ref);
    if ((count ?? 0) === 0) {
      drift.push({
        swish_payment_id: p.id,
        member_id: p.member_id,
        event_id: eventId,
        amount_cents: p.amount_cents,
        wp_order_id: wpOrder,
        created_at: p.created_at,
      });
    }
  }

  if (drift.length > 0) {
    const rows = drift
      .map(
        (d) =>
          `<tr><td style="padding:6px 10px;border:1px solid #e5e7eb;">${d.created_at}</td><td style="padding:6px 10px;border:1px solid #e5e7eb;">${d.event_id}</td><td style="padding:6px 10px;border:1px solid #e5e7eb;">${d.member_id}</td><td style="padding:6px 10px;border:1px solid #e5e7eb;text-align:right;">${(d.amount_cents / 100).toFixed(0)} kr</td><td style="padding:6px 10px;border:1px solid #e5e7eb;">${d.wp_order_id}</td></tr>`,
      )
      .join("");
    const html = `<div style="font-family:Arial,sans-serif"><h2>Swish drift alert: ${drift.length} paid event purchase(s) without a booking</h2><p>Open each event in the admin "View attendees" dialog and click <b>Reconcile</b> to create the missing booking(s).</p><table style="border-collapse:collapse;font-size:13px;"><thead><tr><th style="padding:6px 10px;border:1px solid #e5e7eb;">Paid at</th><th style="padding:6px 10px;border:1px solid #e5e7eb;">Event</th><th style="padding:6px 10px;border:1px solid #e5e7eb;">Member</th><th style="padding:6px 10px;border:1px solid #e5e7eb;">Amount</th><th style="padding:6px 10px;border:1px solid #e5e7eb;">WP order</th></tr></thead><tbody>${rows}</tbody></table></div>`;

    await fetch(`${Deno.env.get("SUPABASE_URL")}/functions/v1/send-email`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${Deno.env.get("SUPABASE_ANON_KEY") ?? ""}`,
      },
      body: JSON.stringify({
        to: ALERT_TO,
        subject: `[Dance Vida] Swish drift: ${drift.length} betalda eventköp utan bokning`,
        html,
      }),
    });
  }

  return json({ checked: payments?.length ?? 0, drift_count: drift.length, drift });
});

function json(b: unknown, status = 200) {
  return new Response(JSON.stringify(b), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
