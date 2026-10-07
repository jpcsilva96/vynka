import { supabase } from "@/integrations/supabase/client";
import type { OrderStatus } from "@/lib/orders";

// "boleto": só em pedido do site, vindo do Mercado Pago (não aparece na venda manual).
export type PaymentMethod = "cash" | "pix" | "debit" | "credit" | "payment_link" | "boleto";

export const paymentMethodLabel: Record<PaymentMethod, string> = {
  cash: "Dinheiro",
  pix: "Pix",
  debit: "Cartão de débito",
  credit: "Cartão de crédito",
  payment_link: "Link de pagamento",
  boleto: "Boleto",
};

export interface CartLine {
  key: string;
  product_id: string;
  variant_id: string | null;
  product_name: string;
  variant_name: string | null;
  image: string | null;
  unit_price: number;
  unit_cost: number;
  quantity: number;
}

export interface SavedSale {
  id: string;
  number: number;
  created_at: string;
}

export interface SavePayload {
  storeId: string;
  userId: string;
  customerId: string | null;
  items: CartLine[];
  subtotal: number;
  discount: number;
  surcharge: number;
  total: number;
  paymentMethod: PaymentMethod;
  paymentDetails: Record<string, unknown>;
  paidAmount: number | null;
  changeDue: number | null;
  notes?: string | null;
  status?: OrderStatus;
}

export async function saveSale(p: SavePayload): Promise<SavedSale> {
  if (p.items.length === 0) throw new Error("Carrinho vazio.");
  if (p.total < 0) throw new Error("Total inválido.");

  const { data: order, error } = await supabase
    .from("orders")
    .insert({
      store_id: p.storeId,
      customer_id: p.customerId,
      status: p.status ?? "confirmed",
      source: "manual",
      subtotal: p.subtotal,
      discount: p.discount,
      surcharge: p.surcharge,
      total: p.total,
      payment_method: p.paymentMethod,
      payment_details: p.paymentDetails,
      paid_amount: p.paidAmount,
      change_due: p.changeDue,
      created_by: p.userId,
      notes: p.notes ?? null,
    } as any)
    .select("id, number, created_at")
    .single();
  if (error || !order) throw error ?? new Error("Falha ao registrar a venda.");

  const rows = p.items.map((i) => ({
    store_id: p.storeId,
    order_id: (order as any).id as string,
    product_id: i.product_id,
    variant_id: i.variant_id,
    product_name: i.product_name,
    variant_name: i.variant_name,
    quantity: i.quantity,
    unit_price: i.unit_price,
    total_price: Number((i.unit_price * i.quantity).toFixed(2)),
    unit_cost: i.unit_cost,
    total_cost: Number((i.unit_cost * i.quantity).toFixed(2)),
  }));
  const { error: itemsErr } = await supabase.from("order_items").insert(rows);
  if (itemsErr) {
    await supabase
      .from("orders")
      .delete()
      .eq("id", (order as any).id);
    throw itemsErr;
  }

  return {
    id: (order as any).id,
    number: Number((order as any).number ?? 0),
    created_at: (order as any).created_at,
  };
}

export interface CustomerLite {
  id: string;
  name: string;
  phone: string | null;
  email: string | null;
}

export interface CustomerCreateInput {
  name: string;
  document?: string;
  notes?: string;
  birth_date?: string;
  email?: string;
  mobile?: string;
  telephone?: string;
  zip_code?: string;
  street?: string;
  address_number?: string;
  complement?: string;
  neighborhood?: string;
  city?: string;
  state?: string;
}

export async function listCustomers(storeId: string, q?: string): Promise<CustomerLite[]> {
  let query = supabase
    .from("customers")
    .select("id,name,phone,email")
    .eq("store_id", storeId)
    .order("name")
    .limit(50);
  if (q && q.trim()) {
    const s = q.trim().replace(/[%,]/g, "");
    query = query.or(`name.ilike.%${s}%,phone.ilike.%${s}%,email.ilike.%${s}%`);
  }
  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []) as CustomerLite[];
}

export async function createCustomer(
  storeId: string,
  name: string,
  phone: string,
  email?: string,
): Promise<CustomerLite> {
  const { data, error } = await supabase
    .from("customers")
    .insert({
      store_id: storeId,
      name: name.trim(),
      phone: phone.trim() || null,
      email: (email ?? "").trim() || null,
    })
    .select("id,name,phone,email")
    .single();
  if (error || !data) throw error ?? new Error("Falha ao criar cliente.");
  return data as CustomerLite;
}

export async function createCustomerDetailed(
  storeId: string,
  input: CustomerCreateInput,
): Promise<CustomerLite> {
  const clean = (value: string | undefined) => value?.trim() || null;
  const { data, error } = await supabase
    .from("customers")
    .insert({
      store_id: storeId,
      name: input.name.trim() || "Cliente sem nome",
      document: clean(input.document),
      notes: clean(input.notes),
      birth_date: clean(input.birth_date),
      email: clean(input.email),
      phone: clean(input.mobile),
      mobile: clean(input.mobile),
      telephone: clean(input.telephone),
      zip_code: clean(input.zip_code),
      street: clean(input.street),
      address_number: clean(input.address_number),
      complement: clean(input.complement),
      neighborhood: clean(input.neighborhood),
      city: clean(input.city),
      state: clean(input.state),
    } as any)
    .select("id,name,phone,email")
    .single();
  if (error || !data) throw error ?? new Error("Falha ao criar cliente.");
  return data as CustomerLite;
}

export interface VariantRow {
  id: string;
  sku_key: string;
  options: Record<string, string>;
  price: number | null;
  image_url: string | null;
  available: boolean;
}

export async function listProductVariants(productId: string): Promise<VariantRow[]> {
  const { data, error } = await supabase
    .from("product_variants")
    .select("id,sku_key,options,price,image_url,available,position")
    .eq("product_id", productId)
    .order("position");
  if (error) throw error;
  return (data ?? []).map((v: any) => ({
    id: v.id,
    sku_key: v.sku_key,
    options: v.options ?? {},
    price: v.price,
    image_url: v.image_url,
    available: v.available,
  }));
}

export function variantLabel(options: Record<string, string>): string {
  return Object.entries(options)
    .map(([, v]) => v)
    .join(" · ");
}
