import { createFileRoute } from "@tanstack/react-router";
import { PageShell, EmptyState } from "@/components/page-shell";
import { UserCog } from "lucide-react";

export const Route = createFileRoute("/admin/usuarios")({
  head: () => ({ meta: [{ title: "Usuários · VYNKA" }] }),
  component: () => (
    <PageShell title="Usuários" description="Gestão da equipe da loja em breve.">
      <EmptyState
        icon={<UserCog className="h-5 w-5" strokeWidth={1.5} />}
        title="Em breve"
        description="Convite de vendedores, papéis e permissões estarão disponíveis em breve."
      />
    </PageShell>
  ),
});
