import { Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Heart, ImageIcon } from "lucide-react";
import type { MouseEvent } from "react";
import { listFavoriteProductIds, toggleFavorite, useStoreCustomer } from "@/lib/customer-account";
import { formatBRL } from "@/lib/products";
import { isOnSale, type PublicProduct } from "@/lib/public-shop";
import { useStorefront } from "@/lib/storefront-context";

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
        <div className="aspect-[4/5]">
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
        {sale && (
          <span className="absolute left-3 top-3 bg-black px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-white">
            Oferta
          </span>
        )}
        <button
          type="button"
          onClick={handleFavorite}
          className="absolute right-3 top-3 grid h-9 w-9 place-items-center rounded-full bg-white/90 text-black shadow-sm transition-colors hover:bg-black hover:text-white"
          aria-label={favorite ? "Remover dos favoritos" : "Adicionar aos favoritos"}
        >
          <Heart className={favorite ? "h-4 w-4 fill-current" : "h-4 w-4"} strokeWidth={1.8} />
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
        {store.catalog_visual.show_price && (
          <div className="mt-1 flex items-baseline gap-2">
            <span className="text-[14px] font-semibold text-black">{formatBRL(price)}</span>
            {sale && <span className="text-[12px] text-neutral-400 line-through">{formatBRL(product.price)}</span>}
          </div>
        )}
      </div>
    </article>
  );
}

export function FeaturedProductCard({ product }: { product: PublicProduct }) {
  return <ProductCard product={product} />;
}
