import { supabase } from "@/integrations/supabase/client";

export type OrderStatus =
  | "pending"
  | "confirmed"
  | "paid"
  | "in_production"
  | "in_dispatch"
  | "shipped"
  | "delivered"
  | "cancelled";

export const orderStatuses: { value: OrderStatus; label: string }[] = [
  { value: "confirmed", label: "Confirmado" },
  { value: "paid", label: "Pago" },
  { value: "in_production", label: "Em producao" },
  { value: "in_dispatch", label: "Em expedicao" },
  { value: "delivered", label: "Concluido" },
  { value: "cancelled", label: "Cancelado" },
];

export const allOrderStatuses: { value: OrderStatus; label: string }[] = [
  { value: "pending", label: "Pendente" },
  ...orderStatuses,
  { value: "shipped", label: "Enviado" },
];

export function orderStatusLabel(status: OrderStatus | string | null | undefined) {
  return allOrderStatuses.find((s) => s.value === status)?.label ?? "Pendente";
}

export function orderStatusClass(status: OrderStatus | string | null | undefined) {
  if (status === "cancelled") return "bg-red-50 text-red-700";
  if (status === "delivered") return "bg-emerald-50 text-emerald-700";
  if (status === "paid") return "bg-teal-50 text-teal-700";
  if (status === "in_production" || status === "in_dispatch") return "bg-amber-50 text-amber-700";
  return "bg-muted text-foreground";
}

export function isCancelledSale(order: Pick<OrderRecord, "status" | "payment_details">) {
  return order.status === "cancelled" && order.payment_details?.cancelled_from === "sale_history";
}

export interface OrderCustomer {
  id: string;
  name: string;
  phone: string | null;
  email: string | null;
}

export interface OrderItem {
  id: string;
  product_id: string | null;
  variant_id: string | null;
  product_name: string;
  variant_name: string | null;
  quantity: number;
  unit_price: number;
  total_price: number;
  unit_cost: number;
  total_cost: number;
}

export interface OrderRecord {
  id: string;
  number: number | null;
  created_at: string;
  updated_at: string;
  customer_id: string | null;
  created_by: string | null;
  status: OrderStatus;
  source: "website" | "whatsapp" | "manual";
  subtotal: number;
  discount: number;
  surcharge: number;
  total: number;
  notes: string | null;
  payment_method: string | null;
  payment_details: Record<string, unknown>;
  paid_amount: number | null;
  change_due: number | null;
  customer: OrderCustomer | null;
  items: OrderItem[];
}

type RawOrder = Omit<OrderRecord, "customer" | "items" | "payment_details"> & {
  customer: OrderCustomer | OrderCustomer[] | null;
  order_items?: OrderItem[];
  payment_details: Record<string, unknown> | null;
};

function normalizeOrder(row: RawOrder): OrderRecord {
  const customer = Array.isArray(row.customer) ? row.customer[0] : row.customer;
  return {
    ...row,
    customer: customer ?? null,
    items: row.order_items ?? [],
    payment_details: row.payment_details ?? {},
  };
}

const ORDER_SELECT = `
  id, number, created_at, updated_at, customer_id, created_by, status, source,
  subtotal, discount, surcharge, total, notes, payment_method, payment_details,
  paid_amount, change_due,
  customer:customers(id,name,phone,email),
  order_items(id,product_id,variant_id,product_name,variant_name,quantity,unit_price,total_price,unit_cost,total_cost)
`;

export async function listOrders(storeId: string, scope: "orders" | "history") {
  let query = supabase
    .from("orders")
    .select(ORDER_SELECT)
    .eq("store_id", storeId)
    .order("created_at", { ascending: false });

  if (scope === "orders") {
    query = query.neq("status", "delivered");
  } else {
    query = query.in("status", ["delivered", "cancelled"]);
  }

  const { data, error } = await query;
  if (error) throw error;
  const rows = ((data ?? []) as unknown as RawOrder[]).map(normalizeOrder);
  if (scope === "orders") {
    return rows.filter((order) => !isCancelledSale(order));
  }
  return rows;
}

export async function getOrder(storeId: string, orderId: string) {
  const { data, error } = await supabase
    .from("orders")
    .select(ORDER_SELECT)
    .eq("store_id", storeId)
    .eq("id", orderId)
    .maybeSingle();
  if (error) throw error;
  return data ? normalizeOrder(data as unknown as RawOrder) : null;
}

export async function updateOrderStatus(storeId: string, orderId: string, status: OrderStatus) {
  const { error } = await supabase
    .from("orders")
    .update({ status })
    .eq("store_id", storeId)
    .eq("id", orderId);
  if (error) throw error;
}

export async function cancelSale(storeId: string, orderId: string) {
  const current = await getOrder(storeId, orderId);
  const { error } = await supabase
    .from("orders")
    .update({
      status: "cancelled",
      payment_details: {
        ...(current?.payment_details ?? {}),
        cancelled_from: "sale_history",
        cancelled_at: new Date().toISOString(),
      },
    })
    .eq("store_id", storeId)
    .eq("id", orderId);
  if (error) throw error;
}

export async function updateOrderCustomer(
  storeId: string,
  orderId: string,
  customerId: string | null,
) {
  const { error } = await supabase
    .from("orders")
    .update({ customer_id: customerId })
    .eq("store_id", storeId)
    .eq("id", orderId);
  if (error) throw error;
}

export async function updateOrderNotes(storeId: string, orderId: string, notes: string | null) {
  const { error } = await supabase
    .from("orders")
    .update({ notes })
    .eq("store_id", storeId)
    .eq("id", orderId);
  if (error) throw error;
}

export async function updateOrderPayment(
  storeId: string,
  orderId: string,
  paymentMethod: string | null,
  paymentDetails: Record<string, unknown> = {},
  paidAmount: number | null = null,
  changeDue: number | null = null,
) {
  const { error } = await supabase
    .from("orders")
    .update({
      payment_method: paymentMethod,
      payment_details: paymentDetails as any,
      paid_amount: paidAmount,
      change_due: changeDue,
    })
    .eq("store_id", storeId)
    .eq("id", orderId);
  if (error) throw error;
}

export interface OrderItemInput {
  product_id: string | null;
  variant_id?: string | null;
  product_name: string;
  variant_name?: string | null;
  quantity: number;
  unit_price: number;
  unit_cost?: number;
}

export async function replaceOrderItems(
  storeId: string,
  orderId: string,
  items: OrderItemInput[],
  discount = 0,
  surcharge = 0,
) {
  if (items.length === 0) throw new Error("O pedido precisa ter ao menos um item.");

  const rows = items.map((item) => {
    const quantity = Math.max(1, Number(item.quantity) || 1);
    const unitPrice = Math.max(0, Number(item.unit_price) || 0);
    const unitCost = Math.max(0, Number(item.unit_cost) || 0);
    return {
      store_id: storeId,
      order_id: orderId,
      product_id: item.product_id,
      variant_id: item.variant_id ?? null,
      product_name: item.product_name,
      variant_name: item.variant_name ?? null,
      quantity,
      unit_price: unitPrice,
      total_price: Number((quantity * unitPrice).toFixed(2)),
      unit_cost: unitCost,
      total_cost: Number((quantity * unitCost).toFixed(2)),
    };
  });

  const subtotal = rows.reduce((sum, item) => sum + item.total_price, 0);
  const total = Number((subtotal - discount + surcharge).toFixed(2));

  const { error: deleteError } = await supabase
    .from("order_items")
    .delete()
    .eq("store_id", storeId)
    .eq("order_id", orderId);
  if (deleteError) throw deleteError;

  const { error: insertError } = await supabase.from("order_items").insert(rows);
  if (insertError) throw insertError;

  const { error: orderError } = await supabase
    .from("orders")
    .update({ subtotal, total })
    .eq("store_id", storeId)
    .eq("id", orderId);
  if (orderError) throw orderError;
}
