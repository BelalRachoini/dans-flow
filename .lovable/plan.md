

# Add Member Payment History and Receipt Downloads

## Current State
- Payment history is only visible to admins via `/betalningar`
- Receipts (kvitto) are emailed as PDF attachments after purchase but cannot be re-downloaded
- Members have no way to view past payments or re-access receipts

## Plan

### 1. Create Member Payment History Page (`src/pages/MyPayments.tsx`)
- New page showing the logged-in member's payment history
- Fetch from both `swish_payments` (where `member_id = auth.uid()`) and Stripe via a new lightweight edge function or by querying existing data
- Display: date, description, amount, payment method (card/Swish), status
- Mobile-friendly card layout consistent with existing member pages

### 2. Add Receipt Download Button
- Each paid transaction gets a "Ladda ner kvitto" (Download receipt) button
- Create a new edge function `generate-receipt` that accepts a payment reference and generates the same PDF receipt used in email confirmations
- Returns the PDF as a downloadable file
- Validates that the requesting user owns the payment

### 3. Add Navigation Link
- Add "Mina betalningar" to the member navigation in `Layout.tsx` (for role `MEMBER`)
- Icon: `CreditCard` or `Receipt`

### 4. Add Route
- Register `/mina-betalningar` in `App.tsx` as authenticated member route

### 5. Add Translations
- Add keys for "My payments", "Download receipt", "Payment history", etc. to `en.ts`, `sv.ts`, `es.ts`

## Edge Function: `generate-receipt`
- Accepts `{ payment_id, payment_source: 'stripe' | 'swish' }`
- Verifies the caller owns the payment (member_id matches auth.uid()) or is admin
- Reuses the same PDF generation logic from `send-email` function
- Returns PDF as `application/pdf` response

## Data Sources for Member View
- **Swish**: Direct query to `swish_payments` table (member already has RLS SELECT access)
- **Stripe**: New edge function `get-member-payments` that filters Stripe payments by `user_id` metadata, or reuse checkout session data stored during purchase

