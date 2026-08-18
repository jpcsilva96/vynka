import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ArrowRight } from "lucide-react";
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
} from "@/components/ui/carousel";
import { ProductCard } from "@/components/loja/product-card";
import { listActiveProducts, listPublicCategories } from "@/lib/public-shop";
import { useStorefront } from "@/lib/storefront-context";
import type { StoreBanner } from "@/lib/store-settings";

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
  const description = plainText(store.description);
  const banners = visual.show_banner
    ? store.banners.length > 0
      ? store.banners
      : [
          {
            id: "legacy",
            store_id: store.id,
            image_url: store.banner_url || products[0]?.primary_image || "",
            title: store.banner_title || store.name,
            subtitle:
              store.banner_subtitle ||
              description ||
              "Veja os produtos disponiveis e finalize sua compra de forma simples.",
            button_label: store.banner_cta || "Ver produtos",
            link_type: "home" as const,
            link_target: "",
            sort_order: 0,
            active: true,
          },
        ]
    : [];

  return (
    <div>
      {visual.show_banner && banners.length > 0 && (
        <HeroBanners banners={banners} slug={slug} storeName={store.name} />
      )}

      {!visual.show_banner && visual.show_description && description && (
        <section className="border-b border-black/10 bg-white">
          <div className="mx-auto max-w-[1280px] px-4 py-10 md:px-8 md:py-14">
            <h1 className="text-3xl font-semibold tracking-tight text-black md:text-5xl">{store.name}</h1>
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

function HeroBanners({
  banners,
  slug,
  storeName,
}: {
  banners: StoreBanner[];
  slug: string;
  storeName: string;
}) {
  if (banners.length === 1) {
    return <HeroBanner banner={banners[0]} slug={slug} storeName={storeName} />;
  }

  return (
    <section className="border-b border-black/10 bg-white">
      <Carousel opts={{ loop: true }}>
        <CarouselContent className="ml-0">
          {banners.map((banner) => (
            <CarouselItem key={banner.id} className="pl-0">
              <HeroBanner banner={banner} slug={slug} storeName={storeName} />
            </CarouselItem>
          ))}
        </CarouselContent>
        <CarouselPrevious className="left-4 z-30 hidden border-white/30 bg-black/35 text-white backdrop-blur hover:bg-black/55 hover:text-white md:inline-flex" />
        <CarouselNext className="right-4 z-30 hidden border-white/30 bg-black/35 text-white backdrop-blur hover:bg-black/55 hover:text-white md:inline-flex" />
      </Carousel>
    </section>
  );
}

function HeroBanner({
  banner,
  slug,
  storeName,
}: {
  banner: StoreBanner;
  slug: string;
  storeName: string;
}) {
  const target = bannerTargetHref(banner, slug);
  return (
    <section className="border-b border-black/10 bg-neutral-900">
      <div className="relative mx-auto min-h-[420px] w-full max-w-[1600px] overflow-hidden md:min-h-[520px] lg:aspect-[12/5] lg:min-h-0">
        <a
          href={target.href}
          target={target.external ? "_blank" : undefined}
          rel={target.external ? "noreferrer" : undefined}
          className="absolute inset-0 z-0 block bg-neutral-800"
          aria-label={banner.button_label || banner.title || "Abrir destaque"}
        >
          {banner.image_url ? (
            <img src={banner.image_url} alt={banner.title || storeName} className="h-full w-full object-cover" />
          ) : (
            <div className="grid h-full place-items-center text-[12px] uppercase tracking-[0.2em] text-neutral-400">
              {storeName}
            </div>
          )}
        </a>
        <div className="pointer-events-none absolute inset-0 z-10 bg-gradient-to-r from-black/60 via-black/20 to-transparent" />
        <div className="pointer-events-none absolute inset-y-0 left-0 z-10 w-[72%] bg-gradient-to-r from-black/25 to-transparent md:w-[58%]" />

        <div className="relative z-20 flex min-h-[420px] items-end px-5 py-9 sm:px-8 md:min-h-[520px] md:items-center md:px-14 md:py-14 lg:min-h-full lg:px-20">
          <div className="max-w-2xl text-white">
            <h1 className="text-4xl font-semibold leading-tight text-white drop-shadow-sm sm:text-5xl md:text-6xl">
              {banner.title || storeName}
            </h1>
            <p className="mt-4 max-w-xl text-[14px] leading-relaxed text-white/90 drop-shadow-sm md:text-[16px]">
              {banner.subtitle || "Veja os produtos disponíveis e finalize sua compra de forma simples."}
            </p>
            <div className="mt-7 flex flex-wrap gap-3">
              <a
                href={target.href}
                target={target.external ? "_blank" : undefined}
                rel={target.external ? "noreferrer" : undefined}
                className="pointer-events-auto inline-flex items-center gap-2 bg-black px-5 py-3 text-[11px] font-semibold uppercase tracking-[0.16em] text-white transition-colors hover:bg-neutral-800"
              >
                {banner.button_label || "Ver produtos"} <ArrowRight className="h-4 w-4" />
              </a>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function bannerTargetHref(banner: StoreBanner, slug: string) {
  if (banner.link_type === "store_home") {
    return { href: `/loja/${slug}`, external: false };
  }
  if (banner.link_type === "product" && banner.link_target) {
    return { href: `/loja/${slug}/produto/${banner.link_target}`, external: false };
  }
  if (banner.link_type === "category" && banner.link_target) {
    return { href: `/loja/${slug}/categoria/${banner.link_target}`, external: false };
  }
  if (banner.link_type === "external" && banner.link_target) {
    return { href: banner.link_target, external: true };
  }
  return { href: `/loja/${slug}#produtos`, external: false };
}

function plainText(value: string | null) {
  return (value || "").replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
}
