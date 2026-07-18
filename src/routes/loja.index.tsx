import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ArrowRight } from "lucide-react";
import { ProductCard, FeaturedProductCard } from "@/components/loja/product-card";
import {
  listActiveProducts,
  listPublicCategories,
  isOnSale,
} from "@/lib/public-shop";
import { STORE_NAME } from "@/lib/cart";

export const Route = createFileRoute("/loja/")({
  head: () => ({
    meta: [
      { title: `${STORE_NAME} — Coleção` },
      {
        name: "description",
        content:
          "Peças essenciais, seleção cuidadosa. Descubra a nova coleção VYNKA.",
      },
      { property: "og:title", content: `${STORE_NAME} — Coleção` },
      {
        property: "og:description",
        content: "Peças essenciais, seleção cuidadosa.",
      },
    ],
  }),
  component: LojaIndex,
});

function LojaIndex() {
  const { data: products = [] } = useQuery({
    queryKey: ["public-products"],
    queryFn: listActiveProducts,
  });
  const { data: categories = [] } = useQuery({
    queryKey: ["public-categories"],
    queryFn: listPublicCategories,
  });

  const featured = products.filter((p) => p.featured).slice(0, 3);
  const promos = products.filter(isOnSale);
  const visibleCategories = categories.filter((c) => c.count > 0);
  const hasContent = products.length > 0;

  return (
    <div>
      {/* HERO */}
      <section className="relative">
        <div className="relative mx-auto max-w-[1600px] px-4 pt-4 md:px-6 md:pt-6">
          <div className="relative aspect-[16/10] w-full overflow-hidden bg-neutral-100 md:aspect-[21/9]">
            {hasContent && featured[0]?.primary_image ? (
              <img
                src={featured[0].primary_image}
                alt=""
                className="h-full w-full object-cover"
              />
            ) : (
              <div className="absolute inset-0 bg-gradient-to-br from-neutral-50 to-neutral-200" />
            )}
            <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-black/10 to-transparent" />
            <div className="absolute inset-x-0 bottom-0 px-8 pb-12 md:px-16 md:pb-20">
              <div className="max-w-xl">
                <div className="text-[11px] font-medium uppercase tracking-[0.32em] text-white/80">
                  Nova coleção
                </div>
                <h1 className="mt-4 font-serif text-[42px] font-light leading-[0.95] tracking-tight text-white md:text-[68px]">
                  O essencial,<br />refinado.
                </h1>
                <p className="mt-5 max-w-md text-[14px] leading-relaxed text-white/85 md:text-[15px]">
                  Uma seleção atemporal de peças que vestem quem você é.
                </p>
                <div className="mt-8 flex flex-wrap gap-3">
                  <Link
                    to="/loja"
                    hash="novidades"
                    className="inline-flex items-center gap-2 border border-white bg-white px-8 py-3.5 text-[11px] font-medium uppercase tracking-[0.24em] text-neutral-900 transition-colors hover:bg-transparent hover:text-white"
                  >
                    Ver coleção
                  </Link>
                  <Link
                    to="/loja"
                    hash="categorias"
                    className="inline-flex items-center gap-2 border border-white/70 px-8 py-3.5 text-[11px] font-medium uppercase tracking-[0.24em] text-white transition-colors hover:bg-white hover:text-neutral-900"
                  >
                    Categorias
                  </Link>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* CATEGORIAS */}
      {visibleCategories.length > 0 && (
        <section id="categorias" className="mx-auto max-w-[1400px] px-6 py-24 md:px-10 md:py-32">
          <SectionHeader
            eyebrow="Categorias"
            title="Explore por estilo"
          />
          <div className="mt-12 grid gap-6 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
            {visibleCategories.map((c) => (
              <Link
                key={c.id}
                to="/loja"
                hash="novidades"
                className="group relative block aspect-[4/5] overflow-hidden bg-neutral-100"
              >
                {c.cover_url ? (
                  <img
                    src={c.cover_url}
                    alt={c.name}
                    className="h-full w-full object-cover transition-transform duration-[900ms] ease-out group-hover:scale-[1.05]"
                    loading="lazy"
                  />
                ) : (
                  <div className="absolute inset-0 bg-gradient-to-br from-neutral-100 to-neutral-200" />
                )}
                <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-transparent transition-opacity group-hover:from-black/60" />
                <div className="absolute inset-x-0 bottom-0 flex items-end justify-between p-6">
                  <div>
                    <div className="font-serif text-[22px] font-light text-white">
                      {c.name}
                    </div>
                    <div className="mt-1 text-[11px] uppercase tracking-[0.2em] text-white/80">
                      {c.count} peça{c.count === 1 ? "" : "s"}
                    </div>
                  </div>
                  <ArrowRight
                    className="h-4 w-4 text-white transition-transform group-hover:translate-x-1"
                    strokeWidth={1.4}
                  />
                </div>
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* DESTAQUES */}
      {featured.length > 0 && (
        <section className="border-t border-black/[0.06] bg-neutral-50/50">
          <div className="mx-auto max-w-[1400px] px-6 py-24 md:px-10 md:py-32">
            <SectionHeader
              eyebrow="Em destaque"
              title="Nossa curadoria"
              description="Peças escolhidas por sua atemporalidade."
            />
            <div className="mt-14 grid gap-10 md:grid-cols-2 lg:grid-cols-3 lg:gap-8">
              {featured.map((p) => (
                <FeaturedProductCard key={p.id} product={p} />
              ))}
            </div>
          </div>
        </section>
      )}

      {/* GRADE */}
      <section id="novidades" className="mx-auto max-w-[1400px] px-6 py-24 md:px-10 md:py-32">
        <SectionHeader eyebrow="Novidades" title="A coleção" />
        {hasContent ? (
          <div className="mt-12 grid grid-cols-2 gap-x-4 gap-y-12 md:grid-cols-3 md:gap-x-6 lg:grid-cols-4">
            {products.map((p) => (
              <ProductCard key={p.id} product={p} />
            ))}
          </div>
        ) : (
          <EmptyShowcase />
        )}
      </section>

      {/* PROMOÇÕES */}
      {promos.length > 0 && (
        <section id="promocoes" className="border-t border-black/[0.06]">
          <div className="mx-auto max-w-[1400px] px-6 py-24 md:px-10 md:py-32">
            <SectionHeader
              eyebrow="Promoções"
              title="Últimas unidades"
              description="Enquanto durarem os estoques."
            />
            <div className="mt-12 grid grid-cols-2 gap-x-4 gap-y-12 md:grid-cols-3 md:gap-x-6 lg:grid-cols-4">
              {promos.map((p) => (
                <ProductCard key={p.id} product={p} />
              ))}
            </div>
          </div>
        </section>
      )}
    </div>
  );
}

function SectionHeader({
  eyebrow,
  title,
  description,
}: {
  eyebrow: string;
  title: string;
  description?: string;
}) {
  return (
    <div className="flex flex-col items-start gap-3 md:flex-row md:items-end md:justify-between md:gap-8">
      <div>
        <div className="text-[11px] font-medium uppercase tracking-[0.28em] text-neutral-500">
          {eyebrow}
        </div>
        <h2 className="mt-3 font-serif text-[36px] font-light leading-none tracking-tight text-neutral-900 md:text-[48px]">
          {title}
        </h2>
      </div>
      {description && (
        <p className="max-w-sm text-[14px] leading-relaxed text-neutral-600">
          {description}
        </p>
      )}
    </div>
  );
}

function EmptyShowcase() {
  return (
    <div className="mt-16 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i} className="space-y-3">
          <div className="aspect-[3/4] w-full bg-neutral-100" />
          <div className="h-3 w-2/3 bg-neutral-100" />
          <div className="h-3 w-1/3 bg-neutral-100" />
        </div>
      ))}
    </div>
  );
}
