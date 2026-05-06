# Make Swish Payments Visible to Admin (Parity with Stripe)

## Root Cause

When a Swish payment succeeds, `verify-swish-payment` only inserts into `event_bookings` / `tickets` — it never writes a row to the `payments` table.

Meanwhile, every admin view of "payments / revenue" reads exclusively from Stripe (via the `get-stripe-payments` edge function, which calls `stripe.paymentIntents.list`). Swish transactions are invisible to:

- `Betalningar.tsx` (admin payments page)
- `MedlemmarCRM.tsx` (per-member revenue column)
- `MemberDetailDrawer.tsx` (member drawer revenue stats)
- `MyPayments.tsx` (member's own payment history / receipt download)

So a Swish purchase = ticket created, but **zero footprint** in any admin/finance UI.

## Fix

The cleanest path is: **write Swish payments into the same `payments` table Stripe uses**, then make `get-stripe-payments` merge in Swish rows. No UI logic has to change — every place that already lists Stripe payments will automatically show Swish too.

### 1. `verify-swish-payment` — record the payment

In all three branches (event / course / standalone ticket), after the booking/ticket is created (and only if `already_exists` is false), insert a row into `payments`:

```ts
await supabaseClient.from('payments').insert({
  member_id: user_id,
  amount_cents,
  currency: 'SEK',
  status: 'paid',
  description, // see table below
});
```

| item_type   | description                                     |
|-------------|-------------------------------------------------|
| event       | `Event: ${currentEvent.title}` (× ticketCount × dates implicit in amount) |
| course      | `Kurs: ${course.title}`                         |
| ticket      | `Klippkort: ${ticketCount} st`                  |

Also store a `swish:` order tag so we can dedupe and download receipts:
- Add `order_id text` column to `payments` (currently doesn't exist — see migration below) **OR** put the wp_order_id into `description` as a suffix. Cleaner: add the column.

### 2. `payments` table migration

Add fields needed for parity and dedupe:

```sql
ALTER TABLE public.payments
  ADD COLUMN IF NOT EXISTS order_id text,
  ADD COLUMN IF NOT EXISTS payment_method text NOT NULL DEFAULT 'stripe',
  ADD COLUMN IF NOT EXISTS payment_type text;

CREATE UNIQUE INDEX IF NOT EXISTS payments_order_id_unique
  ON public.payments(order_id) WHERE order_id IS NOT NULL;

-- Allow members to read their own payments (for MyPayments page)
CREATE POLICY "Members can view own payments"
  ON public.payments FOR SELECT
  USING (member_id = auth.uid());
```

`payment_method` lets the UI show "Swish" vs "Kort". `payment_type` mirrors the Stripe-derived `type` (`event` / `course` / `tickets` / `lesson`). `order_id` makes the WP→Supabase call idempotent at the payment-row level.

### 3. `get-stripe-payments` → also fetch Swish rows from DB

Rename conceptually (file name stays the same to avoid touching all callers). At the end, before returning, query the `payments` table for `payment_method = 'swish'` and merge those rows into `enrichedPayments`, mapped to the same shape:

```ts
const { data: swishRows } = await supabaseClient
  .from('payments')
  .select('id, member_id, amount_cents, currency, status, description, created_at, payment_type, order_id, profiles:profiles!payments_member_id_fkey(full_name, email)')
  .eq('payment_method', 'swish')
  .order('created_at', { ascending: false })
  .limit(200);

const swishMapped = (swishRows ?? []).map(r => ({
  id: r.id,
  userId: r.member_id,
  userName: r.profiles?.full_name ?? 'Unknown',
  userEmail: r.profiles?.email ?? '',
  amountSEK: r.amount_cents / 100,
  type: r.payment_type ?? 'other',
  status: r.status === 'paid' ? 'paid' : 'pending',
  description: r.description,
  createdAt: r.created_at,
  paidAt: r.created_at,
  method: 'swish',
  stripePaymentIntentId: r.order_id ?? undefined,
}));

return new Response(JSON.stringify({
  payments: [...enrichedPayments, ...swishMapped]
              .sort((a,b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()),
  has_more: paymentIntents.has_more,
}), ...);
```

Now every admin surface that consumes this function (Betalningar, MedlemmarCRM, MemberDetailDrawer) automatically shows Swish payments — no UI changes required.

### 4. `MyPayments.tsx` — already works

It already queries the `payments` table directly. Once Swish writes into `payments` and the new RLS policy is in place, members will see their Swish purchases listed alongside Stripe ones.

### 5. `generate-receipt` — handle Swish from `payments` table

Change the receipt download path so `payment_source: 'stripe'` actually means "look it up in the `payments` table" regardless of method (since both flows now live there). For the existing Swish branch (which queries `swish_payments`), keep it as a fallback but route normal Swish receipts through the unified `payments` flow (frontend always sends `'stripe'`).

Frontend: in `MyPayments.tsx`, no change — still passes `payment_source: 'stripe'` and the function fetches from the unified `payments` table.

### 6. (Optional polish) Show payment method in Betalningar table

Tiny UI tweak: in `Betalningar.tsx` table, render the `method` column (already in the data model, currently shown only in CSV export). Add a column "Metod" displaying `Kort` / `Swish` for clarity.

## Files Touched

1. **Migration** — add `order_id`, `payment_method`, `payment_type` to `payments`; add member-read RLS.
2. `supabase/functions/verify-swish-payment/index.ts` — insert into `payments` in all three branches.
3. `supabase/functions/get-stripe-payments/index.ts` — merge Swish rows from DB into the response.
4. `supabase/functions/generate-receipt/index.ts` — unified lookup so Swish receipts work via the `payments` row.
5. `src/pages/Betalningar.tsx` — small column addition for "Metod".

## What Stays the Same

- Stripe flow untouched (still writes to `payments` for the funcs that already do; admin view still pulls live from Stripe API for richest metadata).
- All Swish booking/ticket creation logic in `verify-swish-payment` is unchanged.
- WordPress side is unchanged — it already calls `verify-swish-payment` correctly.
- `MedlemmarCRM`, `MemberDetailDrawer`, `Betalningar` — no logic change; they automatically gain Swish visibility through the merged response.
