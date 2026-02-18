

## Plan: Fix Optional Level Field in Course Creation

### Problem

The `courses` table has the column `level text NOT NULL DEFAULT 'beginner'`. When no level is selected in the form, the value sent is `undefined`, which overrides the database default and attempts to insert `NULL` -- violating the `NOT NULL` constraint and causing the "kunde inte spara kursen" error.

### Solution

In `src/pages/Courses.tsx`, when building the `courseData` object, omit the `level` field entirely when it is `undefined`/`null` so the database default (`'beginner'`) takes effect. Alternatively, explicitly fall back to `'beginner'`.

### File Changes

| File | Change |
|------|--------|
| `src/pages/Courses.tsx` | On line 231, change `level: data.level` to `level: data.level || 'beginner'` so a missing level falls back to the default instead of sending `null` |

This is a one-line fix. When a user selects "Ingen niva angiven" (None), the form sets level to `undefined`. By falling back to `'beginner'`, the insert will always have a valid value, matching the database constraint.
