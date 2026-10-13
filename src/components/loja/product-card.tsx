import { Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Heart, ImageIcon } from "lucide-react";
import type { MouseEvent } from "react";
import { listFavoriteProductIds, toggleFavorite, useStoreCustomer } from "@/lib/customer-account";
import { formatBRL } from "@/lib/products";
import { isOnSale, type PublicProduct } from "@/lib/public-shop";
import { useStorefront } from "@/lib/storefront-context";
import { cn } from "@/lib/utils";

export function ProductCard({ product }: { product: PublicProduct }) {
  const store = useStorefront();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { data: customer } = useStoreCustomer(store.id);
  const { data: favoriteIds = [] } = useQuery({
    queryKey: ["customer-favorites", store.id],
    queryFn: () => listFavoriteProductIds(store.id),
    enabled: !!customer,
  });
  const sale = isOnSale(product);
  const price = sale ? product.promo_price! : product.price;
  const favorite = favoriteIds.includes(product.id);
  const soldOut = product.sold_out;

  const handleFavorite = async (event: MouseEvent) => {
    event.preventDefault();
    event.stopPropagation();
    if (!customer) {
      navigate({ to: "/loja/$slug/entrar", params: { slug: store.slug } });
      return;
    }
    await toggleFavorite(store.id, product.id);
    await queryClient.invalidateQueries({ queryKey: ["customer-favorites", store.id] });
    await queryClient.invalidateQueries({ queryKey: ["customer-favorite-products", store.id] });
  };

  return (
    <article className="group">
      <Link
        to="/loja/$slug/produto/$id"
        params={{ slug: store.slug, id: product.id }}
        className="relative block overflow-hidden bg-neutral-100"
      >
        {/* Foto sempre em 4:5 para a grade ficar alinhada (escopo do catálogo, §6). */}
        <div className={cn("aspect-[4/5]", soldOut && "opacity-55")}>
          {product.primary_image ? (
            <img
              src={product.primary_image}
              alt={product.name}
              className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.03]"
              loading="lazy"
            />
          ) : (
            <div className="grid h-full w-full place-items-center text-neutral-400">
              <ImageIcon className="h-8 w-8" strokeWidth={1.2} />
            </div>
          )}
        </div>
        {/* Esgotado vale mais que Promoção: não mostra os dois. */}
        {soldOut ? (
          <span className="absolute left-2 top-2 bg-white px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-neutral-700">
            Esgotado
          </span>
        ) : (
          sale && (
            <span className="absolute left-2 top-2 bg-black px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-white">
              Promoção
            </span>
          )
        )}
        {/* Favoritar discreto: ícone pequeno, área de toque de 44 px. */}
        <button
          type="button"
          onClick={handleFavorite}
          className="absolute right-0 top-0 grid h-11 w-11 place-items-center text-black"
          aria-label={favorite ? "Remover dos favoritos" : "Adicionar aos favoritos"}
          aria-pressed={favorite}
        >
          <span className="grid h-7 w-7 place-items-center rounded-full bg-white/75 transition-colors hover:bg-white">
            <Heart className={cn("h-3.5 w-3.5", favorite && "fill-current")} strokeWidth={1.8} />
          </span>
        </button>
      </Link>
      <div className="mt-3">
        <Link
          to="/loja/$slug/produto/$id"
          params={{ slug: store.slug, id: product.id }}
          className="line-clamp-2 text-[14px] font-medium leading-tight text-black hover:underline"
        >
          {product.name}
        </Link>
        <div className="mt-1 flex flex-wrap items-baseline gap-x-2">
          <span
            className={cn("text-[14px] font-semibold text-black", soldOut && "text-neutral-500")}
          >
            {formatBRL(price)}
          </span>
          {sale && (
            <span className="text-[12px] text-neutral-400 line-through">
              {formatBRL(product.price)}
            </span>
          )}
        </div>
      </div>
    </article>
  );
}

export function FeaturedProductCard({ product }: { product: PublicProduct }) {
  return <ProductCard product={product} />;
}
