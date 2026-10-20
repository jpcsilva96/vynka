import { useQuery } from "@tanstack/react-query";
import { resolveCustomerLogin, signUpStoreCustomer } from "@/lib/customer-auth.functions";
import type { DeliveryAddress, DeliveryMethod, OrderStatus } from "@/lib/orders";
import { PRODUCT_LIST_COLUMNS, type PublicProduct, isOnSale, mapProduct } from "@/lib/public-shop";
import { storeAuthClient } from "@/lib/store-auth";

// Conta do cliente é por loja (escopo login-por-loja, L3): toda leitura e escrita usa a sessão da
// própria loja (storeAuthClient), separada da sessão do painel e das outras lojas.
const dbFor = (storeId: string) =>
  storeAuthClient(storeId) as unknown as { from: (table: string) => any };

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
  payment_method: string | null;
  mp_payment_status: string | null;
  order_items: {
    id: string;
    product_name: string;
    variant_name: string | null;
    quantity: number;
    unit_price: number;
    total_price: number;
  }[];
}

export async function getSessionUser(storeId: string) {
  const { data, error } = await storeAuthClient(storeId).auth.getUser();
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
  const user = await getSessionUser(storeId);
  if (!user) return null;
  const { data, error } = await dbFor(storeId)
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

// Entrar com e-mail ou telefone: o servidor acha a conta desta loja e o navegador entra com a senha.
export async function signInCustomer(storeId: string, login: string, password: string) {
  const { email } = await resolveCustomerLogin({ data: { store_id: storeId, login } });
  const { error } = await storeAuthClient(storeId).auth.signInWithPassword({ email, password });
  if (error) throw new Error("E-mail, telefone ou senha incorretos.");
}

export async function signUpCustomer(input: {
  storeId: string;
  name: string;
  phone: string;
  email: string;
  password: string;
}) {
  // Conta e ficha criadas juntas pelo servidor; depois o navegador entra (sem confirmação de e-mail
  // no MVP, João 20/10).
  const { email } = await signUpStoreCustomer({
    data: {
      store_id: input.storeId,
      name: input.name,
      phone: input.phone,
      email: input.email,
      password: input.password,
    },
  });
  const { error } = await storeAuthClient(input.storeId).auth.signInWithPassword({
    email,
    password: input.password,
  });
  if (error)
    throw new Error("Conta criada, mas não foi possível entrar. Tente entrar com sua senha.");
  return getStoreCustomer(input.storeId);
}

export async function signOutCustomer(storeId: string) {
  await storeAuthClient(storeId).auth.signOut();
}

export async function upsertStoreCustomer(
  storeId: string,
  input: {
    name: string;
    phone?: string | null;
    email?: string | null;
  } & Partial<CustomerAddressForm>,
) {
  const user = await getSessionUser(storeId);
  if (!user) throw new Error("Cliente não autenticado.");
  // Só os campos recebidos: campo que não veio fica como está (antes, o login mandava só nome,
  // telefone e e-mail, e o endereço salvo era zerado).
  const optional = [
    "phone",
    "zip_code",
    "street",
    "address_number",
    "complement",
    "neighborhood",
    "city",
    "state",
  ] as const;
  const payload: {
    store_id: string;
    user_id: string;
    name: string;
    email: string | null;
  } & Partial<Record<(typeof optional)[number], string | null>> = {
    store_id: storeId,
    user_id: user.id,
    name: input.name,
    email: input.email ?? user.email ?? null,
  };
  for (const key of optional) {
    if (input[key] !== undefined) payload[key] = input[key] ?? null;
  }
  const db = dbFor(storeId);
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
  const db = dbFor(storeId);
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
  "payment_due_at,cancel_reason,stock_shortage,payment_method,mp_payment_status," +
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
  const db = dbFor(storeId);
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
  const db = dbFor(storeId);
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
  const db = dbFor(storeId);
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
  const db = dbFor(storeId);
  const customer = await getStoreCustomer(storeId);
  if (!customer?.user_id) return [];
  const { data, error } = await db
    .from("customer_favorites")
    .select(`product:products(${PRODUCT_LIST_COLUMNS})`)
    .eq("store_id", storeId)
    .eq("user_id", customer.user_id)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? [])
    .map((row: any) => row.product)
    .filter(Boolean)
    .map(mapProduct);
}

export function productDisplayPrice(product: PublicProduct) {
  return isOnSale(product) ? product.promo_price! : product.price;
}
