-- Fix is_admin() function to avoid infinite recursion
-- Query user_roles table instead of profiles table
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1 
    FROM public.user_roles
    WHERE user_id = auth.uid() 
    AND role = 'admin'::app_role
  );
$$;