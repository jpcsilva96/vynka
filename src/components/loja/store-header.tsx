import { Link, useRouterState } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ChevronDown, Menu, ShoppingBag, User, X } from "lucide-react";
import { useState } from "react";
import { openCart, useCartTotals } from "@/lib/cart";
import { useStoreCustomer } from "@/lib/customer-account";
import { listPublicCategories } from "@/lib/public-shop";
import { useStorefront, useStorefrontPreview } from "@/lib/storefront-context";
import { StoreLogo } from "./store-logo";
import { cn } from "@/lib/utils";

export function StoreHeader() {
  const store = useStorefront();
  const preview = useStorefrontPreview();
  const slug = store.slug;
  const { count } = useCartTotals();
  const { data: customer } = useStoreCustomer(store.id);
  const [open, setOpen] = useState(false);
  const currentPath = useRouterState({ select: (state) => state.location.pathname });
  const { data: categories = [] } = useQuery({
    queryKey: ["public-header-categories", store.id],
    queryFn: () => listPublicCategories(store.id),
  });

  const visual = store.catalog_visual;
  const headerBackground = visual.header_background_color;
  const brand = (
    <Link
      to="/loja/$slug"
      params={{ slug }}
      className="flex min-w-0 items-center gap-3 text-current"
    >
      {store.logo_url ? (
        <StoreLogo src={store.logo_url} alt={store.name} visual={visual} previewDevice={preview} />
      ) : (
        // Logo OU nome, nunca os dois (escopo do catálogo, §2).
        <div className="min-w-0">
          <div className="truncate text-[15px] font-semibold uppercase tracking-[0.22em] text-current">
            {store.name}
          </div>
        </div>
      )}
    </Link>
  );
  const desktopNav = (
    <nav className="hidden items-center justify-center gap-7 md:flex">
      <Link
        to="/loja/$slug"
        params={{ slug }}
        className="text-[12px] font-medium uppercase tracking-[0.18em] text-current opacity-70 transition-opacity hover:opacity-100"
      >
        Início
      </Link>
      <div className="group relative">
        <Link
          to="/loja/$slug"
          params={{ slug }}
          hash="categorias"
          className="inline-flex items-center gap-1.5 py-2 text-[12px] font-medium uppercase tracking-[0.18em] text-current opacity-70 transition-opacity hover:opacity-100 focus:opacity-100"
        >
          Categorias
          <ChevronDown
            className="h-3.5 w-3.5 transition-transform group-hover:rotate-180 group-focus-within:rotate-180"
            strokeWidth={1.7}
          />
        </Link>
        <div
          className="invisible absolute left-1/2 top-full z-50 w-72 -translate-x-1/2 translate-y-2 border border-current/10 p-2 opacity-0 shadow-xl transition-all group-hover:visible group-hover:translate-y-0 group-hover:opacity-100 group-focus-within:visible group-focus-within:translate-y-0 group-focus-within:opacity-100"
          style={{ backgroundColor: headerBackground }}
        >
          {categories.length > 0 ? (
            categories.map((category) => (
              <div key={category.id} className="border-b border-current/10 last:border-b-0">
                <Link
                  to="/loja/$slug/categoria/$categorySlug"
                  params={{ slug, categorySlug: category.slug }}
                  className="block px-3 py-2.5 text-[13px] font-semibold text-current transition-colors hover:bg-black/5"
                >
                  {category.name}
                </Link>
                {category.children.length > 0 && (
                  <div className="pb-2">
                    {category.children.map((child) => (
                      <Link
                        key={child.id}
                        to="/loja/$slug/categoria/$categorySlug/$childSlug"
                        params={{ slug, categorySlug: category.slug, childSlug: child.slug }}
                        className="block px-5 py-1.5 text-[12px] text-current opacity-70 transition-all hover:bg-black/5 hover:opacity-100"
                      >
                        {child.name}
                      </Link>
                    ))}
                  </div>
                )}
              </div>
            ))
          ) : (
            <div className="px-3 py-3 text-[12px] text-current opacity-60">
              Nenhuma categoria cadastrada.
            </div>
          )}
        </div>
      </div>
      {visual.about_enabled && (
        <Link
          to="/loja/$slug/quem-somos"
          params={{ slug }}
          className="text-[12px] font-medium uppercase tracking-[0.18em] text-current opacity-70 transition-opacity hover:opacity-100"
        >
          Quem somos
        </Link>
      )}
      {visual.contact_enabled && (
        <Link
          to="/loja/$slug/contato"
          params={{ slug }}
          aria-current={currentPath.endsWith("/contato") ? "page" : undefined}
          className={cn(
            "border-b-2 border-transparent pb-1 text-[12px] font-medium uppercase tracking-[0.18em] text-current opacity-70 transition-all hover:opacity-100",
            currentPath.endsWith("/contato") && "border-current opacity-100",
          )}
        >
          Contato
        </Link>
      )}
    </nav>
  );
  const actions = (
    <div className="flex items-center justify-end gap-2">
      <button
        type="button"
        onClick={openCart}
        className="relative grid h-10 w-10 place-items-center rounded-full text-current transition-colors hover:bg-black/5"
        aria-label="Abrir carrinho"
      >
        <ShoppingBag className="h-5 w-5" strokeWidth={1.7} />
        {count > 0 && (
          <span className="absolute -right-0.5 -top-0.5 grid h-5 min-w-5 place-items-center rounded-full bg-black px-1 text-[10px] font-semibold text-white">
            {count}
          </span>
        )}
      </button>
      <Link
        to={customer ? "/loja/$slug/minha-conta" : "/loja/$slug/entrar"}
        params={{ slug }}
        className="hidden h-10 items-center gap-2 rounded-full px-3 text-[12px] font-medium uppercase tracking-[0.14em] text-current transition-colors hover:bg-black/5 sm:inline-flex"
      >
        <User className="h-4 w-4" strokeWidth={1.7} />
        {customer ? "Minha conta" : "Entrar"}
      </Link>
    </div>
  );
  const menuButton = (
    <button
      type="button"
      onClick={() => setOpen((value) => !value)}
      className="grid h-10 w-10 place-items-center rounded-full text-current transition-colors hover:bg-black/5 md:hidden"
      aria-label="Menu"
    >
      {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
    </button>
  );

  return (
    <header
      className={cn("z-40 border-b border-black/10", visual.header_sticky && "sticky top-0")}
      style={{ backgroundColor: headerBackground, color: visual.header_text_color }}
    >
      <div className="mx-auto flex h-20 max-w-[1280px] items-center justify-between gap-5 px-4 md:px-8">
        {brand}
        {desktopNav}
        <div className="flex items-center gap-2">
          {actions}
          {menuButton}
        </div>
      </div>

      {open && (
        <div
          className="border-t border-current/10 md:hidden"
          style={{ backgroundColor: headerBackground }}
        >
          <nav className="mx-auto max-w-[1280px] px-4 py-4">
            <Link
              to="/loja/$slug"
              params={{ slug }}
              onClick={() => setOpen(false)}
              className="block py-3 text-[12px] font-medium uppercase tracking-[0.18em] text-current opacity-80"
            >
              Início
            </Link>
            {categories.length > 0 && (
              <div className="border-y border-current/10 py-3">
                <div className="pb-2 text-[12px] font-medium uppercase tracking-[0.18em] text-current opacity-80">
                  Categorias
                </div>
                {categories.map((category) => (
                  <div key={category.id}>
                    <Link
                      to="/loja/$slug/categoria/$categorySlug"
                      params={{ slug, categorySlug: category.slug }}
                      onClick={() => setOpen(false)}
                      className={cn(
                        "block py-2 text-[13px] font-semibold text-current opacity-75",
                        category.count === 0 && "opacity-50",
                      )}
                    >
                      {category.name}
                    </Link>
                    {category.children.map((child) => (
                      <Link
                        key={child.id}
                        to="/loja/$slug/categoria/$categorySlug/$childSlug"
                        params={{ slug, categorySlug: category.slug, childSlug: child.slug }}
                        onClick={() => setOpen(false)}
                        className="block py-1.5 pl-4 text-[12px] text-current opacity-65"
                      >
                        {child.name}
                      </Link>
                    ))}
                  </div>
                ))}
              </div>
            )}
            {visual.about_enabled && (
              <Link
                to="/loja/$slug/quem-somos"
                params={{ slug }}
                onClick={() => setOpen(false)}
                className="block py-3 text-[12px] font-medium uppercase tracking-[0.18em] text-current opacity-80"
              >
                Quem somos
              </Link>
            )}
            {visual.contact_enabled && (
              <Link
                to="/loja/$slug/contato"
                params={{ slug }}
                onClick={() => setOpen(false)}
                aria-current={currentPath.endsWith("/contato") ? "page" : undefined}
                className={cn(
                  "block border-l-2 border-transparent py-3 pl-3 text-[12px] font-medium uppercase tracking-[0.18em] text-current opacity-80",
                  currentPath.endsWith("/contato") && "border-current opacity-100",
                )}
              >
                Contato
              </Link>
            )}
            <Link
              to={customer ? "/loja/$slug/minha-conta" : "/loja/$slug/entrar"}
              params={{ slug }}
              onClick={() => setOpen(false)}
              className="mt-2 block border-t border-current/10 pt-4 text-[12px] font-medium uppercase tracking-[0.18em] text-current opacity-80"
            >
              {customer ? "Minha conta" : "Entrar"}
            </Link>
          </nav>
        </div>
      )}
    </header>
  );
}


export function WhatsAppIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden>
      <path d="M17.5 14.4c-.3-.2-1.7-.9-2-1s-.5-.2-.7.2c-.2.3-.8 1-1 1.2-.2.2-.4.2-.6.1-.3-.2-1.2-.5-2.3-1.4-.8-.7-1.4-1.6-1.6-1.9-.2-.3 0-.5.1-.6l.5-.6c.1-.2.2-.3.2-.5s0-.4-.1-.5c-.1-.2-.7-1.7-1-2.3-.3-.6-.5-.5-.7-.5H7.5c-.2 0-.5.1-.7.3s-.9.9-.9 2.3.9 2.7 1 2.9c.1.2 1.8 2.7 4.3 3.8.6.3 1.1.4 1.5.5.6.2 1.2.2 1.6.1.5-.1 1.5-.6 1.7-1.2s.2-1.1.1-1.2c-.1-.1-.3-.2-.6-.4zM12 2C6.5 2 2 6.5 2 12c0 1.9.5 3.6 1.4 5.1L2 22l5-1.3c1.5.8 3.2 1.3 5 1.3 5.5 0 10-4.5 10-10S17.5 2 12 2z" />
    </svg>
  );
}
