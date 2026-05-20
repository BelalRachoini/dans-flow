## Goal
Make the admin "Attendees" view on `/event` a proper event report: list of buyers + attendees, payment totals, and live attendance stats (registered / checked in / no-show), useful both before and after the event.

## Where
Everything is centered on the existing **Attendees Dialog** in `src/pages/Events.tsx` (`handleViewAttendees` + `<Dialog>` block, lines ~502 and ~1138). Triggered from the existing "Visa deltagare" buttons on each admin event card.

No DB changes, no edge functions. All data already exists in `event_bookings`, `event_checkins`, `event_dates`, `events`, `profiles`.

## Changes

### 1. New component `src/components/EventAttendeesDialog.tsx`
Extract and rebuild the dialog as a dedicated component that takes `event` and renders three sections:

**A. Header stats strip (4 cards, gold tinted)**
- **Sålda biljetter** — sum of `ticket_count` across confirmed bookings
- **Intäkt** — sum of `payments.amount_cents` for related bookings + Swish payments for the event (joined via `metadata.event_id` / `order_id`), formatted as `1 250 kr`
- **Incheckade** — sum of `checkins_used` (or distinct people via `event_checkins`)
- **No-show** — `tickets_sold − checked_in`, shown as count + percentage

For multi-date events, the strip switches to a date picker: stats can be filtered per `event_date_id` or shown as "Alla datum".

**B. Buyer table**
Columns:
- Köpare (avatar + `profiles.full_name`)
- Antal biljetter (`ticket_count`)
- Deltagare (expandable list from `attendee_names`)
- Betalat (resolved amount from `payments` / `swish_payments` joined by `member_id` ± booking time)
- Metod (Kort / Swish badge)
- Bokad (`booked_at` short date)
- Status badge: `confirmed` / `checked_in` / `cancelled` / `refunded`
- Incheckning: `checkins_used / checkins_allowed` with a green check when fully attended, orange dot when partial, red dot when 0 (no-show after event start)

Row click expands to show each individual attendee name and the per-date check-in (using `event_checkins.event_id` + booking_id × `event_dates`) for multi-day events.

**C. Empty / past-event affordances**
- After event end time → header reads "Eventrapport" instead of "Deltagarlista", and a small "Closeout" line: "X av Y dök upp (Z%)".
- Search input filtering buyer names/emails.
- "Exportera CSV" button → builds a CSV client-side (no backend) with all columns above, downloads as `attendees-{event-title}-{date}.csv`.

### 2. Data loading
Replace the current single query with a parallel batch in the new component:
```ts
const [bookingsRes, checkinsRes, paymentsRes, swishRes, datesRes] = await Promise.all([...]);
```
- `event_bookings` joined with `profiles` (same query, but also include `cancelled`/`refunded` for the report)
- `event_checkins` filtered by `event_id`
- `payments` filtered by `member_id IN (buyers)` with description containing event title OR `order_id` matching the booking — keep simple: heuristic `created_at` within 24h of `booked_at`
- `swish_payments` same heuristic
- `event_dates` for multi-day breakdown

Compute stats client-side. Memoize per-event so closing/reopening is instant.

### 3. Events.tsx
- Replace inline dialog state/JSX with `<EventAttendeesDialog event={selectedEventForReport} open onOpenChange />`.
- Keep the existing trigger buttons.
- Tweak the "Visa deltagare" button label: for past events show "Visa rapport", for upcoming "Visa deltagare" (uses `event.end_at < now()` check).

### 4. Translations
Add to `src/locales/{sv,en,es}.ts` under `events`:
- `report`, `ticketsSold`, `revenue`, `checkedIn`, `noShow`, `attendanceRate`, `paymentMethod`, `cardLabel`, `swishLabel`, `exportCsv`, `searchAttendees`, `allDates`, `perDate`, `confirmedStatus`, `checkedInStatus`, `cancelledStatus`, `refundedStatus`, `closeoutLine` ("{checked} av {sold} dök upp ({pct}%)").

## Out of scope
- No edits to event creation / payment flows.
- No new DB tables or triggers.
- No changes to QR-scanner check-in logic.
- Instructor view (`InstructorEventAttendees.tsx`) stays as-is for now.

## Verification
1. Open an upcoming event → dialog shows live "Sålda / Intäkt / Incheckade / No-show", buyer list with paid amounts.
2. Open a past event → header says "Eventrapport", closeout line shows correct attendance %.
3. Multi-date event → date picker filters stats and the per-row check-in chips.
4. Click "Exportera CSV" → file downloads with all columns and opens cleanly in Excel/Numbers.
5. Cancelled / refunded buyers visible but excluded from sold/revenue counters.