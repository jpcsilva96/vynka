
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS discount numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS surcharge numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS payment_method text,
  ADD COLUMN IF NOT EXISTS payment_details jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS paid_amount numeric,
  ADD COLUMN IF NOT EXISTS change_due numeric,
  ADD COLUMN IF NOT EXISTS created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS number bigint;

-- Sequence per store isn't cheap; use a simple global bigserial-like sequence for the order number.
CREATE SEQUENCE IF NOT EXISTS public.orders_number_seq;
ALTER TABLE public.orders ALTER COLUMN number SET DEFAULT nextval('public.orders_number_seq');
