import { createFileRoute } from "@tanstack/react-router";
import { Tags, Plus } from "lucide-react";
import { PageShell, EmptyState } from "@/components/page-shell";

export const Route = createFileRoute("/admin/categorias")({
  head: () => ({
    meta: [
      { title: "Categorias · VYNKA" },
      { name: "description", content: "Organize seus produtos em categorias." },
    ],
  }),
  component: Categorias,
});

function Categorias() {
  return (
    <PageShell
      title="Categorias"
      description="Organize seus produtos em grupos claros para os clientes."
      actions={
        <button className="inline-flex items-center gap-1.5 rounded-md bg-primary px-4 py-2 text-[13px] font-medium text-primary-foreground transition-colors hover:bg-graphite">
          <Plus className="h-3.5 w-3.5" strokeWidth={1.75} />
          Nova categoria
        </button>
      }
    >
      <EmptyState
        icon={<Tags className="h-5 w-5" strokeWidth={1.5} />}
        title="Nenhuma categoria criada"
        description="Crie categorias personalizadas para organizar sua vitrine e facilitar a navegação dos clientes."
      />
    </PageShell>
  );
}
