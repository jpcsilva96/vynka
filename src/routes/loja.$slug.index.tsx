import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
  type CarouselApi,
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
  // Banner é só a arte (escopo do catálogo, §5). Sem banner: topo simples com a apresentação.
  const banners: StoreBanner[] = !visual.show_banner
    ? []
    : store.banners.length > 0
      ? store.banners.filter((banner) => banner.image_url)
      : store.banner_url
        ? [
            {
              id: "legacy",
              store_id: store.id,
              image_url: store.banner_url,
              title: "",
              subtitle: "",
              button_label: "",
              link_type: "none",
              link_target: "",
              sort_order: 0,
              active: true,
            },
          ]
        : [];

  return (
    <div>
      <h1 className="sr-only">{store.name}</h1>
      {banners.length > 0 && <HeroBanners banners={banners} slug={slug} storeName={store.name} />}

      {banners.length === 0 && visual.show_description && description && (
        <section className="border-b border-black/10 bg-white">
          <div className="mx-auto max-w-[1280px] px-4 py-10 md:px-8 md:py-14">
            <p className="max-w-3xl text-[15px] leading-relaxed text-neutral-600">{description}</p>
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
        <h2 className="mt-2 text-2xl font-semibold text-black">Catálogo</h2>
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
  const [api, setApi] = useState<CarouselApi>();

  // Passa sozinho a cada 5 s; para se o celular pedir "reduzir movimento".
  useEffect(() => {
    if (!api || banners.length < 2) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const timer = window.setInterval(() => api.scrollNext(), 5000);
    return () => window.clearInterval(timer);
  }, [api, banners.length]);

  if (banners.length === 1) {
    return (
      <section className="border-b border-black/10">
        <HeroBanner banner={banners[0]} slug={slug} storeName={storeName} />
      </section>
    );
  }

  return (
    <section className="border-b border-black/10">
      <Carousel opts={{ loop: true }} setApi={setApi}>
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
  // A arte inteira aparece (12:5) até existir a versão de celular (lote 4.1).
  const image = (
    <img
      src={banner.image_url}
      alt={banner.title || storeName}
      className="mx-auto block aspect-[12/5] w-full max-w-[1600px] object-cover"
    />
  );
  const target = bannerTargetHref(banner, slug);
  if (!target) return image;
  return (
    <a
      href={target.href}
      target={target.external ? "_blank" : undefined}
      rel={target.external ? "noreferrer" : undefined}
      className="block"
    >
      {image}
    </a>
  );
}

function bannerTargetHref(banner: StoreBanner, slug: string) {
  const base = `/loja/${slug}`;
  switch (banner.link_type) {
    case "none":
      return null;
    case "store_home":
      return { href: base, external: false };
    case "product":
      return banner.link_target
        ? { href: `${base}/produto/${banner.link_target}`, external: false }
        : null;
    case "category":
      return banner.link_target
        ? { href: `${base}/categoria/${banner.link_target}`, external: false }
        : null;
    case "about":
      return { href: `${base}/quem-somos`, external: false };
    case "contact":
      return { href: `${base}/contato`, external: false };
    case "external":
      return /^https?:\/\//i.test(banner.link_target)
        ? { href: banner.link_target, external: true }
        : null;
    // Promoções e Novidades ganham página própria no lote 3; até lá, a lista de produtos.
    default:
      return { href: `${base}#produtos`, external: false };
  }
}

function plainText(value: string | null) {
  return (value || "").replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
}
