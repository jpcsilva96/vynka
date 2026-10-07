-- Lote E1 (escopo checkout/entrega/pagamento §6 e §7): conexão de cada loja com a própria conta do
-- Mercado Pago (OAuth com PKCE; o dinheiro cai na conta do lojista) e pagamento do pedido do site.
-- Mesmo molde do Melhor Envio (20261006130000): as chaves da conta do lojista NUNCA são lidas pelo
-- navegador (tabelas sem policy para anon/authenticated); a tela vê só o status, pela função
-- store_payment_connection_status. O webhook (lote E3, servidor com service role) grava o que o
-- Mercado Pago responde em record_order_payment, que chama confirm_order_payment /
-- set_order_payment_deadline do lote D.
-- Rollback: rollback.sql da janela (2 funções, 3 tabelas, 5 colunas de orders, 1 índice).

-- 1) Conexão da loja. live_mode = false quando quem autorizou é conta de teste do Mercado Pago.
CREATE TABLE IF NOT EXISTS public.store_payment_connections (
  store_id uuid PRIMARY KEY REFERENCES public.stores(id) ON DELETE CASCADE,
  provider text NOT NULL DEFAULT 'mercado_pago' CHECK (provider = 'mercado_pago'),
  mp_user_id bigint NOT NULL,
  live_mode boolean NOT NULL,
  access_token text NOT NULL,
  refresh_token text NOT NULL,
  public_key text,
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
-- O aviso do webhook traz o user_id da conta do lojista: acha a loja por ele.
CREATE INDEX IF NOT EXISTS idx_store_payment_connections_mp_user
  ON public.store_payment_connections (mp_user_id);

DROP TRIGGER IF EXISTS t_store_payment_connections_updated ON public.store_payment_connections;
CREATE TRIGGER t_store_payment_connections_updated BEFORE UPDATE ON public.store_payment_connections
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- 2) Autorização em andamento (o "state" do OAuth + o code_verifier do PKCE). Vale 15 minutos e é
-- apagada ao concluir.
CREATE TABLE IF NOT EXISTS public.payment_oauth_states (
  state text PRIMARY KEY CHECK (length(state) BETWEEN 20 AND 120),
  store_id uuid NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  code_verifier text NOT NULL CHECK (length(code_verifier) BETWEEN 43 AND 128),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_payment_oauth_states_created ON public.payment_oauth_states (created_at);

-- 3) Avisos recebidos do Mercado Pago (diagnóstico e para não processar o mesmo aviso duas vezes).
CREATE TABLE IF NOT EXISTS public.payment_webhook_events (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  request_id text UNIQUE,
  topic text,
  resource_id text,
  mp_user_id bigint,
  store_id uuid REFERENCES public.stores(id) ON DELETE SET NULL,
  order_id uuid REFERENCES public.orders(id) ON DELETE SET NULL,
  result text,
  received_at timestamptz NOT NULL DEFAULT now(),
  processed_at timestamptz
);
CREATE INDEX IF NOT EXISTS idx_payment_webhook_events_received ON public.payment_webhook_events (received_at);

ALTER TABLE public.store_payment_connections ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payment_oauth_states ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payment_webhook_events ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.store_payment_connections, public.payment_oauth_states, public.payment_webhook_events
  FROM anon, authenticated;

-- 4) Pagamento no pedido. payment_method (já existe) recebe pix / boleto / credit / debit.
-- mp_payment_status guarda o status cru do Mercado Pago (pending, in_process, approved, rejected,
-- cancelled, refunded, charged_back...); o status do pedido continua sendo o do Vynka.
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS mp_preference_id text,
  ADD COLUMN IF NOT EXISTS mp_payment_id text,
  ADD COLUMN IF NOT EXISTS mp_payment_status text,
  ADD COLUMN IF NOT EXISTS mp_payment_status_detail text,
  ADD COLUMN IF NOT EXISTS mp_payment_updated_at timestamptz;

CREATE UNIQUE INDEX IF NOT EXISTS idx_orders_mp_preference
  ON public.orders (mp_preference_id) WHERE mp_preference_id IS NOT NULL;

-- 5) Status para a tela (sem as chaves): só dono/membro da loja e Master.
CREATE OR REPLACE FUNCTION public.store_payment_connection_status(_store_id uuid)
RETURNS TABLE (
  connected boolean,
  live_mode boolean,
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
  SELECT true, c.live_mode, c.account_name, c.account_email, c.connected_at, c.expires_at, c.last_error
  FROM public.store_payment_connections c
  WHERE c.store_id = _store_id
    AND (public.is_store_member(_store_id) OR public.is_platform_admin());
$$;

REVOKE ALL ON FUNCTION public.store_payment_connection_status(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.store_payment_connection_status(uuid) TO authenticated;

-- 6) Grava o pagamento que o servidor consultou no Mercado Pago (nunca o corpo do aviso: o servidor
-- busca o pagamento pela API com a chave da loja antes de chamar). Só service role.
-- _method: pix | boleto | credit | debit | null. Regras:
-- * approved -> confirm_order_payment (baixa na loja "ao pagar"; pago após prazo volta a valer).
-- * pending/in_process com Pix ou boleto -> prazo daquela forma; cartão em análise -> sem prazo.
-- * rejected/cancelled -> só registra (o cliente pode tentar de novo até o prazo); se o pedido
--   estava sem prazo (cartão em análise), volta o prazo do Pix.
-- * refunded/charged_back -> só registra (o pedido segue pago; a loja decide o que fazer).
-- * Pagamento mais antigo que o já registrado não sobrescreve (avisos chegam fora de ordem).
-- Retorno: resultado de confirm_order_payment, 'deadline_set', 'recorded', 'stale' ou 'not_found'.
CREATE OR REPLACE FUNCTION public.record_order_payment(
  _order_id uuid,
  _store_id uuid,
  _payment_id text,
  _status text,
  _status_detail text,
  _method text,
  _updated_at timestamptz,
  _approved_at timestamptz DEFAULT NULL
) RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _o public.orders%ROWTYPE;
BEGIN
  IF coalesce(_payment_id, '') = '' OR coalesce(_status, '') = '' THEN
    RAISE EXCEPTION 'Pagamento sem id ou status.';
  END IF;
  IF _method IS NOT NULL AND _method NOT IN ('pix', 'boleto', 'credit', 'debit') THEN
    RAISE EXCEPTION 'Forma de pagamento inválida: %', _method;
  END IF;

  -- A loja vem da conexão que recebeu o aviso: pedido de outra loja não é tocado.
  SELECT * INTO _o FROM public.orders
  WHERE id = _order_id AND store_id = _store_id AND source = 'website'
  FOR UPDATE;
  IF NOT FOUND THEN
    RETURN 'not_found';
  END IF;

  -- Já pago por outro pagamento: só registra se for o mesmo (ex. estorno do aprovado).
  IF _o.paid_at IS NOT NULL AND _o.mp_payment_id IS DISTINCT FROM _payment_id THEN
    RETURN 'stale';
  END IF;
  IF _o.mp_payment_id = _payment_id AND _o.mp_payment_updated_at IS NOT NULL
     AND _updated_at IS NOT NULL AND _updated_at < _o.mp_payment_updated_at THEN
    RETURN 'stale';
  END IF;

  UPDATE public.orders SET
    mp_payment_id = _payment_id,
    mp_payment_status = _status,
    mp_payment_status_detail = _status_detail,
    mp_payment_updated_at = coalesce(_updated_at, now()),
    payment_method = coalesce(_method, payment_method)
  WHERE id = _order_id;

  IF _status = 'approved' THEN
    RETURN public.confirm_order_payment(_order_id, coalesce(_approved_at, _updated_at, now()));
  END IF;

  IF _status IN ('pending', 'in_process', 'authorized') AND _o.paid_at IS NULL THEN
    IF _method IN ('pix', 'boleto') THEN
      PERFORM public.set_order_payment_deadline(_order_id, _method);
      RETURN 'deadline_set';
    ELSIF _method IN ('credit', 'debit') THEN
      PERFORM public.set_order_payment_deadline(_order_id, 'card');
      RETURN 'deadline_set';
    END IF;
  END IF;

  -- Cartão em análise tirou o prazo e depois foi recusado: volta o prazo do Pix (contado da criação;
  -- se já passou, o agendador cancela e devolve as peças).
  IF _status IN ('rejected', 'cancelled') AND _o.paid_at IS NULL AND _o.payment_due_at IS NULL THEN
    PERFORM public.set_order_payment_deadline(_order_id, 'pix');
    RETURN 'deadline_set';
  END IF;

  RETURN 'recorded';
END;
$$;

REVOKE ALL ON FUNCTION public.record_order_payment(uuid, uuid, text, text, text, text, timestamptz, timestamptz)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.record_order_payment(uuid, uuid, text, text, text, text, timestamptz, timestamptz)
  TO service_role;
