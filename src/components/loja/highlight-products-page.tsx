import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ProductListing } from "@/components/loja/product-listing";
import { newArrivals, onSale, type ListingSearch, type SortKey } from "@/lib/product-listing";
import { listActiveProducts, listPublicCategories } from "@/lib/public-shop";
import { useStorefront } from "@/lib/storefront-context";

const pages = {
  novidades: {
    eyebrow: "Novidades",
    title: "Chegou agora",
    select: newArrivals,
    defaultSort: "novidades" as SortKey,
    empty: "Nenhuma novidade nos últimos dias.",
  },
  promocoes: {
    eyebrow: "Promoções",
    title: "Produtos em promoção",
    select: onSale,
    defaultSort: "menor-preco" as SortKey,
    empty: "Nenhum produto em promoção agora.",
  },
};

// Páginas Novidades (produtos dos últimos 14 dias) e Promoções (preço promocional), destinos do menu e
// dos banners (escopo do catálogo, §4–5).
export function HighlightProductsPage({
  kind,
  search,
  onSearchChange,
}: {
  kind: keyof typeof pages;
  search: ListingSearch;
  onSearchChange: (patch: Partial<ListingSearch>) => void;
}) {
  const store = useStorefront();
  const page = pages[kind];
  const { data: products = [], isLoading } = useQuery({
    queryKey: ["public-products", store.id],
    queryFn: () => listActiveProducts(store.id),
  });
  const { data: categories = [] } = useQuery({
    queryKey: ["public-categories", store.id],
    queryFn: () => listPublicCategories(store.id),
  });

  return (
    <section className="mx-auto max-w-[1280px] px-4 py-8 md:px-8 md:py-12">
      <div className="text-[11px] font-medium uppercase tracking-[0.24em] text-neutral-500">
        {page.eyebrow}
      </div>
      <h1 className="mt-2 text-2xl font-semibold text-black md:text-3xl">{page.title}</h1>
      <ProductListing
        products={page.select(products)}
        loading={isLoading}
        search={search}
        categories={categories}
        defaultSort={page.defaultSort}
        onSearchChange={onSearchChange}
        emptyMessage={
          <>
            <p className="text-[14px] font-medium text-black">{page.empty}</p>
            <Link
              to="/loja/$slug/busca"
              params={{ slug: store.slug }}
              search={{ q: "" }}
              className="mt-5 inline-flex min-h-11 items-center text-[12px] font-medium uppercase tracking-[0.16em] text-black underline underline-offset-4"
            >
              Ver todos os produtos
            </Link>
          </>
        }
      />
    </section>
  );
}
