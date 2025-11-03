-- Add missing columns to courses table
ALTER TABLE courses 
ADD COLUMN IF NOT EXISTS level TEXT NOT NULL DEFAULT 'beginner',
ADD COLUMN IF NOT EXISTS price_cents INTEGER NOT NULL DEFAULT 0,
ADD COLUMN IF NOT EXISTS points INTEGER NOT NULL DEFAULT 0,
ADD COLUMN IF NOT EXISTS capacity INTEGER NOT NULL DEFAULT 20,
ADD COLUMN IF NOT EXISTS primary_instructor UUID REFERENCES profiles(id),
ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'published',
ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES profiles(id),
ADD COLUMN IF NOT EXISTS image_url TEXT;

-- Add check constraint for level
ALTER TABLE courses 
ADD CONSTRAINT courses_level_check 
CHECK (level IN ('beginner', 'intermediate', 'advanced'));

-- Add check constraint for status
ALTER TABLE courses 
ADD CONSTRAINT courses_status_check 
CHECK (status IN ('draft', 'published', 'archived'));