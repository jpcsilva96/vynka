import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { ArrowLeft, Check, Loader2, Star } from "lucide-react";
import { AppHeader } from "@/components/app-header";
import { ImageUploader } from "@/components/products/image-uploader";
import { ProductPreview } from "@/components/products/product-preview";
import { RichEditor } from "@/components/products/rich-editor";
import { VariationsBuilder } from "@/components/products/variations-builder";
import { ShippingDimensions } from "@/components/products/shipping-dimensions";
import {
  getProductForEdit,
  listCategories,
  updateProduct,
  type ProductFormState,
  type ProductStatus,
} from "@/lib/products";
import { useStoreContext } from "@/lib/store-context";
import { cn } from "@/lib/utils";
import { StockFields } from "@/components/products/stock-fields";

export const Route = createFileRoute("/admin/produtos/$id")({
  head: () => ({
    meta: [
      { title: "Editar produto · VYNKA" },
      { name: "description", content: "Edite os detalhes do produto da sua loja." },
    ],
  }),
  component: EditarProduto,
});

function EditarProduto() {
  const { id } = Route.useParams();
  const qc = useQueryClient();
  const { currentStore } = useStoreContext();
  const storeId = currentStore?.id ?? "";
  const [form, setForm] = useState<ProductFormState | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const { data: categories = [] } = useQuery({
    queryKey: ["categories", storeId],
    queryFn: () => listCategories(storeId),
    enabled: !!storeId,
  });

  const { data: product, isLoading } = useQuery({
    queryKey: ["product-edit", storeId, id],
    queryFn: () => getProductForEdit(storeId, id),
    enabled: !!storeId && !!id,
  });

  useEffect(() => {
    if (product) setForm(product);
  }, [product]);

  const patch = (p: Partial<ProductFormState>) => {
    setSaved(false);
    setForm((current) => (current ? { ...current, ...p } : current));
  };

  const handleSave = async (nextStatus?: ProductStatus) => {
    if (!storeId || !form) return;
    setSaving(true);
    setSaved(false);
    try {
      await updateProduct(storeId, id, { ...form, status: nextStatus ?? form.status });
      await Promise.all([
        qc.invalidateQueries({ queryKey: ["products", storeId] }),
        qc.invalidateQueries({ queryKey: ["product-edit", storeId, id] }),
      ]);
      setSaved(true);
    } catch (e) {
      console.error(e);
      // Peso/medidas fora do limite: mostra o motivo (a mensagem vem de productDimensions).
      alert(
        e instanceof Error && /^(Peso|Altura|Largura|Comprimento):/.test(e.message)
          ? e.message
          : "Não foi possível salvar o produto.",
      );
    } finally {
      setSaving(false);
    }
  };

  if (isLoading || !form) {
    return (
      <div className="grid min-h-svh flex-1 place-items-center bg-background">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" strokeWidth={1.5} />
      </div>
    );
  }

  if (!product) {
    return (
      <div className="flex min-h-svh min-w-0 flex-1 flex-col bg-background">
        <AppHeader title="Produto nao encontrado" />
        <main className="grid flex-1 place-items-center px-6">
          <Link
            to="/admin/produtos"
            className="inline-flex items-center gap-1.5 rounded-md bg-primary px-4 py-2 text-[13px] font-medium text-primary-foreground"
          >
            <ArrowLeft className="h-3.5 w-3.5" strokeWidth={1.5} />
            Voltar para produtos
          </Link>
        </main>
      </div>
    );
  }

  return (
    <div className="flex min-h-svh min-w-0 flex-1 flex-col bg-background">
      <AppHeader
        title={form.name || "Produto sem nome"}
        description="Edite os detalhes do produto."
      />

      <div className="sticky top-16 z-10 border-b border-border bg-background/80 backdrop-blur-xl">
        <div className="mx-auto flex w-full max-w-6xl flex-wrap items-center gap-3 px-6 py-3 md:px-10">
          <Link
            to="/admin/produtos"
            className="inline-flex items-center gap-1.5 text-[13px] text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="h-3.5 w-3.5" strokeWidth={1.5} />
            Produtos
          </Link>
          <span className="ml-auto flex items-center gap-1.5 text-[12px] text-muted-foreground">
            {saving ? (
              <>
                <Loader2 className="h-3 w-3 animate-spin" strokeWidth={1.5} />
                Salvando...
              </>
            ) : saved ? (
              <>
                <Check className="h-3 w-3" strokeWidth={1.5} />
                Alteracoes salvas
              </>
            ) : null}
          </span>
          <button
            type="button"
            disabled={saving}
            onClick={() => handleSave("draft")}
            className="rounded-md border border-border bg-surface px-4 py-2 text-[13px] font-medium text-foreground transition-colors hover:bg-muted disabled:opacity-50"
          >
            Salvar rascunho
          </button>
          <button
            type="button"
            disabled={saving || !form.name.trim()}
            onClick={() => handleSave("active")}
            className="rounded-md bg-primary px-4 py-2 text-[13px] font-medium text-primary-foreground transition-colors hover:bg-graphite disabled:opacity-50"
          >
            Publicar
          </button>
        </div>
      </div>

      <main className="flex-1 px-6 py-8 md:px-10 md:py-10">
        <div className="mx-auto grid w-full max-w-7xl gap-6 xl:grid-cols-[280px_minmax(0,1fr)_320px]">
          <aside className="space-y-5">
            <Card>
              <div className="overflow-hidden rounded-lg bg-muted">
                <div className="relative aspect-square">
                  {form.images[0]?.url ? (
                    <img src={form.images[0].url} alt="" className="h-full w-full object-contain" />
                  ) : (
                    <div className="grid h-full place-items-center text-[12px] text-muted-foreground">
                      Sem foto
                    </div>
                  )}
                  {form.featured && (
                    <span className="absolute left-3 top-3 rounded-full bg-foreground px-2 py-0.5 text-[10px] uppercase tracking-wider text-background">
                      Destaque
                    </span>
                  )}
                </div>
              </div>
              <div className="mt-5 space-y-5">
                <Toggle
                  label="Destacar produto"
                  icon={<Star className="h-4 w-4 text-amber-500" strokeWidth={1.5} />}
                  checked={form.featured}
                  onChange={(v) => patch({ featured: v })}
                />
                <Toggle
                  label="Exibir no catalogo online"
                  checked={form.status === "active"}
                  onChange={(v) => patch({ status: v ? "active" : "draft" })}
                />
                <Field label="Nome do produto">
                  <input
                    value={form.name}
                    onChange={(e) => patch({ name: e.target.value })}
                    className="w-full rounded-md border border-border bg-surface px-3 py-2.5 text-[14px] outline-none focus:border-foreground/40"
                  />
                </Field>
                <Field label="Categoria">
                  <select
                    value={form.category_id ?? ""}
                    onChange={(e) => patch({ category_id: e.target.value || null })}
                    className="w-full appearance-none rounded-md border border-border bg-surface px-3 py-2.5 text-[14px] outline-none focus:border-foreground/40"
                  >
                    <option value="">Sem categoria</option>
                    {categories.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.parent_id ? "— " : ""}
                        {c.name}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field label="Status">
                  <select
                    value={form.status}
                    onChange={(e) => patch({ status: e.target.value as ProductStatus })}
                    className="w-full appearance-none rounded-md border border-border bg-surface px-3 py-2.5 text-[14px] outline-none focus:border-foreground/40"
                  >
                    <option value="draft">Rascunho</option>
                    <option value="active">Ativo</option>
                    <option value="archived">Arquivado</option>
                  </select>
                </Field>
              </div>
            </Card>
          </aside>

          <div className="space-y-6">
            <Card title="Estoque">
              <StockFields
                manageStock={form.manage_stock}
                hasVariants={form.variants.length > 0}
                quantity={form.stock_quantity}
                onManageStockChange={(v) => patch({ manage_stock: v })}
                onQuantityChange={(v) => patch({ stock_quantity: v })}
              />
            </Card>

            <Card title="Informacoes do produto">
              <div className="grid gap-4 sm:grid-cols-3">
                <Field label="Preco de venda">
                  <PriceInput value={form.price} onChange={(v) => patch({ price: v })} />
                </Field>
                <Field label="Preco promocional">
                  <PriceInput
                    value={form.promo_price}
                    onChange={(v) => patch({ promo_price: v })}
                  />
                </Field>
                <Field label="Custo">
                  <PriceInput value={form.cost_price} onChange={(v) => patch({ cost_price: v })} />
                </Field>
              </div>
              <Field label="Descricao">
                <RichEditor
                  value={form.description}
                  onChange={(description) => patch({ description })}
                  placeholder="Descreva o produto, materiais, medidas e diferenciais."
                />
              </Field>
            </Card>

            <Card title="Peso e medidas (para o frete)">
              <ShippingDimensions form={form} onChange={patch} />
            </Card>

            <Card title="Fotos">
              <ImageUploader images={form.images} onChange={(images) => patch({ images })} />
            </Card>

            <Card title={`Variacoes (${form.variants.length})`}>
              <VariationsBuilder
                options={form.options}
                variants={form.variants}
                manageStock={form.manage_stock}
                onOptionsChange={(options) => patch({ options })}
                onVariantsChange={(variants) => patch({ variants })}
                onManageStockChange={(manage_stock) => patch({ manage_stock })}
              />
            </Card>
          </div>

          <aside className="xl:pl-2">
            <ProductPreview form={form} categories={categories} />
          </aside>
        </div>
      </main>
    </div>
  );
}

function Card({ title, children }: { title?: string; children: React.ReactNode }) {
  return (
    <section className="rounded-lg border border-border bg-surface p-6">
      {title && <h2 className="mb-5 text-[16px] font-medium text-foreground">{title}</h2>}
      <div className="space-y-5">{children}</div>
    </section>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-[12px] font-medium text-muted-foreground">{label}</span>
      {children}
    </label>
  );
}

function PriceInput({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <div className="flex items-center rounded-md border border-border bg-surface pl-3 focus-within:border-foreground/40">
      <span className="text-[13px] text-muted-foreground">R$</span>
      <input
        inputMode="decimal"
        value={value}
        onChange={(e) => onChange(e.target.value.replace(/[^\d.,]/g, ""))}
        placeholder="0,00"
        className="w-full bg-transparent px-2 py-2.5 text-[14px] outline-none"
      />
    </div>
  );
}

function Toggle({
  label,
  icon,
  checked,
  onChange,
}: {
  label?: string;
  icon?: React.ReactNode;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <label className="flex cursor-pointer items-center justify-between gap-4">
      {label && (
        <span className="inline-flex items-center gap-2 text-[14px] font-medium text-foreground">
          {icon}
          {label}
        </span>
      )}
      <button
        type="button"
        onClick={() => onChange(!checked)}
        className={cn(
          "relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors",
          checked ? "bg-emerald-500" : "bg-border",
        )}
      >
        <span
          className={cn(
            "inline-block h-4 w-4 transform rounded-full bg-background transition-transform",
            checked ? "translate-x-4" : "translate-x-0.5",
          )}
        />
      </button>
    </label>
  );
}
