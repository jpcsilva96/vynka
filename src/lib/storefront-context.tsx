import { createContext, useContext, type ReactNode } from "react";

export interface StorefrontStore {
  id: string;
  slug: string;
  name: string;
  logo_url: string | null;
  whatsapp: string | null;
  status: string;
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
