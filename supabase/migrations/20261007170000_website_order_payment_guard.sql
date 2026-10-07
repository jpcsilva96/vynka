-- Lote E4 (escopo checkout/entrega/pagamento, regra 1): pedido do site só vira pago pelo gateway.
-- O painel grava o pedido direto pelo navegador (policy de membro da loja), então esconder o botão
-- não basta: este gatilho barra, para quem está logado (lojista ou Master pelo painel):
-- * tirar um pedido do site de "pending" para qualquer status que não seja "cancelled";
-- * mexer num pedido do site já cancelado;
-- * alterar os dados de pagamento do pedido do site (forma, paid_at, prazo, mp_*, falta de estoque);
-- * criar pedido com origem "website" (só o checkout, pelo servidor, cria).
-- Servidor (service role), webhook e agendador não têm usuário logado (auth.uid() nulo) e passam.
-- Vendas manuais não são afetadas.
-- Rollback: DROP TRIGGER t_orders_website_guard + DROP FUNCTION orders_website_guard.

CREATE OR REPLACE FUNCTION public.orders_website_guard()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
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

  IF NEW.status IS DISTINCT FROM OLD.status THEN
    IF OLD.status = 'cancelled' THEN
      RAISE EXCEPTION 'Pedido cancelado não pode ser reaberto.' USING ERRCODE = '42501';
    END IF;
    IF OLD.status = 'pending' AND NEW.status <> 'cancelled' THEN
      RAISE EXCEPTION 'Pedido do site só é confirmado quando o Mercado Pago aprova o pagamento.'
        USING ERRCODE = '42501';
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

DROP TRIGGER IF EXISTS t_orders_website_guard ON public.orders;
CREATE TRIGGER t_orders_website_guard
  BEFORE INSERT OR UPDATE ON public.orders
  FOR EACH ROW EXECUTE FUNCTION public.orders_website_guard();
