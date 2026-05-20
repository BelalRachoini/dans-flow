## Bug

For events with a discount, the discount is only applied to the **1-ticket** option. The 2- and 3-ticket options ignore it entirely.

Confirmed in two places:

1. **`src/components/EventTicketPurchaseDialog.tsx`** (lines 70–80) — `singlePrice` applies the discount. `couplePrice` and `trioPrice` are then computed from raw `event.couple_price_cents` / `event.trio_price_cents` (or fall back to `baseSinglePrice * 2/3` — the un-discounted base). The discount is never applied to them.

2. **`supabase/functions/create-event-payment/index.ts`** (lines 64–90) — same bug, server side: discount branch only runs when `validatedTicketCount === 1`. The couple/trio branches use the raw cents values.

So even if the UI were fixed, the server would still charge full price for 2 and 3 tickets. Both need to be patched, and the server is the source of truth for the Stripe Checkout amount.

In your Golden Nights screenshot: base 150 SEK, 20% off → 1 ticket shows 120 ✓, but 2 tickets shows 300 (should be 240) and 3 tickets shows 450 (should be 360).

## Fix

Extract a single pricing helper that takes `(basePerTicket, count, coupleCents, trioCents, discountType, discountValue)` and returns the cents to charge. Behavior:

- Pick the tier base price:
  - `count === 1` → `price_cents`
  - `count === 2` → `couple_price_cents` if set, else `price_cents * 2`
  - `count === 3` → `trio_price_cents` if set, else `price_cents * 3`
- Then apply the event discount **to that tier price**:
  - `percent` / `percentage` → `Math.round(tier * (1 - value / 100))`
  - `amount` → `Math.max(0, tier - value)` (discount_value is already in cents)
- Clamp to `>= 0`.

Apply this in:

1. **`EventTicketPurchaseDialog.tsx`** — replace the current `singlePrice` / `couplePrice` / `trioPrice` computation. Show the original tier price struck through + the discounted price for **all three tiers** when a discount is active (today this only happens for 1-ticket via `option.originalPrice`).

2. **`supabase/functions/create-event-payment/index.ts`** — replace the if/else block so the discount runs for all three counts. Update the log line accordingly.

No DB change. No schema change. No new fields.

## Question

When an admin has already set explicit `couple_price_cents` / `trio_price_cents` (a manual "bundle" deal) AND also enters a 20% discount, should the 20% **stack on top of the bundle price**, or **be ignored** when an explicit bundle price exists?

- **A — Stack** (recommended, matches "20% off everything in this event"): Bundle SEK 250 for 2 with 20% off → SEK 200. This is the simplest, most predictable rule and matches your current screenshot where you have no bundle deal set.
- **B — Ignore discount when bundle price exists**: bundle prices are treated as already-discounted; the percent only modifies the un-bundled tiers.

If you don't answer, I'll go with A.

## Verification

After deploying:
1. Open the Golden Nights dialog → 1 = 120, 2 = 240, 3 = 360 SEK (all with strike-through 150/300/450).
2. Click "Buy Now" for 2 tickets → Stripe checkout shows SEK 240, not 300.
3. Click "Buy Now" for 3 tickets → Stripe checkout shows SEK 360, not 450.
4. Remove the discount on the event → 1/2/3 revert to 150/300/450, no strike-through.
5. Set an explicit couple price (e.g., 250 SEK) with 20% off, assuming answer A → couple shows 200 SEK at checkout.
