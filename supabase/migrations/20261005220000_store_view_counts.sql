-- Visitas da loja e visualizações de produto, só como contadores por dia (sem IP, sem usuário,
-- sem nenhum identificador de quem visitou). A loja pública chama track_store_view; o navegador
-- só chama 1 vez por dia por aparelho (controle no próprio navegador).
-- Não contam: loja fechada ou não publicada, produto inativo ou de outra loja, e quem está logado
-- como membro da loja ou Master.
-- Leitura: dono/membro da loja e Master. Escrita: só pela função.
-- Rollback: apagar a função e as duas tabelas.

CREATE TABLE IF NOT EXISTS public.store_daily_views (
  store_id uuid NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  day date NOT NULL,
  views integer NOT NULL DEFAULT 0,
  PRIMARY KEY (store_id, day)
);

CREATE TABLE IF NOT EXISTS public.product_daily_views (
  store_id uuid NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  day date NOT NULL,
  views integer NOT NULL DEFAULT 0,
  PRIMARY KEY (product_id, day)
);
CREATE INDEX IF NOT EXISTS idx_product_daily_views_store_day
  ON public.product_daily_views (store_id, day);

ALTER TABLE public.store_daily_views ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.product_daily_views ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.store_daily_views, public.product_daily_views FROM anon, authenticated;
GRANT SELECT ON public.store_daily_views, public.product_daily_views TO authenticated;

DROP POLICY IF EXISTS "store_daily_views_member_read" ON public.store_daily_views;
CREATE POLICY "store_daily_views_member_read" ON public.store_daily_views FOR SELECT
  USING (public.is_store_member(store_id) OR public.is_platform_admin());

DROP POLICY IF EXISTS "product_daily_views_member_read" ON public.product_daily_views;
CREATE POLICY "product_daily_views_member_read" ON public.product_daily_views FOR SELECT
  USING (public.is_store_member(store_id) OR public.is_platform_admin());

CREATE OR REPLACE FUNCTION public.track_store_view(_store_id uuid, _product_id uuid DEFAULT NULL)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _day date := (now() AT TIME ZONE 'America/Sao_Paulo')::date;
BEGIN
  IF _store_id IS NULL OR NOT public.store_is_public(_store_id) THEN
    RETURN;
  END IF;
  -- Lojista/membro da loja e Master conferindo a loja não contam.
  IF auth.uid() IS NOT NULL
     AND (public.is_store_member(_store_id) OR public.is_platform_admin()) THEN
    RETURN;
  END IF;

  IF _product_id IS NULL THEN
    INSERT INTO public.store_daily_views (store_id, day, views)
    VALUES (_store_id, _day, 1)
    ON CONFLICT (store_id, day) DO UPDATE SET views = store_daily_views.views + 1;
  ELSE
    IF NOT EXISTS (
      SELECT 1 FROM public.products
      WHERE id = _product_id AND store_id = _store_id AND status = 'active'
    ) THEN
      RETURN;
    END IF;
    INSERT INTO public.product_daily_views (store_id, product_id, day, views)
    VALUES (_store_id, _product_id, _day, 1)
    ON CONFLICT (product_id, day) DO UPDATE SET views = product_daily_views.views + 1;
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.track_store_view(uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.track_store_view(uuid, uuid) TO anon, authenticated;
