-- Etapas do pedido do site pago (ata 07/10, D1) + linha do tempo do cliente.
-- 1) order_status_events: uma linha a cada status que o pedido recebe (gatilho), com quem mudou
--    ("painel" = usuário logado; "sistema" = checkout, webhook, agendador). Lê quem lê o pedido
--    (a policy reaproveita a RLS de orders: lojista, Master e o próprio cliente). Ninguém logado grava.
-- 2) Pedidos que já existem: eventos aproximados ("importado") a partir de created_at, paid_at,
--    completed_at e updated_at; o histórico de etapas de antes não existe.
-- 3) Trava do pedido do site (substitui a função do lote E4, mesmas regras + estas), para logado:
--    * pedido pago só anda para a frente: Pago -> Em separação -> Saiu para entrega / Pronto para
--      retirada -> Entregue / Retirado (pode pular etapa; nunca volta, nem para Pendente/Confirmado);
--    * "Enviado" e entrega por Correios/transportadora: Enviado/Entregue só pelo Melhor Envio
--      (servidor); o lojista só marca "Em separação" ou cancela;
--    * forma de entrega do pedido do site não muda pelo painel.
-- Venda manual não é afetada. Rollback: ver ROLLBACK.md da janela (volta a função do E4).

-- 1) Eventos
CREATE TABLE IF NOT EXISTS public.order_status_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  store_id uuid NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  status public.order_status NOT NULL,
  actor text NOT NULL CHECK (actor IN ('painel', 'sistema', 'importado')),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_order_status_events_order
  ON public.order_status_events (order_id, created_at);

ALTER TABLE public.order_status_events ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.order_status_events FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.order_status_events TO authenticated;
GRANT ALL ON public.order_status_events TO service_role;

DROP POLICY IF EXISTS "order_status_events_read" ON public.order_status_events;
CREATE POLICY "order_status_events_read" ON public.order_status_events FOR SELECT
  USING (EXISTS (SELECT 1 FROM public.orders o WHERE o.id = order_id));

CREATE OR REPLACE FUNCTION public.order_status_events_log()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' OR NEW.status IS DISTINCT FROM OLD.status THEN
    INSERT INTO public.order_status_events (order_id, store_id, status, actor, created_at)
    VALUES (NEW.id, NEW.store_id, NEW.status,
            CASE WHEN auth.uid() IS NULL THEN 'sistema' ELSE 'painel' END, clock_timestamp());
  END IF;
  RETURN NULL;
END;
$$;
REVOKE ALL ON FUNCTION public.order_status_events_log() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS t_order_status_events ON public.orders;
CREATE TRIGGER t_order_status_events
  AFTER INSERT OR UPDATE OF status ON public.orders
  FOR EACH ROW EXECUTE FUNCTION public.order_status_events_log();

-- 2) Pedidos existentes (só os que ainda não têm evento: reaplicar não duplica)
INSERT INTO public.order_status_events (order_id, store_id, status, actor, created_at)
SELECT o.id, o.store_id, e.status, 'importado', e.at
FROM public.orders o
CROSS JOIN LATERAL (
  VALUES
    ('pending'::public.order_status, o.created_at, o.source = 'website'),
    ('paid'::public.order_status, o.paid_at, o.source = 'website' AND o.paid_at IS NOT NULL),
    (o.status, coalesce(o.completed_at, o.updated_at, o.created_at),
     o.source <> 'website' OR o.status NOT IN ('pending', 'paid'))
) AS e(status, at, keep)
WHERE e.keep
  AND NOT EXISTS (SELECT 1 FROM public.order_status_events x WHERE x.order_id = o.id);

-- 3) Trava do pedido do site
CREATE OR REPLACE FUNCTION public.orders_website_guard()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  _rank_old int;
  _rank_new int;
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'INSERT' THEN
    IF NEW.source = 'website' THEN
      RAISE EXCEPTION 'Pedido do site só é criado pelo checkout da loja.' USING ERRCODE = '42501';
    END IF;
    RETURN NEW;
  END IF;

  IF OLD.source <> 'website' THEN
    RETURN NEW;
  END IF;
  IF NEW.source IS DISTINCT FROM OLD.source THEN
    RAISE EXCEPTION 'A origem do pedido não pode ser alterada.' USING ERRCODE = '42501';
  END IF;
  IF NEW.delivery_method IS DISTINCT FROM OLD.delivery_method THEN
    RAISE EXCEPTION 'A forma de entrega do pedido do site não pode ser alterada.' USING ERRCODE = '42501';
  END IF;

  IF NEW.status IS DISTINCT FROM OLD.status THEN
    IF OLD.status = 'cancelled' THEN
      RAISE EXCEPTION 'Pedido cancelado não pode ser reaberto.' USING ERRCODE = '42501';
    END IF;
    IF OLD.status = 'pending' AND NEW.status <> 'cancelled' THEN
      RAISE EXCEPTION 'Pedido do site só é confirmado quando o Mercado Pago aprova o pagamento.'
        USING ERRCODE = '42501';
    END IF;
    IF NEW.status <> 'cancelled' THEN
      IF NEW.status = 'shipped'
         OR (OLD.delivery_method = 'shipping' AND NEW.status IN ('in_dispatch', 'delivered')) THEN
        RAISE EXCEPTION 'Envio por Correios/transportadora é atualizado pelo Melhor Envio.'
          USING ERRCODE = '42501';
      END IF;
      _rank_old := CASE OLD.status WHEN 'paid' THEN 1 WHEN 'in_production' THEN 2
        WHEN 'in_dispatch' THEN 3 WHEN 'shipped' THEN 3 WHEN 'delivered' THEN 4 ELSE 0 END;
      _rank_new := CASE NEW.status WHEN 'in_production' THEN 2 WHEN 'in_dispatch' THEN 3
        WHEN 'delivered' THEN 4 ELSE 0 END;
      IF _rank_new <= _rank_old THEN
        RAISE EXCEPTION 'A etapa do pedido do site só anda para a frente.' USING ERRCODE = '42501';
      END IF;
    END IF;
  END IF;

  IF NEW.payment_method IS DISTINCT FROM OLD.payment_method
     OR NEW.paid_at IS DISTINCT FROM OLD.paid_at
     OR NEW.payment_due_at IS DISTINCT FROM OLD.payment_due_at
     OR NEW.stock_shortage IS DISTINCT FROM OLD.stock_shortage
     OR NEW.mp_preference_id IS DISTINCT FROM OLD.mp_preference_id
     OR NEW.mp_payment_id IS DISTINCT FROM OLD.mp_payment_id
     OR NEW.mp_payment_status IS DISTINCT FROM OLD.mp_payment_status
     OR NEW.mp_payment_status_detail IS DISTINCT FROM OLD.mp_payment_status_detail
     OR NEW.mp_payment_updated_at IS DISTINCT FROM OLD.mp_payment_updated_at THEN
    RAISE EXCEPTION 'Os dados de pagamento do pedido do site vêm do Mercado Pago.' USING ERRCODE = '42501';
  END IF;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.orders_website_guard() FROM PUBLIC, anon, authenticated;
