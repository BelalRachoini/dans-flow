

# Fix: Admin Delete Should Remove Auth User Too

## Problem
The `admin_delete_member` database function only deletes the `profiles` row. The user record in `auth.users` remains, so:
- Signup with the same email fails ("already registered")
- The orphaned auth record stays forever

## Solution
Replace the database function approach with an **edge function** that uses the Supabase Admin API to delete the auth user (which cascades to profiles and user_roles).

### Changes

1. **Create edge function `supabase/functions/admin-delete-member/index.ts`**
   - Verify caller is admin (same pattern as `admin-create-member`)
   - Call `adminClient.auth.admin.deleteUser(targetUserId)` to remove the auth user
   - The `ON DELETE CASCADE` on `profiles.id` will automatically clean up profiles, user_roles, tickets, etc.

2. **Update `src/components/MemberDetailDrawer.tsx`**
   - Change from `supabase.rpc('admin_delete_member', ...)` to calling the new edge function via `supabase.functions.invoke('admin-delete-member', { body: { user_id: targetUserId } })`

### Technical Detail
The key difference: `supabase.auth.admin.deleteUser()` (service role) removes the user from `auth.users`, which cascades to all related tables. The current SQL function can only delete from `public` schema tables — it cannot touch `auth.users`.

