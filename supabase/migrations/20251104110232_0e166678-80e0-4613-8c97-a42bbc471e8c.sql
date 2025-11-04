-- Add qr_payload to event_bookings for QR code scanning
ALTER TABLE public.event_bookings 
ADD COLUMN IF NOT EXISTS qr_payload TEXT UNIQUE DEFAULT gen_random_uuid()::text;

-- Create index for faster QR lookups
CREATE INDEX IF NOT EXISTS idx_event_bookings_qr_payload ON public.event_bookings(qr_payload);