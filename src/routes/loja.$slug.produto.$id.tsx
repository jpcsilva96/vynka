import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { ChevronLeft, Minus, Plus, Truck, ShieldCheck, RotateCcw } from "lucide-react";
import {
  getPublicProduct,
  listRelatedProducts,
  isOnSale,
  isNew,
  type PublicProductDetail,
} from "@/lib/public-shop";
import { formatBRL, skuKey } from "@/lib/products";
import { addToCart, buildWhatsAppLink, openCart } from "@/lib/cart";
import { ProductCard } from "@/components/loja/product-card";
import { WhatsAppIcon } from "@/components/loja/store-header";
import { useStorefront } from "@/lib/storefront-context";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/loja/$slug/produto/$id")({
  component: ProductPage,
  notFoundComponent: () => (
    <div className="mx-auto max-w-md px-6 py-32 text-center">
      <h1 className="font-serif text-3xl font-light">Produto não encontrado</h1>
      <p className="mt-2 text-[13px] text-neutral-600">
        A peça que você procura pode ter saído da coleção.
      </p>
    </div>
  ),
});

function ProductPage() {
  const store = useStorefront();
  const { id } = Route.useParams();
  const { data: product, isLoading } = useQuery({
    queryKey: ["public-product", store.id, id],
    queryFn: () => getPublicProduct(store.id, id),
  });
  if (isLoading) return <div className="min-h-[60vh]" />;
  if (!product) throw notFound();
  return <ProductView product={product} />;
}

function ProductView({ product }: { product: PublicProductDetail }) {
  const store = useStorefront();
  const slug = store.slug;
  const [selected, setSelected] = useState<Record<string, string>>(() => {
    const init: Record<string, string> = {};
    for (const o of product.options) if (o.values[0]) init[o.name] = o.values[0].value;
    return init;
  });
  const [qty, setQty] = useState(1);
  const [activeImage, setActiveImage] = useState(0);

  const currentVariant = useMemo(() => {
    if (product.options.length === 0) return null;
    const key = skuKey(selected);
    return product.variants.find((v) => v.sku_key === key) ?? null;
  }, [product, selected]);

  const sale = isOnSale(product);
  const displayPrice =
    currentVariant?.price ?? (sale ? product.promo_price! : product.price);

  const images = product.images.length
    ? product.images
    : [{ url: "", position: 0 }];
  const primary =
    currentVariant?.image_url ??
    images[activeImage]?.url ??
    product.primary_image ??
    "";

  const variantLabel = product.options.length
    ? Object.entries(selected)
        .map(([k, v]) => `${k}: ${v}`)
        .join(" · ")
    : null;

  const handleAdd = () => {
    addToCart({
      key: `${product.id}::${skuKey(selected) || "default"}`,
      productId: product.id,
      variantId: currentVariant?.id ?? null,
      name: product.name,
      variantLabel,
      image: primary || null,
      price: displayPrice,
      quantity: qty,
    });
    openCart();
  };

  const waText = `Olá! Tenho interesse em: ${product.name}${
    variantLabel ? ` (${variantLabel})` : ""
  } — ${formatBRL(displayPrice)} × ${qty}`;

  const { data: related = [] } = useQuery({
    queryKey: ["related", store.id, product.id, product.category?.id],
    queryFn: () => listRelatedProducts(store.id, product.category?.id ?? null, product.id, 4),
  });

  return (
    <div>
      {/* Breadcrumb */}
      <div className="mx-auto max-w-[1400px] px-6 pt-8 md:px-10">
        <Link
          to="/loja/$slug"
          params={{ slug }}
          className="inline-flex items-center gap-1.5 text-[11px] uppercase tracking-[0.22em] text-neutral-500 hover:text-black"
        >
          <ChevronLeft className="h-3 w-3" strokeWidth={1.5} />
          Voltar
        </Link>
      </div>

      <div className="mx-auto grid max-w-[1400px] gap-10 px-6 pb-24 pt-8 md:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)] md:gap-16 md:px-10 md:pb-32">
        {/* Galeria */}
        <section className="flex flex-col-reverse gap-4 md:flex-row">
          <div className="flex gap-2 overflow-x-auto md:flex-col md:overflow-visible">
            {images.map((img, i) => (
              <button
                key={i}
                onClick={() => setActiveImage(i)}
                className={cn(
                  "h-20 w-16 shrink-0 overflow-hidden bg-neutral-100 md:h-24 md:w-20",
                  activeImage === i ? "outline outline-1 outline-black" : "",
                )}
              >
                {img.url && (
                  <img src={img.url} alt="" className="h-full w-full object-cover" />
                )}
              </button>
            ))}
          </div>
          <div className="relative flex-1 overflow-hidden bg-neutral-100">
            <div className="relative aspect-[4/5] w-full">
              {primary ? (
                <img
                  src={primary}
                  alt={product.name}
                  className="h-full w-full object-cover"
                />
              ) : (
                <div className="absolute inset-0 bg-gradient-to-br from-neutral-100 to-neutral-200" />
              )}
              {isNew(product.created_at) && (
                <span className="absolute left-4 top-4 bg-white px-2 py-1 text-[10px] font-medium uppercase tracking-[0.18em]">
                  Novo
                </span>
              )}
            </div>
          </div>
        </section>

        {/* Info */}
        <section className="md:sticky md:top-28 md:self-start">
          {product.category?.name && (
            <div className="text-[11px] uppercase tracking-[0.24em] text-neutral-500">
              {product.category.name}
            </div>
          )}
          <h1 className="mt-3 font-serif text-[36px] font-light leading-[1.05] tracking-tight text-neutral-900 md:text-[44px]">
            {product.name}
          </h1>
          <div className="mt-4 flex items-baseline gap-3">
            <span className="text-[20px] text-neutral-900">
              {formatBRL(displayPrice)}
            </span>
            {sale && !currentVariant?.price && (
              <span className="text-[14px] text-neutral-400 line-through">
                {formatBRL(product.price)}
              </span>
            )}
          </div>

          {product.description && (
            <div
              className="prose prose-neutral mt-6 max-w-none text-[14px] leading-relaxed text-neutral-700 [&_h3]:font-serif [&_h3]:text-[16px]"
              dangerouslySetInnerHTML={{ __html: product.description }}
            />
          )}

          {product.options.length > 0 && (
            <div className="mt-8 space-y-6">
              {product.options.map((opt) => (
                <div key={opt.id}>
                  <div className="mb-3 flex items-baseline justify-between">
                    <span className="text-[11px] font-medium uppercase tracking-[0.22em] text-neutral-900">
                      {opt.name}
                    </span>
                    <span className="text-[12px] text-neutral-500">
                      {selected[opt.name]}
                    </span>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {opt.values.map((v) => {
                      const active = selected[opt.name] === v.value;
                      return (
                        <button
                          key={v.id}
                          onClick={() =>
                            setSelected((s) => ({ ...s, [opt.name]: v.value }))
                          }
                          className={cn(
                            "min-w-[44px] border px-4 py-2.5 text-[12px] font-medium uppercase tracking-[0.12em] transition-colors",
                            active
                              ? "border-black bg-black text-white"
                              : "border-black/15 text-neutral-800 hover:border-black",
                          )}
                        >
                          {v.value}
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Qty + Actions */}
          <div className="mt-10 space-y-3">
            <div className="flex items-stretch gap-3">
              <div className="inline-flex items-center border border-black/15">
                <button
                  onClick={() => setQty((q) => Math.max(1, q - 1))}
                  className="grid h-12 w-12 place-items-center text-neutral-700 hover:text-black"
                  aria-label="Diminuir"
                >
                  <Minus className="h-3.5 w-3.5" strokeWidth={1.5} />
                </button>
                <span className="w-10 text-center text-[13px]">{qty}</span>
                <button
                  onClick={() => setQty((q) => q + 1)}
                  className="grid h-12 w-12 place-items-center text-neutral-700 hover:text-black"
                  aria-label="Aumentar"
                >
                  <Plus className="h-3.5 w-3.5" strokeWidth={1.5} />
                </button>
              </div>
              <button
                onClick={handleAdd}
                disabled={currentVariant?.available === false}
                className="flex-1 border border-black bg-black text-[11px] font-medium uppercase tracking-[0.24em] text-white transition-colors hover:bg-white hover:text-black disabled:cursor-not-allowed disabled:opacity-40"
              >
                {currentVariant?.available === false ? "Indisponível" : "Adicionar à sacola"}
              </button>
            </div>
            <a
              href={buildWhatsAppLink(waText)}
              target="_blank"
              rel="noreferrer"
              className="inline-flex w-full items-center justify-center gap-2 border border-black/15 py-3.5 text-[11px] font-medium uppercase tracking-[0.24em] text-neutral-900 transition-colors hover:border-black"
            >
              <WhatsAppIcon className="h-3.5 w-3.5" />
              Comprar pelo WhatsApp
            </a>
          </div>

          <div className="mt-10 grid grid-cols-3 gap-4 border-t border-black/[0.06] pt-6 text-center">
            <Perk icon={<Truck className="h-4 w-4" strokeWidth={1.3} />} label="Envio para todo Brasil" />
            <Perk icon={<RotateCcw className="h-4 w-4" strokeWidth={1.3} />} label="Troca em 30 dias" />
            <Perk icon={<ShieldCheck className="h-4 w-4" strokeWidth={1.3} />} label="Compra segura" />
          </div>
        </section>
      </div>

      {/* Relacionados */}
      {related.length > 0 && (
        <section className="border-t border-black/[0.06]">
          <div className="mx-auto max-w-[1400px] px-6 py-20 md:px-10 md:py-24">
            <div className="text-[11px] font-medium uppercase tracking-[0.28em] text-neutral-500">
              Você também pode gostar
            </div>
            <h2 className="mt-3 font-serif text-[32px] font-light leading-none tracking-tight md:text-[40px]">
              Continue explorando
            </h2>
            <div className="mt-12 grid grid-cols-2 gap-x-4 gap-y-12 md:grid-cols-4 md:gap-x-6">
              {related.map((p) => (
                <ProductCard key={p.id} product={p} />
              ))}
            </div>
          </div>
        </section>
      )}
    </div>
  );
}

function Perk({ icon, label }: { icon: React.ReactNode; label: string }) {
  return (
    <div className="flex flex-col items-center gap-2">
      <div className="text-neutral-700">{icon}</div>
      <span className="text-[10px] uppercase tracking-[0.16em] text-neutral-600">
        {label}
      </span>
    </div>
  );
}
