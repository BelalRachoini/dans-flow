

# Fix: Instructors Can't See Course Attendees or Event Attendees

## Root Cause

There are **RLS (Row-Level Security) policy gaps** and **missing UI** preventing instructors from seeing their data:

### Problem 1: Tickets RLS blocks co-instructors
The `tickets` table RLS policy for instructors only checks `courses.instructor_id = auth.uid()`. Instructors linked via the `course_instructors` junction table (co-instructors) get no results.

### Problem 2: Profiles RLS blocks co-instructors
Same issue -- the instructor SELECT policy on `profiles` only checks direct `courses.instructor_id`, not the `course_instructors` table.

### Problem 3: Event attendees -- no actual list
`InstructorEventAttendees` only shows summary stats (sold/capacity). It says "detailed list available via admin" but instructors need to see attendee names to manage attendance. Instructors already have RLS access to `event_bookings`.

## Plan

### 1. Fix Tickets RLS for co-instructors (database migration)
Add a new SELECT policy on `tickets` that also checks `course_instructors`:
```sql
CREATE POLICY "Co-instructors can view tickets for their courses"
ON public.tickets FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM course_instructors ci
    WHERE ci.course_id = tickets.course_id
    AND ci.instructor_id = auth.uid()
  )
);
```

### 2. Fix Profiles RLS for co-instructors (database migration)
Add a new SELECT policy on `profiles` to cover co-instructor access:
```sql
CREATE POLICY "Co-instructors can view student profiles"
ON public.profiles FOR SELECT
USING (
  has_role(auth.uid(), 'instructor') AND
  EXISTS (
    SELECT 1 FROM tickets t
    JOIN course_instructors ci ON ci.course_id = t.course_id
    WHERE t.member_id = profiles.id
    AND ci.instructor_id = auth.uid()
  )
);
```

### 3. Enhance Event Attendees component (`InstructorEventAttendees.tsx`)
- When an event is selected, fetch `event_bookings` joined with `profiles` (via `member_id`) to show actual attendee names, ticket counts, and check-in status
- Replace the "available via admin" message with a real attendee table
- Show: name, ticket count, check-in status

### Files Changed
- **Database**: 2 new RLS policies (tickets + profiles)
- **`src/components/InstructorEventAttendees.tsx`**: Add attendee list with names and check-in status

