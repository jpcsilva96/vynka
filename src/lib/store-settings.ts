import { supabase } from "@/integrations/supabase/client";

export interface GeneralSettingsForm {
  name: string;
  responsible_name: string;
  tax_document: string;
  phone: string;
  whatsapp: string;
  email: string;
  address: string;
  address_number: string;
  complement: string;
  city: string;
  state: string;
  zip_code: string;
  instagram: string;
  segment: string;
  description: string;
  logo_url: string;
  banner_url: string;
  og_image_url: string;
  banner_title: string;
  banner_subtitle: string;
  banner_cta: string;
  accepts_whatsapp_orders: boolean;
  accepts_site_orders: boolean;
}

export interface ReceiptSettings {
  include_customer: boolean;
  show_product_code: boolean;
  header_text: string;
  footer_text: string;
}

export interface DeliverySettings {
  delivery_available: boolean;
  pickup_available: boolean;
  combine_delivery_whatsapp: boolean;
  address: string;
  city: string;
  state: string;
  zip_code: string;
  business_hours: string;
  delivery_notes: string;
}

export type CatalogStyle = "minimal" | "elegant" | "commercial" | "editorial";
export type ProductCardStyle = "large" | "compact";
export type ProductLayout = "grid" | "list";
export type CatalogSection = "banner" | "description" | "categories" | "featured" | "products" | "promos";

export interface CatalogVisualSettings {
  catalog_style: CatalogStyle;
  primary_color: string;
  secondary_color: string;
  background_color: string;
  button_color: string;
  product_card_style: ProductCardStyle;
  product_layout: ProductLayout;
  show_price: boolean;
  show_whatsapp_button: boolean;
  show_banner: boolean;
  show_description: boolean;
  show_featured: boolean;
  show_categories: boolean;
  section_order: CatalogSection[];
}

export const defaultReceiptSettings: ReceiptSettings = {
  include_customer: true,
  show_product_code: true,
  header_text: "",
  footer_text: "",
};

export const defaultDeliverySettings: DeliverySettings = {
  delivery_available: true,
  pickup_available: true,
  combine_delivery_whatsapp: true,
  address: "",
  city: "",
  state: "",
  zip_code: "",
  business_hours: "",
  delivery_notes: "",
};

export const defaultCatalogVisualSettings: CatalogVisualSettings = {
  catalog_style: "minimal",
  primary_color: "#111111",
  secondary_color: "#737373",
  background_color: "#ffffff",
  button_color: "#111111",
  product_card_style: "large",
  product_layout: "grid",
  show_price: true,
  show_whatsapp_button: true,
  show_banner: true,
  show_description: true,
  show_featured: true,
  show_categories: true,
  section_order: ["banner", "description", "categories", "featured", "products", "promos"],
};

const STORE_FIELDS =
  "id,name,responsible_name,tax_document,phone,whatsapp,email,address,address_number,complement,city,state,zip_code,instagram,segment,description,logo_url,banner_url,og_image_url,banner_title,banner_subtitle,banner_cta,accepts_whatsapp_orders,accepts_site_orders";

export async function getGeneralSettings(storeId: string): Promise<GeneralSettingsForm | null> {
  const { data, error } = await supabase
    .from("stores")
    .select(STORE_FIELDS)
    .eq("id", storeId)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  return {
    name: data.name ?? "",
    responsible_name: data.responsible_name ?? "",
    tax_document: data.tax_document ?? "",
    phone: data.phone ?? "",
    whatsapp: data.whatsapp ?? "",
    email: data.email ?? "",
    address: data.address ?? "",
    address_number: data.address_number ?? "",
    complement: data.complement ?? "",
    city: data.city ?? "",
    state: data.state ?? "",
    zip_code: data.zip_code ?? "",
    instagram: data.instagram ?? "",
    segment: data.segment ?? "",
    description: data.description ?? "",
    logo_url: normalizeStoragePublicUrl(data.logo_url),
    banner_url: normalizeStoragePublicUrl(data.banner_url),
    og_image_url: normalizeStoragePublicUrl(data.og_image_url),
    banner_title: data.banner_title ?? "",
    banner_subtitle: data.banner_subtitle ?? "",
    banner_cta: data.banner_cta ?? "",
    accepts_whatsapp_orders: data.accepts_whatsapp_orders ?? true,
    accepts_site_orders: data.accepts_site_orders ?? true,
  };
}

export async function updateGeneralSettings(storeId: string, form: GeneralSettingsForm) {
  const clean = (value: string) => value.trim() || null;
  const { error } = await supabase
    .from("stores")
    .update({
      name: form.name.trim() || "Minha loja",
      responsible_name: clean(form.responsible_name),
      tax_document: clean(form.tax_document),
      phone: clean(form.phone),
      whatsapp: clean(form.whatsapp),
      email: clean(form.email),
      address: clean(form.address),
      address_number: clean(form.address_number),
      complement: clean(form.complement),
      city: clean(form.city),
      state: clean(form.state.toUpperCase()),
      zip_code: clean(form.zip_code),
      instagram: clean(form.instagram.replace(/^@/, "")),
      segment: clean(form.segment),
      description: clean(form.description),
      logo_url: clean(normalizeStoragePublicUrl(form.logo_url)),
      banner_url: clean(normalizeStoragePublicUrl(form.banner_url)),
      og_image_url: clean(normalizeStoragePublicUrl(form.og_image_url)),
      banner_title: clean(form.banner_title),
      banner_subtitle: clean(form.banner_subtitle),
      banner_cta: clean(form.banner_cta),
      accepts_whatsapp_orders: form.accepts_whatsapp_orders,
      accepts_site_orders: form.accepts_site_orders,
    })
    .eq("id", storeId);
  if (error) throw error;
}

export function normalizeStoragePublicUrl(value: string | null | undefined) {
  if (!value) return "";
  try {
    const url = new URL(value);
    const signedPath = "/storage/v1/object/sign/";
    const index = url.pathname.indexOf(signedPath);
    if (index === -1) return value;
    return `${url.origin}${url.pathname.replace(signedPath, "/storage/v1/object/public/")}`;
  } catch {
    return value;
  }
}

export type StoreBrandingKind = "logo" | "banner" | "og";

export async function uploadStoreBranding(storeId: string, kind: StoreBrandingKind, file: File) {
  const ext = file.name.split(".").pop() ?? "png";
  const path = `${storeId}/${kind}-${Date.now()}.${ext}`;
  const { error } = await supabase.storage.from("store-branding").upload(path, file, {
    contentType: file.type,
    cacheControl: "31536000",
    upsert: true,
  });
  if (error) throw error;
  const { data } = supabase.storage.from("store-branding").getPublicUrl(path);
  return data.publicUrl;
}

export function uploadStoreLogo(storeId: string, file: File) {
  return uploadStoreBranding(storeId, "logo", file);
}

export async function getReceiptSettings(storeId: string): Promise<ReceiptSettings> {
  const { data, error } = await supabase
    .from("store_settings")
    .select("setting_value")
    .eq("store_id", storeId)
    .eq("setting_key", "receipt")
    .maybeSingle();
  if (error) throw error;
  return normalizeReceiptSettings(data?.setting_value);
}

export async function updateReceiptSettings(storeId: string, settings: ReceiptSettings) {
  const { error } = await supabase.from("store_settings").upsert(
    {
      store_id: storeId,
      setting_key: "receipt",
      setting_value: settings,
    },
    { onConflict: "store_id,setting_key" },
  );
  if (error) throw error;
}

export async function getCatalogVisualSettings(storeId: string): Promise<CatalogVisualSettings> {
  const { data, error } = await supabase
    .from("store_settings")
    .select("setting_value")
    .eq("store_id", storeId)
    .eq("setting_key", "catalog_visual")
    .maybeSingle();
  if (error) throw error;
  return normalizeCatalogVisualSettings(data?.setting_value);
}

export async function updateCatalogVisualSettings(
  storeId: string,
  settings: CatalogVisualSettings,
) {
  const { error } = await supabase.from("store_settings").upsert(
    {
      store_id: storeId,
      setting_key: "catalog_visual",
      setting_value: normalizeCatalogVisualSettings(settings),
    },
    { onConflict: "store_id,setting_key" },
  );
  if (error) throw error;
}

export async function getDeliverySettings(storeId: string): Promise<DeliverySettings> {
  const { data, error } = await supabase
    .from("stores")
    .select(
      "delivery_available,pickup_available,combine_delivery_whatsapp,address,city,state,zip_code,business_hours,delivery_notes",
    )
    .eq("id", storeId)
    .maybeSingle();
  if (error) throw error;
  return normalizeDeliverySettings(data);
}

export async function updateDeliverySettings(storeId: string, settings: DeliverySettings) {
  const clean = (value: string) => value.trim() || null;
  const { error } = await supabase
    .from("stores")
    .update({
      delivery_available: settings.delivery_available,
      pickup_available: settings.pickup_available,
      combine_delivery_whatsapp: settings.combine_delivery_whatsapp,
      address: clean(settings.address),
      city: clean(settings.city),
      state: clean(settings.state.toUpperCase()),
      zip_code: clean(settings.zip_code),
      business_hours: clean(settings.business_hours),
      delivery_notes: clean(settings.delivery_notes),
    })
    .eq("id", storeId);
  if (error) throw error;
}

function pickString<T extends string>(value: unknown, allowed: readonly T[], fallback: T): T {
  return typeof value === "string" && allowed.includes(value as T) ? (value as T) : fallback;
}

function pickColor(value: unknown, fallback: string) {
  return typeof value === "string" && /^#[0-9A-Fa-f]{6}$/.test(value) ? value : fallback;
}

export function normalizeCatalogVisualSettings(value: unknown): CatalogVisualSettings {
  const raw = value && typeof value === "object" ? (value as Partial<CatalogVisualSettings>) : {};
  const rawWithLegacy = raw as Partial<CatalogVisualSettings> & { theme?: string };
  const catalogStyle = legacyThemeToCatalogStyle(rawWithLegacy.catalog_style ?? rawWithLegacy.theme);
  const sectionOrder = Array.isArray(raw.section_order)
    ? raw.section_order.filter((item): item is CatalogSection =>
        ["banner", "description", "categories", "featured", "products", "promos"].includes(
          String(item),
        ),
      )
    : defaultCatalogVisualSettings.section_order;
  const mergedOrder = [
    ...sectionOrder,
    ...defaultCatalogVisualSettings.section_order.filter((item) => !sectionOrder.includes(item)),
  ];
  return {
    catalog_style: catalogStyle,
    primary_color: pickColor(raw.primary_color, defaultCatalogVisualSettings.primary_color),
    secondary_color: pickColor(raw.secondary_color, defaultCatalogVisualSettings.secondary_color),
    background_color: pickColor(raw.background_color, defaultCatalogVisualSettings.background_color),
    button_color: pickColor(raw.button_color, defaultCatalogVisualSettings.button_color),
    product_card_style: pickString(raw.product_card_style, ["large", "compact"], "large"),
    product_layout: pickString(raw.product_layout, ["grid", "list"], "grid"),
    show_price:
      typeof raw.show_price === "boolean" ? raw.show_price : defaultCatalogVisualSettings.show_price,
    show_whatsapp_button:
      typeof raw.show_whatsapp_button === "boolean"
        ? raw.show_whatsapp_button
        : defaultCatalogVisualSettings.show_whatsapp_button,
    show_banner:
      typeof raw.show_banner === "boolean"
        ? raw.show_banner
        : defaultCatalogVisualSettings.show_banner,
    show_description:
      typeof raw.show_description === "boolean"
        ? raw.show_description
        : defaultCatalogVisualSettings.show_description,
    show_featured:
      typeof raw.show_featured === "boolean"
        ? raw.show_featured
        : defaultCatalogVisualSettings.show_featured,
    show_categories:
      typeof raw.show_categories === "boolean"
        ? raw.show_categories
        : defaultCatalogVisualSettings.show_categories,
    section_order: mergedOrder,
  };
}

function legacyThemeToCatalogStyle(value: unknown): CatalogStyle {
  if (value === "minimal" || value === "elegant" || value === "commercial" || value === "editorial") {
    return value;
  }
  if (value === "modern") return "elegant";
  if (value === "compact") return "commercial";
  if (value === "vitrine") return "editorial";
  return "minimal";
}

export function normalizeReceiptSettings(value: unknown): ReceiptSettings {
  const raw = value && typeof value === "object" ? (value as Partial<ReceiptSettings>) : {};
  return {
    include_customer:
      typeof raw.include_customer === "boolean"
        ? raw.include_customer
        : defaultReceiptSettings.include_customer,
    show_product_code:
      typeof raw.show_product_code === "boolean"
        ? raw.show_product_code
        : defaultReceiptSettings.show_product_code,
    header_text: typeof raw.header_text === "string" ? raw.header_text : "",
    footer_text: typeof raw.footer_text === "string" ? raw.footer_text : "",
  };
}

export function normalizeDeliverySettings(value: unknown): DeliverySettings {
  const raw = value && typeof value === "object" ? (value as Partial<DeliverySettings>) : {};
  return {
    delivery_available:
      typeof raw.delivery_available === "boolean"
        ? raw.delivery_available
        : defaultDeliverySettings.delivery_available,
    pickup_available:
      typeof raw.pickup_available === "boolean"
        ? raw.pickup_available
        : defaultDeliverySettings.pickup_available,
    combine_delivery_whatsapp:
      typeof raw.combine_delivery_whatsapp === "boolean"
        ? raw.combine_delivery_whatsapp
        : defaultDeliverySettings.combine_delivery_whatsapp,
    address: typeof raw.address === "string" ? raw.address : "",
    city: typeof raw.city === "string" ? raw.city : "",
    state: typeof raw.state === "string" ? raw.state : "",
    zip_code: typeof raw.zip_code === "string" ? raw.zip_code : "",
    business_hours: typeof raw.business_hours === "string" ? raw.business_hours : "",
    delivery_notes: typeof raw.delivery_notes === "string" ? raw.delivery_notes : "",
  };
}
