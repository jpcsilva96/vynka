import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Menu, ShoppingBag, User, X } from "lucide-react";
import { useState } from "react";
import { openCart, useCartTotals } from "@/lib/cart";
import { useStoreCustomer } from "@/lib/customer-account";
import { listPublicCategories } from "@/lib/public-shop";
import { useStorefront } from "@/lib/storefront-context";
import { cn } from "@/lib/utils";

export function StoreHeader() {
  const store = useStorefront();
  const slug = store.slug;
  const { count } = useCartTotals();
  const { data: customer } = useStoreCustomer(store.id);
  const [open, setOpen] = useState(false);
  const { data: categories = [] } = useQuery({
    queryKey: ["public-header-categories", store.id],
    queryFn: () => listPublicCategories(store.id),
  });

  const links = [
    { label: "Inicio", hash: undefined },
    { label: "Produtos", hash: "produtos" },
    ...(store.catalog_visual.show_categories ? [{ label: "Categorias", hash: "categorias" }] : []),
    { label: "Contato", hash: "contato" },
  ];

  return (
    <header className="sticky top-0 z-40 border-b border-black/10 bg-white/95 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-[1280px] items-center justify-between px-4 md:h-20 md:px-8">
        <Link to="/loja/$slug" params={{ slug }} className="flex min-w-0 items-center gap-3">
          {store.logo_url ? (
            <img src={store.logo_url} alt={store.name} className="h-9 w-9 rounded-sm object-contain" />
          ) : (
            <div className="grid h-9 w-9 place-items-center border border-black text-[10px] font-semibold tracking-[0.18em]">
              V
            </div>
          )}
          <div className="min-w-0">
            <div className="truncate text-[15px] font-semibold uppercase tracking-[0.22em] text-black">
              {store.name}
            </div>
            <div className="hidden text-[10px] uppercase tracking-[0.18em] text-neutral-500 sm:block">
              Catalogo online
            </div>
          </div>
        </Link>

        <nav className="hidden items-center gap-7 md:flex">
          {links.map((link) => (
            <Link
              key={link.label}
              to="/loja/$slug"
              params={{ slug }}
              hash={link.hash}
              className="text-[12px] font-medium uppercase tracking-[0.18em] text-neutral-600 transition-colors hover:text-black"
            >
              {link.label}
            </Link>
          ))}
        </nav>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={openCart}
            className="relative grid h-10 w-10 place-items-center rounded-full text-black transition-colors hover:bg-neutral-100"
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
            className="hidden h-10 items-center gap-2 rounded-full px-3 text-[12px] font-medium uppercase tracking-[0.14em] text-black transition-colors hover:bg-neutral-100 sm:inline-flex"
          >
            <User className="h-4 w-4" strokeWidth={1.7} />
            {customer ? "Minha conta" : "Entrar"}
          </Link>
          <button
            type="button"
            onClick={() => setOpen((value) => !value)}
            className="grid h-10 w-10 place-items-center rounded-full text-black transition-colors hover:bg-neutral-100 md:hidden"
            aria-label="Menu"
          >
            {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>
      </div>

      {open && (
        <div className="border-t border-black/10 bg-white md:hidden">
          <nav className="mx-auto max-w-[1280px] px-4 py-4">
            {links.map((link) => (
              <Link
                key={link.label}
                to="/loja/$slug"
                params={{ slug }}
                hash={link.hash}
                onClick={() => setOpen(false)}
                className="block py-3 text-[12px] font-medium uppercase tracking-[0.18em] text-neutral-700"
              >
                {link.label}
              </Link>
            ))}
            {categories.length > 0 && (
              <div className="mt-2 border-t border-black/10 pt-3">
                {categories.map((category) => (
                  <Link
                    key={category.id}
                    to="/loja/$slug/categoria/$categorySlug"
                    params={{ slug, categorySlug: category.slug }}
                    onClick={() => setOpen(false)}
                    className={cn("block py-2 text-[13px] text-neutral-600", category.count === 0 && "opacity-50")}
                  >
                    {category.name}
                  </Link>
                ))}
              </div>
            )}
            <Link
              to={customer ? "/loja/$slug/minha-conta" : "/loja/$slug/entrar"}
              params={{ slug }}
              onClick={() => setOpen(false)}
              className="mt-2 block border-t border-black/10 pt-4 text-[12px] font-medium uppercase tracking-[0.18em] text-neutral-700"
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
