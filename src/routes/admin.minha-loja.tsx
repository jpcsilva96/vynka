import { createFileRoute } from "@tanstack/react-router";
import { Store, ArrowUpRight, Link as LinkIcon } from "lucide-react";
import { PageShell } from "@/components/page-shell";

export const Route = createFileRoute("/minha-loja")({
  head: () => ({
    meta: [
      { title: "Minha Loja · VYNKA" },
      { name: "description", content: "Personalize sua loja pública." },
    ],
  }),
  component: MinhaLoja,
});

function MinhaLoja() {
  return (
    <PageShell
      title="Minha Loja"
      description="Personalize a identidade, o banner e o link da sua vitrine pública."
    >
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="rounded-lg border border-border bg-surface p-8 lg:col-span-2">
          <span className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
            Link público
          </span>
          <div className="mt-4 flex items-center gap-3 rounded-md border border-border bg-background px-4 py-3">
            <LinkIcon className="h-4 w-4 text-muted-foreground" strokeWidth={1.5} />
            <span className="flex-1 truncate text-[13px] text-foreground">
              vynka.com.br/minhaloja
            </span>
            <button className="text-[12px] text-muted-foreground hover:text-foreground">
              Copiar
            </button>
          </div>

          <div className="mt-10 grid grid-cols-1 gap-8 sm:grid-cols-2">
            {[
              { label: "Nome da loja", value: "Minha Loja" },
              { label: "Descrição", value: "—" },
              { label: "Redes sociais", value: "—" },
              { label: "Contato WhatsApp", value: "—" },
            ].map((f) => (
              <div key={f.label}>
                <div className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
                  {f.label}
                </div>
                <div className="mt-2 text-[14px] text-foreground">{f.value}</div>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-lg border border-border bg-surface p-8">
          <div className="mb-5 grid h-10 w-10 place-items-center rounded-full bg-muted text-muted-foreground">
            <Store className="h-4 w-4" strokeWidth={1.5} />
          </div>
          <h3 className="text-[15px] font-medium text-foreground">Vitrine pública</h3>
          <p className="mt-2 text-[13px] leading-relaxed text-muted-foreground">
            Uma página moderna e responsiva, pronta para compartilhar. Seus produtos e sua
            identidade — sem ruído.
          </p>
          <button className="mt-8 inline-flex items-center gap-1.5 text-[13px] font-medium text-foreground hover:opacity-70">
            Visualizar loja
            <ArrowUpRight className="h-3.5 w-3.5" strokeWidth={1.75} />
          </button>
        </div>
      </div>
    </PageShell>
  );
}
