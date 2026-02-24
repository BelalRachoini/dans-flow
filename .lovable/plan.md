

## Code Review: Instructor Dashboard - Issues Found

### Issue 1: Attendance query will likely fail (CRITICAL)

**File**: `src/pages/InstructorDashboard.tsx` (lines 44-60)

The attendance query uses `.in('tickets.course_id', courseIds)` to filter checkins by course. However, Supabase PostgREST does **not support filtering on nested/joined table columns** with `.in()`. This filter is silently ignored, meaning the query either returns no results or returns unrelated checkins.

**Fix**: Restructure the query. Instead of filtering checkins by a joined tickets column, query tickets first by course_id, get ticket IDs, then query checkins by those ticket IDs.

---

### Issue 2: Today's courses query misses `course_instructors` link table

**File**: `src/pages/InstructorDashboard.tsx` (lines 30-36)

The "Today's classes" query only checks `courses.instructor_id = userId`. But in `InstructorCourseAttendees.tsx`, courses are also fetched via the `course_instructors` join table. This means an instructor linked through `course_instructors` (but not as `instructor_id`) won't see their today's classes or attendance.

**Fix**: Also check `course_instructors` for today's courses, same pattern as `InstructorCourseAttendees.fetchCourses`.

---

### Issue 3: Division by zero in Event progress bar

**File**: `src/components/InstructorEventAttendees.tsx` (line 73)

If `selectedEvent.capacity` is `0`, the expression `(selectedEvent.sold_count / selectedEvent.capacity) * 100` will produce `Infinity` or `NaN`.

**Fix**: Add a guard: `capacity > 0 ? (sold_count / capacity) * 100 : 0`.

---

### Issue 4: Attendees not cleared when switching courses

**File**: `src/components/InstructorCourseAttendees.tsx` (lines 22-26)

When the user selects a different course, the old attendees remain visible until the new data loads. The stats also show stale data during loading.

**Fix**: Clear attendees at the start of `fetchAttendees` or when `selectedCourseId` changes.

---

### Issue 5: Unused imports

**File**: `src/components/InstructorCourseAttendees.tsx` (line 6)

`Users` is imported from lucide-react but never used in the component.

---

### Summary of Changes

| File | Issue | Severity |
|------|-------|----------|
| `src/pages/InstructorDashboard.tsx` | Attendance query uses unsupported nested `.in()` filter | Critical |
| `src/pages/InstructorDashboard.tsx` | Today's courses misses `course_instructors` table | Medium |
| `src/components/InstructorEventAttendees.tsx` | Division by zero on capacity=0 | Low |
| `src/components/InstructorCourseAttendees.tsx` | Stale attendees shown during course switch | Low |
| `src/components/InstructorCourseAttendees.tsx` | Unused `Users` import | Trivial |

### Technical Implementation

1. **Fix attendance query** - Split into two queries: first get ticket IDs for today's courses, then get checkins for those ticket IDs with profile joins
2. **Fix today's courses** - Add a second query to `course_instructors` and merge results (same dedup pattern as `InstructorCourseAttendees`)
3. **Fix division by zero** - Add ternary guard before division
4. **Fix stale data** - Add `setAttendees([])` at the top of `fetchAttendees`
5. **Remove unused import** - Remove `Users` from the import

