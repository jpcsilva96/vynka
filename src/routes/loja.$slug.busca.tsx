import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { z } from "zod";
import { ProductCard } from "@/components/loja/product-card";
import { filterProductsBySearch, listActiveProducts } from "@/lib/public-shop";
import { useStorefront } from "@/lib/storefront-context";

const searchSchema = z.object({
  q: z.string().catch("").optional(),
});

export const Route = createFileRoute("/loja/$slug/busca")({
  validateSearch: (s) => searchSchema.parse(s),
  component: BuscaPage,
});

// Resultado da busca do cabeçalho (escopo do catálogo, §4). A busca roda no navegador sobre os
// produtos ativos da loja, a mesma lista que a página inicial já carrega.
function BuscaPage() {
  const store = useStorefront();
  const query = (Route.useSearch().q ?? "").trim();
  const { data: products = [], isLoading } = useQuery({
    queryKey: ["public-products", store.id],
    queryFn: () => listActiveProducts(store.id),
  });
  const results = filterProductsBySearch(products, query);

  return (
    <section className="mx-auto max-w-[1280px] px-4 py-8 md:px-8 md:py-12">
      <div className="border-b border-black/10 pb-6">
        <div className="text-[11px] font-medium uppercase tracking-[0.24em] text-neutral-500">
          {query ? "Busca" : "Produtos"}
        </div>
        <h1 className="mt-2 break-words text-2xl font-semibold text-black md:text-3xl">
          {query ? `Resultado para “${query}”` : "Todos os produtos"}
        </h1>
        {!isLoading && (
          <p className="mt-2 text-[13px] text-neutral-500">
            {results.length} produto{results.length === 1 ? "" : "s"} encontrado
            {results.length === 1 ? "" : "s"}
          </p>
        )}
      </div>

      {isLoading ? (
        <div className="grid min-h-[320px] place-items-center text-neutral-400">
          <Loader2 className="h-5 w-5 animate-spin" />
        </div>
      ) : results.length > 0 ? (
        <div className="mt-8 grid grid-cols-2 gap-x-4 gap-y-10 md:grid-cols-3 lg:grid-cols-4">
          {results.map((product) => (
            <ProductCard key={product.id} product={product} />
          ))}
        </div>
      ) : (
        <div className="mt-8 border border-dashed border-black/15 px-6 py-12 text-center">
          <p className="text-[14px] font-medium text-black">Nenhum produto encontrado.</p>
          <p className="mt-1 text-[13px] text-neutral-500">
            Confira a palavra digitada ou tente um termo mais curto.
          </p>
          <Link
            to="/loja/$slug/busca"
            params={{ slug: store.slug }}
            search={{ q: "" }}
            className="mt-5 inline-flex min-h-11 items-center text-[12px] font-medium uppercase tracking-[0.16em] text-black underline underline-offset-4"
          >
            Ver todos os produtos
          </Link>
        </div>
      )}
    </section>
  );
}
