-- Lote de permissão, passo 1 (só acrescenta; nada que funciona hoje deixa de funcionar).
-- Medido 20/10: a leitura pública de stores entrega a linha inteira (inclui tax_document,
-- responsible_name e plan_id) a qualquer visitante ou conta de cliente, e loja em rascunho aparece.
--
-- 1) storefront_stores: visão com só as colunas que a vitrine usa e só lojas publicadas.
--    Roda com os direitos do dono (ignora as regras de stores) e é somente leitura para anon e
--    authenticated. A leitura direta de stores fica restrita no passo 2, depois do código publicado.
-- 2) Banners públicos deixam de consultar stores direto (passa a store_is_public, mesma condição).
-- 3) Quem altera a própria ficha (user_id = conta logada) e não é membro da loja nem master não
--    muda e-mail, store_login, user_id, store_id nem notes (Meus dados só muda nome e telefone).
--    Vale para conta nova e antiga; servidor (sem conta logada), lojista e master seguem livres.
-- 4) Visitante sem login (anon) sem permissão em customers, customer_favorites, orders e
--    order_items: nenhuma tela usa essas tabelas sem login (as regras já devolviam 0 linhas).
--
-- Rollback: _snapshots/2026-10-20-permissao/ROLLBACK.md (fora do repo).

CREATE VIEW public.storefront_stores
WITH (security_barrier = true) AS
  SELECT id, slug, name, description, logo_url, banner_url, og_image_url, banner_title,
         banner_subtitle, banner_cta, phone, whatsapp, email, instagram, address, address_number,
         complement, city, state, zip_code, business_hours, status, publication_status
  FROM public.stores
  WHERE publication_status = 'published';

REVOKE ALL ON public.storefront_stores FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.storefront_stores TO anon, authenticated;

DROP POLICY store_banners_public_read ON public.store_banners;
CREATE POLICY store_banners_public_read ON public.store_banners
  FOR SELECT
  USING (active = true AND public.store_is_public(store_id));

CREATE OR REPLACE FUNCTION public.customers_guard_self_update()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NOT NULL AND OLD.user_id = auth.uid()
     AND NOT public.is_store_member(OLD.store_id) AND NOT public.is_platform_admin() AND (
       NEW.email IS DISTINCT FROM OLD.email
    OR NEW.store_login IS DISTINCT FROM OLD.store_login
    OR NEW.user_id IS DISTINCT FROM OLD.user_id
    OR NEW.store_id IS DISTINCT FROM OLD.store_id
    OR NEW.notes IS DISTINCT FROM OLD.notes
  ) THEN
    RAISE EXCEPTION 'Campo da ficha não pode ser alterado pela conta do cliente.'
      USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER t_customers_guard_self_update
  BEFORE UPDATE ON public.customers
  FOR EACH ROW EXECUTE FUNCTION public.customers_guard_self_update();

REVOKE ALL ON public.customers FROM anon;
REVOKE ALL ON public.customer_favorites FROM anon;
REVOKE ALL ON public.orders FROM anon;
REVOKE ALL ON public.order_items FROM anon;

NOTIFY pgrst, 'reload schema';
