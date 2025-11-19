-- Create enum type for dance roles
CREATE TYPE dance_role_type AS ENUM ('follower', 'leader');

-- Add dance_role column to profiles (nullable for existing users)
ALTER TABLE profiles 
ADD COLUMN dance_role dance_role_type;

-- Add comment for documentation
COMMENT ON COLUMN profiles.dance_role IS 'User preferred dance role: follower or leader';