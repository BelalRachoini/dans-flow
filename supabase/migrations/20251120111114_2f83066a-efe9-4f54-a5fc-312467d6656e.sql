-- Create course_page_sections table
CREATE TABLE course_page_sections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  course_id UUID NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  section_type TEXT NOT NULL,
  title TEXT,
  content JSONB NOT NULL DEFAULT '{}'::jsonb,
  position INTEGER NOT NULL DEFAULT 0,
  is_visible BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create indexes for efficient querying
CREATE INDEX idx_course_page_sections_course_id ON course_page_sections(course_id);
CREATE INDEX idx_course_page_sections_position ON course_page_sections(position);

-- Enable RLS
ALTER TABLE course_page_sections ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Anyone can view sections for published courses"
  ON course_page_sections
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM courses 
      WHERE courses.id = course_page_sections.course_id 
      AND courses.status = 'published'
    )
  );

CREATE POLICY "Admins can manage all sections"
  ON course_page_sections
  FOR ALL
  USING (is_admin())
  WITH CHECK (is_admin());

-- Function to auto-create default sections for new courses
CREATE OR REPLACE FUNCTION create_default_course_sections()
RETURNS TRIGGER AS $$
BEGIN
  -- Create hero section
  INSERT INTO course_page_sections (course_id, section_type, title, content, position)
  VALUES (NEW.id, 'hero', NULL, '{}'::jsonb, 0);
  
  -- Create description text section
  INSERT INTO course_page_sections (course_id, section_type, title, content, position)
  VALUES (NEW.id, 'text', 'About This Course', jsonb_build_object('text', COALESCE(NEW.description, ''), 'alignment', 'left', 'fontSize', 'medium'), 1);
  
  -- Create booking section
  INSERT INTO course_page_sections (course_id, section_type, title, content, position)
  VALUES (NEW.id, 'booking', 'Enrollment', '{}'::jsonb, 2);
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to create default sections for new courses
CREATE TRIGGER trigger_create_default_course_sections
  AFTER INSERT ON courses
  FOR EACH ROW
  EXECUTE FUNCTION create_default_course_sections();

-- Create default sections for existing courses
INSERT INTO course_page_sections (course_id, section_type, title, content, position)
SELECT 
  c.id,
  'hero',
  NULL,
  '{}'::jsonb,
  0
FROM courses c
WHERE NOT EXISTS (
  SELECT 1 FROM course_page_sections WHERE course_id = c.id
);

INSERT INTO course_page_sections (course_id, section_type, title, content, position)
SELECT 
  c.id,
  'text',
  'About This Course',
  jsonb_build_object('text', COALESCE(c.description, ''), 'alignment', 'left', 'fontSize', 'medium'),
  1
FROM courses c
WHERE NOT EXISTS (
  SELECT 1 FROM course_page_sections WHERE course_id = c.id AND position = 1
);

INSERT INTO course_page_sections (course_id, section_type, title, content, position)
SELECT 
  c.id,
  'booking',
  'Enrollment',
  '{}'::jsonb,
  2
FROM courses c
WHERE NOT EXISTS (
  SELECT 1 FROM course_page_sections WHERE course_id = c.id AND position = 2
);