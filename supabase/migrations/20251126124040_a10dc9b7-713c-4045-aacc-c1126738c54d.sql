-- Allow anyone to view basic profile info for instructors
-- This is needed so course pages can display instructor names
CREATE POLICY "Anyone can view instructor basic info" 
ON profiles FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM user_roles 
    WHERE user_roles.user_id = profiles.id 
    AND user_roles.role = 'instructor'
  )
);