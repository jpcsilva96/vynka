import { cn } from "@/lib/utils";

// Controle de estoque do produto (lote D). Com variações, a quantidade é por variação (tabela de
// variações); sem variação, a quantidade fica no próprio produto. O pedido do site baixa conforme a
// configuração da loja; a venda manual baixa ao ser concluída; cancelar devolve.
export function StockFields({
  manageStock,
  hasVariants,
  quantity,
  onManageStockChange,
  onQuantityChange,
}: {
  manageStock: boolean;
  hasVariants: boolean;
  quantity: number;
  onManageStockChange: (value: boolean) => void;
  onQuantityChange: (value: number) => void;
}) {
  return (
    <div className="space-y-4">
      <label className="flex cursor-pointer items-center justify-between gap-4">
        <span className="min-w-0">
          <span className="block text-[14px] font-medium text-foreground">Controlar estoque</span>
          <span className="mt-1 block text-[13px] text-muted-foreground">
            Sem estoque, o produto aparece como indisponível na loja.
          </span>
        </span>
        <button
          type="button"
          role="switch"
          aria-checked={manageStock}
          onClick={() => onManageStockChange(!manageStock)}
          className={cn(
            "relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors",
            manageStock ? "bg-emerald-500" : "bg-border",
          )}
        >
          <span
            className={cn(
              "inline-block h-4 w-4 transform rounded-full bg-background transition-transform",
              manageStock ? "translate-x-4" : "translate-x-0.5",
            )}
          />
        </button>
      </label>

      {manageStock &&
        (hasVariants ? (
          <p className="text-[13px] text-muted-foreground">
            A quantidade é controlada por variação, na tabela de variações.
          </p>
        ) : (
          <label className="grid max-w-[220px] gap-1.5">
            <span className="text-[12px] font-medium text-muted-foreground">
              Quantidade em estoque
            </span>
            <input
              type="number"
              inputMode="numeric"
              value={quantity}
              onChange={(event) => onQuantityChange(Math.trunc(Number(event.target.value) || 0))}
              className="w-full min-w-0 rounded-md border border-border bg-surface px-3 py-2 text-[14px] outline-none focus:border-foreground/40"
            />
            {quantity < 0 && (
              <span className="text-[12px] text-red-600">
                Estoque negativo: houve venda manual sem peça registrada. Ajuste a quantidade.
              </span>
            )}
          </label>
        ))}
    </div>
  );
}
