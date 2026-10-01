import { supabase } from "@/integrations/supabase/client";

export interface GeneralSettingsForm {
  name: string;
  slug: string;
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
  favicon_url: string;
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
export type StoreFont =
  | "inter"
  | "montserrat"
  | "playfair"
  | "cormorant"
  | "georgia"
  | "roboto"
  | "open-sans"
  | "lato"
  | "poppins"
  | "raleway"
  | "nunito"
  | "merriweather"
  | "libre-baskerville"
  | "oswald"
  | "dancing-script";
export type StoreBannerLinkType = "home" | "store_home" | "product" | "category" | "external";

export interface StoreBanner {
  id: string;
  store_id: string;
  image_url: string;
  title: string;
  subtitle: string;
  button_label: string;
  link_type: StoreBannerLinkType;
  link_target: string;
  sort_order: number;
  active: boolean;
}

export interface CatalogVisualSettings {
  catalog_style: CatalogStyle;
  primary_color: string;
  secondary_color: string;
  background_color: string;
  button_color: string;
  button_hover_color: string;
  button_text_color: string;
  header_background_color: string;
  header_text_color: string;
  header_background_opacity: number;
  header_logo_size: number;
  header_show_store_name: boolean;
  header_categories_label: string;
  about_enabled: boolean;
  about_menu_label: string;
  about_title: string;
  about_description: string;
  about_image_url: string;
  contact_enabled: boolean;
  header_logo_centered: boolean;
  header_sticky: boolean;
  heading_font: StoreFont;
  body_font: StoreFont;
  heading_scale: number;
  body_scale: number;
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
  button_hover_color: "#333333",
  button_text_color: "#ffffff",
  header_background_color: "#ffffff",
  header_text_color: "#111111",
  header_background_opacity: 95,
  header_logo_size: 36,
  header_show_store_name: true,
  header_categories_label: "Categorias",
  about_enabled: false,
  about_menu_label: "Quem somos",
  about_title: "Quem somos",
  about_description: "",
  about_image_url: "",
  contact_enabled: true,
  header_logo_centered: false,
  header_sticky: true,
  heading_font: "inter",
  body_font: "inter",
  heading_scale: 100,
  body_scale: 100,
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
  "id,name,slug,responsible_name,tax_document,phone,whatsapp,email,address,address_number,complement,city,state,zip_code,instagram,segment,description,logo_url,banner_url,og_image_url,banner_title,banner_subtitle,banner_cta,accepts_whatsapp_orders,accepts_site_orders";

export async function getGeneralSettings(storeId: string): Promise<GeneralSettingsForm | null> {
  const [{ data, error }, { data: faviconSetting, error: faviconError }] = await Promise.all([
    supabase.from("stores").select(STORE_FIELDS).eq("id", storeId).maybeSingle(),
    supabase
      .from("store_settings")
      .select("setting_value")
      .eq("store_id", storeId)
      .eq("setting_key", "favicon")
      .maybeSingle(),
  ]);
  if (error) throw error;
  if (faviconError) throw faviconError;
  if (!data) return null;
  return {
    name: data.name ?? "",
    slug: data.slug ?? "",
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
    favicon_url: normalizeStoragePublicUrl(readFaviconUrl(faviconSetting?.setting_value)),
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
  const slug = normalizeSlug(form.slug || form.name);
  if (!slug) throw new Error("Informe o link publico do catalogo.");

  const { data: conflict, error: conflictError } = await (supabase as any)
    .from("stores")
    .select("id")
    .eq("slug", slug)
    .neq("id", storeId)
    .maybeSingle();
  if (conflictError) throw conflictError;
  if (conflict) throw new Error("Esse link de catalogo ja esta em uso.");

  const { error } = await (supabase as any)
    .from("stores")
    .update({
      name: form.name.trim() || "Minha loja",
      slug,
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

  const { error: faviconError } = await supabase.from("store_settings").upsert(
    {
      store_id: storeId,
      setting_key: "favicon",
      setting_value: { url: clean(normalizeStoragePublicUrl(form.favicon_url)) },
    },
    { onConflict: "store_id,setting_key" },
  );
  if (faviconError) throw faviconError;
}

function readFaviconUrl(value: unknown) {
  if (typeof value === "string") return value;
  if (value && typeof value === "object" && "url" in value) {
    const url = (value as { url?: unknown }).url;
    return typeof url === "string" ? url : "";
  }
  return "";
}

export function normalizeSlug(value: string) {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
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

export type StoreBrandingKind = "logo" | "favicon" | "banner" | "og" | "about";

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
  const { data, error } = await (supabase as any)
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
      setting_value: settings as any,
    },
    { onConflict: "store_id,setting_key" },
  );
  if (error) throw error;
}

export async function getCatalogVisualSettings(storeId: string): Promise<CatalogVisualSettings> {
  const { data, error } = await (supabase as any)
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
      setting_value: normalizeCatalogVisualSettings(settings) as any,
    },
    { onConflict: "store_id,setting_key" },
  );
  if (error) throw error;
}

export async function listStoreBanners(storeId: string): Promise<StoreBanner[]> {
  const { data, error } = await (supabase as any)
    .from("store_banners")
    .select("id,store_id,image_url,title,subtitle,button_label,link_type,link_target,sort_order,active")
    .eq("store_id", storeId)
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: true });
  if (isMissingStoreBannersTable(error)) return listStoreBannersFromSettings(storeId);
  if (error) throw error;
  return (data ?? []).map(normalizeStoreBanner);
}

export async function saveStoreBanners(storeId: string, banners: StoreBanner[]) {
  const clean = (value: string) => value.trim() || null;
  const validBanners = banners
    .map((banner, index) => ({
      ...banner,
      image_url: normalizeStoragePublicUrl(banner.image_url).trim(),
      sort_order: index,
    }))
    .filter((banner) => banner.image_url);

  const { data: existing, error: existingError } = await (supabase as any)
    .from("store_banners")
    .select("id")
    .eq("store_id", storeId);
  if (isMissingStoreBannersTable(existingError)) {
    await saveStoreBannersToSettings(storeId, validBanners);
    return;
  }
  if (existingError) throw existingError;

  const nextIds = new Set(validBanners.map((banner) => banner.id));
  const deleteIds = (existing ?? []).map((row: { id: string }) => row.id).filter((id: string) => !nextIds.has(id));
  if (deleteIds.length > 0) {
    const { error: deleteError } = await (supabase as any)
      .from("store_banners")
      .delete()
      .eq("store_id", storeId)
      .in("id", deleteIds);
    if (deleteError) throw deleteError;
  }

  if (validBanners.length === 0) return;

  const { error } = await (supabase as any).from("store_banners").upsert(
    validBanners.map((banner) => ({
      id: banner.id,
      store_id: storeId,
      image_url: banner.image_url,
      title: clean(banner.title),
      subtitle: clean(banner.subtitle),
      button_label: clean(banner.button_label),
      link_type: banner.link_type,
      link_target: clean(banner.link_target),
      sort_order: banner.sort_order,
      active: banner.active,
    })),
    { onConflict: "id" },
  );
  if (error) throw error;
}

async function listStoreBannersFromSettings(storeId: string): Promise<StoreBanner[]> {
  const { data, error } = await (supabase as any)
    .from("store_settings")
    .select("setting_value")
    .eq("store_id", storeId)
    .eq("setting_key", "catalog_banners")
    .maybeSingle();
  if (error) throw error;
  if (!Array.isArray(data?.setting_value)) return [];
  return data.setting_value
    .map((value, index) => normalizeStoreBannerValue(storeId, value, index))
    .filter((banner) => banner.image_url);
}

async function saveStoreBannersToSettings(storeId: string, banners: StoreBanner[]) {
  const { error } = await supabase.from("store_settings").upsert(
    {
      store_id: storeId,
      setting_key: "catalog_banners",
      setting_value: banners.map((banner, index) => ({
        id: banner.id,
        image_url: banner.image_url,
        title: banner.title,
        subtitle: banner.subtitle,
        button_label: banner.button_label,
        link_type: banner.link_type,
        link_target: banner.link_target,
        sort_order: index,
        active: banner.active,
      })),
    },
    { onConflict: "store_id,setting_key" },
  );
  if (error) throw error;
}

export async function getDeliverySettings(storeId: string): Promise<DeliverySettings> {
  const { data, error } = await (supabase as any)
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
  const { error } = await (supabase as any)
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

function pickScale(value: unknown, fallback: number, minimum: number, maximum: number) {
  return typeof value === "number" && Number.isFinite(value)
    ? Math.min(maximum, Math.max(minimum, Math.round(value)))
    : fallback;
}

export function storeFontFamily(font: StoreFont) {
  const families: Record<StoreFont, string> = {
    inter: '"Inter", ui-sans-serif, system-ui, sans-serif',
    montserrat: '"Montserrat", "Inter", ui-sans-serif, system-ui, sans-serif',
    playfair: '"Playfair Display", "Cormorant Garamond", Georgia, serif',
    cormorant: '"Cormorant Garamond", Georgia, serif',
    georgia: 'Georgia, "Times New Roman", serif',
    roboto: '"Roboto", "Inter", ui-sans-serif, system-ui, sans-serif',
    "open-sans": '"Open Sans", "Inter", ui-sans-serif, system-ui, sans-serif',
    lato: '"Lato", "Inter", ui-sans-serif, system-ui, sans-serif',
    poppins: '"Poppins", "Inter", ui-sans-serif, system-ui, sans-serif',
    raleway: '"Raleway", "Inter", ui-sans-serif, system-ui, sans-serif',
    nunito: '"Nunito", "Inter", ui-sans-serif, system-ui, sans-serif',
    merriweather: '"Merriweather", Georgia, serif',
    "libre-baskerville": '"Libre Baskerville", Georgia, serif',
    oswald: '"Oswald", "Arial Narrow", sans-serif',
    "dancing-script": '"Dancing Script", cursive',
  };
  return families[font];
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
    button_hover_color: pickColor(raw.button_hover_color, defaultCatalogVisualSettings.button_hover_color),
    button_text_color: pickColor(raw.button_text_color, defaultCatalogVisualSettings.button_text_color),
    header_background_color: pickColor(raw.header_background_color, defaultCatalogVisualSettings.header_background_color),
    header_text_color: pickColor(raw.header_text_color, defaultCatalogVisualSettings.header_text_color),
    header_background_opacity: pickScale(raw.header_background_opacity, defaultCatalogVisualSettings.header_background_opacity, 0, 100),
    header_logo_size: pickScale(raw.header_logo_size, defaultCatalogVisualSettings.header_logo_size, 24, 160),
    header_show_store_name:
      typeof raw.header_show_store_name === "boolean"
        ? raw.header_show_store_name
        : defaultCatalogVisualSettings.header_show_store_name,
    header_categories_label:
      typeof raw.header_categories_label === "string" && raw.header_categories_label.trim()
        ? raw.header_categories_label.trim().slice(0, 30)
        : defaultCatalogVisualSettings.header_categories_label,
    about_enabled:
      typeof raw.about_enabled === "boolean"
        ? raw.about_enabled
        : defaultCatalogVisualSettings.about_enabled,
    about_menu_label:
      typeof raw.about_menu_label === "string" && raw.about_menu_label.trim()
        ? raw.about_menu_label.trim().slice(0, 30)
        : defaultCatalogVisualSettings.about_menu_label,
    about_title:
      typeof raw.about_title === "string" && raw.about_title.trim()
        ? raw.about_title.trim().slice(0, 100)
        : defaultCatalogVisualSettings.about_title,
    about_description:
      typeof raw.about_description === "string"
        ? raw.about_description.slice(0, 5000)
        : defaultCatalogVisualSettings.about_description,
    about_image_url:
      typeof raw.about_image_url === "string"
        ? raw.about_image_url
        : defaultCatalogVisualSettings.about_image_url,
    contact_enabled:
      typeof raw.contact_enabled === "boolean"
        ? raw.contact_enabled
        : defaultCatalogVisualSettings.contact_enabled,
    header_logo_centered:
      typeof raw.header_logo_centered === "boolean"
        ? raw.header_logo_centered
        : defaultCatalogVisualSettings.header_logo_centered,
    header_sticky:
      typeof raw.header_sticky === "boolean"
        ? raw.header_sticky
        : defaultCatalogVisualSettings.header_sticky,
    heading_font: pickString(raw.heading_font, ["inter", "montserrat", "playfair", "cormorant", "georgia", "roboto", "open-sans", "lato", "poppins", "raleway", "nunito", "merriweather", "libre-baskerville", "oswald", "dancing-script"], "inter"),
    body_font: pickString(raw.body_font, ["inter", "montserrat", "playfair", "cormorant", "georgia", "roboto", "open-sans", "lato", "poppins", "raleway", "nunito", "merriweather", "libre-baskerville", "oswald", "dancing-script"], "inter"),
    heading_scale: pickScale(raw.heading_scale, defaultCatalogVisualSettings.heading_scale, 80, 140),
    body_scale: pickScale(raw.body_scale, defaultCatalogVisualSettings.body_scale, 85, 125),
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

function normalizeStoreBanner(row: {
  id: string;
  store_id: string;
  image_url: string | null;
  title: string | null;
  subtitle: string | null;
  button_label: string | null;
  link_type: string | null;
  link_target: string | null;
  sort_order: number | null;
  active: boolean | null;
}): StoreBanner {
  const linkType: StoreBannerLinkType =
    row.link_type === "product" ||
    row.link_type === "category" ||
    row.link_type === "external" ||
    row.link_type === "store_home" ||
    row.link_type === "home"
      ? row.link_type
      : "home";
  return {
    id: row.id,
    store_id: row.store_id,
    image_url: normalizeStoragePublicUrl(row.image_url),
    title: row.title ?? "",
    subtitle: row.subtitle ?? "",
    button_label: row.button_label ?? "",
    link_type: linkType,
    link_target: row.link_target ?? "",
    sort_order: row.sort_order ?? 0,
    active: row.active ?? true,
  };
}

function normalizeStoreBannerValue(storeId: string, value: unknown, index: number): StoreBanner {
  const raw = value && typeof value === "object" ? (value as Partial<StoreBanner>) : {};
  return normalizeStoreBanner({
    id: typeof raw.id === "string" ? raw.id : crypto.randomUUID(),
    store_id: storeId,
    image_url: typeof raw.image_url === "string" ? raw.image_url : "",
    title: typeof raw.title === "string" ? raw.title : null,
    subtitle: typeof raw.subtitle === "string" ? raw.subtitle : null,
    button_label: typeof raw.button_label === "string" ? raw.button_label : null,
    link_type: typeof raw.link_type === "string" ? raw.link_type : null,
    link_target: typeof raw.link_target === "string" ? raw.link_target : null,
    sort_order: typeof raw.sort_order === "number" ? raw.sort_order : index,
    active: typeof raw.active === "boolean" ? raw.active : true,
  });
}

function isMissingStoreBannersTable(error: { code?: string; message?: string } | null) {
  return (
    error?.code === "42P01" ||
    error?.code === "PGRST205" ||
    error?.message?.toLowerCase().includes("store_banners") === true
  );
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
