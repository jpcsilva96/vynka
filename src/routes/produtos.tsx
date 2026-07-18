import { createFileRoute } from "@tanstack/react-router";
import { Package, Plus } from "lucide-react";
import { PageShell, EmptyState } from "@/components/page-shell";

export const Route = createFileRoute("/produtos")({
  head: () => ({
    meta: [
      { title: "Produtos · VYNKA" },
      { name: "description", content: "Cadastre e organize os produtos da sua loja." },
    ],
  }),
  component: Produtos,
});

function Produtos() {
  return (
    <PageShell
      title="Produtos"
      description="Gerencie o catálogo, variações e destaques da sua loja."
      actions={
        <button className="inline-flex items-center gap-1.5 rounded-md bg-primary px-4 py-2 text-[13px] font-medium text-primary-foreground transition-colors hover:bg-graphite">
          <Plus className="h-3.5 w-3.5" strokeWidth={1.75} />
          Novo produto
        </button>
      }
    >
      <EmptyState
        icon={<Package className="h-5 w-5" strokeWidth={1.5} />}
        title="Nenhum produto cadastrado"
        description="Comece adicionando seu primeiro produto. Nome, preço, fotos e variações — tudo em poucos minutos."
      />
    </PageShell>
  );
}
