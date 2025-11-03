-- Create enum for user roles
CREATE TYPE public.app_role AS ENUM ('admin', 'instructor', 'member');

-- Create profiles table with role
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT,
  avatar_url TEXT,
  role app_role NOT NULL DEFAULT 'member',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Enable RLS on profiles
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Profiles policies
CREATE POLICY "Users can view all profiles"
  ON public.profiles FOR SELECT
  USING (true);

CREATE POLICY "Users can update own profile"
  ON public.profiles FOR UPDATE
  USING (auth.uid() = id);

-- Create courses table
CREATE TABLE public.courses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  starts_at TIMESTAMPTZ NOT NULL,
  ends_at TIMESTAMPTZ,
  venue TEXT,
  instructor_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  description TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Enable RLS on courses
ALTER TABLE public.courses ENABLE ROW LEVEL SECURITY;

-- Courses policies
CREATE POLICY "Anyone can view courses"
  ON public.courses FOR SELECT
  USING (true);

CREATE POLICY "Instructors and admins can manage courses"
  ON public.courses FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid()
      AND role IN ('instructor', 'admin')
    )
  );

-- Create tickets table
CREATE TABLE public.tickets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  member_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  course_id UUID NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
  purchased_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  status TEXT NOT NULL DEFAULT 'valid' CHECK (status IN ('valid', 'checked_in', 'cancelled', 'refunded')),
  qr_payload TEXT NOT NULL UNIQUE,
  max_checkins INT NOT NULL DEFAULT 1,
  checked_in_count INT NOT NULL DEFAULT 0,
  order_id TEXT,
  CONSTRAINT unique_active_ticket UNIQUE (member_id, course_id, status)
);

-- Create index for faster QR lookups
CREATE INDEX idx_tickets_qr_payload ON public.tickets(qr_payload);
CREATE INDEX idx_tickets_member_id ON public.tickets(member_id);
CREATE INDEX idx_tickets_course_id ON public.tickets(course_id);

-- Enable RLS on tickets
ALTER TABLE public.tickets ENABLE ROW LEVEL SECURITY;

-- Tickets policies
CREATE POLICY "Members can view own tickets"
  ON public.tickets FOR SELECT
  USING (member_id = auth.uid());

CREATE POLICY "Instructors can view tickets for their courses"
  ON public.tickets FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.courses
      WHERE courses.id = tickets.course_id
      AND courses.instructor_id = auth.uid()
    )
  );

CREATE POLICY "Admins can view all tickets"
  ON public.tickets FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid()
      AND role = 'admin'
    )
  );

-- Create checkins table
CREATE TABLE public.checkins (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id UUID NOT NULL REFERENCES public.tickets(id) ON DELETE CASCADE,
  scanned_by UUID NOT NULL REFERENCES public.profiles(id),
  scanned_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  location TEXT,
  device_info TEXT
);

-- Create index for faster checkin lookups
CREATE INDEX idx_checkins_ticket_id ON public.checkins(ticket_id);
CREATE INDEX idx_checkins_scanned_at ON public.checkins(scanned_at DESC);

-- Enable RLS on checkins
ALTER TABLE public.checkins ENABLE ROW LEVEL SECURITY;

-- Checkins policies
CREATE POLICY "Members can view own checkins"
  ON public.checkins FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.tickets
      WHERE tickets.id = checkins.ticket_id
      AND tickets.member_id = auth.uid()
    )
  );

CREATE POLICY "Instructors can view checkins for their courses"
  ON public.checkins FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.tickets
      JOIN public.courses ON courses.id = tickets.course_id
      WHERE tickets.id = checkins.ticket_id
      AND courses.instructor_id = auth.uid()
    )
  );

CREATE POLICY "Admins can view all checkins"
  ON public.checkins FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid()
      AND role = 'admin'
    )
  );

CREATE POLICY "Instructors and admins can create checkins"
  ON public.checkins FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid()
      AND role IN ('instructor', 'admin')
    )
  );

-- Create RPC function for atomic check-in
CREATE OR REPLACE FUNCTION public.check_in_with_qr(
  qr TEXT,
  p_location TEXT DEFAULT NULL,
  p_device_info TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_ticket tickets%ROWTYPE;
  v_course courses%ROWTYPE;
  v_member profiles%ROWTYPE;
  v_checkin_id UUID;
  v_scanned_at TIMESTAMPTZ;
  v_scanner_role app_role;
BEGIN
  -- Get scanner role
  SELECT role INTO v_scanner_role
  FROM profiles
  WHERE id = auth.uid();

  IF v_scanner_role IS NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'UNAUTHORIZED',
      'message', 'Du måste vara inloggad'
    );
  END IF;

  IF v_scanner_role NOT IN ('instructor', 'admin') THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'UNAUTHORIZED',
      'message', 'Endast instruktörer och admins kan skanna biljetter'
    );
  END IF;

  -- Lock and get ticket
  SELECT * INTO v_ticket
  FROM tickets
  WHERE qr_payload = qr
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'INVALID_TICKET',
      'message', 'Ogiltig biljett'
    );
  END IF;

  -- Check if ticket is valid
  IF v_ticket.status != 'valid' THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'INVALID_STATUS',
      'message', 'Biljetten är inte giltig (status: ' || v_ticket.status || ')'
    );
  END IF;

  -- Check if already at max checkins
  IF v_ticket.checked_in_count >= v_ticket.max_checkins THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'ALREADY_CHECKED_IN',
      'message', 'Biljetten är redan incheckad'
    );
  END IF;

  -- Get course info
  SELECT * INTO v_course
  FROM courses
  WHERE id = v_ticket.course_id;

  -- Verify instructor has access (unless admin)
  IF v_scanner_role = 'instructor' AND v_course.instructor_id != auth.uid() THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'UNAUTHORIZED',
      'message', 'Du är inte instruktör för denna kurs'
    );
  END IF;

  -- Get member info
  SELECT * INTO v_member
  FROM profiles
  WHERE id = v_ticket.member_id;

  -- Create checkin
  INSERT INTO checkins (ticket_id, scanned_by, location, device_info)
  VALUES (v_ticket.id, auth.uid(), p_location, p_device_info)
  RETURNING id, scanned_at INTO v_checkin_id, v_scanned_at;

  -- Update ticket
  UPDATE tickets
  SET 
    checked_in_count = checked_in_count + 1,
    status = CASE 
      WHEN checked_in_count + 1 >= max_checkins THEN 'checked_in'::TEXT
      ELSE status
    END
  WHERE id = v_ticket.id;

  -- Return success
  RETURN jsonb_build_object(
    'success', true,
    'ticket_id', v_ticket.id,
    'member_id', v_ticket.member_id,
    'member_name', v_member.full_name,
    'course_id', v_ticket.course_id,
    'course_title', v_course.title,
    'course_starts_at', v_course.starts_at,
    'status_after', CASE 
      WHEN v_ticket.checked_in_count + 1 >= v_ticket.max_checkins THEN 'checked_in'
      ELSE 'valid'
    END,
    'checked_in_count', v_ticket.checked_in_count + 1,
    'max_checkins', v_ticket.max_checkins,
    'scanned_at', v_scanned_at,
    'checkin_id', v_checkin_id
  );
END;
$$;

-- Create function to handle new user profiles
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, role)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email),
    'member'
  );
  RETURN NEW;
END;
$$;

-- Create trigger for new users
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- Create function to update updated_at timestamp
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

-- Create trigger for profiles updated_at
CREATE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();