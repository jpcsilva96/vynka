-- Etiquetas do Melhor Envio, lote E1 (escopo etiquetas-melhor-envio.md, §4 e §6): onde a etiqueta de
-- cada pedido fica guardada e a única forma de o envio mover o pedido para Enviado/Entregue.
-- 1) order_shipments: uma etiqueta ativa por pedido (cancelada libera gerar outra). Membro da loja e
--    master leem; só o servidor (service_role) grava.
-- 2) shipping_webhook_events: registro dos avisos do Melhor Envio (só servidor).
-- 3) record_shipment_status: o servidor grava o status consultado na API e move o pedido só para a
--    frente (postado -> Enviado; entregue -> Entregue). Pedido cancelado não muda. A trava do pedido
--    (orders_website_guard) continua barrando o lojista; ela não vale para o servidor (auth.uid nulo).
-- Não muda tabela nem regra existente.
--
-- Rollback: _snapshots/2026-11-11-etiquetas-e1/ROLLBACK.md (fora do repo).

CREATE TABLE IF NOT EXISTS public.order_shipments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  store_id uuid NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  provider text NOT NULL DEFAULT 'melhor_envio',
  environment text NOT NULL CHECK (environment IN ('sandbox', 'production')),
  me_order_id text NOT NULL UNIQUE,
  protocol text,
  status text NOT NULL DEFAULT 'cart',
  service_id integer,
  service_name text,
  price numeric(10, 2),
  document_type text NOT NULL DEFAULT 'declaration' CHECK (document_type IN ('declaration', 'invoice')),
  invoice_key text CHECK (invoice_key IS NULL OR invoice_key ~ '^\d{44}$'),
  tracking text,
  tracking_url text,
  paid_at timestamptz,
  generated_at timestamptz,
  posted_at timestamptz,
  delivered_at timestamptz,
  cancelled_at timestamptz,
  last_error text,
  last_error_at timestamptz,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
-- Uma etiqueta ativa por pedido: gerar de novo só depois de cancelar.
CREATE UNIQUE INDEX IF NOT EXISTS idx_order_shipments_active
  ON public.order_shipments (order_id) WHERE status <> 'cancelled';
CREATE INDEX IF NOT EXISTS idx_order_shipments_store ON public.order_shipments (store_id, created_at);

DROP TRIGGER IF EXISTS t_order_shipments_updated ON public.order_shipments;
CREATE TRIGGER t_order_shipments_updated BEFORE UPDATE ON public.order_shipments
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.order_shipments ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.order_shipments FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.order_shipments TO authenticated;
GRANT ALL ON public.order_shipments TO service_role;
DROP POLICY IF EXISTS order_shipments_member_read ON public.order_shipments;
CREATE POLICY order_shipments_member_read ON public.order_shipments
  FOR SELECT TO authenticated
  USING (public.is_store_member(store_id) OR public.is_platform_admin());

CREATE TABLE IF NOT EXISTS public.shipping_webhook_events (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  event text,
  me_order_id text,
  signature_ok boolean,
  store_id uuid REFERENCES public.stores(id) ON DELETE SET NULL,
  order_id uuid REFERENCES public.orders(id) ON DELETE SET NULL,
  result text,
  received_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_shipping_webhook_events_received
  ON public.shipping_webhook_events (received_at);
ALTER TABLE public.shipping_webhook_events ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.shipping_webhook_events FROM PUBLIC, anon, authenticated;
GRANT ALL ON public.shipping_webhook_events TO service_role;

-- Status do Melhor Envio (consultado na API, nunca o corpo do aviso) -> etiqueta e pedido.
CREATE OR REPLACE FUNCTION public.record_shipment_status(
  _me_order_id text,
  _status text,
  _tracking text DEFAULT NULL,
  _tracking_url text DEFAULT NULL,
  _at timestamptz DEFAULT now()
)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  _s public.order_shipments%ROWTYPE;
  _order_status public.order_status;
  _target public.order_status;
BEGIN
  SELECT * INTO _s FROM public.order_shipments WHERE me_order_id = _me_order_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN 'unknown_shipment';
  END IF;

  UPDATE public.order_shipments SET
    status = _status,
    tracking = coalesce(nullif(_tracking, ''), tracking),
    tracking_url = coalesce(nullif(_tracking_url, ''), tracking_url),
    paid_at = CASE WHEN _status = 'released' THEN coalesce(paid_at, _at) ELSE paid_at END,
    generated_at = CASE WHEN _status = 'generated' THEN coalesce(generated_at, _at) ELSE generated_at END,
    posted_at = CASE WHEN _status IN ('posted', 'delivered') THEN coalesce(posted_at, _at) ELSE posted_at END,
    delivered_at = CASE WHEN _status = 'delivered' THEN coalesce(delivered_at, _at) ELSE delivered_at END,
    cancelled_at = CASE WHEN _status = 'cancelled' THEN coalesce(cancelled_at, _at) ELSE cancelled_at END
  WHERE id = _s.id;

  _target := CASE _status WHEN 'posted' THEN 'shipped'::public.order_status
                          WHEN 'delivered' THEN 'delivered'::public.order_status END;
  IF _target IS NULL THEN
    RETURN 'saved';
  END IF;

  SELECT status INTO _order_status FROM public.orders WHERE id = _s.order_id FOR UPDATE;
  -- Só para a frente; cancelado e já concluído ficam como estão.
  IF _order_status IN ('paid', 'in_production', 'in_dispatch')
     OR (_order_status = 'shipped' AND _target = 'delivered') THEN
    UPDATE public.orders SET status = _target WHERE id = _s.order_id;
    RETURN 'order_' || _target::text;
  END IF;
  RETURN 'saved';
END;
$$;

REVOKE ALL ON FUNCTION public.record_shipment_status(text, text, text, text, timestamptz)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.record_shipment_status(text, text, text, text, timestamptz)
  TO service_role;

NOTIFY pgrst, 'reload schema';
