import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import { ChevronDown, Instagram, Menu, Search, ShoppingBag, User } from "lucide-react";
import { useCallback, useEffect, useState, type FormEvent, type ReactElement } from "react";
import { buildWhatsAppLink, openCart, useCartTotals } from "@/lib/cart";
import { signOutCustomer, useStoreCustomer } from "@/lib/customer-account";
import { openCustomerAuth } from "@/lib/customer-auth-dialog";
import { newArrivals, onSale } from "@/lib/product-listing";
import { formatBRL } from "@/lib/products";
import {
  applySoldOutDisplay,
  listActiveProducts,
  listPublicCategories,
  type PublicCategory,
} from "@/lib/public-shop";
import {
  useStorefront,
  useStorefrontPreview,
  type StorefrontStore,
} from "@/lib/storefront-context";
import { StoreDrawer } from "./store-drawer";
import { StoreLogo } from "./store-logo";
import { cn } from "@/lib/utils";

// Cabeçalho da loja (escopo do catálogo, §4): faixa fina (aviso + Entrar/Olá + redes), linha principal
// (busca · logo · carrinho) e linha do menu com as categorias principais na ordem da aba Categorias.
// No celular: a faixa mostra só aviso + Entrar/Olá, a busca fica logo abaixo e o menu vai para a gaveta.
export function StoreHeader() {
  const store = useStorefront();
  const preview = useStorefrontPreview();
  const slug = store.slug;
  const { count, subtotal } = useCartTotals();
  const { data: customer } = useStoreCustomer(store.id);
  const [open, setOpen] = useState(false);
  const closeMenu = useCallback(() => setOpen(false), []);
  const currentPath = useRouterState({ select: (state) => state.location.pathname });
  const { data: categories = [] } = useQuery({
    queryKey: ["public-header-categories", store.id],
    queryFn: () => listPublicCategories(store.id),
  });
  // Mesma lista da página inicial (cache compartilhado): Novidades e Promoções só entram no menu se houver.
  const { data: allProducts = [] } = useQuery({
    queryKey: ["public-products", store.id],
    queryFn: () => listActiveProducts(store.id),
  });
  const products = applySoldOutDisplay(allProducts, store.catalog_visual.sold_out_display);
  const highlights = {
    hasNew: newArrivals(products).length > 0,
    hasSale: onSale(products).length > 0,
  };

  const visual = store.catalog_visual;
  const headerBackground = visual.header_background_color;
  const firstName = customer?.name?.trim().split(/\s+/)[0] ?? "";
  const accountLabel = customer ? (firstName ? `Olá, ${firstName}` : "Minha conta") : "Entrar";
  // Sem conta: abre a janela de entrar. Com conta: na gaveta do celular leva à Minha conta; na faixa
  // do topo abre o submenu (AccountMenu).
  const accountLink: AccountLink = (className, onClick) =>
    customer ? (
      <Link to="/loja/$slug/minha-conta" params={{ slug }} onClick={onClick} className={className}>
        <User className="h-3.5 w-3.5 shrink-0" strokeWidth={1.8} />
        <span className="truncate">{accountLabel}</span>
      </Link>
    ) : (
      <button
        type="button"
        onClick={() => {
          onClick?.();
          openCustomerAuth();
        }}
        className={className}
      >
        <User className="h-3.5 w-3.5 shrink-0" strokeWidth={1.8} />
        <span className="truncate">{accountLabel}</span>
      </button>
    );
  const social = socialLinks(store);
  const contactActive = currentPath.endsWith("/contato");
  const aboutActive = currentPath.endsWith("/quem-somos");

  const topBar = (
    <div className="border-b border-current/10">
      <div className="mx-auto flex h-8 max-w-[1280px] items-center justify-between gap-4 px-4 text-[11px] md:px-8">
        <p className="min-w-0 truncate opacity-80">{visual.announcement_text}</p>
        <div className="flex shrink-0 items-center gap-3">
          {social.length > 0 && (
            <div className="hidden items-center gap-1 md:flex">
              {social.map((item) => (
                <a
                  key={item.label}
                  href={item.href}
                  target="_blank"
                  rel="noreferrer"
                  aria-label={item.label}
                  className="grid h-7 w-7 place-items-center rounded-full opacity-70 transition-opacity hover:opacity-100"
                >
                  <item.Icon className="h-3.5 w-3.5" />
                </a>
              ))}
            </div>
          )}
          {customer ? (
            <AccountMenu label={accountLabel} background={headerBackground} />
          ) : (
            accountLink(
              "inline-flex h-8 max-w-[160px] items-center gap-1.5 font-medium opacity-80 transition-opacity hover:opacity-100",
            )
          )}
        </div>
      </div>
    </div>
  );

  const brand = (
    <Link
      to="/loja/$slug"
      params={{ slug }}
      className="flex min-w-0 items-center justify-center text-current"
    >
      {store.logo_url ? (
        <StoreLogo src={store.logo_url} alt={store.name} visual={visual} previewDevice={preview} />
      ) : (
        // Logo OU nome, nunca os dois (escopo do catálogo, §2).
        <span className="truncate text-[15px] font-semibold uppercase tracking-[0.22em] text-current">
          {store.name}
        </span>
      )}
    </Link>
  );

  const cartButton = (
    <button
      type="button"
      onClick={openCart}
      data-cart-target
      className="relative inline-flex h-11 items-center gap-2 rounded-full px-2.5 text-current transition-colors hover:bg-black/5"
      aria-label={`Abrir carrinho, ${count} ${count === 1 ? "item" : "itens"}`}
    >
      <span className="relative">
        <ShoppingBag className="h-5 w-5" strokeWidth={1.7} />
        {count > 0 && (
          <span className="absolute -right-2 -top-2 grid h-5 min-w-5 place-items-center rounded-full bg-black px-1 text-[10px] font-semibold text-white">
            {count}
          </span>
        )}
      </span>
      <span className="hidden text-[13px] font-semibold tabular-nums md:inline">
        {formatBRL(subtotal)}
      </span>
    </button>
  );

  const desktopNav = (
    <nav aria-label="Categorias" className="hidden border-t border-current/10 md:block">
      <div className="mx-auto flex max-w-[1280px] flex-wrap items-center justify-center gap-x-7 px-8">
        {categories.map((category) => (
          <DesktopCategory
            key={category.id}
            category={category}
            slug={slug}
            background={headerBackground}
            active={currentPath.includes(`/categoria/${category.slug}`)}
          />
        ))}
        {highlights.hasNew && (
          <Link
            to="/loja/$slug/novidades"
            params={{ slug }}
            className={navLinkClass(currentPath.endsWith("/novidades"))}
          >
            Novidades
          </Link>
        )}
        {highlights.hasSale && (
          <Link
            to="/loja/$slug/promocoes"
            params={{ slug }}
            className={navLinkClass(currentPath.endsWith("/promocoes"))}
          >
            Promoções
          </Link>
        )}
        {visual.about_enabled && (
          <Link
            to="/loja/$slug/quem-somos"
            params={{ slug }}
            aria-current={aboutActive ? "page" : undefined}
            className={navLinkClass(aboutActive)}
          >
            Quem somos
          </Link>
        )}
        {visual.contact_enabled && (
          <Link
            to="/loja/$slug/contato"
            params={{ slug }}
            aria-current={contactActive ? "page" : undefined}
            className={navLinkClass(contactActive)}
          >
            Contato
          </Link>
        )}
      </div>
    </nav>
  );

  return (
    <header
      className={cn("z-40 border-b border-black/10", visual.header_sticky && "sticky top-0")}
      style={{ backgroundColor: headerBackground, color: visual.header_text_color }}
    >
      {topBar}
      <div className="mx-auto grid h-16 max-w-[1280px] grid-cols-[1fr_auto_1fr] items-center gap-3 px-4 md:h-20 md:gap-6 md:px-8">
        <div className="flex min-w-0 items-center">
          <button
            type="button"
            onClick={() => setOpen(true)}
            className="-ml-2 grid h-11 w-11 place-items-center rounded-full text-current transition-colors hover:bg-black/5 md:hidden"
            aria-label="Abrir menu"
            aria-expanded={open}
          >
            <Menu className="h-5 w-5" />
          </button>
          <div className="hidden w-full max-w-[320px] md:block">
            <SearchForm />
          </div>
        </div>
        {brand}
        <div className="flex justify-end">{cartButton}</div>
      </div>
      <div className="px-4 pb-2 md:hidden">
        <SearchForm />
      </div>
      {desktopNav}

      <MenuDrawer
        open={open}
        onClose={closeMenu}
        store={store}
        categories={categories}
        highlights={highlights}
        accountLink={accountLink}
        social={social}
        currentPath={currentPath}
      />
    </header>
  );
}

type AccountLink = (className: string, onClick?: () => void) => ReactElement;

// Submenu do "Olá, Fulano" (escopo do catálogo, §9): cada item numa página própria. Fica dentro do
// cabeçalho (sem portal) para herdar as cores dele; Esc e clique fora fecham.
function AccountMenu({ label, background }: { label: string; background: string }) {
  const store = useStorefront();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const currentPath = useRouterState({ select: (state) => state.location.pathname });
  const slug = store.slug;
  const itemClass =
    "flex min-h-10 cursor-pointer items-center px-3 text-[13px] text-current outline-none transition-colors data-[highlighted]:bg-black/5";
  const items = [
    { to: "/loja/$slug/minha-conta/dados", label: "Meus dados" },
    { to: "/loja/$slug/minha-conta/enderecos", label: "Meus endereços" },
    { to: "/loja/$slug/minha-conta/compras", label: "Minhas compras" },
    { to: "/loja/$slug/minha-conta/favoritos", label: "Favoritos" },
  ] as const;

  // Na Minha conta, sai da página antes de encerrar a sessão (senão ela manda para "Entrar").
  const signOut = async () => {
    if (currentPath.includes("/minha-conta"))
      await navigate({ to: "/loja/$slug", params: { slug } });
    await signOutCustomer(store.id);
    await queryClient.invalidateQueries({ queryKey: ["store-customer", store.id] });
  };

  return (
    <DropdownMenu.Root modal={false}>
      <DropdownMenu.Trigger className="inline-flex h-8 max-w-[160px] items-center gap-1.5 font-medium opacity-80 outline-none transition-opacity hover:opacity-100 data-[state=open]:opacity-100">
        <User className="h-3.5 w-3.5 shrink-0" strokeWidth={1.8} />
        <span className="truncate">{label}</span>
        <ChevronDown className="h-3 w-3 shrink-0" strokeWidth={1.8} />
      </DropdownMenu.Trigger>
      <DropdownMenu.Content
        align="end"
        sideOffset={4}
        className="z-50 w-52 border border-current/10 p-1.5 shadow-xl"
        style={{ backgroundColor: background }}
      >
        {items.map((item) => (
          <DropdownMenu.Item key={item.to} asChild>
            <Link to={item.to} params={{ slug }} className={itemClass}>
              {item.label}
            </Link>
          </DropdownMenu.Item>
        ))}
        <DropdownMenu.Separator className="my-1 h-px bg-current opacity-10" />
        <DropdownMenu.Item onSelect={() => void signOut()} className={itemClass}>
          Sair
        </DropdownMenu.Item>
      </DropdownMenu.Content>
    </DropdownMenu.Root>
  );
}

function navLinkClass(active: boolean) {
  return cn(
    "inline-flex h-11 items-center border-b-2 border-transparent text-[12px] font-medium uppercase tracking-[0.18em] text-current opacity-70 transition-opacity hover:opacity-100",
    active && "border-current opacity-100",
  );
}

function DesktopCategory({
  category,
  slug,
  background,
  active,
}: {
  category: PublicCategory;
  slug: string;
  background: string;
  active: boolean;
}) {
  if (category.children.length === 0) {
    return (
      <Link
        to="/loja/$slug/categoria/$categorySlug"
        params={{ slug, categorySlug: category.slug }}
        className={navLinkClass(active)}
      >
        {category.name}
      </Link>
    );
  }
  return (
    <div className="group relative">
      <Link
        to="/loja/$slug/categoria/$categorySlug"
        params={{ slug, categorySlug: category.slug }}
        className={cn(navLinkClass(active), "gap-1.5")}
      >
        {category.name}
        <ChevronDown
          className="h-3.5 w-3.5 transition-transform group-hover:rotate-180 group-focus-within:rotate-180"
          strokeWidth={1.7}
        />
      </Link>
      <div
        className="invisible absolute left-1/2 top-full z-50 w-60 -translate-x-1/2 translate-y-2 border border-current/10 p-2 opacity-0 shadow-xl transition-all group-hover:visible group-hover:translate-y-0 group-hover:opacity-100 group-focus-within:visible group-focus-within:translate-y-0 group-focus-within:opacity-100"
        style={{ backgroundColor: background }}
      >
        <Link
          to="/loja/$slug/categoria/$categorySlug"
          params={{ slug, categorySlug: category.slug }}
          className="block px-3 py-2 text-[13px] font-semibold text-current transition-colors hover:bg-black/5"
        >
          Ver tudo em {category.name}
        </Link>
        {category.children.map((child) => (
          <Link
            key={child.id}
            to="/loja/$slug/categoria/$categorySlug/$childSlug"
            params={{ slug, categorySlug: category.slug, childSlug: child.slug }}
            className="block px-3 py-2 text-[13px] text-current opacity-75 transition-all hover:bg-black/5 hover:opacity-100"
          >
            {child.name}
          </Link>
        ))}
      </div>
    </div>
  );
}

function SearchForm() {
  const store = useStorefront();
  const navigate = useNavigate();
  const location = useRouterState({ select: (state) => state.location });
  const onSearchPage = location.pathname.endsWith("/busca");
  const currentQuery = onSearchPage ? String((location.search as { q?: unknown }).q ?? "") : "";
  const [value, setValue] = useState(currentQuery);
  // Fora da página de busca o campo volta vazio; nela, mostra o que foi buscado.
  useEffect(() => setValue(currentQuery), [currentQuery]);

  const submit = (event: FormEvent) => {
    event.preventDefault();
    navigate({
      to: "/loja/$slug/busca",
      params: { slug: store.slug },
      search: { q: value.trim() },
    });
  };

  return (
    <form role="search" onSubmit={submit} className="relative">
      <input
        type="search"
        enterKeyHint="search"
        value={value}
        onChange={(event) => setValue(event.target.value)}
        placeholder="O que você procura?"
        aria-label="Buscar produtos"
        className="h-11 w-full rounded-full border border-current/20 bg-transparent pl-4 pr-11 text-[14px] text-current outline-none placeholder:text-current placeholder:opacity-50 focus:border-current/50"
      />
      <button
        type="submit"
        aria-label="Buscar"
        className="absolute right-0 top-0 grid h-11 w-11 place-items-center rounded-full text-current opacity-70 hover:opacity-100"
      >
        <Search className="h-4 w-4" strokeWidth={1.8} />
      </button>
    </form>
  );
}

type SocialLink = {
  label: string;
  href: string;
  Icon: (props: { className?: string }) => ReactElement;
};

function socialLinks(store: StorefrontStore): SocialLink[] {
  const links: SocialLink[] = [];
  if (store.instagram) {
    const href = store.instagram.startsWith("http")
      ? store.instagram
      : `https://instagram.com/${store.instagram.replace(/^@/, "")}`;
    links.push({ label: "Instagram", href, Icon: (props) => <Instagram {...props} /> });
  }
  if (store.whatsapp) {
    links.push({
      label: "WhatsApp",
      href: buildWhatsAppLink(`Olá ${store.name}!`, store.whatsapp),
      Icon: WhatsAppIcon,
    });
  }
  return links;
}

function MenuDrawer({
  open,
  onClose,
  store,
  categories,
  highlights,
  accountLink,
  social,
  currentPath,
}: {
  open: boolean;
  onClose: () => void;
  store: StorefrontStore;
  categories: PublicCategory[];
  highlights: { hasNew: boolean; hasSale: boolean };
  accountLink: AccountLink;
  social: SocialLink[];
  currentPath: string;
}) {
  const slug = store.slug;
  const visual = store.catalog_visual;
  const itemClass =
    "flex min-h-11 items-center text-[13px] font-medium uppercase tracking-[0.16em] text-current";

  return (
    <div className="md:hidden">
      <StoreDrawer
        open={open}
        onClose={onClose}
        title="Menu"
        style={{ backgroundColor: visual.header_background_color, color: visual.header_text_color }}
        footer={
          social.length > 0 && (
            <div className="flex items-center gap-2 px-5 py-3">
              {social.map((item) => (
                <a
                  key={item.label}
                  href={item.href}
                  target="_blank"
                  rel="noreferrer"
                  aria-label={item.label}
                  className="grid h-11 w-11 place-items-center rounded-full border border-current/15"
                >
                  <item.Icon className="h-4 w-4" />
                </a>
              ))}
            </div>
          )
        }
      >
        <nav aria-label="Menu da loja" className="px-5 py-3">
          <Link to="/loja/$slug" params={{ slug }} onClick={onClose} className={itemClass}>
            Início
          </Link>
          {categories.length > 0 && (
            <div className="border-y border-current/10 py-2">
              {categories.map((category) => (
                <div key={category.id}>
                  <Link
                    to="/loja/$slug/categoria/$categorySlug"
                    params={{ slug, categorySlug: category.slug }}
                    onClick={onClose}
                    className={cn(
                      "flex min-h-11 items-center text-[14px] font-semibold text-current",
                      currentPath.includes(`/categoria/${category.slug}`) &&
                        "underline underline-offset-4",
                    )}
                  >
                    {category.name}
                  </Link>
                  {category.children.map((child) => (
                    <Link
                      key={child.id}
                      to="/loja/$slug/categoria/$categorySlug/$childSlug"
                      params={{ slug, categorySlug: category.slug, childSlug: child.slug }}
                      onClick={onClose}
                      className="flex min-h-11 items-center pl-4 text-[13px] text-current opacity-75"
                    >
                      {child.name}
                    </Link>
                  ))}
                </div>
              ))}
            </div>
          )}
          {highlights.hasNew && (
            <Link
              to="/loja/$slug/novidades"
              params={{ slug }}
              onClick={onClose}
              className={itemClass}
            >
              Novidades
            </Link>
          )}
          {highlights.hasSale && (
            <Link
              to="/loja/$slug/promocoes"
              params={{ slug }}
              onClick={onClose}
              className={itemClass}
            >
              Promoções
            </Link>
          )}
          {visual.about_enabled && (
            <Link
              to="/loja/$slug/quem-somos"
              params={{ slug }}
              onClick={onClose}
              className={itemClass}
            >
              Quem somos
            </Link>
          )}
          {visual.contact_enabled && (
            <Link
              to="/loja/$slug/contato"
              params={{ slug }}
              onClick={onClose}
              className={itemClass}
            >
              Contato
            </Link>
          )}
          <div className="mt-2 border-t border-current/10 pt-2">
            {accountLink(
              "flex min-h-11 items-center gap-2 text-[13px] font-medium text-current",
              onClose,
            )}
          </div>
        </nav>
      </StoreDrawer>
    </div>
  );
}

export function WhatsAppIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden>
      <path d="M17.5 14.4c-.3-.2-1.7-.9-2-1s-.5-.2-.7.2c-.2.3-.8 1-1 1.2-.2.2-.4.2-.6.1-.3-.2-1.2-.5-2.3-1.4-.8-.7-1.4-1.6-1.6-1.9-.2-.3 0-.5.1-.6l.5-.6c.1-.2.2-.3.2-.5s0-.4-.1-.5c-.1-.2-.7-1.7-1-2.3-.3-.6-.5-.5-.7-.5H7.5c-.2 0-.5.1-.7.3s-.9.9-.9 2.3.9 2.7 1 2.9c.1.2 1.8 2.7 4.3 3.8.6.3 1.1.4 1.5.5.6.2 1.2.2 1.6.1.5-.1 1.5-.6 1.7-1.2s.2-1.1.1-1.2c-.1-.1-.3-.2-.6-.4zM12 2C6.5 2 2 6.5 2 12c0 1.9.5 3.6 1.4 5.1L2 22l5-1.3c1.5.8 3.2 1.3 5 1.3 5.5 0 10-4.5 10-10S17.5 2 12 2z" />
    </svg>
  );
}
