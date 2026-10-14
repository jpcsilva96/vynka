import { createFileRoute, Link, notFound, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft, Check, Heart, Minus, Plus } from "lucide-react";
import { ProductCard } from "@/components/loja/product-card";
import { addToCart, useCart } from "@/lib/cart";
import { flyToCart } from "@/lib/cart-fly";
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

  // Foto da cor (escolhida no painel entre as fotos do produto): ao escolher a cor, a galeria pula
  // para ela, mesmo sem tamanho escolhido.
  const colorOption = product.options.find((option) => normalize(option.name) === "cor");
  const selectedColor = colorOption ? selected[colorOption.name] : undefined;
  const colorImageUrl = colorOption && selectedColor
    ? product.variants.find((variant) => variant.options[colorOption.name] === selectedColor && variant.image_url)?.image_url ?? null
    : null;
  useEffect(() => {
    if (!colorImageUrl) return;
    const index = images.findIndex((item) => item.url === colorImageUrl);
    if (index >= 0) setActiveImage(index);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [colorImageUrl]);

  // E o contrário (João, 14/10): passar pelas fotos e parar na foto de uma cor seleciona a cor.
  // Foto sem cor ou de cor esgotada não muda a escolha; tamanho que não existe na cor sai.
  const showImage = (index: number) => {
    setActiveImage(index);
    if (!colorOption) return;
    const url = images[index]?.url;
    const color = url
      ? product.variants.find((variant) => variant.image_url === url && variant.options[colorOption.name])?.options[colorOption.name]
      : undefined;
    if (!color || color === selectedColor || !isValueAvailable(product, colorOption.name, color, {})) return;
    setSelected((current) => clearUnavailableSize(product, colorOption.name, { ...current, [colorOption.name]: color }));
  };
  // Foto de variação fora da galeria (cadastro antigo) ainda aparece.
  const offGalleryImage =
    currentVariant?.image_url && !images.some((item) => item.url === currentVariant.image_url) ? currentVariant.image_url : null;
  const image = offGalleryImage || images[activeImage]?.url || product.primary_image || "";
  const variantLabel = product.options.length ? Object.entries(selected).map(([key, value]) => `${key}: ${value}`).join(" / ") : null;
  const favorite = favoriteIds.includes(product.id);

  // Quantidade limitada ao estoque, descontando o que já está no carrinho (mesmo produto e opções).
  const cartKey = `${product.id}::${skuKey(selected) || "default"}`;
  const inCart = useCart().find((item) => item.key === cartKey)?.quantity ?? 0;
  const stockLimit = !product.manage_stock
    ? Infinity
    : product.options.length === 0
      ? product.stock_quantity
      : (currentVariant?.stock_quantity ?? 0);
  const maxQty = Math.max(0, stockLimit - inCart);
  const allInCart = canBuy && maxQty === 0;
  const quantity = Math.max(1, Math.min(qty, maxQty || 1));

  const imageRef = useRef<HTMLDivElement>(null);
  const [added, setAdded] = useState(false);
  useEffect(() => {
    if (!added) return;
    const timer = window.setTimeout(() => setAdded(false), 2000);
    return () => window.clearTimeout(timer);
  }, [added]);

  const { data: related = [] } = useQuery({
    queryKey: ["related-products", store.id, product.id, product.category?.id],
    queryFn: () => listRelatedProducts(store.id, product.category?.id ?? null, product.id, 4),
  });

  const putInCart = () => {
    addToCart({
      key: cartKey,
      productId: product.id,
      variantId: currentVariant?.id ?? null,
      name: product.name,
      variantLabel,
      image: image || null,
      price,
      quantity,
    });
    setQty(1);
  };

  // Adicionar: a tela não muda; o produto "voa" até o carrinho do cabeçalho.
  const handleAdd = () => {
    if (!canBuy || maxQty === 0) return;
    putInCart();
    flyToCart(imageRef.current, image || null);
    setAdded(true);
  };

  // Comprar agora: soma ao que já está no carrinho e abre o checkout (João, 13/10). Com todo o
  // estoque já no carrinho, só abre o checkout.
  const handleBuyNow = () => {
    if (!canBuy) return;
    if (maxQty > 0) putInCart();
    navigate({ to: "/loja/$slug/checkout", params: { slug } });
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
                onClick={() => showImage(index)}
                className={cn("h-20 w-16 shrink-0 overflow-hidden border bg-neutral-100", activeImage === index ? "border-black" : "border-transparent")}
              >
                {item.url && <img src={item.url} alt="" className="h-full w-full object-cover" />}
              </button>
            ))}
          </div>
          <div className="order-1 bg-neutral-100 md:order-2">
            <div ref={imageRef} className="aspect-[4/5]">
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
          {product.options.length > 0 && (
            <div className="mt-8 space-y-5">
              {product.options.map((option) => (
                <div key={option.id}>
                  {/* Valor escolhido junto do nome ("Tamanho: P"): sozinho à direita parecia um botão repetido. */}
                  <div className="mb-2 text-[11px] font-medium uppercase tracking-[0.18em] text-neutral-500">
                    {option.name}
                    {selected[option.name] && <span className="text-black">: {selected[option.name]}</span>}
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
                <button type="button" onClick={() => setQty(Math.max(1, quantity - 1))} disabled={!canBuy || quantity <= 1} className="grid h-12 w-12 place-items-center hover:bg-neutral-100 disabled:cursor-not-allowed disabled:opacity-30" aria-label="Diminuir">
                  <Minus className="h-4 w-4" />
                </button>
                <span className="grid h-12 w-10 place-items-center text-[13px]" aria-live="polite">{quantity}</span>
                <button type="button" onClick={() => setQty(quantity + 1)} disabled={!canBuy || quantity >= maxQty} className="grid h-12 w-12 place-items-center hover:bg-neutral-100 disabled:cursor-not-allowed disabled:opacity-30" aria-label="Aumentar">
                  <Plus className="h-4 w-4" />
                </button>
              </div>
              <button type="button" onClick={handleAdd} disabled={!canBuy || allInCart} className="inline-flex flex-1 items-center justify-center gap-2 border border-black bg-white px-5 py-3 text-[12px] font-semibold uppercase tracking-[0.16em] text-black hover:bg-neutral-100 disabled:cursor-not-allowed disabled:opacity-40">
                {!canBuy ? "Indisponível" : added ? <><Check className="h-4 w-4" /> Adicionado</> : "Adicionar ao carrinho"}
              </button>
            </div>
            {canBuy && (
              <button type="button" onClick={handleBuyNow} className="w-full bg-black px-5 py-3.5 text-[12px] font-semibold uppercase tracking-[0.16em] text-white hover:bg-neutral-800">
                Comprar agora
              </button>
            )}
            <p className="min-h-[18px] text-[12px] text-neutral-500" aria-live="polite">
              {allInCart
                ? "Todo o estoque disponível deste item já está no seu carrinho."
                : canBuy && Number.isFinite(maxQty) && quantity >= maxQty
                  ? `Quantidade máxima disponível: ${maxQty}.`
                  : ""}
            </p>
          </div>

          {product.description && (
            <div className="mt-6 border-t border-black/10 pt-6">
              <div className="text-[11px] font-medium uppercase tracking-[0.18em] text-neutral-500">Descrição</div>
              <div
                className="mt-3 text-[14px] leading-relaxed text-neutral-700 [&_a]:underline [&_h1]:mt-4 [&_h1]:font-semibold [&_h1]:text-black [&_h2]:mt-4 [&_h2]:font-semibold [&_h2]:text-black [&_h3]:mt-4 [&_h3]:font-semibold [&_h3]:text-black [&_li]:mt-1 [&_ol]:mt-3 [&_ol]:list-decimal [&_ol]:pl-5 [&_p+p]:mt-3 [&_strong]:text-black [&_table]:mt-3 [&_table]:w-full [&_td]:border [&_td]:border-black/10 [&_td]:px-2 [&_td]:py-1 [&_th]:border [&_th]:border-black/10 [&_th]:px-2 [&_th]:py-1 [&_th]:text-left [&_ul]:mt-3 [&_ul]:list-disc [&_ul]:pl-5"
                dangerouslySetInnerHTML={{ __html: product.description }}
              />
            </div>
          )}
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
