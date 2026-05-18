## Fix Swish idempotency check

**File:** `supabase/functions/verify-swish-payment/index.ts`

**Change:** In the event branch, replace the idempotency guard so it only short-circuits when the full expected set of bookings already exists. If WordPress created fewer than expected (race condition), the function creates the remaining bookings with the correct attendee names from its own params.

### Edit

Before the existing-bookings check, compute:
```ts
const expectedTotal = ticketCount * datesToBook.length;
```

Change:
```ts
if (existing && existing.length > 0) {
  alreadyExisted = true;
  ...
}
```
to:
```ts
if (existing && existing.length >= expectedTotal) {
  alreadyExisted = true;
  ...
} else if (existing && existing.length > 0) {
  // Partial set exists — fill in missing bookings below, skipping already-created (date, person) slots
}
```

In the creation loop, skip slots already covered by `existing` (matched by `event_date_id` + person index within that date) so we don't double-book. Each newly created booking continues to use:
```ts
attendee_names: [
  (attendeeNamesArr[i] && attendeeNamesArr[i].trim()) ||
    customer_name ||
    `Person ${i + 1}`,
],
```
(unchanged — confirmed present).

After creation, merge `existing` + newly created into `createdBookings`, sorted by `(date order, person index)` so QR labels align.

### Deploy
Deploy `verify-swish-payment` via the deploy tool after the edit.

### Verify
- Call the function for an order where bookings already match expected count → returns `already_exists: true`, no new rows.
- Call for an order with only 1 of 2 expected bookings → creates the missing one with the correct attendee name, sends email with both QRs.
