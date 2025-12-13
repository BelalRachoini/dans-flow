-- Update check_in_with_qr function to block self-check-in for events
CREATE OR REPLACE FUNCTION public.check_in_with_qr(qr text, p_location text DEFAULT NULL::text, p_device_info text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_ticket tickets%ROWTYPE;
  v_event_booking event_bookings%ROWTYPE;
  v_lesson_booking lesson_bookings%ROWTYPE;
  v_course courses%ROWTYPE;
  v_event events%ROWTYPE;
  v_lesson course_lessons%ROWTYPE;
  v_member profiles%ROWTYPE;
  v_checkin_id UUID;
  v_scanned_at TIMESTAMPTZ;
  v_scanner_role app_role;
  v_is_event BOOLEAN := false;
  v_is_lesson BOOLEAN := false;
  v_is_self_checkin BOOLEAN := false;
  v_member_id UUID;
BEGIN
  -- Get scanner role
  SELECT role INTO v_scanner_role
  FROM public.user_roles
  WHERE user_id = auth.uid()
  ORDER BY 
    CASE role
      WHEN 'admin' THEN 1
      WHEN 'instructor' THEN 2
      WHEN 'member' THEN 3
    END
  LIMIT 1;

  IF v_scanner_role IS NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'UNAUTHORIZED',
      'message', 'Du måste vara inloggad'
    );
  END IF;

  -- Check if this is a lesson booking (drop-in)
  SELECT * INTO v_lesson_booking
  FROM lesson_bookings
  WHERE qr_payload = qr
  FOR UPDATE;

  IF FOUND THEN
    v_is_lesson := true;
    v_member_id := v_lesson_booking.member_id;
    v_is_self_checkin := (v_member_id = auth.uid());

    -- If not self check-in, require instructor or admin role
    IF NOT v_is_self_checkin AND v_scanner_role NOT IN ('instructor', 'admin') THEN
      RETURN jsonb_build_object(
        'success', false,
        'error', 'UNAUTHORIZED',
        'message', 'Endast instruktörer och admins kan skanna andra användares biljetter'
      );
    END IF;

    -- Check if already at max check-ins
    IF v_lesson_booking.checkins_used >= v_lesson_booking.checkins_allowed THEN
      RETURN jsonb_build_object(
        'success', false,
        'error', 'MAX_CHECKINS_REACHED',
        'message', 'Alla tillgängliga incheckningar har använts'
      );
    END IF;

    -- Get lesson info
    SELECT * INTO v_lesson
    FROM course_lessons
    WHERE id = v_lesson_booking.lesson_id;

    -- Get member info
    SELECT * INTO v_member
    FROM profiles
    WHERE id = v_member_id;

    -- If using existing ticket, deduct from ticket balance
    IF v_lesson_booking.ticket_type = 'existing' THEN
      -- Find the best ticket package to use (expiring soonest, has remaining tickets)
      SELECT * INTO v_ticket
      FROM tickets
      WHERE member_id = v_member_id
        AND total_tickets > tickets_used
        AND expires_at > NOW()
        AND status = 'valid'
      ORDER BY expires_at ASC
      LIMIT 1
      FOR UPDATE;

      IF NOT FOUND THEN
        RETURN jsonb_build_object(
          'success', false,
          'error', 'NO_AVAILABLE_TICKETS',
          'message', 'Inga tillgängliga klipp'
        );
      END IF;

      -- Deduct 1 ticket from the package
      UPDATE tickets
      SET 
        tickets_used = tickets_used + 1,
        status = CASE 
          WHEN tickets_used + 1 >= total_tickets THEN 'used'
          ELSE 'valid'
        END
      WHERE id = v_ticket.id;
    END IF;

    -- Update lesson booking check-in count
    UPDATE lesson_bookings
    SET 
      checkins_used = checkins_used + 1,
      status = CASE
        WHEN checkins_used + 1 >= checkins_allowed THEN 'used'
        ELSE status
      END
    WHERE id = v_lesson_booking.id;

    -- Return success with COALESCE for NULL handling
    RETURN jsonb_build_object(
      'success', true,
      'member_id', v_member_id,
      'member_name', COALESCE(v_member.full_name, 'Okänd medlem'),
      'lesson_id', v_lesson_booking.lesson_id,
      'lesson_title', COALESCE(v_lesson.title, 'Lektion'),
      'checkins_used', v_lesson_booking.checkins_used + 1,
      'checkins_allowed', v_lesson_booking.checkins_allowed,
      'is_lesson', true,
      'is_self_checkin', v_is_self_checkin
    );
  END IF;

  -- Try to find a course ticket
  SELECT member_id INTO v_member_id
  FROM tickets
  WHERE qr_payload = qr
  LIMIT 1;

  -- If found a course ticket, use flexible ticket logic
  IF v_member_id IS NOT NULL THEN
    -- Check if this is self check-in
    v_is_self_checkin := (v_member_id = auth.uid());

    -- If not self check-in, require instructor or admin role
    IF NOT v_is_self_checkin AND v_scanner_role NOT IN ('instructor', 'admin') THEN
      RETURN jsonb_build_object(
        'success', false,
        'error', 'UNAUTHORIZED',
        'message', 'Endast instruktörer och admins kan skanna andra användares biljetter'
      );
    END IF;

    -- Find the best ticket package to use (expiring soonest, has remaining tickets)
    SELECT * INTO v_ticket
    FROM tickets
    WHERE member_id = v_member_id
      AND total_tickets > tickets_used
      AND expires_at > NOW()
      AND status = 'valid'
    ORDER BY expires_at ASC
    LIMIT 1
    FOR UPDATE;

    IF NOT FOUND THEN
      RETURN jsonb_build_object(
        'success', false,
        'error', 'NO_AVAILABLE_TICKETS',
        'message', 'Inga tillgängliga klipp. Köp fler kurser för att få klippkort.'
      );
    END IF;

    -- Get course info (may be NULL for free tickets)
    IF v_ticket.source_course_id IS NOT NULL THEN
      SELECT * INTO v_course
      FROM courses
      WHERE id = v_ticket.source_course_id;
    END IF;

    -- Get member info
    SELECT * INTO v_member
    FROM profiles
    WHERE id = v_member_id;

    -- Create checkin
    INSERT INTO checkins (ticket_id, scanned_by, location, device_info)
    VALUES (
      v_ticket.id, 
      auth.uid(), 
      COALESCE(p_location, CASE WHEN v_is_self_checkin THEN 'Self Check-in' ELSE NULL END), 
      p_device_info
    )
    RETURNING id, scanned_at INTO v_checkin_id, v_scanned_at;

    -- Deduct 1 ticket from the package
    UPDATE tickets
    SET 
      tickets_used = tickets_used + 1,
      status = CASE 
        WHEN tickets_used + 1 >= total_tickets THEN 'used'
        ELSE 'valid'
      END
    WHERE id = v_ticket.id;

    -- Return success with COALESCE for NULL handling
    RETURN jsonb_build_object(
      'success', true,
      'ticket_id', v_ticket.id,
      'member_id', v_member_id,
      'member_name', COALESCE(v_member.full_name, 'Okänd medlem'),
      'course_id', v_ticket.source_course_id,
      'course_title', COALESCE(v_course.title, 'Klippkort (flexibel biljett)'),
      'course_starts_at', v_course.starts_at,
      'status_after', CASE 
        WHEN v_ticket.tickets_used + 1 >= v_ticket.total_tickets THEN 'used'
        ELSE 'valid'
      END,
      'tickets_used', v_ticket.tickets_used + 1,
      'total_tickets', v_ticket.total_tickets,
      'scanned_at', v_scanned_at,
      'checkin_id', v_checkin_id,
      'is_event', false,
      'is_self_checkin', v_is_self_checkin
    );
  END IF;

  -- If no course ticket or lesson found, try event booking
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
  v_is_self_checkin := (v_event_booking.member_id = auth.uid());

  -- BLOCK self-check-in for events - must be scanned by staff at door
  IF v_is_self_checkin THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'EVENT_SELF_CHECKIN_NOT_ALLOWED',
      'message', 'Eventbiljetter måste skannas av personal vid entrén'
    );
  END IF;

  -- If not self check-in, require instructor or admin role
  IF v_scanner_role NOT IN ('instructor', 'admin') THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'UNAUTHORIZED',
      'message', 'Endast instruktörer och admins kan skanna eventbiljetter'
    );
  END IF;

  -- Check if already fully checked in (using new checkins_used/checkins_allowed)
  IF v_event_booking.checkins_used >= v_event_booking.checkins_allowed THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'ALREADY_CHECKED_IN',
      'message', 'Alla incheckningar för denna biljett har redan använts'
    );
  END IF;

  IF v_event_booking.status = 'cancelled' OR v_event_booking.status = 'refunded' THEN
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

  -- Create event checkin record
  INSERT INTO event_checkins (
    booking_id,
    event_id,
    member_id,
    scanned_by,
    scanned_at,
    location,
    device_info
  ) VALUES (
    v_event_booking.id,
    v_event_booking.event_id,
    v_event_booking.member_id,
    auth.uid(),
    now(),
    p_location,
    p_device_info
  ) RETURNING id, scanned_at INTO v_checkin_id, v_scanned_at;

  -- Update booking: increment checkins_used, update status if fully checked in
  UPDATE event_bookings
  SET 
    checkins_used = checkins_used + 1,
    status = CASE 
      WHEN checkins_used + 1 >= checkins_allowed THEN 'checked_in'
      ELSE status 
    END
  WHERE id = v_event_booking.id;

  -- Return success with checkin progress info
  RETURN jsonb_build_object(
    'success', true,
    'booking_id', v_event_booking.id,
    'member_id', v_event_booking.member_id,
    'member_name', COALESCE(v_member.full_name, 'Okänd medlem'),
    'event_id', v_event_booking.event_id,
    'event_title', COALESCE(v_event.title, 'Event'),
    'event_start_at', v_event.start_at,
    'status_after', CASE 
      WHEN v_event_booking.checkins_used + 1 >= v_event_booking.checkins_allowed THEN 'checked_in'
      ELSE 'confirmed' 
    END,
    'checkins_used', v_event_booking.checkins_used + 1,
    'checkins_allowed', v_event_booking.checkins_allowed,
    'scanned_at', v_scanned_at,
    'checkin_id', v_checkin_id,
    'is_event', true,
    'is_self_checkin', false
  );
END;
$function$;