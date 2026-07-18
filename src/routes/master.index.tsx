import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Store, ShoppingBag, Package, TrendingUp } from "lucide-react";
import { masterStats } from "@/lib/master.functions";

export const Route = createFileRoute("/master/")({
  head: () => ({ meta: [{ title: "Dashboard · Painel VYNKA" }, { name: "robots", content: "noindex" }] }),
  component: MasterDashboard,
});

function MasterDashboard() {
  const fetchStats = useServerFn(masterStats);
  const { data } = useQuery({ queryKey: ["master-stats"], queryFn: () => fetchStats({}) });

  const cards = [
    { label: "Lojas totais", value: data?.total_stores ?? 0, icon: Store },
    { label: "Ativas", value: data?.by_status.active ?? 0, icon: TrendingUp },
    { label: "Em teste", value: data?.by_status.trial ?? 0, icon: Store },
    { label: "Suspensas", value: data?.by_status.suspended ?? 0, icon: Store },
    { label: "Produtos", value: data?.total_products ?? 0, icon: Package },
    { label: "Pedidos", value: data?.total_orders ?? 0, icon: ShoppingBag },
  ];

  return (
    <div className="min-h-svh px-8 py-10 md:px-12">
      <header className="mb-10">
        <h1 className="text-[22px] font-medium tracking-tight">Visão geral da plataforma</h1>
        <p className="mt-1 text-[13px] text-muted-foreground">Métricas consolidadas de todas as lojas VYNKA.</p>
      </header>

      <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-3">
        {cards.map((c) => (
          <div key={c.label} className="rounded-lg border border-border bg-surface p-5">
            <div className="flex items-center justify-between">
              <span className="text-[12px] text-muted-foreground">{c.label}</span>
              <c.icon className="h-3.5 w-3.5 text-muted-foreground" strokeWidth={1.5} />
            </div>
            <div className="mt-3 text-[28px] font-light tracking-tight">{c.value}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
