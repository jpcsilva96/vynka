import { useState } from "react";
import { Check, Copy, ExternalLink } from "lucide-react";
import type { CustomerShipment } from "@/lib/customer-tracking.functions";

// Rastreio do envio para o cliente (lote E5). Sem etiqueta (ou sem código ainda), nada aparece.

const problem: Record<string, string> = {
  undelivered: "A transportadora não conseguiu entregar. Fale com a loja.",
  paused: "A entrega está pausada. Fale com a loja.",
  suspended: "O envio foi suspenso. Fale com a loja.",
};

export function OrderTracking({
  shipment,
  compact = false,
}: {
  shipment: CustomerShipment | undefined;
  compact?: boolean;
}) {
  const [copied, setCopied] = useState(false);
  if (!shipment) return null;
  const note = problem[shipment.status];
  if (!shipment.tracking && !note) return null;

  const copy = async () => {
    if (!shipment.tracking) return;
    try {
      await navigator.clipboard.writeText(shipment.tracking);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Sem permissão de área de transferência: o código continua visível para copiar à mão.
    }
  };

  return (
    <div className={compact ? "mt-3 text-[12px]" : "mt-3 text-[13px]"}>
      {shipment.tracking && (
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
          <span className="text-neutral-500">
            Rastreio: <span className="font-medium text-black select-all">{shipment.tracking}</span>
          </span>
          <button
            type="button"
            onClick={copy}
            className="inline-flex min-h-8 items-center gap-1 text-neutral-500 hover:text-black"
          >
            {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
            {copied ? "Copiado" : "Copiar"}
          </button>
          {shipment.tracking_url && (
            <a
              href={shipment.tracking_url}
              target="_blank"
              rel="noreferrer"
              className="inline-flex min-h-8 items-center gap-1 font-medium text-black underline-offset-4 hover:underline"
            >
              Acompanhar envio <ExternalLink className="h-3.5 w-3.5" />
            </a>
          )}
        </div>
      )}
      {note && <div className="mt-1 text-red-700">{note}</div>}
    </div>
  );
}
