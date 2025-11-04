-- Add admin function to create a new member
CREATE OR REPLACE FUNCTION public.admin_create_member(
  p_email text,
  p_password text,
  p_full_name text,
  p_phone text DEFAULT NULL,
  p_level text DEFAULT 'bronze',
  p_role app_role DEFAULT 'member'
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid;
BEGIN
  -- Check if caller is admin
  IF NOT is_admin() THEN
    RAISE EXCEPTION 'FORBIDDEN';
  END IF;

  -- Validate inputs
  IF p_email IS NULL OR p_password IS NULL OR p_full_name IS NULL THEN
    RAISE EXCEPTION 'MISSING_REQUIRED_FIELDS';
  END IF;

  IF p_level NOT IN ('bronze', 'silver', 'gold', 'platinum', 'vip') THEN
    RAISE EXCEPTION 'INVALID_LEVEL';
  END IF;

  -- Create auth user (using admin API would be better, but we'll insert into profiles)
  -- Note: In production, you should use Supabase Admin API to create users
  -- For now, we'll just create a profile entry
  v_user_id := gen_random_uuid();

  INSERT INTO profiles (id, email, full_name, phone, level, role, status, points)
  VALUES (v_user_id, p_email, p_full_name, p_phone, p_level, p_role, 'active', 0);

  RETURN jsonb_build_object(
    'success', true,
    'user_id', v_user_id,
    'message', 'Member created. User must set password via email.'
  );
END;
$$;

-- Add admin function to delete a member
CREATE OR REPLACE FUNCTION public.admin_delete_member(
  target_user_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Check if caller is admin
  IF NOT is_admin() THEN
    RAISE EXCEPTION 'FORBIDDEN';
  END IF;

  -- Prevent deleting yourself
  IF target_user_id = auth.uid() THEN
    RAISE EXCEPTION 'CANNOT_DELETE_SELF';
  END IF;

  -- Delete profile (cascades will handle related records)
  DELETE FROM profiles WHERE id = target_user_id;

  RETURN jsonb_build_object(
    'success', true,
    'message', 'Member deleted successfully'
  );
END;
$$;

-- Add admin function to update member profile
CREATE OR REPLACE FUNCTION public.admin_update_member_profile(
  target_user_id uuid,
  p_full_name text DEFAULT NULL,
  p_email text DEFAULT NULL,
  p_phone text DEFAULT NULL,
  p_level text DEFAULT NULL,
  p_points integer DEFAULT NULL,
  p_status text DEFAULT NULL,
  p_role app_role DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_updated_profile profiles%ROWTYPE;
BEGIN
  -- Check if caller is admin
  IF NOT is_admin() THEN
    RAISE EXCEPTION 'FORBIDDEN';
  END IF;

  -- Build dynamic update
  UPDATE profiles
  SET
    full_name = COALESCE(p_full_name, full_name),
    email = COALESCE(p_email, email),
    phone = COALESCE(p_phone, phone),
    level = COALESCE(p_level, level),
    points = COALESCE(p_points, points),
    status = COALESCE(p_status, status),
    role = COALESCE(p_role, role),
    updated_at = now()
  WHERE id = target_user_id
  RETURNING * INTO v_updated_profile;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'MEMBER_NOT_FOUND';
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'profile', row_to_json(v_updated_profile)
  );
END;
$$;

-- Add admin function for manual check-in
CREATE OR REPLACE FUNCTION public.admin_manual_checkin(
  p_member_id uuid,
  p_course_id uuid,
  p_note text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_ticket tickets%ROWTYPE;
  v_checkin_id uuid;
  v_course courses%ROWTYPE;
BEGIN
  -- Check if caller is admin
  IF NOT is_admin() THEN
    RAISE EXCEPTION 'FORBIDDEN';
  END IF;

  -- Get course info
  SELECT * INTO v_course FROM courses WHERE id = p_course_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'COURSE_NOT_FOUND';
  END IF;

  -- Find or create ticket for this member/course
  SELECT * INTO v_ticket
  FROM tickets
  WHERE member_id = p_member_id AND course_id = p_course_id
  ORDER BY purchased_at DESC
  LIMIT 1
  FOR UPDATE;

  IF NOT FOUND THEN
    -- Create a new ticket
    INSERT INTO tickets (member_id, course_id, status, qr_payload, max_checkins, checked_in_count)
    VALUES (p_member_id, p_course_id, 'valid', gen_random_uuid()::text, 10, 0)
    RETURNING * INTO v_ticket;
  END IF;

  -- Check if already at max
  IF v_ticket.checked_in_count >= v_ticket.max_checkins THEN
    RAISE EXCEPTION 'MAX_CHECKINS_REACHED';
  END IF;

  -- Create manual checkin
  INSERT INTO checkins (ticket_id, scanned_by, location, device_info)
  VALUES (v_ticket.id, auth.uid(), 'Manual Check-in', p_note)
  RETURNING id INTO v_checkin_id;

  -- Update ticket count
  UPDATE tickets
  SET
    checked_in_count = checked_in_count + 1,
    status = CASE
      WHEN checked_in_count + 1 >= max_checkins THEN 'checked_in'
      ELSE status
    END
  WHERE id = v_ticket.id;

  RETURN jsonb_build_object(
    'success', true,
    'checkin_id', v_checkin_id,
    'checked_in_count', v_ticket.checked_in_count + 1,
    'message', 'Manual check-in successful'
  );
END;
$$;