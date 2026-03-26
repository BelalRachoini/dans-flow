

# Remove All Swish Payment Integration

## Summary
Remove Swish as a payment method from the entire application. All purchase dialogs will use card (Stripe) only. The `swish_payments` database table will be kept (it may contain historical data) but no code will reference it.

## Files to Delete
1. `src/components/SwishPaymentStatus.tsx` — Swish polling dialog
2. `src/components/icons/SwishIcon.tsx` — Swish logo component
3. `src/assets/swish-logo.png` — Swish logo image
4. `supabase/functions/create-swish-payment/index.ts` — Edge function
5. `supabase/functions/swish-callback/index.ts` — Callback edge function

## Files to Edit

### 1. `src/components/EventTicketPurchaseDialog.tsx`
- Remove imports: `SwishIcon`, `SwishPaymentStatus`, `CreditCard`, `Label`
- Remove state: `paymentMethod`, `swishPaymentId`, `swishToken`
- Remove `paymentMethod === 'swish'` branch in `handlePurchase()` — keep only the Stripe/card branch
- Remove payment method selector UI (the Kort/Swish toggle)
- Remove `<SwishPaymentStatus>` component at bottom
- Remove reset of `swishPaymentId` and `paymentMethod` in useEffect

### 2. `src/components/LessonBookingDialog.tsx`
- Remove imports: `SwishIcon`, `SwishPaymentStatus`, `CreditCard`, `Label`
- Remove state: `paymentMethod`, `swishPaymentId`, `swishToken`
- Remove `paymentMethod === 'swish'` branch in `handleBuyDropIn()` — keep only Stripe
- Remove payment method selector UI
- Remove `<SwishPaymentStatus>` at bottom

### 3. `src/components/StandaloneTicketPurchaseDialog.tsx`
- Remove imports: `SwishIcon`, `SwishPaymentStatus`, `CreditCard`, `Label`
- Remove state: `paymentMethod`, `swishPaymentId`, `swishToken`
- Remove `paymentMethod === 'swish'` branch in `handlePurchase()` — keep only Stripe
- Remove payment method selector UI
- Remove `<SwishPaymentStatus>` at bottom

### 4. `src/components/BundlePurchaseWizard.tsx`
- Remove imports: `SwishIcon`, `SwishPaymentStatus`, `CreditCard`, `Label`
- Remove state: `paymentMethod`, `swishPaymentId`, `swishToken`
- Remove `paymentMethod === 'swish'` branch in `handleProceedToCheckout()` — keep only Stripe
- Remove payment method selector UI in summary step
- Remove `<SwishPaymentStatus>` at bottom

### 5. `src/pages/MyPayments.tsx`
- Remove Swish payment fetching (the `swish_payments` query block)
- Remove `source: 'swish'` references
- Remove `Smartphone` icon import
- Simplify: only show Stripe/card payments
- Change `PaymentRow.source` type to just `'stripe'`

### 6. `supabase/functions/get-stripe-payments/index.ts`
- Remove the "Merge Swish payments" block (lines ~196-247)
- Only return Stripe payments

### 7. `src/types/index.ts`
- Remove `'swish'` from `PaymentProvider.id` union type

### 8. `src/locales/en.ts`, `src/locales/es.ts`, `src/locales/sv.ts`
- Remove `swish` and `swishNote` translation keys from payments section

### 9. `supabase/config.toml`
- Remove `[functions."create-swish-payment"]` and `[functions."swish-callback"]` blocks

## Database
- The `swish_payments` table will NOT be dropped (preserves any historical data)
- No migration needed

## What stays unchanged
- All Stripe payment flows (card payments work exactly as before)
- Frontend purchase dialogs still work, just without the payment method toggle
- The buy button directly triggers Stripe checkout

