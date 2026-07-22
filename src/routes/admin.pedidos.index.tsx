import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Clock3, Filter, Loader2, Search, ShoppingBag } from "lucide-react";
import { useMemo, useState } from "react";
import { PageShell, EmptyState } from "@/components/page-shell";
import { useStoreContext } from "@/lib/store-context";
import { formatBRL } from "@/lib/products";
import {
  listOrders,
  allOrderStatuses,
  orderStatusClass,
  orderStatusLabel,
  type OrderStatus,
} from "@/lib/orders";

export const Route = createFileRoute("/admin/pedidos/")({
  head: () => ({
    meta: [
      { title: "Pedidos - VYNKA" },
      { name: "description", content: "Acompanhe os pedidos da sua loja." },
    ],
  }),
  component: Pedidos,
});

function Pedidos() {
  const { currentStore } = useStoreContext();
  const storeId = currentStore?.id ?? "";
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<"all" | OrderStatus>("all");

  const { data: orders = [], isLoading } = useQuery({
    queryKey: ["orders", storeId, "orders"],
    queryFn: () => listOrders(storeId, "orders"),
    enabled: !!storeId,
  });

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return orders.filter((order) => {
      const matchesStatus = status === "all" || order.status === status;
      const haystack = [
        `#${order.number ?? ""}`,
        order.customer?.name ?? "",
        order.customer?.phone ?? "",
        order.notes ?? "",
        ...order.items.map((item) => item.product_name),
      ]
        .join(" ")
        .toLowerCase();
      return matchesStatus && (!q || haystack.includes(q));
    });
  }, [orders, query, status]);

  const openCount = orders.filter((order) => order.status !== "cancelled").length;

  return (
    <PageShell
      title={`${openCount} pedido${openCount === 1 ? "" : "s"} aberto${openCount === 1 ? "" : "s"}`}
    >
      <div className="mb-5 rounded-lg border border-border bg-surface p-3">
        <div className="flex flex-col gap-3 md:flex-row md:items-center">
          <label className="flex min-w-0 flex-1 items-center gap-2 rounded-md border border-border bg-background px-3 py-2.5 focus-within:border-foreground/40">
            <Search className="h-4 w-4 text-muted-foreground" strokeWidth={1.5} />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Item ou cliente"
              className="w-full bg-transparent text-[13px] outline-none placeholder:text-muted-foreground"
            />
          </label>

          <div className="flex items-center gap-2 text-[13px] text-foreground">
            <Filter className="h-4 w-4 text-muted-foreground" strokeWidth={1.5} />
            <span className="text-muted-foreground">Filtros</span>
          </div>

          <label className="flex items-center gap-2 rounded-md border border-border bg-background px-3 py-2.5">
            <Clock3 className="h-4 w-4 text-muted-foreground" strokeWidth={1.5} />
            <select
              value={status}
              onChange={(event) => setStatus(event.target.value as "all" | OrderStatus)}
              className="bg-transparent text-[13px] font-medium outline-none"
            >
              <option value="all">Todos os status</option>
              {allOrderStatuses.map((item) => (
                <option key={item.value} value={item.value}>
                  {item.label}
                </option>
              ))}
            </select>
          </label>
        </div>
      </div>

      {isLoading ? (
        <div className="grid min-h-[320px] place-items-center rounded-lg border border-border bg-surface">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" strokeWidth={1.5} />
        </div>
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={<ShoppingBag className="h-5 w-5" strokeWidth={1.5} />}
          title="Nenhum pedido encontrado"
          description="Pedidos salvos na tela de venda aparecem aqui automaticamente."
        />
      ) : (
        <div className="overflow-hidden rounded-lg border border-border bg-surface">
          <div className="grid grid-cols-[90px_150px_minmax(160px,1fr)_100px_110px_120px] gap-4 border-b border-border px-4 py-3 text-[12px] font-medium text-muted-foreground">
            <div>Codigo</div>
            <div>Data</div>
            <div>Cliente</div>
            <div>Itens</div>
            <div>Valor</div>
            <div>Status</div>
          </div>
          <div className="divide-y divide-border">
            {filtered.map((order) => (
              <a
                key={order.id}
                href={`/admin/pedidos/${order.id}`}
                className="grid w-full cursor-pointer grid-cols-[90px_150px_minmax(160px,1fr)_100px_110px_120px] gap-4 px-4 py-3 text-left text-[13px] transition-colors hover:bg-muted/50 focus-visible:bg-muted/50 focus-visible:outline-none"
              >
                <div className="font-medium text-foreground">#{order.number ?? "-"}</div>
                <div className="text-muted-foreground">{formatDate(order.created_at)}</div>
                <div className="truncate text-foreground">{order.customer?.name ?? "-"}</div>
                <div className="font-medium text-emerald-600">
                  {order.items.reduce((sum, item) => sum + item.quantity, 0)} item
                  {order.items.reduce((sum, item) => sum + item.quantity, 0) === 1 ? "" : "s"}
                </div>
                <div className="font-medium text-foreground">{formatBRL(order.total)}</div>
                <div>
                  <span
                    className={`rounded px-2 py-1 text-[11.5px] font-medium ${orderStatusClass(order.status)}`}
                  >
                    {orderStatusLabel(order.status)}
                  </span>
                </div>
              </a>
            ))}
          </div>
        </div>
      )}
    </PageShell>
  );
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}
