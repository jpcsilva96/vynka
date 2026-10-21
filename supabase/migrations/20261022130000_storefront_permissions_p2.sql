-- Lote de permissão, passo 2: aplicar SÓ depois de publicado o código que lê storefront_stores.
-- A leitura direta de stores fica para membros da loja e master. A vitrine lê a visão
-- storefront_stores (passo 1), que não tem tax_document, responsible_name, plan_id etc.
-- Medido 20/10: sem isto, qualquer visitante ou conta de cliente lê a linha inteira de toda loja ativa.
-- Visitante sem login (anon) perde todas as permissões em stores (nenhuma tela precisa).
--
-- Rollback: _snapshots/2026-10-20-permissao/ROLLBACK.md (fora do repo).

DROP POLICY stores_public_read ON public.stores;
CREATE POLICY stores_member_read ON public.stores
  FOR SELECT
  USING (public.is_store_member(id) OR public.is_platform_admin());

REVOKE ALL ON public.stores FROM anon;

NOTIFY pgrst, 'reload schema';
