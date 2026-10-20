-- Vários endereços por cliente (catálogo lote 5a, "Meus endereços").
-- O cliente guarda até 10 endereços na sua conta da loja; um deles é o principal.
-- O principal continua copiado nas colunas de endereço da ficha (customers), para o painel do
-- lojista e o checkout atual seguirem iguais. A cópia é só num sentido (endereços -> ficha).
--
-- 1) Tabela customer_addresses (loja + ficha), sem acesso anônimo.
-- 2) Regras: cliente lê/escreve só os endereços da própria ficha e da própria loja; lojista e
--    master só leem; loja suspensa fica só leitura (mesma regra das outras tabelas do cliente).
-- 3) Endereço que já está na ficha de cliente com login vira o 1º endereço (principal).
-- 4) Gatilhos: 1º endereço vira principal; marcar outro como principal desmarca o anterior;
--    o principal não é desmarcado sozinho; apagar o principal promove o mais recente; teto de 10;
--    a ficha recebe a cópia do principal.
--
-- Rollback: _snapshots/2026-10-20-enderecos/ROLLBACK.md (fora do repo).

CREATE TABLE IF NOT EXISTS public.customer_addresses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id uuid NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  customer_id uuid NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
  label text CHECK (label IS NULL OR char_length(label) <= 40),
  zip_code text NOT NULL CHECK (zip_code ~ '^[0-9]{8}$'),
  street text NOT NULL CHECK (char_length(btrim(street)) BETWEEN 1 AND 200),
  address_number text NOT NULL CHECK (char_length(btrim(address_number)) BETWEEN 1 AND 20),
  complement text CHECK (complement IS NULL OR char_length(complement) <= 120),
  neighborhood text NOT NULL CHECK (char_length(btrim(neighborhood)) BETWEEN 1 AND 120),
  city text NOT NULL CHECK (char_length(btrim(city)) BETWEEN 1 AND 120),
  state text NOT NULL CHECK (state ~ '^[A-Z]{2}$'),
  is_default boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_customer_addresses_customer ON public.customer_addresses (customer_id);
CREATE UNIQUE INDEX IF NOT EXISTS customer_addresses_one_default
  ON public.customer_addresses (customer_id) WHERE is_default;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.customer_addresses TO authenticated;
GRANT ALL ON public.customer_addresses TO service_role;
ALTER TABLE public.customer_addresses ENABLE ROW LEVEL SECURITY;

CREATE POLICY customer_addresses_client_all ON public.customer_addresses FOR ALL TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.customers c
    WHERE c.id = customer_id AND c.user_id = auth.uid() AND c.store_id = customer_addresses.store_id
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.customers c
    WHERE c.id = customer_id AND c.user_id = auth.uid() AND c.store_id = customer_addresses.store_id
  ));

CREATE POLICY customer_addresses_member_read ON public.customer_addresses FOR SELECT TO authenticated
  USING (public.is_store_member(store_id) OR public.is_platform_admin());

CREATE POLICY customer_addresses_customer_store_scope ON public.customer_addresses
  AS RESTRICTIVE FOR ALL TO authenticated
  USING (public.customer_store_ok(store_id))
  WITH CHECK (public.customer_store_ok(store_id));

CREATE POLICY customer_addresses_store_open_insert ON public.customer_addresses
  AS RESTRICTIVE FOR INSERT
  WITH CHECK (public.store_is_open(store_id) OR public.is_platform_admin());
CREATE POLICY customer_addresses_store_open_update ON public.customer_addresses
  AS RESTRICTIVE FOR UPDATE
  USING (public.store_is_open(store_id) OR public.is_platform_admin())
  WITH CHECK (public.store_is_open(store_id) OR public.is_platform_admin());
CREATE POLICY customer_addresses_store_open_delete ON public.customer_addresses
  AS RESTRICTIVE FOR DELETE
  USING (public.store_is_open(store_id) OR public.is_platform_admin());

-- 3) Endereço já salvo na ficha (só fichas com login e endereço completo). Roda antes dos
-- gatilhos: a ficha não é regravada.
INSERT INTO public.customer_addresses
  (store_id, customer_id, zip_code, street, address_number, complement, neighborhood, city, state, is_default)
SELECT c.store_id, c.id, regexp_replace(c.zip_code, '\D', '', 'g'), btrim(c.street),
       btrim(c.address_number), nullif(btrim(coalesce(c.complement, '')), ''),
       btrim(c.neighborhood), btrim(c.city), upper(btrim(c.state)), true
FROM public.customers c
WHERE c.user_id IS NOT NULL
  AND regexp_replace(coalesce(c.zip_code, ''), '\D', '', 'g') ~ '^[0-9]{8}$'
  AND coalesce(btrim(c.street), '') <> ''
  AND coalesce(btrim(c.address_number), '') <> ''
  AND coalesce(btrim(c.neighborhood), '') <> ''
  AND coalesce(btrim(c.city), '') <> ''
  AND upper(btrim(coalesce(c.state, ''))) ~ '^[A-Z]{2}$'
  AND NOT EXISTS (SELECT 1 FROM public.customer_addresses a WHERE a.customer_id = c.id);

-- 4) Gatilhos.
CREATE OR REPLACE FUNCTION public.customer_addresses_before()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  NEW.updated_at := now();
  NEW.zip_code := regexp_replace(NEW.zip_code, '\D', '', 'g');
  NEW.state := upper(btrim(NEW.state));
  IF TG_OP = 'UPDATE' THEN
    IF NEW.customer_id <> OLD.customer_id OR NEW.store_id <> OLD.store_id THEN
      RAISE EXCEPTION 'O endereço não pode mudar de cliente ou de loja.';
    END IF;
    -- Desmarcar o principal direto não vale: troca-se marcando outro (que desmarca este por dentro).
    IF OLD.is_default AND NOT NEW.is_default AND pg_trigger_depth() = 1 THEN
      NEW.is_default := true;
    END IF;
  END IF;
  IF TG_OP = 'INSERT' THEN
    -- Trava a ficha: dois cadastros ao mesmo tempo contam um de cada vez.
    PERFORM 1 FROM public.customers WHERE id = NEW.customer_id FOR UPDATE;
    IF (SELECT count(*) FROM public.customer_addresses WHERE customer_id = NEW.customer_id) >= 10 THEN
      RAISE EXCEPTION 'Limite de 10 endereços por conta.' USING ERRCODE = 'check_violation';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM public.customer_addresses WHERE customer_id = NEW.customer_id) THEN
      NEW.is_default := true;
    END IF;
  END IF;
  IF NEW.is_default AND (TG_OP = 'INSERT' OR NOT OLD.is_default) THEN
    UPDATE public.customer_addresses SET is_default = false
    WHERE customer_id = NEW.customer_id AND is_default AND id <> NEW.id;
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.customer_addresses_after()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _customer uuid;
  _main public.customer_addresses%ROWTYPE;
BEGIN
  IF TG_OP = 'DELETE' THEN
    _customer := OLD.customer_id;
  ELSE
    _customer := NEW.customer_id;
  END IF;
  -- Apagou o principal: o mais recente que sobrou vira principal (esse UPDATE volta aqui e copia).
  IF TG_OP = 'DELETE' AND OLD.is_default THEN
    UPDATE public.customer_addresses SET is_default = true
    WHERE id = (SELECT id FROM public.customer_addresses WHERE customer_id = _customer
                ORDER BY created_at DESC LIMIT 1);
    IF FOUND THEN
      RETURN NULL;
    END IF;
    -- Era o último endereço: a ficha fica sem endereço.
    UPDATE public.customers SET zip_code = NULL, street = NULL, address_number = NULL,
      complement = NULL, neighborhood = NULL, city = NULL, state = NULL
    WHERE id = _customer;
    RETURN NULL;
  END IF;
  SELECT * INTO _main FROM public.customer_addresses WHERE customer_id = _customer AND is_default;
  IF FOUND AND (TG_OP = 'DELETE' OR NEW.id = _main.id) THEN
    UPDATE public.customers SET zip_code = _main.zip_code, street = _main.street,
      address_number = _main.address_number, complement = _main.complement,
      neighborhood = _main.neighborhood, city = _main.city, state = _main.state
    WHERE id = _customer;
  END IF;
  RETURN NULL;
END;
$$;

REVOKE ALL ON FUNCTION public.customer_addresses_before() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.customer_addresses_after() FROM PUBLIC, anon, authenticated;

CREATE TRIGGER t_customer_addresses_before
  BEFORE INSERT OR UPDATE ON public.customer_addresses
  FOR EACH ROW EXECUTE FUNCTION public.customer_addresses_before();

CREATE TRIGGER t_customer_addresses_after
  AFTER INSERT OR UPDATE OR DELETE ON public.customer_addresses
  FOR EACH ROW EXECUTE FUNCTION public.customer_addresses_after();
