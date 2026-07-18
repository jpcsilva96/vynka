import { Link } from "@tanstack/react-router";
import { Heart, Search, ShoppingBag, Menu, X } from "lucide-react";
import { useEffect, useState } from "react";
import { VynkaLogo } from "@/components/vynka-logo";
import {
  openCart,
  useCartTotals,
  buildWhatsAppLink,
} from "@/lib/cart";
import { useStorefront } from "@/lib/storefront-context";
import { cn } from "@/lib/utils";

const NAV: { label: string; hash?: string }[] = [
  { label: "Início" },
  { label: "Novidades", hash: "novidades" },
  { label: "Categorias", hash: "categorias" },
  { label: "Promoções", hash: "promocoes" },
  { label: "Contato", hash: "contato" },
];

export function StoreHeader() {
  const store = useStorefront();
  const slug = store.slug;
  const { count } = useCartTotals();
  const [scrolled, setScrolled] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <header
      className={cn(
        "fixed inset-x-0 top-0 z-40 bg-white transition-all duration-300",
        scrolled
          ? "border-b border-black/[0.06] shadow-[0_1px_20px_-8px_rgba(0,0,0,0.08)]"
          : "border-b border-transparent",
      )}
    >
      <div className="mx-auto grid h-16 max-w-[1400px] grid-cols-[auto_1fr_auto] items-center gap-6 px-6 md:h-20 md:px-10">
        <Link to="/loja/$slug" params={{ slug }} className="flex items-center gap-3">
          <VynkaLogo className="h-4 md:h-5" />
        </Link>

        <nav className="hidden items-center justify-center gap-8 lg:flex">
          {NAV.map((n) => (
            <Link
              key={n.label}
              to={n.to}
              hash={n.hash}
              className="text-[12px] font-medium uppercase tracking-[0.18em] text-neutral-700 transition-colors hover:text-black"
            >
              {n.label}
            </Link>
          ))}
        </nav>

        <div className="flex items-center gap-1 md:gap-2">
          <IconButton aria-label="Pesquisar">
            <Search className="h-[18px] w-[18px]" strokeWidth={1.4} />
          </IconButton>
          <IconButton aria-label="Favoritos" className="hidden md:inline-flex">
            <Heart className="h-[18px] w-[18px]" strokeWidth={1.4} />
          </IconButton>
          <IconButton aria-label="Carrinho" onClick={openCart}>
            <ShoppingBag className="h-[18px] w-[18px]" strokeWidth={1.4} />
            {count > 0 && (
              <span className="absolute -right-0.5 -top-0.5 grid h-4 min-w-4 place-items-center rounded-full bg-black px-1 text-[10px] font-medium text-white">
                {count}
              </span>
            )}
          </IconButton>
          <a
            href={buildWhatsAppLink(`Olá ${STORE_NAME}! Gostaria de mais informações.`)}
            target="_blank"
            rel="noreferrer"
            className="ml-1 hidden items-center gap-2 rounded-full border border-black/10 px-3.5 py-1.5 text-[12px] font-medium text-neutral-800 transition-colors hover:border-black hover:text-black md:inline-flex"
          >
            <WhatsAppIcon className="h-3.5 w-3.5" />
            WhatsApp
          </a>
          <button
            className="ml-1 grid h-9 w-9 place-items-center rounded-full text-neutral-800 hover:bg-neutral-100 lg:hidden"
            onClick={() => setMobileOpen((v) => !v)}
            aria-label="Menu"
          >
            {mobileOpen ? (
              <X className="h-[18px] w-[18px]" strokeWidth={1.4} />
            ) : (
              <Menu className="h-[18px] w-[18px]" strokeWidth={1.4} />
            )}
          </button>
        </div>
      </div>

      {mobileOpen && (
        <div className="border-t border-black/[0.06] bg-white lg:hidden">
          <nav className="mx-auto flex max-w-[1400px] flex-col px-6 py-4">
            {NAV.map((n) => (
              <Link
                key={n.label}
                to={n.to}
                hash={n.hash}
                onClick={() => setMobileOpen(false)}
                className="py-3 text-[13px] font-medium uppercase tracking-[0.18em] text-neutral-800"
              >
                {n.label}
              </Link>
            ))}
          </nav>
        </div>
      )}
    </header>
  );
}

function IconButton({
  children,
  className,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      {...props}
      className={cn(
        "relative grid h-9 w-9 place-items-center rounded-full text-neutral-800 transition-colors hover:bg-neutral-100 hover:text-black",
        className,
      )}
    >
      {children}
    </button>
  );
}

export function WhatsAppIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden>
      <path d="M17.5 14.4c-.3-.2-1.7-.9-2-1s-.5-.2-.7.2c-.2.3-.8 1-1 1.2-.2.2-.4.2-.6.1-.3-.2-1.2-.5-2.3-1.4-.8-.7-1.4-1.6-1.6-1.9-.2-.3 0-.5.1-.6l.5-.6c.1-.2.2-.3.2-.5s0-.4-.1-.5c-.1-.2-.7-1.7-1-2.3-.3-.6-.5-.5-.7-.5H7.5c-.2 0-.5.1-.7.3s-.9.9-.9 2.3.9 2.7 1 2.9c.1.2 1.8 2.7 4.3 3.8.6.3 1.1.4 1.5.5.6.2 1.2.2 1.6.1.5-.1 1.5-.6 1.7-1.2s.2-1.1.1-1.2c-.1-.1-.3-.2-.6-.4zM12 2C6.5 2 2 6.5 2 12c0 1.9.5 3.6 1.4 5.1L2 22l5-1.3c1.5.8 3.2 1.3 5 1.3 5.5 0 10-4.5 10-10S17.5 2 12 2z" />
    </svg>
  );
}
