
-- 1. Extend admin_give_free_tickets to accept optional source_course_id
CREATE OR REPLACE FUNCTION public.admin_give_free_tickets(
  p_member_id uuid,
  p_ticket_count integer,
  p_expires_at timestamp with time zone DEFAULT NULL,
  p_source_course_id uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_ticket_id UUID;
BEGIN
  IF NOT is_admin() THEN
    RAISE EXCEPTION 'FORBIDDEN';
  END IF;

  IF p_ticket_count < 1 OR p_ticket_count > 50 THEN
    RAISE EXCEPTION 'INVALID_TICKET_COUNT';
  END IF;

  INSERT INTO tickets (
    member_id, course_id, source_course_id, status, qr_payload,
    total_tickets, tickets_used, order_id, expires_at
  ) VALUES (
    p_member_id, NULL, p_source_course_id, 'valid', gen_random_uuid()::text,
    p_ticket_count, 0, 'admin_gift:' || auth.uid()::text,
    COALESCE(p_expires_at, NOW() + INTERVAL '3 months')
  )
  RETURNING id INTO v_ticket_id;

  RETURN jsonb_build_object(
    'success', true,
    'tickets', p_ticket_count,
    'ticket_id', v_ticket_id,
    'source_course_id', p_source_course_id,
    'expires_at', COALESCE(p_expires_at, NOW() + INTERVAL '3 months')
  );
END;
$function$;

-- 2. Create admin_create_free_event_booking
CREATE OR REPLACE FUNCTION public.admin_create_free_event_booking(
  p_member_id uuid,
  p_event_id uuid,
  p_event_date_id uuid DEFAULT NULL,
  p_ticket_count integer DEFAULT 1,
  p_attendee_names jsonb DEFAULT '[]'::jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_booking_id uuid;
  v_qr text;
  v_event events%ROWTYPE;
BEGIN
  IF NOT is_admin() THEN
    RAISE EXCEPTION 'FORBIDDEN';
  END IF;

  IF p_ticket_count < 1 OR p_ticket_count > 50 THEN
    RAISE EXCEPTION 'INVALID_TICKET_COUNT';
  END IF;

  SELECT * INTO v_event FROM events WHERE id = p_event_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'EVENT_NOT_FOUND';
  END IF;

  INSERT INTO event_bookings (
    member_id, event_id, event_date_id, ticket_count,
    checkins_allowed, checkins_used, attendee_names,
    payment_status, status, payment_reference, qr_payload
  ) VALUES (
    p_member_id, p_event_id, p_event_date_id, p_ticket_count,
    p_ticket_count, 0, COALESCE(p_attendee_names, '[]'::jsonb),
    'comp', 'confirmed',
    'admin_gift:' || auth.uid()::text,
    gen_random_uuid()::text
  )
  RETURNING id, qr_payload INTO v_booking_id, v_qr;

  UPDATE events SET sold_count = COALESCE(sold_count, 0) + p_ticket_count
  WHERE id = p_event_id;

  RETURN jsonb_build_object(
    'success', true,
    'booking_id', v_booking_id,
    'qr_payload', v_qr,
    'event_title', v_event.title,
    'ticket_count', p_ticket_count
  );
END;
$function$;

-- 3. event_comp_codes table
CREATE TABLE IF NOT EXISTS public.event_comp_codes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE,
  event_id uuid,
  percent_off integer NOT NULL DEFAULT 100 CHECK (percent_off > 0 AND percent_off <= 100),
  max_uses integer NOT NULL DEFAULT 1,
  uses integer NOT NULL DEFAULT 0,
  created_by uuid NOT NULL,
  created_for uuid,
  expires_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.event_comp_codes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage comp codes"
  ON public.event_comp_codes
  FOR ALL
  USING (is_admin())
  WITH CHECK (is_admin());

CREATE POLICY "Authenticated can lookup comp codes"
  ON public.event_comp_codes
  FOR SELECT
  TO authenticated
  USING (true);
