-- Fix RLS policies to use has_role() security definer function instead of querying profiles.role
-- This prevents infinite recursion errors

-- ============================================================================
-- COURSES TABLE
-- ============================================================================
DROP POLICY IF EXISTS "Instructors and admins can manage courses" ON public.courses;

CREATE POLICY "Instructors and admins can manage courses"
ON public.courses
FOR ALL
USING (
  has_role(auth.uid(), 'admin'::app_role) OR 
  has_role(auth.uid(), 'instructor'::app_role)
);

-- ============================================================================
-- COURSE_LESSONS TABLE
-- ============================================================================
DROP POLICY IF EXISTS "Instructors and admins can manage course lessons" ON public.course_lessons;

CREATE POLICY "Instructors and admins can manage course lessons"
ON public.course_lessons
FOR ALL
USING (
  has_role(auth.uid(), 'admin'::app_role) OR 
  has_role(auth.uid(), 'instructor'::app_role)
);

-- ============================================================================
-- CHECKINS TABLE
-- ============================================================================
DROP POLICY IF EXISTS "Admins can view all checkins" ON public.checkins;
DROP POLICY IF EXISTS "Instructors and admins can create checkins" ON public.checkins;

CREATE POLICY "Admins can view all checkins"
ON public.checkins
FOR SELECT
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Instructors and admins can create checkins"
ON public.checkins
FOR INSERT
WITH CHECK (
  has_role(auth.uid(), 'admin'::app_role) OR 
  has_role(auth.uid(), 'instructor'::app_role)
);

-- ============================================================================
-- TICKETS TABLE
-- ============================================================================
DROP POLICY IF EXISTS "Admins can view all tickets" ON public.tickets;

CREATE POLICY "Admins can view all tickets"
ON public.tickets
FOR SELECT
USING (has_role(auth.uid(), 'admin'::app_role));