import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import {
  BarChart3,
  CalendarDays,
  ChevronDown,
  CircleDollarSign,
  Loader2,
  Package,
  ReceiptText,
  ShoppingBag,
  TrendingUp,
  Trophy,
  Users,
} from "lucide-react";
import { useMemo, useState } from "react";
import { PaymentMethodIcon } from "@/components/payment-method-icon";
import { EmptyState } from "@/components/page-shell";
import { useStoreContext } from "@/lib/store-context";
import { formatBRL } from "@/lib/products";
import { isCancelledSale, listOrders, saleDate, type OrderRecord } from "@/lib/orders";
import { paymentMethodLabel, type PaymentMethod } from "@/lib/sales";

export const Route = createFileRoute("/admin/estatisticas")({
  head: () => ({ meta: [{ title: "Estatisticas - VYNKA" }] }),
  component: Estatisticas,
});

type PeriodFilter =
  | "today"
  | "yesterday"
  | "this_week"
  | "last_week"
  | "this_month"
  | "last_month"
  | "this_year"
  | "last_year";

const periodOptions: { value: PeriodFilter; label: string }[] = [
  { value: "today", label: "Hoje" },
  { value: "yesterday", label: "Ontem" },
  { value: "this_week", label: "Esta semana" },
  { value: "last_week", label: "Semana passada" },
  { value: "this_month", label: "Este mês" },
  { value: "last_month", label: "Mês passado" },
  { value: "this_year", label: "Este ano" },
  { value: "last_year", label: "Ano passado" },
];

function Estatisticas() {
  const { currentStore, user } = useStoreContext();
  const storeId = currentStore?.id ?? "";
  const [periodOpen, setPeriodOpen] = useState(false);
  const [period, setPeriod] = useState<PeriodFilter | null>(null);
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  const { data: orders = [], isLoading } = useQuery({
    queryKey: ["orders", storeId, "statistics"],
    queryFn: () => listOrders(storeId, "history"),
    enabled: !!storeId,
  });

  const filteredOrders = useMemo(
    () => filterOrdersByPeriod(orders, period, startDate, endDate),
    [orders, period, startDate, endDate],
  );
  const stats = useMemo(() => buildStats(filteredOrders, user), [filteredOrders, user]);
  const periodLabel = getPeriodLabel(period, startDate, endDate);

  return (
    <div className="flex min-h-svh flex-1 flex-col bg-background">
      <main className="flex-1 px-6 py-7 md:px-8">
        <div className="mx-auto w-full max-w-7xl">
          <div className="mb-6 flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
            <div>
              <h1 className="text-[26px] font-semibold tracking-[0] text-foreground">
                Estatisticas
              </h1>
              <p className="mt-1 text-[13px] text-muted-foreground">
                Visao consolidada de vendas, pedidos, produtos e clientes.
              </p>
            </div>
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
              <div className="rounded-md border border-border bg-surface px-3 py-2 text-[12px] text-muted-foreground">
                Base: vendas concluidas
              </div>
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setPeriodOpen((open) => !open)}
                  className="inline-flex h-9 items-center gap-2 rounded-md border border-border bg-surface px-3 text-[12px] font-medium text-foreground shadow-sm transition-colors hover:bg-muted"
                >
                  <CalendarDays className="h-4 w-4 text-muted-foreground" strokeWidth={1.5} />
                  {periodLabel}
                  <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" strokeWidth={1.5} />
                </button>
                {periodOpen && (
                  <PeriodPopover
                    period={period}
                    startDate={startDate}
                    endDate={endDate}
                    onStartDate={(value) => {
                      setStartDate(value);
                      setPeriod(null);
                    }}
                    onEndDate={(value) => {
                      setEndDate(value);
                      setPeriod(null);
                    }}
                    onSelect={(value) => {
                      setPeriod(value);
                      setStartDate("");
                      setEndDate("");
                      setPeriodOpen(false);
                    }}
                    onClear={() => {
                      setPeriod(null);
                      setStartDate("");
                      setEndDate("");
                      setPeriodOpen(false);
                    }}
                  />
                )}
              </div>
            </div>
          </div>

          {isLoading ? (
            <div className="grid min-h-[420px] place-items-center rounded-lg border border-border bg-surface">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" strokeWidth={1.5} />
            </div>
          ) : stats.salesCount === 0 ? (
            <EmptyState
              icon={<BarChart3 className="h-5 w-5" strokeWidth={1.5} />}
              title="Ainda nao ha vendas concluidas"
              description="Quando vendas forem concluidas, os indicadores aparecem aqui automaticamente."
            />
          ) : (
            <div className="space-y-5">
              <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                <MetricCard
                  icon={<CircleDollarSign className="h-5 w-5" strokeWidth={1.5} />}
                  label="Faturamento"
                  value={formatBRL(stats.revenue)}
                  detail={`${stats.salesCount} venda${stats.salesCount === 1 ? "" : "s"} concluidas`}
                />
                <MetricCard
                  icon={<ShoppingBag className="h-5 w-5" strokeWidth={1.5} />}
                  label="Quantidade de vendas"
                  value={String(stats.salesCount)}
                  detail={`${stats.itemsSold} item${stats.itemsSold === 1 ? "" : "s"} vendido${stats.itemsSold === 1 ? "" : "s"}`}
                />
                <MetricCard
                  icon={<ReceiptText className="h-5 w-5" strokeWidth={1.5} />}
                  label="Ticket medio"
                  value={formatBRL(stats.averageTicket)}
                  detail="Media por venda concluida"
                />
                <MetricCard
                  icon={<TrendingUp className="h-5 w-5" strokeWidth={1.5} />}
                  label="Lucro"
                  value={formatBRL(stats.profit)}
                  detail="Receita menos custo cadastrado"
                />
              </section>

              <section className="grid gap-5 xl:grid-cols-[minmax(0,1.35fr)_minmax(340px,0.85fr)]">
                <Panel title="Faturamento por dia" subtitle="Ultimos 7 dias">
                  <div className="flex h-72 items-end gap-3">
                    {stats.dailyRevenue.map((day) => (
                      <div
                        key={day.key}
                        className="flex min-w-0 flex-1 flex-col items-center gap-2"
                      >
                        <div className="flex h-52 w-full items-end rounded-md bg-muted">
                          <div
                            className="w-full rounded-md bg-primary transition-all"
                            style={{ height: `${Math.max(4, day.percent)}%` }}
                            title={`${day.label}: ${formatBRL(day.total)}`}
                          />
                        </div>
                        <div className="w-full truncate text-center text-[11px] text-muted-foreground">
                          {day.label}
                        </div>
                        <div className="w-full truncate text-center text-[11px] font-medium text-foreground">
                          {formatCompactBRL(day.total)}
                        </div>
                      </div>
                    ))}
                  </div>
                </Panel>

                <Panel
                  title="Meio de pagamento mais utilizado"
                  subtitle={stats.topPayment?.label ?? "Sem dados"}
                >
                  <div className="flex items-center gap-5">
                    <div className="relative grid h-36 w-36 shrink-0 place-items-center rounded-full bg-muted">
                      <div
                        className="absolute inset-0 rounded-full"
                        style={{
                          background: `conic-gradient(hsl(var(--primary)) ${stats.topPaymentShare}%, hsl(var(--muted)) 0)`,
                        }}
                      />
                      <div className="relative grid h-24 w-24 place-items-center rounded-full bg-surface text-center">
                        <div>
                          <div className="text-[24px] font-semibold text-foreground">
                            {Math.round(stats.topPaymentShare)}%
                          </div>
                          <div className="text-[11px] text-muted-foreground">uso</div>
                        </div>
                      </div>
                    </div>
                    <div className="min-w-0 flex-1 space-y-3">
                      {stats.paymentRanking.map((payment) => (
                        <ProgressRow
                          key={payment.key}
                          icon={<PaymentMethodIcon method={payment.key} />}
                          label={payment.label}
                          value={`${payment.count} venda${payment.count === 1 ? "" : "s"}`}
                          percent={payment.percent}
                        />
                      ))}
                    </div>
                  </div>
                </Panel>
              </section>

              <section className="grid gap-5 xl:grid-cols-3">
                <Panel
                  title="Produto mais vendido"
                  subtitle={stats.topProduct?.name ?? "Sem produto"}
                  icon={<Package className="h-4 w-4" strokeWidth={1.5} />}
                >
                  <RankingList
                    rows={stats.productRanking.map((item) => ({
                      id: item.id,
                      label: item.name,
                      detail: `${item.quantity} un. - ${formatBRL(item.revenue)}`,
                      value: item.percent,
                    }))}
                    empty="Nenhum produto vendido."
                  />
                </Panel>

                <Panel
                  title="Ranking de clientes"
                  subtitle="Por faturamento"
                  icon={<Users className="h-4 w-4" strokeWidth={1.5} />}
                >
                  <RankingList
                    rows={stats.customerRanking.map((item) => ({
                      id: item.id,
                      label: item.name,
                      detail: `${item.count} venda${item.count === 1 ? "" : "s"} - ${formatBRL(item.revenue)}`,
                      value: item.percent,
                    }))}
                    empty="Nenhum cliente identificado."
                  />
                </Panel>

                <Panel
                  title="Vendas por usuario"
                  subtitle="Equipe e catalogo"
                  icon={<Trophy className="h-4 w-4" strokeWidth={1.5} />}
                >
                  <RankingList
                    rows={stats.userRanking.map((item) => ({
                      id: item.id,
                      label: item.name,
                      detail: `${item.count} venda${item.count === 1 ? "" : "s"} - ${formatBRL(item.revenue)}`,
                      value: item.percent,
                    }))}
                    empty="Nenhum usuario identificado."
                  />
                </Panel>
              </section>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}

function MetricCard({
  icon,
  label,
  value,
  detail,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  detail: string;
}) {
  return (
    <div className="rounded-lg border border-border bg-surface p-5 shadow-sm">
      <div className="mb-4 flex items-center justify-between">
        <div className="grid h-10 w-10 place-items-center rounded-md bg-muted text-foreground">
          {icon}
        </div>
        <span className="rounded-full bg-primary/10 px-2.5 py-1 text-[10px] font-medium uppercase tracking-[0.12em] text-primary">
          VYNKA
        </span>
      </div>
      <div className="text-[12px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
        {label}
      </div>
      <div className="mt-2 text-[26px] font-semibold tracking-[0] text-foreground">{value}</div>
      <div className="mt-2 text-[12px] text-muted-foreground">{detail}</div>
    </div>
  );
}

function PeriodPopover({
  period,
  startDate,
  endDate,
  onStartDate,
  onEndDate,
  onSelect,
  onClear,
}: {
  period: PeriodFilter | null;
  startDate: string;
  endDate: string;
  onStartDate: (value: string) => void;
  onEndDate: (value: string) => void;
  onSelect: (value: PeriodFilter) => void;
  onClear: () => void;
}) {
  return (
    <div className="absolute right-0 top-11 z-30 w-[328px] overflow-hidden rounded-md border border-border bg-surface shadow-xl">
      <div className="flex items-center justify-between border-b border-border px-4 py-3">
        <h2 className="text-[14px] font-semibold text-foreground">Selecione um período</h2>
        <button
          type="button"
          onClick={onClear}
          className="text-[12px] font-medium text-primary hover:text-foreground"
        >
          Limpar
        </button>
      </div>
      <div className="p-4">
        <div className="grid grid-cols-2 overflow-hidden rounded-md border border-border bg-background">
          <label className="flex h-11 min-w-0 items-center gap-2 border-r border-border px-3">
            <input
              type="date"
              value={startDate}
              onChange={(event) => onStartDate(event.target.value)}
              className="min-w-0 flex-1 bg-transparent text-[12.5px] text-foreground outline-none"
              aria-label="Data inicial"
            />
          </label>
          <label className="flex h-11 min-w-0 items-center gap-2 px-3">
            <input
              type="date"
              value={endDate}
              onChange={(event) => onEndDate(event.target.value)}
              className="min-w-0 flex-1 bg-transparent text-[12.5px] text-foreground outline-none"
              aria-label="Data final"
            />
          </label>
        </div>

        <div className="mt-5 grid grid-cols-2 gap-x-8 gap-y-1">
          {periodOptions.map((option) => (
            <button
              key={option.value}
              type="button"
              onClick={() => onSelect(option.value)}
              className={[
                "rounded-md px-2 py-2.5 text-left text-[13px] font-medium transition-colors",
                period === option.value
                  ? "bg-primary/10 text-primary"
                  : "text-foreground hover:bg-muted",
              ].join(" ")}
            >
              {option.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

function Panel({
  title,
  subtitle,
  icon,
  children,
}: {
  title: string;
  subtitle?: string;
  icon?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-lg border border-border bg-surface p-5 shadow-sm">
      <div className="mb-5 flex items-start justify-between gap-4">
        <div className="min-w-0">
          <h2 className="text-[15px] font-semibold tracking-[0] text-foreground">{title}</h2>
          {subtitle && (
            <p className="mt-1 truncate text-[12px] text-muted-foreground">{subtitle}</p>
          )}
        </div>
        {icon && <div className="grid h-8 w-8 place-items-center rounded-md bg-muted">{icon}</div>}
      </div>
      {children}
    </div>
  );
}

function ProgressRow({
  icon,
  label,
  value,
  percent,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  percent: number;
}) {
  return (
    <div>
      <div className="mb-1.5 flex items-center justify-between gap-3 text-[12.5px]">
        <div className="flex min-w-0 items-center gap-2">
          {icon}
          <span className="truncate font-medium text-foreground">{label}</span>
        </div>
        <span className="shrink-0 text-muted-foreground">{value}</span>
      </div>
      <div className="h-2 rounded-full bg-muted">
        <div className="h-full rounded-full bg-primary" style={{ width: `${percent}%` }} />
      </div>
    </div>
  );
}

function RankingList({
  rows,
  empty,
}: {
  rows: { id: string; label: string; detail: string; value: number }[];
  empty: string;
}) {
  if (rows.length === 0) {
    return (
      <div className="rounded-md bg-muted px-4 py-6 text-center text-[13px] text-muted-foreground">
        {empty}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {rows.slice(0, 6).map((row, index) => (
        <div key={row.id}>
          <div className="mb-1.5 flex items-center justify-between gap-3">
            <div className="flex min-w-0 items-center gap-3">
              <div className="grid h-7 w-7 shrink-0 place-items-center rounded-md bg-muted text-[12px] font-semibold text-foreground">
                {index + 1}
              </div>
              <div className="min-w-0">
                <div className="truncate text-[13px] font-medium text-foreground">{row.label}</div>
                <div className="truncate text-[11.5px] text-muted-foreground">{row.detail}</div>
              </div>
            </div>
            <div className="shrink-0 text-[12px] font-medium text-foreground">
              {Math.round(row.value)}%
            </div>
          </div>
          <div className="ml-10 h-1.5 rounded-full bg-muted">
            <div className="h-full rounded-full bg-primary" style={{ width: `${row.value}%` }} />
          </div>
        </div>
      ))}
    </div>
  );
}

function filterOrdersByPeriod(
  orders: OrderRecord[],
  period: PeriodFilter | null,
  startDate: string,
  endDate: string,
) {
  if (!period && !startDate && !endDate) return orders;
  return orders.filter((order) => {
    if (period) return isInPeriod(saleDate(order), period);

    const day = startOfDay(new Date(saleDate(order)));
    const start = startDate ? parseDateInput(startDate) : null;
    const end = endDate ? parseDateInput(endDate) : null;
    if (start && day < start) return false;
    if (end && day > end) return false;
    return true;
  });
}

function isInPeriod(value: string, period: PeriodFilter) {
  const date = startOfDay(new Date(value));
  const now = startOfDay(new Date());

  if (period === "today") return isSameDay(date, now);
  if (period === "yesterday") {
    const yesterday = new Date(now);
    yesterday.setDate(now.getDate() - 1);
    return isSameDay(date, yesterday);
  }
  if (period === "this_week" || period === "last_week") {
    const start = startOfWeek(now);
    if (period === "last_week") start.setDate(start.getDate() - 7);
    const end = new Date(start);
    end.setDate(start.getDate() + 6);
    return date >= start && date <= end;
  }
  if (period === "this_month" || period === "last_month") {
    const start = new Date(now.getFullYear(), now.getMonth(), 1);
    if (period === "last_month") start.setMonth(start.getMonth() - 1);
    const end = new Date(start.getFullYear(), start.getMonth() + 1, 0);
    return date >= start && date <= end;
  }
  const year = period === "this_year" ? now.getFullYear() : now.getFullYear() - 1;
  return date >= new Date(year, 0, 1) && date <= new Date(year, 11, 31);
}

function getPeriodLabel(period: PeriodFilter | null, startDate: string, endDate: string) {
  if (period) return periodOptions.find((option) => option.value === period)?.label ?? "Período";
  if (startDate || endDate) {
    const start = startDate ? formatDateInput(startDate) : "Inicial";
    const end = endDate ? formatDateInput(endDate) : "Final";
    return `${start} - ${end}`;
  }
  return "Selecione um período";
}

function parseDateInput(value: string) {
  const [year, month, day] = value.split("-").map(Number);
  return startOfDay(new Date(year, month - 1, day));
}

function formatDateInput(value: string) {
  const date = parseDateInput(value);
  return new Intl.DateTimeFormat("pt-BR").format(date);
}

function startOfDay(date: Date) {
  const copy = new Date(date);
  copy.setHours(0, 0, 0, 0);
  return copy;
}

function startOfWeek(date: Date) {
  const copy = startOfDay(date);
  const day = copy.getDay();
  copy.setDate(copy.getDate() - day);
  return copy;
}

function isSameDay(left: Date, right: Date) {
  return (
    left.getFullYear() === right.getFullYear() &&
    left.getMonth() === right.getMonth() &&
    left.getDate() === right.getDate()
  );
}

function buildStats(
  orders: OrderRecord[],
  user: { id?: string; email?: string; user_metadata?: Record<string, unknown> } | null,
) {
  const sales = orders.filter((order) => order.status === "delivered" && !isCancelledSale(order));
  const revenue = sales.reduce((sum, order) => sum + order.total, 0);
  const salesCount = sales.length;
  const itemsSold = sales.reduce((sum, order) => sum + itemCount(order), 0);
  const averageTicket = salesCount ? revenue / salesCount : 0;
  const profit = sales.reduce(
    (sum, order) =>
      sum + order.items.reduce((itemSum, item) => itemSum + (item.total_price - itemCost(item)), 0),
    0,
  );

  const dailyRevenue = buildDailyRevenue(sales);
  const paymentRanking = buildPaymentRanking(sales);
  const productRanking = buildProductRanking(sales);
  const customerRanking = buildCustomerRanking(sales);
  const userRanking = buildUserRanking(sales, user);
  const topPayment = paymentRanking[0] ?? null;
  const topProduct = productRanking[0] ?? null;
  const topPaymentShare = topPayment?.percent ?? 0;

  return {
    revenue,
    salesCount,
    itemsSold,
    averageTicket,
    profit,
    dailyRevenue,
    paymentRanking,
    topPayment,
    topPaymentShare,
    productRanking,
    topProduct,
    customerRanking,
    userRanking,
  };
}

function buildDailyRevenue(sales: OrderRecord[]) {
  const days = Array.from({ length: 7 }, (_, index) => {
    const date = new Date();
    date.setDate(date.getDate() - (6 - index));
    date.setHours(0, 0, 0, 0);
    return {
      key: date.toISOString().slice(0, 10),
      label: new Intl.DateTimeFormat("pt-BR", { weekday: "short" }).format(date).replace(".", ""),
      total: 0,
      percent: 0,
    };
  });
  const byKey = new Map(days.map((day) => [day.key, day]));

  for (const sale of sales) {
    const key = new Date(saleDate(sale)).toISOString().slice(0, 10);
    const day = byKey.get(key);
    if (day) day.total += sale.total;
  }

  const max = Math.max(1, ...days.map((day) => day.total));
  return days.map((day) => ({ ...day, percent: (day.total / max) * 100 }));
}

function buildPaymentRanking(sales: OrderRecord[]) {
  const map = new Map<
    string,
    { key: PaymentMethod | string; label: string; count: number; revenue: number }
  >();
  for (const sale of sales) {
    const key = sale.payment_method || "unknown";
    const current = map.get(key) ?? {
      key,
      label: paymentLabel(key),
      count: 0,
      revenue: 0,
    };
    current.count += 1;
    current.revenue += sale.total;
    map.set(key, current);
  }
  const total = Math.max(1, sales.length);
  return [...map.values()]
    .map((item) => ({ ...item, percent: (item.count / total) * 100 }))
    .sort((a, b) => b.count - a.count || b.revenue - a.revenue);
}

function buildProductRanking(sales: OrderRecord[]) {
  const map = new Map<string, { id: string; name: string; quantity: number; revenue: number }>();
  for (const sale of sales) {
    for (const item of sale.items) {
      const id = item.product_id ?? item.product_name;
      const current = map.get(id) ?? { id, name: item.product_name, quantity: 0, revenue: 0 };
      current.quantity += item.quantity;
      current.revenue += item.total_price;
      map.set(id, current);
    }
  }
  const max = Math.max(1, ...[...map.values()].map((item) => item.quantity));
  return [...map.values()]
    .map((item) => ({ ...item, percent: (item.quantity / max) * 100 }))
    .sort((a, b) => b.quantity - a.quantity || b.revenue - a.revenue);
}

function buildCustomerRanking(sales: OrderRecord[]) {
  const map = new Map<string, { id: string; name: string; count: number; revenue: number }>();
  for (const sale of sales) {
    const id = sale.customer_id ?? "no-customer";
    const name = sale.customer?.name ?? "Cliente nao informado";
    const current = map.get(id) ?? { id, name, count: 0, revenue: 0 };
    current.count += 1;
    current.revenue += sale.total;
    map.set(id, current);
  }
  const max = Math.max(1, ...[...map.values()].map((item) => item.revenue));
  return [...map.values()]
    .map((item) => ({ ...item, percent: (item.revenue / max) * 100 }))
    .sort((a, b) => b.revenue - a.revenue || b.count - a.count);
}

function buildUserRanking(
  sales: OrderRecord[],
  user: { id?: string; email?: string; user_metadata?: Record<string, unknown> } | null,
) {
  const map = new Map<string, { id: string; name: string; count: number; revenue: number }>();
  for (const sale of sales) {
    const id = sale.created_by ?? "catalog";
    const name = sale.created_by ? sellerName(sale, user) : "Catalogo";
    const current = map.get(id) ?? { id, name, count: 0, revenue: 0 };
    current.count += 1;
    current.revenue += sale.total;
    map.set(id, current);
  }
  const max = Math.max(1, ...[...map.values()].map((item) => item.revenue));
  return [...map.values()]
    .map((item) => ({ ...item, percent: (item.revenue / max) * 100 }))
    .sort((a, b) => b.revenue - a.revenue || b.count - a.count);
}

function itemCount(order: OrderRecord) {
  return order.items.reduce((sum, item) => sum + item.quantity, 0);
}

function itemCost(item: OrderRecord["items"][number]) {
  if (Number.isFinite(item.total_cost)) return item.total_cost;
  if (Number.isFinite(item.unit_cost)) return item.unit_cost * item.quantity;
  return 0;
}

function paymentLabel(method: string | null | undefined) {
  if (!method) return "Nao informado";
  return paymentMethodLabel[method as PaymentMethod] ?? method;
}

function sellerName(
  order: OrderRecord,
  user: { id?: string; email?: string; user_metadata?: Record<string, unknown> } | null,
) {
  if (order.created_by && order.created_by === user?.id) return userDisplayName(user);
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

function formatCompactBRL(value: number) {
  if (value >= 1000) return `R$ ${(value / 1000).toFixed(1)}k`;
  return formatBRL(value);
}
