import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { listSubscriptions } from "@/lib/master.functions";

export const Route = createFileRoute("/master/assinaturas")({
  head: () => ({ meta: [{ title: "Assinaturas · Painel VYNKA" }, { name: "robots", content: "noindex" }] }),
  component: AssinaturasPage,
});

const LABEL: Record<string, string> = {
  trial: "Em teste", active: "Ativa", past_due: "Em atraso", suspended: "Suspensa", cancelled: "Cancelada",
};

function AssinaturasPage() {
  const fetch = useServerFn(listSubscriptions);
  const { data: subs = [] } = useQuery({ queryKey: ["master-subs"], queryFn: () => fetch({}) });

  return (
    <div className="min-h-svh px-8 py-10 md:px-12">
      <header className="mb-8">
        <h1 className="text-[22px] font-medium tracking-tight">Assinaturas</h1>
        <p className="mt-1 text-[13px] text-muted-foreground">Assinaturas ativas por loja.</p>
      </header>

      <div className="overflow-hidden rounded-lg border border-border bg-surface">
        <table className="w-full text-[13px]">
          <thead className="bg-muted/40 text-[11px] uppercase tracking-wider text-muted-foreground">
            <tr>
              <th className="px-4 py-3 text-left">Loja</th>
              <th className="px-4 py-3 text-left">Plano</th>
              <th className="px-4 py-3 text-left">Status</th>
              <th className="px-4 py-3 text-left">Início</th>
              <th className="px-4 py-3 text-left">Término</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {(subs as any[]).length === 0 && (
              <tr><td colSpan={5} className="px-4 py-10 text-center text-[12px] text-muted-foreground">Nenhuma assinatura.</td></tr>
            )}
            {(subs as any[]).map((s) => (
              <tr key={s.id}>
                <td className="px-4 py-3">{s.store?.name ?? "—"} <span className="ml-1 text-[11px] text-muted-foreground">/loja/{s.store?.slug}</span></td>
                <td className="px-4 py-3">{s.plan?.name ?? "—"}</td>
                <td className="px-4 py-3">{LABEL[s.status] ?? s.status}</td>
                <td className="px-4 py-3 text-muted-foreground">{new Date(s.starts_at).toLocaleDateString("pt-BR")}</td>
                <td className="px-4 py-3 text-muted-foreground">{s.ends_at ? new Date(s.ends_at).toLocaleDateString("pt-BR") : "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
