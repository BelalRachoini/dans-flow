-- Add tiered pricing columns to events table
ALTER TABLE public.events 
ADD COLUMN IF NOT EXISTS couple_price_cents INTEGER,
ADD COLUMN IF NOT EXISTS trio_price_cents INTEGER;

-- Add multi-ticket booking columns to event_bookings table
ALTER TABLE public.event_bookings
ADD COLUMN IF NOT EXISTS ticket_count INTEGER NOT NULL DEFAULT 1,
ADD COLUMN IF NOT EXISTS checkins_allowed INTEGER NOT NULL DEFAULT 1,
ADD COLUMN IF NOT EXISTS checkins_used INTEGER NOT NULL DEFAULT 0,
ADD COLUMN IF NOT EXISTS attendee_names JSONB DEFAULT '[]'::jsonb;

-- Add comment for clarity
COMMENT ON COLUMN public.events.couple_price_cents IS 'Price for 2 tickets (null = double base price)';
COMMENT ON COLUMN public.events.trio_price_cents IS 'Price for 3 tickets (null = triple base price)';
COMMENT ON COLUMN public.event_bookings.attendee_names IS 'JSON array of attendee names for group bookings';