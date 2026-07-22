import { Link, Mail, Printer, ReceiptText, Send, UserRound, X } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { formatBRL } from "@/lib/products";
import { getGeneralSettings, getReceiptSettings, type ReceiptSettings } from "@/lib/store-settings";
import type { OrderRecord } from "@/lib/orders";
import { cn } from "@/lib/utils";

export function OrderReceiptCard({
  order,
  storeId,
  title = "Recibo",
}: {
  order: OrderRecord;
  storeId: string;
  title?: string;
}) {
  const [open, setOpen] = useState(false);
  const { data: store } = useQuery({
    queryKey: ["general-settings", storeId],
    queryFn: () => getGeneralSettings(storeId),
    enabled: !!storeId,
  });
  const { data: settings } = useQuery({
    queryKey: ["receipt-settings", storeId],
    queryFn: () => getReceiptSettings(storeId),
    enabled: !!storeId,
  });
  const receiptSettings = settings ?? {
    include_customer: true,
    show_product_code: true,
    header_text: "",
    footer_text: "",
  };

  return (
    <div className="rounded-lg border border-border bg-surface p-5">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-[15px] font-medium text-foreground">{title}</h2>
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="text-[12px] font-medium text-primary hover:text-foreground"
        >
          Ver
        </button>
      </div>
      <div className="mt-4 rounded-md bg-background p-4">
        <ReceiptPaper order={order} store={store ?? null} settings={receiptSettings} compact />
        <ReceiptActions
          order={order}
          store={store ?? null}
          settings={receiptSettings}
          className="mt-4 justify-center"
        />
      </div>
      {open && (
        <ReceiptModal
          order={order}
          store={store ?? null}
          settings={receiptSettings}
          onClose={() => setOpen(false)}
        />
      )}
    </div>
  );
}

export function ReceiptPaper({
  order,
  store,
  settings,
  compact = false,
}: {
  order: OrderRecord;
  store: {
    name: string;
    address: string;
    whatsapp: string;
    phone: string;
    logo_url: string;
  } | null;
  settings: ReceiptSettings;
  compact?: boolean;
}) {
  return (
    <div className={cn("mx-auto bg-white text-slate-700", compact ? "max-w-[260px]" : "max-w-md")}>
      <div className={cn("text-center", compact ? "py-3" : "px-6 py-8")}>
        {store?.logo_url ? (
          <img
            src={store.logo_url}
            alt=""
            className={cn("mx-auto object-contain", compact ? "h-8 max-w-24" : "h-12 max-w-36")}
          />
        ) : (
          <div
            className={cn(
              "font-semibold tracking-[0.28em] text-slate-900",
              compact ? "text-[13px]" : "text-[16px]",
            )}
          >
            VYNKA
          </div>
        )}
        <div
          className={cn(
            "font-medium text-slate-500",
            compact ? "mt-4 text-[14px]" : "mt-7 text-[20px]",
          )}
        >
          RECIBO #{order.number ?? "-"}
        </div>
      </div>

      <div className={cn(compact ? "px-2 pb-2" : "px-6 pb-8")}>
        {settings.header_text && !compact && (
          <div className="mb-4 rounded-md border border-slate-300 px-4 py-3 text-[13px]">
            {settings.header_text}
          </div>
        )}

        {!compact && (
          <div className="mb-5 text-[13px] leading-relaxed">
            <div className="font-medium text-slate-800">{store?.name ?? "Loja"}</div>
            {store?.address && <div>{store.address}</div>}
            {(store?.whatsapp || store?.phone) && <div>{store.whatsapp || store.phone}</div>}
          </div>
        )}

        {settings.include_customer && order.customer && !compact && (
          <div className="mb-5 text-[13px]">
            <div className="flex items-center gap-2 font-medium text-slate-700">
              <UserRound className="h-4 w-4" strokeWidth={1.6} />
              {order.customer.name}
            </div>
            {(order.customer.phone || order.customer.email) && (
              <div className="mt-1 text-slate-600">
                {[order.customer.phone, order.customer.email].filter(Boolean).join(" - ")}
              </div>
            )}
          </div>
        )}

        <div
          className={cn("font-semibold text-slate-600", compact ? "text-[12px]" : "text-[17px]")}
        >
          {itemCount(order)} item{itemCount(order) === 1 ? "" : "s"} (Qtd.: {itemCount(order)})
        </div>
        <div className="mt-3 border-t-2 border-slate-500">
          {order.items.map((item) => (
            <div
              key={item.id}
              className={cn(
                "flex justify-between gap-4 border-b border-slate-200 py-3",
                compact ? "text-[10px]" : "text-[13px]",
              )}
            >
              <div className="min-w-0">
                <div className="font-medium text-slate-800">
                  {item.quantity}x {item.product_name}
                </div>
                {item.variant_name && <div className="text-slate-500">{item.variant_name}</div>}
                {settings.show_product_code && item.product_id && !compact && (
                  <div className="mt-1 text-[11px] text-slate-400">
                    Cod. {item.product_id.slice(0, 8)}
                  </div>
                )}
              </div>
              <div className="shrink-0 font-medium text-slate-900">
                {formatBRL(item.total_price)}
              </div>
            </div>
          ))}
        </div>

        <div
          className={cn(
            "ml-auto mt-5 max-w-52 space-y-2 text-right",
            compact ? "text-[11px]" : "text-[14px]",
          )}
        >
          <div>Subtotal: {formatBRL(order.subtotal)}</div>
          {order.discount > 0 && <div>Desconto: -{formatBRL(order.discount)}</div>}
          {order.surcharge > 0 && <div>Acréscimo: {formatBRL(order.surcharge)}</div>}
          <div
            className={cn("font-semibold text-slate-700", compact ? "text-[13px]" : "text-[18px]")}
          >
            Total: {formatBRL(order.total)}
          </div>
        </div>

        {settings.footer_text && !compact && (
          <div className="mt-6 text-center text-[12px] text-slate-500">{settings.footer_text}</div>
        )}

        <div className="mt-7 border-t-2 border-slate-500 pt-5 text-center text-[12px] text-slate-500">
          {formatDate(order.created_at)}
        </div>
      </div>
    </div>
  );
}

function ReceiptModal({
  order,
  store,
  settings,
  onClose,
}: {
  order: OrderRecord;
  store: {
    name: string;
    address: string;
    whatsapp: string;
    phone: string;
    logo_url: string;
  } | null;
  settings: ReceiptSettings;
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/35">
      <aside className="flex h-full w-full max-w-md flex-col bg-background shadow-2xl">
        <div className="flex items-center justify-between border-b border-border px-4 py-4">
          <h2 className="text-[15px] font-semibold text-foreground">
            Recibo #{order.number ?? "-"}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="grid h-8 w-8 place-items-center rounded-full text-muted-foreground hover:bg-muted hover:text-foreground"
            aria-label="Fechar"
          >
            <X className="h-4 w-4" strokeWidth={1.6} />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto px-5 py-6">
          <ReceiptPaper order={order} store={store} settings={settings} />
        </div>
        <div className="border-t border-border">
          <div className="flex items-center justify-between px-4 py-3 text-[12px] font-medium">
            <a href="/admin/configuracoes" className="text-primary hover:text-foreground">
              Editar meu recibo
            </a>
            <button
              type="button"
              onClick={() => window.print()}
              className="text-primary hover:text-foreground"
            >
              Configurar impressão
            </button>
          </div>
          <ReceiptActions order={order} store={store} settings={settings} dark />
        </div>
      </aside>
    </div>
  );
}

function ReceiptActions({
  order,
  store,
  settings,
  dark = false,
  className,
}: {
  order: OrderRecord;
  store: {
    name: string;
    address: string;
    whatsapp: string;
    phone: string;
    logo_url: string;
  } | null;
  settings: ReceiptSettings;
  dark?: boolean;
  className?: string;
}) {
  const receiptText = buildReceiptText(order, store, settings);
  const actionClass = cn(
    "grid h-8 w-8 place-items-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground",
    dark && "h-auto w-auto flex-1 rounded-none py-3 text-white hover:bg-white/10 hover:text-white",
  );
  return (
    <div className={cn("flex items-center gap-2", dark && "gap-0 bg-slate-600", className)}>
      <button
        type="button"
        onClick={() => navigator.clipboard.writeText(receiptText)}
        className={actionClass}
      >
        <Link className="h-4 w-4" strokeWidth={1.6} />
        {dark && <span className="mt-1 text-[11px]">Copiar imagem</span>}
      </button>
      <button type="button" onClick={() => window.print()} className={actionClass}>
        <ReceiptText className="h-4 w-4" strokeWidth={1.6} />
        {dark && <span className="mt-1 text-[11px]">Baixar PDF</span>}
      </button>
      <button
        type="button"
        onClick={() =>
          window.location.assign(`mailto:?subject=Recibo&body=${encodeURIComponent(receiptText)}`)
        }
        className={actionClass}
      >
        <Mail className="h-4 w-4" strokeWidth={1.6} />
        {dark && <span className="mt-1 text-[11px]">Enviar por E-mail</span>}
      </button>
      <button type="button" onClick={() => window.print()} className={actionClass}>
        <Printer className="h-4 w-4" strokeWidth={1.6} />
        {dark && <span className="mt-1 text-[11px]">Imprimir</span>}
      </button>
    </div>
  );
}

function itemCount(order: OrderRecord) {
  return order.items.reduce((sum, item) => sum + item.quantity, 0);
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

function buildReceiptText(
  order: OrderRecord,
  store: {
    name: string;
    address: string;
    whatsapp: string;
    phone: string;
    logo_url: string;
  } | null,
  settings: ReceiptSettings,
) {
  return [
    `RECIBO #${order.number ?? "-"}`,
    store?.name ?? "",
    store?.address ?? "",
    settings.header_text,
    settings.include_customer && order.customer ? `Cliente: ${order.customer.name}` : "",
    ...order.items.map(
      (item) => `${item.quantity}x ${item.product_name} - ${formatBRL(item.total_price)}`,
    ),
    `Total: ${formatBRL(order.total)}`,
    settings.footer_text,
    formatDate(order.created_at),
  ]
    .filter(Boolean)
    .join("\n");
}
