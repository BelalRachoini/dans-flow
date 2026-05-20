## What's actually happening

The price change is **not** the cause. Your purchase went through correctly — your ticket package is in the database. The problem is the **attendance view** for package courses only counts two narrow sources:

1. Members who picked classes via the package class selector (`course_class_selections` table)
2. Auto-enrollments tagged `package_auto` in `lesson_bookings`

When someone with a package ticket books individual lessons through the normal lesson flow (e.g. picking Salsa #1 and Bachata #1 from the calendar), those bookings are tagged `existing`, not `package_auto`, and they are **never matched to a class**. So they don't appear under Salsa, Bachata, or the totals — even though they did book and will check in there.

That's exactly what's happening on the screen you shared: Salsa shows "2 anmälda" (Fidan + Gejoe, who used the selector) while a third member who booked Salsa + Bachata lessons directly is invisible.

## The fix

In `src/pages/Biljetter.tsx` → `loadPackageClassesAttendance`, treat every `lesson_bookings` row (regardless of `ticket_type`) as an enrollment for the class that owns its lesson:

1. Stop filtering `lessonBookingsData` down to just `package_auto`. Group **all** lesson_bookings by `class_id` (via the lesson → class mapping you already load).
2. For each class, the member list = union of:
   - `course_class_selections` for that class
   - distinct `member_id`s from any lesson_booking whose lesson belongs to that class
3. Keep the existing flags:
   - `hasCheckedIn` = true when any of that member's lesson_bookings in the class has `checkins_used > 0` (or they were auto-enrolled)
   - `isAutoEnrolled` stays driven by `package_auto` bookings only
4. Recompute the per-class counts and the overall totals from this combined set. Profile fields come from the `profiles` join already present on lesson_bookings.

No DB migration is needed. No change to purchase or pricing logic. Just a corrected read in this one function.

## About the price change

Toggling the price up and back down has no effect on past purchases — tickets store their own `total_tickets` and `expires_at` at purchase time and aren't recalculated from the current course price. You can rule that out.

## Out of scope

- No changes to the purchase flow, Stripe, or `tickets` data.
- No changes to the regular (non-package) course attendance view.
- No changes to how check-ins are recorded.
