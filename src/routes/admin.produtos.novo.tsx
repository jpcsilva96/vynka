import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { ArrowLeft, Check, Loader2 } from "lucide-react";
import { AppHeader } from "@/components/app-header";
import { ImageUploader } from "@/components/products/image-uploader";
import { RichEditor } from "@/components/products/rich-editor";
import { VariationsBuilder } from "@/components/products/variations-builder";
import { ShippingDimensions } from "@/components/products/shipping-dimensions";
import { ProductPreview } from "@/components/products/product-preview";
import {
  createProduct,
  emptyProductForm,
  listCategories,
  type ProductFormState,
  type ProductStatus,
} from "@/lib/products";
import { useStoreContext } from "@/lib/store-context";
import { cn } from "@/lib/utils";
import { StockFields } from "@/components/products/stock-fields";

export const Route = createFileRoute("/admin/produtos/novo")({
  head: () => ({
    meta: [
      { title: "Novo produto · VYNKA" },
      { name: "description", content: "Cadastre um novo produto na sua loja VYNKA." },
    ],
  }),
  component: NovoProduto,
});

const DRAFT_KEY = "vynka:product-draft";

function NovoProduto() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { currentStore } = useStoreContext();
  const storeId = currentStore?.id ?? "";
  const { data: categories = [] } = useQuery({
    queryKey: ["categories", storeId],
    queryFn: () => listCategories(storeId),
    enabled: !!storeId,
  });

  const [form, setForm] = useState<ProductFormState>(() => {
    if (typeof window !== "undefined") {
      try {
        const raw = window.localStorage.getItem(DRAFT_KEY);
        if (raw) return { ...emptyProductForm(), ...(JSON.parse(raw) as ProductFormState) };
      } catch {
        /* ignore */
      }
    }
    return emptyProductForm();
  });
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState<Date | null>(null);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Auto-save de rascunho no localStorage (debounce 600ms)
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      window.localStorage.setItem(DRAFT_KEY, JSON.stringify(form));
      setSavedAt(new Date());
    }, 600);
    return () => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
    };
  }, [form]);

  const patch = (p: Partial<ProductFormState>) => setForm((f) => ({ ...f, ...p }));

  const handleSave = async (nextStatus?: ProductStatus) => {
    if (!storeId) {
      alert("Nenhuma loja ativa. Faça login novamente.");
      return;
    }
    setSaving(true);
    try {
      await createProduct(storeId, { ...form, status: nextStatus ?? form.status });
      window.localStorage.removeItem(DRAFT_KEY);
      qc.invalidateQueries({ queryKey: ["products", storeId] });
      navigate({ to: "/admin/produtos" });
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

  return (
    <div className="flex min-h-svh min-w-0 flex-1 flex-col bg-background">
      <AppHeader title="Novo produto" description="Cadastre um produto no seu catálogo." />

      {/* Barra de ações */}
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
                Salvando…
              </>
            ) : savedAt ? (
              <>
                <Check className="h-3 w-3" strokeWidth={1.5} />
                Rascunho salvo automaticamente
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
        <div className="mx-auto grid w-full max-w-6xl gap-8 lg:grid-cols-[minmax(0,1fr)_360px]">
          <div className="space-y-6">
            <Card title="Informações básicas">
              <Field label="Nome do produto">
                <input
                  value={form.name}
                  onChange={(e) => patch({ name: e.target.value })}
                  placeholder="Ex: Camiseta essencial"
                  className="w-full rounded-md border border-border bg-surface px-3 py-2.5 text-[14px] outline-none transition-colors focus:border-foreground/40"
                />
              </Field>
              <Field label="Descrição">
                <RichEditor
                  value={form.description}
                  onChange={(html) => patch({ description: html })}
                  placeholder="Descreva o produto — materiais, medidas, diferenciais…"
                />
              </Field>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Categoria">
                  <select
                    value={form.category_id ?? ""}
                    onChange={(e) => patch({ category_id: e.target.value || null })}
                    className="w-full appearance-none rounded-md border border-border bg-surface px-3 py-2.5 text-[14px] outline-none focus:border-foreground/40"
                  >
                    <option value="">Selecione</option>
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

            <Card title="Fotos" description="Arraste para reordenar. A primeira é a capa.">
              <ImageUploader images={form.images} onChange={(images) => patch({ images })} />
            </Card>

            <Card title="Preços">
              <div className="grid gap-4 sm:grid-cols-3">
                <Field label="Preço">
                  <PriceInput value={form.price} onChange={(v) => patch({ price: v })} />
                </Field>
                <Field label="Preço promocional">
                  <PriceInput
                    value={form.promo_price}
                    onChange={(v) => patch({ promo_price: v })}
                  />
                </Field>
                <Field label="Custo">
                  <PriceInput value={form.cost_price} onChange={(v) => patch({ cost_price: v })} />
                </Field>
              </div>
            </Card>

            <Card
              title="Peso e medidas"
              description="Para calcular o frete dos Correios e transportadoras."
            >
              <ShippingDimensions form={form} onChange={patch} />
            </Card>

            <Card title="Visibilidade">
              <Toggle
                label="Produto em destaque"
                description="Aparece com destaque na sua vitrine pública."
                checked={form.featured}
                onChange={(v) => patch({ featured: v })}
              />
            </Card>

            <Card title="Estoque">
              <StockFields
                manageStock={form.manage_stock}
                hasVariants={form.variants.length > 0}
                quantity={form.stock_quantity}
                onManageStockChange={(v) => patch({ manage_stock: v })}
                onQuantityChange={(v) => patch({ stock_quantity: v })}
              />
            </Card>

            <Card
              title="Variações"
              description="Crie opções como Cor e Tamanho. Combinações são geradas automaticamente."
            >
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

          <aside className="lg:pl-2">
            <ProductPreview form={form} categories={categories} />
          </aside>
        </div>
      </main>
    </div>
  );
}

function Card({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-lg border border-border bg-surface p-6">
      <div className="mb-5">
        <h2 className="text-[14px] font-medium text-foreground">{title}</h2>
        {description && <p className="mt-1 text-[12px] text-muted-foreground">{description}</p>}
      </div>
      <div className="space-y-5">{children}</div>
    </section>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-[12px] font-medium text-foreground">{label}</span>
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
  description,
  checked,
  onChange,
}: {
  label: string;
  description?: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <label className="flex cursor-pointer items-start justify-between gap-4">
      <div>
        <div className="text-[14px] font-medium text-foreground">{label}</div>
        {description && (
          <div className="mt-0.5 text-[12px] text-muted-foreground">{description}</div>
        )}
      </div>
      <button
        type="button"
        onClick={() => onChange(!checked)}
        className={cn(
          "relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors",
          checked ? "bg-foreground" : "bg-border",
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
