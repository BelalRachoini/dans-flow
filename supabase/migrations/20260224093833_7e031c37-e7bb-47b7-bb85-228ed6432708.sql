CREATE POLICY "Instructors can view all event bookings"
ON public.event_bookings
FOR SELECT
TO authenticated
USING (has_role(auth.uid(), 'instructor'::app_role));