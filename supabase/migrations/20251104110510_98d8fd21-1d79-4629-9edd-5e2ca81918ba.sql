-- Update check_in_with_qr to handle both course tickets and event tickets
CREATE OR REPLACE FUNCTION public.check_in_with_qr(
  qr text, 
  p_location text DEFAULT NULL, 
  p_device_info text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_ticket tickets%ROWTYPE;
  v_event_booking event_bookings%ROWTYPE;
  v_course courses%ROWTYPE;
  v_event events%ROWTYPE;
  v_member profiles%ROWTYPE;
  v_checkin_id UUID;
  v_scanned_at TIMESTAMPTZ;
  v_scanner_role app_role;
  v_is_event BOOLEAN := false;
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

  -- Try to find a course ticket first
  SELECT * INTO v_ticket
  FROM tickets
  WHERE qr_payload = qr
  FOR UPDATE;

  -- If no course ticket, try event booking
  IF NOT FOUND THEN
    SELECT * INTO v_event_booking
    FROM event_bookings
    WHERE qr_payload = qr
    FOR UPDATE;
    
    IF NOT FOUND THEN
      RETURN jsonb_build_object(
        'success', false,
        'error', 'INVALID_TICKET',
        'message', 'Ogiltig biljett'
      );
    END IF;
    
    v_is_event := true;
  END IF;

  -- Handle event ticket
  IF v_is_event THEN
    IF v_event_booking.status != 'confirmed' THEN
      RETURN jsonb_build_object(
        'success', false,
        'error', 'INVALID_STATUS',
        'message', 'Biljetten är inte giltig (status: ' || v_event_booking.status || ')'
      );
    END IF;

    -- Get event info
    SELECT * INTO v_event
    FROM events
    WHERE id = v_event_booking.event_id;

    -- Get member info
    SELECT * INTO v_member
    FROM profiles
    WHERE id = v_event_booking.member_id;

    -- Update booking status to checked_in
    UPDATE event_bookings
    SET status = 'checked_in'
    WHERE id = v_event_booking.id;

    -- Return success
    RETURN jsonb_build_object(
      'success', true,
      'booking_id', v_event_booking.id,
      'member_id', v_event_booking.member_id,
      'member_name', v_member.full_name,
      'event_id', v_event_booking.event_id,
      'event_title', v_event.title,
      'event_start_at', v_event.start_at,
      'status_after', 'checked_in',
      'scanned_at', now(),
      'is_event', true
    );
  END IF;

  -- Handle course ticket (original logic)
  IF v_ticket.status != 'valid' THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'INVALID_STATUS',
      'message', 'Biljetten är inte giltig (status: ' || v_ticket.status || ')'
    );
  END IF;

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
    'checkin_id', v_checkin_id,
    'is_event', false
  );
END;
$$;