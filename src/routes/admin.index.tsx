import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect } from "react";
import {
  ArrowUpRight,
  Package,
  ShoppingBag,
  Users,
  Wallet,
  Eye,
  Loader2,
  CheckCircle2,
  Circle,
} from "lucide-react";
import { PageShell } from "@/components/page-shell";
import { useStoreContext } from "@/lib/store-context";
import { computeChecklist, getStoreFull, progressPercent } from "@/lib/onboarding";
import { isProvisionalName } from "@/lib/provisional-store";
import { getDashboardData } from "@/lib/dashboard";
import { orderStatusClass, orderStatusLabel } from "@/lib/orders";
import { formatBRL } from "@/lib/products";

export const Route = createFileRoute("/admin/")({
  head: () => ({
    meta: [
      { title: "Dashboard · VYNKA" },
      { name: "description", content: "Visão geral da sua loja VYNKA." },
    ],
  }),
  component: Dashboard,
});

function Dashboard() {
  const { currentStore, loading, user, isPlatformAdmin } = useStoreContext();
  const navigate = useNavigate();

  // Dono que ainda não completou o cadastro (loja com nome provisório) volta para /boas-vindas.
  // O catálogo é opcional: o painel funciona sem ele estar configurado ou publicado.
  useEffect(() => {
    if (loading || !currentStore || isPlatformAdmin) return;
    if (user?.user_metadata?.signup_completed !== true && isProvisionalName(currentStore.name)) {
      navigate({ to: "/boas-vindas", replace: true });
    }
  }, [loading, currentStore, user, isPlatformAdmin, navigate]);

  const { data: store } = useQuery({
    queryKey: ["store-full-dash", currentStore?.id],
    queryFn: () => getStoreFull(currentStore!.id),
    enabled: !!currentStore,
  });

  const { data: checklist } = useQuery({
    queryKey: ["store-checklist", store?.id],
    queryFn: () => computeChecklist(store!),
    enabled: !!store,
  });

  const { data: dash, isError: dashError } = useQuery({
    queryKey: ["dashboard", currentStore?.id],
    queryFn: () => getDashboardData(currentStore!.id),
    enabled: !!currentStore,
  });

  if (loading || !currentStore) {
    return (
      <div className="grid min-h-svh w-full flex-1 place-items-center">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" strokeWidth={1.5} />
      </div>
    );
  }

  const incomplete = currentStore.publication_status !== "published";
  const percent = checklist ? progressPercent(checklist) : 0;
  const monthName = new Date().toLocaleDateString("pt-BR", { month: "long" });
  const pending = dash ? null : dashError ? "—" : "…";
  const metrics = [
    {
      label: "Vendas do mês",
      value: pending ?? formatBRL(dash!.monthRevenue),
      hint: dash
        ? `${dash.monthSales} ${dash.monthSales === 1 ? "venda concluída" : "vendas concluídas"} · lucro ${formatBRL(dash.monthProfit)}`
        : `Concluídas em ${monthName}`,
      icon: Wallet,
    },
    {
      label: "Visitas no mês",
      value: pending ?? String(dash!.monthViews),
      hint: "1 por aparelho por dia; você não conta",
      icon: Eye,
    },
    {
      label: "Pedidos em aberto",
      value: pending ?? String(dash!.openOrders),
      hint: "Ainda não concluídos nem cancelados",
      icon: ShoppingBag,
    },
    {
      label: "Produtos ativos",
      value: pending ?? String(dash!.activeProducts),
      hint: "Visíveis no catálogo",
      icon: Package,
    },
    {
      label: "Clientes",
      value: pending ?? String(dash!.customers),
      hint: "Cadastrados na loja",
      icon: Users,
    },
  ];

  return (
    <PageShell title="Dashboard" description="Bem-vinda de volta. Aqui está o resumo da sua loja.">
      {incomplete && checklist && (
        <section className="mb-8 rounded-lg border border-border bg-foreground p-6 text-background md:p-8">
          <div className="flex flex-col justify-between gap-6 md:flex-row md:items-center">
            <div className="max-w-xl">
              <span className="text-[11px] uppercase tracking-[0.18em] text-background/50">
                Catálogo
              </span>
              <h2 className="mt-2 text-[20px] font-medium leading-tight">
                Seu catálogo ainda não está no ar
              </h2>
              <p className="mt-2 text-[13px] leading-relaxed text-background/60">
                Você concluiu {percent}%. Quando quiser, configure e publique seu catálogo em Loja e
                Catálogo.
              </p>
              <div className="mt-4 h-1 w-full overflow-hidden rounded-full bg-background/15">
                <div
                  className="h-full bg-background transition-all"
                  style={{ width: `${percent}%` }}
                />
              </div>
            </div>
            <Link
              to="/admin/configuracoes"
              className="inline-flex items-center gap-1.5 self-start rounded-md bg-background px-4 py-2.5 text-[13px] font-medium text-foreground hover:opacity-90 md:self-auto"
            >
              Ir para Loja e Catálogo
              <ArrowUpRight className="h-3.5 w-3.5" strokeWidth={1.75} />
            </Link>
          </div>
        </section>
      )}

      <section className="grid grid-cols-1 gap-px overflow-hidden rounded-lg border border-border bg-border sm:grid-cols-2 lg:grid-cols-6 xl:grid-cols-5">
        {/* 5 cards sem buraco: sm 1+2+2, lg 2+3, xl 5 em linha. */}
        {metrics.map((m, i) => (
          <div
            key={m.label}
            className={`bg-surface p-6 xl:col-span-1 ${
              i === 0 ? "sm:col-span-2 lg:col-span-3" : i === 1 ? "lg:col-span-3" : "lg:col-span-2"
            }`}
          >
            <div className="flex items-center justify-between text-muted-foreground">
              <span className="text-[12px] uppercase tracking-[0.14em]">{m.label}</span>
              <m.icon className="h-4 w-4" strokeWidth={1.5} />
            </div>
            <div className="mt-6">
              <span className="text-[32px] font-light tracking-tight text-foreground">
                {m.value}
              </span>
              <p className="mt-1 text-[12px] text-muted-foreground">{m.hint}</p>
            </div>
          </div>
        ))}
      </section>

      <section className="mt-10 grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="rounded-lg border border-border bg-surface p-8 lg:col-span-2">
          <div className="flex items-center justify-between">
            <h2 className="text-[15px] font-medium text-foreground">Últimos pedidos</h2>
            <Link
              to="/admin/pedidos"
              className="text-[12px] text-muted-foreground hover:text-foreground"
            >
              Ver todos
            </Link>
          </div>
          {dash && dash.recentOrders.length > 0 ? (
            <ul className="mt-6 divide-y divide-border border-t border-border">
              {dash.recentOrders.map((order) => (
                <li key={order.id}>
                  <Link
                    to="/admin/pedidos/$id"
                    params={{ id: order.id }}
                    className="flex items-center gap-4 py-3 hover:bg-muted/40"
                  >
                    <span className="w-14 shrink-0 text-[13px] text-muted-foreground">
                      {order.number ? `#${order.number}` : "—"}
                    </span>
                    <span className="min-w-0 flex-1 truncate text-[13px] text-foreground">
                      {order.customerName ?? "Sem cliente"}
                      <span className="ml-2 text-muted-foreground">
                        {new Date(order.created_at).toLocaleDateString("pt-BR")}
                      </span>
                    </span>
                    <span
                      className={`rounded px-2 py-0.5 text-[11px] ${orderStatusClass(order.status)}`}
                    >
                      {orderStatusLabel(order.status)}
                    </span>
                    <span className="w-24 shrink-0 text-right text-[13px] text-foreground">
                      {formatBRL(order.total)}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <div className="mt-8 flex min-h-[220px] flex-col items-center justify-center border-t border-border pt-10 text-center">
              <p className="text-[13px] text-muted-foreground">
                {dashError
                  ? "Não foi possível carregar os pedidos."
                  : dash
                    ? "Sua loja ainda não registrou pedidos."
                    : "Carregando..."}
              </p>
            </div>
          )}
        </div>

        <div className="rounded-lg border border-border bg-surface p-8">
          <span className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
            Checklist
          </span>
          <ul className="mt-4 space-y-3 text-[13px]">
            {checklist &&
              [
                ["Dados da loja preenchidos", checklist.hasName],
                ["Logo enviada", checklist.hasLogo],
                ["WhatsApp ou site configurado", checklist.hasWhatsAppOrSite],
                ["Pelo menos um produto ativo", checklist.hasActiveProduct],
                ["Slug válido", checklist.hasSlug],
                ["Forma de pedido configurada", checklist.hasOrderChannel],
              ].map(([label, ok]) => (
                <li key={label as string} className="flex items-center gap-2">
                  {ok ? (
                    <CheckCircle2 className="h-4 w-4 text-foreground" strokeWidth={1.5} />
                  ) : (
                    <Circle className="h-4 w-4 text-muted-foreground" strokeWidth={1.5} />
                  )}
                  <span className={ok ? "text-foreground" : "text-muted-foreground"}>{label}</span>
                </li>
              ))}
          </ul>
        </div>
      </section>
    </PageShell>
  );
}
