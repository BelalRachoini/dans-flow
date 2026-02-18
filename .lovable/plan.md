

## Plan: Fix Payment Customer Names and Descriptions in Betalningar

### Problem

All payments show "Unknown" for customer name and "unknown@example.com" for email, and descriptions show generic "Payment" instead of what was purchased. This happens because:

1. **Customer lookup fails**: The Stripe API version used doesn't expand `charges` by default, so `pi.charges` is always empty. Many checkout sessions also don't create a Stripe customer object, so `pi.customer` is null.
2. **User ID is ignored**: Every payment stores the `user_id` in Stripe metadata, but the function never uses it to look up the profile in the database.
3. **Description fallback**: When metadata-based description lookup fails or metadata is missing, it falls back to `pi.description` which is just "Payment".

### Solution

Update the `get-stripe-payments` Edge Function to:

1. **Expand `latest_charge`** when listing payment intents, so billing details are available
2. **Look up user profiles from metadata** -- use `metadata.user_id` to query the `profiles` table for name and email
3. **Fall back to billing details** from the expanded charge if profile lookup fails

### File Changes

| File | Change |
|------|--------|
| `supabase/functions/get-stripe-payments/index.ts` | Fix customer and description resolution |

### Technical Details

**Current flow (broken):**
```text
pi.customer (null) --> try Stripe customer API --> fail
pi.charges (undefined) --> no billing details --> "Unknown"
```

**Fixed flow:**
```text
metadata.user_id --> query profiles table --> get full_name + email
  |-- fallback: expand latest_charge --> billing_details.name + email
  |-- fallback: "Unknown"
```

Key changes in the edge function:

1. Add `expand: ['data.latest_charge']` to `stripe.paymentIntents.list()` call
2. After getting `metadata.user_id`, query the `profiles` table for `full_name` and `email`
3. Use `latest_charge.billing_details` as secondary fallback
4. Batch profile lookups for efficiency (collect all user_ids, query once)

### Expected Result

After this fix:
- Customer names will show the actual user's name from their profile (e.g., "Anna Andersson")
- Emails will show the user's real email
- Descriptions will properly show what was purchased (e.g., "Kurs: Salsa Nybörjare", "Event: Latin Night", "Klippkort: 10 st")
- The "Typ" column will correctly categorize payments as Kurs/Event/Klippkort/Drop-in instead of all showing "Ovrigt"

