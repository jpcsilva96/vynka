-- Configurações de checkout por loja (lote A do escopo checkout/entrega/pagamento, 06/10):
-- entrega local por cidade, retirada, Correios/transportadoras (Melhor Envio), frete grátis,
-- embalagem padrão, quando o estoque baixa e prazo para pagar por forma de pagamento.
-- Só guarda as escolhas do lojista; o checkout passa a usá-las nos lotes seguintes.
-- Leitura: pública com a loja no ar (o checkout precisa de cidades, valores e prazos), dono/membro
-- e Master. Escrita: dono/admin da loja e Master; loja suspensa só leitura (mesma trava das outras).
-- Rollback: apagar as duas tabelas.

CREATE TABLE IF NOT EXISTS public.store_checkout_settings (
  store_id uuid PRIMARY KEY REFERENCES public.stores(id) ON DELETE CASCADE,
  -- Entrega local: valor padrão para todas as cidades atendidas (cada cidade pode ter o seu).
  local_delivery_enabled boolean NOT NULL DEFAULT false,
  local_delivery_price numeric(10, 2) NOT NULL DEFAULT 0 CHECK (local_delivery_price >= 0),
  local_delivery_min_days integer NOT NULL DEFAULT 0 CHECK (local_delivery_min_days BETWEEN 0 AND 60),
  local_delivery_max_days integer NOT NULL DEFAULT 1 CHECK (local_delivery_max_days BETWEEN 0 AND 60),
  -- Retirada: para todos os clientes. Endereço vazio = endereço da loja.
  pickup_enabled boolean NOT NULL DEFAULT false,
  pickup_address text CHECK (pickup_address IS NULL OR length(pickup_address) <= 300),
  pickup_instructions text CHECK (pickup_instructions IS NULL OR length(pickup_instructions) <= 500),
  -- Correios e transportadoras via Melhor Envio: ids dos serviços que a loja oferece.
  shipping_enabled boolean NOT NULL DEFAULT false,
  shipping_services integer[] NOT NULL DEFAULT '{}',
  -- Embalagem padrão (produto sem peso/medidas usa esta).
  package_weight_kg numeric(6, 3) NOT NULL DEFAULT 0.3 CHECK (package_weight_kg > 0 AND package_weight_kg <= 30),
  package_height_cm numeric(5, 1) NOT NULL DEFAULT 4 CHECK (package_height_cm > 0 AND package_height_cm <= 100),
  package_width_cm numeric(5, 1) NOT NULL DEFAULT 12 CHECK (package_width_cm > 0 AND package_width_cm <= 100),
  package_length_cm numeric(5, 1) NOT NULL DEFAULT 17 CHECK (package_length_cm > 0 AND package_length_cm <= 100),
  -- Frete grátis: valor mínimo do carrinho (NULL = desligado) e em quais modalidades vale.
  free_shipping_min_amount numeric(10, 2) CHECK (free_shipping_min_amount IS NULL OR free_shipping_min_amount > 0),
  free_shipping_local boolean NOT NULL DEFAULT false,
  free_shipping_services integer[] NOT NULL DEFAULT '{}',
  -- Estoque: baixa ao fazer o pedido (reserva) ou ao confirmar o pagamento.
  stock_deduction text NOT NULL DEFAULT 'on_order' CHECK (stock_deduction IN ('on_order', 'on_payment')),
  -- Prazo para pagar; abaixo do mínimo não pode (Pix 24 h, boleto 3 dias: recomendação do MP).
  pix_expiration_hours integer NOT NULL DEFAULT 24 CHECK (pix_expiration_hours BETWEEN 24 AND 720),
  boleto_expiration_days integer NOT NULL DEFAULT 3 CHECK (boleto_expiration_days BETWEEN 3 AND 30),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (local_delivery_max_days >= local_delivery_min_days)
);

DROP TRIGGER IF EXISTS t_store_checkout_settings_updated ON public.store_checkout_settings;
CREATE TRIGGER t_store_checkout_settings_updated BEFORE UPDATE ON public.store_checkout_settings
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Cidades da entrega local, pelo código IBGE (o mesmo que a consulta de CEP devolve).
CREATE TABLE IF NOT EXISTS public.store_delivery_cities (
  store_id uuid NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  ibge_code text NOT NULL CHECK (ibge_code ~ '^[0-9]{7}$'),
  city_name text NOT NULL CHECK (length(btrim(city_name)) BETWEEN 1 AND 80),
  state text NOT NULL CHECK (state ~ '^[A-Z]{2}$'),
  -- NULL = usa o valor padrão da entrega local.
  price numeric(10, 2) CHECK (price IS NULL OR price >= 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (store_id, ibge_code)
);

ALTER TABLE public.store_checkout_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.store_delivery_cities ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.store_checkout_settings, public.store_delivery_cities FROM anon, authenticated;
GRANT SELECT ON public.store_checkout_settings, public.store_delivery_cities TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.store_checkout_settings, public.store_delivery_cities TO authenticated;

DO $$
DECLARE
  _t text;
BEGIN
  FOREACH _t IN ARRAY ARRAY['store_checkout_settings', 'store_delivery_cities'] LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', _t || '_public_read', _t);
    EXECUTE format(
      'CREATE POLICY %I ON public.%I FOR SELECT USING (public.store_is_public(store_id))',
      _t || '_public_read', _t);
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', _t || '_member_read', _t);
    EXECUTE format(
      'CREATE POLICY %I ON public.%I FOR SELECT
         USING (public.is_store_member(store_id) OR public.is_platform_admin())',
      _t || '_member_read', _t);
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', _t || '_admin_all', _t);
    EXECUTE format(
      'CREATE POLICY %I ON public.%I FOR ALL
         USING (public.is_store_admin(store_id) OR public.is_platform_admin())
         WITH CHECK (public.is_store_admin(store_id) OR public.is_platform_admin())',
      _t || '_admin_all', _t);
    -- Loja suspensa/cancelada: só leitura (mesmo padrão de 20261005200000).
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

-- Lojas existentes: a retirada que já estava ligada continua ligada; o horário de atendimento vira
-- a instrução de retirada. O resto começa desligado.
INSERT INTO public.store_checkout_settings (store_id, pickup_enabled, pickup_instructions)
SELECT id, coalesce(pickup_available, false), nullif(btrim(left(coalesce(business_hours, ''), 500)), '')
FROM public.stores
ON CONFLICT (store_id) DO NOTHING;
