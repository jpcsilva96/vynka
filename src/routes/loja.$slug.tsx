import { createFileRoute, Link, notFound, Outlet } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { trackStoreView } from "@/lib/views";
import { CartDrawer } from "@/components/loja/cart-drawer";
import { StoreFooter } from "@/components/loja/store-footer";
import { StoreHeader } from "@/components/loja/store-header";
import { setCartPreviewMode, useCartHydration } from "@/lib/cart";
import { getStoreBySlug } from "@/lib/public-shop";
import { StorefrontProvider } from "@/lib/storefront-context";
import { normalizeCatalogVisualSettings, storeFontFamily } from "@/lib/store-settings";
import { isPreviewFrame, usePreviewOverrides } from "@/lib/storefront-preview";
import type { CSSProperties } from "react";

export const Route = createFileRoute("/loja/$slug")({
  component: LojaLayout,
  notFoundComponent: () => (
    <StoreMessage title="Loja não encontrada" message="Verifique o endereço ou volte ao início." />
  ),
});

function StoreMessage({ title, message }: { title: string; message: string }) {
  return (
    <div className="grid min-h-svh place-items-center bg-white px-6 text-center font-sans">
      <div>
        <h1 className="text-3xl font-semibold text-neutral-900">{title}</h1>
        <p className="mt-2 text-[13px] text-neutral-600">{message}</p>
        <Link to="/" className="mt-6 inline-block text-[12px] uppercase tracking-[0.2em] underline">
          Ir ao início
        </Link>
      </div>
    </div>
  );
}

function LojaLayout() {
  const { slug } = Route.useParams();
  useCartHydration();

  const { data: savedStore, isLoading, isError } = useQuery({
    queryKey: ["storefront-store", slug],
    queryFn: () => getStoreBySlug(slug),
  });

  // Prévia do editor: decide no navegador (o servidor não sabe se está numa moldura).
  const [preview, setPreview] = useState(false);
  useEffect(() => setPreview(isPreviewFrame()), []);
  useEffect(() => {
    setCartPreviewMode(preview);
  }, [preview]);
  const overrides = usePreviewOverrides(preview);
  const store = useMemo(() => {
    if (!savedStore || !overrides) return savedStore;
    return {
      ...savedStore,
      name: overrides.name || savedStore.name,
      description: overrides.description || null,
      logo_url: overrides.logo_url || null,
      favicon_url: overrides.favicon_url || null,
      catalog_visual: normalizeCatalogVisualSettings(overrides.visual),
      banners: overrides.banners.filter((banner) => banner.active && banner.image_url),
    };
  }, [savedStore, overrides]);

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
    if (storeOpen && store && !isPreviewFrame()) trackStoreView(store.id);
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
    return <StoreMessage title="Loja indisponível" message="Esta loja não está aceitando pedidos no momento." />;
  }
  if (store.publication_status !== "published" && !preview) {
    return <StoreMessage title="Loja indisponível" message="Este catálogo ainda não está publicado." />;
  }

  return (
    <StorefrontProvider store={store} preview={preview ? (overrides?.device ?? "mobile") : null}>
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
