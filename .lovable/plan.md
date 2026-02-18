
## Plan: Show Actual Revenue Per Client in Members CRM

### Problem

The "Total Revenue" KPI card and per-member revenue column in the Members CRM page all show **0 kr** because the `v_member_revenue` database view reads from the `payments` table, which is empty. All actual payments go through Stripe and are never recorded in the local `payments` table.

### Solution

Instead of trying to sync the local `payments` table, the CRM page will fetch Stripe payment data (via the existing `get-stripe-payments` Edge Function) and aggregate revenue per `user_id` from the Stripe metadata. This gives accurate, real-time revenue per client.

### Changes

| File | What Changes |
|------|-------------|
| `src/pages/MedlemmarCRM.tsx` | Replace the `v_member_revenue` query with a call to `get-stripe-payments` edge function, aggregate amounts by `userId`, and map to each member row |

### Technical Details

1. **Fetch Stripe payments** using `supabase.functions.invoke('get-stripe-payments')` inside the existing `useQuery`
2. **Aggregate by userId**: Group all `succeeded` payments by `userId` and sum `amountSEK` to get revenue per member
3. **Map to member rows**: Replace the `revenueMap` (currently from empty `v_member_revenue`) with the Stripe-aggregated map
4. **Remove the `v_member_revenue` query** since it returns zeros

This means:
- The "Total Revenue" KPI card will show the real total
- The "Avg per member" KPI will be accurate
- Each member row will show their actual spend
- Sorting by revenue will work correctly
