ALTER TYPE public.order_status ADD VALUE IF NOT EXISTS 'paid';
ALTER TYPE public.order_status ADD VALUE IF NOT EXISTS 'in_production';
ALTER TYPE public.order_status ADD VALUE IF NOT EXISTS 'in_dispatch';
