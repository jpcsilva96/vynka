-- Login do cliente separado por loja (escopo login-por-loja, lote L2).
-- A conta de cliente do modelo novo traz em app_metadata (só o servidor grava):
--   role = 'customer' e store_id = loja da conta.
-- Esta migration NÃO mexe nas regras existentes: acrescenta regras RESTRITIVAS que só pesam para
-- conta de cliente. Lojista, master e contas antigas seguem com as regras de hoje.
--
-- 1) is_customer_account(): a conta logada é cliente do modelo novo.
-- 2) customer_store_ok(loja): conta que não é cliente passa; cliente só na própria loja.
-- 3) customers.store_login: ficha com login do modelo novo (gravada pelo servidor no cadastro).
--    E-mail e telefone únicos por loja só entre essas fichas (fichas antigas podem repetir).
-- 4) Trava da loja em customers, customer_favorites, orders e order_items.
-- 5) Só conta de cliente cria ficha ligada a si mesma (lojista/master não viram cliente pela loja).
--
-- Rollback: _snapshots/2026-10-20-login-por-loja/ROLLBACK.md (fora do repo).

CREATE OR REPLACE FUNCTION public.is_customer_account()
RETURNS boolean
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  SELECT coalesce(auth.jwt() -> 'app_metadata' ->> 'role', '') = 'customer'
$$;

CREATE OR REPLACE FUNCTION public.customer_store_ok(_store_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  SELECT NOT public.is_customer_account()
      OR (auth.jwt() -> 'app_metadata' ->> 'store_id') = _store_id::text
$$;

ALTER TABLE public.customers ADD COLUMN IF NOT EXISTS store_login boolean NOT NULL DEFAULT false;

CREATE UNIQUE INDEX IF NOT EXISTS customers_store_login_email_uniq
  ON public.customers (store_id, lower(email))
  WHERE store_login AND email IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS customers_store_login_phone_uniq
  ON public.customers (store_id, regexp_replace(phone, '\D', '', 'g'))
  WHERE store_login AND coalesce(phone, '') <> '';

CREATE POLICY customers_customer_store_scope ON public.customers
  AS RESTRICTIVE FOR ALL TO authenticated
  USING (public.customer_store_ok(store_id))
  WITH CHECK (public.customer_store_ok(store_id));

CREATE POLICY customers_self_link_customer_only ON public.customers
  AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (user_id IS DISTINCT FROM auth.uid() OR public.is_customer_account());

CREATE POLICY favorites_customer_store_scope ON public.customer_favorites
  AS RESTRICTIVE FOR ALL TO authenticated
  USING (public.customer_store_ok(store_id))
  WITH CHECK (public.customer_store_ok(store_id));

CREATE POLICY orders_customer_store_scope ON public.orders
  AS RESTRICTIVE FOR ALL TO authenticated
  USING (public.customer_store_ok(store_id))
  WITH CHECK (public.customer_store_ok(store_id));

CREATE POLICY order_items_customer_store_scope ON public.order_items
  AS RESTRICTIVE FOR ALL TO authenticated
  USING (public.customer_store_ok(store_id))
  WITH CHECK (public.customer_store_ok(store_id));
