-- Create lesson_bookings table for drop-in ticket purchases
CREATE TABLE public.lesson_bookings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  member_id UUID NOT NULL,
  lesson_id UUID NOT NULL,
  qr_payload TEXT NOT NULL DEFAULT gen_random_uuid()::TEXT,
  ticket_type TEXT NOT NULL CHECK (ticket_type IN ('single', 'couple', 'existing')),
  checkins_allowed INTEGER NOT NULL DEFAULT 1,
  checkins_used INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'valid' CHECK (status IN ('valid', 'used', 'expired')),
  purchased_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  CONSTRAINT fk_lesson_bookings_member FOREIGN KEY (member_id) REFERENCES public.profiles(id) ON DELETE CASCADE,
  CONSTRAINT fk_lesson_bookings_lesson FOREIGN KEY (lesson_id) REFERENCES public.course_lessons(id) ON DELETE CASCADE
);

-- Enable RLS
ALTER TABLE public.lesson_bookings ENABLE ROW LEVEL SECURITY;

-- Members can view their own bookings
CREATE POLICY "Members can view own lesson bookings"
ON public.lesson_bookings
FOR SELECT
USING (member_id = auth.uid());

-- Admins can view all bookings
CREATE POLICY "Admins can view all lesson bookings"
ON public.lesson_bookings
FOR SELECT
USING (is_admin());

-- Admins can manage all bookings
CREATE POLICY "Admins can manage lesson bookings"
ON public.lesson_bookings
FOR ALL
USING (is_admin())
WITH CHECK (is_admin());

-- Create index for faster QR lookups
CREATE INDEX idx_lesson_bookings_qr_payload ON public.lesson_bookings(qr_payload);
CREATE INDEX idx_lesson_bookings_member_id ON public.lesson_bookings(member_id);
CREATE INDEX idx_lesson_bookings_lesson_id ON public.lesson_bookings(lesson_id);