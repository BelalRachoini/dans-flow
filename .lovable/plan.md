## Change

Replace the past-event detection in `src/pages/Biljetter.tsx` (~lines 988‑994) so it uses `end_at` first and falls back to `start_at + 1 day` instead of the current `start_at + 6h` rule. This keeps multi-day events and late-night parties visible until they've actually ended, and reliably hides yesterday's events.

### Edit

`src/pages/Biljetter.tsx` — replace the `_eventGraceMs` constant and `_isEventInFuture` function with:

```ts
const _ONE_DAY_MS = 24 * 60 * 60 * 1000;
const _isEventInFuture = (e: EventTicket & { type: 'event' }) => {
  const endStr = e.event_dates?.end_at || e.events?.end_at;
  const startStr = e.event_dates?.start_at || e.events?.start_at;
  if (endStr) return new Date(endStr).getTime() + _ONE_DAY_MS > _nowMs;
  if (startStr) return new Date(startStr).getTime() + _ONE_DAY_MS > _nowMs;
  return true;
};
```

### Already in place (verified)

- `EventTicket` interface has `end_at: string | null` on both `events` (line 65) and `event_dates` (line 72).
- The `event_bookings` Supabase query (lines 309‑328) already selects `end_at` from both `events` and `event_dates`.

So no interface, query, or type changes are needed — only the helper function.

### Out of scope

No other files, no DB changes.

### Verification

- Ticket for an event with `end_at` in the past → moves to "Tidigare evenemang" the next day.
- Ticket for a party `start_at` 20:00, `end_at` 03:00 next day → stays in active section through 03:00 and for 24h after.
- Multi-day event with future `end_at` → stays active.
