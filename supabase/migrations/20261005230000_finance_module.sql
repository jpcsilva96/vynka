-- Finanças da loja (modelo Mobills): lançamentos de receita, despesa e ajuste de saldo, com
-- categorias e status Pago/Pendente. Vendas concluídas NÃO são copiadas: entram calculadas a partir
-- dos pedidos (receita = total; custo das mercadorias vendidas = custo gravado no item), então
-- cancelar/reabrir pedido já reflete sozinho.
-- Decisões de João (05/10): custo sai da venda (compra de mercadoria vai em categoria que não entra
-- no resultado); saldo parte do zero com as vendas já concluídas + ajuste manual; pendentes no MVP.
-- Acesso: dono/admin da loja e Master; loja suspensa só leitura (mesma trava das outras tabelas).
-- Rollback: apagar a função, as duas tabelas e o tipo.

DO $$ BEGIN
  CREATE TYPE public.finance_kind AS ENUM ('income', 'expense', 'adjustment');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Categorias: store_id NULL = padrão do Vynka (para todas as lojas, só o Master mexe).
CREATE TABLE IF NOT EXISTS public.finance_categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id uuid REFERENCES public.stores(id) ON DELETE CASCADE,
  kind public.finance_kind NOT NULL CHECK (kind IN ('income', 'expense')),
  name text NOT NULL CHECK (length(btrim(name)) BETWEEN 1 AND 60),
  -- false = só registro, fora do saldo e do resultado (ex. compra de mercadoria/estoque).
  affects_result boolean NOT NULL DEFAULT true,
  system_key text UNIQUE,
  position integer NOT NULL DEFAULT 100,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_finance_categories_store ON public.finance_categories (store_id);

CREATE TABLE IF NOT EXISTS public.finance_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id uuid NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  kind public.finance_kind NOT NULL,
  -- income/expense: valor positivo. adjustment: diferença com sinal (+ ou -).
  amount numeric(12, 2) NOT NULL,
  category_id uuid REFERENCES public.finance_categories(id) ON DELETE SET NULL,
  description text NOT NULL DEFAULT '' CHECK (length(description) <= 200),
  entry_date date NOT NULL DEFAULT ((now() AT TIME ZONE 'America/Sao_Paulo')::date),
  status text NOT NULL DEFAULT 'paid' CHECK (status IN ('paid', 'pending')),
  notes text CHECK (notes IS NULL OR length(notes) <= 1000),
  created_by uuid DEFAULT auth.uid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (
    (kind IN ('income', 'expense') AND amount > 0)
    OR (kind = 'adjustment' AND amount <> 0 AND status = 'paid' AND category_id IS NULL)
  )
);
CREATE INDEX IF NOT EXISTS idx_finance_entries_store_date ON public.finance_entries (store_id, entry_date);

DROP TRIGGER IF EXISTS t_finance_entries_updated ON public.finance_entries;
CREATE TRIGGER t_finance_entries_updated BEFORE UPDATE ON public.finance_entries
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Categoria do lançamento tem que ser do mesmo tipo e ser padrão ou da própria loja.
CREATE OR REPLACE FUNCTION public.check_finance_entry_category()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.category_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.finance_categories c
    WHERE c.id = NEW.category_id
      AND c.kind = NEW.kind
      AND (c.store_id IS NULL OR c.store_id = NEW.store_id)
  ) THEN
    RAISE EXCEPTION 'Categoria inválida para este lançamento.' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS t_finance_entries_category ON public.finance_entries;
CREATE TRIGGER t_finance_entries_category BEFORE INSERT OR UPDATE ON public.finance_entries
  FOR EACH ROW EXECUTE FUNCTION public.check_finance_entry_category();

ALTER TABLE public.finance_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.finance_entries ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.finance_categories, public.finance_entries FROM anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.finance_categories, public.finance_entries TO authenticated;

DROP POLICY IF EXISTS "finance_categories_read" ON public.finance_categories;
CREATE POLICY "finance_categories_read" ON public.finance_categories FOR SELECT
  USING (store_id IS NULL OR public.is_store_admin(store_id) OR public.is_platform_admin());
DROP POLICY IF EXISTS "finance_categories_admin_write" ON public.finance_categories;
CREATE POLICY "finance_categories_admin_write" ON public.finance_categories FOR ALL
  USING ((store_id IS NOT NULL AND public.is_store_admin(store_id) AND system_key IS NULL) OR public.is_platform_admin())
  WITH CHECK ((store_id IS NOT NULL AND public.is_store_admin(store_id) AND system_key IS NULL) OR public.is_platform_admin());

DROP POLICY IF EXISTS "finance_entries_admin_all" ON public.finance_entries;
CREATE POLICY "finance_entries_admin_all" ON public.finance_entries FOR ALL
  USING (public.is_store_admin(store_id) OR public.is_platform_admin())
  WITH CHECK (public.is_store_admin(store_id) OR public.is_platform_admin());

-- Loja suspensa/cancelada: só leitura (mesmo padrão da migration 20261005200000).
DO $$
DECLARE _t text;
BEGIN
  FOREACH _t IN ARRAY ARRAY['finance_entries', 'finance_categories'] LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', _t || '_store_open_insert', _t);
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', _t || '_store_open_update', _t);
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', _t || '_store_open_delete', _t);
    EXECUTE format(
      'CREATE POLICY %I ON public.%I AS RESTRICTIVE FOR INSERT
         WITH CHECK (store_id IS NULL OR public.store_is_open(store_id) OR public.is_platform_admin())',
      _t || '_store_open_insert', _t);
    EXECUTE format(
      'CREATE POLICY %I ON public.%I AS RESTRICTIVE FOR UPDATE
         USING (store_id IS NULL OR public.store_is_open(store_id) OR public.is_platform_admin())
         WITH CHECK (store_id IS NULL OR public.store_is_open(store_id) OR public.is_platform_admin())',
      _t || '_store_open_update', _t);
    EXECUTE format(
      'CREATE POLICY %I ON public.%I AS RESTRICTIVE FOR DELETE
         USING (store_id IS NULL OR public.store_is_open(store_id) OR public.is_platform_admin())',
      _t || '_store_open_delete', _t);
  END LOOP;
END $$;

-- Categorias padrão (system_key fixo; reaplicar não duplica).
INSERT INTO public.finance_categories (store_id, kind, name, affects_result, system_key, position) VALUES
  (NULL, 'income',  'Receita avulsa',                 true,  'income_other',   10),
  (NULL, 'income',  'Serviços',                       true,  'income_service', 20),
  (NULL, 'expense', 'Compra de mercadoria (estoque)', false, 'expense_stock',  10),
  (NULL, 'expense', 'Frete e envio',                  true,  'expense_shipping', 20),
  (NULL, 'expense', 'Embalagem',                      true,  'expense_packaging', 30),
  (NULL, 'expense', 'Anúncios e marketing',           true,  'expense_marketing', 40),
  (NULL, 'expense', 'Taxas (cartão, Mercado Pago)',   true,  'expense_fees',   50),
  (NULL, 'expense', 'Aluguel',                        true,  'expense_rent',   60),
  (NULL, 'expense', 'Contas (luz, internet, telefone)', true, 'expense_bills', 70),
  (NULL, 'expense', 'Pró-labore e salários',          true,  'expense_payroll', 80),
  (NULL, 'expense', 'Impostos',                       true,  'expense_taxes',  90),
  (NULL, 'expense', 'Outras despesas',                true,  'expense_other',  100)
ON CONFLICT (system_key) DO NOTHING;

-- Resumo do painel. SECURITY INVOKER: as permissões de quem chama valem (quem não é dono vê zeros).
-- Vendas = pedidos Concluídos (completed_at, dia de Brasília); custo = total_cost do item (ou
-- unit_cost x quantidade). Lançamentos em categoria que não entra no resultado ficam de fora.
CREATE OR REPLACE FUNCTION public.finance_summary(_store_id uuid, _from date, _to date)
RETURNS jsonb
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  WITH sales AS (
    SELECT
      (o.completed_at AT TIME ZONE 'America/Sao_Paulo')::date AS day,
      o.total::numeric AS revenue,
      coalesce((
        SELECT sum(coalesce(i.total_cost, coalesce(i.unit_cost, 0) * i.quantity))
        FROM public.order_items i WHERE i.order_id = o.id
      ), 0)::numeric AS cost
    FROM public.orders o
    WHERE o.store_id = _store_id AND o.status = 'delivered' AND o.completed_at IS NOT NULL
  ),
  entries AS (
    SELECT e.kind, e.amount, e.entry_date AS day, e.status
    FROM public.finance_entries e
    LEFT JOIN public.finance_categories c ON c.id = e.category_id
    WHERE e.store_id = _store_id AND coalesce(c.affects_result, true)
  )
  SELECT jsonb_build_object(
    'balance',
      coalesce((SELECT sum(revenue - cost) FROM sales), 0)
      + coalesce((SELECT sum(CASE kind WHEN 'expense' THEN -amount ELSE amount END)
                  FROM entries WHERE status = 'paid'), 0),
    'sales_revenue', coalesce((SELECT sum(revenue) FROM sales WHERE day BETWEEN _from AND _to), 0),
    'sales_cost', coalesce((SELECT sum(cost) FROM sales WHERE day BETWEEN _from AND _to), 0),
    'sales_count', (SELECT count(*) FROM sales WHERE day BETWEEN _from AND _to),
    'other_income', coalesce((SELECT sum(amount) FROM entries
                     WHERE kind = 'income' AND status = 'paid' AND day BETWEEN _from AND _to), 0),
    'expenses', coalesce((SELECT sum(amount) FROM entries
                 WHERE kind = 'expense' AND status = 'paid' AND day BETWEEN _from AND _to), 0),
    'pending_income', coalesce((SELECT sum(amount) FROM entries
                       WHERE kind = 'income' AND status = 'pending' AND day BETWEEN _from AND _to), 0),
    'pending_expense', coalesce((SELECT sum(amount) FROM entries
                        WHERE kind = 'expense' AND status = 'pending' AND day BETWEEN _from AND _to), 0)
  );
$$;

REVOKE ALL ON FUNCTION public.finance_summary(uuid, date, date) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.finance_summary(uuid, date, date) TO authenticated;
