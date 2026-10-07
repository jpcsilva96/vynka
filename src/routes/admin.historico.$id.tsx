import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeft,
  CalendarDays,
  Check,
  Copy,
  Loader2,
  Package,
  Printer,
  ReceiptText,
  Send,
  UserRound,
  XCircle,
} from "lucide-react";
import { PaymentMethodIcon } from "@/components/payment-method-icon";
import { OrderReceiptCard } from "@/components/order-receipt";
import { useStoreContext } from "@/lib/store-context";
import { formatBRL } from "@/lib/products";
import {
  cancelSale,
  getOrder,
  orderStatusClass,
  orderStatusLabel,
  type OrderRecord,
} from "@/lib/orders";
import { paymentMethodLabel, type PaymentMethod } from "@/lib/sales";

export const Route = createFileRoute("/admin/historico/$id")({
  head: () => ({ meta: [{ title: "Venda - VYNKA" }] }),
  component: VendaDetalhe,
});

function VendaDetalhe() {
  const { id } = Route.useParams();
  const { currentStore, user } = useStoreContext();
  const storeId = currentStore?.id ?? "";
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const { data: order, isLoading } = useQuery({
    queryKey: ["order", storeId, id],
    queryFn: () => getOrder(storeId, id),
    enabled: !!storeId && !!id,
  });

  const cancelMutation = useMutation({
    mutationFn: () => cancelSale(storeId, id),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["order", storeId, id] }),
        queryClient.invalidateQueries({ queryKey: ["orders", storeId] }),
      ]);
    },
  });

  if (isLoading) {
    return (
      <div className="grid min-h-svh flex-1 place-items-center bg-background">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" strokeWidth={1.5} />
      </div>
    );
  }

  if (!order) {
    return (
      <div className="flex min-h-svh flex-1 flex-col items-center justify-center bg-background px-6 text-center">
        <h1 className="text-[18px] font-medium text-foreground">Venda nao encontrada</h1>
        <Link
          to="/admin/historico"
          className="mt-4 text-[13px] font-medium text-foreground underline"
        >
          Voltar para historico
        </Link>
      </div>
    );
  }

  const canCancel = order.status !== "cancelled";

  return (
    <div className="min-h-svh min-w-0 flex-1 bg-background">
      <header className="sticky top-0 z-20 border-b border-border bg-background/90 backdrop-blur-xl">
        <div className="flex h-20 items-center gap-4 px-6">
          <button
            onClick={() => navigate({ to: "/admin/historico" })}
            aria-label="Voltar"
            className="grid h-9 w-9 place-items-center rounded-full text-muted-foreground hover:bg-muted hover:text-foreground"
          >
            <ArrowLeft className="h-4 w-4" strokeWidth={1.75} />
          </button>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-baseline gap-3">
              <h1 className="text-[22px] font-medium text-foreground">
                Venda #{order.number ?? "-"}
              </h1>
              <span className="text-[15px] text-muted-foreground">
                Total {formatBRL(order.total)}
              </span>
            </div>
            <p className="mt-1 text-[12px] text-muted-foreground">{formatDate(order.created_at)}</p>
          </div>
          <button
            onClick={() => window.print()}
            className="hidden items-center gap-2 rounded-md border border-border bg-surface px-3 py-2 text-[12.5px] font-medium hover:bg-muted md:inline-flex"
          >
            <Printer className="h-3.5 w-3.5" strokeWidth={1.5} />
            Imprimir
          </button>
        </div>
      </header>

      <main className="px-6 py-6">
        <div className="mx-auto max-w-6xl">
          <div className="rounded-lg border border-border bg-surface p-4 shadow-sm">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <div className="flex flex-wrap items-center gap-5">
                <div className="flex items-center gap-2">
                  <span className="text-[13px] font-medium text-foreground">Status:</span>
                  <span
                    className={`inline-flex items-center gap-1.5 rounded px-2 py-1 text-[12px] font-medium ${orderStatusClass(
                      order.status,
                    )}`}
                  >
                    <Check className="h-3.5 w-3.5" strokeWidth={1.5} />
                    {order.status === "cancelled" ? "Cancelada" : orderStatusLabel(order.status)}
                  </span>
                </div>

                <div>
                  <div className="text-[13px] font-medium text-foreground">
                    Pagina de andamento do pedido
                  </div>
                  <div className="text-[11.5px] text-muted-foreground">
                    Voce ainda nao tem catalogo
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => navigator.clipboard.writeText(window.location.href)}
                  className="inline-flex items-center gap-1.5 text-[12px] font-medium text-primary hover:text-foreground"
                >
                  <Copy className="h-3.5 w-3.5" strokeWidth={1.5} />
                  Copiar link
                </button>
              </div>

              {canCancel && (
                <button
                  type="button"
                  disabled={cancelMutation.isPending}
                  onClick={() => {
                    const confirmed = window.confirm("Cancelar esta venda?");
                    if (confirmed) cancelMutation.mutate();
                  }}
                  className="inline-flex items-center justify-center gap-2 rounded-md px-4 py-3 text-[12.5px] font-medium text-foreground hover:bg-muted disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {cancelMutation.isPending ? (
                    <Loader2 className="h-4 w-4 animate-spin" strokeWidth={1.6} />
                  ) : (
                    <XCircle className="h-4 w-4 text-red-600" strokeWidth={1.6} />
                  )}
                  Cancelar venda
                </button>
              )}
            </div>
          </div>

          <div className="mt-0 rounded-b-lg bg-muted px-4 py-3 text-[12.5px] text-foreground">
            <CalendarDays
              className="mr-1.5 inline h-4 w-4 align-[-3px] text-muted-foreground"
              strokeWidth={1.5}
            />
            {formatDate(order.created_at)}
            <UserRound
              className="ml-4 mr-1.5 inline h-4 w-4 align-[-3px] text-muted-foreground"
              strokeWidth={1.5}
            />
            {sellerName(order, user?.id, userDisplayName(user))}
          </div>

          <div className="mt-5 grid gap-5 lg:grid-cols-[minmax(0,1fr)_420px]">
            <section className="space-y-4">
              <InfoCard title="Cliente">
                {order.customer ? (
                  <div className="space-y-1 text-[13px]">
                    <div className="font-medium text-foreground">{order.customer.name}</div>
                    {order.customer.phone && (
                      <div className="text-muted-foreground">{order.customer.phone}</div>
                    )}
                    {order.customer.email && (
                      <div className="text-muted-foreground">{order.customer.email}</div>
                    )}
                  </div>
                ) : (
                  <span className="text-[13px] text-muted-foreground">Cliente nao informado.</span>
                )}
              </InfoCard>

              <InfoCard title="Observacao">
                <p className="min-h-6 whitespace-pre-wrap text-[13px] text-muted-foreground">
                  {order.notes || "Nenhuma observacao."}
                </p>
              </InfoCard>

              <InfoCard title={`${itemCount(order)} item${itemCount(order) === 1 ? "" : "s"}`}>
                <ul className="divide-y divide-border">
                  {order.items.map((item) => (
                    <li key={item.id} className="flex items-center gap-3 py-3 first:pt-0 last:pb-0">
                      <div className="grid h-11 w-11 shrink-0 place-items-center rounded-md bg-muted text-muted-foreground">
                        <Package className="h-4 w-4" strokeWidth={1.4} />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-[13px] font-medium text-foreground">
                          {item.product_name}
                        </div>
                        {item.variant_name && (
                          <div className="truncate text-[11.5px] text-muted-foreground">
                            {item.variant_name}
                          </div>
                        )}
                      </div>
                      <div className="text-[12px] text-muted-foreground">x{item.quantity}</div>
                      <div className="w-24 text-right text-[13px] font-medium text-foreground">
                        {formatBRL(item.total_price)}
                      </div>
                    </li>
                  ))}
                </ul>
              </InfoCard>

              <InfoCard title="Historico">
                <ol className="space-y-3 text-[13px]">
                  <HistoryLine label={orderStatusLabel(order.status)} date={order.updated_at} />
                </ol>
              </InfoCard>
            </section>

            <aside className="space-y-4">
              <SummaryCard order={order} />
              <PaymentCard order={order} />
              <OrderReceiptCard order={order} storeId={storeId} />
            </aside>
          </div>
        </div>
      </main>
    </div>
  );
}

function InfoCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-border bg-surface p-5">
      <h2 className="text-[15px] font-medium text-foreground">{title}</h2>
      <div className="mt-4">{children}</div>
    </div>
  );
}

function SummaryCard({ order }: { order: OrderRecord }) {
  return (
    <InfoCard title="Resumo da venda">
      <div className="space-y-2 text-[13px]">
        <SummaryRow label="Subtotal de produtos" value={formatBRL(order.subtotal)} />
        <div className="mt-4 flex items-baseline justify-between border-t border-border pt-4">
          <span className="text-[15px] font-medium text-foreground">Total</span>
          <span className="text-[20px] font-medium text-foreground">{formatBRL(order.total)}</span>
        </div>
      </div>
    </InfoCard>
  );
}

function PaymentCard({ order }: { order: OrderRecord }) {
  const method = order.payment_method as PaymentMethod | null;
  return (
    <InfoCard title="Meios de pagamento">
      <div className="inline-flex items-center gap-2 rounded bg-muted px-2 py-1 text-[13px] text-foreground">
        <PaymentMethodIcon method={method} />
        {method ? (paymentMethodLabel[method] ?? method) : "Nao informado"}
        <span className="font-medium">{formatBRL(order.total)}</span>
      </div>
    </InfoCard>
  );
}

function ReceiptCard({ order }: { order: OrderRecord }) {
  const receiptText = buildReceiptText(order);
  return (
    <InfoCard title="Recibo">
      <div className="rounded-md bg-background p-4 text-center">
        <ReceiptText className="mx-auto mb-3 h-5 w-5 text-muted-foreground" strokeWidth={1.5} />
        <div className="text-[13px] font-medium text-muted-foreground">
          RECIBO #{order.number ?? "-"}
        </div>
        <div className="mt-5 text-left text-[12px] text-muted-foreground">
          {itemCount(order)} item{itemCount(order) === 1 ? "" : "s"}
        </div>
        <div className="mt-2 border-t border-border pt-2 text-left">
          {order.items.slice(0, 3).map((item) => (
            <div
              key={item.id}
              className="flex justify-between gap-3 py-1 text-[11.5px] text-muted-foreground"
            >
              <span className="truncate">
                {item.quantity}x {item.product_name}
              </span>
              <span>{formatBRL(item.total_price)}</span>
            </div>
          ))}
        </div>
        <div className="mt-4 flex items-center justify-center gap-2">
          <button
            onClick={() => navigator.clipboard.writeText(receiptText)}
            className="grid h-8 w-8 place-items-center rounded-md border border-border text-muted-foreground hover:bg-muted hover:text-foreground"
            aria-label="Copiar recibo"
          >
            <Copy className="h-3.5 w-3.5" strokeWidth={1.5} />
          </button>
          <button
            onClick={() => window.print()}
            className="grid h-8 w-8 place-items-center rounded-md border border-border text-muted-foreground hover:bg-muted hover:text-foreground"
            aria-label="Imprimir recibo"
          >
            <Printer className="h-3.5 w-3.5" strokeWidth={1.5} />
          </button>
          <button
            onClick={() => navigator.clipboard.writeText(receiptText)}
            className="grid h-8 w-8 place-items-center rounded-md border border-border text-muted-foreground hover:bg-muted hover:text-foreground"
            aria-label="Compartilhar recibo"
          >
            <Send className="h-3.5 w-3.5" strokeWidth={1.5} />
          </button>
        </div>
      </div>
    </InfoCard>
  );
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-4">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium text-foreground">{value}</span>
    </div>
  );
}

function HistoryLine({ label, date }: { label: string; date: string }) {
  return (
    <li className="flex items-start gap-3 rounded-md bg-muted p-4">
      <Check className="mt-0.5 h-4 w-4 text-primary" strokeWidth={1.5} />
      <span>
        <span className="block font-medium text-foreground">{label}</span>
        <span className="text-muted-foreground">{formatDate(date)}</span>
      </span>
    </li>
  );
}

function itemCount(order: OrderRecord) {
  return order.items.reduce((sum, item) => sum + item.quantity, 0);
}

function sellerName(
  order: OrderRecord,
  currentUserId: string | undefined,
  currentSellerName: string,
) {
  if (!order.created_by) return "Catalogo";
  if (order.created_by === currentUserId) return currentSellerName;
  return "Vendedor";
}

function userDisplayName(user: { email?: string; user_metadata?: Record<string, unknown> } | null) {
  const metaName =
    typeof user?.user_metadata?.name === "string"
      ? user.user_metadata.name
      : typeof user?.user_metadata?.full_name === "string"
        ? user.user_metadata.full_name
        : "";
  if (metaName.trim()) return metaName;
  return user?.email?.split("@")[0] ?? "Vendedor";
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

function buildReceiptText(order: OrderRecord) {
  return [
    `Venda #${order.number ?? "-"}`,
    ...order.items.map(
      (item) => `${item.quantity}x ${item.product_name} - ${formatBRL(item.total_price)}`,
    ),
    `Total: ${formatBRL(order.total)}`,
    `Status: ${orderStatusLabel(order.status)}`,
  ].join("\n");
}
