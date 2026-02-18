

## Plan: Fix Payment Customer Names and Product Descriptions

### Root Cause

The metadata (`user_id`, `course_id`, `event_id`, etc.) is stored on Stripe **Checkout Sessions**, not on PaymentIntents. Stripe does not automatically copy session metadata to the PaymentIntent. The `get-stripe-payments` edge function only reads PaymentIntent metadata, which is always empty -- resulting in "Unknown" customers and "Payment" descriptions.

### Solution

Update the `get-stripe-payments` edge function to look up the **Checkout Session** for each PaymentIntent using `stripe.checkout.sessions.list({ payment_intent: pi.id })`. The session contains all the metadata needed (user_id, course_id, event_id, ticket_count, etc.).

### File Changes

| File | Change |
|------|--------|
| `supabase/functions/get-stripe-payments/index.ts` | For each PaymentIntent, fetch its associated Checkout Session to get metadata, then use that metadata for customer lookup and description resolution |

### Technical Details

For each PaymentIntent, the function will:

1. Call `stripe.checkout.sessions.list({ payment_intent: pi.id, limit: 1 })` to get the session
2. Read metadata from the session (user_id, course_id, event_id, etc.)
3. Use `user_id` to look up the profile for customer name/email
4. Use `course_id`/`event_id`/`lesson_id` to build the description (e.g., "Kurs: Salsa Nybojare")

To keep performance acceptable, sessions will be fetched in parallel using `Promise.all` rather than sequentially.

The fallback chain for customer name remains:
- Profile (via session metadata user_id) -> Billing details (from expanded charge) -> Stripe Customer object -> "Unknown"

