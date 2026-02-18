

## Plan: Fix Member Profile to Show Real Stripe Data

### Problem

The member detail drawer (Overview tab) shows "0 kr" for Total, "0" for Purchases, and no Last Activity because it queries the empty `v_member_revenue` view and `payments` table. All actual payment data is in Stripe.

### Solution

Update the `MemberDetailDrawer` component to fetch payment data from the `get-stripe-payments` Edge Function and filter by the specific member's ID.

### File Changes

| File | Change |
|------|--------|
| `src/components/MemberDetailDrawer.tsx` | Replace `v_member_revenue` and `payments` queries with a single call to `get-stripe-payments`, filter by `memberId`, and compute revenue/purchases/last activity from the Stripe data |

### Technical Details

1. **Replace the revenue query** (lines 139-151): Instead of querying `v_member_revenue`, call `get-stripe-payments` and filter results where `userId === memberId` and `status === 'paid'`
2. **Replace the payments query** (lines 154-167): Use the same Stripe data to populate the Purchase History tab, instead of the empty `payments` table
3. **Compute overview stats**: From the filtered Stripe payments, calculate:
   - Total revenue (sum of `amountSEK`)
   - Purchase count
   - Last activity date (most recent payment date)
4. **Purchase History tab**: Display actual Stripe transactions with description, amount, date, and status

