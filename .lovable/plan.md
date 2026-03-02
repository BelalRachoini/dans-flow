

# Swish Payment Integration -- Ready to Implement

All 3 Swish secrets (SWISH_CERT, SWISH_KEY, SWISH_CA) are confirmed in place. Here is the implementation breakdown:

## Step 1: Create `create-swish-payment` Edge Function
- Authenticates user via JWT
- Accepts `{ payment_type, amount_sek, metadata }` 
- Generates UUID payment request ID, calls Swish API with mTLS
- Saves record to `swish_payments` table
- Returns `{ paymentRequestId, paymentRequestToken }`

## Step 2: Create `swish-callback` Edge Function
- No JWT (called by Swish directly)
- On PAID: mirrors existing verify functions -- creates bookings/tickets, sends emails, records payments
- On DECLINED/ERROR: updates swish_payments status

## Step 3: Update `config.toml`
- Add `verify_jwt = false` for both new functions

## Step 4: Create `SwishPaymentStatus.tsx`
- Polling dialog that checks `swish_payments` table every 3s
- Shows swish:// deep link on mobile
- Success/error/timeout states

## Step 5: Update 4 Purchase Dialogs
- Add payment method selector (Kort / Swish) to EventTicketPurchaseDialog, StandaloneTicketPurchaseDialog, LessonBookingDialog, BundlePurchaseWizard
- Swish path calls `create-swish-payment` then shows SwishPaymentStatus

## Step 6: Update `get-stripe-payments`
- Query `swish_payments` with PAID status, merge into response

---

**9 files total**: 2 new edge functions, 1 new component, 4 modified dialogs, 1 modified edge function, 1 config update.

