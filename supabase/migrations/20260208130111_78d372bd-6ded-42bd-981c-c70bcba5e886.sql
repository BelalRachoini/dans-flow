
CREATE TABLE public.swish_payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  payment_request_id text NOT NULL UNIQUE,
  member_id uuid NOT NULL REFERENCES profiles(id),
  amount_cents integer NOT NULL,
  currency text NOT NULL DEFAULT 'SEK',
  status text NOT NULL DEFAULT 'CREATED',
  payment_type text NOT NULL,
  metadata jsonb NOT NULL DEFAULT '{}',
  swish_callback_data jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.swish_payments ENABLE ROW LEVEL SECURITY;

-- Members can view own Swish payments
CREATE POLICY "Members can view own swish payments"
  ON public.swish_payments FOR SELECT
  USING (member_id = auth.uid());

-- Admins can view all
CREATE POLICY "Admins can view all swish payments"
  ON public.swish_payments FOR SELECT
  USING (is_admin());

-- Admins can manage all
CREATE POLICY "Admins can manage swish payments"
  ON public.swish_payments FOR ALL
  USING (is_admin())
  WITH CHECK (is_admin());

-- Trigger for updated_at
CREATE TRIGGER update_swish_payments_updated_at
  BEFORE UPDATE ON public.swish_payments
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
