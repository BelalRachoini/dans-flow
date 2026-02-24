

# Swish Payment Integration -- Full Plan

## Summary
Add Swish as an alternative payment method alongside Stripe for all four purchase flows: Events, Courses, Standalone Tickets, and Lesson Drop-ins. Swish payments will trigger the same confirmation emails with PDF receipts, register in the admin payments dashboard, and create the correct bookings/tickets.

## Architecture Overview

```text
                     User selects Swish
                           |
              Frontend purchase dialog
              (shows Stripe + Swish option)
                           |
              Edge Function: create-swish-payment
              (creates Swish payment request via mTLS API)
                           |
                   User pays in Swish app
                           |
              Edge Function: swish-callback
              (receives payment confirmation from Swish)
                           |
         +--Creates bookings/tickets in DB
         +--Records in swish_payments table
         +--Records in payments table
         +--Sends confirmation email with PDF receipt
```

## Prerequisites -- Secrets

Three secrets need to be stored for Swish mTLS:
- **SWISH_CERT** -- The TLS client certificate (PEM format, base64-encoded)
- **SWISH_KEY** -- The TLS private key (PEM format, base64-encoded)
- **SWISH_CA** -- The Swish CA certificate (PEM format, base64-encoded)

The merchant payee alias (1236032999) is already known from the project memory.

## Changes by Area

### 1. Backend -- New Edge Functions

**`create-swish-payment/index.ts`** (NEW)
- Accepts: `{ payment_type, amount_cents, currency, metadata }` where metadata contains the relevant IDs (event_id, course_id, lesson_id, ticket_count, etc.)
- Authenticates the user
- Generates a unique payment request ID
- Calls Swish API `PUT /api/v2/paymentrequests/{id}` with mTLS using stored certificates
- Saves a record in `swish_payments` with status `CREATED`
- Returns the payment request token for the frontend to open the Swish app

**`swish-callback/index.ts`** (NEW)
- Receives POST callback from Swish when payment status changes
- On `PAID` status:
  - Updates `swish_payments` record to `PAID`
  - Based on `payment_type` in metadata, creates the relevant database records:
    - **Event**: Creates `event_bookings`, increments `sold_count`
    - **Course**: Creates `tickets` + `course_class_selections`
    - **Standalone tickets**: Creates `tickets` entry
    - **Lesson drop-in**: Creates `lesson_bookings`
  - Inserts a record into the `payments` table
  - Sends confirmation email with PDF receipt via `send-email`
- On `DECLINED`/`ERROR`: Updates `swish_payments` to the failed status
- Must have `verify_jwt = false` in config.toml since Swish calls this directly

### 2. Backend -- Config Changes

**`supabase/config.toml`** -- Add JWT bypass for the callback endpoint:
```toml
[functions.swish-callback]
verify_jwt = false
```

### 3. Frontend -- Payment Method Selection

Each of the four purchase dialogs will be updated to show a payment method chooser (Stripe card / Swish) before the final purchase button.

**`EventTicketPurchaseDialog.tsx`**
- Add a payment method selector (two buttons/cards: "Kort/Card" and "Swish")
- If Stripe selected: existing flow (calls `create-event-payment`)
- If Swish selected: calls `create-swish-payment` with `payment_type: 'event'` and event metadata, then opens Swish deep link or shows "Open Swish app" instruction

**`StandaloneTicketPurchaseDialog.tsx`**
- Same pattern -- add method selector, route to `create-swish-payment` with `payment_type: 'standalone_tickets'`

**`LessonBookingDialog.tsx`**
- Same pattern for the "Buy drop-in" buttons -- add method selector

**`BundlePurchaseWizard.tsx`** (and regular course purchase in `CourseDetail.tsx`)
- Add method selector in the summary/checkout step

### 4. Frontend -- Swish Payment Status Polling

Since Swish doesn't redirect back to a success URL like Stripe, the frontend needs to poll for payment completion:

**New component: `SwishPaymentStatus.tsx`**
- Shows a waiting screen after Swish payment is initiated ("Open Swish app to complete payment")
- Polls `swish_payments` table every 2-3 seconds for status change
- On `PAID`: shows success, navigates to tickets page
- On `DECLINED`/`ERROR`/timeout (3 min): shows error with retry option

### 5. Admin Payments Dashboard

**`Betalningar.tsx`**
- Update `loadPayments` to also fetch from `swish_payments` table
- Merge Swish payments into the same payment list with `method: 'Swish'`
- Or: update `get-stripe-payments` edge function to also query `swish_payments` and merge results

**`get-stripe-payments/index.ts`** (renamed conceptually to "get-all-payments")
- After fetching Stripe payments, also query `swish_payments` with status `PAID`
- Join with `profiles` for customer names
- Merge into the same response array with `method: 'Swish'`

### 6. Database

No new tables needed -- `swish_payments` already exists with the right schema. However, a small RLS policy addition may be needed:

- Add an INSERT policy on `swish_payments` so authenticated users can create their own payment records (for the `create-swish-payment` function which uses the user's token), OR use service role in the edge function

## Technical Details

### Swish API Call (in create-swish-payment)
```typescript
const paymentRequestId = crypto.randomUUID().replace(/-/g, '').toUpperCase();

const swishPayload = {
  payeePaymentReference: paymentRequestId,
  callbackUrl: `${Deno.env.get("SUPABASE_URL")}/functions/v1/swish-callback`,
  payeeAlias: "1236032999",
  amount: amountCents / 100, // Swish uses whole SEK
  currency: "SEK",
  message: description, // e.g. "DanceVida - Salsa Beginners"
};

// mTLS fetch
const cert = atob(Deno.env.get("SWISH_CERT")!);
const key = atob(Deno.env.get("SWISH_KEY")!);

const response = await fetch(
  `https://cpc.getswish.net/swish-cpcapi/api/v2/paymentrequests/${paymentRequestId}`,
  {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(swishPayload),
    client: { certChain: cert, privateKey: key },
  }
);
```

### Swish Callback Payload (in swish-callback)
```typescript
// Swish sends:
{
  id: "PAYMENT_REQUEST_ID",
  payeePaymentReference: "...",
  paymentReference: "SWISH_PAYMENT_REF",
  status: "PAID" | "DECLINED" | "ERROR",
  amount: 150.00,
  currency: "SEK",
  datePaid: "2026-02-24T12:00:00.000+01:00"
}
```

### Frontend Swish Deep Link
On mobile, open the Swish app directly:
```typescript
// Mobile deep link
window.location.href = `swish://paymentrequest?token=${paymentRequestToken}`;
```

On desktop, show a QR code or instruction to open Swish app manually.

### Email + Receipt in Callback
The callback function reuses the same email templates and receipt generation as the Stripe verification functions. It calls `send-email` with the `receipt` parameter to attach the PDF.

## File Summary

| File | Action |
|------|--------|
| `supabase/functions/create-swish-payment/index.ts` | NEW -- Creates Swish payment request |
| `supabase/functions/swish-callback/index.ts` | NEW -- Handles Swish callback, creates bookings, sends emails |
| `supabase/functions/get-stripe-payments/index.ts` | MODIFY -- Also fetch and merge Swish payments |
| `src/components/EventTicketPurchaseDialog.tsx` | MODIFY -- Add payment method selector |
| `src/components/StandaloneTicketPurchaseDialog.tsx` | MODIFY -- Add payment method selector |
| `src/components/LessonBookingDialog.tsx` | MODIFY -- Add payment method selector |
| `src/components/BundlePurchaseWizard.tsx` | MODIFY -- Add payment method selector |
| `src/components/SwishPaymentStatus.tsx` | NEW -- Polling component for Swish payment status |
| `src/pages/Betalningar.tsx` | Minor -- works automatically if get-stripe-payments returns merged data |
| `supabase/config.toml` | MODIFY -- Add verify_jwt=false for swish-callback |

## Implementation Order

1. Store Swish certificate secrets (SWISH_CERT, SWISH_KEY, SWISH_CA)
2. Create `create-swish-payment` edge function
3. Create `swish-callback` edge function (with all 4 payment type handlers + email)
4. Update config.toml for JWT bypass
5. Create `SwishPaymentStatus.tsx` polling component
6. Update all 4 purchase dialogs with payment method selection
7. Update `get-stripe-payments` to merge Swish payments
8. Deploy and test

