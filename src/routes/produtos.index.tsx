import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import {
  Plus,
  Search,
  Package,
  Filter,
  ChevronDown,
  Star,
  ImageIcon,
} from "lucide-react";
import { PageShell, EmptyState } from "@/components/page-shell";
import {
  listProducts,
  listCategories,
  formatBRL,
  type ProductStatus,
} from "@/lib/products";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/produtos/")({
  head: () => ({
    meta: [
      { title: "Produtos · VYNKA" },
      { name: "description", content: "Cadastre e organize os produtos da sua loja." },
    ],
  }),
  component: ProdutosPage,
});

const statusTabs: { key: "all" | ProductStatus; label: string }[] = [
  { key: "all", label: "Todos" },
  { key: "active", label: "Ativos" },
  { key: "draft", label: "Rascunhos" },
  { key: "archived", label: "Arquivados" },
];

type Order = "recent" | "name-asc" | "price-asc" | "price-desc";

function ProdutosPage() {
  const { data: products = [], isLoading } = useQuery({
    queryKey: ["products"],
    queryFn: listProducts,
  });
  const { data: categories = [] } = useQuery({
    queryKey: ["categories"],
    queryFn: listCategories,
  });

  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<"all" | ProductStatus>("all");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [featuredOnly, setFeaturedOnly] = useState(false);
  const [order, setOrder] = useState<Order>("recent");

  const filtered = useMemo(() => {
    let list = products.slice();
    if (query.trim()) {
      const q = query.toLowerCase();
      list = list.filter((p) => p.name.toLowerCase().includes(q));
    }
    if (status !== "all") list = list.filter((p) => p.status === status);
    if (categoryFilter !== "all")
      list = list.filter((p) => p.category_id === categoryFilter);
    if (featuredOnly) list = list.filter((p) => p.featured);

    switch (order) {
      case "name-asc":
        list.sort((a, b) => a.name.localeCompare(b.name));
        break;
      case "price-asc":
        list.sort((a, b) => a.price - b.price);
        break;
      case "price-desc":
        list.sort((a, b) => b.price - a.price);
        break;
      default:
        list.sort(
          (a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime(),
        );
    }
    return list;
  }, [products, query, status, categoryFilter, featuredOnly, order]);

  const counts = useMemo(
    () => ({
      all: products.length,
      active: products.filter((p) => p.status === "active").length,
      draft: products.filter((p) => p.status === "draft").length,
      archived: products.filter((p) => p.status === "archived").length,
    }),
    [products],
  );

  return (
    <PageShell
      title="Produtos"
      description="Gerencie o catálogo, variações e destaques da sua loja."
      actions={
        <Link
          to="/produtos/novo"
          className="inline-flex items-center gap-1.5 rounded-md bg-primary px-4 py-2 text-[13px] font-medium text-primary-foreground transition-colors hover:bg-graphite"
        >
          <Plus className="h-3.5 w-3.5" strokeWidth={1.75} />
          Novo produto
        </Link>
      }
    >
      {/* Tabs de status */}
      <div className="mb-6 flex flex-wrap items-center gap-1 border-b border-border">
        {statusTabs.map((t) => (
          <button
            key={t.key}
            onClick={() => setStatus(t.key)}
            className={cn(
              "-mb-px flex items-center gap-2 border-b border-transparent px-3 py-2.5 text-[13px] transition-colors",
              status === t.key
                ? "border-foreground text-foreground"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            {t.label}
            <span className="rounded bg-muted px-1.5 py-0.5 text-[11px] text-muted-foreground">
              {counts[t.key]}
            </span>
          </button>
        ))}
      </div>

      {/* Filtros */}
      <div className="mb-4 grid gap-2 sm:grid-cols-[minmax(0,1fr)_auto_auto_auto]">
        <div className="flex items-center gap-2 rounded-md border border-border bg-surface px-3 py-2 focus-within:border-foreground/40">
          <Search className="h-3.5 w-3.5 text-muted-foreground" strokeWidth={1.5} />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Pesquisar por nome"
            className="w-full bg-transparent text-[13px] outline-none placeholder:text-muted-foreground"
          />
        </div>
        <FilterSelect
          icon={<Filter className="h-3.5 w-3.5" strokeWidth={1.5} />}
          value={categoryFilter}
          onChange={setCategoryFilter}
          options={[
            { value: "all", label: "Todas categorias" },
            ...categories.map((c) => ({ value: c.id, label: c.name })),
          ]}
        />
        <button
          onClick={() => setFeaturedOnly((v) => !v)}
          className={cn(
            "inline-flex items-center gap-1.5 rounded-md border px-3 py-2 text-[13px] transition-colors",
            featuredOnly
              ? "border-foreground bg-foreground text-background"
              : "border-border bg-surface text-muted-foreground hover:text-foreground",
          )}
        >
          <Star
            className="h-3.5 w-3.5"
            strokeWidth={1.5}
            fill={featuredOnly ? "currentColor" : "none"}
          />
          Destaque
        </button>
        <FilterSelect
          value={order}
          onChange={(v) => setOrder(v as Order)}
          options={[
            { value: "recent", label: "Mais recentes" },
            { value: "name-asc", label: "Nome A–Z" },
            { value: "price-asc", label: "Menor preço" },
            { value: "price-desc", label: "Maior preço" },
          ]}
        />
      </div>

      {/* Lista */}
      {isLoading ? (
        <div className="grid min-h-[320px] place-items-center text-[13px] text-muted-foreground">
          Carregando…
        </div>
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={<Package className="h-5 w-5" strokeWidth={1.5} />}
          title={products.length === 0 ? "Nenhum produto cadastrado" : "Nada por aqui"}
          description={
            products.length === 0
              ? "Comece adicionando seu primeiro produto. Nome, preço, fotos e variações — tudo em poucos minutos."
              : "Nenhum produto corresponde aos filtros atuais. Ajuste a busca e tente novamente."
          }
        />
      ) : (
        <div className="overflow-hidden rounded-lg border border-border bg-surface">
          <div className="grid grid-cols-[64px_minmax(0,1fr)_120px_120px_100px] items-center gap-4 border-b border-border bg-background/40 px-5 py-2.5 text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
            <span></span>
            <span>Produto</span>
            <span>Categoria</span>
            <span>Preço</span>
            <span>Status</span>
          </div>
          <ul className="divide-y divide-border">
            {filtered.map((p) => (
              <li
                key={p.id}
                className="grid grid-cols-[64px_minmax(0,1fr)_120px_120px_100px] items-center gap-4 px-5 py-3 transition-colors hover:bg-muted/40"
              >
                <div className="grid h-12 w-12 place-items-center overflow-hidden rounded-md bg-muted text-muted-foreground">
                  {p.primary_image ? (
                    <img
                      src={p.primary_image}
                      alt=""
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <ImageIcon className="h-4 w-4" strokeWidth={1.5} />
                  )}
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="truncate text-[14px] font-medium text-foreground">
                      {p.name || "Produto sem nome"}
                    </span>
                    {p.featured && (
                      <Star
                        className="h-3 w-3 text-foreground"
                        strokeWidth={1.5}
                        fill="currentColor"
                      />
                    )}
                  </div>
                  <div className="mt-0.5 text-[12px] text-muted-foreground">
                    {p.variant_count ? `${p.variant_count} variações` : "Sem variações"}
                  </div>
                </div>
                <div className="truncate text-[13px] text-muted-foreground">
                  {p.category?.name ?? "—"}
                </div>
                <div className="text-[13px] text-foreground">
                  {p.promo_price != null && p.promo_price < p.price ? (
                    <span className="flex items-baseline gap-1.5">
                      <span>{formatBRL(p.promo_price)}</span>
                      <span className="text-[11px] text-muted-foreground line-through">
                        {formatBRL(p.price)}
                      </span>
                    </span>
                  ) : (
                    formatBRL(p.price)
                  )}
                </div>
                <StatusPill status={p.status} />
              </li>
            ))}
          </ul>
        </div>
      )}
    </PageShell>
  );
}

function FilterSelect({
  value,
  onChange,
  options,
  icon,
}: {
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
  icon?: React.ReactNode;
}) {
  return (
    <div className="relative flex items-center rounded-md border border-border bg-surface pl-3 pr-2 focus-within:border-foreground/40">
      {icon}
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full appearance-none bg-transparent py-2 pl-2 pr-6 text-[13px] outline-none"
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
      <ChevronDown
        className="pointer-events-none absolute right-2 h-3.5 w-3.5 text-muted-foreground"
        strokeWidth={1.5}
      />
    </div>
  );
}

function StatusPill({ status }: { status: ProductStatus }) {
  const map: Record<ProductStatus, { label: string; className: string }> = {
    active: {
      label: "Ativo",
      className: "bg-foreground text-background",
    },
    draft: {
      label: "Rascunho",
      className: "bg-muted text-muted-foreground",
    },
    archived: {
      label: "Arquivado",
      className: "border border-border text-muted-foreground",
    },
  };
  const s = map[status];
  return (
    <span
      className={cn(
        "inline-flex w-fit items-center rounded-full px-2 py-0.5 text-[11px]",
        s.className,
      )}
    >
      {s.label}
    </span>
  );
}
