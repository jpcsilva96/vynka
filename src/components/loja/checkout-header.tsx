import { Link } from "@tanstack/react-router";
import { Lock } from "lucide-react";
import { useStorefront, useStorefrontPreview } from "@/lib/storefront-context";
import { StoreLogo } from "./store-logo";

// Cabeçalho do checkout (escopo do catálogo, §10): só logo + "Compra segura", sem menu nem busca,
// para o cliente não sair no meio da compra.
export function CheckoutHeader() {
  const store = useStorefront();
  const preview = useStorefrontPreview();
  const visual = store.catalog_visual;
  return (
    <header
      className="border-b border-black/10"
      style={{ backgroundColor: visual.header_background_color, color: visual.header_text_color }}
    >
      <div className="mx-auto grid h-16 max-w-[1120px] grid-cols-[1fr_auto_1fr] items-center gap-3 px-4 md:h-20 md:px-8">
        <span />
        <Link
          to="/loja/$slug"
          params={{ slug: store.slug }}
          className="flex min-w-0 items-center justify-center text-current"
        >
          {store.logo_url ? (
            <StoreLogo
              src={store.logo_url}
              alt={store.name}
              visual={visual}
              previewDevice={preview}
            />
          ) : (
            <span className="truncate text-[15px] font-semibold uppercase tracking-[0.22em] text-current">
              {store.name}
            </span>
          )}
        </Link>
        <span className="flex items-center justify-end gap-1.5 text-[11px] font-medium uppercase tracking-[0.14em] opacity-80">
          <Lock className="h-3.5 w-3.5 shrink-0" strokeWidth={1.8} />
          <span>Compra segura</span>
        </span>
      </div>
    </header>
  );
}
