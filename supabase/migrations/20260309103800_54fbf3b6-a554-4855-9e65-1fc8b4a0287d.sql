
-- Fix: Co-instructors can view tickets for their assigned courses
CREATE POLICY "Co-instructors can view tickets for their courses"
ON public.tickets FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM course_instructors ci
    WHERE ci.course_id = tickets.course_id
    AND ci.instructor_id = auth.uid()
  )
);

-- Fix: Co-instructors can view student profiles for their assigned courses
CREATE POLICY "Co-instructors can view student profiles"
ON public.profiles FOR SELECT
USING (
  has_role(auth.uid(), 'instructor') AND
  EXISTS (
    SELECT 1 FROM tickets t
    JOIN course_instructors ci ON ci.course_id = t.course_id
    WHERE t.member_id = profiles.id
    AND ci.instructor_id = auth.uid()
  )
);

-- Fix: Co-instructors can view checkins for their courses
CREATE POLICY "Co-instructors can view checkins for their courses"
ON public.checkins FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM tickets t
    JOIN course_instructors ci ON ci.course_id = t.course_id
    WHERE t.id = checkins.ticket_id
    AND ci.instructor_id = auth.uid()
  )
);
