

## Plan: Hide Medlemmar from Instructor Sidebar

### Problem

The sidebar navigation still shows "Medlemmar" to instructors. This should be an admin-only feature.

### Solution

Remove `'INSTRUKTOR'` from the `roles` array for the Medlemmar nav item in `src/components/Layout.tsx`.

### File Changes

| File | Change |
|------|--------|
| `src/components/Layout.tsx` | Line 89: Change `roles: ['ADMIN', 'INSTRUKTOR']` to `roles: ['ADMIN']` for Medlemmar |

Single-line change restricting the members page to admin users only.

