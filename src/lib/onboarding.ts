import { supabase } from "@/integrations/supabase/client";
import type { StoreSummary } from "@/lib/store-context";

export type BrandingKind = "logo" | "banner" | "og";

export interface StoreFullRow {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  segment: string | null;
  whatsapp: string | null;
  email: string | null;
  instagram: string | null;
  logo_url: string | null;
  banner_url: string | null;
  og_image_url: string | null;
  banner_title: string | null;
  banner_subtitle: string | null;
  banner_cta: string | null;
  address: string | null;
  city: string | null;
  state: string | null;
  zip_code: string | null;
  business_hours: string | null;
  delivery_notes: string | null;
  accepts_whatsapp_orders: boolean;
  accepts_site_orders: boolean;
  pickup_available: boolean;
  delivery_available: boolean;
  combine_delivery_whatsapp: boolean;
  onboarding_status: "not_started" | "in_progress" | "completed";
  onboarding_current_step: number;
  onboarding_completed_at: string | null;
  publication_status: "draft" | "published" | "unpublished" | "suspended";
  published_at: string | null;
}

const FULL_COLUMNS =
  "id,name,slug,description,segment,whatsapp,email,instagram,logo_url,banner_url,og_image_url,banner_title,banner_subtitle,banner_cta,address,city,state,zip_code,business_hours,delivery_notes,accepts_whatsapp_orders,accepts_site_orders,pickup_available,delivery_available,combine_delivery_whatsapp,onboarding_status,onboarding_current_step,onboarding_completed_at,publication_status,published_at";

export async function getStoreFull(storeId: string): Promise<StoreFullRow | null> {
  const { data, error } = await supabase
    .from("stores")
    .select(FULL_COLUMNS)
    .eq("id", storeId)
    .maybeSingle();
  if (error) throw error;
  return (data as unknown as StoreFullRow) ?? null;
}

export async function updateStore(
  storeId: string,
  patch: Partial<StoreFullRow>,
): Promise<void> {
  const { error } = await supabase.from("stores").update(patch).eq("id", storeId);
  if (error) throw error;
}

export async function saveStep(
  storeId: string,
  step: number,
  patch: Partial<StoreFullRow>,
): Promise<void> {
  await updateStore(storeId, {
    ...patch,
    onboarding_status: "in_progress",
    onboarding_current_step: Math.max(step, 1),
  });
}

export async function uploadBranding(
  storeId: string,
  kind: BrandingKind,
  file: File,
): Promise<string> {
  const ext = (file.name.split(".").pop() ?? "png").toLowerCase();
  const path = `${storeId}/${kind}-${Date.now()}.${ext}`;
  const { error } = await supabase.storage.from("store-branding").upload(path, file, {
    contentType: file.type || undefined,
    cacheControl: "31536000",
    upsert: false,
  });
  if (error) throw error;
  const { data } = supabase.storage.from("store-branding").getPublicUrl(path);
  return data.publicUrl;
}

export const SEGMENTS = [
  "Moda feminina",
  "Moda masculina",
  "Moda infantil",
  "Beleza",
  "Acessórios",
  "Casa e decoração",
  "Alimentação",
  "Outros",
];

export const ALLOWED_IMAGE_TYPES = ["image/png", "image/jpeg", "image/webp"];
export const MAX_IMAGE_SIZE = 8 * 1024 * 1024;

export function validateImage(file: File, allowSvg = false): string | null {
  const types = allowSvg ? [...ALLOWED_IMAGE_TYPES, "image/svg+xml"] : ALLOWED_IMAGE_TYPES;
  if (!types.includes(file.type)) return "Formato não suportado. Use PNG, JPG ou WEBP.";
  if (file.size > MAX_IMAGE_SIZE) return "Arquivo muito grande. Máximo 8MB.";
  return null;
}

export const digitsOnly = (v: string) => v.replace(/\D/g, "");
export const isValidWhatsApp = (v: string | null | undefined) => {
  if (!v) return false;
  const d = digitsOnly(v);
  return d.length >= 10 && d.length <= 13;
};

export interface Checklist {
  hasName: boolean;
  hasLogo: boolean;
  hasWhatsAppOrSite: boolean;
  hasActiveProduct: boolean;
  hasSlug: boolean;
  hasOrderChannel: boolean;
}

export async function computeChecklist(store: StoreFullRow): Promise<Checklist> {
  const { count } = await supabase
    .from("products")
    .select("id", { count: "exact", head: true })
    .eq("store_id", store.id)
    .eq("status", "active");
  const activeProducts = count ?? 0;
  const hasChannel =
    (store.accepts_whatsapp_orders && isValidWhatsApp(store.whatsapp)) ||
    store.accepts_site_orders;
  return {
    hasName: !!store.name?.trim(),
    hasLogo: !!store.logo_url,
    hasWhatsAppOrSite: store.accepts_site_orders || isValidWhatsApp(store.whatsapp),
    hasActiveProduct: activeProducts > 0,
    hasSlug: !!store.slug?.trim(),
    hasOrderChannel: hasChannel,
  };
}

export function canPublish(c: Checklist): boolean {
  return c.hasName && c.hasSlug && c.hasWhatsAppOrSite && c.hasActiveProduct;
}

export function progressPercent(c: Checklist): number {
  const items = [
    c.hasName,
    c.hasLogo,
    c.hasWhatsAppOrSite,
    c.hasActiveProduct,
    c.hasSlug,
    c.hasOrderChannel,
  ];
  const done = items.filter(Boolean).length;
  return Math.round((done / items.length) * 100);
}

export async function publishStore(storeId: string): Promise<void> {
  const store = await getStoreFull(storeId);
  if (!store) throw new Error("Loja não encontrada");
  const checklist = await computeChecklist(store);
  if (!canPublish(checklist)) throw new Error("Requisitos de publicação não atendidos.");
  await updateStore(storeId, {
    publication_status: "published",
    published_at: new Date().toISOString(),
    onboarding_status: "completed",
    onboarding_completed_at: new Date().toISOString(),
    onboarding_current_step: 5,
  });
}

export function summaryOfStore(s: StoreSummary): {
  needsOnboarding: boolean;
} {
  return { needsOnboarding: s.onboarding_status !== "completed" };
}
