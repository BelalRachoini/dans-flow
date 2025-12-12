-- Drop the existing overly permissive policy
DROP POLICY IF EXISTS "Anyone can view courses" ON courses;

-- Create a new policy that filters by status for non-admins
CREATE POLICY "Anyone can view published courses"
ON courses FOR SELECT
USING (status = 'published' OR is_admin());