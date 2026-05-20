
CREATE OR REPLACE FUNCTION public.admin_create_manual_event_booking(
  p_event_id uuid,
  p_event_date_id uuid DEFAULT NULL,
  p_member_id uuid DEFAULT NULL,
  p_attendee_email text DEFAULT NULL,
  p_attendee_name text DEFAULT NULL,
  p_ticket_count integer DEFAULT 1,
  p_payment_reference text DEFAULT NULL,
  p_amount_cents integer DEFAULT 0,
  p_payment_method text DEFAULT 'swish'
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_event events%ROWTYPE;
  v_member_id uuid := p_member_id;
  v_existing_profile profiles%ROWTYPE;
  v_booking_ids uuid[] := '{}';
  v_id uuid;
  v_i int;
  v_attendee text;
  v_ref text;
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

  -- Resolve member: prefer explicit id, else lookup by email
  IF v_member_id IS NULL AND p_attendee_email IS NOT NULL AND p_attendee_email <> '' THEN
    SELECT * INTO v_existing_profile FROM profiles WHERE lower(email) = lower(p_attendee_email) LIMIT 1;
    IF FOUND THEN
      v_member_id := v_existing_profile.id;
    END IF;
  END IF;

  -- Fallback: book under the admin's own user_id (guest booking, attendee_name carries the real person)
  IF v_member_id IS NULL THEN
    v_member_id := auth.uid();
  END IF;

  v_ref := 'manual:' || COALESCE(NULLIF(p_payment_reference, ''), gen_random_uuid()::text);
  v_attendee := COALESCE(NULLIF(p_attendee_name, ''), 'Gäst');

  FOR v_i IN 1..p_ticket_count LOOP
    INSERT INTO event_bookings (
      member_id, event_id, event_date_id, status, payment_status,
      ticket_count, checkins_allowed, checkins_used,
      attendee_names, qr_payload, payment_reference
    )
    VALUES (
      v_member_id, p_event_id, p_event_date_id, 'confirmed', 'paid',
      1, 1, 0,
      jsonb_build_array(v_attendee),
      gen_random_uuid()::text,
      v_ref
    )
    RETURNING id INTO v_id;
    v_booking_ids := array_append(v_booking_ids, v_id);
  END LOOP;

  UPDATE events SET sold_count = COALESCE(sold_count, 0) + p_ticket_count
  WHERE id = p_event_id;

  IF p_amount_cents > 0 THEN
    INSERT INTO payments (member_id, amount_cents, currency, status, description, payment_method, payment_type, order_id)
    VALUES (v_member_id, p_amount_cents, COALESCE(v_event.currency, 'SEK'), 'succeeded',
            'Event: ' || COALESCE(v_event.title, '(unknown)') || ' [manual entry]',
            COALESCE(p_payment_method, 'swish'), 'event', v_ref);
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'bookings_created', p_ticket_count,
    'booking_ids', to_jsonb(v_booking_ids),
    'event_title', v_event.title,
    'member_id', v_member_id
  );
END;
$$;
