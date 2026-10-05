-- Data de conclusão do pedido: vendas (pedido Concluído) passam a ser contadas pela data em que
-- foram concluídas; pedidos realizados seguem pela data de criação.
-- O banco preenche sozinho: vira Concluído (delivered) -> completed_at = agora; sai de Concluído
-- (reaberto ou cancelado) -> completed_at = NULL. Quem usa o app não consegue mudar a data à mão.
-- Pedidos já concluídos antes desta migration recebem updated_at como aproximação.
-- Rollback: apagar o gatilho, a função e a coluna.

ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS completed_at timestamptz;

CREATE OR REPLACE FUNCTION public.set_order_completed_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.status = 'delivered' THEN
    IF TG_OP = 'INSERT' THEN
      -- Só o servidor/SQL Editor pode informar a data; pelo app é sempre agora.
      IF NEW.completed_at IS NULL OR current_user IN ('authenticated', 'anon') THEN
        NEW.completed_at := now();
      END IF;
    ELSIF OLD.status IS DISTINCT FROM 'delivered' THEN
      NEW.completed_at := now();
    ELSIF current_user IN ('authenticated', 'anon') THEN
      NEW.completed_at := OLD.completed_at;
    END IF;
  ELSE
    NEW.completed_at := NULL;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS t_orders_completed_at ON public.orders;
CREATE TRIGGER t_orders_completed_at
  BEFORE INSERT OR UPDATE ON public.orders
  FOR EACH ROW EXECUTE FUNCTION public.set_order_completed_at();

-- Pedidos já concluídos: aproximação pela última alteração (não há registro da conclusão).
-- O gatilho de updated_at fica desligado só durante este UPDATE, para não apagar essa informação.
ALTER TABLE public.orders DISABLE TRIGGER t_orders_updated;
UPDATE public.orders
SET completed_at = updated_at
WHERE status = 'delivered' AND completed_at IS NULL;
ALTER TABLE public.orders ENABLE TRIGGER t_orders_updated;

CREATE INDEX IF NOT EXISTS idx_orders_store_completed_at
  ON public.orders (store_id, completed_at)
  WHERE completed_at IS NOT NULL;
