import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { ExternalLink, Loader2, Printer, RefreshCw, Truck } from "lucide-react";
import { useState } from "react";
import { confirmAction } from "@/lib/confirm-dialog";
import { formatBRL } from "@/lib/products";
import {
  cancelLabel,
  generateLabel,
  getOrderShipment,
  previewLabel,
  printLabel,
  refreshShipment,
} from "@/lib/shipping-labels.functions";

// Etiqueta do Melhor Envio no pedido (lote E3): gerar (paga com o saldo da conta da loja no Melhor
// Envio), imprimir, cancelar e atualizar rastreio. "Enviado" e "Entregue" vêm do Melhor Envio.

const statusLabel: Record<string, string> = {
  cart: "No carrinho do Melhor Envio (não paga)",
  released: "Paga, gerando a etiqueta",
  generated: "Gerada · pronta para imprimir e postar",
  posted: "Postada",
  delivered: "Entregue",
  undelivered: "Não entregue",
  paused: "Entrega pausada (o destinatário precisa agir)",
  suspended: "Envio suspenso",
};

const button =
  "inline-flex min-h-9 items-center justify-center gap-1.5 rounded-md border border-border bg-background px-3 py-1.5 text-[12px] font-medium text-foreground transition-colors hover:bg-muted disabled:opacity-50";
const primary =
  "inline-flex min-h-10 items-center justify-center gap-2 rounded-md bg-primary px-4 py-2 text-[13px] font-semibold text-primary-foreground transition-colors hover:bg-graphite disabled:opacity-50";

export function OrderShipmentCard({ storeId, orderId }: { storeId: string; orderId: string }) {
  const queryClient = useQueryClient();
  const fetchShipment = useServerFn(getOrderShipment);
  const fetchPreview = useServerFn(previewLabel);
  const runGenerate = useServerFn(generateLabel);
  const runPrint = useServerFn(printLabel);
  const runRefresh = useServerFn(refreshShipment);
  const runCancel = useServerFn(cancelLabel);
  const key = ["order-shipment", storeId, orderId];

  const { data, isLoading } = useQuery({
    queryKey: key,
    queryFn: () => fetchShipment({ data: { store_id: storeId, order_id: orderId } }),
  });
  const [opening, setOpening] = useState(false);
  const [documentType, setDocumentType] = useState<"declaration" | "invoice">("declaration");
  const [invoiceKey, setInvoiceKey] = useState("");

  const preview = useQuery({
    queryKey: ["order-shipment-preview", storeId, orderId],
    queryFn: () => fetchPreview({ data: { store_id: storeId, order_id: orderId } }),
    enabled: opening,
    retry: false,
  });

  const refreshAll = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: key }),
      queryClient.invalidateQueries({ queryKey: ["order", storeId, orderId] }),
      queryClient.invalidateQueries({ queryKey: ["orders", storeId] }),
    ]);
  };

  const generate = useMutation({
    mutationFn: () =>
      runGenerate({
        data: {
          store_id: storeId,
          order_id: orderId,
          document_type: documentType,
          invoice_key: invoiceKey,
        },
      }),
    onSuccess: async () => {
      setOpening(false);
      await refreshAll();
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: key }),
  });
  const print = useMutation({
    mutationFn: () => runPrint({ data: { store_id: storeId, order_id: orderId } }),
    onSuccess: ({ url }) => {
      window.open(url, "_blank", "noopener");
    },
  });
  const refresh = useMutation({
    mutationFn: () => runRefresh({ data: { store_id: storeId, order_id: orderId } }),
    onSuccess: refreshAll,
  });
  const cancel = useMutation({
    mutationFn: () => runCancel({ data: { store_id: storeId, order_id: orderId } }),
    onSuccess: refreshAll,
  });

  if (isLoading || !data) return null;
  const { shipment, canGenerate, eligible } = data;
  if (!shipment && !eligible) return null;

  const error = [generate, print, refresh, cancel].find((m) => m.isError)?.error;
  const busy = generate.isPending || print.isPending || refresh.isPending || cancel.isPending;
  const unfinished = shipment && ["cart", "released"].includes(shipment.status);
  const printable = shipment && !["cart"].includes(shipment.status);
  const cancellable = shipment && !["posted", "delivered"].includes(shipment.status);

  const pay = async () => {
    const price = preview.data?.price;
    const ok = await confirmAction({
      title: "Gerar etiqueta",
      description: `O Melhor Envio vai cobrar ${price !== undefined ? formatBRL(price) : "o valor do frete"} do saldo da sua conta.`,
      confirmLabel: "Pagar e gerar",
    });
    if (ok) generate.mutate();
  };

  const askCancel = async () => {
    const ok = await confirmAction({
      title: "Cancelar etiqueta",
      description:
        "A etiqueta deixa de valer e o Melhor Envio devolve o valor ao seu saldo (pode levar algumas horas se ela já foi impressa). Depois você pode gerar outra.",
      confirmLabel: "Cancelar etiqueta",
      cancelLabel: "Voltar",
      destructive: true,
    });
    if (ok) cancel.mutate();
  };

  return (
    <div className="rounded-lg border border-border bg-surface p-5">
      <div className="flex items-center justify-between gap-3">
        <h2 className="flex items-center gap-2 text-[15px] font-medium text-foreground">
          <Truck className="h-4 w-4" strokeWidth={1.5} />
          Etiqueta de envio
        </h2>
        {shipment && (
          <button type="button" className={button} disabled={busy} onClick={() => refresh.mutate()}>
            <RefreshCw className="h-3.5 w-3.5" strokeWidth={1.5} />
            Atualizar
          </button>
        )}
      </div>

      {!shipment && (
        <div className="mt-4 space-y-3 text-[13px]">
          <p className="text-muted-foreground">
            Gere a etiqueta pelo Vynka: ela é paga com o saldo da sua conta no Melhor Envio e o
            pedido passa para "Enviado" e "Entregue" sozinho.
          </p>
          {!canGenerate ? (
            <p className="text-muted-foreground">
              Peça ao dono da loja para gerar a etiqueta ou liberar essa permissão para você.
            </p>
          ) : !opening ? (
            <button type="button" className={primary} onClick={() => setOpening(true)}>
              Gerar etiqueta
            </button>
          ) : (
            <div className="space-y-3 rounded-md border border-border bg-background p-4">
              <fieldset className="space-y-2">
                <legend className="text-[12px] font-medium text-foreground">
                  Documento do envio
                </legend>
                <label className="flex items-center gap-2">
                  <input
                    type="radio"
                    checked={documentType === "declaration"}
                    onChange={() => setDocumentType("declaration")}
                  />
                  Declaração de conteúdo
                </label>
                <label className="flex items-center gap-2">
                  <input
                    type="radio"
                    checked={documentType === "invoice"}
                    onChange={() => setDocumentType("invoice")}
                  />
                  Nota fiscal (NF-e já emitida)
                </label>
                {documentType === "invoice" && (
                  <input
                    value={invoiceKey}
                    onChange={(event) => setInvoiceKey(event.target.value.replace(/\D/g, ""))}
                    inputMode="numeric"
                    maxLength={44}
                    placeholder="Chave de acesso da NF-e (44 números)"
                    className="w-full rounded-md border border-border bg-surface px-3 py-2 text-[13px] outline-none focus:border-foreground/40"
                  />
                )}
              </fieldset>
              {preview.isLoading && (
                <p className="flex items-center gap-2 text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" /> Consultando o Melhor Envio...
                </p>
              )}
              {preview.isError && (
                <p className="text-red-700">
                  {preview.error instanceof Error ? preview.error.message : "Erro ao cotar."}
                </p>
              )}
              {preview.data && (
                <div className="space-y-1">
                  <div>
                    Etiqueta {preview.data.service_name}:{" "}
                    <strong>{formatBRL(preview.data.price)}</strong>
                  </div>
                  <div className="text-muted-foreground">
                    Frete cobrado do cliente:{" "}
                    {preview.data.charged > 0 ? formatBRL(preview.data.charged) : "grátis"}
                    {preview.data.balance !== null &&
                      ` · Saldo no Melhor Envio: ${formatBRL(preview.data.balance)}`}
                  </div>
                  {preview.data.charged === 0 && (
                    <div className="text-muted-foreground">
                      Frete grátis: o valor entra como despesa "Frete e envio" em Finanças.
                    </div>
                  )}
                  {preview.data.charged > 0 &&
                    Math.abs(preview.data.price - preview.data.charged) >= 0.01 && (
                      <div className="text-amber-700">
                        O valor de agora é diferente do frete cobrado do cliente.
                      </div>
                    )}
                </div>
              )}
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  className={primary}
                  disabled={
                    busy ||
                    !preview.data ||
                    (documentType === "invoice" && invoiceKey.length !== 44)
                  }
                  onClick={pay}
                >
                  {generate.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
                  Pagar e gerar
                </button>
                <button
                  type="button"
                  className={button}
                  disabled={busy}
                  onClick={() => setOpening(false)}
                >
                  Voltar
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {shipment && (
        <div className="mt-4 space-y-3 text-[13px]">
          <div>
            <div className="font-medium text-foreground">
              {statusLabel[shipment.status] ?? shipment.status}
            </div>
            <div className="text-muted-foreground">
              {shipment.service_name}
              {shipment.price !== null && ` · ${formatBRL(shipment.price)}`}
              {" · "}
              {shipment.document_type === "invoice" ? "Nota fiscal" : "Declaração de conteúdo"}
            </div>
            {shipment.tracking && (
              <div className="mt-1">
                Rastreio: <span className="font-medium">{shipment.tracking}</span>
                {shipment.tracking_url && (
                  <a
                    href={shipment.tracking_url}
                    target="_blank"
                    rel="noreferrer"
                    className="ml-2 inline-flex items-center gap-1 text-primary hover:underline"
                  >
                    acompanhar <ExternalLink className="h-3 w-3" />
                  </a>
                )}
              </div>
            )}
            {shipment.last_error && <div className="mt-1 text-red-700">{shipment.last_error}</div>}
          </div>
          <div className="flex flex-wrap gap-2">
            {unfinished && canGenerate && (
              <button
                type="button"
                className={primary}
                disabled={busy}
                onClick={() => generate.mutate()}
              >
                {generate.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
                Continuar geração
              </button>
            )}
            {printable && (
              <button
                type="button"
                className={button}
                disabled={busy}
                onClick={() => print.mutate()}
              >
                {print.isPending ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Printer className="h-3.5 w-3.5" strokeWidth={1.5} />
                )}
                Imprimir etiqueta
              </button>
            )}
            {cancellable && canGenerate && (
              <button type="button" className={button} disabled={busy} onClick={askCancel}>
                Cancelar etiqueta
              </button>
            )}
          </div>
        </div>
      )}

      {error && (
        <div className="mt-3 rounded-md bg-red-50 px-3 py-2 text-[12.5px] text-red-700">
          {error instanceof Error ? error.message : "Não foi possível concluir."}
        </div>
      )}
    </div>
  );
}
