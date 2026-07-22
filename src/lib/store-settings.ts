import { supabase } from "@/integrations/supabase/client";

export interface GeneralSettingsForm {
  name: string;
  responsible_name: string;
  tax_document: string;
  phone: string;
  whatsapp: string;
  address: string;
  instagram: string;
  description: string;
  logo_url: string;
}

export interface ReceiptSettings {
  include_customer: boolean;
  show_product_code: boolean;
  header_text: string;
  footer_text: string;
}

export interface DeliverySettings {
  delivery_enabled: boolean;
  pickup_enabled: boolean;
}

export const defaultReceiptSettings: ReceiptSettings = {
  include_customer: true,
  show_product_code: true,
  header_text: "",
  footer_text: "",
};

export const defaultDeliverySettings: DeliverySettings = {
  delivery_enabled: true,
  pickup_enabled: true,
};

const STORE_FIELDS =
  "id,name,responsible_name,tax_document,phone,whatsapp,address,instagram,description,logo_url";

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
    address: data.address ?? "",
    instagram: data.instagram ?? "",
    description: data.description ?? "",
    logo_url: data.logo_url ?? "",
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
      address: clean(form.address),
      instagram: clean(form.instagram.replace(/^@/, "")),
      description: clean(form.description),
      logo_url: clean(form.logo_url),
    })
    .eq("id", storeId);
  if (error) throw error;
}

export async function uploadStoreLogo(storeId: string, file: File) {
  const ext = file.name.split(".").pop() ?? "png";
  const path = `${storeId}/logo-${Date.now()}.${ext}`;
  const { error } = await supabase.storage.from("store-branding").upload(path, file, {
    contentType: file.type,
    cacheControl: "31536000",
    upsert: true,
  });
  if (error) throw error;
  const { data } = supabase.storage.from("store-branding").getPublicUrl(path);
  return data.publicUrl;
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

export async function getDeliverySettings(storeId: string): Promise<DeliverySettings> {
  const { data, error } = await supabase
    .from("store_settings")
    .select("setting_value")
    .eq("store_id", storeId)
    .eq("setting_key", "delivery")
    .maybeSingle();
  if (error) throw error;
  return normalizeDeliverySettings(data?.setting_value);
}

export async function updateDeliverySettings(storeId: string, settings: DeliverySettings) {
  const { error } = await supabase.from("store_settings").upsert(
    {
      store_id: storeId,
      setting_key: "delivery",
      setting_value: settings,
    },
    { onConflict: "store_id,setting_key" },
  );
  if (error) throw error;
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
    delivery_enabled:
      typeof raw.delivery_enabled === "boolean"
        ? raw.delivery_enabled
        : defaultDeliverySettings.delivery_enabled,
    pickup_enabled:
      typeof raw.pickup_enabled === "boolean"
        ? raw.pickup_enabled
        : defaultDeliverySettings.pickup_enabled,
  };
}
