-- Cor da categoria de finanças (badge): 8 cores fixas. Categorias padrão recebem cor própria;
-- as do lojista nascem cinza e ele escolhe ao criar.
-- Rollback: apagar a coluna.

ALTER TABLE public.finance_categories
  ADD COLUMN IF NOT EXISTS color text NOT NULL DEFAULT 'slate';

DO $$ BEGIN
  ALTER TABLE public.finance_categories ADD CONSTRAINT finance_categories_color_check
    CHECK (color IN ('slate', 'red', 'orange', 'amber', 'emerald', 'sky', 'violet', 'pink'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

UPDATE public.finance_categories AS c
SET color = v.color
FROM (VALUES
  ('income_other', 'emerald'),
  ('income_service', 'sky'),
  ('expense_stock', 'slate'),
  ('expense_shipping', 'orange'),
  ('expense_packaging', 'amber'),
  ('expense_marketing', 'pink'),
  ('expense_fees', 'violet'),
  ('expense_rent', 'red'),
  ('expense_bills', 'sky'),
  ('expense_payroll', 'emerald'),
  ('expense_taxes', 'red'),
  ('expense_other', 'slate')
) AS v(system_key, color)
WHERE c.system_key = v.system_key AND c.store_id IS NULL;
