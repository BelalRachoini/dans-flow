ALTER TABLE public.event_bookings DROP CONSTRAINT IF EXISTS event_bookings_event_id_member_id_key;
ALTER TABLE public.event_bookings ADD COLUMN IF NOT EXISTS payment_reference text;
CREATE INDEX IF NOT EXISTS idx_event_bookings_payment_reference ON public.event_bookings(payment_reference);