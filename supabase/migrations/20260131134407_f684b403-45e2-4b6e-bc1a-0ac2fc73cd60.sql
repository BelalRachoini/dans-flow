-- Add course_type column to courses table
ALTER TABLE public.courses 
ADD COLUMN course_type text NOT NULL DEFAULT 'regular';

-- Update existing courses: set course_type based on is_package
UPDATE public.courses 
SET course_type = CASE WHEN is_package = true THEN 'package' ELSE 'regular' END;

-- Create course_bundle_tiers table
CREATE TABLE public.course_bundle_tiers (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  course_id uuid NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
  name text NOT NULL,
  price_cents integer NOT NULL DEFAULT 0,
  max_selections integer NOT NULL DEFAULT 1,
  position integer NOT NULL DEFAULT 0,
  class_filter_mode text NOT NULL DEFAULT 'all',
  is_popular boolean NOT NULL DEFAULT false,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Create course_bundle_tier_classes table (for tier-specific class filtering)
CREATE TABLE public.course_bundle_tier_classes (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tier_id uuid NOT NULL REFERENCES public.course_bundle_tiers(id) ON DELETE CASCADE,
  class_id uuid NOT NULL REFERENCES public.course_classes(id) ON DELETE CASCADE,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE(tier_id, class_id)
);

-- Enable RLS on new tables
ALTER TABLE public.course_bundle_tiers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.course_bundle_tier_classes ENABLE ROW LEVEL SECURITY;

-- RLS policies for course_bundle_tiers
CREATE POLICY "Anyone can view bundle tiers" 
ON public.course_bundle_tiers 
FOR SELECT 
USING (true);

CREATE POLICY "Admins can manage bundle tiers" 
ON public.course_bundle_tiers 
FOR ALL 
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles 
    WHERE user_id = auth.uid() AND role = 'admin'
  )
);

-- RLS policies for course_bundle_tier_classes
CREATE POLICY "Anyone can view tier classes" 
ON public.course_bundle_tier_classes 
FOR SELECT 
USING (true);

CREATE POLICY "Admins can manage tier classes" 
ON public.course_bundle_tier_classes 
FOR ALL 
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles 
    WHERE user_id = auth.uid() AND role = 'admin'
  )
);