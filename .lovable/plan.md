

# Swish Payment Integration -- Implementation Plan

## Step 0: Store Swish Certificates (Required First)

Before any code changes, three secrets must be added:
- **SWISH_CERT** -- TLS client certificate (PEM, base64-encoded)
- **SWISH_KEY** -- TLS private key (PEM, base64-encoded)
- **SWISH_CA** -- Swish CA certificate (PEM, base64-encoded)

These are required for mTLS authentication with the Swish API. Implementation cannot proceed without them.

---

## Step 1: Backend -- `create-swish-payment` Edge Function (NEW)

Creates a Swish payment request via the Swish API using mTLS.

- Authenticates the user via JWT
- Accepts: `{ payment_type, amount_sek, metadata }` where metadata contains IDs like event_id, course_id, lesson_id, ticket_count, attendee_names, tier_id, selected_class_ids, ticket_type
- Generates a unique payment request ID (UUID without dashes, uppercase)
- Calls Swish API `PUT /api/v2/paymentrequests/{id}` with mTLS certificates
- Saves a record in the `swish_payments` table with status `CREATED`
- Returns `{ paymentRequestId, paymentRequestToken }` for the frontend

The function uses `Deno.createHttpClient()` with the decoded certificates for mTLS, then makes a standard `fetch` call.

---

## Step 2: Backend -- `swish-callback` Edge Function (NEW)

Receives asynchronous callbacks from Swish when payment status changes. This endpoint is called directly by Swish (no JWT).

On `PAID` status, based on `payment_type` stored in the swish_payments metadata:
- **Event**: Creates `event_bookings` (one per attendee per date), increments `sold_count`, sends event confirmation email with PDF receipt
- **Course**: Creates `tickets` + `course_class_selections` + auto-enrolls in lessons, sends course confirmation email with PDF receipt
- **Standalone tickets**: Creates `tickets` entry, sends ticket confirmation email with PDF receipt
- **Lesson drop-in**: Creates `lesson_bookings`, sends lesson confirmation email with PDF receipt

Also inserts a record into the `payments` table for admin tracking.

On `DECLINED`/`ERROR`: Updates `swish_payments` status only.

The booking creation logic mirrors the existing Stripe verification functions exactly, reusing the same email templates and receipt generation via `send-email`.

---

## Step 3: Config -- JWT Bypass for Callback

Add to `supabase/config.toml`:
```
[functions.swish-callback]
verify_jwt = false
```

This is required because Swish calls the callback directly (no user JWT).

---

## Step 4: Frontend -- `SwishPaymentStatus.tsx` (NEW)

A dialog/overlay component shown after initiating a Swish payment:
- Displays "Open Swish app to complete payment" with a loading spinner
- On mobile: provides a `swish://` deep link button to open the Swish app
- Polls the `swish_payments` table every 3 seconds for status changes
- On `PAID`: shows success message, navigates to tickets page
- On `DECLINED`/`ERROR` or 3-minute timeout: shows error with retry option

---

## Step 5: Frontend -- Update Purchase Dialogs

All four purchase dialogs get a payment method selector (two cards: "Kort" with a credit card icon, "Swish" with the Swish logo/icon).

### EventTicketPurchaseDialog.tsx
- Add `paymentMethod` state (`'stripe' | 'swish'`)
- Add method selector UI before the purchase button
- If Stripe: existing flow (calls `create-event-payment`)
- If Swish: calls `create-swish-payment` with `{ payment_type: 'event', amount_sek, metadata: { event_id, ticket_count, attendee_names } }`, then shows `SwishPaymentStatus`

### StandaloneTicketPurchaseDialog.tsx
- Same pattern with `payment_type: 'standalone_tickets'`

### LessonBookingDialog.tsx
- Add method selector for the drop-in purchase buttons
- If Swish: calls `create-swish-payment` with `payment_type: 'lesson'` and lesson metadata

### BundlePurchaseWizard.tsx
- Add method selector in the summary step (step 3)
- If Swish: calls `create-swish-payment` with `payment_type: 'course'` and course/tier metadata

---

## Step 6: Backend -- Merge Swish Payments in Admin Dashboard

### get-stripe-payments/index.ts (MODIFY)
After fetching Stripe payments, also query `swish_payments` where `status = 'PAID'`:
- Join with `profiles` table for customer names
- Map to the same payment response format with `method: 'Swish'`
- Merge into the response array sorted by date
- The `Betalningar.tsx` page works automatically since it already supports the `method` field

---

## Implementation Order

1. Request Swish certificate secrets from the user
2. Create `create-swish-payment` edge function
3. Create `swish-callback` edge function
4. Update `config.toml` for JWT bypass
5. Create `SwishPaymentStatus.tsx` component
6. Update all 4 purchase dialogs
7. Update `get-stripe-payments` to merge Swish payments
8. Deploy all edge functions and test

---

## Files Summary

| File | Action |
|------|--------|
| `supabase/functions/create-swish-payment/index.ts` | NEW |
| `supabase/functions/swish-callback/index.ts` | NEW |
| `supabase/config.toml` | MODIFY |
| `src/components/SwishPaymentStatus.tsx` | NEW |
| `src/components/EventTicketPurchaseDialog.tsx` | MODIFY |
| `src/components/StandaloneTicketPurchaseDialog.tsx` | MODIFY |
| `src/components/LessonBookingDialog.tsx` | MODIFY |
| `src/components/BundlePurchaseWizard.tsx` | MODIFY |
| `supabase/functions/get-stripe-payments/index.ts` | MODIFY |

No database changes needed -- `swish_payments` table already exists with the correct schema.

