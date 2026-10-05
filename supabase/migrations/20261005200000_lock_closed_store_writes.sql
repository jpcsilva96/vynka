-- Loja suspensa (ou cancelada) fica só leitura para o dono e para o cliente final; só o Master
-- (ou o servidor, com a service role) altera algo nela. E status, plano e datas da assinatura
-- da loja passam a ser só do Master, em qualquer situação.
--
-- Não mexe nas policies que já existem: acrescenta policies RESTRICTIVE (somam um "E" a todas as
-- permissões de escrita). Ler continua igual: o dono suspenso vê histórico, pedidos e clientes.
-- O catálogo público e o pedido online já saem do ar com a loja suspensa (store_is_public).
-- Rollback: apagar as policies "*_store_open_*", o gatilho e as 3 funções novas.

-- Loja aberta = active ou trial antigo (o painel mostra os dois como Ativa / Convite enviado).
CREATE OR REPLACE FUNCTION public.store_is_open(_store_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.stores
    WHERE id = _store_id AND status IN ('active', 'trial')
  );
$$;

-- 1) Tabelas com store_id: criar, editar e apagar só com a loja aberta (ou Master).
DO $$
DECLARE
  _t text;
BEGIN
  FOREACH _t IN ARRAY ARRAY[
    'categories', 'products', 'product_variants', 'store_settings', 'store_members',
    'customers', 'customer_favorites', 'orders', 'order_items'
  ] LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', _t || '_store_open_insert', _t);
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', _t || '_store_open_update', _t);
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', _t || '_store_open_delete', _t);
    EXECUTE format(
      'CREATE POLICY %I ON public.%I AS RESTRICTIVE FOR INSERT
         WITH CHECK (public.store_is_open(store_id) OR public.is_platform_admin())',
      _t || '_store_open_insert', _t);
    EXECUTE format(
      'CREATE POLICY %I ON public.%I AS RESTRICTIVE FOR UPDATE
         USING (public.store_is_open(store_id) OR public.is_platform_admin())
         WITH CHECK (public.store_is_open(store_id) OR public.is_platform_admin())',
      _t || '_store_open_update', _t);
    EXECUTE format(
      'CREATE POLICY %I ON public.%I AS RESTRICTIVE FOR DELETE
         USING (public.store_is_open(store_id) OR public.is_platform_admin())',
      _t || '_store_open_delete', _t);
  END LOOP;
END $$;

-- 2) Tabelas ligadas ao produto (sem store_id): a loja vem do produto.
CREATE OR REPLACE FUNCTION public.product_store_is_open(_product_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.products p
    WHERE p.id = _product_id AND public.store_is_open(p.store_id)
  );
$$;

DO $$
DECLARE
  _t text;
  _cond text;
BEGIN
  FOREACH _t IN ARRAY ARRAY['product_images', 'product_options', 'product_option_values'] LOOP
    _cond := CASE _t
      WHEN 'product_option_values' THEN
        '(EXISTS (SELECT 1 FROM public.product_options o WHERE o.id = option_id
                   AND public.product_store_is_open(o.product_id)) OR public.is_platform_admin())'
      ELSE '(public.product_store_is_open(product_id) OR public.is_platform_admin())'
    END;
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', _t || '_store_open_insert', _t);
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', _t || '_store_open_update', _t);
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', _t || '_store_open_delete', _t);
    EXECUTE format('CREATE POLICY %I ON public.%I AS RESTRICTIVE FOR INSERT WITH CHECK %s',
      _t || '_store_open_insert', _t, _cond);
    EXECUTE format('CREATE POLICY %I ON public.%I AS RESTRICTIVE FOR UPDATE USING %s WITH CHECK %s',
      _t || '_store_open_update', _t, _cond, _cond);
    EXECUTE format('CREATE POLICY %I ON public.%I AS RESTRICTIVE FOR DELETE USING %s',
      _t || '_store_open_delete', _t, _cond);
  END LOOP;
END $$;

-- 3) A própria loja: dono de loja fechada não edita a ficha.
DROP POLICY IF EXISTS "stores_store_open_update" ON public.stores;
CREATE POLICY "stores_store_open_update" ON public.stores AS RESTRICTIVE FOR UPDATE
  USING (public.store_is_open(id) OR public.is_platform_admin())
  WITH CHECK (public.store_is_open(id) OR public.is_platform_admin());

-- 4) Status, plano e datas da assinatura: só Master (ou servidor/SQL Editor, que não usam o papel
-- authenticated/anon). O dono continua editando o resto da ficha (dados, visual, publicar).
CREATE OR REPLACE FUNCTION public.protect_store_master_fields()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF current_user IN ('authenticated', 'anon') AND NOT public.is_platform_admin() AND (
       NEW.status IS DISTINCT FROM OLD.status
    OR NEW.plan_id IS DISTINCT FROM OLD.plan_id
    OR NEW.trial_ends_at IS DISTINCT FROM OLD.trial_ends_at
    OR NEW.subscription_ends_at IS DISTINCT FROM OLD.subscription_ends_at
  ) THEN
    RAISE EXCEPTION 'Somente o Master altera status, plano ou datas da assinatura da loja.'
      USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS t_stores_protect_master_fields ON public.stores;
CREATE TRIGGER t_stores_protect_master_fields
  BEFORE UPDATE ON public.stores
  FOR EACH ROW EXECUTE FUNCTION public.protect_store_master_fields();

-- 5) Arquivos (fotos de produto e marca): a pasta é o id da loja.
CREATE OR REPLACE FUNCTION public.store_file_writable(_bucket text, _name text)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SET search_path = public
AS $$
DECLARE
  _folder text;
BEGIN
  IF _bucket NOT IN ('product-images', 'store-branding') THEN
    RETURN true;
  END IF;
  IF public.is_platform_admin() THEN
    RETURN true;
  END IF;
  _folder := (storage.foldername(_name))[1];
  IF _folder ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' THEN
    RETURN public.store_is_open(_folder::uuid);
  END IF;
  RETURN false;
END;
$$;

DROP POLICY IF EXISTS "objects_store_open_insert" ON storage.objects;
DROP POLICY IF EXISTS "objects_store_open_update" ON storage.objects;
DROP POLICY IF EXISTS "objects_store_open_delete" ON storage.objects;
CREATE POLICY "objects_store_open_insert" ON storage.objects AS RESTRICTIVE FOR INSERT
  WITH CHECK (public.store_file_writable(bucket_id, name));
CREATE POLICY "objects_store_open_update" ON storage.objects AS RESTRICTIVE FOR UPDATE
  USING (public.store_file_writable(bucket_id, name))
  WITH CHECK (public.store_file_writable(bucket_id, name));
CREATE POLICY "objects_store_open_delete" ON storage.objects AS RESTRICTIVE FOR DELETE
  USING (public.store_file_writable(bucket_id, name));
