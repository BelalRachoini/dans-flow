-- Add end_at column to event_dates table
ALTER TABLE event_dates 
ADD COLUMN end_at TIMESTAMP WITH TIME ZONE;