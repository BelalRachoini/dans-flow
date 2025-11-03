-- Add preferred_locale column to profiles table
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS preferred_locale TEXT 
CHECK (preferred_locale IN ('sv', 'en', 'es')) 
DEFAULT 'sv';

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_profiles_preferred_locale 
ON public.profiles(preferred_locale);

-- Update RLS policy to allow users to update their own preferred_locale
CREATE POLICY "Users can update own preferred_locale" 
ON public.profiles 
FOR UPDATE 
USING (auth.uid() = id)
WITH CHECK (auth.uid() = id);