
-- Reconcile a swish_payments row into an event_booking (admin only, idempotent by payment ref)
CREATE OR REPLACE FUNCTION public.admin_reconcile_swish_event_booking(
  p_swish_payment_id uuid,
  p_attendee_names jsonb DEFAULT '[]'::jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_pay swish_payments%ROWTYPE;
  v_event_id uuid;
  v_event_date_id uuid;
  v_qty integer;
  v_event events%ROWTYPE;
  v_dates event_dates%ROWTYPE;
  v_order_ref text;
  v_created int := 0;
  v_booking_ids uuid[] := '{}';
  v_attendee text;
  v_qr text;
  v_id uuid;
  v_i int;
  v_existing_count int;
  v_dates_to_book event_dates[];
  v_date record;
BEGIN
  IF NOT is_admin() THEN
    RAISE EXCEPTION 'FORBIDDEN';
  END IF;

  SELECT * INTO v_pay FROM swish_payments WHERE id = p_swish_payment_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'PAYMENT_NOT_FOUND';
  END IF;

  v_event_id := (v_pay.metadata->>'item_id')::uuid;
  v_event_date_id := NULLIF(v_pay.metadata->>'event_date_id','')::uuid;
  v_qty := GREATEST(COALESCE((v_pay.metadata->>'quantity')::int, 1), 1);

  IF v_event_id IS NULL THEN
    RAISE EXCEPTION 'PAYMENT_NOT_FOR_EVENT';
  END IF;

  SELECT * INTO v_event FROM events WHERE id = v_event_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'EVENT_NOT_FOUND';
  END IF;

  v_order_ref := COALESCE(
    NULLIF(v_pay.metadata->>'wp_order_id', ''),
    v_pay.payment_request_id
  );
  v_order_ref := 'swish:' || v_order_ref;

  -- Already reconciled?
  SELECT COUNT(*) INTO v_existing_count
  FROM event_bookings
  WHERE event_id = v_event_id
    AND member_id = v_pay.member_id
    AND payment_reference = v_order_ref;

  IF v_existing_count > 0 THEN
    RETURN jsonb_build_object(
      'success', true,
      'already_existed', true,
      'bookings', v_existing_count
    );
  END IF;

  -- Resolve dates to book
  FOR v_date IN
    SELECT id, start_at FROM event_dates
    WHERE event_id = v_event_id
      AND (v_event_date_id IS NULL OR id = v_event_date_id)
    ORDER BY start_at
  LOOP
    FOR v_i IN 1..v_qty LOOP
      v_attendee := COALESCE(
        NULLIF(p_attendee_names->>(v_i - 1), ''),
        NULLIF(v_pay.metadata->>'customer_name', ''),
        'Person ' || v_i
      );
      INSERT INTO event_bookings (
        member_id, event_id, event_date_id, status, payment_status,
        ticket_count, checkins_allowed, checkins_used,
        attendee_names, qr_payload, payment_reference
      )
      VALUES (
        v_pay.member_id, v_event_id, v_date.id, 'confirmed', 'paid',
        1, 1, 0,
        jsonb_build_array(v_attendee),
        gen_random_uuid()::text,
        v_order_ref
      )
      RETURNING id INTO v_id;
      v_booking_ids := array_append(v_booking_ids, v_id);
      v_created := v_created + 1;
    END LOOP;
  END LOOP;

  -- If no event_dates rows exist, book against the event itself
  IF v_created = 0 THEN
    FOR v_i IN 1..v_qty LOOP
      v_attendee := COALESCE(
        NULLIF(p_attendee_names->>(v_i - 1), ''),
        NULLIF(v_pay.metadata->>'customer_name', ''),
        'Person ' || v_i
      );
      INSERT INTO event_bookings (
        member_id, event_id, event_date_id, status, payment_status,
        ticket_count, checkins_allowed, checkins_used,
        attendee_names, qr_payload, payment_reference
      )
      VALUES (
        v_pay.member_id, v_event_id, NULL, 'confirmed', 'paid',
        1, 1, 0,
        jsonb_build_array(v_attendee),
        gen_random_uuid()::text,
        v_order_ref
      )
      RETURNING id INTO v_id;
      v_booking_ids := array_append(v_booking_ids, v_id);
      v_created := v_created + 1;
    END LOOP;
  END IF;

  UPDATE events SET sold_count = COALESCE(sold_count, 0) + v_qty
  WHERE id = v_event_id;

  -- Log to payments for finance visibility (best effort)
  INSERT INTO payments (member_id, amount_cents, currency, status, description, payment_method, payment_type, order_id)
  VALUES (v_pay.member_id, v_pay.amount_cents, v_pay.currency, 'succeeded',
          'Event: ' || COALESCE(v_event.title, '(unknown)') || ' [admin reconcile]',
          'swish', 'event', v_order_ref);

  RETURN jsonb_build_object(
    'success', true,
    'already_existed', false,
    'bookings_created', v_created,
    'booking_ids', to_jsonb(v_booking_ids),
    'event_title', v_event.title
  );
END;
$$;

-- List swish payments tagged for a given event that have no matching booking
CREATE OR REPLACE FUNCTION public.admin_list_unreconciled_swish_for_event(p_event_id uuid)
RETURNS TABLE (
  swish_payment_id uuid,
  member_id uuid,
  member_name text,
  member_email text,
  amount_cents int,
  quantity int,
  created_at timestamptz,
  wp_order_id text,
  customer_name text,
  attendee_names jsonb
)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    sp.id,
    sp.member_id,
    p.full_name,
    p.email,
    sp.amount_cents,
    COALESCE((sp.metadata->>'quantity')::int, 1),
    sp.created_at,
    sp.metadata->>'wp_order_id',
    sp.metadata->>'customer_name',
    COALESCE(sp.metadata->'attendee_names', '[]'::jsonb)
  FROM swish_payments sp
  LEFT JOIN profiles p ON p.id = sp.member_id
  WHERE is_admin()
    AND sp.payment_type = 'event'
    AND lower(sp.status) IN ('paid','succeeded','ok')
    AND (sp.metadata->>'item_id')::uuid = p_event_id
    AND NOT EXISTS (
      SELECT 1 FROM event_bookings eb
      WHERE eb.event_id = p_event_id
        AND eb.member_id = sp.member_id
        AND eb.payment_reference = 'swish:' || COALESCE(NULLIF(sp.metadata->>'wp_order_id',''), sp.payment_request_id)
    )
  ORDER BY sp.created_at DESC;
$$;
