-- Remove direct INSERT permission for members on event_bookings
-- All event bookings should be created via verify-event-payment edge function
DROP POLICY IF EXISTS "event_bookings_member_insert_own" ON public.event_bookings;