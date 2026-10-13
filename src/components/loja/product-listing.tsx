import { useQuery } from "@tanstack/react-query";
import { Loader2, SlidersHorizontal } from "lucide-react";
import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { ProductCard } from "@/components/loja/product-card";
import {
  activeFilterCount,
  filterProducts,
  optionFacets,
  sortOptions,
  sortProducts,
  type ListingSearch,
  type SortKey,
} from "@/lib/product-listing";
import {
  listProductSalesRank,
  normalizeSearchText,
  type PublicCategory,
  type PublicProduct,
} from "@/lib/public-shop";
import { useStorefront } from "@/lib/storefront-context";
import { cn } from "@/lib/utils";
import { StoreDrawer } from "./store-drawer";

// Lista de produtos com Ordenar e Filtros (escopo do catálogo, §5), usada na busca, nas categorias,
// em Novidades e em Promoções. Celular: filtros em gaveta; computador: filtros na coluna da esquerda.
export function ProductListing({
  products,
  loading,
  search,
  onSearchChange,
  categories,
  defaultSort = "mais-vendidos",
  emptyMessage,
}: {
  products: PublicProduct[];
  loading?: boolean;
  search: ListingSearch;
  onSearchChange: (patch: Partial<ListingSearch>) => void;
  // Lista de categorias para o filtro de categoria; sem ela (página de categoria), o filtro não aparece.
  categories?: PublicCategory[];
  defaultSort?: SortKey;
  emptyMessage?: ReactNode;
}) {
  const store = useStorefront();
  const sort = search.ordem ?? defaultSort;
  const { data: salesRank = {} } = useQuery({
    queryKey: ["public-sales-rank", store.id],
    queryFn: () => listProductSalesRank(store.id),
    enabled: sort === "mais-vendidos",
  });
  const [filtersOpen, setFiltersOpen] = useState(false);
  const closeFilters = useCallback(() => setFiltersOpen(false), []);

  const results = useMemo(
    () => sortProducts(filterProducts(products, search, categories ?? []), sort, salesRank),
    [products, search, categories, sort, salesRank],
  );
  const filterCount = activeFilterCount(search);
  const countLabel = `${results.length} produto${results.length === 1 ? "" : "s"}`;

  const panel = (
    <FiltersPanel
      products={products}
      categories={categories}
      search={search}
      onSearchChange={onSearchChange}
    />
  );

  return (
    <div className="mt-6">
      <div className="flex items-center justify-between gap-3 border-b border-black/10 pb-4">
        <p className="text-[13px] text-neutral-500" aria-live="polite">
          {loading ? "Carregando…" : countLabel}
        </p>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setFiltersOpen(true)}
            className="inline-flex h-11 items-center gap-2 rounded-full border border-black/15 px-4 text-[13px] font-medium text-black lg:hidden"
          >
            <SlidersHorizontal className="h-4 w-4" strokeWidth={1.8} />
            Filtrar{filterCount > 0 ? ` (${filterCount})` : ""}
          </button>
          <label className="relative">
            <span className="sr-only">Ordenar por</span>
            <select
              value={sort}
              onChange={(event) =>
                onSearchChange({
                  ordem:
                    event.target.value === defaultSort
                      ? undefined
                      : (event.target.value as SortKey),
                })
              }
              className="h-11 appearance-none rounded-full border border-black/15 bg-transparent pl-4 pr-9 text-[13px] font-medium text-black"
            >
              {sortOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
            <span
              aria-hidden
              className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-[10px] text-neutral-500"
            >
              ▼
            </span>
          </label>
        </div>
      </div>

      <div className="mt-6 lg:grid lg:grid-cols-[240px_minmax(0,1fr)] lg:gap-10">
        <aside aria-label="Filtros" className="hidden lg:block">
          {panel}
        </aside>
        <div>
          {loading ? (
            <div className="grid min-h-[320px] place-items-center text-neutral-400">
              <Loader2 className="h-5 w-5 animate-spin" />
            </div>
          ) : results.length > 0 ? (
            <div className="grid grid-cols-2 gap-x-4 gap-y-10 md:grid-cols-3">
              {results.map((product) => (
                <ProductCard key={product.id} product={product} />
              ))}
            </div>
          ) : (
            <div className="border border-dashed border-black/15 px-6 py-12 text-center text-[13px] text-neutral-500">
              {filterCount > 0 ? (
                <>
                  <p className="text-[14px] font-medium text-black">
                    Nenhum produto com esses filtros.
                  </p>
                  <button
                    type="button"
                    onClick={() => onSearchChange(clearedFilters)}
                    className="mt-4 inline-flex min-h-11 items-center text-[12px] font-medium uppercase tracking-[0.16em] text-black underline underline-offset-4"
                  >
                    Limpar filtros
                  </button>
                </>
              ) : (
                (emptyMessage ?? "Nenhum produto por aqui ainda.")
              )}
            </div>
          )}
        </div>
      </div>

      <div className="lg:hidden">
        <StoreDrawer
          open={filtersOpen}
          onClose={closeFilters}
          title="Filtros"
          side="right"
          footer={
            <div className="p-4">
              <button
                type="button"
                onClick={closeFilters}
                className="h-12 w-full bg-[var(--shop-button)] text-[13px] font-semibold uppercase tracking-[0.14em] text-[var(--shop-button-text)]"
              >
                Ver {countLabel}
              </button>
            </div>
          }
        >
          <div className="px-5 py-4">{panel}</div>
        </StoreDrawer>
      </div>
    </div>
  );
}

const clearedFilters: Partial<ListingSearch> = {
  categoria: undefined,
  min: undefined,
  max: undefined,
  opcao: undefined,
};

function FiltersPanel({
  products,
  categories,
  search,
  onSearchChange,
}: {
  products: PublicProduct[];
  categories?: PublicCategory[];
  search: ListingSearch;
  onSearchChange: (patch: Partial<ListingSearch>) => void;
}) {
  // Grupos de opção e categorias vêm da lista inteira da página (não somem ao filtrar).
  const facets = useMemo(() => optionFacets(products), [products]);
  const usedCategories = useMemo(() => {
    if (!categories) return [];
    const productCategoryIds = new Set(
      products.map((product) => product.category?.id).filter(Boolean),
    );
    const hasProducts = (category: PublicCategory): boolean =>
      productCategoryIds.has(category.id) || category.children.some(hasProducts);
    return categories.filter(hasProducts);
  }, [categories, products]);
  const selected = new Set((search.opcao ?? []).map(normalizeSearchText));

  const toggleOption = (key: string) => {
    const current = search.opcao ?? [];
    const normalized = normalizeSearchText(key);
    const next = selected.has(normalized)
      ? current.filter((item) => normalizeSearchText(item) !== normalized)
      : [...current, key];
    onSearchChange({ opcao: next.length > 0 ? next : undefined });
  };

  return (
    <div className="space-y-7">
      {usedCategories.length > 0 && (
        <FilterGroup title="Categoria">
          <div className="flex flex-col">
            {[{ slug: undefined as string | undefined, name: "Todas" }, ...usedCategories].map(
              (category) => {
                const active = search.categoria === category.slug;
                return (
                  <button
                    key={category.slug ?? "todas"}
                    type="button"
                    onClick={() => onSearchChange({ categoria: category.slug })}
                    aria-pressed={active}
                    className={cn(
                      "flex min-h-11 items-center text-left text-[14px] text-neutral-600",
                      active && "font-semibold text-black underline underline-offset-4",
                    )}
                  >
                    {category.name}
                  </button>
                );
              },
            )}
          </div>
        </FilterGroup>
      )}

      <FilterGroup title="Preço">
        <div className="grid grid-cols-2 gap-3">
          <PriceInput label="De" value={search.min} onChange={(min) => onSearchChange({ min })} />
          <PriceInput label="Até" value={search.max} onChange={(max) => onSearchChange({ max })} />
        </div>
      </FilterGroup>

      {facets.map((facet) => (
        <FilterGroup key={facet.name} title={facet.name}>
          <div className="flex flex-wrap gap-2">
            {facet.values.map((value) => {
              const active = selected.has(normalizeSearchText(value.key));
              return (
                <button
                  key={value.key}
                  type="button"
                  onClick={() => toggleOption(value.key)}
                  aria-pressed={active}
                  className={cn(
                    "min-h-11 min-w-11 rounded-full border px-4 text-[13px]",
                    active
                      ? "border-black bg-black text-white"
                      : "border-black/15 text-black hover:border-black",
                  )}
                >
                  {value.label}
                </button>
              );
            })}
          </div>
        </FilterGroup>
      ))}

      {activeFilterCount(search) > 0 && (
        <button
          type="button"
          onClick={() => onSearchChange(clearedFilters)}
          className="inline-flex min-h-11 items-center text-[12px] font-medium uppercase tracking-[0.16em] text-black underline underline-offset-4"
        >
          Limpar filtros
        </button>
      )}
    </div>
  );
}

function FilterGroup({ title, children }: { title: string; children: ReactNode }) {
  return (
    <fieldset>
      <legend className="mb-2 text-[11px] font-semibold uppercase tracking-[0.2em] text-neutral-500">
        {title}
      </legend>
      {children}
    </fieldset>
  );
}

// Valor em reais; aplica ao sair do campo ou com Enter (não refaz a lista a cada tecla).
function PriceInput({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number | undefined;
  onChange: (value: number | undefined) => void;
}) {
  const [text, setText] = useState(value != null ? String(value) : "");
  useEffect(() => setText(value != null ? String(value) : ""), [value]);
  const apply = () => {
    const parsed = Number(text.replace(/[^\d,.]/g, "").replace(",", "."));
    const next = text.trim() === "" || !Number.isFinite(parsed) ? undefined : parsed;
    if (next !== value) onChange(next);
  };
  return (
    <label className="block">
      <span className="mb-1 block text-[12px] text-neutral-500">{label}</span>
      <div className="flex h-11 items-center rounded-md border border-black/15 px-3 focus-within:border-black">
        <span className="mr-1 text-[13px] text-neutral-500">R$</span>
        <input
          inputMode="decimal"
          value={text}
          onChange={(event) => setText(event.target.value)}
          onBlur={apply}
          onKeyDown={(event) => {
            if (event.key === "Enter") apply();
          }}
          className="w-full min-w-0 bg-transparent text-[14px] text-black outline-none"
          aria-label={`Preço ${label.toLowerCase()}`}
        />
      </div>
    </label>
  );
}
