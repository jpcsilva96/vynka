import { createFileRoute, Link, notFound, Outlet } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { useEffect } from "react";
import { trackStoreView } from "@/lib/views";
import { CartDrawer } from "@/components/loja/cart-drawer";
import { StoreFooter } from "@/components/loja/store-footer";
import { StoreHeader } from "@/components/loja/store-header";
import { useCartHydration } from "@/lib/cart";
import { getStoreBySlug } from "@/lib/public-shop";
import { StorefrontProvider } from "@/lib/storefront-context";
import { storeFontFamily } from "@/lib/store-settings";
import type { CSSProperties } from "react";

export const Route = createFileRoute("/loja/$slug")({
  component: LojaLayout,
  notFoundComponent: () => (
    <StoreMessage title="Loja nao encontrada" message="Verifique o endereco ou volte ao inicio." />
  ),
});

function StoreMessage({ title, message }: { title: string; message: string }) {
  return (
    <div className="grid min-h-svh place-items-center bg-white px-6 text-center font-sans">
      <div>
        <h1 className="text-3xl font-semibold text-neutral-900">{title}</h1>
        <p className="mt-2 text-[13px] text-neutral-600">{message}</p>
        <Link to="/" className="mt-6 inline-block text-[12px] uppercase tracking-[0.2em] underline">
          Ir ao inicio
        </Link>
      </div>
    </div>
  );
}

function LojaLayout() {
  const { slug } = Route.useParams();
  useCartHydration();

  const { data: store, isLoading, isError } = useQuery({
    queryKey: ["storefront-store", slug],
    queryFn: () => getStoreBySlug(slug),
  });

  useEffect(() => {
    if (!store?.favicon_url) return;
    const existing = document.querySelector<HTMLLinkElement>('link[rel~="icon"]');
    const icon = existing ?? document.createElement("link");
    const previousHref = existing?.href;
    icon.rel = "icon";
    icon.href = store.favicon_url;
    if (!existing) document.head.appendChild(icon);

    return () => {
      if (existing && previousHref) existing.href = previousHref;
      else icon.remove();
    };
  }, [store?.favicon_url]);

  const storeOpen =
    !!store &&
    store.status !== "suspended" &&
    store.status !== "cancelled" &&
    store.publication_status === "published";
  useEffect(() => {
    if (storeOpen && store) trackStoreView(store.id);
  }, [storeOpen, store?.id]);

  if (isLoading) {
    return (
      <div className="grid min-h-svh place-items-center bg-white">
        <Loader2 className="h-5 w-5 animate-spin text-neutral-400" strokeWidth={1.5} />
      </div>
    );
  }
  if (isError || !store) throw notFound();

  if (store.status === "suspended" || store.status === "cancelled") {
    return <StoreMessage title="Loja indisponivel" message="Esta loja nao esta aceitando pedidos no momento." />;
  }
  if (store.publication_status !== "published") {
    return <StoreMessage title="Loja indisponivel" message="Este catalogo ainda nao esta publicado." />;
  }

  return (
    <StorefrontProvider store={store}>
      <div
        className="storefront-theme storefront-typography min-h-svh antialiased"
        style={{
          "--shop-primary": store.catalog_visual.primary_color,
          "--shop-secondary": store.catalog_visual.secondary_color,
          "--shop-background": store.catalog_visual.background_color,
          "--shop-button": store.catalog_visual.button_color,
          "--shop-button-hover": store.catalog_visual.button_hover_color,
          "--shop-button-text": store.catalog_visual.button_text_color,
          "--shop-surface": store.catalog_visual.header_background_color,
          "--shop-surface-text": store.catalog_visual.header_text_color,
          "--store-heading-font": storeFontFamily(store.catalog_visual.heading_font),
          "--store-body-font": storeFontFamily(store.catalog_visual.body_font),
          "--store-heading-scale": store.catalog_visual.heading_scale / 100,
          "--store-body-size": `${14 * (store.catalog_visual.body_scale / 100)}px`,
        } as CSSProperties}
      >
        <StoreHeader />
        <main>
          <Outlet />
        </main>
        <StoreFooter />
        <CartDrawer />
      </div>
    </StorefrontProvider>
  );
}
