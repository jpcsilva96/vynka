import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  CalendarDays,
  ChevronDown,
  Filter,
  Loader2,
  Search,
  ShoppingBag,
  UserRound,
  Users,
  X,
  XCircle,
} from "lucide-react";
import { useMemo, useState } from "react";
import { PaymentMethodIcon } from "@/components/payment-method-icon";
import { EmptyState } from "@/components/page-shell";
import { useStoreContext } from "@/lib/store-context";
import { formatBRL } from "@/lib/products";
import {
  cancelSale,
  isCancelledSale,
  listOrders,
  orderStatusClass,
  orderStatusLabel,
  type OrderRecord,
} from "@/lib/orders";
import { paymentMethodLabel, type PaymentMethod } from "@/lib/sales";

export const Route = createFileRoute("/admin/historico/")({
  head: () => ({ meta: [{ title: "Historico de vendas - VYNKA" }] }),
  component: Historico,
});

type PeriodFilter =
  | "last30"
  | "today"
  | "yesterday"
  | "this_week"
  | "last_week"
  | "this_month"
  | "last_month"
  | "this_year"
  | "last_year";

const paymentMethods: { value: PaymentMethod; label: string }[] = [
  { value: "pix", label: "Pix" },
  { value: "cash", label: "Dinheiro" },
  { value: "debit", label: "Cartao de Debito" },
  { value: "credit", label: "Cartao de Credito" },
  { value: "payment_link", label: "Link de Pagamento" },
];

const periodOptions: { value: PeriodFilter; label: string }[] = [
  { value: "last30", label: "Ultimos 30 dias" },
  { value: "today", label: "Hoje" },
  { value: "yesterday", label: "Ontem" },
  { value: "this_week", label: "Esta semana" },
  { value: "last_week", label: "Semana passada" },
  { value: "this_month", label: "Este mes" },
  { value: "last_month", label: "Mes passado" },
  { value: "this_year", label: "Este ano" },
  { value: "last_year", label: "Ano passado" },
];

function Historico() {
  const { currentStore, user } = useStoreContext();
  const storeId = currentStore?.id ?? "";
  const [query, setQuery] = useState("");
  const [filterOpen, setFilterOpen] = useState(false);
  const [sellerOpen, setSellerOpen] = useState(false);
  const [periods, setPeriods] = useState<PeriodFilter[]>([]);
  const [paymentMethodsSelected, setPaymentMethodsSelected] = useState<PaymentMethod[]>([]);
  const [cancelledOnly, setCancelledOnly] = useState(false);
  const [seller, setSeller] = useState<"all" | "catalog" | string>("all");
  const queryClient = useQueryClient();

  const { data: orders = [], isLoading } = useQuery({
    queryKey: ["orders", storeId, "history"],
    queryFn: () => listOrders(storeId, "history"),
    enabled: !!storeId,
  });

  const currentSellerName = userDisplayName(user);
  const sellerOptions = [
    { value: "all", label: "Todos os vendedores" },
    { value: "catalog", label: "Catalogo" },
    ...(user?.id ? [{ value: user.id, label: currentSellerName }] : []),
  ];

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return orders.filter((order) => {
      const matchesCancelled = cancelledOnly
        ? isCancelledSale(order)
        : order.status === "delivered";
      const matchesPayment =
        paymentMethodsSelected.length === 0 ||
        paymentMethodsSelected.includes(order.payment_method as PaymentMethod);
      const matchesSeller =
        seller === "all" ||
        (seller === "catalog" ? !order.created_by : order.created_by === seller);
      const matchesPeriod =
        periods.length === 0 || periods.some((period) => isInPeriod(order.created_at, period));
      const haystack = [
        `#${order.number ?? ""}`,
        order.customer?.name ?? "",
        order.notes ?? "",
        paymentLabel(order.payment_method),
        ...order.items.map((item) => item.product_name),
      ]
        .join(" ")
        .toLowerCase();
      return (
        matchesCancelled &&
        matchesPayment &&
        matchesSeller &&
        matchesPeriod &&
        (!q || haystack.includes(q))
      );
    });
  }, [orders, query, cancelledOnly, paymentMethodsSelected, seller, periods]);

  const stats = useMemo(
    () => buildStats(orders.filter((order) => order.status !== "cancelled")),
    [orders],
  );

  const cancelMutation = useMutation({
    mutationFn: (orderId: string) => cancelSale(storeId, orderId),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["orders", storeId] });
    },
  });

  return (
    <div className="flex min-h-svh flex-1 flex-col bg-background">
      <main className="flex-1 px-6 py-7 md:px-8">
        <div className="mx-auto w-full max-w-7xl">
          <h1 className="mb-4 text-[26px] font-semibold tracking-[0] text-foreground">
            Historico de vendas
          </h1>

          <div className="overflow-visible rounded-lg border border-border bg-surface shadow-sm">
            <div className="flex flex-col gap-3 p-3 md:flex-row md:items-center">
              <label className="flex min-w-0 flex-1 items-center gap-2 rounded-md border border-border bg-background px-3 py-2.5 focus-within:border-foreground/40 md:max-w-[520px]">
                <input
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Nome do cliente ou produto"
                  className="w-full bg-transparent text-[13px] outline-none placeholder:text-muted-foreground"
                />
                <Search className="h-5 w-5 text-foreground" strokeWidth={1.5} />
              </label>

              <button
                type="button"
                onClick={() => setFilterOpen(true)}
                className="inline-flex items-center gap-2 rounded-md px-3 py-2.5 text-[13px] font-medium text-foreground hover:bg-muted"
              >
                <Filter className="h-4 w-4 text-muted-foreground" strokeWidth={1.5} />
                Filtros
              </button>

              <div className="relative">
                <button
                  type="button"
                  onClick={() => setSellerOpen((value) => !value)}
                  className="inline-flex items-center gap-2 rounded-md px-3 py-2.5 text-[13px] font-medium text-foreground hover:bg-muted"
                >
                  <Users className="h-4 w-4 text-muted-foreground" strokeWidth={1.5} />
                  {sellerOptions.find((option) => option.value === seller)?.label ??
                    "Todos os vendedores"}
                  <ChevronDown className="h-4 w-4 text-muted-foreground" strokeWidth={1.5} />
                </button>

                {sellerOpen && (
                  <div className="absolute left-0 top-12 z-30 w-64 rounded-lg border border-border bg-background shadow-xl">
                    <div className="flex items-center justify-between border-b border-border px-4 py-3">
                      <span className="text-[14px] font-medium text-foreground">
                        Filtrar por vendedor
                      </span>
                      <button
                        type="button"
                        onClick={() => setSeller("all")}
                        className="text-[12px] font-medium text-primary hover:text-foreground"
                      >
                        Limpar
                      </button>
                    </div>
                    <div className="space-y-1 p-3">
                      {sellerOptions.map((option) => (
                        <button
                          key={option.value}
                          type="button"
                          onClick={() => {
                            setSeller(option.value);
                            setSellerOpen(false);
                          }}
                          className="flex w-full items-center gap-3 rounded-md px-2 py-2 text-left text-[13px] text-foreground hover:bg-muted"
                        >
                          <span
                            className={`grid h-4 w-4 place-items-center rounded border ${
                              seller === option.value
                                ? "border-primary bg-primary"
                                : "border-border bg-background"
                            }`}
                          />
                          {option.value === "catalog" ? (
                            <ShoppingBag
                              className="h-4 w-4 text-muted-foreground"
                              strokeWidth={1.5}
                            />
                          ) : (
                            <UserRound
                              className="h-4 w-4 text-muted-foreground"
                              strokeWidth={1.5}
                            />
                          )}
                          {option.label}
                        </button>
                      ))}
                    </div>
                    <div className="px-4 py-4">
                      <button
                        type="button"
                        onClick={() => setSellerOpen(false)}
                        className="w-full rounded-md bg-primary px-4 py-2.5 text-[12.5px] font-medium text-primary-foreground hover:bg-graphite"
                      >
                        Filtrar historico
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>

            <div className="grid gap-4 bg-muted px-4 py-3 text-[12px] text-foreground md:grid-cols-4">
              <Stat
                label={`Hoje: ${stats.today.count} venda${stats.today.count === 1 ? "" : "s"}`}
                value={stats.today.total}
              />
              <Stat
                label={`Ontem: ${stats.yesterday.count} venda${stats.yesterday.count === 1 ? "" : "s"}`}
                value={stats.yesterday.total}
              />
              <Stat
                label={`Esta semana: ${stats.week.count} venda${stats.week.count === 1 ? "" : "s"}`}
                value={stats.week.total}
              />
              <Stat
                label={`Este mes: ${stats.month.count} venda${stats.month.count === 1 ? "" : "s"}`}
                value={stats.month.total}
              />
            </div>
          </div>

          <div className="mt-5">
            {isLoading ? (
              <div className="grid min-h-[320px] place-items-center rounded-lg border border-border bg-surface">
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" strokeWidth={1.5} />
              </div>
            ) : filtered.length === 0 ? (
              <EmptyState
                icon={<ShoppingBag className="h-5 w-5" strokeWidth={1.5} />}
                title="Nenhuma venda encontrada"
                description="Ajuste os filtros ou conclua novas vendas para alimentar o historico."
              />
            ) : (
              <div className="overflow-hidden rounded-lg border border-transparent">
                <div className="grid grid-cols-[90px_150px_minmax(160px,1fr)_minmax(150px,1fr)_90px_140px_88px] gap-4 border-b border-foreground/40 px-3 py-3 text-[12px] font-medium text-muted-foreground">
                  <div>Codigo</div>
                  <div>Data</div>
                  <div>Cliente</div>
                  <div>Vendedor</div>
                  <div>Itens</div>
                  <div>Valor</div>
                  <div>Acoes</div>
                </div>
                <div className="divide-y divide-border">
                  {filtered.map((order) => (
                    <a
                      key={order.id}
                      href={`/admin/historico/${order.id}`}
                      className="grid min-h-[58px] grid-cols-[90px_150px_minmax(160px,1fr)_minmax(150px,1fr)_90px_140px_88px] items-center gap-4 px-3 text-[13px] transition-colors hover:bg-muted/45"
                    >
                      <div className="font-medium text-foreground">#{order.number ?? "-"}</div>
                      <div className="text-foreground/80">{formatDate(order.created_at)}</div>
                      <div className="truncate text-foreground/80">
                        {order.customer?.name ?? "-"}
                      </div>
                      <div className="truncate text-foreground/80">
                        {sellerName(order, user?.id, currentSellerName)}
                      </div>
                      <div className="font-medium text-primary">
                        {itemCount(order)} item{itemCount(order) === 1 ? "" : "s"}
                      </div>
                      <div className="inline-flex items-center gap-2 font-medium text-foreground">
                        <PaymentMethodIcon method={order.payment_method} />
                        {formatBRL(order.total)}
                      </div>
                      <div>
                        <button
                          type="button"
                          disabled={order.status === "cancelled" || cancelMutation.isPending}
                          onClick={(event) => {
                            event.preventDefault();
                            event.stopPropagation();
                            const confirmed = window.confirm("Cancelar esta venda?");
                            if (confirmed) cancelMutation.mutate(order.id);
                          }}
                          className="grid h-8 w-8 place-items-center rounded-md bg-surface text-red-600 hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-40"
                          aria-label="Cancelar venda"
                          title="Cancelar venda"
                        >
                          <XCircle className="h-4 w-4" strokeWidth={1.5} />
                        </button>
                      </div>
                    </a>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </main>

      {filterOpen && (
        <FilterDrawer
          periods={periods}
          paymentMethodsSelected={paymentMethodsSelected}
          cancelledOnly={cancelledOnly}
          onClose={() => setFilterOpen(false)}
          onTogglePeriod={(period) =>
            setPeriods((current) =>
              current.includes(period)
                ? current.filter((item) => item !== period)
                : [...current, period],
            )
          }
          onTogglePayment={(method) =>
            setPaymentMethodsSelected((current) =>
              current.includes(method)
                ? current.filter((item) => item !== method)
                : [...current, method],
            )
          }
          onToggleCancelled={() => setCancelledOnly((value) => !value)}
          onApply={() => setFilterOpen(false)}
        />
      )}
    </div>
  );
}

function FilterDrawer({
  periods,
  paymentMethodsSelected,
  cancelledOnly,
  onClose,
  onTogglePeriod,
  onTogglePayment,
  onToggleCancelled,
  onApply,
}: {
  periods: PeriodFilter[];
  paymentMethodsSelected: PaymentMethod[];
  cancelledOnly: boolean;
  onClose: () => void;
  onTogglePeriod: (period: PeriodFilter) => void;
  onTogglePayment: (method: PaymentMethod) => void;
  onToggleCancelled: () => void;
  onApply: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 bg-black/35">
      <aside className="ml-auto flex h-full w-full max-w-sm flex-col bg-background shadow-2xl">
        <div className="flex items-center justify-between border-b border-border px-5 py-4">
          <h2 className="text-[16px] font-medium text-foreground">Filtros</h2>
          <button
            type="button"
            onClick={onClose}
            className="grid h-8 w-8 place-items-center rounded-full text-muted-foreground hover:bg-muted hover:text-foreground"
            aria-label="Fechar filtros"
          >
            <X className="h-4 w-4" strokeWidth={1.6} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4">
          <section className="border-b border-border pb-5">
            <h3 className="mb-4 text-[15px] font-medium text-foreground">Periodo</h3>
            <div className="mb-4 grid grid-cols-2 overflow-hidden rounded-md border border-border">
              <div className="flex h-11 items-center justify-between border-r border-border px-3 text-[13px] text-muted-foreground">
                Inicial
                <CalendarDays className="h-4 w-4" strokeWidth={1.5} />
              </div>
              <div className="flex h-11 items-center justify-between px-3 text-[13px] text-muted-foreground">
                Final
                <CalendarDays className="h-4 w-4" strokeWidth={1.5} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-x-6 gap-y-3">
              {periodOptions.map((option) => (
                <CheckboxRow
                  key={option.value}
                  checked={periods.includes(option.value)}
                  label={option.label}
                  onClick={() => onTogglePeriod(option.value)}
                />
              ))}
            </div>
          </section>

          <section className="border-b border-border py-5">
            <h3 className="mb-4 text-[15px] font-medium text-foreground">Meio de Pagamento</h3>
            <div className="grid grid-cols-2 gap-x-6 gap-y-3">
              {paymentMethods.map((method) => (
                <CheckboxRow
                  key={method.value}
                  checked={paymentMethodsSelected.includes(method.value)}
                  label={method.label}
                  icon={<PaymentMethodIcon method={method.value} />}
                  onClick={() => onTogglePayment(method.value)}
                />
              ))}
            </div>
          </section>

          <section className="border-b border-border py-5">
            <h3 className="mb-4 text-[15px] font-medium text-foreground">Vendas Canceladas</h3>
            <button
              type="button"
              onClick={onToggleCancelled}
              className="flex items-center gap-3 text-[13px] font-medium text-foreground"
            >
              <span
                className={`flex h-4 w-8 items-center rounded-full p-0.5 transition-colors ${
                  cancelledOnly ? "bg-primary" : "bg-border"
                }`}
              >
                <span
                  className={`h-3 w-3 rounded-full bg-white transition-transform ${
                    cancelledOnly ? "translate-x-4" : ""
                  }`}
                />
              </span>
              Somente vendas canceladas
            </button>
          </section>

          <section className="border-b border-border py-5">
            <button
              type="button"
              className="flex items-center gap-3 text-[15px] font-medium text-foreground"
            >
              <ChevronDown className="-rotate-90 h-4 w-4 text-muted-foreground" strokeWidth={1.5} />
              Vendedores
            </button>
          </section>
        </div>

        <div className="flex justify-end border-t border-border px-5 py-4">
          <button
            type="button"
            onClick={onApply}
            className="rounded-md bg-primary px-4 py-2.5 text-[12.5px] font-medium text-primary-foreground hover:bg-graphite"
          >
            Filtrar
          </button>
        </div>
      </aside>
    </div>
  );
}

function CheckboxRow({
  checked,
  label,
  icon,
  onClick,
}: {
  checked: boolean;
  label: string;
  icon?: React.ReactNode;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex items-center gap-3 text-left text-[13px] text-foreground"
    >
      <span
        className={`grid h-4 w-4 place-items-center rounded border ${
          checked ? "border-primary bg-primary" : "border-border bg-background"
        }`}
      >
        {checked && <X className="h-2.5 w-2.5 text-primary-foreground" strokeWidth={2} />}
      </span>
      {icon}
      {label}
    </button>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div>
      <div className="font-medium text-foreground">{label}</div>
      <div className="mt-1 text-foreground">{formatBRL(value)}</div>
    </div>
  );
}

function buildStats(orders: OrderRecord[]) {
  const now = new Date();
  const today = orders.filter((order) => isSameDay(order.created_at, now));
  const yesterdayDate = new Date(now);
  yesterdayDate.setDate(now.getDate() - 1);
  const yesterday = orders.filter((order) => isSameDay(order.created_at, yesterdayDate));
  const week = orders.filter((order) => isInPeriod(order.created_at, "this_week"));
  const month = orders.filter((order) => isInPeriod(order.created_at, "this_month"));
  return {
    today: stat(today),
    yesterday: stat(yesterday),
    week: stat(week),
    month: stat(month),
  };
}

function stat(orders: OrderRecord[]) {
  return {
    count: orders.length,
    total: orders.reduce((sum, order) => sum + order.total, 0),
  };
}

function isInPeriod(value: string, period: PeriodFilter) {
  const date = new Date(value);
  const now = new Date();
  const start = new Date(now);
  const end = new Date(now);

  if (period === "last30") {
    start.setDate(now.getDate() - 30);
    return date >= start && date <= now;
  }
  if (period === "today") return isSameDay(value, now);
  if (period === "yesterday") {
    start.setDate(now.getDate() - 1);
    return isSameDay(value, start);
  }
  if (period === "this_week" || period === "last_week") {
    const first = startOfWeek(now);
    if (period === "last_week") first.setDate(first.getDate() - 7);
    const last = new Date(first);
    last.setDate(first.getDate() + 7);
    return date >= first && date < last;
  }
  if (period === "this_month" || period === "last_month") {
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    if (period === "last_month") monthStart.setMonth(monthStart.getMonth() - 1);
    const nextMonth = new Date(monthStart.getFullYear(), monthStart.getMonth() + 1, 1);
    return date >= monthStart && date < nextMonth;
  }
  if (period === "this_year" || period === "last_year") {
    const year = period === "this_year" ? now.getFullYear() : now.getFullYear() - 1;
    return date >= new Date(year, 0, 1) && date < new Date(year + 1, 0, 1);
  }
  return true;
}

function startOfWeek(date: Date) {
  const copy = new Date(date);
  const day = copy.getDay();
  copy.setHours(0, 0, 0, 0);
  copy.setDate(copy.getDate() - day);
  return copy;
}

function isSameDay(value: string, date: Date) {
  const current = new Date(value);
  return (
    current.getFullYear() === date.getFullYear() &&
    current.getMonth() === date.getMonth() &&
    current.getDate() === date.getDate()
  );
}

function itemCount(order: OrderRecord) {
  return order.items.reduce((sum, item) => sum + item.quantity, 0);
}

function paymentLabel(method: string | null | undefined) {
  if (!method) return "-";
  return paymentMethodLabel[method as PaymentMethod] ?? method;
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
    year: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}
