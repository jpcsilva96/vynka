import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useRef, useState } from "react";
import { Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { finishPaymentConnect } from "@/lib/mercado-pago.functions";

// Volta do Mercado Pago depois que o lojista autoriza (endereço cadastrado no aplicativo Vynka).
// Pedido iniciado no app local de homologação (state "local8081-..."): esta página, publicada, só
// repassa code e state para o localhost; a troca acontece lá.
export const Route = createFileRoute("/admin/integracoes/mercado-pago/retorno")({
  head: () => ({
    meta: [{ title: "Conectando Mercado Pago · VYNKA" }, { name: "robots", content: "noindex" }],
  }),
  component: MercadoPagoReturnPage,
});

function MercadoPagoReturnPage() {
  const finish = useServerFn(finishPaymentConnect);
  const started = useRef(false);
  const [message, setMessage] = useState<{ kind: "loading" | "error"; text: string }>({
    kind: "loading",
    text: "Concluindo a conexão com o Mercado Pago...",
  });

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    const params = new URLSearchParams(window.location.search);
    const code = params.get("code") ?? "";
    const state = params.get("state") ?? "";
    const relay = state.match(/^local(\d{2,5})-/);
    if (relay && window.location.hostname !== "localhost") {
      const target = new URL(`http://localhost:${relay[1]}${window.location.pathname}`);
      target.search = window.location.search;
      window.location.replace(target.toString());
      return;
    }
    if (params.get("error") || !code || !state) {
      setMessage({
        kind: "error",
        text: "A autorização não foi concluída no Mercado Pago. Volte e clique em Conectar de novo.",
      });
      return;
    }
    supabase.auth
      .getSession()
      .then(({ data }) => {
        if (!data.session) {
          throw new Error(
            "Sua sessão no painel não está aberta neste navegador. Entre no painel e clique em Conectar de novo.",
          );
        }
        return finish({ data: { code, state } });
      })
      .then(() => window.location.replace("/admin/configuracoes?aba=pagamentos"))
      .catch((err: unknown) =>
        setMessage({
          kind: "error",
          text: err instanceof Error ? err.message : "Não foi possível concluir a conexão.",
        }),
      );
  }, [finish]);

  return (
    <div className="grid min-h-svh place-items-center bg-background px-4">
      <div className="w-full max-w-lg rounded-lg border border-border bg-surface p-8 text-center">
        <div className="text-[12px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
          Mercado Pago
        </div>
        {message.kind === "loading" ? (
          <Loader2
            className="mx-auto h-6 w-6 animate-spin text-muted-foreground"
            strokeWidth={1.5}
          />
        ) : null}
        <p className="mt-4 text-[14px] text-foreground">{message.text}</p>
        {message.kind === "error" && (
          <a
            href="/admin/configuracoes?aba=pagamentos"
            className="mt-6 inline-flex rounded-md bg-primary px-4 py-2.5 text-[13px] font-semibold text-primary-foreground"
          >
            Voltar para Pagamentos
          </a>
        )}
      </div>
    </div>
  );
}
