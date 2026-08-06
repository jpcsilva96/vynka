import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ArrowRight } from "lucide-react";
import { ProductCard } from "@/components/loja/product-card";
import { listActiveProducts, listPublicCategories } from "@/lib/public-shop";
import { useStorefront } from "@/lib/storefront-context";

export const Route = createFileRoute("/loja/$slug/")({
  component: LojaIndex,
});

function LojaIndex() {
  const store = useStorefront();
  const slug = store.slug;
  const { data: products = [] } = useQuery({
    queryKey: ["public-products", store.id],
    queryFn: () => listActiveProducts(store.id),
  });
  const { data: categories = [] } = useQuery({
    queryKey: ["public-categories", store.id],
    queryFn: () => listPublicCategories(store.id),
  });

  const featured = products.filter((product) => product.featured).slice(0, 4);
  const visibleProducts = products.slice(0, 12);
  const visual = store.catalog_visual;
  const heroImage = visual.show_banner ? store.banner_url || products[0]?.primary_image || null : null;
  const description = plainText(store.description);

  return (
    <div>
      {visual.show_banner && (
        <section className="border-b border-black/10 bg-white">
          <div className="mx-auto grid max-w-[1280px] gap-10 px-4 py-12 md:grid-cols-[0.9fr_1.1fr] md:px-8 md:py-20">
            <div className="flex flex-col justify-center">
              <div className="text-[11px] font-medium uppercase tracking-[0.26em] text-neutral-500">Catalogo online</div>
              <h1 className="mt-5 text-4xl font-semibold leading-none tracking-tight text-black md:text-6xl">
                {store.banner_title || store.name}
              </h1>
              <p className="mt-5 max-w-xl text-[15px] leading-relaxed text-neutral-600">
                {store.banner_subtitle || description || "Veja os produtos disponiveis e finalize sua compra de forma simples."}
              </p>
              <div className="mt-8 flex flex-wrap gap-3">
                <Link to="/loja/$slug" params={{ slug }} hash="produtos" className="inline-flex items-center gap-2 bg-black px-5 py-3 text-[12px] font-semibold uppercase tracking-[0.16em] text-white hover:bg-neutral-800">
                  Ver produtos <ArrowRight className="h-4 w-4" />
                </Link>
                {store.whatsapp && (
                  <a href={`#contato`} className="inline-flex items-center border border-black px-5 py-3 text-[12px] font-semibold uppercase tracking-[0.16em] text-black hover:bg-black hover:text-white">
                    Atendimento
                  </a>
                )}
              </div>
            </div>
            <div className="min-h-[360px] bg-neutral-100 md:min-h-[520px]">
              {heroImage ? (
                <img src={heroImage} alt={store.name} className="h-full w-full object-cover" />
              ) : (
                <div className="grid h-full min-h-[360px] place-items-center text-[12px] uppercase tracking-[0.2em] text-neutral-400">
                  {store.name}
                </div>
              )}
            </div>
          </div>
        </section>
      )}

      {!visual.show_banner && visual.show_description && description && (
        <section className="border-b border-black/10 bg-white">
          <div className="mx-auto max-w-[1280px] px-4 py-10 md:px-8 md:py-14">
            <div className="text-[11px] font-medium uppercase tracking-[0.26em] text-neutral-500">Catalogo online</div>
            <h1 className="mt-3 text-3xl font-semibold tracking-tight text-black md:text-5xl">{store.name}</h1>
            <p className="mt-4 max-w-3xl text-[15px] leading-relaxed text-neutral-600">{description}</p>
          </div>
        </section>
      )}

      {visual.show_categories && categories.length > 0 && (
        <section id="categorias" className="mx-auto max-w-[1280px] px-4 py-10 md:px-8 md:py-14">
          <div className="flex items-end justify-between gap-4">
            <div>
              <div className="text-[11px] font-medium uppercase tracking-[0.24em] text-neutral-500">Categorias</div>
              <h2 className="mt-2 text-2xl font-semibold text-black">Explore por categoria</h2>
            </div>
          </div>
          <div className="mt-6 grid grid-cols-2 gap-3 md:grid-cols-4">
            {categories.map((category) => (
              <Link key={category.id} to="/loja/$slug/categoria/$categorySlug" params={{ slug, categorySlug: category.slug }} className="border border-black/10 bg-white px-4 py-5 hover:border-black">
                <div className="font-medium text-black">{category.name}</div>
                <div className="mt-1 text-[12px] text-neutral-500">{category.count} produto{category.count === 1 ? "" : "s"}</div>
              </Link>
            ))}
          </div>
        </section>
      )}

      {visual.show_featured && featured.length > 0 && (
        <section className="border-y border-black/10 bg-neutral-50">
          <div className="mx-auto max-w-[1280px] px-4 py-10 md:px-8 md:py-14">
            <div className="text-[11px] font-medium uppercase tracking-[0.24em] text-neutral-500">Destaques</div>
            <h2 className="mt-2 text-2xl font-semibold text-black">Produtos em destaque</h2>
            <div className="mt-8 grid grid-cols-2 gap-x-4 gap-y-10 md:grid-cols-4">
              {featured.map((product) => (
                <ProductCard key={product.id} product={product} />
              ))}
            </div>
          </div>
        </section>
      )}

      <section id="produtos" className="mx-auto max-w-[1280px] px-4 py-10 md:px-8 md:py-14">
        <div className="text-[11px] font-medium uppercase tracking-[0.24em] text-neutral-500">Produtos</div>
        <h2 className="mt-2 text-2xl font-semibold text-black">Catalogo</h2>
        {visibleProducts.length > 0 ? (
          <div className="mt-8 grid grid-cols-2 gap-x-4 gap-y-10 md:grid-cols-3 lg:grid-cols-4">
            {visibleProducts.map((product) => (
              <ProductCard key={product.id} product={product} />
            ))}
          </div>
        ) : (
          <div className="mt-8 border border-dashed border-black/15 px-6 py-14 text-center text-[13px] text-neutral-500">
            Nenhum produto ativo cadastrado.
          </div>
        )}
      </section>
    </div>
  );
}

function plainText(value: string | null) {
  return (value || "").replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
}
