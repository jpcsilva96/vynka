import type { ProductFormState } from "@/lib/products";

type DimensionKey = "weight_kg" | "height_cm" | "width_cm" | "length_cm";

const fields: { key: DimensionKey; label: string; unit: string; placeholder: string }[] = [
  { key: "weight_kg", label: "Peso", unit: "kg", placeholder: "0,3" },
  { key: "height_cm", label: "Altura", unit: "cm", placeholder: "4" },
  { key: "width_cm", label: "Largura", unit: "cm", placeholder: "12" },
  { key: "length_cm", label: "Comprimento", unit: "cm", placeholder: "17" },
];

// Peso e medidas do produto já embalado, usados no cálculo do frete (Correios e transportadoras).
export function ShippingDimensions({
  form,
  onChange,
}: {
  form: ProductFormState;
  onChange: (patch: Partial<ProductFormState>) => void;
}) {
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {fields.map((field) => (
          <label key={field.key} className="block">
            <span className="mb-1.5 block text-[12px] font-medium text-foreground">
              {field.label}
            </span>
            <div className="flex items-center rounded-md border border-border bg-surface pr-3 focus-within:border-foreground/40">
              <input
                inputMode="decimal"
                value={form[field.key]}
                onChange={(event) =>
                  onChange({ [field.key]: event.target.value.replace(/[^\d.,]/g, "") })
                }
                placeholder={field.placeholder}
                className="w-full min-w-0 bg-transparent px-3 py-2.5 text-[14px] outline-none placeholder:text-muted-foreground/60"
              />
              <span className="text-[12px] text-muted-foreground">{field.unit}</span>
            </div>
          </label>
        ))}
      </div>
      <p className="text-[12px] text-muted-foreground">
        Do produto já embalado. Deixe em branco para usar a embalagem padrão da loja (Loja e
        Catálogo › Entrega e Retirada).
      </p>
    </div>
  );
}
