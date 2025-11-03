-- Make starts_at nullable for courses since they can be created as drafts
ALTER TABLE courses 
ALTER COLUMN starts_at DROP NOT NULL;