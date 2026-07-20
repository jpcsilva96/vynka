import { createFileRoute } from "@tanstack/react-router";
import { PageShell, EmptyState } from "@/components/page-shell";
import { BarChart3 } from "lucide-react";

export const Route = createFileRoute("/admin/estatisticas")({
  head: () => ({ meta: [{ title: "Estatísticas · VYNKA" }] }),
  component: () => (
    <PageShell title="Estatísticas" description="Indicadores de vendas em breve.">
      <EmptyState
        icon={<BarChart3 className="h-5 w-5" strokeWidth={1.5} />}
        title="Em breve"
        description="Painéis de desempenho, produtos mais vendidos e tendências chegam em breve."
      />
    </PageShell>
  ),
});
