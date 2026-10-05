import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import {
  ArrowDownCircle,
  ArrowUpCircle,
  ChevronLeft,
  ChevronRight,
  Loader2,
  Pencil,
  Plus,
  Scale,
  Tags,
  Trash2,
  Wallet,
} from "lucide-react";
import { PageShell } from "@/components/page-shell";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  adjustBalance,
  createFinanceCategory,
  createFinanceEntry,
  deleteFinanceEntry,
  getFinanceSummary,
  listFinanceCategories,
  listFinanceEntries,
  listSalesInRange,
  monthRange,
  parseMoney,
  todayISO,
  updateFinanceCategory,
  updateFinanceEntry,
  CATEGORY_COLORS,
  type CategoryColor,
  type FinanceCategory,
  type FinanceEntry,
  type FinanceStatus,
  type SaleLine,
} from "@/lib/finance";
import { getOrder, saleDate } from "@/lib/orders";
import { formatBRL } from "@/lib/products";
import { paymentMethodLabel, type PaymentMethod } from "@/lib/sales";
import { useStoreContext } from "@/lib/store-context";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/admin/financas")({
  head: () => ({ meta: [{ title: "Finanças · VYNKA" }] }),
  component: Financas,
});

type Filter = "all" | "income" | "expense" | "pending";
type FormState = {
  id: string | null;
  kind: "income" | "expense";
  amount: string;
  category_id: string;
  newCategory: string;
  newCategoryColor: CategoryColor;
  description: string;
  entry_date: string;
  status: FinanceStatus;
  notes: string;
};
type Row =
  | { type: "sale"; day: string; key: string; sale: SaleLine }
  | { type: "entry"; day: string; key: string; entry: FinanceEntry };

const MONTHS = [
  "Janeiro",
  "Fevereiro",
  "Março",
  "Abril",
  "Maio",
  "Junho",
  "Julho",
  "Agosto",
  "Setembro",
  "Outubro",
  "Novembro",
  "Dezembro",
];

function emptyForm(kind: "income" | "expense", day: string): FormState {
  return {
    id: null,
    kind,
    amount: "",
    category_id: "",
    newCategory: "",
    newCategoryColor: "slate",
    description: "",
    entry_date: day,
    status: "paid",
    notes: "",
  };
}

function Financas() {
  const { currentStore } = useStoreContext();
  const storeId = currentStore?.id ?? "";
  const queryClient = useQueryClient();
  const now = new Date();
  const [ym, setYm] = useState({ year: now.getFullYear(), month: now.getMonth() });
  const { from, to } = monthRange(ym.year, ym.month);
  const [filter, setFilter] = useState<Filter>("all");
  const [form, setForm] = useState<FormState | null>(null);
  const [adjustOpen, setAdjustOpen] = useState(false);
  const [saleOpen, setSaleOpen] = useState<string | null>(null);
  const [categoriesOpen, setCategoriesOpen] = useState(false);

  const summaryQ = useQuery({
    queryKey: ["finance-summary", storeId, from, to],
    queryFn: () => getFinanceSummary(storeId, from, to),
    enabled: !!storeId,
  });
  const entriesQ = useQuery({
    queryKey: ["finance-entries", storeId, from, to],
    queryFn: () => listFinanceEntries(storeId, from, to),
    enabled: !!storeId,
  });
  const salesQ = useQuery({
    queryKey: ["finance-sales", storeId, from, to],
    queryFn: () => listSalesInRange(storeId, from, to),
    enabled: !!storeId,
  });
  const categoriesQ = useQuery({
    queryKey: ["finance-categories", storeId],
    queryFn: () => listFinanceCategories(storeId),
    enabled: !!storeId,
  });
  const categories = useMemo(() => categoriesQ.data ?? [], [categoriesQ.data]);
  const catById = useMemo(() => new Map(categories.map((c) => [c.id, c])), [categories]);

  const refresh = () => {
    void queryClient.invalidateQueries({ queryKey: ["finance-summary", storeId] });
    void queryClient.invalidateQueries({ queryKey: ["finance-entries", storeId] });
    void queryClient.invalidateQueries({ queryKey: ["finance-categories", storeId] });
  };

  const togglePaid = useMutation({
    mutationFn: (e: FinanceEntry) =>
      updateFinanceEntry(e.id, { status: e.status === "paid" ? "pending" : "paid" }),
    onSuccess: refresh,
  });
  const remove = useMutation({
    mutationFn: (id: string) => deleteFinanceEntry(id),
    onSuccess: refresh,
  });

  const s = summaryQ.data;
  const income = s ? s.sales_revenue + s.other_income : 0;
  const expense = s ? s.sales_cost + s.expenses : 0;
  const result = income - expense;
  const forecast = s ? result + s.pending_income - s.pending_expense : 0;

  const groups = useMemo(() => {
    const list: Row[] = [];
    if (filter !== "pending") {
      for (const sale of salesQ.data ?? [])
        list.push({ type: "sale", day: sale.day, key: `s-${sale.id}`, sale });
    }
    for (const entry of entriesQ.data ?? []) {
      if (filter === "income" && entry.kind !== "income") continue;
      if (filter === "expense" && entry.kind !== "expense") continue;
      if (filter === "pending" && entry.status !== "pending") continue;
      list.push({ type: "entry", day: entry.entry_date, key: `e-${entry.id}`, entry });
    }
    list.sort((a, b) => (a.day < b.day ? 1 : a.day > b.day ? -1 : 0));
    const out: { day: string; rows: Row[] }[] = [];
    for (const row of list) {
      const last = out[out.length - 1];
      if (last && last.day === row.day) last.rows.push(row);
      else out.push({ day: row.day, rows: [row] });
    }
    return out;
  }, [salesQ.data, entriesQ.data, filter]);

  const loading = summaryQ.isLoading || entriesQ.isLoading || salesQ.isLoading;
  const loadError = summaryQ.isError || entriesQ.isError || salesQ.isError;
  const shiftMonth = (delta: number) =>
    setYm(({ year, month }) => {
      const d = new Date(year, month + delta, 1);
      return { year: d.getFullYear(), month: d.getMonth() };
    });
  const isCurrentMonth = ym.year === now.getFullYear() && ym.month === now.getMonth();
  const defaultDay = isCurrentMonth ? todayISO() : from;

  return (
    <PageShell
      title="Finanças"
      description="Saldo da loja, receitas e despesas. Vendas concluídas entram sozinhas."
      actions={
        <>
          <button
            onClick={() => setCategoriesOpen(true)}
            className="inline-flex items-center gap-1.5 rounded-md px-3 py-2 text-[13px] font-medium text-muted-foreground hover:bg-muted hover:text-foreground"
          >
            <Tags className="h-3.5 w-3.5" /> Categorias
          </button>
          <button
            onClick={() => setForm(emptyForm("income", defaultDay))}
            className="inline-flex items-center gap-1.5 rounded-md border border-border bg-surface px-3.5 py-2 text-[13px] font-medium text-foreground hover:bg-muted"
          >
            <Plus className="h-3.5 w-3.5" /> Receita
          </button>
          <button
            onClick={() => setForm(emptyForm("expense", defaultDay))}
            className="inline-flex items-center gap-1.5 rounded-md bg-foreground px-3.5 py-2 text-[13px] font-medium text-background hover:opacity-90"
          >
            <Plus className="h-3.5 w-3.5" /> Despesa
          </button>
        </>
      }
    >
      <div className="mb-6 flex items-center justify-between gap-3">
        <div className="flex items-center gap-1">
          <button
            onClick={() => shiftMonth(-1)}
            className="grid h-8 w-8 place-items-center rounded-md hover:bg-muted"
            aria-label="Mês anterior"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <span className="min-w-[150px] text-center text-[15px] font-medium text-foreground">
            {MONTHS[ym.month]} {ym.year}
          </span>
          <button
            onClick={() => shiftMonth(1)}
            className="grid h-8 w-8 place-items-center rounded-md hover:bg-muted"
            aria-label="Próximo mês"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
        {loading && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
      </div>

      {loadError && (
        <p className="mb-4 rounded-md bg-red-50 px-4 py-3 text-[13px] text-red-700">
          Não foi possível carregar as finanças. Recarregue a página.
        </p>
      )}

      <section className="grid grid-cols-1 gap-px overflow-hidden rounded-lg border border-border bg-border sm:grid-cols-2 lg:grid-cols-4">
        <div className="bg-surface p-6">
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="text-[12px] uppercase tracking-[0.14em]">Saldo atual</span>
            <Wallet className="h-4 w-4" strokeWidth={1.5} />
          </div>
          <div
            className={cn(
              "mt-4 text-[28px] font-light tracking-tight",
              s && s.balance < 0 ? "text-red-600" : "text-foreground",
            )}
          >
            {s ? formatBRL(s.balance) : "…"}
          </div>
          <button
            onClick={() => setAdjustOpen(true)}
            disabled={!s}
            className="mt-2 inline-flex items-center gap-1 text-[12px] text-muted-foreground hover:text-foreground disabled:opacity-50"
          >
            <Scale className="h-3.5 w-3.5" /> Ajustar saldo
          </button>
        </div>
        <SummaryCard
          label="Receitas do mês"
          value={s ? formatBRL(income) : "…"}
          hint={
            s ? `Vendas ${formatBRL(s.sales_revenue)} · avulsas ${formatBRL(s.other_income)}` : ""
          }
          tone="up"
        />
        <SummaryCard
          label="Despesas do mês"
          value={s ? formatBRL(expense) : "…"}
          hint={
            s ? `Custo das vendas ${formatBRL(s.sales_cost)} · outras ${formatBRL(s.expenses)}` : ""
          }
          tone="down"
        />
        <SummaryCard
          label="Resultado do mês"
          value={s ? formatBRL(result) : "…"}
          hint={s ? `Previsto com pendentes: ${formatBRL(forecast)}` : ""}
          tone={result < 0 ? "down" : "neutral"}
        />
      </section>

      <div className="mt-8 flex flex-wrap gap-2">
        {(
          [
            ["all", "Tudo"],
            ["income", "Receitas"],
            ["expense", "Despesas"],
            ["pending", "Pendentes"],
          ] as [Filter, string][]
        ).map(([value, label]) => (
          <button
            key={value}
            onClick={() => setFilter(value)}
            className={cn(
              "rounded-full border px-3 py-1 text-[12px]",
              filter === value
                ? "border-foreground bg-foreground text-background"
                : "border-border text-muted-foreground hover:text-foreground",
            )}
          >
            {label}
          </button>
        ))}
      </div>

      <section className="mt-4 overflow-hidden rounded-lg border border-border bg-surface">
        {groups.length === 0 ? (
          <p className="px-6 py-12 text-center text-[13px] text-muted-foreground">
            {loading ? "Carregando..." : "Nenhum lançamento neste mês."}
          </p>
        ) : (
          groups.map((group) => (
            <div key={group.day}>
              <div className="border-b border-border bg-muted/40 px-4 py-2 text-[12px] font-medium capitalize text-muted-foreground md:px-6">
                {new Date(`${group.day}T12:00:00`).toLocaleDateString("pt-BR", {
                  weekday: "long",
                  day: "2-digit",
                  month: "long",
                })}
              </div>
              <ul className="divide-y divide-border border-b border-border">
                {group.rows.map((row) =>
                  row.type === "sale" ? (
                    <SaleRow
                      key={row.key}
                      sale={row.sale}
                      hideCost={filter === "income"}
                      costOnly={filter === "expense"}
                      onOpen={() => setSaleOpen(row.sale.id)}
                    />
                  ) : (
                    <EntryRow
                      key={row.key}
                      entry={row.entry}
                      category={
                        row.entry.category_id ? catById.get(row.entry.category_id) : undefined
                      }
                      onEdit={() => {
                        const e = row.entry;
                        if (e.kind === "adjustment") return;
                        setForm({
                          id: e.id,
                          kind: e.kind,
                          amount: e.amount.toFixed(2).replace(".", ","),
                          category_id: e.category_id ?? "",
                          newCategory: "",
                          newCategoryColor: "slate",
                          description: e.description,
                          entry_date: e.entry_date,
                          status: e.status,
                          notes: e.notes ?? "",
                        });
                      }}
                      onToggle={() => togglePaid.mutate(row.entry)}
                      onDelete={() => {
                        if (window.confirm("Excluir este lançamento?")) remove.mutate(row.entry.id);
                      }}
                    />
                  ),
                )}
              </ul>
            </div>
          ))
        )}
      </section>

      {form && (
        <EntryDialog
          storeId={storeId}
          form={form}
          setForm={setForm}
          categories={categories.filter(
            (c) => c.kind === form.kind && (c.active || c.id === form.category_id),
          )}
          onSaved={refresh}
        />
      )}
      {categoriesOpen && (
        <CategoriesDialog
          storeId={storeId}
          categories={categories}
          onClose={() => setCategoriesOpen(false)}
          onSaved={refresh}
        />
      )}
      {saleOpen && (
        <SaleDialog storeId={storeId} orderId={saleOpen} onClose={() => setSaleOpen(null)} />
      )}
      {adjustOpen && s && (
        <AdjustDialog
          storeId={storeId}
          current={s.balance}
          onClose={() => setAdjustOpen(false)}
          onSaved={refresh}
        />
      )}
    </PageShell>
  );
}

function SummaryCard({
  label,
  value,
  hint,
  tone,
}: {
  label: string;
  value: string;
  hint: string;
  tone: "up" | "down" | "neutral";
}) {
  const Icon = tone === "down" ? ArrowDownCircle : ArrowUpCircle;
  return (
    <div className="bg-surface p-6">
      <div className="flex items-center justify-between text-muted-foreground">
        <span className="text-[12px] uppercase tracking-[0.14em]">{label}</span>
        <Icon
          className={cn(
            "h-4 w-4",
            tone === "up" && "text-emerald-600",
            tone === "down" && "text-red-600",
          )}
          strokeWidth={1.5}
        />
      </div>
      <div className="mt-4 text-[28px] font-light tracking-tight text-foreground">{value}</div>
      <p className="mt-2 text-[12px] text-muted-foreground">{hint}</p>
    </div>
  );
}

// Venda concluída: entra sozinha (receita = total, custo = custo do pedido). Edita-se no pedido.
function SaleRow({
  sale,
  hideCost,
  costOnly,
  onOpen,
}: {
  sale: SaleLine;
  hideCost: boolean;
  costOnly: boolean;
  onOpen: () => void;
}) {
  const title =
    (costOnly ? "Custo da venda" : "Venda") +
    (sale.number ? ` #${sale.number}` : "") +
    (sale.customerName ? ` - ${sale.customerName}` : "");
  return (
    <li className="flex items-center gap-3 px-4 py-3 md:gap-4 md:px-6">
      {costOnly ? (
        <ArrowDownCircle className="h-5 w-5 shrink-0 text-red-600" strokeWidth={1.5} />
      ) : (
        <ArrowUpCircle className="h-5 w-5 shrink-0 text-emerald-600" strokeWidth={1.5} />
      )}
      <div className="min-w-0 flex-1">
        <button
          type="button"
          onClick={onOpen}
          className="block max-w-full truncate text-left text-[13px] font-medium text-foreground hover:underline"
        >
          {title}
        </button>
        <div className="truncate text-[12px] text-muted-foreground">
          Venda concluída · automático
          {!hideCost && !costOnly ? ` · custo ${formatBRL(sale.cost)}` : ""}
        </div>
      </div>
      <div className="text-right">
        {costOnly ? (
          <div className="text-[13px] font-medium text-red-700">-{formatBRL(sale.cost)}</div>
        ) : (
          <>
            <div className="text-[13px] font-medium text-emerald-700">
              +{formatBRL(sale.revenue)}
            </div>
            {!hideCost && (
              <div className="text-[11px] text-muted-foreground">
                lucro {formatBRL(sale.revenue - sale.cost)}
              </div>
            )}
          </>
        )}
      </div>
      <div className="hidden w-[148px] md:block" />
    </li>
  );
}

// Visualização rápida da venda; o link leva ao Histórico de vendas (onde ficam as concluídas).
function SaleDialog({
  storeId,
  orderId,
  onClose,
}: {
  storeId: string;
  orderId: string;
  onClose: () => void;
}) {
  const {
    data: order,
    isLoading,
    isError,
  } = useQuery({
    queryKey: ["finance-sale-detail", storeId, orderId],
    queryFn: () => getOrder(storeId, orderId),
  });
  const cost = order ? order.items.reduce((sum, item) => sum + saleItemCost(item), 0) : 0;
  const payment = order?.payment_method
    ? (paymentMethodLabel[order.payment_method as PaymentMethod] ?? order.payment_method)
    : null;
  const completed = order ? saleDate(order) : null;

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>
            Venda {order?.number ? `#${order.number}` : ""}
            {order?.customer?.name ? ` - ${order.customer.name}` : ""}
          </DialogTitle>
          <DialogDescription>
            {completed
              ? `Concluída em ${new Date(completed).toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" })}`
              : " "}
            {payment ? ` · ${payment}` : ""}
          </DialogDescription>
        </DialogHeader>
        {isLoading ? (
          <div className="grid place-items-center py-10">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : isError || !order ? (
          <p className="rounded-md bg-red-50 px-3 py-2 text-[13px] text-red-700">
            Não foi possível carregar a venda.
          </p>
        ) : (
          <div className="grid gap-4">
            {(order.customer?.phone || order.customer?.email) && (
              <p className="text-[13px] text-muted-foreground">
                {[order.customer?.phone, order.customer?.email].filter(Boolean).join(" · ")}
              </p>
            )}
            <ul className="divide-y divide-border rounded-md border border-border">
              {order.items.map((item) => (
                <li
                  key={item.id}
                  className="flex items-start justify-between gap-3 px-3 py-2 text-[13px]"
                >
                  <div className="min-w-0">
                    <div className="truncate text-foreground">{item.product_name}</div>
                    <div className="text-[12px] text-muted-foreground">
                      {item.variant_name ? `${item.variant_name} · ` : ""}
                      {item.quantity} x {formatBRL(item.unit_price)} · custo{" "}
                      {formatBRL(saleItemCost(item))}
                    </div>
                  </div>
                  <div className="shrink-0 text-foreground">{formatBRL(item.total_price)}</div>
                </li>
              ))}
            </ul>
            <dl className="grid grid-cols-2 gap-x-4 gap-y-1 text-[13px]">
              <dt className="text-muted-foreground">Subtotal</dt>
              <dd className="text-right text-foreground">{formatBRL(order.subtotal)}</dd>
              {order.discount > 0 && (
                <>
                  <dt className="text-muted-foreground">Desconto</dt>
                  <dd className="text-right text-red-700">-{formatBRL(order.discount)}</dd>
                </>
              )}
              {order.surcharge > 0 && (
                <>
                  <dt className="text-muted-foreground">Acréscimo</dt>
                  <dd className="text-right text-foreground">+{formatBRL(order.surcharge)}</dd>
                </>
              )}
              <dt className="font-medium text-foreground">Total</dt>
              <dd className="text-right font-medium text-foreground">{formatBRL(order.total)}</dd>
              <dt className="text-muted-foreground">Custo dos produtos</dt>
              <dd className="text-right text-foreground">-{formatBRL(cost)}</dd>
              <dt className="font-medium text-foreground">Lucro</dt>
              <dd className="text-right font-medium text-emerald-700">
                {formatBRL(order.total - cost)}
              </dd>
            </dl>
            {order.notes && (
              <p className="rounded-md bg-muted px-3 py-2 text-[12px] text-muted-foreground">
                {order.notes}
              </p>
            )}
          </div>
        )}
        <DialogFooter>
          <button
            onClick={onClose}
            className="rounded-md px-4 py-2 text-[13px] text-muted-foreground hover:bg-muted"
          >
            Fechar
          </button>
          <Link
            to={order?.status === "delivered" ? "/admin/historico/$id" : "/admin/pedidos/$id"}
            params={{ id: orderId }}
            className="rounded-md bg-foreground px-4 py-2 text-center text-[13px] font-medium text-background hover:opacity-90"
          >
            Abrir venda
          </Link>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function saleItemCost(item: {
  total_cost: number | null;
  unit_cost: number | null;
  quantity: number;
}) {
  if (item.total_cost != null && Number.isFinite(Number(item.total_cost)))
    return Number(item.total_cost);
  return Number(item.unit_cost || 0) * Number(item.quantity || 0);
}

// Gerenciar categorias: padrão do Vynka só leitura; as da loja editam nome/cor e são arquivadas
// (não apagadas) para os lançamentos antigos manterem nome e cor.
function CategoriesDialog({
  storeId,
  categories,
  onClose,
  onSaved,
}: {
  storeId: string;
  categories: FinanceCategory[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const [editing, setEditing] = useState<{
    id: string | null;
    kind: "income" | "expense";
    name: string;
    color: CategoryColor;
  } | null>(null);
  const [showArchived, setShowArchived] = useState(false);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const save = async () => {
    if (!editing) return;
    if (!editing.name.trim()) return setError("Informe o nome da categoria.");
    setSaving(true);
    setError("");
    try {
      if (editing.id)
        await updateFinanceCategory(editing.id, {
          name: editing.name.trim(),
          color: editing.color,
        });
      else await createFinanceCategory(storeId, editing.kind, editing.name, editing.color);
      setEditing(null);
      onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não foi possível salvar.");
    } finally {
      setSaving(false);
    }
  };

  const setActive = async (c: FinanceCategory, active: boolean) => {
    setError("");
    try {
      await updateFinanceCategory(c.id, { active });
      onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não foi possível salvar.");
    }
  };

  const section = (kind: "income" | "expense", title: string) => {
    const list = categories.filter((c) => c.kind === kind && (showArchived || c.active));
    return (
      <div>
        <div className="mb-2 flex items-center justify-between">
          <h3 className="text-[12px] font-medium uppercase tracking-[0.12em] text-muted-foreground">
            {title}
          </h3>
          <button
            type="button"
            onClick={() => setEditing({ id: null, kind, name: "", color: "slate" })}
            className="inline-flex items-center gap-1 text-[12px] text-muted-foreground hover:text-foreground"
          >
            <Plus className="h-3.5 w-3.5" /> Nova
          </button>
        </div>
        <ul className="divide-y divide-border rounded-md border border-border">
          {list.map((c) => {
            const own = c.store_id !== null;
            return (
              <li key={c.id} className="flex items-center gap-2 px-3 py-2">
                <div className="min-w-0 flex-1">
                  <CategoryBadge category={c} />
                  {!c.affects_result && (
                    <span className="ml-2 text-[11px] text-muted-foreground">fora do saldo</span>
                  )}
                  {!c.active && (
                    <span className="ml-2 text-[11px] text-muted-foreground">arquivada</span>
                  )}
                </div>
                {own ? (
                  <>
                    <button
                      type="button"
                      onClick={() =>
                        setEditing({ id: c.id, kind: c.kind, name: c.name, color: c.color })
                      }
                      className="grid h-7 w-7 place-items-center rounded hover:bg-muted"
                      aria-label="Editar categoria"
                    >
                      <Pencil className="h-3.5 w-3.5 text-muted-foreground" />
                    </button>
                    <button
                      type="button"
                      onClick={() => setActive(c, !c.active)}
                      className="rounded px-2 py-1 text-[11px] text-muted-foreground hover:bg-muted hover:text-foreground"
                    >
                      {c.active ? "Arquivar" : "Reativar"}
                    </button>
                  </>
                ) : (
                  <span className="text-[11px] text-muted-foreground">padrão</span>
                )}
              </li>
            );
          })}
        </ul>
      </div>
    );
  };

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[90svh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Categorias</DialogTitle>
          <DialogDescription>
            As padrão do Vynka não mudam. As suas você renomeia, troca a cor ou arquiva (lançamentos
            antigos continuam com ela).
          </DialogDescription>
        </DialogHeader>

        {editing && (
          <div className="grid gap-2 rounded-md border border-border p-3">
            <div className="text-[12px] font-medium text-foreground">
              {editing.id
                ? "Editar categoria"
                : `Nova categoria de ${editing.kind === "income" ? "receita" : "despesa"}`}
            </div>
            <input
              className={inputClass}
              placeholder="Nome da categoria"
              maxLength={60}
              value={editing.name}
              onChange={(e) => setEditing({ ...editing, name: e.target.value })}
            />
            <ColorPicker
              value={editing.color}
              preview={editing.name}
              onChange={(color) => setEditing({ ...editing, color })}
            />
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setEditing(null)}
                className="rounded-md px-3 py-1.5 text-[13px] text-muted-foreground hover:bg-muted"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={save}
                disabled={saving}
                className="rounded-md bg-foreground px-3 py-1.5 text-[13px] font-medium text-background disabled:opacity-50"
              >
                {saving ? "Salvando..." : "Salvar"}
              </button>
            </div>
          </div>
        )}
        {error && (
          <p className="rounded-md bg-red-50 px-3 py-2 text-[13px] text-red-700">{error}</p>
        )}

        <div className="grid gap-5">
          {section("income", "Receitas")}
          {section("expense", "Despesas")}
        </div>
        <label className="mt-1 flex items-center gap-2 text-[12px] text-muted-foreground">
          <input
            type="checkbox"
            checked={showArchived}
            onChange={(e) => setShowArchived(e.target.checked)}
          />
          Mostrar arquivadas
        </label>
        <DialogFooter>
          <button
            onClick={onClose}
            className="rounded-md px-4 py-2 text-[13px] text-muted-foreground hover:bg-muted"
          >
            Fechar
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ColorPicker({
  value,
  preview,
  onChange,
}: {
  value: CategoryColor;
  preview: string;
  onChange: (c: CategoryColor) => void;
}) {
  return (
    <div
      className="flex flex-wrap items-center gap-2"
      role="radiogroup"
      aria-label="Cor da categoria"
    >
      {(Object.keys(CATEGORY_COLORS) as CategoryColor[]).map((key) => (
        <button
          key={key}
          type="button"
          role="radio"
          aria-checked={value === key}
          title={CATEGORY_COLORS[key].label}
          onClick={() => onChange(key)}
          className={cn(
            "h-7 w-7 rounded-full ring-offset-2 ring-offset-background",
            CATEGORY_COLORS[key].dot,
            value === key ? "ring-2 ring-foreground" : "hover:opacity-80",
          )}
        />
      ))}
      {preview.trim() && (
        <span
          className={cn(
            "rounded-full px-2 py-0.5 text-[11px] font-medium",
            CATEGORY_COLORS[value].badge,
          )}
        >
          {preview.trim()}
        </span>
      )}
    </div>
  );
}

function CategoryBadge({ category }: { category: FinanceCategory }) {
  const color = CATEGORY_COLORS[category.color] ?? CATEGORY_COLORS.slate;
  return (
    <span
      className={cn(
        "max-w-[220px] truncate rounded-full px-2 py-0.5 text-[11px] font-medium",
        color.badge,
      )}
    >
      {category.name}
    </span>
  );
}

function EntryRow({
  entry,
  category,
  onEdit,
  onToggle,
  onDelete,
}: {
  entry: FinanceEntry;
  category?: FinanceCategory;
  onEdit: () => void;
  onToggle: () => void;
  onDelete: () => void;
}) {
  const adjustment = entry.kind === "adjustment";
  const positive = entry.kind === "income" || (adjustment && entry.amount > 0);
  const outOfResult = category && !category.affects_result;
  return (
    <li className="flex flex-wrap items-center gap-3 px-4 py-3 md:flex-nowrap md:gap-4 md:px-6">
      {adjustment ? (
        <Scale className="h-5 w-5 shrink-0 text-muted-foreground" strokeWidth={1.5} />
      ) : positive ? (
        <ArrowUpCircle className="h-5 w-5 shrink-0 text-emerald-600" strokeWidth={1.5} />
      ) : (
        <ArrowDownCircle className="h-5 w-5 shrink-0 text-red-600" strokeWidth={1.5} />
      )}
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2 text-[13px] font-medium text-foreground">
          <span className="truncate">
            {entry.description || category?.name || (adjustment ? "Ajuste de saldo" : "Lançamento")}
          </span>
          {entry.status === "pending" && (
            <span className="shrink-0 rounded bg-amber-50 px-1.5 py-0.5 text-[10px] font-medium text-amber-700">
              Pendente
            </span>
          )}
        </div>
        <div className="mt-0.5 flex min-w-0 items-center gap-1.5 text-[12px] text-muted-foreground">
          {adjustment ? (
            "Ajuste de saldo"
          ) : category ? (
            <CategoryBadge category={category} />
          ) : (
            "Sem categoria"
          )}
          {outOfResult ? <span className="truncate">fora do saldo</span> : null}
        </div>
      </div>
      <div
        className={cn(
          "text-[13px] font-medium",
          adjustment ? "text-foreground" : positive ? "text-emerald-700" : "text-red-700",
          outOfResult && "text-muted-foreground",
        )}
      >
        {positive ? "+" : "-"}
        {formatBRL(Math.abs(entry.amount))}
      </div>
      <div className="flex w-full items-center justify-end gap-1 md:w-[148px]">
        {!adjustment && (
          <>
            <button
              onClick={onToggle}
              className="rounded px-2 py-1 text-[11px] text-muted-foreground hover:bg-muted hover:text-foreground"
            >
              {entry.status === "paid"
                ? "Marcar pendente"
                : entry.kind === "income"
                  ? "Recebido"
                  : "Pago"}
            </button>
            <button
              onClick={onEdit}
              className="grid h-7 w-7 place-items-center rounded hover:bg-muted"
              aria-label="Editar"
            >
              <Pencil className="h-3.5 w-3.5 text-muted-foreground" />
            </button>
          </>
        )}
        <button
          onClick={onDelete}
          className="grid h-7 w-7 place-items-center rounded hover:bg-muted"
          aria-label="Excluir"
        >
          <Trash2 className="h-3.5 w-3.5 text-muted-foreground" />
        </button>
      </div>
    </li>
  );
}

const inputClass =
  "h-10 w-full rounded-md border border-border bg-background px-3 text-[14px] text-foreground outline-none focus:border-foreground";

function EntryDialog({
  storeId,
  form,
  setForm,
  categories,
  onSaved,
}: {
  storeId: string;
  form: FormState;
  setForm: (f: FormState | null) => void;
  categories: FinanceCategory[];
  onSaved: () => void;
}) {
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const set = (patch: Partial<FormState>) => setForm({ ...form, ...patch });
  const label = form.kind === "income" ? "receita" : "despesa";

  const save = async () => {
    const amount = parseMoney(form.amount);
    if (!(amount > 0)) return setError("Informe um valor maior que zero (ex. 150,00).");
    if (!form.entry_date) return setError("Informe a data.");
    setSaving(true);
    setError("");
    try {
      let categoryId = form.category_id || null;
      if (form.category_id === "__new") {
        if (!form.newCategory.trim()) throw new Error("Informe o nome da nova categoria.");
        categoryId = (
          await createFinanceCategory(storeId, form.kind, form.newCategory, form.newCategoryColor)
        ).id;
      }
      const input = {
        kind: form.kind,
        amount,
        category_id: categoryId,
        description: form.description.trim(),
        entry_date: form.entry_date,
        status: form.status,
        notes: form.notes.trim() || null,
      };
      if (form.id) await updateFinanceEntry(form.id, input);
      else await createFinanceEntry(storeId, input);
      onSaved();
      setForm(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não foi possível salvar.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open onOpenChange={(open) => !open && setForm(null)}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{form.id ? `Editar ${label}` : `Nova ${label}`}</DialogTitle>
          <DialogDescription>
            {form.kind === "income"
              ? "Receita fora das vendas (as vendas concluídas entram sozinhas)."
              : "Gasto da loja. Compra de mercadoria fica fora do saldo: o custo já sai de cada venda."}
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-3">
          <label className="grid gap-1 text-[12px] text-muted-foreground">
            Valor (R$)
            <input
              className={inputClass}
              inputMode="decimal"
              placeholder="0,00"
              value={form.amount}
              onChange={(e) => set({ amount: e.target.value })}
            />
          </label>
          <label className="grid gap-1 text-[12px] text-muted-foreground">
            Descrição
            <input
              className={inputClass}
              maxLength={200}
              value={form.description}
              onChange={(e) => set({ description: e.target.value })}
            />
          </label>
          <label className="grid gap-1 text-[12px] text-muted-foreground">
            Categoria
            <select
              className={inputClass}
              value={form.category_id}
              onChange={(e) => set({ category_id: e.target.value })}
            >
              <option value="">Sem categoria</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                  {c.affects_result ? "" : " (fora do saldo)"}
                </option>
              ))}
              <option value="__new">+ Nova categoria</option>
            </select>
          </label>
          {form.category_id === "__new" && (
            <div className="grid gap-2">
              <input
                className={inputClass}
                placeholder="Nome da categoria"
                maxLength={60}
                value={form.newCategory}
                onChange={(e) => set({ newCategory: e.target.value })}
              />
              <ColorPicker
                value={form.newCategoryColor}
                preview={form.newCategory}
                onChange={(color) => set({ newCategoryColor: color })}
              />
            </div>
          )}
          <div className="grid grid-cols-2 gap-3">
            <label className="grid gap-1 text-[12px] text-muted-foreground">
              Data
              <input
                type="date"
                className={inputClass}
                value={form.entry_date}
                onChange={(e) => set({ entry_date: e.target.value })}
              />
            </label>
            <label className="grid gap-1 text-[12px] text-muted-foreground">
              Situação
              <select
                className={inputClass}
                value={form.status}
                onChange={(e) => set({ status: e.target.value as FinanceStatus })}
              >
                <option value="paid">{form.kind === "income" ? "Recebido" : "Pago"}</option>
                <option value="pending">Pendente</option>
              </select>
            </label>
          </div>
          <label className="grid gap-1 text-[12px] text-muted-foreground">
            Observação
            <textarea
              className={cn(inputClass, "h-20 py-2")}
              maxLength={1000}
              value={form.notes}
              onChange={(e) => set({ notes: e.target.value })}
            />
          </label>
          {error && (
            <p className="rounded-md bg-red-50 px-3 py-2 text-[13px] text-red-700">{error}</p>
          )}
        </div>
        <DialogFooter>
          <button
            onClick={() => setForm(null)}
            className="rounded-md px-4 py-2 text-[13px] text-muted-foreground hover:bg-muted"
          >
            Cancelar
          </button>
          <button
            onClick={save}
            disabled={saving}
            className="rounded-md bg-foreground px-4 py-2 text-[13px] font-medium text-background disabled:opacity-50"
          >
            {saving ? "Salvando..." : "Salvar"}
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function AdjustDialog({
  storeId,
  current,
  onClose,
  onSaved,
}: {
  storeId: string;
  current: number;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [value, setValue] = useState(current.toFixed(2).replace(".", ","));
  const [note, setNote] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const target = parseMoney(value);
  const diff = Number.isNaN(target) ? 0 : Math.round((target - current) * 100) / 100;

  const save = async () => {
    if (Number.isNaN(target)) return setError("Informe o saldo real, ex. 1250,00.");
    setSaving(true);
    setError("");
    try {
      await adjustBalance(storeId, current, target, note);
      onSaved();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não foi possível ajustar.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Ajustar saldo</DialogTitle>
          <DialogDescription>
            Informe quanto a loja tem de verdade hoje. A diferença vira um lançamento de ajuste e o
            histórico fica guardado.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-3">
          <p className="text-[13px] text-muted-foreground">Saldo no Vynka: {formatBRL(current)}</p>
          <label className="grid gap-1 text-[12px] text-muted-foreground">
            Saldo real (R$)
            <input
              className={inputClass}
              inputMode="decimal"
              value={value}
              onChange={(e) => setValue(e.target.value)}
            />
          </label>
          <label className="grid gap-1 text-[12px] text-muted-foreground">
            Motivo (opcional)
            <input
              className={inputClass}
              maxLength={200}
              placeholder="Ajuste de saldo"
              value={note}
              onChange={(e) => setNote(e.target.value)}
            />
          </label>
          <p className="text-[13px] text-foreground">
            Ajuste:{" "}
            <strong className={diff < 0 ? "text-red-700" : "text-emerald-700"}>
              {diff >= 0 ? "+" : "-"}
              {formatBRL(Math.abs(diff))}
            </strong>
          </p>
          {error && (
            <p className="rounded-md bg-red-50 px-3 py-2 text-[13px] text-red-700">{error}</p>
          )}
        </div>
        <DialogFooter>
          <button
            onClick={onClose}
            className="rounded-md px-4 py-2 text-[13px] text-muted-foreground hover:bg-muted"
          >
            Cancelar
          </button>
          <button
            onClick={save}
            disabled={saving || diff === 0}
            className="rounded-md bg-foreground px-4 py-2 text-[13px] font-medium text-background disabled:opacity-50"
          >
            {saving ? "Salvando..." : "Salvar ajuste"}
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
