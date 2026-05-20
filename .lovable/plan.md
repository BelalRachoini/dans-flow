## What's wrong on the Overview

Looking at the screenshot of `/` (Overview / MemberDashboard):

1. **"Salsa - 1"** in *Upcoming*: lesson titles like `"Salsa - 1"` come straight from `course_lessons.title`, which is auto-generated as `"<class name> - <lesson number>"` for package courses. Looks like a typo to the user.
2. **My Bookings** is filled with 5 cards that all say *Lektion / Invalid Date Invalid Date*: `fetchMyBookings()` only filters by `status='valid'`, never by date. Old `lesson_bookings` whose `course_lessons` were deleted (or whose `starts_at` is in the past) keep showing forever; the deleted lesson means `course_lessons` is `null`, so the date renders as `Invalid Date`. The user wants these gone from Overview (a "Biljetthistorik" already exists on `/biljetter`, so they'll still be accessible there).

## Fix (UI-only, no schema change)

### `src/pages/MemberDashboard.tsx`

**A. Upcoming section — friendlier titles**
In `fetchUpcomingItems`, when building the lesson item title, strip the auto-generated `" - N"` suffix and prefer the course title:
- If `lesson.title` matches `^<course.title>\s*[-–]\s*\d+$` → show `course.title` only.
- Otherwise show `lesson.title || course.title`.
- Show a small subtitle like `Lektion N` when a number suffix was stripped (optional, keeps useful info without looking like a typo).

**B. My Bookings — hide stale/past bookings**
Tighten `fetchMyBookings()`:
- Fetch with the same join, but
  - Skip rows where `course_lessons` is `null` (lesson deleted).
  - Skip rows where `course_lessons.starts_at` is in the past (a small grace window of 2h so a class in progress still shows its QR).
  - Keep the existing `status = 'valid'` filter.
- Sort by `course_lessons.starts_at` ascending (next-up first) instead of `purchased_at` desc.
- Add a small footer link "Visa historik →" that routes to `/biljetter` so users can find old bookings.

**C. Empty-state copy**
When all bookings are filtered out, the existing `t.dashboard.noBookings` translation already handles it — no change needed.

## Out of scope
- No database changes. No new history page (the `/biljetter` Biljetthistorik panel already covers it).
- No changes to event bookings, ticket packages, or payments sections — those already look correct in the screenshot.

## Files touched
- `src/pages/MemberDashboard.tsx` (only)
