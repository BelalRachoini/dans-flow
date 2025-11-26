-- Drop the existing check constraint
ALTER TABLE tickets DROP CONSTRAINT tickets_status_check;

-- Add updated check constraint with 'used' status
ALTER TABLE tickets ADD CONSTRAINT tickets_status_check 
  CHECK (status IN ('valid', 'used', 'checked_in', 'cancelled', 'refunded'));