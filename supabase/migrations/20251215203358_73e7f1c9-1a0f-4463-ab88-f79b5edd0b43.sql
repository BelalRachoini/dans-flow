-- Add package fields to courses table
ALTER TABLE public.courses 
ADD COLUMN is_package boolean NOT NULL DEFAULT false,
ADD COLUMN max_selections integer;

-- Create course_classes table for selectable class groups
CREATE TABLE public.course_classes (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  course_id uuid NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
  name text NOT NULL,
  day_of_week integer NOT NULL CHECK (day_of_week >= 0 AND day_of_week <= 6),
  start_time time NOT NULL,
  end_time time NOT NULL,
  venue text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Add class_id to course_lessons to link lessons to classes
ALTER TABLE public.course_lessons
ADD COLUMN class_id uuid REFERENCES public.course_classes(id) ON DELETE SET NULL;

-- Create course_class_selections table to track customer selections
CREATE TABLE public.course_class_selections (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  member_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  course_id uuid NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
  class_id uuid NOT NULL REFERENCES public.course_classes(id) ON DELETE CASCADE,
  order_id text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE(member_id, class_id)
);

-- Enable RLS
ALTER TABLE public.course_classes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.course_class_selections ENABLE ROW LEVEL SECURITY;

-- RLS for course_classes
CREATE POLICY "Anyone can view course classes"
ON public.course_classes FOR SELECT
USING (true);

CREATE POLICY "Admins can manage course classes"
ON public.course_classes FOR ALL
USING (is_admin())
WITH CHECK (is_admin());

-- RLS for course_class_selections
CREATE POLICY "Members can view own selections"
ON public.course_class_selections FOR SELECT
USING (member_id = auth.uid());

CREATE POLICY "Admins can view all selections"
ON public.course_class_selections FOR SELECT
USING (is_admin());

CREATE POLICY "Admins can manage all selections"
ON public.course_class_selections FOR ALL
USING (is_admin())
WITH CHECK (is_admin());

-- Create index for performance
CREATE INDEX idx_course_classes_course_id ON public.course_classes(course_id);
CREATE INDEX idx_course_lessons_class_id ON public.course_lessons(class_id);
CREATE INDEX idx_course_class_selections_member_id ON public.course_class_selections(member_id);
CREATE INDEX idx_course_class_selections_course_id ON public.course_class_selections(course_id);