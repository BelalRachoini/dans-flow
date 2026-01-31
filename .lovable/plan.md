

## Plan: Make Testing@test.com an Admin User

### User Found
- **Email**: testing@test.com
- **Name**: Test
- **User ID**: `69ad0f04-8ec9-463d-8683-b838593d3a0c`
- **Current Role**: member

### Database Change Required

Run this SQL migration to add the admin role:

```sql
-- Add admin role for Testing@test.com
INSERT INTO public.user_roles (user_id, role)
VALUES ('69ad0f04-8ec9-463d-8683-b838593d3a0c', 'admin')
ON CONFLICT (user_id, role) DO NOTHING;

-- Also update profiles table to reflect admin role
UPDATE public.profiles 
SET role = 'admin'
WHERE id = '69ad0f04-8ec9-463d-8683-b838593d3a0c';
```

### What This Does
1. Adds an `admin` entry to the `user_roles` table for this user
2. Updates the `profiles` table role field to `admin` for consistency
3. Uses `ON CONFLICT DO NOTHING` to prevent errors if the role already exists

### After Implementation
The user will need to **log out and log back in** for the new admin role to take effect in their session.

