import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect } from "react";
import { ArrowUpRight, Package, ShoppingBag, Users, Eye, Loader2, CheckCircle2, Circle } from "lucide-react";
import { PageShell } from "@/components/page-shell";
import { useStoreContext } from "@/lib/store-context";
import {
  computeChecklist,
  getStoreFull,
  progressPercent,
} from "@/lib/onboarding";

export const Route = createFileRoute("/admin/")({
  head: () => ({
    meta: [
      { title: "Dashboard · VYNKA" },
      { name: "description", content: "Visão geral da sua loja VYNKA." },
    ],
  }),
  component: Dashboard,
});

const metrics = [
  { label: "Pedidos", value: "0", icon: ShoppingBag },
  { label: "Produtos", value: "0", icon: Package },
  { label: "Clientes", value: "0", icon: Users },
  { label: "Visitas na loja", value: "0", icon: Eye },
];

function Dashboard() {
  const { currentStore, loading } = useStoreContext();
  const navigate = useNavigate();

  useEffect(() => {
    if (loading || !currentStore) return;
    if (currentStore.onboarding_status !== "completed") {
      navigate({ to: "/admin/onboarding", replace: true });
    }
  }, [loading, currentStore, navigate]);

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

  if (loading || !currentStore) {
    return (
      <div className="grid min-h-svh w-full flex-1 place-items-center">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" strokeWidth={1.5} />
      </div>
    );
  }

  const incomplete = currentStore.onboarding_status !== "completed";
  const percent = checklist ? progressPercent(checklist) : 0;

  return (
    <PageShell title="Dashboard" description="Bem-vinda de volta. Aqui está o resumo da sua loja.">
      {incomplete && checklist && (
        <section className="mb-8 rounded-lg border border-border bg-foreground p-6 text-background md:p-8">
          <div className="flex flex-col justify-between gap-6 md:flex-row md:items-center">
            <div className="max-w-xl">
              <span className="text-[11px] uppercase tracking-[0.18em] text-background/50">
                Onboarding
              </span>
              <h2 className="mt-2 text-[20px] font-medium leading-tight">
                Termine de configurar sua loja
              </h2>
              <p className="mt-2 text-[13px] leading-relaxed text-background/60">
                Você concluiu {percent}%. Continue a partir da etapa em que parou para publicar
                seu catálogo.
              </p>
              <div className="mt-4 h-1 w-full overflow-hidden rounded-full bg-background/15">
                <div
                  className="h-full bg-background transition-all"
                  style={{ width: `${percent}%` }}
                />
              </div>
            </div>
            <Link
              to="/admin/onboarding"
              className="inline-flex items-center gap-1.5 self-start rounded-md bg-background px-4 py-2.5 text-[13px] font-medium text-foreground hover:opacity-90 md:self-auto"
            >
              Continuar configuração
              <ArrowUpRight className="h-3.5 w-3.5" strokeWidth={1.75} />
            </Link>
          </div>
        </section>
      )}

      <section className="grid grid-cols-1 gap-px overflow-hidden rounded-lg border border-border bg-border sm:grid-cols-2 lg:grid-cols-4">
        {metrics.map((m) => (
          <div key={m.label} className="bg-surface p-6">
            <div className="flex items-center justify-between text-muted-foreground">
              <span className="text-[12px] uppercase tracking-[0.14em]">{m.label}</span>
              <m.icon className="h-4 w-4" strokeWidth={1.5} />
            </div>
            <div className="mt-6">
              <span className="text-[32px] font-light tracking-tight text-foreground">
                {m.value}
              </span>
            </div>
          </div>
        ))}
      </section>

      <section className="mt-10 grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="rounded-lg border border-border bg-surface p-8 lg:col-span-2">
          <h2 className="text-[15px] font-medium text-foreground">Atividade recente</h2>
          <div className="mt-8 flex min-h-[220px] flex-col items-center justify-center border-t border-border pt-10 text-center">
            <p className="text-[13px] text-muted-foreground">
              Sua loja ainda não registrou atividade.
            </p>
          </div>
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
