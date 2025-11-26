-- Create function to give free tickets to members
CREATE OR REPLACE FUNCTION public.admin_give_free_tickets(
  p_member_id UUID,
  p_ticket_count INTEGER,
  p_expires_at TIMESTAMPTZ DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_ticket_id UUID;
BEGIN
  -- Check if caller is admin
  IF NOT is_admin() THEN
    RAISE EXCEPTION 'FORBIDDEN';
  END IF;

  -- Validate ticket count
  IF p_ticket_count < 1 OR p_ticket_count > 50 THEN
    RAISE EXCEPTION 'INVALID_TICKET_COUNT';
  END IF;

  -- Insert ticket package
  INSERT INTO tickets (
    member_id,
    course_id,
    source_course_id,
    status,
    qr_payload,
    total_tickets,
    tickets_used,
    order_id,
    expires_at
  ) VALUES (
    p_member_id,
    NULL,
    NULL,
    'valid',
    gen_random_uuid()::text,
    p_ticket_count,
    0,
    'admin_gift:' || auth.uid()::text,
    COALESCE(p_expires_at, NOW() + INTERVAL '3 months')
  )
  RETURNING id INTO v_ticket_id;

  RETURN jsonb_build_object(
    'success', true,
    'tickets', p_ticket_count,
    'ticket_id', v_ticket_id,
    'expires_at', COALESCE(p_expires_at, NOW() + INTERVAL '3 months')
  );
END;
$$;