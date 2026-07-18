import { Link } from "@tanstack/react-router";
import { ImageIcon } from "lucide-react";
import { addToCart, buildWhatsAppLink, openCart } from "@/lib/cart";
import { WhatsAppIcon } from "./store-header";
import { formatBRL } from "@/lib/products";
import { isNew, isOnSale, type PublicProduct } from "@/lib/public-shop";
import { cn } from "@/lib/utils";

interface Props {
  product: PublicProduct;
  size?: "sm" | "lg";
}

export function ProductCard({ product, size = "sm" }: Props) {
  const sale = isOnSale(product);
  const showNew = isNew(product.created_at);
  const displayPrice = sale ? product.promo_price! : product.price;

  const handleAdd = () => {
    addToCart({
      key: `${product.id}::default`,
      productId: product.id,
      variantId: null,
      name: product.name,
      variantLabel: null,
      image: product.primary_image,
      price: displayPrice,
    });
    openCart();
  };

  const waText = `Olá! Tenho interesse no produto: ${product.name} — ${formatBRL(displayPrice)}`;

  return (
    <div className="group flex flex-col">
      <Link
        to="/loja/$slug/produto/$id"
        params={{ slug, id: product.id }}
        className="relative block overflow-hidden bg-neutral-100"
      >
        <div className={cn("relative aspect-[3/4] w-full")}>
          {product.primary_image ? (
            <img
              src={product.primary_image}
              alt={product.name}
              className="h-full w-full object-cover transition-transform duration-[900ms] ease-out group-hover:scale-[1.04]"
              loading="lazy"
            />
          ) : (
            <div className="grid h-full w-full place-items-center text-neutral-400">
              <ImageIcon className="h-8 w-8" strokeWidth={1} />
            </div>
          )}
          {product.images[1] && (
            <img
              src={product.images[1].url}
              alt=""
              aria-hidden
              className="absolute inset-0 h-full w-full object-cover opacity-0 transition-opacity duration-500 group-hover:opacity-100"
              loading="lazy"
            />
          )}

          {/* Badges */}
          <div className="absolute left-3 top-3 flex flex-col gap-1.5">
            {showNew && <Badge>Novo</Badge>}
            {sale && <Badge variant="dark">Promoção</Badge>}
          </div>
        </div>
      </Link>

      <div className="mt-4 flex flex-col gap-1">
        <Link
          to="/loja/$slug/produto/$id"
          params={{ slug, id: product.id }}
          className="text-[13px] font-medium text-neutral-900 transition-colors hover:text-black"
        >
          {product.name}
        </Link>
        <div className="flex items-baseline gap-2 text-[13px]">
          <span className="text-neutral-900">{formatBRL(displayPrice)}</span>
          {sale && (
            <span className="text-[12px] text-neutral-400 line-through">
              {formatBRL(product.price)}
            </span>
          )}
        </div>

        {size === "sm" && (
          <div className="mt-3 grid grid-cols-[1fr_auto] gap-1.5 opacity-0 transition-opacity duration-300 group-hover:opacity-100 sm:opacity-100 md:opacity-0 md:group-hover:opacity-100">
            <button
              onClick={handleAdd}
              className="rounded-none border border-black bg-black px-3 py-2 text-[11px] font-medium uppercase tracking-[0.18em] text-white transition-colors hover:bg-white hover:text-black"
            >
              Comprar
            </button>
            <a
              href={buildWhatsAppLink(waText)}
              target="_blank"
              rel="noreferrer"
              aria-label="Comprar pelo WhatsApp"
              className="grid h-full w-9 place-items-center border border-black/10 text-neutral-700 transition-colors hover:border-black hover:text-black"
            >
              <WhatsAppIcon className="h-3.5 w-3.5" />
            </a>
          </div>
        )}
      </div>
    </div>
  );
}

export function FeaturedProductCard({ product }: { product: PublicProduct }) {
  const sale = isOnSale(product);
  return (
    <Link
      to="/loja/produto/$id"
      params={{ id: product.id }}
      className="group block"
    >
      <div className="relative aspect-[4/5] w-full overflow-hidden bg-neutral-100">
        {product.primary_image ? (
          <img
            src={product.primary_image}
            alt={product.name}
            className="h-full w-full object-cover transition-transform duration-[1100ms] ease-out group-hover:scale-[1.05]"
            loading="lazy"
          />
        ) : (
          <div className="grid h-full w-full place-items-center text-neutral-400">
            <ImageIcon className="h-10 w-10" strokeWidth={1} />
          </div>
        )}
      </div>
      <div className="mt-5 flex items-baseline justify-between gap-4">
        <div>
          <div className="font-serif text-[20px] font-light leading-tight text-neutral-900">
            {product.name}
          </div>
          <div className="mt-1 flex items-baseline gap-2 text-[13px]">
            <span className="text-neutral-900">
              {formatBRL(sale ? product.promo_price! : product.price)}
            </span>
            {sale && (
              <span className="text-[12px] text-neutral-400 line-through">
                {formatBRL(product.price)}
              </span>
            )}
          </div>
        </div>
        <span className="text-[11px] uppercase tracking-[0.2em] text-neutral-500 transition-colors group-hover:text-black">
          Ver produto →
        </span>
      </div>
    </Link>
  );
}

function Badge({
  children,
  variant = "light",
}: {
  children: React.ReactNode;
  variant?: "light" | "dark";
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center px-2 py-1 text-[10px] font-medium uppercase tracking-[0.18em]",
        variant === "dark" ? "bg-black text-white" : "bg-white text-neutral-900",
      )}
    >
      {children}
    </span>
  );
}
