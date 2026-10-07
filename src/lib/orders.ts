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
  { value: "in_production", label: "Em separação" },
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

export type DeliveryMethod = "local" | "pickup" | "shipping";

// Rótulo conforme o pedido (lote C, sem status novo no banco): pedido do site com entrega escolhida
// em "pending" aguarda o pagamento online; "in_dispatch" de retirada = pronto para o cliente buscar.
// Lote D: cancelado pelo agendador (prazo) e pago sem estoque (pagamento chegou sem peça).
// Etapas (ata 07/10, D1): "in_dispatch" de entrega local = saiu para entrega; concluído do site =
// entregue ou retirado; "Pago sem estoque" só enquanto o pedido não avança.
export function orderStatusLabelFor(order: {
  status: OrderStatus | string | null | undefined;
  source?: string | null;
  delivery_method?: DeliveryMethod | string | null;
  cancel_reason?: string | null;
  stock_shortage?: boolean | null;
}) {
  if (order.status === "cancelled" && order.cancel_reason === "deadline")
    return "Cancelado por prazo";
  if (order.stock_shortage && order.status === "paid") return "Pago sem estoque";
  if (order.status === "pending" && order.source === "website" && order.delivery_method)
    return "Aguardando pagamento";
  if (order.status === "in_dispatch" && order.delivery_method === "pickup")
    return "Pronto para retirada";
  if (order.status === "in_dispatch" && order.delivery_method === "local")
    return "Saiu para entrega";
  if (order.status === "delivered" && order.source === "website")
    return order.delivery_method === "pickup" ? "Retirado" : "Entregue";
  return orderStatusLabel(order.status);
}

// Etapas do pedido do site pago. Espelha a trava do banco (orders_website_guard): só anda para a
// frente e pode pular etapa; em Correios/transportadora o lojista só separa (Enviado e Entregue vêm
// do Melhor Envio).
const stageRank: Partial<Record<OrderStatus, number>> = {
  paid: 1,
  in_production: 2,
  in_dispatch: 3,
  shipped: 3,
  delivered: 4,
};

type StageOrder = {
  status: OrderStatus | string | null | undefined;
  source?: string | null;
  delivery_method?: DeliveryMethod | string | null;
};

export function websiteNextStages(order: StageOrder): { value: OrderStatus; label: string }[] {
  const current = stageRank[order.status as OrderStatus];
  if (order.source !== "website" || !current) return [];
  const targets: OrderStatus[] =
    order.delivery_method === "shipping"
      ? ["in_production"]
      : ["in_production", "in_dispatch", "delivered"];
  return targets
    .filter((status) => (stageRank[status] ?? 0) > current)
    .map((status) => ({ value: status, label: orderStatusLabelFor({ ...order, status }) }));
}

// Texto do botão que leva o pedido do site para a etapa.
export function stageActionLabel(status: OrderStatus, deliveryMethod?: string | null) {
  if (status === "in_production") return "Iniciar separação";
  if (status === "in_dispatch")
    return deliveryMethod === "pickup" ? "Pronto para retirada" : "Saiu para entrega";
  if (status === "delivered")
    return deliveryMethod === "pickup" ? "Marcar como retirado" : "Marcar como entregue";
  return orderStatusLabel(status);
}

export interface OrderStatusEvent {
  status: OrderStatus;
  actor: "painel" | "sistema" | "importado";
  created_at: string;
}

// Eventos gravados pelo banco a cada mudança de status (lê quem lê o pedido: loja e cliente).
export async function listOrderStatusEvents(orderId: string): Promise<OrderStatusEvent[]> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- tabela ainda fora do types.ts
  const { data, error } = await (supabase as any)
    .from("order_status_events")
    .select("status, actor, created_at")
    .eq("order_id", orderId)
    .order("created_at", { ascending: true });
  if (error) throw error;
  return (data ?? []) as OrderStatusEvent[];
}

export interface TimelineStep {
  key: string;
  label: string;
  at: string | null;
  done: boolean;
}

// Linha do tempo do pedido do site: etapas na ordem; feita mostra a data do evento (etapa pulada ou
// pedido antigo sem registro aparece feita, sem data). Cancelado: o que aconteceu + o cancelamento.
export function websiteTimeline(
  order: StageOrder & {
    created_at: string;
    paid_at?: string | null;
    cancel_reason?: string | null;
  },
  events: OrderStatusEvent[],
): TimelineStep[] {
  const lastAt = (status: OrderStatus) =>
    [...events].reverse().find((event) => event.status === status)?.created_at ?? null;
  const method = order.delivery_method;
  const steps: { status: OrderStatus; label: string; at: string | null }[] = [
    { status: "pending", label: "Pedido feito", at: lastAt("pending") ?? order.created_at },
    { status: "paid", label: "Pagamento aprovado", at: lastAt("paid") ?? order.paid_at ?? null },
    { status: "in_production", label: "Em separação", at: lastAt("in_production") },
    method === "shipping"
      ? { status: "shipped", label: "Enviado", at: lastAt("shipped") }
      : {
          status: "in_dispatch",
          label: method === "pickup" ? "Pronto para retirada" : "Saiu para entrega",
          at: lastAt("in_dispatch"),
        },
    {
      status: "delivered",
      label: method === "pickup" ? "Retirado" : "Entregue",
      at: lastAt("delivered"),
    },
  ];

  if (order.status === "cancelled") {
    return [
      ...steps
        .filter((step) => step.status === "pending" || step.at)
        .map((step) => ({ key: step.status, label: step.label, at: step.at, done: true })),
      {
        key: "cancelled",
        label: order.cancel_reason === "deadline" ? "Cancelado por prazo" : "Cancelado",
        at: lastAt("cancelled"),
        done: true,
      },
    ];
  }

  const rank = (status: OrderStatus | string | null | undefined) =>
    status === "pending" ? 0 : (stageRank[status as OrderStatus] ?? 0);
  const current = rank(order.status);
  return steps.map((step) => ({
    key: step.status,
    label: step.label,
    at: step.at,
    done: rank(step.status) <= current,
  }));
}

export const deliveryMethodLabel: Record<DeliveryMethod, string> = {
  local: "Entrega local",
  pickup: "Retirada na loja",
  shipping: "Correios/transportadora",
};

export interface DeliveryAddress {
  zip_code?: string;
  street?: string;
  address_number?: string;
  complement?: string;
  neighborhood?: string;
  city?: string;
  state?: string;
  ibge_code?: string;
}

export function formatDeliveryAddress(address: DeliveryAddress | null | undefined) {
  if (!address) return "";
  const zip = address.zip_code?.replace(/^(\d{5})(\d{3})$/, "$1-$2");
  return [
    [address.street, address.address_number].filter(Boolean).join(", "),
    address.complement,
    address.neighborhood,
    [address.city, address.state].filter(Boolean).join("/"),
    zip ? `CEP ${zip}` : "",
  ]
    .filter(Boolean)
    .join(" · ");
}

export function deliveryDaysLabel(min: number | null | undefined, max: number | null | undefined) {
  if (min == null && max == null) return "";
  const lo = min ?? max ?? 0;
  const hi = max ?? lo;
  if (hi === 0) return "no mesmo dia";
  if (lo === hi) return `${hi} ${hi === 1 ? "dia útil" : "dias úteis"}`;
  return `${lo} a ${hi} dias úteis`;
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

// Data que conta para a venda: pedido Concluído conta pela data de conclusão (gravada pelo banco);
// os demais (realizados, cancelados) pela data de criação.
export function saleDate(order: Pick<OrderRecord, "status" | "created_at" | "completed_at">) {
  return order.status === "delivered" && order.completed_at ? order.completed_at : order.created_at;
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
  completed_at: string | null;
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
  delivery_method: DeliveryMethod | null;
  shipping_service_name: string | null;
  shipping_amount: number;
  shipping_min_days: number | null;
  shipping_max_days: number | null;
  delivery_address: DeliveryAddress | null;
  payment_due_at: string | null;
  paid_at: string | null;
  cancel_reason: "deadline" | "manual" | null;
  stock_shortage: boolean;
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
    shipping_amount: Number(row.shipping_amount ?? 0),
  };
}

const ORDER_SELECT = `
  id, number, created_at, updated_at, completed_at, customer_id, created_by, status, source,
  subtotal, discount, surcharge, total, notes, payment_method, payment_details,
  paid_amount, change_due, delivery_method, shipping_service_name, shipping_amount,
  shipping_min_days, shipping_max_days, delivery_address,
  payment_due_at, paid_at, cancel_reason, stock_shortage,
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
  shipping = 0,
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
  // Frete do pedido do site continua no total quando o lojista edita os itens.
  const total = Number((subtotal - discount + surcharge + shipping).toFixed(2));

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
