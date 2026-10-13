import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, Loader2 } from "lucide-react";
import { ProductListing } from "@/components/loja/product-listing";
import type { ListingSearch } from "@/lib/product-listing";
import { listActiveProductsByCategorySlug } from "@/lib/public-shop";
import { useStorefront } from "@/lib/storefront-context";

export function CategoryProductsPage({
  categorySlug,
  childSlug,
  search,
  onSearchChange,
}: {
  categorySlug: string;
  childSlug?: string;
  search: ListingSearch;
  onSearchChange: (patch: Partial<ListingSearch>) => void;
}) {
  const store = useStorefront();
  const { data, isLoading } = useQuery({
    queryKey: ["public-category-products", store.id, categorySlug, childSlug ?? ""],
    queryFn: () => listActiveProductsByCategorySlug(store.id, categorySlug, childSlug),
  });

  return (
    <section className="mx-auto max-w-[1280px] px-4 py-8 md:px-8 md:py-12">
      <Link
        to="/loja/$slug"
        params={{ slug: store.slug }}
        className="inline-flex min-h-11 items-center gap-2 text-[12px] font-medium uppercase tracking-[0.16em] text-neutral-500 hover:text-black"
      >
        <ArrowLeft className="h-4 w-4" /> Voltar
      </Link>

      {isLoading ? (
        <div className="grid min-h-[320px] place-items-center text-neutral-400">
          <Loader2 className="h-5 w-5 animate-spin" />
        </div>
      ) : !data?.category ? (
        <div className="mt-10 border border-black/10 bg-white px-6 py-12 text-center">
          <h1 className="text-2xl font-semibold text-black">Categoria não encontrada</h1>
          <p className="mt-2 text-[13px] text-neutral-500">
            Ela pode estar inativa ou ter sido removida.
          </p>
        </div>
      ) : (
        <>
          <div className="mt-4">
            <div className="text-[11px] font-medium uppercase tracking-[0.24em] text-neutral-500">
              Categoria
            </div>
            <h1 className="mt-2 text-2xl font-semibold tracking-tight text-black md:text-4xl">
              {data.category.name}
            </h1>
          </div>

          {data.category.children.length > 0 && !childSlug && (
            <div className="mt-5 flex gap-2 overflow-x-auto pb-1">
              {data.category.children.map((child) => (
                <Link
                  key={child.id}
                  to="/loja/$slug/categoria/$categorySlug/$childSlug"
                  params={{
                    slug: store.slug,
                    categorySlug: data.category!.slug,
                    childSlug: child.slug,
                  }}
                  className="inline-flex min-h-11 shrink-0 items-center rounded-full border border-black/10 px-4 text-[13px] text-neutral-700 hover:border-black hover:text-black"
                >
                  {child.name}
                </Link>
              ))}
            </div>
          )}

          <ProductListing
            products={data.products}
            search={search}
            onSearchChange={onSearchChange}
            emptyMessage="Nenhum produto ativo nesta categoria."
          />
        </>
      )}
    </section>
  );
}
