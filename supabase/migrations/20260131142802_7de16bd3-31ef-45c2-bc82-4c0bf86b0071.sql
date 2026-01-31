-- Create function to allow admins to remove tickets from members using FIFO logic
CREATE OR REPLACE FUNCTION public.admin_remove_tickets(
  p_member_id uuid,
  p_ticket_count integer,
  p_reason text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_remaining integer;
  v_ticket RECORD;
  v_to_deduct integer;
  v_total_removed integer := 0;
  v_available integer;
BEGIN
  -- Check if caller is admin
  IF NOT is_admin() THEN
    RAISE EXCEPTION 'FORBIDDEN';
  END IF;

  -- Validate ticket count
  IF p_ticket_count < 1 OR p_ticket_count > 50 THEN
    RAISE EXCEPTION 'INVALID_TICKET_COUNT';
  END IF;

  -- Calculate total available tickets for this member
  SELECT COALESCE(SUM(total_tickets - tickets_used), 0) INTO v_available
  FROM tickets
  WHERE member_id = p_member_id
    AND status = 'valid'
    AND expires_at > NOW()
    AND total_tickets > tickets_used;

  -- Check if member has enough tickets
  IF v_available < p_ticket_count THEN
    RAISE EXCEPTION 'NOT_ENOUGH_TICKETS';
  END IF;

  v_remaining := p_ticket_count;

  -- Loop through ticket packages ordered by expires_at (FIFO - soonest expiry first)
  FOR v_ticket IN
    SELECT id, total_tickets, tickets_used
    FROM tickets
    WHERE member_id = p_member_id
      AND status = 'valid'
      AND expires_at > NOW()
      AND total_tickets > tickets_used
    ORDER BY expires_at ASC
    FOR UPDATE
  LOOP
    EXIT WHEN v_remaining <= 0;

    -- Calculate how many tickets we can deduct from this package
    v_to_deduct := LEAST(v_remaining, v_ticket.total_tickets - v_ticket.tickets_used);

    -- Update the ticket package
    UPDATE tickets
    SET 
      tickets_used = tickets_used + v_to_deduct,
      status = CASE 
        WHEN tickets_used + v_to_deduct >= total_tickets THEN 'used'
        ELSE status
      END
    WHERE id = v_ticket.id;

    v_total_removed := v_total_removed + v_to_deduct;
    v_remaining := v_remaining - v_to_deduct;
  END LOOP;

  RETURN jsonb_build_object(
    'success', true,
    'tickets_removed', v_total_removed,
    'reason', p_reason,
    'member_id', p_member_id
  );
END;
$$;