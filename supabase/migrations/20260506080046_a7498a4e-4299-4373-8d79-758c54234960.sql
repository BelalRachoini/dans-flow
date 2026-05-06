ALTER TABLE public.payments
  ADD COLUMN IF NOT EXISTS order_id text,
  ADD COLUMN IF NOT EXISTS payment_method text NOT NULL DEFAULT 'stripe',
  ADD COLUMN IF NOT EXISTS payment_type text;

CREATE UNIQUE INDEX IF NOT EXISTS payments_order_id_unique
  ON public.payments(order_id) WHERE order_id IS NOT NULL;

CREATE POLICY "Members can view own payments"
  ON public.payments FOR SELECT
  USING (member_id = auth.uid());