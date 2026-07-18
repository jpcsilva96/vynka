import { createFileRoute } from "@tanstack/react-router";
import { ArrowUpRight, Package, ShoppingBag, Users, Eye } from "lucide-react";
import { PageShell } from "@/components/page-shell";

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
  { label: "Pedidos", value: "0", delta: "—", icon: ShoppingBag },
  { label: "Produtos", value: "0", delta: "—", icon: Package },
  { label: "Clientes", value: "0", delta: "—", icon: Users },
  { label: "Visitas na loja", value: "0", delta: "—", icon: Eye },
];

function Dashboard() {
  return (
    <PageShell
      title="Dashboard"
      description="Bem-vinda de volta. Aqui está o resumo da sua loja."
    >
      <section className="grid grid-cols-1 gap-px overflow-hidden rounded-lg border border-border bg-border sm:grid-cols-2 lg:grid-cols-4">
        {metrics.map((m) => (
          <div key={m.label} className="bg-surface p-6">
            <div className="flex items-center justify-between text-muted-foreground">
              <span className="text-[12px] uppercase tracking-[0.14em]">{m.label}</span>
              <m.icon className="h-4 w-4" strokeWidth={1.5} />
            </div>
            <div className="mt-6 flex items-baseline justify-between">
              <span className="text-[32px] font-light tracking-tight text-foreground">
                {m.value}
              </span>
              <span className="text-[12px] text-muted-foreground">{m.delta}</span>
            </div>
          </div>
        ))}
      </section>

      <section className="mt-10 grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="rounded-lg border border-border bg-surface p-8 lg:col-span-2">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-[15px] font-medium text-foreground">Atividade recente</h2>
              <p className="mt-1 text-[13px] text-muted-foreground">
                Pedidos, novos clientes e movimentações da sua loja.
              </p>
            </div>
            <button className="inline-flex items-center gap-1 text-[13px] text-muted-foreground hover:text-foreground">
              Ver tudo
              <ArrowUpRight className="h-3.5 w-3.5" strokeWidth={1.5} />
            </button>
          </div>

          <div className="mt-10 flex min-h-[220px] flex-col items-center justify-center border-t border-border pt-10 text-center">
            <p className="text-[13px] text-muted-foreground">
              Sua loja ainda não registrou atividade.
            </p>
            <p className="mt-1 text-[12px] text-muted-foreground/70">
              Cadastre seus primeiros produtos para começar.
            </p>
          </div>
        </div>

        <div className="rounded-lg border border-border bg-foreground p-8 text-background">
          <span className="text-[11px] uppercase tracking-[0.18em] text-background/50">
            Sua loja
          </span>
          <h3 className="mt-3 text-[18px] font-medium leading-snug">
            Publique seu catálogo em minutos.
          </h3>
          <p className="mt-2 text-[13px] leading-relaxed text-background/60">
            Configure sua identidade, adicione produtos e compartilhe o link exclusivo da
            sua loja.
          </p>
          <button className="mt-8 inline-flex items-center gap-1.5 rounded-md bg-background px-4 py-2 text-[13px] font-medium text-foreground transition-opacity hover:opacity-90">
            Começar
            <ArrowUpRight className="h-3.5 w-3.5" strokeWidth={1.75} />
          </button>
        </div>
      </section>
    </PageShell>
  );
}
