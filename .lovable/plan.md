

# Add Swish Payment Option + Confirmation Page

## Summary
Add a payment method selection step to all three purchase flows (Events, Courses, Tickets). The "Buy Now" button will show a payment method chooser instead of immediately redirecting to Stripe. Swish redirects to an external WordPress/WooCommerce URL. A new `/confirmation` route handles the return.

## Architecture

```text
User clicks "Buy Now"
        │
        ▼
┌─────────────────────────┐
│ Payment Method Step      │
│ (inside same modal)      │
│                          │
│ Order Summary            │
│ ┌──────────────────────┐ │
│ │ Betala med kort      │ │ → Existing Stripe flow (unchanged)
│ └──────────────────────┘ │
│ ┌──────────────────────┐ │
│ │ Betala med Swish     │ │ → window.location.href redirect to dancevida.se
│ └──────────────────────┘ │
│                          │
│ ← Tillbaka               │
└─────────────────────────┘
```

## New Files

### 1. `src/components/PaymentMethodStep.tsx`
Shared component used by all three purchase flows. Props:
- `itemName: string`
- `itemType: 'event' | 'course' | 'ticket'`
- `amount: number` (in SEK, not cents)
- `quantity: number`
- `onSelectStripe: () => void` — calls existing Stripe logic
- `onBack: () => void` — returns to previous step
- `processing: boolean`

Behavior:
- Fetches `customer_email` and `customer_name` from `supabase.auth.getSession()` + profiles table
- If not logged in, shows email + name input fields
- "Betala med kort" button triggers `onSelectStripe()`
- "Betala med Swish" button builds the redirect URL and does `window.location.href = ...`
- Shows order summary (item name, type label, quantity, total)
- "← Tillbaka" link at bottom calls `onBack()`

### 2. `src/pages/Confirmation.tsx`
New route at `/confirmation`. Reads query params: `order_id`, `status`, `amount`, `item_name`, `item_type`.
- If `status === "success"`: green checkmark, "Betalning genomförd! 🎉", amount + item info, back button linking to appropriate page
- Otherwise: generic thank you message with link to `/`

## Modified Files

### 3. `src/App.tsx`
- Import `Confirmation` page
- Add route: `<Route path="/confirmation" element={<Confirmation />} />` (outside auth guard, next to payment-success/payment-cancelled)

### 4. `src/components/EventTicketPurchaseDialog.tsx`
- Add state: `step: 'select' | 'payment'` (default `'select'`)
- Current ticket selection UI shows when `step === 'select'`
- Current "Buy Now" button changes to set `step = 'payment'` instead of calling `handlePurchase()`
- When `step === 'payment'`, render `<PaymentMethodStep>` with:
  - `itemName={event.title}`, `itemType="event"`, `amount={getSelectedPrice()}`, `quantity={selectedOption}`
  - `onSelectStripe` calls the existing `handlePurchase()` logic
  - `onBack` sets `step = 'select'`
- Reset `step` to `'select'` when dialog opens

### 5. `src/components/StandaloneTicketPurchaseDialog.tsx`
- Add state: `step: 'select' | 'payment'`, `selectedPackage`
- Current ticket package grid shows when `step === 'select'`
- "Köp nu" buttons set `selectedPackage` and `step = 'payment'`
- When `step === 'payment'`, render `<PaymentMethodStep>` with:
  - `itemName="{count} Klipp"`, `itemType="ticket"`, `amount={pkg.price}`, `quantity={pkg.count}`
  - `onSelectStripe` calls existing `handlePurchase(selectedPackage.count)`
  - `onBack` sets `step = 'select'`

### 6. `src/components/BundlePurchaseWizard.tsx`
- Add a new wizard step `'payment'` after `'summary'`
- The "Fortsätt till betalning" button in summary step sets `step = 'payment'` instead of calling `handleProceedToCheckout()`
- When `step === 'payment'`, render `<PaymentMethodStep>` with:
  - `itemName={courseName + ' - ' + selectedTier.name}`, `itemType="course"`, `amount={selectedTier.price_cents / 100}`, `quantity=1`
  - `onSelectStripe` calls existing `handleProceedToCheckout()`
  - `onBack` sets `step = 'summary'`
- Update progress indicator to show 4 steps instead of 3

## Swish Redirect URL Construction (inside PaymentMethodStep)

```
https://dancevida.se/swish-checkout/?item_name=${encodeURIComponent(itemName)}&item_type=${encodeURIComponent(itemType)}&amount=${encodeURIComponent(amount)}&quantity=${encodeURIComponent(quantity)}&customer_email=${encodeURIComponent(email)}&customer_name=${encodeURIComponent(name)}&return_url=${encodeURIComponent('https://cms.dancevida.se/confirmation')}
```

## UI Details
- "Betala med kort" button: existing gold/amber primary color, `CreditCard` icon
- "Betala med Swish" button: `bg-[#00B9ED] hover:bg-[#00a5d4] text-white`, `Smartphone` icon
- Order summary: card with item name, type badge, quantity, total price
- All text in Swedish

## No Backend Changes
- No edge functions modified
- No database changes
- Stripe logic completely untouched — just called from a different UI path

