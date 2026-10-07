import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { DeliveryAddress, DeliveryMethod, OrderStatus } from "@/lib/orders";
import { type PublicProduct, isOnSale } from "@/lib/public-shop";

type Db = typeof supabase;
const db = supabase as unknown as Db & { from: (table: string) => any };

export class EmailConfirmationRequiredError extends Error {
  constructor() {
    super("Cadastro criado. Confirme seu e-mail antes de entrar.");
    this.name = "EmailConfirmationRequiredError";
  }
}

export interface StoreCustomer {
  id: string;
  store_id: string;
  user_id: string | null;
  name: string;
  phone: string | null;
  email: string | null;
  zip_code: string | null;
  street: string | null;
  address_number: string | null;
  complement: string | null;
  neighborhood: string | null;
  city: string | null;
  state: string | null;
}

export interface CustomerAddressForm {
  zip_code: string;
  street: string;
  address_number: string;
  complement: string;
  neighborhood: string;
  city: string;
  state: string;
}

export interface CustomerOrder {
  id: string;
  number: number | null;
  created_at: string;
  status: OrderStatus;
  source: string;
  subtotal: number;
  total: number;
  notes: string | null;
  payment_details: Record<string, unknown>;
  delivery_method: DeliveryMethod | null;
  shipping_service_name: string | null;
  shipping_amount: number;
  shipping_min_days: number | null;
  shipping_max_days: number | null;
  delivery_address: DeliveryAddress | null;
  payment_due_at: string | null;
  cancel_reason: string | null;
  stock_shortage: boolean;
  order_items: {
    id: string;
    product_name: string;
    variant_name: string | null;
    quantity: number;
    unit_price: number;
    total_price: number;
  }[];
}

export async function getSessionUser() {
  const { data, error } = await supabase.auth.getUser();
  if (error) return null;
  return data.user ?? null;
}

export function useStoreCustomer(storeId: string) {
  return useQuery({
    queryKey: ["store-customer", storeId],
    queryFn: () => getStoreCustomer(storeId),
    enabled: !!storeId,
  });
}

export async function getStoreCustomer(storeId: string): Promise<StoreCustomer | null> {
  const user = await getSessionUser();
  if (!user) return null;
  const { data, error } = await db
    .from("customers")
    .select(
      "id,store_id,user_id,name,phone,email,zip_code,street,address_number,complement,neighborhood,city,state",
    )
    .eq("store_id", storeId)
    .eq("user_id", user.id)
    .maybeSingle();
  if (error) throw error;
  return data as StoreCustomer | null;
}

export async function signInCustomer(email: string, password: string) {
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw error;
}

export async function signUpCustomer(input: {
  storeId: string;
  name: string;
  phone: string;
  email: string;
  password: string;
}) {
  const { data, error } = await supabase.auth.signUp({
    email: input.email,
    password: input.password,
    options: { data: { full_name: input.name, phone: input.phone } },
  });
  if (error) throw error;

  if (!data.session) {
    throw new EmailConfirmationRequiredError();
  }

  return upsertStoreCustomer(input.storeId, {
    name: input.name,
    phone: input.phone,
    email: input.email,
  });
}

export async function signOutCustomer() {
  await supabase.auth.signOut();
}

export async function upsertStoreCustomer(
  storeId: string,
  input: {
    name: string;
    phone?: string | null;
    email?: string | null;
  } & Partial<CustomerAddressForm>,
) {
  const user = await getSessionUser();
  if (!user) throw new Error("Cliente nao autenticado.");
  const payload = {
    store_id: storeId,
    user_id: user.id,
    name: input.name,
    phone: input.phone ?? null,
    email: input.email ?? user.email ?? null,
    zip_code: input.zip_code ?? null,
    street: input.street ?? null,
    address_number: input.address_number ?? null,
    complement: input.complement ?? null,
    neighborhood: input.neighborhood ?? null,
    city: input.city ?? null,
    state: input.state ?? null,
  };
  const { data: existing, error: existingError } = await db
    .from("customers")
    .select("id")
    .eq("store_id", storeId)
    .eq("user_id", user.id)
    .maybeSingle();
  if (existingError) throw existingError;

  const query = existing?.id
    ? db
        .from("customers")
        .update(payload)
        .eq("id", existing.id)
        .select(
          "id,store_id,user_id,name,phone,email,zip_code,street,address_number,complement,neighborhood,city,state",
        )
        .single()
    : db
        .from("customers")
        .insert(payload)
        .select(
          "id,store_id,user_id,name,phone,email,zip_code,street,address_number,complement,neighborhood,city,state",
        )
        .single();
  const { data, error } = await query;
  if (error) throw error;
  return data as StoreCustomer;
}

export async function updateCustomerAddress(
  storeId: string,
  customer: StoreCustomer,
  address: CustomerAddressForm,
) {
  return upsertStoreCustomer(storeId, {
    name: customer.name,
    phone: customer.phone,
    email: customer.email,
    ...address,
  });
}

export async function listCustomerOrders(storeId: string): Promise<CustomerOrder[]> {
  const customer = await getStoreCustomer(storeId);
  if (!customer) return [];
  const { data, error } = await db
    .from("orders")
    .select(CUSTOMER_ORDER_SELECT)
    .eq("store_id", storeId)
    .eq("customer_id", customer.id)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return ((data ?? []) as unknown as CustomerOrder[]).map(normalizeCustomerOrder);
}

const CUSTOMER_ORDER_SELECT =
  "id,number,created_at,status,source,subtotal,total,notes,payment_details," +
  "delivery_method,shipping_service_name,shipping_amount,shipping_min_days,shipping_max_days,delivery_address," +
  "payment_due_at,cancel_reason,stock_shortage," +
  "order_items(id,product_name,variant_name,quantity,unit_price,total_price)";

const normalizeCustomerOrder = (order: CustomerOrder): CustomerOrder => ({
  ...order,
  subtotal: Number(order.subtotal ?? 0),
  total: Number(order.total ?? 0),
  shipping_amount: Number(order.shipping_amount ?? 0),
});

// Pedido como ficou gravado (preços, frete e total do banco). O pedido do site é criado pelo
// servidor (placeCheckoutOrder em checkout.functions.ts), não pelo navegador.
export async function getCustomerOrder(
  storeId: string,
  orderId: string,
): Promise<CustomerOrder | null> {
  const { data, error } = await db
    .from("orders")
    .select(CUSTOMER_ORDER_SELECT)
    .eq("store_id", storeId)
    .eq("id", orderId)
    .maybeSingle();
  if (error) throw error;
  return data ? normalizeCustomerOrder(data as unknown as CustomerOrder) : null;
}

export async function listFavoriteProductIds(storeId: string): Promise<string[]> {
  const customer = await getStoreCustomer(storeId);
  if (!customer) return [];
  const { data, error } = await db
    .from("customer_favorites")
    .select("product_id")
    .eq("store_id", storeId)
    .eq("user_id", customer.user_id as string);
  if (error) throw error;
  return (data ?? []).map((item: { product_id: string }) => item.product_id);
}

export async function toggleFavorite(storeId: string, productId: string) {
  const customer = await getStoreCustomer(storeId);
  if (!customer?.user_id) throw new Error("login_required");
  const { data: existing, error: existingError } = await db
    .from("customer_favorites")
    .select("id")
    .eq("store_id", storeId)
    .eq("user_id", customer.user_id)
    .eq("product_id", productId)
    .maybeSingle();
  if (existingError) throw existingError;
  if (existing?.id) {
    const { error } = await db.from("customer_favorites").delete().eq("id", existing.id);
    if (error) throw error;
    return false;
  }
  const { error } = await db.from("customer_favorites").insert({
    store_id: storeId,
    customer_id: customer.id,
    user_id: customer.user_id,
    product_id: productId,
  });
  if (error) throw error;
  return true;
}

export async function listFavoriteProducts(storeId: string): Promise<PublicProduct[]> {
  const customer = await getStoreCustomer(storeId);
  if (!customer?.user_id) return [];
  const { data, error } = await db
    .from("customer_favorites")
    .select(
      `
      product:products(
        id,name,description,price,promo_price,featured,status,created_at,
        category:categories(id,name,slug,display_order,parent_id,active),
        product_images(url,position)
      )
    `,
    )
    .eq("store_id", storeId)
    .eq("user_id", customer.user_id)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? [])
    .map((row: any) => row.product)
    .filter(Boolean)
    .map(mapFavoriteProduct);
}

function mapFavoriteProduct(p: any): PublicProduct {
  const images = (p.product_images ?? []).slice().sort((a: any, b: any) => a.position - b.position);
  return {
    id: p.id,
    name: p.name,
    description: p.description,
    price: p.price,
    promo_price: p.promo_price,
    featured: p.featured,
    status: p.status,
    created_at: p.created_at,
    category: p.category
      ? {
          id: p.category.id,
          name: p.category.name,
          slug: p.category.slug,
          position: p.category.display_order ?? p.category.position ?? 0,
          parent_id: p.category.parent_id ?? null,
          active: p.category.active ?? true,
        }
      : null,
    images,
    primary_image: images[0]?.url ?? null,
  };
}

export function productDisplayPrice(product: PublicProduct) {
  return isOnSale(product) ? product.promo_price! : product.price;
}
