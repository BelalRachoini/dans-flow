## Problem

Past lesson tickets (e.g. Bachata 17 mars 2026, Salsa 18 februari 2026) are still displayed in the active "Mina biljetter" section with usable QR codes, even though the lesson date has long passed. Today is 18 maj 2026, so any lesson from March or February should be in history.

Root cause in `src/pages/Biljetter.tsx` (lines 980–986): `validLessonBookings` filters only on `status === 'valid'` and `checkins_used < checkins_allowed`. There is no date check. If a member never checked in (or only partially), the booking stays "valid" forever and keeps rendering a live QR.

The event-tickets path was already fixed with `_isEventInFuture`. The lesson-bookings path needs the same treatment.

## Fix

In `src/pages/Biljetter.tsx`, add a small `_isLessonInFuture` helper next to `_isEventInFuture` and use it to split lesson bookings into active vs. history.

A lesson is considered active when:
- `course_lessons.ends_at` is set and `ends_at + 1 day > now`, OR
- only `starts_at` is set and `starts_at + 1 day > now`.

Otherwise the booking is treated as past and moved into `historyLessonBookings` (regardless of `status`), so the active card with QR disappears and it shows up under "Biljetthistorik" instead.

### Changes (single file, frontend only)

`src/pages/Biljetter.tsx` around lines 980–986:

- Add `_isLessonInFuture(b)` using `_nowMs` / `_ONE_DAY_MS` (already defined just below).
- Update `validLessonBookings` to also require `_isLessonInFuture(b)`.
- Update `historyLessonBookings` to include bookings where `_isLessonInFuture(b)` is false, in addition to the existing used / fully-checked-in condition.

No backend, RLS, edge function, or schema changes. No change to packageAuto or event logic. No styling changes.

## Verification

- Bachata 17 mars 2026 ticket: no longer in active list, appears in Biljetthistorik.
- A lesson dated later than today: still active with QR.
- Already-used lesson bookings: still in history as before.
- Event tickets section: unchanged.