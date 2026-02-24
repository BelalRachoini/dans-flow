

## Plan: Add Attendee Views to Instructor Dashboard

### Goal

Give instructors the ability to see who is enrolled/attending their courses and upcoming events, directly from the instructor dashboard.

### Current State

The instructor dashboard currently shows:
- Today's classes (courses where they are the instructor)
- Today's check-in list (scanned attendees only)
- Navigation links to calendar and events

It does **not** show a list of enrolled members for their courses or event attendees.

### Solution

Add a new "Deltagare" (Attendees) section to the Instructor Dashboard with two tabs: **Kurser** (Courses) and **Event**. This mirrors the admin attendance view but is scoped to only the instructor's own courses.

### Changes

| File | Change |
|------|--------|
| `src/pages/InstructorDashboard.tsx` | Add attendee section with course/event selector and member list |

### Implementation Details

1. **Course Attendees Tab**:
   - Dropdown to select from instructor's courses (fetched via `courses.instructor_id = userId` or `course_instructors` table)
   - Show enrolled members with name, dance role, and check-in status
   - Display stats: total attendees, leaders, followers, checked in

2. **Event Attendees Tab**:
   - Dropdown to select from upcoming events (all published events, since events don't have an `instructor_id`)
   - Show confirmed bookings with attendee name and check-in status

3. **RLS compatibility**: The instructor already has SELECT access to:
   - `tickets` for their courses (via `courses.instructor_id`)
   - `checkins` for their courses
   - `profiles` of students in their courses
   - `event_bookings` are admin-only for reading all, so event attendees will need to be limited or accessed differently

4. **Event limitation**: Since `event_bookings` RLS only allows admins to read all bookings, the event attendee list will show event details (capacity, sold count) rather than individual attendees, unless we note this limitation. Alternatively, the instructor can see events they navigate to but not the full booking list.

### UI Layout

The new section replaces the current "Navigation" card at the bottom with a more useful "Deltagare" card:

- Tab 1: **Mina kurser** - Select a course, see enrolled members table
- Tab 2: **Event** - Select an event, see booking summary (capacity/sold)

The existing navigation links (Kalender, Event) remain accessible via the sidebar.

