INSERT INTO storage.buckets (id, name, public)
VALUES
  ('product-images', 'product-images', true),
  ('store-branding', 'store-branding', true)
ON CONFLICT (id) DO UPDATE
SET public = EXCLUDED.public;
