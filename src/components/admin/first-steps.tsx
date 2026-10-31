import { Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CheckCircle2, Circle, ExternalLink, Loader2 } from "lucide-react";
import type { ReactNode } from "react";
import {
  canPublish,
  computeChecklist,
  getStoreFull,
  publishStore,
  type Checklist,
} from "@/lib/onboarding";
import { useStoreContext } from "@/lib/store-context";
import { cn } from "@/lib/utils";

// Roteiro de primeiros passos + Publicar (D13). Fica em "Loja e Catálogo" (aba Loja) e no Dashboard
// enquanto a loja não está no ar. Publicar exige produto ativo e Mercado Pago (canPublish); logo, tema
// e banner são recomendados. Lê a loja do banco, por isso a aba Loja pede para salvar antes.

type Step = {
  key: keyof Checklist;
  title: string;
  text: string;
  required: boolean;
  action: string;
  href: string;
};

const steps: Step[] = [
  {
    key: "hasLogo",
    title: "Logo",
    text: "Coloque o logo da loja. Sem logo, o nome aparece no lugar.",
    required: false,
    action: "Enviar logo",
    href: "/admin/editor-layout?secao=brand",
  },
  {
    key: "hasTheme",
    title: "Tema",
    text: "Escolha as cores e as letras da loja num tema pronto e publique no editor.",
    required: false,
    action: "Escolher tema",
    href: "/admin/editor-layout?secao=themes",
  },
  {
    key: "hasBanner",
    title: "Banner",
    text: "Coloque a imagem de destaque do topo da página inicial.",
    required: false,
    action: "Colocar banner",
    href: "/admin/editor-layout?secao=home",
  },
  {
    key: "hasActiveProduct",
    title: "Primeiro produto",
    text: "Cadastre pelo menos um produto ativo, com foto e preço.",
    required: true,
    action: "Cadastrar produto",
    href: "/admin/produtos/novo",
  },
  {
    key: "hasPayment",
    title: "Mercado Pago",
    text: "Conecte sua conta para receber Pix e cartão. Sem ele, a loja não recebe pedidos.",
    required: true,
    action: "Conectar",
    href: "/admin/configuracoes?aba=pagamentos",
  },
];

export function FirstStepsCard({
  storeId,
  hasUnsavedChanges = false,
  onOpenPayments,
  hideWhenPublished = false,
  className,
}: {
  storeId: string;
  hasUnsavedChanges?: boolean;
  /** Em "Loja e Catálogo" o passo do Mercado Pago troca de aba em vez de recarregar a página. */
  onOpenPayments?: () => void;
  hideWhenPublished?: boolean;
  className?: string;
}) {
  const { refresh } = useStoreContext();
  const queryClient = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: ["store-publication", storeId],
    queryFn: async () => {
      const store = await getStoreFull(storeId);
      if (!store) return null;
      return { store, checklist: await computeChecklist(store) };
    },
    enabled: !!storeId,
  });
  const publishMutation = useMutation({
    mutationFn: () => publishStore(storeId),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["store-publication", storeId] }),
        refresh(),
      ]);
    },
  });

  if (isLoading || !data) return null;
  const { store, checklist } = data;
  const published = store.publication_status === "published";
  const publicPath = `/loja/${store.slug}`;

  if (published) {
    if (hideWhenPublished) return null;
    return (
      <section
        className={cn("rounded-lg border border-border bg-surface p-6 shadow-sm", className)}
      >
        <div className="flex items-center gap-2">
          <span className="h-2 w-2 shrink-0 rounded-full bg-emerald-500" />
          <h3 className="text-[16px] font-semibold text-foreground">Seu catálogo está no ar</h3>
        </div>
        <p className="mt-1 text-[12px] leading-relaxed text-muted-foreground">
          Clientes já podem ver a loja e comprar pelo link abaixo.
        </p>
        <a
          href={publicPath}
          target="_blank"
          rel="noreferrer"
          className="mt-2 inline-flex items-center gap-1 text-[12px] font-medium text-foreground hover:underline"
        >
          {publicPath}
          <ExternalLink className="h-3 w-3" strokeWidth={1.5} />
        </a>
      </section>
    );
  }

  const ready = canPublish(checklist);
  const done = steps.filter((step) => checklist[step.key]).length;
  const missing = [
    !(checklist.hasName && checklist.hasSlug) && "nome e link da loja (aba Loja)",
    !checklist.hasActiveProduct && "um produto ativo",
    !checklist.hasPayment && "conectar o Mercado Pago",
  ].filter(Boolean) as string[];

  return (
    <section
      className={cn(
        "rounded-lg border border-foreground/30 bg-surface p-5 shadow-sm md:p-6",
        className,
      )}
    >
      <div className="flex items-center gap-2">
        <span className="h-2 w-2 shrink-0 rounded-full bg-amber-500" />
        <h3 className="text-[16px] font-semibold text-foreground">Primeiros passos da sua loja</h3>
      </div>
      <p className="mt-1 text-[12px] leading-relaxed text-muted-foreground">
        Sua loja ainda não está no ar. Siga os passos abaixo e publique: {done} de {steps.length}{" "}
        feitos.
      </p>

      <ol className="mt-4 divide-y divide-border border-y border-border">
        {steps.map((step, index) => {
          const ok = checklist[step.key];
          const button =
            step.key === "hasPayment" && onOpenPayments ? (
              <StepButton onClick={onOpenPayments}>{step.action}</StepButton>
            ) : step.href.startsWith("/admin/produtos") ? (
              <Link to="/admin/produtos/novo" className={stepButtonClass}>
                {step.action}
              </Link>
            ) : (
              <a href={step.href} className={stepButtonClass}>
                {step.action}
              </a>
            );
          return (
            <li key={step.key} className="flex items-start gap-3 py-3">
              {ok ? (
                <CheckCircle2
                  className="mt-0.5 h-5 w-5 shrink-0 text-foreground"
                  strokeWidth={1.5}
                />
              ) : (
                <Circle
                  className="mt-0.5 h-5 w-5 shrink-0 text-muted-foreground"
                  strokeWidth={1.5}
                />
              )}
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
                  <span className="text-[13px] font-medium text-foreground">
                    {index + 1}. {step.title}
                  </span>
                  <span className="text-[11px] text-muted-foreground">
                    {ok ? "Feito" : step.required ? "Obrigatório para publicar" : "Recomendado"}
                  </span>
                </div>
                <p className="mt-0.5 text-[12px] leading-relaxed text-muted-foreground">
                  {step.text}
                </p>
              </div>
              {!ok && <div className="shrink-0">{button}</div>}
            </li>
          );
        })}
      </ol>

      <div className="mt-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <p className="text-[12px] text-muted-foreground">
          {!ready
            ? `Para publicar, falta: ${missing.join(", ")}.`
            : hasUnsavedChanges
              ? "Salve as alterações desta página antes de publicar."
              : "Tudo pronto para publicar."}
        </p>
        <button
          type="button"
          disabled={!ready || hasUnsavedChanges || publishMutation.isPending}
          onClick={() => publishMutation.mutate()}
          className="inline-flex min-h-11 shrink-0 items-center justify-center gap-2 rounded-md bg-primary px-5 py-3 text-[13px] font-semibold text-primary-foreground transition-colors hover:bg-graphite disabled:opacity-50"
        >
          {publishMutation.isPending && (
            <Loader2 className="h-4 w-4 animate-spin" strokeWidth={1.5} />
          )}
          Publicar catálogo
        </button>
      </div>
      {publishMutation.error && (
        <p className="mt-3 text-[12px] text-red-700">
          {publishMutation.error instanceof Error
            ? publishMutation.error.message
            : "Não foi possível publicar."}
        </p>
      )}
    </section>
  );
}

const stepButtonClass =
  "inline-flex min-h-9 items-center rounded-md border border-border bg-background px-3 py-1.5 text-[12px] font-medium text-foreground transition-colors hover:bg-muted";

function StepButton({ onClick, children }: { onClick: () => void; children: ReactNode }) {
  return (
    <button type="button" onClick={onClick} className={stepButtonClass}>
      {children}
    </button>
  );
}
