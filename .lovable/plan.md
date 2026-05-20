## Issue

In `src/pages/Biljetter.tsx`, three filters are incomplete and still show items past their date:

1. **Klippkort packages (`validPackages`, line 975)** — only checks `status === 'valid'` and `tickets_used < total_tickets`. Does NOT check `expires_at`. An expired klippkort still counts toward "Tillgängliga Klipp" and shows in the "Utgår snart" list.
2. **`historyPackages` (line 1024)** — mirror problem: expired-but-valid-status packages never reach history.
3. **`packageAutoBookings` (line 997, "Mina valda klasser")** — no date filter. Past courses (like the "Semester Courses 26/Jan - 5/March" in your screenshot) keep showing as active.

Events and individual lesson bookings are already filtered correctly — past ones move to "Tidigare evenemang" / "Biljetthistorik" via the existing date checks (lines 998–1004 and 1019–1021).

## Fix

In `src/pages/Biljetter.tsx`:

- `validPackages` → also require `new Date(expires_at).getTime() > Date.now()`. This automatically updates `totalAvailableTickets` and the "Utgår snart" list.
- `historyPackages` → also include `new Date(expires_at).getTime() <= Date.now()`. Already-rendered history card (line 2062) checks `isExpired` for the label, so the UI handles it.
- `packageAutoBookings` → split into `validPackageAutoBookings` (course end_at in future, with a 1-day grace) and `pastPackageAutoBookings` (in past), reusing the existing `_isLessonInFuture` helper applied per-lesson, OR using the parent course's `ends_at` if available. Render past ones inside the "Biljetthistorik" section.

No backend, RLS, or schema changes. No edge function changes. Purely client-side filtering.

## Question

For **"Mina valda klasser"** (recurring class enrollments from course packages): should the whole course block disappear from the active section once the course's end date has passed, OR should individual past lessons inside an active course just be hidden while the course is still ongoing?

- **A — Whole course to history when course ends** (simplest, matches your screenshot: "26/Jan – 5/March" course is fully past, hide it from active).
- **B — Per-lesson filter inside an ongoing course** (hide individual past lessons but keep the course block if any lesson remains in the future).

If you want both (B for ongoing, A for fully-past), say so and I'll combine them.

## Verification

1. A klippkort with `expires_at` in the past → no longer counted in "Tillgängliga Klipp", no longer in "Utgår snart", appears in "Biljetthistorik" labeled as expired.
2. A klippkort with future `expires_at` and unused tickets → still active, unchanged.
3. A past course in "Mina valda klasser" → moves to history (per the answer above).
4. Past event tickets continue working as before (already filtered).
