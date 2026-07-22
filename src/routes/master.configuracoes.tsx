import { createFileRoute } from "@tanstack/react-router";
import { Settings } from "lucide-react";

export const Route = createFileRoute("/master/configuracoes")({
  head: () => ({ meta: [{ title: "Configurações · Painel VYNKA" }, { name: "robots", content: "noindex" }] }),
  component: () => (
    <div className="min-h-svh px-8 py-10 md:px-12">
      <header className="mb-8">
        <h1 className="text-[22px] font-medium tracking-tight">Configurações da plataforma</h1>
        <p className="mt-1 text-[13px] text-muted-foreground">Ajustes globais da VYNKA.</p>
      </header>
      <div className="grid place-items-center rounded-lg border border-dashed border-border bg-surface px-6 py-16 text-center">
        <Settings className="h-6 w-6 text-muted-foreground" strokeWidth={1.5} />
        <p className="mt-3 text-[13px] font-medium">Em breve</p>
        <p className="mt-1 max-w-sm text-[12px] text-muted-foreground">
          Configurações globais (identidade visual, faturamento, integrações) serão adicionadas nas próximas iterações.
        </p>
      </div>
    </div>
  ),
});
