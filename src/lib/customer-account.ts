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

// Meus dados: nome e telefone. O e-mail não muda pela loja (identifica a conta e será o caminho do
// "Esqueci minha senha"; sem envio de e-mail não há como confirmar um novo).
export async function updateCustomerProfile(
  storeId: string,
  customer: StoreCustomer,
  input: { name: string; phone: string },
) {
  const { error } = await dbFor(storeId)
    .from("customers")
    .update({ name: input.name.trim(), phone: input.phone.replace(/\D/g, "") })
    .eq("id", customer.id);
  if (error?.code === "23505") throw new Error("Este telefone já está em outra conta desta loja.");
  if (error) throw new Error("Não foi possível salvar seus dados. Tente de novo.");
}

// Trocar a senha: confere a senha atual antes (entra de novo com ela na conta da loja).
export async function changeCustomerPassword(storeId: string, current: string, next: string) {
  const auth = storeAuthClient(storeId).auth;
  const user = await getSessionUser(storeId);
  if (!user?.email) throw new Error("Entre na sua conta para trocar a senha.");
  const check = await auth.signInWithPassword({ email: user.email, password: current });
  if (check.error) throw new Error("Senha atual incorreta.");
  const { error } = await auth.updateUser({ password: next });
  if (error) throw new Error("Não foi possível trocar a senha. Tente outra senha.");
}

// Meus endereços (lote 5a): até 10 por conta; o principal o banco copia para a ficha (e é o que o
// checkout já preenche). Marcar outro como principal troca; apagar o principal promove outro.
export const MAX_CUSTOMER_ADDRESSES = 10;

export interface CustomerAddress extends CustomerAddressForm {
  id: string;
  label: string | null;
  is_default: boolean;
}

const ADDRESS_COLUMNS =
  "id,label,zip_code,street,address_number,complement,neighborhood,city,state,is_default";

export function useCustomerAddresses(storeId: string, enabled: boolean) {
  return useQuery({
    queryKey: ["customer-addresses", storeId],
    queryFn: () => listCustomerAddresses(storeId),
    enabled,
  });
}

export async function listCustomerAddresses(storeId: string): Promise<CustomerAddress[]> {
  const { data, error } = await dbFor(storeId)
    .from("customer_addresses")
    .select(ADDRESS_COLUMNS)
    .eq("store_id", storeId)
    .order("is_default", { ascending: false })
    .order("created_at", { ascending: true });
  if (error) throw error;
  return (data ?? []) as CustomerAddress[];
}

const addressPayload = (address: CustomerAddressForm & { label?: string | null }) => ({
  label: address.label?.trim() || null,
  zip_code: address.zip_code.replace(/\D/g, ""),
  street: address.street.trim(),
  address_number: address.address_number.trim(),
  complement: address.complement.trim() || null,
  neighborhood: address.neighborhood.trim(),
  city: address.city.trim(),
  state: address.state.trim().toUpperCase(),
});

const addressError = (error: { message?: string } | null) =>
  error
    ? new Error(
        /Limite de 10/.test(error.message ?? "")
          ? `Você já tem ${MAX_CUSTOMER_ADDRESSES} endereços. Apague um para salvar outro.`
          : "Não foi possível salvar o endereço. Confira os campos e tente de novo.",
      )
    : null;

export async function saveCustomerAddress(
  storeId: string,
  customer: StoreCustomer,
  address: CustomerAddressForm & { id?: string; label?: string | null; is_default?: boolean },
) {
  const db = dbFor(storeId).from("customer_addresses");
  const payload = {
    ...addressPayload(address),
    ...(address.is_default ? { is_default: true } : {}),
  };
  const { error } = address.id
    ? await db.update(payload).eq("id", address.id)
    : await db.insert({ ...payload, store_id: storeId, customer_id: customer.id });
  const failure = addressError(error);
  if (failure) throw failure;
}

export async function setDefaultCustomerAddress(storeId: string, id: string) {
  const { error } = await dbFor(storeId)
    .from("customer_addresses")
    .update({ is_default: true })
    .eq("id", id);
  if (error) throw new Error("Não foi possível trocar o endereço principal.");
}

export async function deleteCustomerAddress(storeId: string, id: string) {
  const { error } = await dbFor(storeId).from("customer_addresses").delete().eq("id", id);
  if (error) throw new Error("Não foi possível apagar o endereço.");
}

// Checkout: o endereço usado na compra vira o principal. Se já está salvo (mesmo CEP, rua, número e
// complemento), só passa a ser o principal; senão entra como novo. Com 10 salvos, não grava.
export async function rememberCheckoutAddress(
  storeId: string,
  customer: StoreCustomer,
  address: CustomerAddressForm,
) {
  const key = (a: CustomerAddressForm) =>
    [a.zip_code.replace(/\D/g, ""), a.street, a.address_number, a.complement ?? ""]
      .map((part) => part.trim().toLowerCase())
      .join("|");
  const saved = await listCustomerAddresses(storeId);
  const same = saved.find((item) => key(item) === key(address));
  if (same) {
    if (!same.is_default) await setDefaultCustomerAddress(storeId, same.id);
    return;
  }
  if (saved.length >= MAX_CUSTOMER_ADDRESSES) return;
  await saveCustomerAddress(storeId, customer, { ...address, is_default: true });
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
