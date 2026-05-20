## Audit: why Konpa shows 0/1 attendees when 8+ paid

I traced every booking for `Konpa Bootcamp & Party with Amar, Sofie & DJ NIPZ!` (`0f3ba82c-…`) in the database. There is exactly **1** row in `event_bookings` (swish:4305). No others exist, anywhere — not pending, not cancelled, not in `swish_payments` (that table is currently empty across the whole project), not in `payments`. So the attendee dialog is showing the correct DB state. The data is missing at the source.

### Root cause

The Swish flow is **client-side, fire-and-forget, with no server reconciliation**:

```text
User → WP Swish page → pays in Swish app
         ↓
Returns to /payment/confirmation?status=success&order_id=…
         ↓
Browser calls verify-swish-payment → inserts event_booking
```

Every step after "pays in Swish app" depends on the user's browser making it back to our Confirmation page and the `verify-swish-payment` invoke succeeding. If any of these happen, the booking is silently lost:

1. User pays in Swish, then closes the app / loses signal / opens a different tab — browser never returns.
2. WP redirect link expires or is misconfigured.
3. Confirmation page hits the 8-second hard timeout (`fallback` in `Confirmation.tsx` L36) before the edge function finishes — verify call is cancelled.
4. `verify-swish-payment` fails (e.g. transient `send-email` failure aborts the whole function via `throw` after a successful insert — but a throw before insert leaves no booking).
5. WP order ID isn't passed back (legacy / older WP code), so multiple legit purchases get blocked by the 10-min de-dupe window.

There is **no webhook from Swish / WP into our backend**, and `swish_payments` is never written to — so we have zero independent record of money received. We only know about a booking if the browser tells us.

This is the systemic bug. Until it's fixed, this will keep happening on every event.

## Plan: eliminate the class of bug

### 1. Server-to-server Swish reconciliation (the real fix)

Add a new edge function `swish-reconcile` (public, secured by a shared secret in `SWISH_RECONCILE_TOKEN`) that:

- Accepts a list of `{ wp_order_id, item_type, item_id, user_id, customer_email, customer_name, amount_cents, quantity, attendee_names, paid_at }` from WordPress.
- For each entry, writes a row to `swish_payments` (status=`paid`, payment_type, metadata with item_id/user/order/attendees) — this is the **source of truth** that money arrived, independent of any browser.
- Then calls the existing `verify-swish-payment` logic (refactored into a shared helper) to create the booking, using the same idempotency keys.

WP side change (documented for the user, not in this codebase): on Swish payment_callback (server-side), POST to `swish-reconcile` instead of relying on the browser redirect. The browser flow keeps working as a fast path; the webhook is the safety net.

### 2. Make verify-swish-payment self-healing on the client side

In `supabase/functions/verify-swish-payment/index.ts`:

- Always insert into `swish_payments` (status=`paid`) **before** doing the event/course branch, so even partial failures leave a trace. Today this table is empty — we have no idea who paid.
- Wrap the `send-email` call so a mail failure can't ever throw past the booking insert. (Already in a try/catch, but verify.)
- Replace the strict idempotency on `event_id + member_id + payment_reference` so that when an old WP integration omits the order id, we still get one booking per Swish payment (use `swish_payments.id` as a synthetic order ref).

### 3. Confirmation page resilience

In `src/pages/Confirmation.tsx`:

- Remove the 8 s hard cap on `setIsVerifying` (it cancels the spinner but not the request; users see "success" while the backend is mid-insert). Replace with awaiting the invoke, then a 30 s safety timeout that shows an explicit "still processing — check email" state instead of a green check.
- On `verify-swish-payment` error, retry once (1 s back-off) before surfacing the error.

### 4. Admin attendee dialog: surface unbooked-but-paid Swish payments

In `src/components/EventAttendeesDialog.tsx`:

- Add a section "Betalt men ej bokat" listing `swish_payments` rows whose metadata `item_id == event.id` with no matching `event_bookings.payment_reference = swish:<wp_order_id>`.
- Each row gets a "Skapa bokning manuellt" button that calls a new admin RPC `admin_reconcile_swish_event_booking(payment_id uuid)` which creates the booking using the existing `admin_create_free_event_booking` mechanics but marks `payment_status='paid'` and copies the original `amount_cents`/order ref.

This way, even if a future regression silently drops a booking, the admin sees it in red and can fix it in one click — and we'll know it happened.

### 5. One-time backfill for the current Konpa situation

I'll ask the user (in chat after the plan is approved) for:
- The list of names/emails/Swish refs that paid for Konpa but don't appear in the dialog.
- Whichever they remember; even Swish ref numbers (`4xxx`) are enough.

Then I'll insert those `event_bookings` rows directly (via migration), assign QR codes, bump `events.sold_count`, and re-send confirmation emails so the buyers get their QR.

### 6. Monitoring

- Add a daily edge function `swish-bookings-drift` that compares `swish_payments WHERE payment_type='event'` to `event_bookings.payment_reference` and emails `info@tropicalstudios.se` if drift > 0.

## Out of scope

- Migrating WordPress to call the new reconcile endpoint — needs a snippet on the WP side; I'll provide the curl contract and a sample PHP hook for the user/their WP dev to drop in.
- Refunds / partial refunds flow.
- Touching the Stripe verify path (already has a webhook).

## Files

- New: `supabase/functions/swish-reconcile/index.ts`
- New: `supabase/functions/swish-bookings-drift/index.ts`
- Edit: `supabase/functions/verify-swish-payment/index.ts` (always log to `swish_payments`, harden error paths)
- Edit: `src/pages/Confirmation.tsx` (no premature success, retry once)
- Edit: `src/components/EventAttendeesDialog.tsx` (unbooked-paid section + reconcile button)
- Migration: `admin_reconcile_swish_event_booking` RPC + new secret `SWISH_RECONCILE_TOKEN`
- Migration (after user provides Konpa data): one-off `INSERT` backfill for the missing Konpa bookings
