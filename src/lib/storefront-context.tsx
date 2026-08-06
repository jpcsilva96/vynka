import { createContext, useContext, type ReactNode } from "react";
import type { CatalogVisualSettings } from "@/lib/store-settings";

export interface StorefrontStore {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  logo_url: string | null;
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
  business_hours: string | null;
  status: string;
  publication_status: "draft" | "published" | "unpublished" | "suspended";
  catalog_visual: CatalogVisualSettings;
}

const Ctx = createContext<StorefrontStore | null>(null);

export function StorefrontProvider({
  store,
  children,
}: {
  store: StorefrontStore;
  children: ReactNode;
}) {
  return <Ctx.Provider value={store}>{children}</Ctx.Provider>;
}

export function useStorefront(): StorefrontStore {
  const s = useContext(Ctx);
  if (!s) throw new Error("useStorefront must be used inside <StorefrontProvider>");
  return s;
}
