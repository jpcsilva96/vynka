import { createFileRoute } from "@tanstack/react-router";
import { PageShell, EmptyState } from "@/components/page-shell";
import { History } from "lucide-react";

export const Route = createFileRoute("/admin/historico")({
  head: () => ({ meta: [{ title: "Histórico · VYNKA" }] }),
  component: () => (
    <PageShell title="Histórico" description="Relatório completo de vendas em breve.">
      <EmptyState
        icon={<History className="h-5 w-5" strokeWidth={1.5} />}
        title="Em breve"
        description="Visualização completa do histórico de vendas e movimentações estará disponível em breve. Por enquanto, todas as vendas registradas aparecem em Pedidos."
      />
    </PageShell>
  ),
});
