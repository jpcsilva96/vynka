import { supabase } from "@/integrations/supabase/client";

// Finanças da loja (modelo Mobills). Lançamentos manuais ficam em finance_entries; vendas
// concluídas entram calculadas dos pedidos (receita = total, custo = custo gravado no item), pela
// data de conclusão. Saldo e totais do mês vêm de finance_summary (mesma regra, no banco).

/* eslint-disable @typescript-eslint/no-explicit-any -- tabelas de finanças ainda não estão no types.ts gerado */
const db = supabase as unknown as {
  from: (table: string) => any;
  rpc: (fn: string, args: Record<string, unknown>) => any;
};
/* eslint-enable @typescript-eslint/no-explicit-any */

export type FinanceKind = "income" | "expense" | "adjustment";

// 8 cores fixas do badge de categoria (mesma lista do CHECK no banco).
export const CATEGORY_COLORS = {
  slate: { label: "Cinza", badge: "bg-slate-100 text-slate-700", dot: "bg-slate-500" },
  red: { label: "Vermelho", badge: "bg-red-50 text-red-700", dot: "bg-red-500" },
  orange: { label: "Laranja", badge: "bg-orange-50 text-orange-700", dot: "bg-orange-500" },
  amber: { label: "Amarelo", badge: "bg-amber-50 text-amber-800", dot: "bg-amber-400" },
  emerald: { label: "Verde", badge: "bg-emerald-50 text-emerald-700", dot: "bg-emerald-500" },
  sky: { label: "Azul", badge: "bg-sky-50 text-sky-700", dot: "bg-sky-500" },
  violet: { label: "Roxo", badge: "bg-violet-50 text-violet-700", dot: "bg-violet-500" },
  pink: { label: "Rosa", badge: "bg-pink-50 text-pink-700", dot: "bg-pink-500" },
} as const;
export type CategoryColor = keyof typeof CATEGORY_COLORS;
export type FinanceStatus = "paid" | "pending";

export interface FinanceCategory {
  id: string;
  store_id: string | null;
  kind: "income" | "expense";
  name: string;
  affects_result: boolean;
  color: CategoryColor;
  active: boolean;
  system_key: string | null;
  position: number;
}

export interface FinanceEntry {
  id: string;
  kind: FinanceKind;
  amount: number;
  category_id: string | null;
  description: string;
  entry_date: string; // AAAA-MM-DD
  status: FinanceStatus;
  notes: string | null;
}

export interface SaleLine {
  id: string;
  number: number | null;
  day: string; // AAAA-MM-DD (Brasília)
  revenue: number;
  cost: number;
  customerName: string | null;
}

export interface FinanceSummary {
  balance: number;
  sales_revenue: number;
  sales_cost: number;
  sales_count: number;
  other_income: number;
  expenses: number;
  pending_income: number;
  pending_expense: number;
}

export interface FinanceEntryInput {
  kind: "income" | "expense";
  amount: number;
  category_id: string | null;
  description: string;
  entry_date: string;
  status: FinanceStatus;
  notes: string | null;
}

const pad = (n: number) => String(n).padStart(2, "0");

/** Primeiro e último dia do mês (AAAA-MM-DD). month: 0-11. */
export function monthRange(year: number, month: number) {
  const last = new Date(year, month + 1, 0).getDate();
  return { from: `${year}-${pad(month + 1)}-01`, to: `${year}-${pad(month + 1)}-${pad(last)}` };
}

export function todayISO() {
  const d = new Date();
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** Converte "1.234,56", "1234.56" ou "1234,5" em número; NaN se inválido. */
export function parseMoney(value: string) {
  const clean = value.trim().replace(/[R$\s]/g, "");
  if (!clean) return NaN;
  const normalized = clean.includes(",") ? clean.replace(/\./g, "").replace(",", ".") : clean;
  return /^-?\d+(\.\d{1,2})?$/.test(normalized) ? Number(normalized) : NaN;
}

const toNumber = (v: unknown) => Number(v ?? 0) || 0;

export async function getFinanceSummary(
  storeId: string,
  from: string,
  to: string,
): Promise<FinanceSummary> {
  const { data, error } = await db.rpc("finance_summary", {
    _store_id: storeId,
    _from: from,
    _to: to,
  });
  if (error) throw error;
  const s = (data ?? {}) as Record<string, unknown>;
  return {
    balance: toNumber(s.balance),
    sales_revenue: toNumber(s.sales_revenue),
    sales_cost: toNumber(s.sales_cost),
    sales_count: toNumber(s.sales_count),
    other_income: toNumber(s.other_income),
    expenses: toNumber(s.expenses),
    pending_income: toNumber(s.pending_income),
    pending_expense: toNumber(s.pending_expense),
  };
}

/** Todas as categorias visíveis da loja, inclusive arquivadas (lançamentos antigos usam). */
export async function listFinanceCategories(storeId: string): Promise<FinanceCategory[]> {
  const { data, error } = await db
    .from("finance_categories")
    .select("id, store_id, kind, name, affects_result, system_key, position, color, active")
    .or(`store_id.is.null,store_id.eq.${storeId}`)
    .order("position")
    .order("name");
  if (error) throw error;
  return (data ?? []) as FinanceCategory[];
}

export async function createFinanceCategory(
  storeId: string,
  kind: "income" | "expense",
  name: string,
  color: CategoryColor = "slate",
) {
  const { data, error } = await db
    .from("finance_categories")
    .insert({ store_id: storeId, kind, name: name.trim(), color })
    .select("id, store_id, kind, name, affects_result, system_key, position, color, active")
    .single();
  if (error) throw error;
  return data as FinanceCategory;
}

/** Só categorias da própria loja (as padrão são protegidas no banco). */
export async function updateFinanceCategory(
  id: string,
  patch: Partial<{ name: string; color: CategoryColor; active: boolean }>,
) {
  const { data, error } = await db
    .from("finance_categories")
    .update(patch)
    .eq("id", id)
    .select("id");
  if (error) throw error;
  if (!data || data.length === 0) throw new Error("Esta categoria não pode ser alterada.");
}

export async function listFinanceEntries(
  storeId: string,
  from: string,
  to: string,
): Promise<FinanceEntry[]> {
  const { data, error } = await db
    .from("finance_entries")
    .select("id, kind, amount, category_id, description, entry_date, status, notes")
    .eq("store_id", storeId)
    .gte("entry_date", from)
    .lte("entry_date", to)
    .order("entry_date", { ascending: false })
    .order("created_at", { ascending: false });
  if (error) throw error;
  return ((data ?? []) as FinanceEntry[]).map((e) => ({ ...e, amount: toNumber(e.amount) }));
}

/** Vendas concluídas no período (dia de Brasília), com receita e custo, para a lista. */
export async function listSalesInRange(
  storeId: string,
  from: string,
  to: string,
): Promise<SaleLine[]> {
  const { data, error } = await supabase
    .from("orders")
    .select(
      "id, number, total, completed_at, customer:customers(name), order_items(total_cost, unit_cost, quantity)",
    )
    .eq("store_id", storeId)
    .eq("status", "delivered")
    .gte("completed_at", `${from}T00:00:00-03:00`)
    .lte("completed_at", `${to}T23:59:59.999-03:00`)
    .order("completed_at", { ascending: false });
  if (error) throw error;
  type Row = {
    id: string;
    number: number | null;
    total: number;
    completed_at: string;
    customer: { name: string } | { name: string }[] | null;
    order_items: { total_cost: number | null; unit_cost: number | null; quantity: number }[];
  };
  return ((data ?? []) as unknown as Row[]).map((o) => {
    const c = Array.isArray(o.customer) ? o.customer[0] : o.customer;
    const cost = (o.order_items ?? []).reduce(
      (s, i) =>
        s +
        (i.total_cost != null
          ? toNumber(i.total_cost)
          : toNumber(i.unit_cost) * toNumber(i.quantity)),
      0,
    );
    const day = new Date(o.completed_at).toLocaleDateString("en-CA", {
      timeZone: "America/Sao_Paulo",
    });
    return {
      id: o.id,
      number: o.number,
      day,
      revenue: toNumber(o.total),
      cost,
      customerName: c?.name ?? null,
    };
  });
}

export async function createFinanceEntry(storeId: string, input: FinanceEntryInput) {
  const { error } = await db.from("finance_entries").insert({ store_id: storeId, ...input });
  if (error) throw error;
}

export async function updateFinanceEntry(id: string, input: Partial<FinanceEntryInput>) {
  const { error } = await db.from("finance_entries").update(input).eq("id", id);
  if (error) throw error;
}

export async function deleteFinanceEntry(id: string) {
  const { error } = await db.from("finance_entries").delete().eq("id", id);
  if (error) throw error;
}

/** "Ajustar saldo" (como no Mobills): grava a diferença como lançamento de ajuste, sem apagar histórico. */
export async function adjustBalance(
  storeId: string,
  currentBalance: number,
  realBalance: number,
  note: string,
) {
  const diff = Math.round((realBalance - currentBalance) * 100) / 100;
  if (diff === 0) return 0;
  const { error } = await db.from("finance_entries").insert({
    store_id: storeId,
    kind: "adjustment",
    amount: diff,
    description: note.trim() || "Ajuste de saldo",
    status: "paid",
    entry_date: todayISO(),
  });
  if (error) throw error;
  return diff;
}
