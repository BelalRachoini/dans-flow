

## Plan: Fix Blank Page When Admin Deletes a Course with Existing Tickets

### Root Cause

The `tickets` table has two foreign keys to `courses`:
- `course_id` -> `ON DELETE CASCADE` (tickets get deleted when course is deleted)
- `source_course_id` -> **NO delete rule** (default is RESTRICT, which either blocks the delete or leaves orphaned data)

When an admin deletes a course, the cascade on `course_id` deletes the ticket rows. But if `source_course_id` also references the same course, the RESTRICT rule on that FK will **block the deletion entirely** or cause inconsistent state. If the deletion somehow succeeds (e.g., course_id differs from source_course_id), the Biljetter page query `courses!tickets_source_course_id_fkey(...)` tries to join on a deleted course and the page crashes.

Additionally, `course_lessons` cascade-deletes with the course, and `lesson_bookings` cascade-deletes with `course_lessons` -- so members lose their booked lessons too.

### Solution

1. **Change the FK rule** on `tickets.source_course_id` to `ON DELETE SET NULL` instead of RESTRICT. This way, when a course is deleted, the ticket survives but `source_course_id` becomes NULL (the ticket remains usable as a flexible ticket package).

2. **Also change** `tickets.course_id` FK from `ON DELETE CASCADE` to `ON DELETE SET NULL`. Deleting a course should NOT destroy members' purchased tickets -- they paid for those tickets and should keep them.

3. **Add defensive null handling** in `Biljetter.tsx` so tickets with null course references render gracefully (e.g., showing "Flexibelt klippkort" instead of a course name).

### File Changes

| File | Change |
|------|--------|
| New SQL migration | Alter FK constraints: `source_course_id` and `course_id` both become `ON DELETE SET NULL` |
| `src/pages/Biljetter.tsx` | Add null-safe access for `courses` join data throughout the member ticket rendering |

### Technical Details

**Migration SQL:**
```sql
ALTER TABLE tickets DROP CONSTRAINT tickets_course_id_fkey;
ALTER TABLE tickets ADD CONSTRAINT tickets_course_id_fkey 
  FOREIGN KEY (course_id) REFERENCES courses(id) ON DELETE SET NULL;

ALTER TABLE tickets DROP CONSTRAINT tickets_source_course_id_fkey;
ALTER TABLE tickets ADD CONSTRAINT tickets_source_course_id_fkey 
  FOREIGN KEY (source_course_id) REFERENCES courses(id) ON DELETE SET NULL;
```

**Biljetter.tsx changes:**
- Where ticket course data is displayed, use optional chaining and fallback labels (e.g., `ticket.courses?.title || 'Flexibelt klippkort'`)
- The existing `try/catch` in `loadTickets` already handles query errors, but the rendering code needs to handle null `courses` objects gracefully to prevent React crashes

