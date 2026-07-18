import { createFileRoute } from "@tanstack/react-router";
import { PageShell } from "@/components/page-shell";

export const Route = createFileRoute("/admin/configuracoes")({
  head: () => ({
    meta: [
      { title: "Configurações · VYNKA" },
      { name: "description", content: "Preferências da sua conta e da sua loja." },
    ],
  }),
  component: Configuracoes,
});

const sections = [
  { title: "Conta", desc: "Dados de acesso, e-mail e senha." },
  { title: "Loja", desc: "Nome, domínio e informações públicas." },
  { title: "Pagamentos", desc: "Formas de pagamento aceitas na sua loja." },
  { title: "Notificações", desc: "Como você quer ser avisada sobre novos pedidos." },
  { title: "Integrações", desc: "WhatsApp e futuras conexões." },
];

function Configuracoes() {
  return (
    <PageShell
      title="Configurações"
      description="Ajuste as preferências da sua conta e da sua loja."
    >
      <div className="overflow-hidden rounded-lg border border-border bg-surface">
        {sections.map((s, i) => (
          <button
            key={s.title}
            className={`flex w-full items-center justify-between px-6 py-5 text-left transition-colors hover:bg-muted/40 ${
              i > 0 ? "border-t border-border" : ""
            }`}
          >
            <div>
              <div className="text-[14px] font-medium text-foreground">{s.title}</div>
              <div className="mt-0.5 text-[13px] text-muted-foreground">{s.desc}</div>
            </div>
            <span className="text-muted-foreground">→</span>
          </button>
        ))}
      </div>
    </PageShell>
  );
}
