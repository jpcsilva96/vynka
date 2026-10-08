import { createContext, useContext, type ReactNode } from "react";
import type { CatalogVisualSettings, StoreBanner } from "@/lib/store-settings";
import type { PreviewDevice } from "@/lib/storefront-preview";

export interface StorefrontStore {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  logo_url: string | null;
  favicon_url: string | null;
  banner_url: string | null;
  og_image_url: string | null;
  banner_title: string | null;
  banner_subtitle: string | null;
  banner_cta: string | null;
  phone: string | null;
  whatsapp: string | null;
  email: string | null;
  instagram: string | null;
  address: string | null;
  address_number: string | null;
  complement: string | null;
  city: string | null;
  state: string | null;
  zip_code: string | null;
  business_hours: string | null;
  status: string;
  publication_status: "draft" | "published" | "unpublished" | "suspended";
  catalog_visual: CatalogVisualSettings;
  banners: StoreBanner[];
}

const Ctx = createContext<StorefrontStore | null>(null);
// Aparelho da prévia quando a loja está aberta no editor de personalização; null fora dele.
const PreviewCtx = createContext<PreviewDevice | null>(null);

export function StorefrontProvider({
  store,
  preview = null,
  children,
}: {
  store: StorefrontStore;
  preview?: PreviewDevice | null;
  children: ReactNode;
}) {
  return (
    <Ctx.Provider value={store}>
      <PreviewCtx.Provider value={preview}>{children}</PreviewCtx.Provider>
    </Ctx.Provider>
  );
}

export function useStorefrontPreview() {
  return useContext(PreviewCtx);
}

export function useStorefront(): StorefrontStore {
  const s = useContext(Ctx);
  if (!s) throw new Error("useStorefront must be used inside <StorefrontProvider>");
  return s;
}
