## Context

Swish payments are processed on the WordPress site, not in this app. The only signal this app currently gets is when WP redirects the buyer's browser back to `/payment/confirmation`. If the browser never returns (closed tab, lost connection, app switch), the booking is silently lost — which is exactly what happened with Konpa.

Since WordPress can't be modified right now, we'll harden the **in-app safety net** so a paid attendee can always be recovered without WP cooperation.

## What will change

### 1. Drop the unused server-to-server webhook
- Delete the `swish-reconcile` edge function (created last turn). It only helps if WP calls it, and that won't happen.
- Drop the `SWISH_RECONCILE_TOKEN` secret request.

### 2. Keep & finish the verify-on-return hardening (already done last turn)
- `verify-swish-payment` writes to `swish_payments` **before** anything else, so even if booking insert or email fails, the payment is logged.
- `Confirmation.tsx` removed the 8s spinner cap and retries the verify call once.

### 3. Admin recovery UI in `EventAttendeesDialog.tsx` (already done last turn — keep)
- "Betalt men ej bokat" section listing `swish_payments` rows with no matching `event_bookings.payment_reference`.
- One-click "Skapa bokning" button → `admin_reconcile_swish_event_booking` RPC.

### 4. NEW — Manual admin entry for fully-missing payments
The above only helps if `swish_payments` has a row. For Konpa, **swish_payments is empty**, because WP never told us about those payments. Add a manual entry path:

- In `EventAttendeesDialog.tsx`, add a "Lägg till manuell bokning" button (admin only).
- Opens a small form: name, email (optional), Swish reference (optional), date (if multi-date), ticket count.
- Calls a new RPC `admin_create_manual_event_booking(p_event_id, p_event_date_id, p_member_id_or_null, p_attendee_name, p_ticket_count, p_payment_reference)` which:
  - Creates/finds a profile by email if provided, else stores attendee as a guest in `attendee_names`.
  - Inserts an `event_bookings` row with `payment_status='paid'`, `payment_reference='manual:<ref>'`.
  - Increments `events.sold_count`.
  - Returns the new booking id.
- No email sent automatically (admin handles communication).

### 5. Keep the daily drift detector (already done last turn)
- `swish-bookings-drift` runs daily, emails `info@tropicalstudios.se` if any `swish_payments` row lacks a booking.
- Add this function to `supabase/config.toml` with a cron schedule (`0 8 * * *` — 08:00 UTC daily).

### 6. Konpa backfill — deferred
User didn't provide the missing attendee data. Once they paste names/emails into chat, I'll insert the rows via the new manual-entry UI (or a one-off migration if it's many).

## Out of scope
- Any WordPress-side changes (webhook, callback). Revisit if/when WP can be modified.
- Stripe path (already reliable via session_id verification).
- Refunds.

## Files touched
- **Delete:** `supabase/functions/swish-reconcile/index.ts`
- **Edit:** `supabase/config.toml` (add cron for `swish-bookings-drift`, remove swish-reconcile)
- **Edit:** `src/components/EventAttendeesDialog.tsx` (add manual-entry button + dialog)
- **New migration:** `admin_create_manual_event_booking` RPC
- **Edit:** `src/locales/{sv,en,es}.ts` (strings for the new button/dialog)
