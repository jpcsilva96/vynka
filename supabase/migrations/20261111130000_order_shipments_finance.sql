-- Etiquetas do Melhor Envio, lote E3: a etiqueta guarda o lançamento de Finanças que ela criou.
-- Frete grátis para o cliente = a loja paga a etiqueta -> despesa "Frete e envio" (João, 11/11).
-- Cancelar a etiqueta apaga esse lançamento; por isso a ligação. Só acrescenta uma coluna.
--
-- Rollback: _snapshots/2026-11-11-etiquetas-e3/ROLLBACK.md (fora do repo).

ALTER TABLE public.order_shipments
  ADD COLUMN IF NOT EXISTS finance_entry_id uuid
    REFERENCES public.finance_entries(id) ON DELETE SET NULL;

NOTIFY pgrst, 'reload schema';
