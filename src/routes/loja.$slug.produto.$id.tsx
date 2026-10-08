import { createFileRoute, Link, notFound, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, Heart, Minus, Plus } from "lucide-react";
import { ProductCard } from "@/components/loja/product-card";
import { addToCart, openCart } from "@/lib/cart";
import { trackStoreView } from "@/lib/views";
import { listFavoriteProductIds, toggleFavorite, useStoreCustomer } from "@/lib/customer-account";
import { formatBRL, skuKey } from "@/lib/products";
import { getPublicProduct, isOnSale, listRelatedProducts, type PublicProductDetail } from "@/lib/public-shop";
import { useStorefront } from "@/lib/storefront-context";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/loja/$slug/produto/$id")({
  component: ProductPage,
  notFoundComponent: () => (
    <div className="mx-auto max-w-md px-6 py-24 text-center">
      <h1 className="text-2xl font-semibold text-black">Produto não encontrado</h1>
      <p className="mt-2 text-[13px] text-neutral-500">O produto pode estar indisponível.</p>
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
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const slug = store.slug;
  const { data: customer } = useStoreCustomer(store.id);
  const { data: favoriteIds = [] } = useQuery({
    queryKey: ["customer-favorites", store.id],
    queryFn: () => listFavoriteProductIds(store.id),
    enabled: !!customer,
  });
  useEffect(() => {
    trackStoreView(store.id, product.id);
  }, [store.id, product.id]);
  const [selected, setSelected] = useState<Record<string, string>>(() => initialSelection(product));
  const [qty, setQty] = useState(1);
  const [activeImage, setActiveImage] = useState(0);

  const currentVariant = useMemo(() => {
    if (product.options.length === 0) return null;
    if (!product.options.every((option) => selected[option.name])) return null;
    return product.variants.find((variant) => variant.sku_key === skuKey(selected)) ?? null;
  }, [product, selected]);

  const sale = isOnSale(product);
  const price = currentVariant?.price ?? (sale ? product.promo_price! : product.price);
  // Estoque só conta quando o produto controla estoque (sem controle: sempre disponível).
  const canBuy =
    product.options.length === 0
      ? !product.manage_stock || product.stock_quantity > 0
      : !!currentVariant && currentVariant.available && (!product.manage_stock || currentVariant.stock_quantity > 0);
  const images = product.images.length ? product.images : [{ url: "", position: 0 }];
  const image = currentVariant?.image_url || images[activeImage]?.url || product.primary_image || "";
  const variantLabel = product.options.length ? Object.entries(selected).map(([key, value]) => `${key}: ${value}`).join(" / ") : null;
  const favorite = favoriteIds.includes(product.id);

  const { data: related = [] } = useQuery({
    queryKey: ["related-products", store.id, product.id, product.category?.id],
    queryFn: () => listRelatedProducts(store.id, product.category?.id ?? null, product.id, 4),
  });

  const handleAdd = () => {
    if (!canBuy) return;
    addToCart({
      key: `${product.id}::${skuKey(selected) || "default"}`,
      productId: product.id,
      variantId: currentVariant?.id ?? null,
      name: product.name,
      variantLabel,
      image: image || null,
      price,
      quantity: qty,
    });
    openCart();
  };

  const handleFavorite = async () => {
    if (!customer) {
      navigate({ to: "/loja/$slug/entrar", params: { slug } });
      return;
    }
    await toggleFavorite(store.id, product.id);
    await queryClient.invalidateQueries({ queryKey: ["customer-favorites", store.id] });
    await queryClient.invalidateQueries({ queryKey: ["customer-favorite-products", store.id] });
  };

  return (
    <div>
      <div className="mx-auto max-w-[1280px] px-4 py-8 md:px-8">
        <Link to="/loja/$slug" params={{ slug }} className="inline-flex items-center gap-2 text-[12px] font-medium uppercase tracking-[0.16em] text-neutral-500 hover:text-black">
          <ArrowLeft className="h-4 w-4" /> Voltar
        </Link>
      </div>

      <section className="mx-auto grid max-w-[1280px] gap-10 px-4 pb-16 md:grid-cols-[1.1fr_0.9fr] md:px-8">
        <div className="grid gap-3 md:grid-cols-[84px_1fr]">
          <div className="order-2 flex gap-2 overflow-x-auto md:order-1 md:flex-col">
            {images.map((item, index) => (
              <button
                key={`${item.url}-${index}`}
                type="button"
                onClick={() => setActiveImage(index)}
                className={cn("h-20 w-16 shrink-0 overflow-hidden border bg-neutral-100", activeImage === index ? "border-black" : "border-transparent")}
              >
                {item.url && <img src={item.url} alt="" className="h-full w-full object-cover" />}
              </button>
            ))}
          </div>
          <div className="order-1 bg-neutral-100 md:order-2">
            <div className="aspect-[4/5]">
              {image ? <img src={image} alt={product.name} className="h-full w-full object-cover" /> : <div className="h-full w-full" />}
            </div>
          </div>
        </div>

        <aside className="md:sticky md:top-24 md:self-start">
          {product.category?.name && <div className="text-[11px] uppercase tracking-[0.24em] text-neutral-500">{product.category.name}</div>}
          <h1 className="mt-3 text-3xl font-semibold leading-tight tracking-tight text-black md:text-5xl">{product.name}</h1>
          <button
            type="button"
            onClick={handleFavorite}
            className="mt-5 inline-flex items-center gap-2 border border-black/10 px-4 py-2 text-[12px] font-medium uppercase tracking-[0.14em] text-neutral-700 hover:border-black hover:text-black"
          >
            <Heart className={favorite ? "h-4 w-4 fill-current" : "h-4 w-4"} />
            {favorite ? "Favorito" : "Favoritar"}
          </button>
          <div className="mt-5 flex items-baseline gap-3">
            <span className="text-xl font-semibold text-black">{formatBRL(price)}</span>
            {sale && !currentVariant?.price && <span className="text-[14px] text-neutral-400 line-through">{formatBRL(product.price)}</span>}
          </div>
          {product.description && (
            <div className="mt-6 text-[14px] leading-relaxed text-neutral-600" dangerouslySetInnerHTML={{ __html: product.description }} />
          )}

          {product.options.length > 0 && (
            <div className="mt-8 space-y-5">
              {product.options.map((option) => (
                <div key={option.id}>
                  <div className="mb-2 flex justify-between text-[11px] font-medium uppercase tracking-[0.18em] text-neutral-500">
                    <span>{option.name}</span>
                    <span>{selected[option.name]}</span>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {option.values.map((value) => {
                      const active = selected[option.name] === value.value;
                      const disabled = !isValueAvailable(product, option.name, value.value, selected);
                      return (
                        <button
                          key={value.id}
                          type="button"
                          disabled={disabled}
                          onClick={() => setSelected((current) => clearUnavailableSize(product, option.name, { ...current, [option.name]: value.value }))}
                          className={cn(
                            "min-w-11 border px-3 py-2 text-[12px] font-medium uppercase tracking-[0.12em]",
                            active && !disabled ? "border-black bg-black text-white" : "border-black/15 text-black hover:border-black",
                            disabled && "cursor-not-allowed border-neutral-200 bg-neutral-100 text-neutral-400 line-through hover:border-neutral-200",
                          )}
                        >
                          {value.value}
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}

          <div className="mt-8 space-y-3">
            <div className="flex gap-3">
              <div className="inline-flex border border-black/15">
                <button type="button" onClick={() => setQty((value) => Math.max(1, value - 1))} className="grid h-12 w-12 place-items-center hover:bg-neutral-100" aria-label="Diminuir">
                  <Minus className="h-4 w-4" />
                </button>
                <span className="grid h-12 w-10 place-items-center text-[13px]">{qty}</span>
                <button type="button" onClick={() => setQty((value) => value + 1)} className="grid h-12 w-12 place-items-center hover:bg-neutral-100" aria-label="Aumentar">
                  <Plus className="h-4 w-4" />
                </button>
              </div>
              <button type="button" onClick={handleAdd} disabled={!canBuy} className="flex-1 bg-black px-5 py-3 text-[12px] font-semibold uppercase tracking-[0.16em] text-white hover:bg-neutral-800 disabled:cursor-not-allowed disabled:opacity-40">
                {canBuy ? "Adicionar ao carrinho" : "Indisponível"}
              </button>
            </div>
          </div>
        </aside>
      </section>

      {related.length > 0 && (
        <section className="border-t border-black/10">
          <div className="mx-auto max-w-[1280px] px-4 py-12 md:px-8">
            <h2 className="text-2xl font-semibold text-black">Produtos relacionados</h2>
            <div className="mt-8 grid grid-cols-2 gap-x-4 gap-y-10 md:grid-cols-4">
              {related.map((item) => <ProductCard key={item.id} product={item} />)}
            </div>
          </div>
        </section>
      )}
    </div>
  );
}

function normalize(value: string) {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim().toLowerCase();
}

function initialSelection(product: PublicProductDetail) {
  const selected: Record<string, string> = {};
  const color = product.options.find((option) => normalize(option.name) === "cor");
  if (color?.values[0]) selected[color.name] = color.values[0].value;
  if (!color) {
    for (const option of product.options) if (option.values[0]) selected[option.name] = option.values[0].value;
  }
  return selected;
}

function isValueAvailable(product: PublicProductDetail, optionName: string, value: string, selected: Record<string, string>) {
  if (normalize(optionName) === "tamanho") {
    const color = product.options.find((option) => normalize(option.name) === "cor");
    if (color && !selected[color.name]) return false;
  }
  return product.variants.some((variant) => {
    if (variant.options[optionName] !== value || !variant.available || (product.manage_stock && variant.stock_quantity <= 0)) return false;
    return Object.entries(selected).every(([key, selectedValue]) => key === optionName || !selectedValue || variant.options[key] === selectedValue);
  });
}

function clearUnavailableSize(product: PublicProductDetail, optionName: string, selected: Record<string, string>) {
  if (normalize(optionName) !== "cor") return selected;
  const size = product.options.find((option) => normalize(option.name) === "tamanho");
  if (!size || !selected[size.name]) return selected;
  if (isValueAvailable(product, size.name, selected[size.name], selected)) return selected;
  const next = { ...selected };
  delete next[size.name];
  return next;
}
