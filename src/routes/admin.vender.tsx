import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  Search,
  Plus,
  ShoppingBag,
  X,
  Minus,
  User,
  UserPlus,
  Trash2,
  ImageIcon,
  Package,
  Loader2,
  Check,
  Printer,
  Share2,
  ArrowRight,
  Percent,

} from "lucide-react";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { useStoreContext } from "@/lib/store-context";
import { listProducts, listCategories, formatBRL, type ProductRecord } from "@/lib/products";
import {
  createCustomer,
  listCustomers,
  listProductVariants,
  paymentMethodLabel,
  saveSale,
  variantLabel,
  type CartLine,
  type CustomerLite,
  type PaymentMethod,
  type SavedSale,
  type VariantRow,
} from "@/lib/sales";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/admin/vender")({
  head: () => ({
    meta: [
      { title: "Vender · VYNKA" },
      { name: "description", content: "PDV rápido para registrar vendas presenciais." },
    ],
  }),
  component: VenderPage,
});

// ---------------- Page ----------------

function VenderPage() {
  const { currentStore, user } = useStoreContext();
  const storeId = currentStore?.id ?? "";
  const userId = user?.id ?? "";

  const { data: products = [], isLoading: loadingProducts } = useQuery({
    queryKey: ["pos-products", storeId],
    queryFn: () => listProducts(storeId),
    enabled: !!storeId,
  });
  const { data: categories = [] } = useQuery({
    queryKey: ["pos-categories", storeId],
    queryFn: () => listCategories(storeId),
    enabled: !!storeId,
  });

  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<string>("all");

  const filtered = useMemo(() => {
    let list = products.filter((p) => p.status === "active");
    if (category !== "all") list = list.filter((p) => p.category_id === category);
    if (query.trim()) {
      const q = query.trim().toLowerCase();
      list = list.filter(
        (p) => p.name.toLowerCase().includes(q) || p.id.toLowerCase().includes(q),
      );
    }
    return list;
  }, [products, category, query]);

  // Cart state
  const [cart, setCart] = useState<CartLine[]>([]);
  const [customer, setCustomer] = useState<CustomerLite | null>(null);
  const [discountMode, setDiscountMode] = useState<"value" | "percent">("value");
  const [discountInput, setDiscountInput] = useState("");
  const [surchargeMode, setSurchargeMode] = useState<"value" | "percent">("value");
  const [surchargeInput, setSurchargeInput] = useState("");

  const [variantModal, setVariantModal] = useState<ProductRecord | null>(null);
  const [customerModalOpen, setCustomerModalOpen] = useState(false);
  const [paymentOpen, setPaymentOpen] = useState(false);
  const [adjustModal, setAdjustModal] = useState<"discount" | "surcharge" | null>(null);
  const [receipt, setReceipt] = useState<
    | (SavedSale & { snapshot: CompletedSaleSnapshot })
    | null
  >(null);
  const [saving, setSaving] = useState(false);

  const subtotal = useMemo(
    () => cart.reduce((s, i) => s + i.unit_price * i.quantity, 0),
    [cart],
  );
  const discount = useMemo(() => {
    const v = Number(discountInput.replace(",", ".")) || 0;
    const d = discountMode === "percent" ? subtotal * (v / 100) : v;
    return Math.max(0, Math.min(subtotal, d));
  }, [discountInput, discountMode, subtotal]);
  const surcharge = useMemo(() => {
    const v = Number(surchargeInput.replace(",", ".")) || 0;
    return Math.max(0, surchargeMode === "percent" ? subtotal * (v / 100) : v);
  }, [surchargeInput, surchargeMode, subtotal]);
  const total = Math.max(0, subtotal - discount + surcharge);
  const itemCount = cart.reduce((s, i) => s + i.quantity, 0);

  const addLine = (line: CartLine) => {
    setCart((prev) => {
      const idx = prev.findIndex((i) => i.key === line.key);
      if (idx >= 0) {
        const next = prev.slice();
        next[idx] = { ...next[idx], quantity: next[idx].quantity + line.quantity };
        return next;
      }
      return [...prev, line];
    });
  };

  const handleProductClick = async (p: ProductRecord) => {
    if ((p.variant_count ?? 0) > 0) {
      setVariantModal(p);
      return;
    }
    const price = p.promo_price != null && p.promo_price < p.price ? p.promo_price : p.price;
    addLine({
      key: `${p.id}::default`,
      product_id: p.id,
      variant_id: null,
      product_name: p.name || "Produto",
      variant_name: null,
      image: p.primary_image ?? null,
      unit_price: price,
      quantity: 1,
    });
  };

  const updateQty = (key: string, qty: number) => {
    setCart((prev) =>
      prev
        .map((i) => (i.key === key ? { ...i, quantity: Math.max(0, qty) } : i))
        .filter((i) => i.quantity > 0),
    );
  };
  const removeLine = (key: string) => setCart((prev) => prev.filter((i) => i.key !== key));

  const resetSale = () => {
    setCart([]);
    setCustomer(null);
    setDiscountInput("");
    setSurchargeInput("");
    setPaymentOpen(false);
    setReceipt(null);
  };

  const confirmSale = async (
    method: PaymentMethod,
    details: Record<string, unknown>,
    paidAmount: number | null,
    changeDue: number | null,
    notes: string | null,
    status: "pending" | "confirmed",
  ) => {
    if (saving) return;
    if (!storeId || !userId) return;
    if (cart.length === 0) return;
    setSaving(true);
    try {
      const saved = await saveSale({
        storeId,
        userId,
        customerId: customer?.id ?? null,
        items: cart,
        subtotal,
        discount,
        surcharge,
        total,
        paymentMethod: method,
        paymentDetails: details,
        paidAmount,
        changeDue,
        notes,
        status,
      });
      setReceipt({
        ...saved,
        snapshot: {
          items: cart,
          customer,
          subtotal,
          discount,
          surcharge,
          total,
          method,
          paidAmount,
          changeDue,
        },
      });
      setPaymentOpen(false);
    } catch (e: any) {
      alert(e?.message ?? "Não foi possível registrar a venda.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex min-h-svh flex-1 flex-col bg-background">
      <header className="sticky top-0 z-20 border-b border-border bg-background/85 backdrop-blur-xl">
        <div className="flex h-16 items-center gap-4 px-6">
          <SidebarTrigger className="-ml-1 h-8 w-8 text-muted-foreground hover:text-foreground" />
          <div className="min-w-0 flex-1">
            <h1 className="truncate text-[15px] font-medium text-foreground">Vender</h1>
            <p className="truncate text-[12px] text-muted-foreground">
              PDV rápido — adicione produtos, escolha o pagamento e conclua a venda.
            </p>
          </div>
        </div>
      </header>

      <div className="flex flex-1 flex-col lg:flex-row">
        {/* Main / products */}
        <section className="flex min-w-0 flex-1 flex-col border-b border-border lg:border-b-0 lg:border-r">
          <div className="flex flex-wrap items-center gap-2 border-b border-border bg-background/60 px-6 py-3">
            <div className="flex flex-1 items-center gap-2 rounded-md border border-border bg-surface px-3 py-2 focus-within:border-foreground/40">
              <Search className="h-3.5 w-3.5 text-muted-foreground" strokeWidth={1.5} />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Nome ou código"
                className="w-full bg-transparent text-[13px] outline-none placeholder:text-muted-foreground"
              />
              {query && (
                <button
                  onClick={() => setQuery("")}
                  className="text-muted-foreground hover:text-foreground"
                  aria-label="Limpar busca"
                >
                  <X className="h-3.5 w-3.5" strokeWidth={1.5} />
                </button>
              )}
            </div>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="rounded-md border border-border bg-surface px-3 py-2 text-[13px] outline-none focus:border-foreground/40"
            >
              <option value="all">Todas as categorias</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>

          <div className="flex-1 overflow-y-auto px-6 py-5">
            {loadingProducts ? (
              <ProductGridSkeleton />
            ) : products.length === 0 ? (
              <EmptyProducts />
            ) : filtered.length === 0 ? (
              <div className="mx-auto mt-16 max-w-md text-center">
                <div className="mx-auto mb-4 grid h-12 w-12 place-items-center rounded-full bg-muted text-muted-foreground">
                  <Search className="h-4 w-4" strokeWidth={1.5} />
                </div>
                <h3 className="text-[14px] font-medium text-foreground">
                  Nenhum produto encontrado
                </h3>
                <p className="mt-1 text-[12px] text-muted-foreground">
                  Ajuste a busca ou a categoria selecionada.
                </p>
                <button
                  onClick={() => {
                    setQuery("");
                    setCategory("all");
                  }}
                  className="mt-4 rounded-md border border-border bg-surface px-3 py-1.5 text-[12px] hover:bg-muted"
                >
                  Limpar filtros
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5">
                <NewProductCard />
                {filtered.map((p) => (
                  <ProductTile key={p.id} product={p} onClick={() => handleProductClick(p)} />
                ))}
              </div>
            )}
          </div>
        </section>

        {/* Cart */}
        <aside className="flex w-full flex-col bg-surface lg:sticky lg:top-16 lg:h-[calc(100svh-4rem)] lg:w-[380px] xl:w-[420px]">
          <CartHeader
            customer={customer}
            onOpenCustomer={() => setCustomerModalOpen(true)}
            onClearCustomer={() => setCustomer(null)}
          />

          {cart.length === 0 ? (
            <div className="flex flex-1 flex-col items-center justify-center gap-3 px-8 text-center">
              <div className="grid h-14 w-14 place-items-center rounded-full bg-muted text-muted-foreground">
                <ShoppingBag className="h-5 w-5" strokeWidth={1.4} />
              </div>
              <div>
                <div className="text-[14px] font-medium text-foreground">
                  Seu carrinho está vazio
                </div>
                <p className="mt-1 text-[12px] text-muted-foreground">
                  Clique nos produtos para adicioná-los à venda.
                </p>
              </div>
            </div>
          ) : (
            <div className="flex-1 divide-y divide-border overflow-y-auto">
              {cart.map((line) => (
                <CartRow
                  key={line.key}
                  line={line}
                  onDec={() => updateQty(line.key, line.quantity - 1)}
                  onInc={() => updateQty(line.key, line.quantity + 1)}
                  onRemove={() => removeLine(line.key)}
                />
              ))}
            </div>
          )}

          {/* Summary */}
          <div className="border-t border-border px-5 py-4">
            <SummaryRow label="Subtotal" value={formatBRL(subtotal)} />

            <div className="mt-3 grid grid-cols-2 gap-2">
              <AdjustButton
                label="Desconto"
                amount={discount}
                sign="minus"
                onOpen={() => setAdjustModal("discount")}
                onClear={() => setDiscountInput("")}
                ctaLabel="Dar desconto"
                disabled={subtotal <= 0}
              />
              <AdjustButton
                label="Acréscimo"
                amount={surcharge}
                sign="plus"
                onOpen={() => setAdjustModal("surcharge")}
                onClear={() => setSurchargeInput("")}
                ctaLabel="Adicionar acréscimo"
                disabled={subtotal <= 0}
              />
            </div>

            <div className="mt-3 flex items-baseline justify-between border-t border-border pt-3">
              <span className="text-[12px] uppercase tracking-[0.16em] text-muted-foreground">
                Total
              </span>
              <span className="text-[20px] font-medium text-foreground">
                {formatBRL(total)}
              </span>
            </div>
            <button
              disabled={cart.length === 0 || saving}
              onClick={() => setPaymentOpen(true)}
              className={cn(
                "mt-4 flex w-full items-center justify-center gap-2 rounded-md bg-primary px-4 py-3 text-[13px] font-medium text-primary-foreground transition-colors",
                cart.length === 0 || saving
                  ? "cursor-not-allowed opacity-50"
                  : "hover:bg-graphite",
              )}
            >
              Finalizar venda
              <ArrowRight className="h-3.5 w-3.5" strokeWidth={1.75} />
            </button>
            <p className="mt-2 text-center text-[11px] text-muted-foreground">
              {itemCount} {itemCount === 1 ? "item" : "itens"} no carrinho
            </p>
          </div>
        </aside>
      </div>

      {variantModal && (
        <VariantModal
          product={variantModal}
          onClose={() => setVariantModal(null)}
          onPick={(v) => {
            const base = variantModal;
            const price =
              v.price != null
                ? v.price
                : base.promo_price != null && base.promo_price < base.price
                  ? base.promo_price
                  : base.price;
            addLine({
              key: `${base.id}::${v.id}`,
              product_id: base.id,
              variant_id: v.id,
              product_name: base.name || "Produto",
              variant_name: variantLabel(v.options),
              image: v.image_url ?? base.primary_image ?? null,
              unit_price: price,
              quantity: 1,
            });
            setVariantModal(null);
          }}
        />
      )}

      {customerModalOpen && (
        <CustomerModal
          storeId={storeId}
          onClose={() => setCustomerModalOpen(false)}
          onSelect={(c) => {
            setCustomer(c);
            setCustomerModalOpen(false);
          }}
          onContinueWithout={() => {
            setCustomer(null);
            setCustomerModalOpen(false);
          }}
        />
      )}

      {paymentOpen && (
        <CheckoutScreen
          items={cart}
          customer={customer}
          subtotal={subtotal}
          discount={discount}
          surcharge={surcharge}
          total={total}
          saving={saving}
          onOpenCustomer={() => setCustomerModalOpen(true)}
          onClearCustomer={() => setCustomer(null)}
          onOpenDiscount={() => setAdjustModal("discount")}
          onClearDiscount={() => setDiscountInput("")}
          onClose={() => setPaymentOpen(false)}
          onDiscard={() => {
            setPaymentOpen(false);
            resetSale();
          }}
          onConfirm={confirmSale}
        />
      )}

      {adjustModal && (
        <AdjustModal
          kind={adjustModal}
          subtotal={subtotal}
          initialMode={adjustModal === "discount" ? discountMode : surchargeMode}
          initialValue={adjustModal === "discount" ? discountInput : surchargeInput}
          onClose={() => setAdjustModal(null)}
          onApply={(mode, value) => {
            if (adjustModal === "discount") {
              setDiscountMode(mode);
              setDiscountInput(value);
            } else {
              setSurchargeMode(mode);
              setSurchargeInput(value);
            }
            setAdjustModal(null);
          }}
        />
      )}

      {receipt && (
        <ReceiptModal
          sale={receipt}
          onNew={resetSale}
          onClose={() => setReceipt(null)}
        />
      )}
    </div>
  );
}

// ---------------- Pieces ----------------

function NewProductCard() {
  return (
    <Link
      to="/admin/produtos/novo"
      className="group flex aspect-[4/5] flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-border bg-surface text-muted-foreground transition-colors hover:border-foreground/40 hover:text-foreground"
    >
      <div className="grid h-10 w-10 place-items-center rounded-full bg-muted text-foreground transition-colors group-hover:bg-foreground group-hover:text-background">
        <Plus className="h-4 w-4" strokeWidth={1.75} />
      </div>
      <span className="text-[12px] font-medium">Novo produto</span>
    </Link>
  );
}

function ProductTile({ product, onClick }: { product: ProductRecord; onClick: () => void }) {
  const sale =
    product.promo_price != null && product.promo_price < product.price;
  const price = sale ? product.promo_price! : product.price;
  const hasVariants = (product.variant_count ?? 0) > 0;
  return (
    <button
      onClick={onClick}
      className="group flex aspect-[4/5] flex-col overflow-hidden rounded-lg border border-border bg-surface text-left transition-all hover:-translate-y-0.5 hover:border-foreground/40 hover:shadow-sm"
    >
      <div className="relative flex-1 overflow-hidden bg-muted">
        {product.primary_image ? (
          <img
            src={product.primary_image}
            alt=""
            className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.04]"
            loading="lazy"
          />
        ) : (
          <div className="grid h-full w-full place-items-center text-muted-foreground">
            <ImageIcon className="h-6 w-6" strokeWidth={1.25} />
          </div>
        )}
        {hasVariants && (
          <span className="absolute left-2 top-2 rounded bg-background/90 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-foreground">
            Variações
          </span>
        )}
      </div>
      <div className="border-t border-border px-3 py-2.5">
        <div className="truncate text-[12.5px] font-medium text-foreground">
          {product.name || "Sem nome"}
        </div>
        <div className="mt-0.5 flex items-baseline gap-1.5">
          <span className="text-[12.5px] text-foreground">{formatBRL(price)}</span>
          {sale && (
            <span className="text-[11px] text-muted-foreground line-through">
              {formatBRL(product.price)}
            </span>
          )}
        </div>
      </div>
    </button>
  );
}

function ProductGridSkeleton() {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5">
      {Array.from({ length: 10 }).map((_, i) => (
        <div
          key={i}
          className="aspect-[4/5] animate-pulse rounded-lg border border-border bg-surface"
        />
      ))}
    </div>
  );
}

function EmptyProducts() {
  return (
    <div className="mx-auto mt-16 max-w-md text-center">
      <div className="mx-auto mb-4 grid h-12 w-12 place-items-center rounded-full bg-muted text-muted-foreground">
        <Package className="h-4 w-4" strokeWidth={1.5} />
      </div>
      <h3 className="text-[14px] font-medium text-foreground">
        Nenhum produto cadastrado
      </h3>
      <p className="mt-1 text-[12px] text-muted-foreground">
        Cadastre seu primeiro produto para começar a vender no PDV.
      </p>
      <Link
        to="/admin/produtos/novo"
        className="mt-4 inline-flex items-center gap-1.5 rounded-md bg-primary px-4 py-2 text-[12.5px] font-medium text-primary-foreground hover:bg-graphite"
      >
        <Plus className="h-3.5 w-3.5" strokeWidth={1.75} />
        Cadastrar primeiro produto
      </Link>
    </div>
  );
}

function CartHeader({
  customer,
  onOpenCustomer,
  onClearCustomer,
}: {
  customer: CustomerLite | null;
  onOpenCustomer: () => void;
  onClearCustomer: () => void;
}) {
  return (
    <div className="border-b border-border px-5 py-4">
      <div className="text-[11px] font-medium uppercase tracking-[0.2em] text-muted-foreground">
        Venda
      </div>
      {customer ? (
        <div className="mt-2 flex items-center gap-3">
          <div className="grid h-8 w-8 place-items-center rounded-full bg-muted text-foreground">
            <User className="h-3.5 w-3.5" strokeWidth={1.6} />
          </div>
          <div className="min-w-0 flex-1">
            <div className="truncate text-[13px] font-medium text-foreground">
              {customer.name}
            </div>
            {customer.phone && (
              <div className="truncate text-[11.5px] text-muted-foreground">
                {customer.phone}
              </div>
            )}
          </div>
          <button
            onClick={onOpenCustomer}
            className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground hover:text-foreground"
          >
            Alterar
          </button>
          <button
            onClick={onClearCustomer}
            aria-label="Remover cliente"
            className="text-muted-foreground hover:text-foreground"
          >
            <X className="h-3.5 w-3.5" strokeWidth={1.5} />
          </button>
        </div>
      ) : (
        <button
          onClick={onOpenCustomer}
          className="mt-2 inline-flex w-full items-center gap-2 rounded-md border border-dashed border-border bg-background/40 px-3 py-2 text-[12.5px] text-muted-foreground hover:text-foreground"
        >
          <UserPlus className="h-3.5 w-3.5" strokeWidth={1.5} />
          Selecionar cliente
        </button>
      )}
    </div>
  );
}

function CartRow({
  line,
  onDec,
  onInc,
  onRemove,
}: {
  line: CartLine;
  onDec: () => void;
  onInc: () => void;
  onRemove: () => void;
}) {
  return (
    <div className="flex gap-3 px-5 py-3.5">
      <div className="h-14 w-14 shrink-0 overflow-hidden rounded-md bg-muted">
        {line.image ? (
          <img src={line.image} alt="" className="h-full w-full object-cover" />
        ) : (
          <div className="grid h-full w-full place-items-center text-muted-foreground">
            <ImageIcon className="h-4 w-4" strokeWidth={1.4} />
          </div>
        )}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <div className="truncate text-[13px] font-medium text-foreground">
              {line.product_name}
            </div>
            {line.variant_name && (
              <div className="mt-0.5 truncate text-[11.5px] text-muted-foreground">
                {line.variant_name}
              </div>
            )}
            <div className="mt-0.5 text-[11.5px] text-muted-foreground">
              {formatBRL(line.unit_price)}
            </div>
          </div>
          <button
            onClick={onRemove}
            aria-label="Remover"
            className="text-muted-foreground hover:text-foreground"
          >
            <Trash2 className="h-3.5 w-3.5" strokeWidth={1.5} />
          </button>
        </div>
        <div className="mt-2 flex items-center justify-between">
          <div className="inline-flex items-center rounded-md border border-border">
            <button
              onClick={onDec}
              className="grid h-7 w-7 place-items-center text-muted-foreground hover:text-foreground"
              aria-label="Diminuir"
            >
              <Minus className="h-3 w-3" strokeWidth={1.6} />
            </button>
            <span className="w-6 text-center text-[12px]">{line.quantity}</span>
            <button
              onClick={onInc}
              className="grid h-7 w-7 place-items-center text-muted-foreground hover:text-foreground"
              aria-label="Aumentar"
            >
              <Plus className="h-3 w-3" strokeWidth={1.6} />
            </button>
          </div>
          <div className="text-[13px] font-medium text-foreground">
            {formatBRL(line.unit_price * line.quantity)}
          </div>
        </div>
      </div>
    </div>
  );
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between py-1">
      <span className="text-[12px] text-muted-foreground">{label}</span>
      <span className="text-[13px] text-foreground">{value}</span>
    </div>
  );
}

function AdjustButton({
  label,
  amount,
  sign,
  onOpen,
  onClear,
  ctaLabel,
  disabled,
}: {
  label: string;
  amount: number;
  sign: "minus" | "plus";
  onOpen: () => void;
  onClear: () => void;
  ctaLabel: string;
  disabled?: boolean;
}) {
  const active = amount > 0;
  if (!active) {
    return (
      <button
        type="button"
        onClick={onOpen}
        disabled={disabled}
        className={cn(
          "flex w-full items-center justify-center gap-1.5 rounded-md border border-dashed border-border bg-background px-3 py-2 text-[12px] font-medium text-foreground transition-colors",
          disabled
            ? "cursor-not-allowed opacity-50"
            : "hover:border-foreground/40 hover:bg-muted",
        )}
      >
        {sign === "minus" ? (
          <Percent className="h-3 w-3" strokeWidth={1.75} />
        ) : (
          <Plus className="h-3 w-3" strokeWidth={1.75} />
        )}
        {ctaLabel}
      </button>
    );
  }
  return (
    <div className="flex items-center justify-between gap-2 rounded-md border border-border bg-background px-3 py-2">
      <button
        type="button"
        onClick={onOpen}
        className="flex min-w-0 flex-col items-start text-left"
      >
        <span className="text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
          {label}
        </span>
        <span className="text-[13px] font-medium text-foreground">
          {(sign === "minus" ? "-" : "+") + formatBRL(amount)}
        </span>
      </button>
      <button
        type="button"
        onClick={onClear}
        aria-label={`Remover ${label.toLowerCase()}`}
        className="grid h-6 w-6 place-items-center rounded-full text-muted-foreground hover:bg-muted hover:text-foreground"
      >
        <X className="h-3 w-3" strokeWidth={1.75} />
      </button>
    </div>
  );
}

function AdjustModal({
  kind,
  subtotal,
  initialMode,
  initialValue,
  onClose,
  onApply,
}: {
  kind: "discount" | "surcharge";
  subtotal: number;
  initialMode: "value" | "percent";
  initialValue: string;
  onClose: () => void;
  onApply: (mode: "value" | "percent", value: string) => void;
}) {
  const isDiscount = kind === "discount";
  const title = isDiscount ? `Desconto sobre: ${formatBRL(subtotal)}` : `Acréscimo sobre: ${formatBRL(subtotal)}`;
  const [valueInput, setValueInput] = useState(initialMode === "value" ? initialValue : "");
  const [percentInput, setPercentInput] = useState(initialMode === "percent" ? initialValue : "");
  const [mode, setMode] = useState<"value" | "percent">(initialMode);

  const parseNum = (s: string) => Number(s.replace(",", ".")) || 0;
  const valueNum = parseNum(valueInput);
  const percentNum = parseNum(percentInput);
  const computed =
    mode === "value"
      ? Math.max(0, isDiscount ? Math.min(subtotal, valueNum) : valueNum)
      : Math.max(0, isDiscount ? Math.min(subtotal, subtotal * (percentNum / 100)) : subtotal * (percentNum / 100));

  const canApply = computed > 0;

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-md rounded-lg border border-border bg-background shadow-xl"
      >
        <div className="flex items-center justify-between border-b border-border px-5 py-4">
          <h3 className="text-[14px] font-medium text-foreground">{title}</h3>
          <button
            onClick={onClose}
            aria-label="Fechar"
            className="grid h-8 w-8 place-items-center rounded-full text-muted-foreground hover:bg-muted hover:text-foreground"
          >
            <X className="h-4 w-4" strokeWidth={1.5} />
          </button>
        </div>
        <div className="grid grid-cols-2 gap-3 px-5 py-5">
          <label
            className={cn(
              "flex flex-col gap-1 rounded-md border px-3 py-2 transition-colors",
              mode === "value" ? "border-foreground" : "border-border",
            )}
            onClick={() => setMode("value")}
          >
            <span className="text-[11px] text-muted-foreground">
              {isDiscount ? "Desconto em valor" : "Acréscimo em valor"}
            </span>
            <div className="flex items-baseline gap-1">
              <span className="text-[12px] text-muted-foreground">R$</span>
              <input
                autoFocus={initialMode === "value"}
                value={valueInput}
                onFocus={() => setMode("value")}
                onChange={(e) => {
                  const v = e.target.value.replace(/[^0-9.,]/g, "");
                  setValueInput(v);
                  if (v) setPercentInput("");
                }}
                inputMode="decimal"
                placeholder="0,00"
                className="w-full min-w-0 bg-transparent text-[16px] font-medium text-foreground outline-none placeholder:text-muted-foreground"
              />
            </div>
          </label>
          <label
            className={cn(
              "flex flex-col gap-1 rounded-md border px-3 py-2 transition-colors",
              mode === "percent" ? "border-foreground" : "border-border",
            )}
            onClick={() => setMode("percent")}
          >
            <span className="text-[11px] text-muted-foreground">
              {isDiscount ? "Desconto percentual" : "Acréscimo percentual"}
            </span>
            <div className="flex items-baseline gap-1">
              <input
                autoFocus={initialMode === "percent"}
                value={percentInput}
                onFocus={() => setMode("percent")}
                onChange={(e) => {
                  const v = e.target.value.replace(/[^0-9.,]/g, "");
                  setPercentInput(v);
                  if (v) setValueInput("");
                }}
                inputMode="decimal"
                placeholder="0,00"
                className="w-full min-w-0 bg-transparent text-[16px] font-medium text-foreground outline-none placeholder:text-muted-foreground"
              />
              <span className="text-[12px] text-muted-foreground">%</span>
            </div>
          </label>
        </div>
        {computed > 0 && (
          <div className="mx-5 mb-2 flex items-baseline justify-between rounded-md bg-muted px-3 py-2">
            <span className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
              {isDiscount ? "Desconto aplicado" : "Acréscimo aplicado"}
            </span>
            <span className="text-[13px] font-medium text-foreground">
              {(isDiscount ? "-" : "+") + formatBRL(computed)}
            </span>
          </div>
        )}
        <div className="flex items-center justify-end gap-2 border-t border-border px-5 py-3">
          <button
            onClick={onClose}
            className="rounded-md px-3 py-2 text-[12px] font-medium text-muted-foreground hover:text-foreground"
          >
            Cancelar
          </button>
          <button
            onClick={() => onApply(mode, mode === "value" ? valueInput : percentInput)}
            disabled={!canApply}
            className={cn(
              "rounded-md bg-primary px-4 py-2 text-[12px] font-medium text-primary-foreground transition-colors",
              canApply ? "hover:bg-graphite" : "cursor-not-allowed opacity-50",
            )}
          >
            Aplicar {isDiscount ? "desconto" : "acréscimo"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ---------------- Variant modal ----------------

function VariantModal({
  product,
  onClose,
  onPick,
}: {
  product: ProductRecord;
  onClose: () => void;
  onPick: (v: VariantRow) => void;
}) {
  const { data = [], isLoading } = useQuery({
    queryKey: ["pos-variants", product.id],
    queryFn: () => listProductVariants(product.id),
  });

  const base =
    product.promo_price != null && product.promo_price < product.price
      ? product.promo_price
      : product.price;

  return (
    <ModalShell onClose={onClose} title={`Escolher variação · ${product.name}`}>
      {isLoading ? (
        <div className="grid place-items-center py-12 text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin" strokeWidth={1.5} />
        </div>
      ) : data.length === 0 ? (
        <p className="py-8 text-center text-[13px] text-muted-foreground">
          Este produto não possui variações cadastradas.
        </p>
      ) : (
        <ul className="divide-y divide-border">
          {data.map((v) => {
            const price = v.price != null ? v.price : base;
            const disabled = !v.available;
            return (
              <li key={v.id}>
                <button
                  disabled={disabled}
                  onClick={() => onPick(v)}
                  className={cn(
                    "flex w-full items-center gap-3 px-1 py-3 text-left transition-colors",
                    disabled
                      ? "cursor-not-allowed opacity-50"
                      : "hover:bg-muted/40",
                  )}
                >
                  <div className="h-12 w-12 shrink-0 overflow-hidden rounded-md bg-muted">
                    {v.image_url ? (
                      <img src={v.image_url} alt="" className="h-full w-full object-cover" />
                    ) : product.primary_image ? (
                      <img
                        src={product.primary_image}
                        alt=""
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <div className="grid h-full w-full place-items-center text-muted-foreground">
                        <ImageIcon className="h-4 w-4" strokeWidth={1.4} />
                      </div>
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-[13px] font-medium text-foreground">
                      {variantLabel(v.options)}
                    </div>
                    {!v.available && (
                      <div className="text-[11.5px] text-muted-foreground">Indisponível</div>
                    )}
                  </div>
                  <div className="text-[13px] font-medium text-foreground">
                    {formatBRL(price)}
                  </div>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </ModalShell>
  );
}

// ---------------- Customer modal ----------------

function CustomerModal({
  storeId,
  onClose,
  onSelect,
  onContinueWithout,
}: {
  storeId: string;
  onClose: () => void;
  onSelect: (c: CustomerLite) => void;
  onContinueWithout: () => void;
}) {
  const [q, setQ] = useState("");
  const [creating, setCreating] = useState(false);
  const [savingNew, setSavingNew] = useState(false);
  const [newName, setNewName] = useState("");
  const [newPhone, setNewPhone] = useState("");
  const [newEmail, setNewEmail] = useState("");

  const { data = [], isLoading, refetch } = useQuery({
    queryKey: ["pos-customers", storeId, q],
    queryFn: () => listCustomers(storeId, q),
    enabled: !!storeId,
  });

  const submitNew = async () => {
    if (!newName.trim()) return;
    setSavingNew(true);
    try {
      const c = await createCustomer(storeId, newName, newPhone, newEmail);
      await refetch();
      onSelect(c);
    } catch (e: any) {
      alert(e?.message ?? "Falha ao criar cliente.");
    } finally {
      setSavingNew(false);
    }
  };

  return (
    <ModalShell onClose={onClose} title="Selecionar cliente">
      {creating ? (
        <div className="space-y-3">
          <Field label="Nome">
            <input
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="Nome completo"
              className="w-full rounded-md border border-border bg-background px-3 py-2 text-[13px] outline-none focus:border-foreground/40"
            />
          </Field>
          <Field label="Telefone">
            <input
              value={newPhone}
              onChange={(e) => setNewPhone(e.target.value)}
              placeholder="(11) 99999-9999"
              className="w-full rounded-md border border-border bg-background px-3 py-2 text-[13px] outline-none focus:border-foreground/40"
            />
          </Field>
          <Field label="E-mail (opcional)">
            <input
              value={newEmail}
              onChange={(e) => setNewEmail(e.target.value)}
              placeholder="cliente@email.com"
              className="w-full rounded-md border border-border bg-background px-3 py-2 text-[13px] outline-none focus:border-foreground/40"
            />
          </Field>
          <div className="flex justify-end gap-2 pt-2">
            <button
              onClick={() => setCreating(false)}
              className="rounded-md border border-border px-3 py-2 text-[12.5px] text-muted-foreground hover:text-foreground"
            >
              Cancelar
            </button>
            <button
              disabled={!newName.trim() || savingNew}
              onClick={submitNew}
              className={cn(
                "rounded-md bg-primary px-4 py-2 text-[12.5px] font-medium text-primary-foreground",
                !newName.trim() || savingNew ? "opacity-50" : "hover:bg-graphite",
              )}
            >
              {savingNew ? "Salvando…" : "Cadastrar e usar"}
            </button>
          </div>
        </div>
      ) : (
        <>
          <div className="mb-3 flex items-center gap-2 rounded-md border border-border bg-background px-3 py-2 focus-within:border-foreground/40">
            <Search className="h-3.5 w-3.5 text-muted-foreground" strokeWidth={1.5} />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Buscar por nome, telefone ou e-mail"
              className="w-full bg-transparent text-[13px] outline-none placeholder:text-muted-foreground"
            />
          </div>
          <div className="max-h-[300px] overflow-y-auto">
            {isLoading ? (
              <div className="grid place-items-center py-8 text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" strokeWidth={1.5} />
              </div>
            ) : data.length === 0 ? (
              <p className="py-6 text-center text-[12.5px] text-muted-foreground">
                Nenhum cliente encontrado.
              </p>
            ) : (
              <ul className="divide-y divide-border">
                {data.map((c) => (
                  <li key={c.id}>
                    <button
                      onClick={() => onSelect(c)}
                      className="flex w-full items-center justify-between gap-2 px-1 py-2.5 text-left hover:bg-muted/40"
                    >
                      <div className="min-w-0">
                        <div className="truncate text-[13px] font-medium text-foreground">
                          {c.name}
                        </div>
                        <div className="truncate text-[11.5px] text-muted-foreground">
                          {c.phone ?? c.email ?? "—"}
                        </div>
                      </div>
                      <ArrowRight
                        className="h-3.5 w-3.5 text-muted-foreground"
                        strokeWidth={1.5}
                      />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
          <div className="mt-4 flex flex-wrap justify-between gap-2 border-t border-border pt-3">
            <button
              onClick={onContinueWithout}
              className="text-[12.5px] text-muted-foreground hover:text-foreground"
            >
              Continuar sem cliente
            </button>
            <button
              onClick={() => setCreating(true)}
              className="inline-flex items-center gap-1.5 rounded-md border border-border bg-surface px-3 py-1.5 text-[12.5px] hover:bg-muted"
            >
              <UserPlus className="h-3.5 w-3.5" strokeWidth={1.5} />
              Novo cliente
            </button>
          </div>
        </>
      )}
    </ModalShell>
  );
}

// ---------------- Payment modal ----------------

function PaymentModal({
  total,
  saving,
  onClose,
  onConfirm,
}: {
  total: number;
  saving: boolean;
  onClose: () => void;
  onConfirm: (
    method: PaymentMethod,
    details: Record<string, unknown>,
    paid: number | null,
    change: number | null,
  ) => void;
}) {
  const [method, setMethod] = useState<PaymentMethod>("cash");
  const [cashInput, setCashInput] = useState("");
  const [note, setNote] = useState("");
  const [installments, setInstallments] = useState("1");
  const [brand, setBrand] = useState("");
  const [otherLabel, setOtherLabel] = useState("");

  const cashValue = Number(cashInput.replace(",", ".")) || 0;
  const change = method === "cash" ? Math.max(0, cashValue - total) : 0;
  const cashInsufficient = method === "cash" && cashValue < total;

  const canConfirm = !saving && !cashInsufficient && (method !== "other" || otherLabel.trim());

  const submit = () => {
    let details: Record<string, unknown> = {};
    let paid: number | null = null;
    let ch: number | null = null;
    if (method === "cash") {
      paid = cashValue;
      ch = change;
      if (note.trim()) details.note = note.trim();
    } else if (method === "pix" || method === "transfer") {
      if (note.trim()) details.note = note.trim();
    } else if (method === "credit") {
      details.installments = Number(installments) || 1;
      if (brand.trim()) details.brand = brand.trim();
    } else if (method === "debit") {
      if (brand.trim()) details.brand = brand.trim();
    } else if (method === "other") {
      details.label = otherLabel.trim();
      if (note.trim()) details.note = note.trim();
    }
    onConfirm(method, details, paid, ch);
  };

  const methods: PaymentMethod[] = ["cash", "pix", "debit", "credit", "transfer", "other"];

  return (
    <ModalShell onClose={onClose} title="Pagamento">
      <div className="mb-4 flex items-baseline justify-between border-b border-border pb-3">
        <span className="text-[12px] uppercase tracking-[0.18em] text-muted-foreground">
          Total
        </span>
        <span className="text-[22px] font-medium text-foreground">{formatBRL(total)}</span>
      </div>

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        {methods.map((m) => (
          <button
            key={m}
            onClick={() => setMethod(m)}
            className={cn(
              "rounded-md border px-3 py-2 text-[12.5px] transition-colors",
              method === m
                ? "border-foreground bg-foreground text-background"
                : "border-border bg-surface text-foreground hover:border-foreground/40",
            )}
          >
            {paymentMethodLabel[m]}
          </button>
        ))}
      </div>

      <div className="mt-4 space-y-3">
        {method === "cash" && (
          <>
            <Field label="Valor recebido">
              <input
                autoFocus
                value={cashInput}
                onChange={(e) => setCashInput(e.target.value.replace(/[^0-9.,]/g, ""))}
                placeholder="0,00"
                inputMode="decimal"
                className="w-full rounded-md border border-border bg-background px-3 py-2 text-right text-[14px] outline-none focus:border-foreground/40"
              />
            </Field>
            <div className="flex items-baseline justify-between rounded-md bg-muted px-3 py-2">
              <span className="text-[12px] text-muted-foreground">Troco</span>
              <span className="text-[14px] font-medium text-foreground">
                {formatBRL(change)}
              </span>
            </div>
            {cashInsufficient && (
              <p className="text-[11.5px] text-red-600">
                Valor recebido menor que o total.
              </p>
            )}
          </>
        )}

        {(method === "pix" || method === "transfer" || method === "other") && (
          <>
            {method === "other" && (
              <Field label="Descrição">
                <input
                  value={otherLabel}
                  onChange={(e) => setOtherLabel(e.target.value)}
                  placeholder="Ex: crédito na loja"
                  className="w-full rounded-md border border-border bg-background px-3 py-2 text-[13px] outline-none focus:border-foreground/40"
                />
              </Field>
            )}
            <Field label="Observação (opcional)">
              <textarea
                value={note}
                onChange={(e) => setNote(e.target.value)}
                rows={2}
                className="w-full rounded-md border border-border bg-background px-3 py-2 text-[13px] outline-none focus:border-foreground/40"
              />
            </Field>
          </>
        )}

        {method === "debit" && (
          <Field label="Bandeira (opcional)">
            <input
              value={brand}
              onChange={(e) => setBrand(e.target.value)}
              placeholder="Visa, Mastercard…"
              className="w-full rounded-md border border-border bg-background px-3 py-2 text-[13px] outline-none focus:border-foreground/40"
            />
          </Field>
        )}

        {method === "credit" && (
          <div className="grid grid-cols-2 gap-3">
            <Field label="Parcelas">
              <select
                value={installments}
                onChange={(e) => setInstallments(e.target.value)}
                className="w-full rounded-md border border-border bg-background px-3 py-2 text-[13px] outline-none focus:border-foreground/40"
              >
                {Array.from({ length: 12 }).map((_, i) => (
                  <option key={i + 1} value={String(i + 1)}>
                    {i + 1}x
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Bandeira (opcional)">
              <input
                value={brand}
                onChange={(e) => setBrand(e.target.value)}
                placeholder="Visa, Mastercard…"
                className="w-full rounded-md border border-border bg-background px-3 py-2 text-[13px] outline-none focus:border-foreground/40"
              />
            </Field>
          </div>
        )}
      </div>

      <div className="mt-5 flex justify-end gap-2 border-t border-border pt-3">
        <button
          onClick={onClose}
          className="rounded-md border border-border px-4 py-2 text-[12.5px] text-muted-foreground hover:text-foreground"
        >
          Voltar
        </button>
        <button
          disabled={!canConfirm}
          onClick={submit}
          className={cn(
            "inline-flex items-center gap-2 rounded-md bg-primary px-5 py-2 text-[12.5px] font-medium text-primary-foreground",
            !canConfirm ? "cursor-not-allowed opacity-50" : "hover:bg-graphite",
          )}
        >
          {saving ? (
            <>
              <Loader2 className="h-3.5 w-3.5 animate-spin" strokeWidth={1.75} />
              Registrando…
            </>
          ) : (
            <>
              <Check className="h-3.5 w-3.5" strokeWidth={1.75} />
              Confirmar venda
            </>
          )}
        </button>
      </div>
    </ModalShell>
  );
}

// ---------------- Receipt ----------------

interface CompletedSaleSnapshot {
  items: CartLine[];
  customer: CustomerLite | null;
  subtotal: number;
  discount: number;
  surcharge: number;
  total: number;
  method: PaymentMethod;
  paidAmount: number | null;
  changeDue: number | null;
}

function ReceiptModal({
  sale,
  onNew,
  onClose,
}: {
  sale: SavedSale & { snapshot: CompletedSaleSnapshot };
  onNew: () => void;
  onClose: () => void;
}) {
  const navigate = useNavigate();
  const s = sale.snapshot;
  const date = new Date(sale.created_at);
  const dateStr = date.toLocaleString("pt-BR");
  const whatsText = buildWhatsappText(sale, s);
  const receiptRef = useRef<HTMLDivElement>(null);

  const handlePrint = () => {
    window.print();
  };

  const handleShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({ title: `Venda #${sale.number}`, text: whatsText });
      } catch {
        /* cancelled */
      }
    } else {
      await navigator.clipboard.writeText(whatsText);
      alert("Resumo copiado para a área de transferência.");
    }
  };

  return (
    <ModalShell onClose={onClose} title="Venda concluída" wide>
      <div ref={receiptRef} className="print:m-0 print:bg-white print:p-6">
        <div className="mx-auto mb-4 grid h-12 w-12 place-items-center rounded-full bg-foreground text-background">
          <Check className="h-5 w-5" strokeWidth={2} />
        </div>
        <div className="text-center">
          <div className="text-[11px] uppercase tracking-[0.2em] text-muted-foreground">
            Venda #{sale.number || "—"}
          </div>
          <div className="mt-1 text-[12.5px] text-muted-foreground">{dateStr}</div>
        </div>

        <div className="mt-5 rounded-md border border-border">
          {s.customer && (
            <div className="border-b border-border px-4 py-2.5 text-[12.5px]">
              <span className="text-muted-foreground">Cliente: </span>
              <span className="text-foreground">{s.customer.name}</span>
              {s.customer.phone && (
                <span className="text-muted-foreground"> · {s.customer.phone}</span>
              )}
            </div>
          )}
          <ul className="divide-y divide-border">
            {s.items.map((i) => (
              <li key={i.key} className="flex items-start justify-between gap-3 px-4 py-2.5">
                <div className="min-w-0">
                  <div className="truncate text-[13px] text-foreground">
                    {i.product_name}
                    {i.variant_name && (
                      <span className="text-muted-foreground"> · {i.variant_name}</span>
                    )}
                  </div>
                  <div className="text-[11.5px] text-muted-foreground">
                    {i.quantity} × {formatBRL(i.unit_price)}
                  </div>
                </div>
                <div className="text-[13px] text-foreground">
                  {formatBRL(i.unit_price * i.quantity)}
                </div>
              </li>
            ))}
          </ul>
          <div className="space-y-1 border-t border-border px-4 py-3 text-[12.5px]">
            <SummaryLine label="Subtotal" value={formatBRL(s.subtotal)} />
            {s.discount > 0 && (
              <SummaryLine label="Desconto" value={"− " + formatBRL(s.discount)} />
            )}
            {s.surcharge > 0 && (
              <SummaryLine label="Acréscimo" value={"+ " + formatBRL(s.surcharge)} />
            )}
            <div className="mt-1 flex items-baseline justify-between border-t border-border pt-2">
              <span className="text-[13px] font-medium text-foreground">Total</span>
              <span className="text-[15px] font-medium text-foreground">
                {formatBRL(s.total)}
              </span>
            </div>
            <SummaryLine
              label="Pagamento"
              value={paymentMethodLabel[s.method]}
            />
            {s.paidAmount != null && (
              <SummaryLine label="Recebido" value={formatBRL(s.paidAmount)} />
            )}
            {s.changeDue != null && s.changeDue > 0 && (
              <SummaryLine label="Troco" value={formatBRL(s.changeDue)} />
            )}
          </div>
        </div>
      </div>

      <div className="mt-5 flex flex-wrap justify-between gap-2 border-t border-border pt-4 print:hidden">
        <div className="flex flex-wrap gap-2">
          <button
            onClick={handlePrint}
            className="inline-flex items-center gap-1.5 rounded-md border border-border bg-surface px-3 py-2 text-[12.5px] hover:bg-muted"
          >
            <Printer className="h-3.5 w-3.5" strokeWidth={1.5} />
            Imprimir
          </button>
          <button
            onClick={handleShare}
            className="inline-flex items-center gap-1.5 rounded-md border border-border bg-surface px-3 py-2 text-[12.5px] hover:bg-muted"
          >
            <Share2 className="h-3.5 w-3.5" strokeWidth={1.5} />
            Compartilhar
          </button>
          {s.customer?.phone && (
            <a
              href={`https://wa.me/${s.customer.phone.replace(/\D/g, "")}?text=${encodeURIComponent(whatsText)}`}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1.5 rounded-md border border-border bg-surface px-3 py-2 text-[12.5px] hover:bg-muted"
            >
              WhatsApp
            </a>
          )}
          <button
            onClick={() => navigate({ to: "/admin/pedidos" })}
            className="inline-flex items-center gap-1.5 rounded-md border border-border bg-surface px-3 py-2 text-[12.5px] hover:bg-muted"
          >
            Ver venda
          </button>
        </div>
        <button
          onClick={onNew}
          className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-[12.5px] font-medium text-primary-foreground hover:bg-graphite"
        >
          Nova venda
          <ArrowRight className="h-3.5 w-3.5" strokeWidth={1.75} />
        </button>
      </div>
    </ModalShell>
  );
}

function SummaryLine({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between">
      <span className="text-muted-foreground">{label}</span>
      <span className="text-foreground">{value}</span>
    </div>
  );
}

function buildWhatsappText(
  sale: SavedSale,
  s: CompletedSaleSnapshot,
): string {
  const brl = (v: number) => formatBRL(v);
  const lines = s.items.map(
    (i) =>
      `• ${i.product_name}${i.variant_name ? ` — ${i.variant_name}` : ""} × ${i.quantity} — ${brl(
        i.unit_price * i.quantity,
      )}`,
  );
  return [
    `Venda #${sale.number}`,
    ...lines,
    `Total: ${brl(s.total)}`,
    `Pagamento: ${paymentMethodLabel[s.method]}`,
  ].join("\n");
}

// ---------------- Shared ----------------

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-[11.5px] uppercase tracking-[0.14em] text-muted-foreground">
        {label}
      </span>
      {children}
    </label>
  );
}

function ModalShell({
  onClose,
  title,
  children,
  wide,
}: {
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  wide?: boolean;
}) {
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener("keydown", onKey);
    };
  }, [onClose]);
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div
        onClick={onClose}
        className="absolute inset-0 bg-black/40 backdrop-blur-[2px]"
      />
      <div
        role="dialog"
        aria-modal="true"
        className={cn(
          "relative w-full rounded-lg border border-border bg-background shadow-xl",
          wide ? "max-w-xl" : "max-w-md",
        )}
      >
        <div className="flex items-center justify-between border-b border-border px-5 py-3">
          <h3 className="truncate text-[13.5px] font-medium text-foreground">{title}</h3>
          <button
            onClick={onClose}
            aria-label="Fechar"
            className="text-muted-foreground hover:text-foreground"
          >
            <X className="h-4 w-4" strokeWidth={1.5} />
          </button>
        </div>
        <div className="max-h-[80vh] overflow-y-auto px-5 py-4">{children}</div>
      </div>
    </div>
  );
}
