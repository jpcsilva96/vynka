import { formatBRL, type ProductFormState, type Category } from "@/lib/products";

interface Props {
  form: ProductFormState;
  categories: Category[];
}

export function ProductPreview({ form, categories }: Props) {
  const price = Number(form.price.replace(",", ".")) || 0;
  const promo = form.promo_price ? Number(form.promo_price.replace(",", ".")) : null;
  const showPromo = promo != null && promo > 0 && promo < price;
  const cat = categories.find((c) => c.id === form.category_id);
  const cover = form.images[0]?.url;

  return (
    <div className="sticky top-24">
      <div className="mb-3 flex items-center justify-between text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
        <span>Pré-visualização</span>
        <span>Vitrine</span>
      </div>
      <div className="overflow-hidden rounded-lg border border-border bg-surface">
        <div className="relative aspect-square bg-muted">
          {cover ? (
            <img src={cover} alt="" className="h-full w-full object-cover" />
          ) : (
            <div className="grid h-full w-full place-items-center text-[12px] text-muted-foreground">
              Adicione uma imagem
            </div>
          )}
          {form.featured && (
            <span className="absolute left-3 top-3 rounded-full bg-foreground px-2 py-0.5 text-[10px] uppercase tracking-wider text-background">
              Destaque
            </span>
          )}
        </div>
        <div className="space-y-2 p-5">
          {cat && (
            <div className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
              {cat.name}
            </div>
          )}
          <div className="text-[15px] font-medium text-foreground">
            {form.name || "Nome do produto"}
          </div>
          <div className="flex items-baseline gap-2">
            {showPromo ? (
              <>
                <span className="text-[16px] font-medium text-foreground">
                  {formatBRL(promo)}
                </span>
                <span className="text-[12px] text-muted-foreground line-through">
                  {formatBRL(price)}
                </span>
              </>
            ) : (
              <span className="text-[16px] font-medium text-foreground">
                {formatBRL(price)}
              </span>
            )}
          </div>
          {form.description && (
            <div
              className="prose prose-sm mt-2 max-w-none text-[13px] text-muted-foreground [&_h3]:text-[13px] [&_h3]:font-medium [&_h3]:text-foreground [&_ol]:ml-4 [&_ol]:list-decimal [&_ul]:ml-4 [&_ul]:list-disc"
              dangerouslySetInnerHTML={{ __html: form.description }}
            />
          )}
          {form.options.length > 0 && (
            <div className="space-y-3 pt-3">
              {form.options
                .filter((o) => o.name && o.values.some((v) => v.value))
                .map((o) => (
                  <div key={o.name}>
                    <div className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
                      {o.name}
                    </div>
                    <div className="mt-1.5 flex flex-wrap gap-1.5">
                      {o.values
                        .filter((v) => v.value)
                        .map((v) => (
                          <span
                            key={v.value}
                            className="rounded-full border border-border px-2.5 py-1 text-[12px] text-foreground"
                          >
                            {v.value}
                          </span>
                        ))}
                    </div>
                  </div>
                ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
