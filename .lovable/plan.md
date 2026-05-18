## Root cause

`/biljetter` (`src/pages/Biljetter.tsx`) joins related rows via Supabase nested selects:

- `tickets → courses` (via `tickets_source_course_id_fkey`)
- `event_bookings → events`
- `lesson_bookings → course_lessons` (and `course_lessons` RLS itself requires the parent `courses` row to be visible)

When an admin flips a course or event from `published` to `draft`, RLS hides that parent row for the member. The nested join then returns `null` for `courses` / `course_lessons` / `events`, but the row in `tickets` / `lesson_bookings` / `event_bookings` still belongs to the member and is still returned.

Several render paths dereference those nested objects without a null guard, so React throws and the whole page becomes blank:

- `packageAutoBookings.sort((a, b) => new Date(a.course_lessons.starts_at)...)` (line 1601) and the row render at lines 1603‑1631 (`lesson.starts_at`, `lesson.title`, `lesson.venue`).
- `validLessonBookings.map(... lesson.starts_at ...)` at lines 1688‑1726.
- Event grouping/render at 1789, 1802, 1806, 1923, 1931, 1934 (`event.title`, `event.venue`, `event.start_at`) when `ticket.events` is null because the event was unpublished.
- QR modal at line 2058: `selectedTicket.events.title` (no `?.`).

The `tickets → courses` accesses (947, 2024, 2059) are already guarded with `?.`, so they were never the crash point — the crash is in the lesson/event sections.

## Fix

Filter out orphaned rows right after the fetch in `loadTickets()` so the UI only ever renders rows whose joined parent is still visible, plus add small defensive guards where parents are dereferenced.

### `src/pages/Biljetter.tsx`

1. After `lessonBookingsData` is loaded, set state with only rows that still have a joined lesson:
   ```ts
   setLessonBookings((lessonBookingsData || []).filter(b => b.course_lessons));
   ```
   This makes `packageAutoBookings` / `validLessonBookings` safe — bookings for hidden courses simply disappear from the list (they'll come back automatically when the admin republishes).

2. When building `allTickets`, drop event bookings whose event is no longer visible:
   ```ts
   ...(eventTickets || []).filter(t => t.events).map(t => ({ ...t, type: 'event' as const }))
   ```
   Course tickets (`tickets` row with hidden `courses`) are already safe via `?.` and the "Free Ticket (Admin Gift)" fallback, so they can stay.

3. Defensive guard in the QR modal (line 2058):
   ```ts
   ? selectedTicket.events?.title || 'Biljett'
   ```
   so a race where state updates between filter and render can't crash.

4. Wrap the two `groupedByEvent`/`groupedPast` blocks (1785, 1921) with an extra `if (!ticket.events) return acc;` inside the `reduce` as belt‑and‑braces.

### Out of scope

- No DB / RLS changes — current RLS behaviour is correct (members shouldn't see drafted content).
- No edge-function changes.
- No change to admin behaviour or to the course/event detail pages.

### Verification

- Repro: as admin, set a course that the test member has a `lesson_booking` for to `draft`; reload `/biljetter` as that member. Page should render with the booking quietly omitted instead of crashing.
- Repeat with an event the member has an `event_booking` for. Page should render; that event card disappears.
- Republish → bookings reappear.
