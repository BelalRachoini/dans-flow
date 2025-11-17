-- Create event_page_sections table
CREATE TABLE event_page_sections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  section_type TEXT NOT NULL,
  title TEXT,
  content JSONB NOT NULL,
  position INTEGER NOT NULL DEFAULT 0,
  is_visible BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS
ALTER TABLE event_page_sections ENABLE ROW LEVEL SECURITY;

-- Everyone can view sections for published events
CREATE POLICY "Anyone can view sections for published events"
ON event_page_sections FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM events 
    WHERE events.id = event_page_sections.event_id 
    AND events.status = 'published'
  )
);

-- Admins can manage all sections
CREATE POLICY "Admins can manage all sections"
ON event_page_sections FOR ALL
USING (is_admin())
WITH CHECK (is_admin());

-- Create indexes
CREATE INDEX idx_event_sections_event_id ON event_page_sections(event_id);
CREATE INDEX idx_event_sections_position ON event_page_sections(event_id, position);

-- Add trigger for updated_at
CREATE TRIGGER update_event_sections_updated_at
BEFORE UPDATE ON event_page_sections
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();