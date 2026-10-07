import { supabase } from "@/integrations/supabase/client";
import type { OrderStatus } from "@/lib/orders";

// Números do dashboard do lojista. "Venda" segue a mesma regra das Estatísticas: pedido
// Concluído (delivered) e não cancelado, no mês da conclusão (completed_at); lucro = preço dos itens - custo gravado no item.
export interface DashboardData {
  monthRevenue: number;
  monthProfit: number;
  monthSales: number;
  monthViews: number;
  openOrders: number;
  activeProducts: number;
  customers: number;
  recentOrders: {
    id: string;
    number: number | null;
    created_at: string;
    status: OrderStatus;
    source: string;
    delivery_method: string | null;
    total: number;
    customerName: string | null;
  }[];
}

export function startOfCurrentMonth(now = new Date()) {
  return new Date(now.getFullYear(), now.getMonth(), 1);
}

// Tabelas de visita ainda não estão no types.ts gerado.
type ViewsQuery = {
  from: (table: string) => {
    select: (columns: string) => {
      eq: (
        column: string,
        value: string,
      ) => {
        gte: (
          column: string,
          value: string,
        ) => PromiseLike<{
          data: { views: number }[] | null;
          error: unknown;
        }>;
      };
    };
  };
};

export function localDay(date: Date) {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function countOf(res: { count: number | null; error: unknown }) {
  if (res.error) throw res.error;
  return res.count ?? 0;
}

export async function getDashboardData(storeId: string): Promise<DashboardData> {
  const monthStart = startOfCurrentMonth().toISOString();

  const head = { count: "exact" as const, head: true };
  const viewsDb = supabase as unknown as ViewsQuery;
  const [salesRes, recentRes, openRes, productsRes, customersRes, viewsRes] = await Promise.all([
    supabase
      .from("orders")
      .select("total, order_items(total_price, total_cost, unit_cost, quantity)")
      .eq("store_id", storeId)
      .eq("status", "delivered")
      .gte("completed_at", monthStart),
    supabase
      .from("orders")
      .select(
        "id, number, created_at, status, source, delivery_method, total, customer:customers(name)",
      )
      .eq("store_id", storeId)
      .order("created_at", { ascending: false })
      .limit(5),
    supabase
      .from("orders")
      .select("id", head)
      .eq("store_id", storeId)
      .not("status", "in", "(delivered,cancelled)"),
    supabase.from("products").select("id", head).eq("store_id", storeId).eq("status", "active"),
    supabase.from("customers").select("id", head).eq("store_id", storeId),
    viewsDb
      .from("store_daily_views")
      .select("views")
      .eq("store_id", storeId)
      .gte("day", localDay(startOfCurrentMonth())),
  ]);
  if (salesRes.error) throw salesRes.error;
  if (recentRes.error) throw recentRes.error;
  // Visitas são complemento: se a leitura falhar, o resto do dashboard aparece com 0.
  const monthViews = viewsRes.error
    ? 0
    : (viewsRes.data ?? []).reduce((sum, r) => sum + Number(r.views || 0), 0);

  type SaleRow = {
    total: number;
    order_items: {
      total_price: number;
      total_cost: number | null;
      unit_cost: number | null;
      quantity: number;
    }[];
  };
  const sales = (salesRes.data ?? []) as unknown as SaleRow[];
  const monthRevenue = sales.reduce((sum, o) => sum + Number(o.total || 0), 0);
  // Lucro = total do pedido (já com desconto/acréscimo) - custo dos itens; mesma regra das Finanças.
  const monthProfit = sales.reduce(
    (sum, o) =>
      sum +
      Number(o.total || 0) -
      (o.order_items ?? []).reduce((s, i) => {
        const cost =
          i.total_cost != null && Number.isFinite(Number(i.total_cost))
            ? Number(i.total_cost)
            : Number(i.unit_cost || 0) * Number(i.quantity || 0);
        return s + cost;
      }, 0),
    0,
  );

  type RecentRow = Omit<DashboardData["recentOrders"][number], "customerName"> & {
    customer: { name: string } | { name: string }[] | null;
  };
  const recentOrders = ((recentRes.data ?? []) as unknown as RecentRow[]).map(
    ({ customer, ...o }) => {
      const c = Array.isArray(customer) ? customer[0] : customer;
      return { ...o, total: Number(o.total || 0), customerName: c?.name ?? null };
    },
  );

  return {
    monthRevenue,
    monthProfit,
    monthSales: sales.length,
    monthViews,
    openOrders: countOf(openRes),
    activeProducts: countOf(productsRes),
    customers: countOf(customersRes),
    recentOrders,
  };
}
