import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { z } from "zod";
import { ProductListing } from "@/components/loja/product-listing";
import { listingSearchSchema, type ListingSearch } from "@/lib/product-listing";
import {
  filterProductsBySearch,
  listActiveProducts,
  listPublicCategories,
} from "@/lib/public-shop";
import { useStorefront } from "@/lib/storefront-context";

const searchSchema = listingSearchSchema.extend({
  q: z.string().catch("").optional(),
});

export const Route = createFileRoute("/loja/$slug/busca")({
  validateSearch: (s) => searchSchema.parse(s),
  component: BuscaPage,
});

// Resultado da busca do cabeçalho (escopo do catálogo, §4) e "Todos os produtos" (sem termo).
// A busca roda no navegador sobre os produtos ativos da loja, a mesma lista da página inicial.
function BuscaPage() {
  const store = useStorefront();
  const search = Route.useSearch();
  const navigate = Route.useNavigate();
  const query = (search.q ?? "").trim();
  const { data: products = [], isLoading } = useQuery({
    queryKey: ["public-products", store.id],
    queryFn: () => listActiveProducts(store.id),
  });
  const { data: categories = [] } = useQuery({
    queryKey: ["public-categories", store.id],
    queryFn: () => listPublicCategories(store.id),
  });
  const found = filterProductsBySearch(products, query);

  return (
    <section className="mx-auto max-w-[1280px] px-4 py-8 md:px-8 md:py-12">
      <div className="text-[11px] font-medium uppercase tracking-[0.24em] text-neutral-500">
        {query ? "Busca" : "Produtos"}
      </div>
      <h1 className="mt-2 break-words text-2xl font-semibold text-black md:text-3xl">
        {query ? `Resultado para “${query}”` : "Todos os produtos"}
      </h1>
      <ProductListing
        products={found}
        loading={isLoading}
        search={search}
        categories={categories}
        onSearchChange={(patch: Partial<ListingSearch>) =>
          navigate({ search: (prev) => ({ ...prev, ...patch }), replace: true })
        }
        emptyMessage={
          <>
            <p className="text-[14px] font-medium text-black">Nenhum produto encontrado.</p>
            <p className="mt-1">Confira a palavra digitada ou tente um termo mais curto.</p>
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
