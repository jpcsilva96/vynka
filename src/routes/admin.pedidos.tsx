import { createFileRoute } from "@tanstack/react-router";
import { ShoppingBag } from "lucide-react";
import { PageShell, EmptyState } from "@/components/page-shell";

export const Route = createFileRoute("/pedidos")({
  head: () => ({
    meta: [
      { title: "Pedidos · VYNKA" },
      { name: "description", content: "Acompanhe os pedidos da sua loja." },
    ],
  }),
  component: Pedidos,
});

function Pedidos() {
  return (
    <PageShell
      title="Pedidos"
      description="Acompanhe pedidos recebidos pelo site ou pelo WhatsApp."
    >
      <div className="mb-6 flex flex-wrap gap-1 border-b border-border">
        {["Todos", "Novo", "Em atendimento", "Concluído", "Cancelado"].map((s, i) => (
          <button
            key={s}
            className={`px-3 py-2 text-[13px] transition-colors ${
              i === 0
                ? "border-b border-foreground text-foreground"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {s}
          </button>
        ))}
      </div>

      <EmptyState
        icon={<ShoppingBag className="h-5 w-5" strokeWidth={1.5} />}
        title="Nenhum pedido ainda"
        description="Quando seus clientes finalizarem uma compra pelo site ou pelo WhatsApp, os pedidos aparecerão aqui."
      />
    </PageShell>
  );
}
