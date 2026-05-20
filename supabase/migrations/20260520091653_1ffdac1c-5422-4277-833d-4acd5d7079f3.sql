-- 1. Course-scoped removal: add optional p_source_course_id
CREATE OR REPLACE FUNCTION public.admin_remove_tickets(
  p_member_id uuid,
  p_ticket_count integer,
  p_reason text DEFAULT NULL::text,
  p_source_course_id uuid DEFAULT NULL::uuid
)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_remaining integer;
  v_ticket RECORD;
  v_to_deduct integer;
  v_total_removed integer := 0;
  v_available integer;
BEGIN
  IF NOT is_admin() THEN
    RAISE EXCEPTION 'FORBIDDEN';
  END IF;

  IF p_ticket_count < 1 OR p_ticket_count > 50 THEN
    RAISE EXCEPTION 'INVALID_TICKET_COUNT';
  END IF;

  SELECT COALESCE(SUM(total_tickets - tickets_used), 0) INTO v_available
  FROM tickets
  WHERE member_id = p_member_id
    AND status = 'valid'
    AND expires_at > NOW()
    AND total_tickets > tickets_used
    AND (p_source_course_id IS NULL OR source_course_id = p_source_course_id);

  IF v_available < p_ticket_count THEN
    RAISE EXCEPTION 'NOT_ENOUGH_TICKETS';
  END IF;

  v_remaining := p_ticket_count;

  FOR v_ticket IN
    SELECT id, total_tickets, tickets_used
    FROM tickets
    WHERE member_id = p_member_id
      AND status = 'valid'
      AND expires_at > NOW()
      AND total_tickets > tickets_used
      AND (p_source_course_id IS NULL OR source_course_id = p_source_course_id)
    ORDER BY expires_at ASC
    FOR UPDATE
  LOOP
    EXIT WHEN v_remaining <= 0;
    v_to_deduct := LEAST(v_remaining, v_ticket.total_tickets - v_ticket.tickets_used);
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
    'source_course_id', p_source_course_id,
    'member_id', p_member_id
  );
END;
$function$;

-- 2. Cancel an event booking (no Stripe refund)
CREATE OR REPLACE FUNCTION public.admin_cancel_event_booking(p_booking_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_booking event_bookings%ROWTYPE;
  v_event events%ROWTYPE;
BEGIN
  IF NOT is_admin() THEN
    RAISE EXCEPTION 'FORBIDDEN';
  END IF;

  SELECT * INTO v_booking FROM event_bookings WHERE id = p_booking_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'BOOKING_NOT_FOUND';
  END IF;

  IF v_booking.status = 'cancelled' THEN
    RETURN jsonb_build_object('success', true, 'already_cancelled', true, 'booking_id', p_booking_id);
  END IF;

  SELECT * INTO v_event FROM events WHERE id = v_booking.event_id;

  UPDATE event_bookings
  SET status = 'cancelled',
      payment_status = CASE WHEN payment_status = 'paid' THEN 'refunded' ELSE payment_status END
  WHERE id = p_booking_id;

  UPDATE events
  SET sold_count = GREATEST(COALESCE(sold_count, 0) - COALESCE(v_booking.ticket_count, 1), 0)
  WHERE id = v_booking.event_id;

  RETURN jsonb_build_object(
    'success', true,
    'already_cancelled', false,
    'booking_id', p_booking_id,
    'event_title', COALESCE(v_event.title, ''),
    'ticket_count', v_booking.ticket_count
  );
END;
$function$;