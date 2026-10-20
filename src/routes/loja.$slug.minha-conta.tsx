import { createFileRoute, Link, Outlet, useNavigate, useRouterState } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { ChevronLeft, ChevronRight, Heart, MapPin, Package, UserRound } from "lucide-react";
import { useEffect } from "react";
import { signOutCustomer, useStoreCustomer } from "@/lib/customer-account";
import { useStorefront } from "@/lib/storefront-context";
import { cn } from "@/lib/utils";

// Minha conta (catálogo lote 5, §9): Meus dados · Meus endereços · Minhas compras · Favoritos, cada um
// na sua página. No celular, /minha-conta é a lista das quatro e cada página tem "voltar"; no
// computador, a lista fica ao lado.
export const Route = createFileRoute("/loja/$slug/minha-conta")({
  component: CustomerAccountLayout,
});

const ACCOUNT_SECTIONS = [
  {
    to: "/loja/$slug/minha-conta/dados",
    label: "Meus dados",
    hint: "Nome, telefone e senha",
    Icon: UserRound,
  },
  {
    to: "/loja/$slug/minha-conta/enderecos",
    label: "Meus endereços",
    hint: "Onde você recebe as compras",
    Icon: MapPin,
  },
  {
    to: "/loja/$slug/minha-conta/compras",
    label: "Minhas compras",
    hint: "Pedidos e situação da entrega",
    Icon: Package,
  },
  {
    to: "/loja/$slug/minha-conta/favoritos",
    label: "Favoritos",
    hint: "Produtos salvos para ver depois",
    Icon: Heart,
  },
] as const;

function CustomerAccountLayout() {
  const store = useStorefront();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { data: customer, isLoading } = useStoreCustomer(store.id);
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  const onHub = /\/minha-conta\/?$/.test(pathname);

  useEffect(() => {
    if (!isLoading && !customer) {
      navigate({ to: "/loja/$slug/entrar", params: { slug: store.slug } });
    }
  }, [customer, isLoading, navigate, store.slug]);

  // Sai da página antes de encerrar a sessão: senão a própria página manda para "Entrar".
  const logout = async () => {
    await navigate({ to: "/loja/$slug", params: { slug: store.slug } });
    await signOutCustomer(store.id);
    await queryClient.invalidateQueries({ queryKey: ["store-customer", store.id] });
  };

  if (isLoading || !customer) return <div className="min-h-[60vh]" />;

  return (
    <div className="mx-auto max-w-[1280px] px-4 py-8 md:px-8 md:py-14">
      <div className={cn("border-b border-black/10 pb-6 md:block md:pb-8", !onHub && "hidden")}>
        <div className="text-[11px] font-medium uppercase tracking-[0.24em] text-neutral-500">
          {store.name}
        </div>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight text-black md:text-4xl">
          Minha conta
        </h1>
        <p className="mt-2 break-words text-[14px] text-neutral-500">
          {customer.name}
          {customer.email ? ` · ${customer.email}` : ""}
        </p>
      </div>

      <div
        className={cn(
          "md:grid md:grid-cols-[240px_minmax(0,1fr)] md:gap-10 md:pt-8",
          onHub && "md:block",
        )}
      >
        {onHub ? null : (
          <nav aria-label="Minha conta" className="hidden md:block">
            <ul className="grid gap-1">
              {ACCOUNT_SECTIONS.map((section) => {
                const active = pathname.endsWith(section.to.split("/").pop()!);
                return (
                  <li key={section.to}>
                    <Link
                      to={section.to}
                      params={{ slug: store.slug }}
                      aria-current={active ? "page" : undefined}
                      className={cn(
                        "flex min-h-11 items-center gap-3 px-3 text-[14px] text-neutral-600 hover:bg-black/5 hover:text-black",
                        active && "bg-black/5 font-semibold text-black",
                      )}
                    >
                      <section.Icon className="h-4 w-4 shrink-0" strokeWidth={1.7} />
                      {section.label}
                    </Link>
                  </li>
                );
              })}
              <li>
                <button
                  type="button"
                  onClick={logout}
                  className="flex min-h-11 w-full items-center px-3 text-left text-[14px] text-neutral-600 hover:bg-black/5 hover:text-black"
                >
                  Sair
                </button>
              </li>
            </ul>
          </nav>
        )}

        <div className="min-w-0">
          {!onHub && (
            <Link
              to="/loja/$slug/minha-conta"
              params={{ slug: store.slug }}
              className="-ml-1 mb-4 inline-flex min-h-11 items-center gap-1 text-[12px] font-medium uppercase tracking-[0.16em] text-neutral-500 hover:text-black md:hidden"
            >
              <ChevronLeft className="h-4 w-4" /> Minha conta
            </Link>
          )}
          {onHub ? <AccountHub onLogout={logout} /> : <Outlet />}
        </div>
      </div>
    </div>
  );
}

function AccountHub({ onLogout }: { onLogout: () => void }) {
  const store = useStorefront();
  return (
    <div className="pt-6 md:pt-8">
      <ul className="grid gap-3 sm:grid-cols-2">
        {ACCOUNT_SECTIONS.map((section) => (
          <li key={section.to}>
            <Link
              to={section.to}
              params={{ slug: store.slug }}
              className="flex min-h-[72px] items-center gap-4 border border-black/10 bg-white px-4 py-3 hover:border-black"
            >
              <section.Icon className="h-5 w-5 shrink-0 text-black" strokeWidth={1.6} />
              <span className="min-w-0 flex-1">
                <span className="block text-[15px] font-semibold text-black">{section.label}</span>
                <span className="block text-[12px] text-neutral-500">{section.hint}</span>
              </span>
              <ChevronRight className="h-4 w-4 shrink-0 text-neutral-500" />
            </Link>
          </li>
        ))}
      </ul>
      <button
        type="button"
        onClick={onLogout}
        className="mt-6 h-12 w-full border border-black px-5 text-[12px] font-semibold uppercase tracking-[0.16em] text-black hover:bg-black hover:text-white sm:w-max"
      >
        Sair da conta
      </button>
    </div>
  );
}
