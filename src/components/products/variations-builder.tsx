import { useEffect } from "react";
import { Plus, Trash2, X } from "lucide-react";
import {
  generateVariants,
  formatBRL,
  type ProductOption,
  type ProductVariant,
} from "@/lib/products";

interface Props {
  options: ProductOption[];
  variants: ProductVariant[];
  manageStock?: boolean;
  onOptionsChange: (options: ProductOption[]) => void;
  onVariantsChange: (variants: ProductVariant[]) => void;
}

export function VariationsBuilder({
  options,
  variants,
  manageStock = false,
  onOptionsChange,
  onVariantsChange,
}: Props) {
  useEffect(() => {
    onVariantsChange(generateVariants(options, variants));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [JSON.stringify(options)]);

  const addOption = () =>
    onOptionsChange([
      ...options,
      { name: "", position: options.length, values: [{ value: "", position: 0 }] },
    ]);

  const updateOption = (i: number, patch: Partial<ProductOption>) =>
    onOptionsChange(options.map((o, idx) => (idx === i ? { ...o, ...patch } : o)));

  const removeOption = (i: number) => onOptionsChange(options.filter((_, idx) => idx !== i));

  const addValue = (i: number) => {
    const opt = options[i];
    updateOption(i, {
      values: [...opt.values, { value: "", position: opt.values.length }],
    });
  };

  const updateValue = (i: number, vi: number, value: string) => {
    const opt = options[i];
    updateOption(i, {
      values: opt.values.map((v, idx) => (idx === vi ? { ...v, value } : v)),
    });
  };

  const removeValue = (i: number, vi: number) => {
    const opt = options[i];
    updateOption(i, { values: opt.values.filter((_, idx) => idx !== vi) });
  };

  const updateVariant = (idx: number, patch: Partial<ProductVariant>) =>
    onVariantsChange(variants.map((v, i) => (i === idx ? { ...v, ...patch } : v)));

  return (
    <div className="space-y-6">
      <div className="space-y-3">
        {options.map((opt, i) => (
          <div key={i} className="rounded-md border border-border bg-background/40 p-4">
            <div className="flex items-center gap-3">
              <input
                value={opt.name}
                onChange={(e) => updateOption(i, { name: e.target.value })}
                placeholder="Nome da opcao (ex: Cor, Tamanho)"
                className="flex-1 rounded-md border border-border bg-surface px-3 py-2 text-[13px] outline-none focus:border-foreground/40"
              />
              <button
                type="button"
                onClick={() => removeOption(i)}
                className="grid h-8 w-8 place-items-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground"
              >
                <Trash2 className="h-3.5 w-3.5" strokeWidth={1.5} />
              </button>
            </div>

            <div className="mt-3 flex flex-wrap items-center gap-2">
              {opt.values.map((val, vi) => (
                <div
                  key={vi}
                  className="group flex items-center gap-1 rounded-full border border-border bg-surface pl-3 pr-1 focus-within:border-foreground/40"
                >
                  <input
                    value={val.value}
                    onChange={(e) => updateValue(i, vi, e.target.value)}
                    placeholder="Valor"
                    className="w-24 bg-transparent py-1.5 text-[13px] outline-none"
                  />
                  <button
                    type="button"
                    onClick={() => removeValue(i, vi)}
                    className="grid h-5 w-5 place-items-center rounded-full text-muted-foreground hover:bg-muted hover:text-foreground"
                  >
                    <X className="h-3 w-3" strokeWidth={2} />
                  </button>
                </div>
              ))}
              <button
                type="button"
                onClick={() => addValue(i)}
                className="text-[13px] text-muted-foreground underline underline-offset-2 hover:text-foreground"
              >
                Adicionar valor
              </button>
            </div>
          </div>
        ))}

        <button
          type="button"
          onClick={addOption}
          className="inline-flex items-center gap-1.5 rounded-md border border-dashed border-border px-3 py-2 text-[13px] text-muted-foreground transition-colors hover:border-foreground/40 hover:text-foreground"
        >
          <Plus className="h-3.5 w-3.5" strokeWidth={1.75} />
          Adicionar opcao
        </button>
      </div>

      {variants.length > 0 && (
        <div className="overflow-hidden rounded-md border border-border bg-surface">
          <div className="flex items-center justify-between border-b border-border px-4 py-3">
            <div>
              <div className="text-[14px] font-medium">{variants.length} variacoes</div>
              <div className="text-[12px] text-muted-foreground">
                Cada combinacao pode ter preco, disponibilidade e estoque proprios.
              </div>
            </div>
          </div>
          <div className="divide-y divide-border">
            <div className="grid grid-cols-[minmax(0,1fr)_120px_100px] items-center gap-3 bg-background/40 px-4 py-2 text-[11px] uppercase tracking-[0.14em] text-muted-foreground sm:grid-cols-[minmax(0,1fr)_120px_120px_100px]">
              <span>Variacao</span>
              <span>Preco</span>
              <span className="hidden sm:block">Estoque</span>
              <span>Disponivel</span>
            </div>
            {variants.map((v, idx) => (
              <div
                key={v.sku_key}
                className="grid grid-cols-[minmax(0,1fr)_120px_100px] items-center gap-3 px-4 py-3 sm:grid-cols-[minmax(0,1fr)_120px_120px_100px]"
              >
                <div className="min-w-0">
                  <div className="flex flex-wrap gap-1.5">
                    {Object.entries(v.options).map(([k, val]) => (
                      <span
                        key={k}
                        className="rounded-full border border-border px-2 py-0.5 text-[11px] text-foreground"
                      >
                        {k}: {val}
                      </span>
                    ))}
                  </div>
                </div>
                <input
                  value={v.price ?? ""}
                  onChange={(e) => {
                    const raw = e.target.value.replace(/[^\d.,]/g, "").replace(",", ".");
                    updateVariant(idx, { price: raw === "" ? null : Number(raw) });
                  }}
                  placeholder={formatBRL(0)}
                  className="rounded-md border border-border bg-surface px-2.5 py-1.5 text-[13px] outline-none focus:border-foreground/40"
                />
                <input
                  type="number"
                  min={0}
                  value={v.stock_quantity ?? 0}
                  disabled={!manageStock}
                  onChange={(e) =>
                    updateVariant(idx, {
                      stock_quantity: Math.max(0, Number(e.target.value) || 0),
                    })
                  }
                  className="hidden rounded-md border border-border bg-surface px-2.5 py-1.5 text-[13px] outline-none focus:border-foreground/40 disabled:bg-muted/50 disabled:text-muted-foreground sm:block"
                />
                <label className="inline-flex cursor-pointer items-center gap-2 text-[13px]">
                  <input
                    type="checkbox"
                    checked={v.available}
                    onChange={(e) => updateVariant(idx, { available: e.target.checked })}
                    className="h-4 w-4 rounded border-border accent-foreground"
                  />
                  <span className="text-muted-foreground">Sim</span>
                </label>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
