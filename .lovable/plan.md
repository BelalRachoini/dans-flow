

# Fix QR Scan: Show Attendee Name & Ticket Count for Swish Purchases

## The Problem
When admins scan a QR code from a Swish-purchased ticket, the scanner doesn't show:
1. **The actual attendee name** (it shows the buyer's name on every QR, even for Person 2 / Person 3)
2. **Which person of how many** (e.g. "Person 2 of 3")
3. **The ticket count** for standalone Swish ticket packages

## Root Causes

### 1. `verify-swish-payment` does not receive per-person attendee names
The PaymentMethodStep redirects to WordPress with only `customer_name` (single string). When the function creates multiple bookings for a couple/trio, every booking is stamped with the same buyer name:
```ts
attendee_names: [customer_name || `Person ${i + 1}`]   // same name for all 3 tickets
```
Compare to `verify-event-payment` (Stripe), which passes a real `attendee_names: string[]` array per person.

### 2. Scanner pulls `member_name` from the buyer's profile, never from `attendee_names`
`check_in_with_qr` returns `member_name` from `profiles.full_name` (the account holder), so even when `attendee_names[0]` is "Anna Svensson", the scanner displays the buyer "Erik Andersson" for all 3 tickets.

### 3. Success dialog shows no ticket-position info for events
For events, the dialog hides the "Klipp kvar" line and never shows "Person X of Y" or which date.

## Fix Plan

### A. Pass per-person names through the Swish flow

**`src/components/PaymentMethodStep.tsx`**
- Accept new optional prop `attendeeNames?: string[]` (one entry per ticket).
- When building the Swish redirect URL, add `attendee_names=<JSON-encoded array>` parameter.

**`src/components/EventTicketPurchaseDialog.tsx`**
- When rendering `<PaymentMethodStep>`, pass `attendeeNames={[buyerName, ...attendeeNames.slice(0, selectedOption - 1)]}` (matches what Stripe already gets).

**`src/components/StandaloneTicketPurchaseDialog.tsx`** and **`src/components/BundlePurchaseWizard.tsx`** and **`src/components/LessonBookingDialog.tsx`**
- Pass `attendeeNames={[buyerName]}` (single-person purchases — keeps the parameter consistent).

> Note: The WordPress Swish checkout page must forward this new `attendee_names` query param back to `verify-swish-payment`. Tell the WP integrator to include it in the POST body. Until WP forwards it, the function falls back to the current behavior — no breakage.

### B. Update `verify-swish-payment` to use per-person names

**`supabase/functions/verify-swish-payment/index.ts`**
- Read `attendee_names` from the POST body. Accept either a JSON array or a JSON string and parse it safely. Default to `[customer_name]` if missing.
- For events, when looping `for (let i = 0; i < ticketCount; i++)`, set:
  ```ts
  attendee_names: [attendeeNamesArr[i] || customer_name || `Person ${i + 1}`]
  ```
  so each booking carries the correct individual name.
- For standalone tickets, store `attendee_names` for reference is not needed (tickets table has no such column), but we will fix scanner display below using `total_tickets`.

### C. Surface the real attendee name + ticket position in the scanner

**`public.check_in_with_qr` (database function — new migration)**
- For `event_bookings` branch: add `attendee_name` to the JSON response, computed as `COALESCE(v_event_booking.attendee_names->>0, v_member.full_name, 'Okänd')`.
- For `tickets` branch: already returns `tickets_used` and `total_tickets` — no DB change needed.

**`src/pages/Scan.tsx`**
- Add `attendee_name?: string` to `CheckinResult` interface.
- In the **success dialog** (lines 534-567), prefer `lastResult.attendee_name` over `lastResult.member_name` when present, and add a sub-line showing the buyer underneath: `"Köpt av: {member_name}"` when attendee differs.
- For event scans, add a line showing **"Biljett 1 av 1"** using `checkins_used + 1` of `checkins_allowed` when relevant, plus the event date when available.
- For standalone ticket scans (course/klippkort branch), the existing `Klipp kvar: {total_tickets - tickets_used}` line already works — verify it renders for Swish-purchased ticket packages (it does, since they go through the same `tickets` table).
- Mirror the same updates in the in-page `<Alert>` block (lines 402-451 and 479-519).

## Files Touched
1. `supabase/functions/verify-swish-payment/index.ts` — accept and use `attendee_names[]`
2. `supabase/migrations/<new>.sql` — update `check_in_with_qr` to return `attendee_name` for events
3. `src/components/PaymentMethodStep.tsx` — add `attendeeNames` prop, append to Swish URL
4. `src/components/EventTicketPurchaseDialog.tsx` — pass per-person names
5. `src/components/StandaloneTicketPurchaseDialog.tsx` — pass `[buyerName]`
6. `src/components/BundlePurchaseWizard.tsx` — pass `[buyerName]`
7. `src/components/LessonBookingDialog.tsx` — pass `[buyerName]`
8. `src/pages/Scan.tsx` — show `attendee_name`, buyer sub-line, ticket position for events

## What stays unchanged
- Stripe flow (`verify-event-payment`, etc.) is untouched.
- Idempotency logic in `verify-swish-payment` is untouched.
- All existing QR codes and bookings keep working.

## WordPress side (heads-up, not in this PR)
The Swish checkout page at `dancevida.se/swish-checkout/` must forward the new `attendee_names` query parameter into the POST body it sends to `verify-swish-payment`. I'll provide the exact field name (`attendee_names`, JSON string) so your WP developer can add one line.

