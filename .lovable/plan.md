## What's already there (probably hidden by stale preview)

The Member drawer's *Quick actions* already has more than your screenshot shows. In the current code:

- **Give Tickets** has a "Tie to course" dropdown listing every course (semester, new beginner, etc.) plus a "Generic / drop-in" option, and an expiry-date picker. Picking a course writes to `tickets.source_course_id`, so the gifted clip is tied to that specific class.
- **Give Event Ticket** is a separate block right next to it: pick an event → pick a date (if multi-date) → number of attendees → "Create free booking". Uses `admin_create_free_event_booking`.

So *giving* tickets for semester classes, new beginner classes, and events is supported today — the panel just looks cramped and the screenshot you sent is the older simpler layout. The real gaps are on the **Remove / take away** side and **UX clarity**.

## What I want to add / fix

### 1. Unified "Target" selector for Give + Remove

Rebuild the ticket area inside Quick actions as one tidy panel with a single picker on top:

```text
Target: ( ) Drop-in / generic   ( ) Course   ( ) Event
        └── if Course: dropdown of courses
        └── if Event:  dropdown of events  + date picker (if multi-date)
Tickets: [ 1 ]   Expiry (course/drop-in only): [date]
[ Give ]   [ Remove ]
```

Both the Give and Remove actions use the same target context, so admins can't mismatch.

### 2. Course-scoped removal

Today `admin_remove_tickets` deducts FIFO from any of the member's valid ticket packages, regardless of which course they belong to. I'll extend the RPC with an optional `p_source_course_id`:
- when set, FIFO only across `tickets` rows where `source_course_id = p_source_course_id`.
- when null, current behaviour.

### 3. Event booking removal

There is no admin RPC to cancel an event booking today. I'll add `admin_cancel_event_booking(p_booking_id)`:
- requires `is_admin()`
- sets `event_bookings.status = 'cancelled'`, `payment_status = 'refunded'` (label only — no Stripe refund triggered)
- decrements `events.sold_count` by `ticket_count`
- returns `{ success, event_title, ticket_count }`

When the Target is Event, the Remove side shows the member's bookings for that event (with date + attendee names) so the admin clicks the specific one to cancel, instead of a blind FIFO count.

### 4. Show what they already have

Above the panel, surface a small summary so the admin doesn't fly blind:
- Valid clips per source: e.g. *Drop-in: 4*, *Salsa Beginner Semester: 3*, *Bachata Open Level: 2*.
- Upcoming event bookings: *Konpa Night – 23 May (2 attendees)*.

These already come from existing queries; just need to group `member-tickets` by `source_course_id` and reuse `member-event-bookings`.

## Out of scope
- No Stripe refund call when cancelling an event booking — admin handles money separately.
- No new permissions or RLS changes (everything stays inside SECURITY DEFINER RPCs gated by `is_admin()`).
- No changes to drop-in / standalone ticket purchase flows for members.

## Files & migration
- **Migration**: extend `public.admin_remove_tickets(...)` with `p_source_course_id uuid default null`; create `public.admin_cancel_event_booking(p_booking_id uuid)`.
- **`src/components/MemberDetailDrawer.tsx`**: rebuild Quick actions ticket section (target selector, grouped summary, unified Give/Remove for course / drop-in / event).
- **`src/locales/{sv,en,es}.ts`**: add new labels (target, dropIn, course, event, cancelBooking, ticketsByCourse, etc.).
