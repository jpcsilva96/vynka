DO $$
BEGIN
  IF to_regclass('public.store_banners') IS NOT NULL THEN
    ALTER TABLE public.store_banners
      DROP CONSTRAINT IF EXISTS store_banners_link_type_check;

    ALTER TABLE public.store_banners
      ADD CONSTRAINT store_banners_link_type_check
      CHECK (link_type IN ('home', 'store_home', 'product', 'category', 'external'));
  END IF;
END;
$$;
