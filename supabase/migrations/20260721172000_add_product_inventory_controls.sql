ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS manage_stock boolean NOT NULL DEFAULT false;

ALTER TABLE public.product_variants
  ADD COLUMN IF NOT EXISTS stock_quantity integer NOT NULL DEFAULT 0;
