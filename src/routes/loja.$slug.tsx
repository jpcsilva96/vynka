import { createFileRoute, Outlet, Link, notFound } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { StoreHeader } from "@/components/loja/store-header";
import { StoreFooter } from "@/components/loja/store-footer";
import { CartDrawer } from "@/components/loja/cart-drawer";
import { useCartHydration } from "@/lib/cart";
import { getStoreBySlug } from "@/lib/public-shop";
import { StorefrontProvider } from "@/lib/storefront-context";

export const Route = createFileRoute("/loja/$slug")({
  component: LojaLayout,
  notFoundComponent: () => (
    <div className="grid min-h-svh place-items-center bg-white px-6 text-center font-sans">
      <div>
        <h1 className="font-serif text-4xl font-light text-neutral-900">Loja não encontrada</h1>
        <p className="mt-2 text-[13px] text-neutral-600">
          Verifique o endereço ou volte ao início.
        </p>
        <Link to="/" className="mt-6 inline-block text-[12px] uppercase tracking-[0.2em] underline">
          Ir ao início
        </Link>
      </div>
    </div>
  ),
});

function LojaLayout() {
  const { slug } = Route.useParams();
  useCartHydration();

  const { data: store, isLoading, isError } = useQuery({
    queryKey: ["storefront-store", slug],
    queryFn: () => getStoreBySlug(slug),
  });

  if (isLoading) {
    return (
      <div className="grid min-h-svh place-items-center bg-white">
        <Loader2 className="h-5 w-5 animate-spin text-neutral-400" strokeWidth={1.5} />
      </div>
    );
  }
  if (isError || !store) {
    throw notFound();
  }

  return (
    <StorefrontProvider store={store}>
      <div className="min-h-svh bg-white font-sans text-neutral-900 antialiased">
        <StoreHeader />
        <main className="pt-16 md:pt-20">
          <Outlet />
        </main>
        <StoreFooter />
        <CartDrawer />
      </div>
    </StorefrontProvider>
  );
}
