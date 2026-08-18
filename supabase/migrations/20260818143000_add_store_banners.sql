CREATE TABLE IF NOT EXISTS public.store_banners (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id uuid NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  image_url text NOT NULL,
  title text,
  subtitle text,
  button_label text,
  link_type text NOT NULL DEFAULT 'home'
    CHECK (link_type IN ('home','store_home','product','category','external')),
  link_target text,
  sort_order integer NOT NULL DEFAULT 0,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS store_banners_store_order_idx
  ON public.store_banners (store_id, sort_order, created_at);

GRANT SELECT ON public.store_banners TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.store_banners TO authenticated;
GRANT ALL ON public.store_banners TO service_role;

ALTER TABLE public.store_banners ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "store_banners_public_read" ON public.store_banners;
CREATE POLICY "store_banners_public_read" ON public.store_banners
  FOR SELECT USING (
    active = true
    AND EXISTS (
      SELECT 1
      FROM public.stores s
      WHERE s.id = store_id
        AND s.status IN ('trial','active')
        AND s.publication_status = 'published'
    )
  );

DROP POLICY IF EXISTS "store_banners_admin_all" ON public.store_banners;
CREATE POLICY "store_banners_admin_all" ON public.store_banners
  FOR ALL
  USING (public.is_store_admin(store_id) OR public.is_platform_admin())
  WITH CHECK (public.is_store_admin(store_id) OR public.is_platform_admin());

DROP TRIGGER IF EXISTS t_store_banners_updated ON public.store_banners;
CREATE TRIGGER t_store_banners_updated
  BEFORE UPDATE ON public.store_banners
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

INSERT INTO public.store_banners (
  store_id,
  image_url,
  title,
  subtitle,
  button_label,
  link_type,
  sort_order,
  active
)
SELECT
  id,
  banner_url,
  banner_title,
  banner_subtitle,
  COALESCE(NULLIF(banner_cta, ''), 'Ver produtos'),
  'home',
  0,
  true
FROM public.stores
WHERE banner_url IS NOT NULL
  AND banner_url <> ''
  AND NOT EXISTS (
    SELECT 1
    FROM public.store_banners b
    WHERE b.store_id = stores.id
  );

INSERT INTO public.store_banners (
  id,
  store_id,
  image_url,
  title,
  subtitle,
  button_label,
  link_type,
  link_target,
  sort_order,
  active
)
SELECT
  COALESCE(NULLIF(item->>'id', '')::uuid, gen_random_uuid()),
  s.store_id,
  item->>'image_url',
  NULLIF(item->>'title', ''),
  NULLIF(item->>'subtitle', ''),
  NULLIF(item->>'button_label', ''),
  COALESCE(NULLIF(item->>'link_type', ''), 'home'),
  NULLIF(item->>'link_target', ''),
  COALESCE((item->>'sort_order')::integer, item_position - 1),
  COALESCE((item->>'active')::boolean, true)
FROM public.store_settings s
CROSS JOIN LATERAL jsonb_array_elements(
  CASE WHEN jsonb_typeof(s.setting_value) = 'array' THEN s.setting_value ELSE '[]'::jsonb END
) WITH ORDINALITY AS banner(item, item_position)
WHERE s.setting_key = 'catalog_banners'
  AND item->>'image_url' IS NOT NULL
  AND item->>'image_url' <> ''
ON CONFLICT (id) DO UPDATE SET
  image_url = EXCLUDED.image_url,
  title = EXCLUDED.title,
  subtitle = EXCLUDED.subtitle,
  button_label = EXCLUDED.button_label,
  link_type = EXCLUDED.link_type,
  link_target = EXCLUDED.link_target,
  sort_order = EXCLUDED.sort_order,
  active = EXCLUDED.active,
  updated_at = now();
