# Fix Swish: Register Tickets, QR Codes, and Proper Emails

## Root Cause

The Swish flow currently does **only** a UI redirect:

1. `PaymentMethodStep.handleSwish` sends the user to `dancevida.se/swish-checkout/?...` with: `item_name`, `item_type`, `amount`, `quantity`, `customer_email`, `customer_name`, `attendee_names`, `return_url`.
2. After payment, the user lands on `cms.dancevida.se/confirmation`.
3. `Confirmation.tsx` just shows a celebratory screen. **It never calls `verify-swish-payment`.**
4. The Swish URL is **missing `item_id` and `user_id`**, so even if WordPress did call `verify-swish-payment`, the function would fail (it requires those fields for events/courses).

Result: no `event_bookings` / `tickets` row is ever inserted → no QR code → confirmation email (the simple plain-text one in `verify-swish-payment`) has no QR / no portal link to a real booking.

## Fix

### 1. Pass full purchase context into the Swish URL

In `src/components/PaymentMethodStep.tsx`, also include:
- `user_id` (from `supabase.auth.getSession()`, fetched in the existing `useEffect`)
- `item_id` (new prop on `PaymentMethodStepProps`)

Then add the same `user_id`, `item_id`, `item_type`, `quantity`, `amount`, `attendee_names`, `customer_email`, `customer_name` into `return_url` as query params, so the confirmation page receives them back from WordPress.

Update the four callers to pass `itemId`:
- `EventTicketPurchaseDialog.tsx` → `event.id`
- `LessonBookingDialog.tsx` → lesson/ticket id (use empty for ticket purchases that aren't tied to a course)
- `StandaloneTicketPurchaseDialog.tsx` → no id (standalone tickets)
- `BundlePurchaseWizard.tsx` → `courseId`

### 2. Trigger registration from the confirmation page

In `src/pages/Confirmation.tsx`, when `status === 'success'`, during the existing 2-second "verifying" phase, call `verify-swish-payment` via `supabase.functions.invoke('verify-swish-payment', { body: {...} })` with the params received from the URL:

```ts
{ item_type, item_id, user_id, customer_email, customer_name,
  amount_cents: Math.round(Number(amount) * 100),
  quantity: Number(quantity) || 1,
  wp_order_id: order_id,
  attendee_names: parsed array }
```

Behavior:
- The function is already **idempotent** (checks existing `event_bookings` / `tickets` by member+event or `order_id`), so it's safe to call from the client even if WordPress also calls it.
- Show error UI (existing amber state) if the call fails or required params are missing.
- Only flip `isVerifying` to `false` after the function returns (cap at e.g. 8 s with a fallback timer to keep UX snappy).

### 3. Send a proper confirmation email with QR/portal info

In `supabase/functions/verify-swish-payment/index.ts`, replace the plain `<p>...</p>` emails with the same rich HTML used in `verify-event-payment` (already shows attendee count, dates, and a "Visa mina biljetter" CTA pointing to `cms.dancevida.se/biljetter` where the QR is rendered).

For events: build the email using the booked `event_dates`, `ticketCount`, and `attendeeNamesArr`, mirroring the structure of `verify-event-payment`'s `buildEmailHtml`.

For course / standalone tickets: keep simple but link to `/biljetter` so the user can see the QR.

QR codes themselves continue to live in the portal (consistent with the Stripe flow today — that flow also doesn't embed QR images in the email, it links to the portal). The user's complaint that "the email doesn't have the QR" is really that **no booking was ever created**, so the portal had nothing to show.

### 4. WordPress side (heads-up, not in this PR)

The WP `swish-checkout` page should forward all the new query params (`user_id`, `item_id`, etc.) into both:
- the POST body it sends to `verify-swish-payment` (server-to-server, preferred)
- the `return_url` query string (so the confirmation page can also self-heal)

The confirmation-page call alone is already enough to register the ticket — the WP-side call becomes a redundant safety net.

## Files Changed

1. `src/components/PaymentMethodStep.tsx` — add `itemId` prop; include `user_id`, `item_id`, and bounce-back params in Swish URL.
2. `src/pages/Confirmation.tsx` — invoke `verify-swish-payment` during the verifying phase; handle errors.
3. `src/components/EventTicketPurchaseDialog.tsx` — pass `itemId={event.id}`.
4. `src/components/BundlePurchaseWizard.tsx` — pass `itemId={courseId}`.
5. `src/components/LessonBookingDialog.tsx` — pass `itemId` (lesson id when applicable).
6. `src/components/StandaloneTicketPurchaseDialog.tsx` — no `itemId` needed.
7. `supabase/functions/verify-swish-payment/index.ts` — richer event/course/ticket confirmation email HTML mirroring `verify-event-payment`.

## What Stays the Same

- Stripe flow (`verify-event-payment`, `verify-course-payment`, `verify-standalone-ticket-payment`) is untouched.
- Idempotency rules in `verify-swish-payment` are untouched.
- QR codes continue to be displayed in `/biljetter` (not embedded as images in the email), matching today's Stripe behavior.
