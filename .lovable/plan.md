## What I found

- The latest Swish payments are now being recorded in the unified payments table, so admin visibility is partly fixed.
- The tickets/bookings are also being created with valid QR payloads.
- The screenshot email is WooCommerce’s own order email. That email will never contain the DanceVida QR/account link unless the WordPress side is changed too.
- The app’s Swish flow currently relies on the browser return page to call `verify-swish-payment`. If the user does not return cleanly, closes the page, or the return URL is missing parameters, the DanceVida QR/account email can be skipped even though WooCommerce still sends its emails.
- There is also a bug for standalone Swish tickets: existing ticket lookup can fail because more than one ticket row may exist for the same Swish order, which can break the resend path.

## Plan

1. **Make the Swish confirmation email server-side reliable**
   - Update `verify-swish-payment` so the confirmation email is always generated from the database-created ticket/booking records.
   - Use profile email/name as a fallback if Woo/return URL does not pass `customer_email` or `customer_name`.
   - Keep the purchase successful even if email sending fails, but log the exact failure.

2. **Fix duplicate/idempotent Swish ticket handling**
   - For standalone ticket purchases, replace `.maybeSingle()` with a deterministic query that can handle duplicate rows safely.
   - Prefer the newest matching ticket and reuse its QR payload for the email.
   - Prevent the resend path from crashing when multiple rows share the same Swish order id.

3. **Make the email show QR + account link clearly**
   - Keep the QR code directly inside the DanceVida email.
   - Keep the `Visa mina biljetter` / account link in the same email.
   - Use the actual existing ticket/booking QR payloads so the QR always matches what staff/admin sees.

4. **Add a resend safety net for the latest payment**
   - After the function is fixed, call the Swish verifier for the latest affected order using the existing database record so the customer receives the missing DanceVida QR/account email without creating a duplicate ticket.

5. **Deploy and verify**
   - Deploy `verify-swish-payment`.
   - Check recent database records and function responses to confirm the latest Swish purchase has a payment row, a ticket/booking QR payload, and a successful email-send path.

## Technical details

- Main file: `supabase/functions/verify-swish-payment/index.ts`
- Likely fix areas:
  - Add profile fallback lookup for `customer_email` / `customer_name`.
  - Change standalone ticket idempotency from `.maybeSingle()` to `.limit(1)` with ordering.
  - Make QR email generation depend on resolved customer values and existing DB records.
  - Improve logging around send-email response status/body.
- No schema migration is expected.