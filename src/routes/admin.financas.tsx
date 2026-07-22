import { createFileRoute } from "@tanstack/react-router";
import { PageShell, EmptyState } from "@/components/page-shell";
import { Wallet } from "lucide-react";

export const Route = createFileRoute("/admin/financas")({
  head: () => ({ meta: [{ title: "Finanças · VYNKA" }] }),
  component: () => (
    <PageShell title="Finanças" description="Fluxo de caixa e recebíveis em breve.">
      <EmptyState
        icon={<Wallet className="h-5 w-5" strokeWidth={1.5} />}
        title="Em breve"
        description="Estamos preparando o módulo financeiro completo, com fluxo de caixa, recebíveis e relatórios."
      />
    </PageShell>
  ),
});
