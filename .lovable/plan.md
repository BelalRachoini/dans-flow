## Two small changes

### 1. `supabase/functions/verify-swish-payment/index.ts` (lines 162‑171)

Tighten the no‑order‑ref fallback so legacy `payment_reference IS NULL` bookings stop blocking new purchases. Only treat NULL-reference bookings as a duplicate when they were created in the last 10 minutes (double‑tap protection).

```ts
} else {
  // No order ID — only block if there's a very recent booking (within 10 min)
  // Prevents double-tap duplicates but allows legitimate new purchases later.
  const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000).toISOString();
  const { data: recentExisting } = await supabaseClient
    .from("event_bookings")
    .select("id, qr_payload, event_date_id, attendee_names, created_at")
    .eq("member_id", user_id)
    .eq("event_id", item_id)
    .is("payment_reference", null)
    .gte("created_at", tenMinutesAgo)
    .order("created_at", { ascending: true });
  existing = recentExisting ?? [];
}
```

Then deploy `verify-swish-payment`.

### 2. `src/pages/Biljetter.tsx` (past-events QR block, ~lines 1957‑1963)

In the "Tidigare evenemang" map, replace the greyed QR with a ✅ Incheckad pill when `ticket.status === 'checked_in'`. The active section is untouched.

```tsx
{ticket.status === 'checked_in' ? (
  <div className="flex items-center gap-1 text-green-600 text-xs font-medium">
    <Check className="h-4 w-4" />
    Incheckad
  </div>
) : (
  <div className="bg-white p-1 rounded border opacity-40">
    {qrCanvasRef.current[ticket.qr_payload] ? (
      <img src={qrCanvasRef.current[ticket.qr_payload]} alt="QR" className="w-10 h-10" />
    ) : (
      <div className="w-10 h-10 bg-muted rounded" />
    )}
  </div>
)}
```

`Check` is already imported in this file (used elsewhere).

### Out of scope

- No DB migration, no other edge functions, no changes to the active event tickets section.
