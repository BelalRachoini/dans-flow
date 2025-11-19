-- Drop the FK pointing to auth.users (wrong schema)
ALTER TABLE user_roles
DROP CONSTRAINT IF EXISTS user_roles_user_id_fkey;

-- Add FK to profiles.id (correct - same schema)
ALTER TABLE user_roles
ADD CONSTRAINT user_roles_user_id_fkey
FOREIGN KEY (user_id)
REFERENCES profiles(id)
ON DELETE CASCADE;

-- Add performance index
CREATE INDEX IF NOT EXISTS idx_user_roles_user_id 
ON user_roles(user_id);