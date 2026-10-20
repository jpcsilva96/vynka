import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { AccountTitle } from "@/components/loja/account-ui";
import { ProductCard } from "@/components/loja/product-card";
import { listFavoriteProducts, useStoreCustomer } from "@/lib/customer-account";
import { useStorefront } from "@/lib/storefront-context";

export const Route = createFileRoute("/loja/$slug/minha-conta/favoritos")({
  component: CustomerFavoritesPage,
});

function CustomerFavoritesPage() {
  const store = useStorefront();
  const { data: customer } = useStoreCustomer(store.id);
  const { data: favorites = [], isLoading } = useQuery({
    queryKey: ["customer-favorite-products", store.id],
    queryFn: () => listFavoriteProducts(store.id),
    enabled: !!customer,
  });

  return (
    <div className="grid gap-6">
      <div className="flex items-end justify-between gap-4">
        <AccountTitle title="Favoritos" description="Produtos salvos para ver depois." />
        <Link
          to="/loja/$slug"
          params={{ slug: store.slug }}
          hash="produtos"
          className="inline-flex min-h-11 shrink-0 items-center text-[12px] font-medium uppercase tracking-[0.16em] text-neutral-500 hover:text-black"
        >
          Ver catálogo
        </Link>
      </div>
      {isLoading ? (
        <p className="text-[13px] text-neutral-500">Carregando...</p>
      ) : favorites.length === 0 ? (
        <div className="border border-dashed border-black/15 px-5 py-10 text-center text-[13px] text-neutral-500">
          Nenhum favorito salvo. Toque no coração de um produto para guardar aqui.
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-x-4 gap-y-10 md:grid-cols-3">
          {favorites.map((product) => (
            <ProductCard key={product.id} product={product} />
          ))}
        </div>
      )}
    </div>
  );
}
