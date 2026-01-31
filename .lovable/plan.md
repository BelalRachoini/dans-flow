

## Plan: Fix Course Duplication 404 Error

### Problem Identified
When duplicating a course, the code navigates to `/course/${newCourseId}` (line 415), but this route doesn't exist. The correct route is `/kurser-poang/:id` as defined in `App.tsx` and used elsewhere in the codebase.

The 404 error triggers the `NotFound` page, and when the `RoleGuard` component can't find a valid route context, it may trigger a logout due to authentication state handling.

### Root Cause
**File:** `src/pages/Courses.tsx` **Line 415**

```typescript
// INCORRECT - This route doesn't exist
navigate(`/course/${newCourseId}`);
```

### Solution
Change the navigation path to use the correct route:

```typescript
// CORRECT - Matches the defined route in App.tsx
navigate(`/kurser-poang/${newCourseId}`);
```

### Technical Details

| Item | Details |
|------|---------|
| File | `src/pages/Courses.tsx` |
| Line | 415 |
| Change | `/course/` → `/kurser-poang/` |

### Evidence
- **App.tsx line 75**: Route is defined as `/kurser-poang/:id`
- **Courses.tsx line 877**: Course card click uses correct path `/kurser-poang/${course.id}`
- **Console log**: Shows 404 error for `/course/...` route

### After Fix
After duplicating a course, you'll be correctly redirected to the course detail page at `/kurser-poang/{new-course-id}` where you can edit the duplicated course.

