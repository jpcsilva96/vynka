import { useEffect } from "react";
import { Plus, X } from "lucide-react";
import {
  generateVariants,
  formatBRL,
  type ProductOption,
  type ProductVariant,
} from "@/lib/products";
import { cn } from "@/lib/utils";

interface Props {
  options: ProductOption[];
  variants: ProductVariant[];
  manageStock?: boolean;
  onOptionsChange: (options: ProductOption[]) => void;
  onVariantsChange: (variants: ProductVariant[]) => void;
  onManageStockChange?: (manageStock: boolean) => void;
}

const FIXED_OPTIONS = [
  { name: "Cor", label: "Cor", position: 0 },
  { name: "Tamanho", label: "Tamanho", position: 1 },
] as const;

const DISPLAY_ORDER = ["Tamanho", "Cor"];

export function VariationsBuilder({
  options,
  variants,
  manageStock = false,
  onOptionsChange,
  onVariantsChange,
  onManageStockChange,
}: Props) {
  const fixedOptions = FIXED_OPTIONS.map((fixed) => getOption(options, fixed.name)).filter(
    Boolean,
  ) as ProductOption[];
  const hasVariations = fixedOptions.some((option) =>
    option.values.some((value) => value.value.trim()),
  );

  useEffect(() => {
    const next = normalizeOptions(options);
    onVariantsChange(generateVariants(next, variants));
    if (next.length > 0 && !manageStock) onManageStockChange?.(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [JSON.stringify(options)]);

  const setFixedEnabled = (name: string, enabled: boolean) => {
    const next = normalizeOptions(options).filter((option) => option.name !== name);
    if (enabled) {
      next.push({ name, position: fixedPosition(name), values: [{ value: "", position: 0 }] });
    }
    onOptionsChange(normalizeOptions(next));
    if (enabled) onManageStockChange?.(true);
  };

  const updateOptionValues = (name: string, values: ProductOption["values"]) => {
    const next = normalizeOptions(options).map((option) =>
      option.name === name
        ? { ...option, values: values.map((value, index) => ({ ...value, position: index })) }
        : option,
    );
    onOptionsChange(next);
  };

  const addValue = (name: string) => {
    const option = getOption(options, name);
    if (!option) return;
    updateOptionValues(name, [...option.values, { value: "", position: option.values.length }]);
  };

  const updateValue = (name: string, index: number, value: string) => {
    const option = getOption(options, name);
    if (!option) return;
    updateOptionValues(
      name,
      option.values.map((item, itemIndex) => (itemIndex === index ? { ...item, value } : item)),
    );
  };

  const removeValue = (name: string, index: number) => {
    const option = getOption(options, name);
    if (!option) return;
    const nextValues = option.values.filter((_, itemIndex) => itemIndex !== index);
    updateOptionValues(name, nextValues.length ? nextValues : [{ value: "", position: 0 }]);
  };

  const updateVariant = (idx: number, patch: Partial<ProductVariant>) =>
    onVariantsChange(
      variants.map((variant, index) => (index === idx ? { ...variant, ...patch } : variant)),
    );

  return (
    <div className="space-y-6">
      <div className="space-y-3">
        <div className="grid gap-3 sm:grid-cols-2">
          {FIXED_OPTIONS.map((fixed) => {
            const option = getOption(options, fixed.name);
            const enabled = !!option;
            return (
              <div
                key={fixed.name}
                className={cn(
                  "rounded-md border bg-background/40 p-4",
                  enabled ? "border-foreground/30" : "border-border",
                )}
              >
                <label className="flex cursor-pointer items-center gap-3">
                  <input
                    type="checkbox"
                    checked={enabled}
                    onChange={(event) => setFixedEnabled(fixed.name, event.target.checked)}
                    className="h-4 w-4 rounded border-border accent-foreground"
                  />
                  <span className="text-[14px] font-medium text-foreground">{fixed.label}</span>
                </label>

                {enabled && option && (
                  <div className="mt-4 flex flex-wrap items-center gap-2">
                    {option.values.map((value, index) => (
                      <div
                        key={index}
                        className="group flex items-center gap-1 rounded-full border border-border bg-surface pl-3 pr-1 focus-within:border-foreground/40"
                      >
                        <input
                          value={value.value}
                          onChange={(event) => updateValue(fixed.name, index, event.target.value)}
                          placeholder={fixed.name === "Tamanho" ? "P, M, G" : "Amarelo"}
                          className="w-24 bg-transparent py-1.5 text-[13px] outline-none"
                        />
                        <button
                          type="button"
                          onClick={() => removeValue(fixed.name, index)}
                          className="grid h-5 w-5 place-items-center rounded-full text-muted-foreground hover:bg-muted hover:text-foreground"
                          aria-label="Remover valor"
                        >
                          <X className="h-3 w-3" strokeWidth={2} />
                        </button>
                      </div>
                    ))}
                    <button
                      type="button"
                      onClick={() => addValue(fixed.name)}
                      className="inline-flex items-center gap-1 text-[13px] text-muted-foreground underline underline-offset-2 hover:text-foreground"
                    >
                      <Plus className="h-3 w-3" strokeWidth={1.75} />
                      Adicionar
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {hasVariations && variants.length === 0 && (
        <div className="rounded-md border border-dashed border-border px-4 py-3 text-[13px] text-muted-foreground">
          Informe ao menos um valor para gerar o controle de estoque.
        </div>
      )}

      {variants.length > 0 && (
        <div className="overflow-hidden rounded-md border border-border bg-surface">
          <div className="flex items-center justify-between border-b border-border px-4 py-3">
            <div>
              <div className="text-[14px] font-medium">{variants.length} combinacoes</div>
              <div className="text-[12px] text-muted-foreground">
                Controle o estoque de cada tamanho, cor ou combinacao.
              </div>
            </div>
          </div>
          <div className="divide-y divide-border">
            <div className="grid grid-cols-[minmax(3.5rem,1fr)_minmax(0,6.5rem)_minmax(0,4.5rem)_auto] items-center gap-2 bg-background/40 px-3 py-2 text-[11px] uppercase tracking-[0.1em] text-muted-foreground sm:gap-3 sm:px-4">
              <span className="truncate">Combinacao</span>
              <span className="truncate">Preco</span>
              <span className="truncate">Estoque</span>
              <span className="truncate">Ativa</span>
            </div>
            {variants.map((variant, index) => (
              <div
                key={variant.sku_key}
                className="grid grid-cols-[minmax(3.5rem,1fr)_minmax(0,6.5rem)_minmax(0,4.5rem)_auto] items-center gap-2 px-3 py-3 sm:gap-3 sm:px-4"
              >
                <div className="min-w-0 break-words text-[13px] font-medium text-foreground">
                  {variantLabel(variant)}
                </div>
                <input
                  value={variant.price ?? ""}
                  onChange={(event) => {
                    const raw = event.target.value.replace(/[^\d.,]/g, "").replace(",", ".");
                    updateVariant(index, { price: raw === "" ? null : Number(raw) });
                  }}
                  placeholder={formatBRL(0)}
                  className="w-full min-w-0 rounded-md border border-border bg-surface px-2 py-1.5 text-[13px] outline-none focus:border-foreground/40"
                />
                <input
                  type="number"
                  min={0}
                  value={variant.stock_quantity ?? 0}
                  onChange={(event) =>
                    updateVariant(index, {
                      stock_quantity: Math.max(0, Number(event.target.value) || 0),
                    })
                  }
                  className="w-full min-w-0 rounded-md border border-border bg-surface px-2 py-1.5 text-[13px] outline-none focus:border-foreground/40"
                />
                <label className="inline-flex cursor-pointer items-center gap-2 text-[13px]">
                  <input
                    type="checkbox"
                    checked={variant.available}
                    onChange={(event) => updateVariant(index, { available: event.target.checked })}
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

function getOption(options: ProductOption[], name: string) {
  return options.find((option) => normalizeName(option.name) === normalizeName(name));
}

function fixedPosition(name: string) {
  return FIXED_OPTIONS.find((option) => option.name === name)?.position ?? 99;
}

function normalizeOptions(options: ProductOption[]): ProductOption[] {
  return FIXED_OPTIONS.map((fixed) => {
    const option = getOption(options, fixed.name);
    if (!option) return null;
    return {
      ...option,
      name: fixed.name,
      position: fixed.position,
      values: option.values.map((value, index) => ({ ...value, position: index })),
    };
  }).filter(Boolean) as ProductOption[];
}

function normalizeName(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase();
}

function variantLabel(variant: ProductVariant) {
  const values = DISPLAY_ORDER.map((key) => variant.options[key]).filter(Boolean);
  return values.length ? values.join(" / ") : "Variacao";
}
