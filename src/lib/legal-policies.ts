import { supabase } from "@/integrations/supabase/client";
import { formatPhone } from "@/lib/br-documents";
import type { StorefrontStore } from "@/lib/storefront-context";

// Páginas legais da loja (escopo paginas-legais.md): modelo padrão do Vynka preenchido pelo cadastro,
// com poucas escolhas do lojista. A parte exigida por lei (arrependimento, defeito, identificação,
// privacidade) não depende das escolhas e não é editável.

export type ExchangeShipping = "store" | "customer" | "first_free";

export interface LegalPolicies {
  exchange_enabled: boolean;
  exchange_days: 7 | 15 | 30;
  exchange_shipping: ExchangeShipping;
  preparation_days: 1 | 2 | 3 | 5;
  extra_exchange: string;
  extra_shipping: string;
  extra_privacy: string;
  updated_at: string | null;
}

// Padrões aprovados por João (20/10).
export const defaultLegalPolicies: LegalPolicies = {
  exchange_enabled: true,
  exchange_days: 30,
  exchange_shipping: "customer",
  preparation_days: 2,
  extra_exchange: "",
  extra_shipping: "",
  extra_privacy: "",
  updated_at: null,
};

export const EXCHANGE_DAYS = [7, 15, 30] as const;
export const PREPARATION_DAYS = [1, 2, 3, 5] as const;
export const EXTRA_TEXT_MAX = 2000;

const SETTING_KEY = "legal_policies";

export function normalizeLegalPolicies(value: unknown): LegalPolicies {
  const raw = (value && typeof value === "object" ? value : {}) as Record<string, unknown>;
  const d = defaultLegalPolicies;
  const pick = <T>(allowed: readonly T[], v: unknown, fallback: T) =>
    allowed.includes(v as T) ? (v as T) : fallback;
  const text = (v: unknown) => (typeof v === "string" ? v.slice(0, EXTRA_TEXT_MAX) : "");
  return {
    exchange_enabled:
      typeof raw.exchange_enabled === "boolean" ? raw.exchange_enabled : d.exchange_enabled,
    exchange_days: pick(EXCHANGE_DAYS, raw.exchange_days, d.exchange_days),
    exchange_shipping: pick(
      ["store", "customer", "first_free"] as const,
      raw.exchange_shipping,
      d.exchange_shipping,
    ),
    preparation_days: pick(PREPARATION_DAYS, raw.preparation_days, d.preparation_days),
    extra_exchange: text(raw.extra_exchange),
    extra_shipping: text(raw.extra_shipping),
    extra_privacy: text(raw.extra_privacy),
    updated_at: typeof raw.updated_at === "string" ? raw.updated_at : null,
  };
}

export async function getLegalPolicies(storeId: string): Promise<LegalPolicies> {
  const { data, error } = await supabase
    .from("store_settings")
    .select("setting_value")
    .eq("store_id", storeId)
    .eq("setting_key", SETTING_KEY)
    .maybeSingle();
  if (error) throw error;
  return normalizeLegalPolicies(data?.setting_value);
}

export async function saveLegalPolicies(storeId: string, policies: LegalPolicies) {
  const value = { ...normalizeLegalPolicies(policies), updated_at: new Date().toISOString() };
  const { error } = await supabase
    .from("store_settings")
    .upsert(
      { store_id: storeId, setting_key: SETTING_KEY, setting_value: value as never },
      { onConflict: "store_id,setting_key" },
    );
  if (error) throw error;
  return value;
}

function formatZip(value: string) {
  const d = value.replace(/D/g, "");
  return d.length === 8 ? `${d.slice(0, 5)}-${d.slice(5)}` : value;
}

/** CPF ou CNPJ com pontuação; outro formato volta como foi cadastrado. */
export function formatTaxDocument(value: string | null | undefined) {
  const raw = (value ?? "").trim();
  const d = raw.replace(/\D/g, "");
  if (d.length === 11) return d.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4");
  if (d.length === 14) return d.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, "$1.$2.$3/$4-$5");
  return raw;
}

/**
 * Identificação exigida pelo Decreto 7.962/2013: nome (com o responsável quando é pessoa física),
 * CPF ou CNPJ e endereço. Só entra o que estiver cadastrado.
 */
export function storeIdentity(store: StorefrontStore) {
  const document = formatTaxDocument(store.tax_document);
  const kind = (store.tax_document ?? "").replace(/\D/g, "").length === 11 ? "CPF" : "CNPJ";
  // A visão pública só entrega o responsável com CPF; a leitura do dono (rascunho) traz sempre.
  const name =
    kind === "CPF" && store.responsible_name
      ? `${store.name} (${store.responsible_name})`
      : store.name;
  const street = [store.address, store.address_number, store.complement].filter(Boolean).join(", ");
  const location = [store.city, store.state].filter(Boolean).join("/");
  const address = [street, location, store.zip_code ? `CEP ${formatZip(store.zip_code)}` : ""]
    .filter(Boolean)
    .join(" - ");
  return { name, document: document ? `${kind} ${document}` : "", address, street, location };
}

/** Canal para falar com a loja: WhatsApp quando houver, senão e-mail. */
export function storeContactLabel(store: { whatsapp: string | null; email: string | null }) {
  if (store.whatsapp) return `pelo WhatsApp ${formatPhone(store.whatsapp)}`;
  if (store.email) return `pelo e-mail ${store.email}`;
  return "pelos contatos desta loja";
}
