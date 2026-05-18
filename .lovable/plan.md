## Problem

When buying an event ticket (or one-time ticket package) a second time via Stripe, the user sees the **old** QR codes instead of new ones, and 2-person / 4-person purchases don't add extra QR codes.

Root cause is in `supabase/functions/verify-event-payment/index.ts` (lines 302–318):

```ts
const { data: existingBookings } = await supabaseClient
  .from("event_bookings")
  .select("id")
  .eq("member_id", user.id)
  .eq("event_id", event_id);

if (existingBookings && existingBookings.length > 0) {
  // returns OLD booking ids, never creates new ones
}
```

The idempotency check is scoped only to `member_id + event_id`, so **any** previous purchase by this user for this event blocks every future purchase. This is the same class of bug we already fixed in `verify-swish-payment`, but on the Stripe path.

A secondary issue: `verify-standalone-ticket-payment` has **no** idempotency at all — if PaymentSuccess retries the verify call, the user gets duplicate ticket packages.

## Fix

### 1. `supabase/functions/verify-event-payment/index.ts`

Scope idempotency to this Stripe session, not "any booking for this event":

- Replace the existing-bookings block with a lookup on `payment_reference = session.id` (a column already on `event_bookings`).
- If matches found → return them (true idempotent retry of the same Stripe session).
- Otherwise → proceed to create new bookings for this purchase.
- When inserting each new booking, set `payment_reference: session.id` so a retry of the same session is detected next time.

This way:

- Re-purchasing the same event = new Stripe session = fresh bookings + fresh `qr_payload`s.
- Buying 2 or 4 tickets = the existing loop (`ticket_count × event_dates`) creates one row per attendee per date, each with its own `crypto.randomUUID()` QR.
- Refreshing PaymentSuccess for the same session = returns the same bookings, no duplicates.

### 2. `supabase/functions/verify-standalone-ticket-payment/index.ts`

Add session-scoped idempotency on `tickets.order_id`:

- Before inserting, query `tickets` where `order_id = 'standalone:' || session.id`.
- If found, return the existing ticket (no duplicate insert, no duplicate payment row).
- Otherwise create as today.

### 3. Deploy

Deploy both edge functions after the edits.

## Out of scope

- No DB migrations (columns already exist).
- No frontend changes — `Biljetter.tsx` already renders one QR per `event_bookings` row / per `tickets` row.
- No change to `verify-swish-payment` (already fixed earlier).

## Verification

1. As a logged-in member who already has bookings for event X, buy event X again via Stripe → new rows appear in `event_bookings` with new `qr_payload`s, "Mina biljetter" shows the new QR codes alongside any still-active old ones.
2. Buy 2-person ticket for event X → 2 new bookings (×N dates) with 2 different QR codes.
3. Reload `/payment-success?session_id=...` twice → still only the bookings from that one purchase (no duplicates).
4. Buy a standalone ticket package twice → two separate ticket packages, each with its own QR. Refresh success page on the second → no third package created.

## Questions

Before I implement, two quick checks:

1. **Same-day double click protection for events on Stripe**: do you want me to keep the "if the user reloads PaymentSuccess we return the same bookings" behavior (idempotent on `session.id` only), or do you also want a stricter "no two Stripe purchases for the same event within 10 minutes" guard (like Swish has)? My recommendation is **session.id only** — Stripe Checkout already prevents accidental double-charges via its own session lifecycle, and a 10-min window would re-introduce the exact symptom you're reporting. lets do it based on your reccomendation
2. **Old "ghost" bookings**: do you want me to also clean up any pre-existing `event_bookings` rows that have `payment_reference IS NULL` and were never checked in, so they stop showing as active QR codes? Or leave existing data alone and only fix the flow going forward? yes