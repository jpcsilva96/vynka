import { createFileRoute } from "@tanstack/react-router";
import { Users } from "lucide-react";
import { PageShell, EmptyState } from "@/components/page-shell";

export const Route = createFileRoute("/clientes")({
  head: () => ({
    meta: [
      { title: "Clientes · VYNKA" },
      { name: "description", content: "Base de clientes da sua loja." },
    ],
  }),
  component: Clientes,
});

function Clientes() {
  return (
    <PageShell
      title="Clientes"
      description="Sua base é cadastrada automaticamente a cada pedido."
    >
      <EmptyState
        icon={<Users className="h-5 w-5" strokeWidth={1.5} />}
        title="Nenhum cliente cadastrado"
        description="Seus clientes serão adicionados aqui automaticamente conforme fizerem pedidos na sua loja."
      />
    </PageShell>
  );
}
