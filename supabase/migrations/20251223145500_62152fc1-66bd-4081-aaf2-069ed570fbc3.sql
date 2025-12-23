-- Add discount columns to courses table (matching events structure)
ALTER TABLE courses 
ADD COLUMN discount_type text NOT NULL DEFAULT 'none',
ADD COLUMN discount_value integer NOT NULL DEFAULT 0;