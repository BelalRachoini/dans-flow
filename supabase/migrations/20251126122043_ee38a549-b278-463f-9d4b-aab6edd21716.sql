-- Drop and recreate admin_manual_checkin with correct column names
DROP FUNCTION IF EXISTS public.admin_manual_checkin(uuid, uuid, text);

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

  -- Find the best available ticket package for this member (FIFO - expiring soonest)
  SELECT * INTO v_ticket
  FROM tickets
  WHERE member_id = p_member_id
    AND total_tickets > tickets_used
    AND expires_at > NOW()
    AND status = 'valid'
  ORDER BY expires_at ASC
  LIMIT 1
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'NO_AVAILABLE_TICKETS';
  END IF;

  -- Create manual checkin
  INSERT INTO checkins (ticket_id, scanned_by, location, device_info)
  VALUES (v_ticket.id, auth.uid(), 'Manual Check-in', p_note)
  RETURNING id INTO v_checkin_id;

  -- Update ticket count
  UPDATE tickets
  SET
    tickets_used = tickets_used + 1,
    status = CASE
      WHEN tickets_used + 1 >= total_tickets THEN 'used'
      ELSE status
    END
  WHERE id = v_ticket.id;

  RETURN jsonb_build_object(
    'success', true,
    'checkin_id', v_checkin_id,
    'tickets_used', v_ticket.tickets_used + 1,
    'total_tickets', v_ticket.total_tickets,
    'message', 'Manual check-in successful'
  );
END;
$$;