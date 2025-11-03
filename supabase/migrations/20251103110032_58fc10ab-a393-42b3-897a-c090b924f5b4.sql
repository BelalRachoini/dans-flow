-- Extend profiles with CRM fields
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS level TEXT 
    CHECK (level IN ('bronze','silver','gold','platinum','vip')) DEFAULT 'bronze',
  ADD COLUMN IF NOT EXISTS points INT DEFAULT 0 CHECK (points >= 0),
  ADD COLUMN IF NOT EXISTS status TEXT
    CHECK (status IN ('active','inactive')) DEFAULT 'active',
  ADD COLUMN IF NOT EXISTS phone TEXT,
  ADD COLUMN IF NOT EXISTS email TEXT;

-- Create payments table
CREATE TABLE IF NOT EXISTS payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  member_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  amount_cents INT NOT NULL CHECK (amount_cents >= 0),
  currency TEXT NOT NULL DEFAULT 'SEK' CHECK (currency IN ('SEK')),
  status TEXT NOT NULL CHECK (status IN ('succeeded','refunded','failed','pending')),
  description TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE payments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "payments_admin_only" ON payments 
FOR ALL USING (is_admin()) WITH CHECK (is_admin());

-- Create subscriptions table
CREATE TABLE IF NOT EXISTS subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  member_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  plan TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('active','paused','canceled')),
  current_period_end TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "subs_admin_only" ON subscriptions 
FOR ALL USING (is_admin()) WITH CHECK (is_admin());

-- Create member notes table
CREATE TABLE IF NOT EXISTS member_notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  member_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  author_id UUID NOT NULL REFERENCES profiles(id) ON DELETE SET NULL,
  body TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE member_notes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "notes_read_admin_only" ON member_notes 
FOR SELECT USING (is_admin());

CREATE POLICY "notes_write_admin_only" ON member_notes 
FOR INSERT WITH CHECK (is_admin());

CREATE POLICY "notes_delete_admin_only" ON member_notes 
FOR DELETE USING (is_admin());

-- Create revenue view
CREATE OR REPLACE VIEW v_member_revenue AS
SELECT
  p.id AS member_id,
  COALESCE(SUM(CASE 
    WHEN pay.status='succeeded' THEN pay.amount_cents
    WHEN pay.status='refunded' THEN -pay.amount_cents
    ELSE 0 
  END), 0) AS revenue_cents,
  COUNT(*) FILTER (WHERE pay.status IN ('succeeded','refunded')) AS txn_count
FROM profiles p
LEFT JOIN payments pay ON pay.member_id = p.id
GROUP BY p.id;

-- Create checkins view
CREATE OR REPLACE VIEW v_member_checkins AS
SELECT 
  t.member_id, 
  COUNT(c.id) AS checkins_count, 
  MAX(c.scanned_at) AS last_checkin_at
FROM tickets t
LEFT JOIN checkins c ON c.ticket_id = t.id
GROUP BY t.member_id;

-- Grant select on views
GRANT SELECT ON v_member_revenue TO authenticated;
GRANT SELECT ON v_member_checkins TO authenticated;

-- Admin update member RPC
CREATE OR REPLACE FUNCTION admin_update_member(
  target UUID,
  new_level TEXT DEFAULT NULL,
  points_delta INT DEFAULT NULL,
  new_status TEXT DEFAULT NULL
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  old_level TEXT; 
  new_points INT; 
  old_status TEXT;
BEGIN
  IF NOT is_admin() THEN 
    RAISE EXCEPTION 'FORBIDDEN'; 
  END IF;

  SELECT level, points, status INTO old_level, new_points, old_status
  FROM profiles WHERE id = target FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'MEMBER_NOT_FOUND';
  END IF;

  IF new_level IS NOT NULL THEN
    IF new_level NOT IN ('bronze','silver','gold','platinum','vip') THEN
      RAISE EXCEPTION 'INVALID_LEVEL';
    END IF;
    UPDATE profiles SET level = new_level WHERE id = target;
  END IF;

  IF points_delta IS NOT NULL THEN
    UPDATE profiles SET points = GREATEST(0, points + points_delta) WHERE id = target;
    SELECT points INTO new_points FROM profiles WHERE id = target;
  END IF;

  IF new_status IS NOT NULL THEN
    IF new_status NOT IN ('active','inactive') THEN
      RAISE EXCEPTION 'INVALID_STATUS';
    END IF;
    UPDATE profiles SET status = new_status WHERE id = target;
  END IF;

  RETURN jsonb_build_object(
    'member', target,
    'old_level', old_level,
    'new_level', (SELECT level FROM profiles WHERE id = target),
    'points', (SELECT points FROM profiles WHERE id = target),
    'old_status', old_status,
    'new_status', (SELECT status FROM profiles WHERE id = target)
  );
END;
$$;