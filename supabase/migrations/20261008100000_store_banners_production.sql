-- Lote 1 do escopo catálogo/personalização: banners em produção.
-- As migrations de 18/08 (20260818143000, 20260818170000) nunca rodaram em produção; lá o app guarda os
-- banners no "modo reserva" (store_settings.catalog_banners). Assim que a tabela existir, o app passa a
-- ler e gravar só nela. Esta migration substitui as duas de 18/08 (mesma tabela, policies e gatilho) e:
-- 1) copia os banners do modo reserva para a tabela (id, ordem, destino, ativo preservados);
-- 2) não copia o banner antigo do cadastro (stores.banner_url): sem banner na tabela, o app já mostra
--    esse banner sozinho, como hoje;
-- 3) aceita os destinos novos (promoções, novidades, quem somos, contato, sem link);
-- 4) acrescenta a imagem de celular (image_mobile_url; vazia = usa a de computador, image_url).
-- O modo reserva não é apagado (é o rollback). Reaplicar não duplica.
-- Rollback: ver ROLLBACK.md da janela (DROP TABLE store_banners; o app volta ao modo reserva).

-- 1) Tabela (igual a 20260818143000)
CREATE TABLE IF NOT EXISTS public.store_banners (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id uuid NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  image_url text NOT NULL,
  title text,
  subtitle text,
  button_label text,
  link_type text NOT NULL DEFAULT 'home',
  link_target text,
  sort_order integer NOT NULL DEFAULT 0,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.store_banners ADD COLUMN IF NOT EXISTS image_mobile_url text;

-- Destinos: os 5 de antes + os atalhos do escopo (§5).
ALTER TABLE public.store_banners DROP CONSTRAINT IF EXISTS store_banners_link_type_check;
ALTER TABLE public.store_banners ADD CONSTRAINT store_banners_link_type_check
  CHECK (link_type IN ('home', 'store_home', 'product', 'category', 'external',
                       'promotions', 'new_arrivals', 'about', 'contact', 'none'));

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

-- 2) Modo reserva -> tabela (só lojas sem banner na tabela)
INSERT INTO public.store_banners (
  id, store_id, image_url, title, subtitle, button_label, link_type, link_target, sort_order, active
)
SELECT
  CASE WHEN b.value->>'id' ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
       THEN (b.value->>'id')::uuid ELSE gen_random_uuid() END,
  ss.store_id,
  b.value->>'image_url',
  nullif(btrim(b.value->>'title'), ''),
  nullif(btrim(b.value->>'subtitle'), ''),
  nullif(btrim(b.value->>'button_label'), ''),
  CASE WHEN b.value->>'link_type' IN ('home', 'store_home', 'product', 'category', 'external')
       THEN b.value->>'link_type' ELSE 'home' END,
  nullif(btrim(b.value->>'link_target'), ''),
  CASE WHEN b.value->>'sort_order' ~ '^[0-9]+$' THEN (b.value->>'sort_order')::int
       ELSE (b.ord - 1)::int END,
  coalesce((b.value->>'active')::boolean, true)
FROM public.store_settings ss
CROSS JOIN LATERAL jsonb_array_elements(
  CASE WHEN jsonb_typeof(ss.setting_value) = 'array' THEN ss.setting_value ELSE '[]'::jsonb END
) WITH ORDINALITY AS b(value, ord)
WHERE ss.setting_key = 'catalog_banners'
  AND coalesce(b.value->>'image_url', '') <> ''
  AND NOT EXISTS (SELECT 1 FROM public.store_banners x WHERE x.store_id = ss.store_id)
ON CONFLICT (id) DO NOTHING;
