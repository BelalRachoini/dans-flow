-- Drop the old check constraint
ALTER TABLE event_bookings DROP CONSTRAINT event_bookings_status_check;

-- Add updated check constraint that includes 'checked_in'
ALTER TABLE event_bookings ADD CONSTRAINT event_bookings_status_check 
CHECK (status IN ('confirmed', 'cancelled', 'checked_in'));