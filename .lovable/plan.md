

## Finding

**File:** `supabase/functions/create-swish-payment/index.ts`
**Line 9:** `const PAYEE_ALIAS = "1236032999";`

This was changed from `1230344705` to `1236032999` in the previous implementation based on project memory — which you've now confirmed is wrong.

The certificate subject CN is `1230344705`, so the payee alias must match.

## Plan

Change line 9 of `supabase/functions/create-swish-payment/index.ts`:

```
- const PAYEE_ALIAS = "1236032999";
+ const PAYEE_ALIAS = "1230344705";
```

Single line change. No other files reference this value.

