

# Enhance Member Dashboard with Complete Registration Overview

## Current State
Members currently have:
- **Dashboard** (`/member`): Shows only lesson drop-in bookings (limited to 5) — missing event bookings and course enrollments
- **Biljetter** (`/biljetter`): Shows course ticket packages, event bookings, and lesson bookings — but it's a separate page and not immediately visible from the dashboard
- **Mina betalningar** (`/mina-betalningar`): Payment history

The gap: The dashboard doesn't show event bookings or course ticket packages, so members can't quickly see everything they're signed up for.

## Plan

### 1. Add "My Events" section to MemberDashboard (`src/pages/MemberDashboard.tsx`)
- Fetch `event_bookings` where `member_id = userId` and status is `confirmed` or `checked_in`, joined with `events` for title/date/venue
- Display upcoming event bookings with date, venue, ticket count, and QR code button
- Show only future events (where `events.start_at >= now()`)

### 2. Add "My Course Tickets" summary to MemberDashboard
- Fetch `tickets` where `member_id = userId` and status is `valid`, joined with `courses` for title
- Show remaining tickets count per package (total_tickets - tickets_used) and expiry date
- Link to Biljetter page for full details

### 3. Add translations
- Add keys for "My Events", "My Course Tickets", "tickets remaining", "expires" to `sv.ts`, `en.ts`, `es.ts`

### Technical Notes
- RLS already allows members to SELECT their own `event_bookings` and `tickets` — no database changes needed
- Dashboard layout changes from 2-column grid to include a third card, or stack vertically on mobile

