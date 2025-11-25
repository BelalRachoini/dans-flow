-- Create course_instructors junction table for many-to-many relationship
CREATE TABLE public.course_instructors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  course_id UUID NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
  instructor_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  is_primary BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(course_id, instructor_id)
);

-- Enable RLS
ALTER TABLE public.course_instructors ENABLE ROW LEVEL SECURITY;

-- RLS policies: Anyone can view, admins can manage
CREATE POLICY "Anyone can view course instructors" ON public.course_instructors
  FOR SELECT USING (true);

CREATE POLICY "Admins can manage course instructors" ON public.course_instructors
  FOR ALL USING (is_admin()) WITH CHECK (is_admin());