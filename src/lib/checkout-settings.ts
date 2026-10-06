/* eslint-disable @typescript-eslint/no-explicit-any -- tabelas novas ainda fora do types.ts gerado (regenerar e pendencia) */
import { supabase } from "@/integrations/supabase/client";

// Configurações de checkout da loja (escopo checkout/entrega/pagamento, lote A). Só guarda as
// escolhas do lojista; o checkout passa a usá-las nos lotes seguintes.

// Telas novas só aparecem com a flag ligada (homologação). Sai quando o checkout novo for publicado.
export const CHECKOUT_V2_ENABLED = import.meta.env.VITE_CHECKOUT_V2 === "true";

export type StockDeduction = "on_order" | "on_payment";

export interface CheckoutSettings {
  local_delivery_enabled: boolean;
  local_delivery_price: number;
  local_delivery_min_days: number;
  local_delivery_max_days: number;
  pickup_enabled: boolean;
  pickup_address: string;
  pickup_instructions: string;
  shipping_enabled: boolean;
  shipping_services: number[];
  package_weight_kg: number;
  package_height_cm: number;
  package_width_cm: number;
  package_length_cm: number;
  free_shipping_min_amount: number | null;
  free_shipping_local: boolean;
  free_shipping_services: number[];
  stock_deduction: StockDeduction;
  pix_expiration_hours: number;
  boleto_expiration_days: number;
}

export interface DeliveryCity {
  ibge_code: string;
  city_name: string;
  state: string;
  // null = usa o valor padrão da entrega local.
  price: number | null;
}

// Mínimos e máximos iguais aos do banco (20261006120000_store_checkout_settings.sql).
export const PIX_HOURS = { min: 24, max: 720 };
export const BOLETO_DAYS = { min: 3, max: 30 };
export const DELIVERY_DAYS = { min: 0, max: 60 };
export const PACKAGE_LIMITS = { weightKg: 30, sizeCm: 100 };

export const defaultCheckoutSettings: CheckoutSettings = {
  local_delivery_enabled: false,
  local_delivery_price: 0,
  local_delivery_min_days: 0,
  local_delivery_max_days: 1,
  pickup_enabled: false,
  pickup_address: "",
  pickup_instructions: "",
  shipping_enabled: false,
  shipping_services: [],
  package_weight_kg: 0.3,
  package_height_cm: 4,
  package_width_cm: 12,
  package_length_cm: 17,
  free_shipping_min_amount: null,
  free_shipping_local: false,
  free_shipping_services: [],
  stock_deduction: "on_order",
  pix_expiration_hours: PIX_HOURS.min,
  boleto_expiration_days: BOLETO_DAYS.min,
};

const SETTINGS_COLUMNS = Object.keys(defaultCheckoutSettings).join(",");

const num = (value: unknown, fallback: number) => {
  const n = Number(value);
  return value != null && Number.isFinite(n) ? n : fallback;
};
const numList = (value: unknown) =>
  Array.isArray(value) ? value.map(Number).filter((n) => Number.isInteger(n)) : [];

export function normalizeCheckoutSettings(value: unknown): CheckoutSettings {
  const raw = (value && typeof value === "object" ? value : {}) as Record<string, unknown>;
  const d = defaultCheckoutSettings;
  const bool = (key: keyof CheckoutSettings) =>
    typeof raw[key] === "boolean" ? (raw[key] as boolean) : (d[key] as boolean);
  const text = (key: keyof CheckoutSettings) =>
    typeof raw[key] === "string" ? (raw[key] as string) : "";
  return {
    local_delivery_enabled: bool("local_delivery_enabled"),
    local_delivery_price: num(raw.local_delivery_price, d.local_delivery_price),
    local_delivery_min_days: num(raw.local_delivery_min_days, d.local_delivery_min_days),
    local_delivery_max_days: num(raw.local_delivery_max_days, d.local_delivery_max_days),
    pickup_enabled: bool("pickup_enabled"),
    pickup_address: text("pickup_address"),
    pickup_instructions: text("pickup_instructions"),
    shipping_enabled: bool("shipping_enabled"),
    shipping_services: numList(raw.shipping_services),
    package_weight_kg: num(raw.package_weight_kg, d.package_weight_kg),
    package_height_cm: num(raw.package_height_cm, d.package_height_cm),
    package_width_cm: num(raw.package_width_cm, d.package_width_cm),
    package_length_cm: num(raw.package_length_cm, d.package_length_cm),
    free_shipping_min_amount:
      raw.free_shipping_min_amount == null ? null : num(raw.free_shipping_min_amount, 0) || null,
    free_shipping_local: bool("free_shipping_local"),
    free_shipping_services: numList(raw.free_shipping_services),
    stock_deduction: raw.stock_deduction === "on_payment" ? "on_payment" : "on_order",
    pix_expiration_hours: num(raw.pix_expiration_hours, d.pix_expiration_hours),
    boleto_expiration_days: num(raw.boleto_expiration_days, d.boleto_expiration_days),
  };
}

export async function getCheckoutSettings(storeId: string): Promise<CheckoutSettings> {
  const { data, error } = await (supabase as any)
    .from("store_checkout_settings")
    .select(SETTINGS_COLUMNS)
    .eq("store_id", storeId)
    .maybeSingle();
  if (error) throw error;
  return normalizeCheckoutSettings(data);
}

// Grava só os campos passados (cada aba salva os seus); a linha nasce no primeiro salvamento.
export async function saveCheckoutSettings(storeId: string, patch: Partial<CheckoutSettings>) {
  const clean: Record<string, unknown> = { ...patch };
  for (const key of ["pickup_address", "pickup_instructions"] as const) {
    if (key in clean) clean[key] = String(clean[key] ?? "").trim() || null;
  }
  const { error } = await (supabase as any)
    .from("store_checkout_settings")
    .upsert({ store_id: storeId, ...clean }, { onConflict: "store_id" });
  if (error) throw error;
}

export async function listDeliveryCities(storeId: string): Promise<DeliveryCity[]> {
  const { data, error } = await (supabase as any)
    .from("store_delivery_cities")
    .select("ibge_code,city_name,state,price")
    .eq("store_id", storeId)
    .order("state", { ascending: true })
    .order("city_name", { ascending: true });
  if (error) throw error;
  return (data ?? []).map((row: Record<string, unknown>) => ({
    ibge_code: String(row.ibge_code),
    city_name: String(row.city_name),
    state: String(row.state),
    price: row.price == null ? null : Number(row.price),
  }));
}

// Substitui a lista de cidades da loja pela da tela (apaga as removidas, grava as demais).
export async function saveDeliveryCities(storeId: string, cities: DeliveryCity[]) {
  const { data: existing, error: listError } = await (supabase as any)
    .from("store_delivery_cities")
    .select("ibge_code")
    .eq("store_id", storeId);
  if (listError) throw listError;
  const keep = new Set(cities.map((city) => city.ibge_code));
  const removed = (existing ?? [])
    .map((row: { ibge_code: string }) => row.ibge_code)
    .filter((code: string) => !keep.has(code));
  if (removed.length > 0) {
    const { error } = await (supabase as any)
      .from("store_delivery_cities")
      .delete()
      .eq("store_id", storeId)
      .in("ibge_code", removed);
    if (error) throw error;
  }
  if (cities.length > 0) {
    const { error } = await (supabase as any).from("store_delivery_cities").upsert(
      cities.map((city) => ({
        store_id: storeId,
        ibge_code: city.ibge_code,
        city_name: city.city_name,
        state: city.state,
        price: city.price,
      })),
      { onConflict: "store_id,ibge_code" },
    );
    if (error) throw error;
  }
}

export const BRAZIL_STATES = [
  "AC",
  "AL",
  "AM",
  "AP",
  "BA",
  "CE",
  "DF",
  "ES",
  "GO",
  "MA",
  "MG",
  "MS",
  "MT",
  "PA",
  "PB",
  "PE",
  "PI",
  "PR",
  "RJ",
  "RN",
  "RO",
  "RR",
  "RS",
  "SC",
  "SE",
  "SP",
  "TO",
] as const;

export interface IbgeCity {
  ibge_code: string;
  city_name: string;
}

// Lista oficial de municípios do IBGE (mesmo código que a consulta de CEP devolve no checkout).
export async function listIbgeCities(state: string): Promise<IbgeCity[]> {
  const response = await fetch(
    `https://servicodados.ibge.gov.br/api/v1/localidades/estados/${state}/municipios?orderBy=nome`,
  );
  if (!response.ok) throw new Error("Não foi possível carregar as cidades. Tente de novo.");
  const data = (await response.json()) as { id: number; nome: string }[];
  return data.map((city) => ({ ibge_code: String(city.id), city_name: city.nome }));
}
