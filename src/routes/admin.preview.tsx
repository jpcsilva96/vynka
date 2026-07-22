import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft, ExternalLink } from "lucide-react";
import { useStoreContext } from "@/lib/store-context";

export const Route = createFileRoute("/admin/preview")({
  head: () => ({ meta: [{ title: "Pré-visualização · VYNKA" }] }),
  component: PreviewRoute,
});

function PreviewRoute() {
  const { currentStore } = useStoreContext();
  if (!currentStore) return null;
  const url = `/loja/${currentStore.slug}?preview=1`;
  return (
    <div className="flex min-h-svh flex-1 flex-col bg-background">
      <div className="flex items-center justify-between border-b border-border bg-surface px-6 py-3">
        <Link
          to="/admin/onboarding"
          className="inline-flex items-center gap-1.5 text-[13px] text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-3.5 w-3.5" strokeWidth={1.5} />
          Voltar ao onboarding
        </Link>
        <div className="text-[12px] uppercase tracking-[0.18em] text-muted-foreground">
          Modo de pré-visualização · não publicado
        </div>
        <a
          href={`/loja/${currentStore.slug}`}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-1.5 text-[13px] text-muted-foreground hover:text-foreground"
        >
          Abrir em nova aba
          <ExternalLink className="h-3.5 w-3.5" strokeWidth={1.5} />
        </a>
      </div>
      <iframe title="Pré-visualização da loja" src={url} className="flex-1 w-full border-0" />
    </div>
  );
}
