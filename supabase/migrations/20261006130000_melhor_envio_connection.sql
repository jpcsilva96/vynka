-- Lote B (escopo checkout/entrega/pagamento): peso e medidas do produto e conexão de cada loja com
-- a própria conta do Melhor Envio (OAuth2: o lojista autoriza, o Vynka guarda as chaves no servidor).
-- As chaves da conta do lojista NUNCA são lidas pelo navegador: as duas tabelas de conexão não têm
-- policy para anon/authenticated (só o servidor, com a service role, lê e grava). A tela vê só o
-- status, pela função store_shipping_connection_status.
-- Rollback: apagar a função, as duas tabelas e as 4 colunas de products.

-- 1) Peso e medidas do produto (vazio = usa a embalagem padrão da loja).
ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS weight_kg numeric(6, 3) CHECK (weight_kg IS NULL OR (weight_kg > 0 AND weight_kg <= 30)),
  ADD COLUMN IF NOT EXISTS height_cm numeric(5, 1) CHECK (height_cm IS NULL OR (height_cm > 0 AND height_cm <= 100)),
  ADD COLUMN IF NOT EXISTS width_cm numeric(5, 1) CHECK (width_cm IS NULL OR (width_cm > 0 AND width_cm <= 100)),
  ADD COLUMN IF NOT EXISTS length_cm numeric(5, 1) CHECK (length_cm IS NULL OR (length_cm > 0 AND length_cm <= 100));

-- 2) Conexão da loja com o Melhor Envio. environment separa conta de teste (sandbox) e real.
CREATE TABLE IF NOT EXISTS public.store_shipping_connections (
  store_id uuid PRIMARY KEY REFERENCES public.stores(id) ON DELETE CASCADE,
  provider text NOT NULL DEFAULT 'melhor_envio' CHECK (provider = 'melhor_envio'),
  environment text NOT NULL CHECK (environment IN ('sandbox', 'production')),
  access_token text NOT NULL,
  refresh_token text NOT NULL,
  expires_at timestamptz NOT NULL,
  scope text,
  account_name text,
  account_email text,
  connected_by uuid,
  connected_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  -- Última falha de renovação/uso (ex. autorização revogada pelo lojista); NULL = ok.
  last_error text,
  last_error_at timestamptz
);

DROP TRIGGER IF EXISTS t_store_shipping_connections_updated ON public.store_shipping_connections;
CREATE TRIGGER t_store_shipping_connections_updated BEFORE UPDATE ON public.store_shipping_connections
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- 3) Pedido de autorização em andamento (o "state" do OAuth): amarra a volta do Melhor Envio à loja e
-- ao usuário que clicou em Conectar. Vale 15 minutos e é apagado ao concluir.
CREATE TABLE IF NOT EXISTS public.shipping_oauth_states (
  state text PRIMARY KEY CHECK (length(state) BETWEEN 20 AND 120),
  store_id uuid NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  environment text NOT NULL CHECK (environment IN ('sandbox', 'production')),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_shipping_oauth_states_created ON public.shipping_oauth_states (created_at);

ALTER TABLE public.store_shipping_connections ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shipping_oauth_states ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.store_shipping_connections, public.shipping_oauth_states FROM anon, authenticated;

-- 4) Status para a tela (sem as chaves): só dono/membro da loja e Master.
CREATE OR REPLACE FUNCTION public.store_shipping_connection_status(_store_id uuid)
RETURNS TABLE (
  connected boolean,
  environment text,
  account_name text,
  account_email text,
  connected_at timestamptz,
  expires_at timestamptz,
  last_error text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT true, c.environment, c.account_name, c.account_email, c.connected_at, c.expires_at, c.last_error
  FROM public.store_shipping_connections c
  WHERE c.store_id = _store_id
    AND (public.is_store_member(_store_id) OR public.is_platform_admin());
$$;

REVOKE ALL ON FUNCTION public.store_shipping_connection_status(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.store_shipping_connection_status(uuid) TO authenticated;
