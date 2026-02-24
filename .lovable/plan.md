
## Plan: Hide Prenumerationer and Betalningar from Instructor Sidebar

### Problem

The sidebar navigation in `Layout.tsx` shows "Prenumerationer" and "Betalningar" links to instructors. These are admin-only features that instructors should not access.

### Solution

Remove `'INSTRUKTOR'` from the `roles` array for both menu items so only admins see them.

### File Changes

| File | Change |
|------|--------|
| `src/components/Layout.tsx` | Line 90: Change `roles: ['ADMIN', 'INSTRUKTOR']` to `roles: ['ADMIN']` for Prenumerationer |
| `src/components/Layout.tsx` | Line 91: Change `roles: ['ADMIN', 'INSTRUKTOR']` to `roles: ['ADMIN']` for Betalningar |

This is a two-line change that restricts visibility of these nav items to admin users only.
