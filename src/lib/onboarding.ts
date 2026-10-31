import { supabase } from "@/integrations/supabase/client";
import { isProvisionalName, isProvisionalSlug } from "@/lib/provisional-store";

// Primeiros passos da loja (D13): o roteiro logo -> tema -> banner -> produto -> Mercado Pago -> publicar
// mora em "Loja e Catálogo" e no Dashboard. As colunas onboarding_* de `stores` vêm do assistente
// antigo (/admin/onboarding, removido); publishStore ainda as marca como concluídas.

export interface StoreFullRow {
  id: string;
  name: string;
  slug: string;
  logo_url: string | null;
  publication_status: "draft" | "published" | "unpublished" | "suspended";
  published_at: string | null;
}

const FULL_COLUMNS = "id,name,slug,logo_url,publication_status,published_at";

export async function getStoreFull(storeId: string): Promise<StoreFullRow | null> {
  const { data, error } = await supabase
    .from("stores")
    .select(FULL_COLUMNS)
    .eq("id", storeId)
    .maybeSingle();
  if (error) throw error;
  return (data as unknown as StoreFullRow) ?? null;
}

export interface Checklist {
  hasName: boolean;
  hasSlug: boolean;
  hasLogo: boolean;
  /** Personalização salva pelo menos uma vez no editor (toda loja já nasce com um tema). */
  hasTheme: boolean;
  hasBanner: boolean;
  hasActiveProduct: boolean;
  /** Mercado Pago conectado: sem ele o checkout recusa o pedido (checkout.functions.ts). */
  hasPayment: boolean;
}

export async function computeChecklist(store: StoreFullRow): Promise<Checklist> {
  const [products, visual, banners, payment] = await Promise.all([
    supabase
      .from("products")
      .select("id", { count: "exact", head: true })
      .eq("store_id", store.id)
      .eq("status", "active"),
    (supabase as any)
      .from("store_settings")
      .select("store_id")
      .eq("store_id", store.id)
      .eq("setting_key", "catalog_visual")
      .maybeSingle(),
    (supabase as any)
      .from("store_banners")
      .select("id", { count: "exact", head: true })
      .eq("store_id", store.id)
      .eq("active", true),
    (supabase as any).rpc("store_payment_connection_status", { _store_id: store.id }),
  ]);
  for (const result of [products, visual, banners, payment]) {
    if (result.error) throw result.error;
  }
  return {
    hasName: !isProvisionalName(store.name),
    hasSlug: !!store.slug?.trim() && !isProvisionalSlug(store.slug),
    hasLogo: !!store.logo_url,
    hasTheme: !!visual.data,
    hasBanner: (banners.count ?? 0) > 0,
    hasActiveProduct: (products.count ?? 0) > 0,
    hasPayment: (payment.data ?? []).length > 0,
  };
}

/** Obrigatório para publicar: loja identificada, com produto e recebendo pagamento. */
export function canPublish(c: Checklist): boolean {
  return c.hasName && c.hasSlug && c.hasActiveProduct && c.hasPayment;
}

export async function publishStore(storeId: string): Promise<void> {
  const store = await getStoreFull(storeId);
  if (!store) throw new Error("Loja não encontrada");
  const checklist = await computeChecklist(store);
  if (!canPublish(checklist)) throw new Error("Requisitos de publicação não atendidos.");
  const now = new Date().toISOString();
  const { error } = await supabase
    .from("stores")
    .update({
      publication_status: "published",
      published_at: now,
      onboarding_status: "completed",
      onboarding_completed_at: now,
      onboarding_current_step: 5,
    })
    .eq("id", storeId);
  if (error) throw error;
}
