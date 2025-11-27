-- Drop the old function
DROP FUNCTION IF EXISTS public.admin_update_member(uuid, text, integer, text);

-- Create updated function without points
CREATE OR REPLACE FUNCTION public.admin_update_member(
  target uuid,
  new_level text DEFAULT NULL,
  new_status text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  old_level TEXT; 
  old_status TEXT;
BEGIN
  IF NOT is_admin() THEN 
    RAISE EXCEPTION 'FORBIDDEN'; 
  END IF;

  SELECT level, status INTO old_level, old_status
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
    'old_status', old_status,
    'new_status', (SELECT status FROM profiles WHERE id = target)
  );
END;
$$;