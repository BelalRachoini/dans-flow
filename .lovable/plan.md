

## Plan: Show "View Attendance" Button for Instructors on Events Page

### What Changes

On the Events page, instructors currently see the "Köp biljett" (Buy Ticket) button like regular members. Instead, instructors should see a "View Attendees" button (same as admins) so they can see who is coming to each event.

### Changes Required

**1. Database: Add RLS policy for instructors to read event bookings**

Currently, only admins can read all event bookings. A new RLS policy will be added so instructors can also view event bookings.

```sql
CREATE POLICY "Instructors can view all event bookings"
ON public.event_bookings
FOR SELECT
TO authenticated
USING (has_role(auth.uid(), 'instructor'));
```

**2. Update Events page card footer** (`src/pages/Events.tsx`)

Change the condition from `isAdmin` to `isAdmin || isInstructor` for showing the attendees button. Instructors will see:
- "View Attendees" button (same as admin)
- No edit, duplicate, or delete buttons (those stay admin-only)

The card footer logic changes from:
- Admin: View Attendees + Edit + Copy + Delete
- Everyone else: Buy Ticket

To:
- Admin: View Attendees + Edit + Copy + Delete
- Instructor: View Attendees only
- Member: Buy Ticket

### Technical Details

| File | Change |
|------|--------|
| Database migration | Add SELECT policy on `event_bookings` for instructors |
| `src/pages/Events.tsx` | Add `isInstructor` check, update CardFooter to show attendees button for instructors |

