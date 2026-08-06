import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, Loader2 } from "lucide-react";
import { ProductCard } from "@/components/loja/product-card";
import { listActiveProductsByCategorySlug } from "@/lib/public-shop";
import { useStorefront } from "@/lib/storefront-context";

export function CategoryProductsPage({ categorySlug, childSlug }: { categorySlug: string; childSlug?: string }) {
  const store = useStorefront();
  const { data, isLoading } = useQuery({
    queryKey: ["public-category-products", store.id, categorySlug, childSlug ?? ""],
    queryFn: () => listActiveProductsByCategorySlug(store.id, categorySlug, childSlug),
  });

  return (
    <section className="mx-auto max-w-[1280px] px-4 py-10 md:px-8 md:py-14">
      <Link to="/loja/$slug" params={{ slug: store.slug }} className="inline-flex items-center gap-2 text-[12px] font-medium uppercase tracking-[0.16em] text-neutral-500 hover:text-black">
        <ArrowLeft className="h-4 w-4" /> Voltar
      </Link>

      {isLoading ? (
        <div className="grid min-h-[320px] place-items-center text-neutral-400">
          <Loader2 className="h-5 w-5 animate-spin" />
        </div>
      ) : !data?.category ? (
        <div className="mt-10 border border-black/10 bg-white px-6 py-12 text-center">
          <h1 className="text-2xl font-semibold text-black">Categoria nao encontrada</h1>
          <p className="mt-2 text-[13px] text-neutral-500">Ela pode estar inativa ou ter sido removida.</p>
        </div>
      ) : (
        <>
          <div className="mt-8 border-b border-black/10 pb-8">
            <div className="text-[11px] font-medium uppercase tracking-[0.24em] text-neutral-500">Categoria</div>
            <h1 className="mt-3 text-4xl font-semibold tracking-tight text-black md:text-5xl">{data.category.name}</h1>
            <p className="mt-3 text-[13px] text-neutral-500">
              {data.products.length} produto{data.products.length === 1 ? "" : "s"} encontrado{data.products.length === 1 ? "" : "s"}
            </p>
          </div>

          {data.category.children.length > 0 && !childSlug && (
            <div className="mt-6 flex gap-2 overflow-x-auto pb-2">
              {data.category.children.map((child) => (
                <Link
                  key={child.id}
                  to="/loja/$slug/categoria/$categorySlug/$childSlug"
                  params={{ slug: store.slug, categorySlug: data.category!.slug, childSlug: child.slug }}
                  className="shrink-0 rounded-full border border-black/10 px-4 py-2 text-[12px] text-neutral-700 hover:border-black hover:text-black"
                >
                  {child.name}
                </Link>
              ))}
            </div>
          )}

          {data.products.length > 0 ? (
            <div className="mt-8 grid grid-cols-2 gap-x-4 gap-y-10 md:grid-cols-3 lg:grid-cols-4">
              {data.products.map((product) => (
                <ProductCard key={product.id} product={product} />
              ))}
            </div>
          ) : (
            <div className="mt-10 border border-dashed border-black/15 px-6 py-12 text-center text-[13px] text-neutral-500">
              Nenhum produto ativo nesta categoria.
            </div>
          )}
        </>
      )}
    </section>
  );
}
