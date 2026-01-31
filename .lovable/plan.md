
## Plan: Fix Course Duplication Double Content Issue

### Problem Identified
When duplicating a course, content sections are being doubled because:

1. **Database Trigger**: There's a trigger `trigger_create_default_course_sections` that automatically creates 3 default sections (hero, text, booking) whenever a new course is inserted
2. **Manual Copy**: The duplication code in `Courses.tsx` (lines 387-408) also manually copies all sections from the original course

Result: The new duplicated course gets **both** the trigger-created sections AND the copied sections, doubling the content.

### Solution
Modify the duplication logic to **delete the auto-created sections first** before copying the original course's sections. This ensures only the original sections are present.

### Changes Required

**File: `src/pages/Courses.tsx`**

**Location: After creating the new course (around line 369), before copying instructors**

Add this code block to delete the auto-generated sections:

```typescript
// Delete auto-generated sections (trigger creates defaults we don't want)
await supabase
  .from('course_page_sections')
  .delete()
  .eq('course_id', newCourseId);
```

### Technical Details

| Step | What Happens |
|------|--------------|
| 1. New course is created | Database trigger auto-creates 3 default sections |
| 2. Delete auto-created sections | Remove the trigger-generated sections |
| 3. Copy original sections | Copy all sections from the source course |
| Result | Duplicated course has exact copy of original sections |

### Code Change Summary

```typescript
// Line ~369 (after getting newCourseId)
const newCourseId = (newCourse as any).id;

// NEW CODE: Delete auto-generated default sections before copying originals
await supabase
  .from('course_page_sections' as any)
  .delete()
  .eq('course_id', newCourseId);

// Existing code: Duplicate course instructors
if (course.instructors && course.instructors.length > 0) {
  ...
```

### Why This Approach
- **Minimal change**: Only adds 4 lines of code
- **No database changes needed**: Keeps the trigger for normal course creation (which is still useful)
- **Clean solution**: The trigger behavior is correct for new courses; we just need to handle duplication differently
