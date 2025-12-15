-- Add event_date_id column to event_bookings table
ALTER TABLE event_bookings 
ADD COLUMN event_date_id uuid REFERENCES event_dates(id) ON DELETE SET NULL;

-- Add index for better query performance
CREATE INDEX idx_event_bookings_event_date_id ON event_bookings(event_date_id);