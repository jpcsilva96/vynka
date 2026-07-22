import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Check } from "lucide-react";
import { listPlans } from "@/lib/master.functions";

export const Route = createFileRoute("/master/planos")({
  head: () => ({ meta: [{ title: "Planos · Painel VYNKA" }, { name: "robots", content: "noindex" }] }),
  component: PlanosPage,
});

function PlanosPage() {
  const fetchPlans = useServerFn(listPlans);
  const { data: plans = [] } = useQuery({ queryKey: ["master-plans"], queryFn: () => fetchPlans({}) });

  return (
    <div className="min-h-svh px-8 py-10 md:px-12">
      <header className="mb-8">
        <h1 className="text-[22px] font-medium tracking-tight">Planos</h1>
        <p className="mt-1 text-[13px] text-muted-foreground">Planos comerciais disponíveis na plataforma.</p>
      </header>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {(plans as any[]).map((p) => (
          <div key={p.id} className="rounded-lg border border-border bg-surface p-6">
            <h3 className="text-[15px] font-medium">{p.name}</h3>
            <p className="mt-1 text-[12px] text-muted-foreground">{p.description}</p>
            <ul className="mt-5 space-y-2 text-[12px]">
              <Feat on={true}>{p.max_products} produtos</Feat>
              <Feat on={true}>{p.max_users} usuários</Feat>
              <Feat on={p.allow_whatsapp_orders}>Pedidos pelo WhatsApp</Feat>
              <Feat on={p.allow_site_orders}>Pedidos pelo site</Feat>
              <Feat on={p.allow_custom_domain}>Domínio próprio</Feat>
            </ul>
          </div>
        ))}
      </div>
    </div>
  );
}

function Feat({ on, children }: { on: boolean; children: React.ReactNode }) {
  return (
    <li className={on ? "flex items-center gap-2" : "flex items-center gap-2 text-muted-foreground line-through"}>
      <Check className={on ? "h-3 w-3" : "h-3 w-3 opacity-30"} strokeWidth={2} />
      {children}
    </li>
  );
}
