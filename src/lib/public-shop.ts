import { supabase } from "@/integrations/supabase/client";
import type { Category, ProductStatus } from "@/lib/products";
import type { StorefrontStore } from "@/lib/storefront-context";
import {
  normalizeCatalogVisualSettings,
  normalizeStoragePublicUrl,
  storeBannerLinkTypes,
  type StoreBanner,
  type StoreBannerLinkType,
} from "@/lib/store-settings";

export interface PublicProduct {
  id: string;
  name: string;
  description: string | null;
  price: number;
  promo_price: number | null;
  featured: boolean;
  status: ProductStatus;
  created_at: string;
  category: Category | null;
  images: { url: string; position: number }[];
  primary_image: string | null;
}

export type PublicCategory = Category & {
  cover_url: string | null;
  count: number;
  children: PublicCategory[];
};

export interface PublicVariant {
  id: string;
  options: Record<string, string>;
  sku_key: string;
  price: number | null;
  image_url: string | null;
  available: boolean;
  stock_quantity: number;
}

export interface PublicOption {
  id: string;
  name: string;
  position: number;
  values: { id: string; value: string; position: number }[];
}

export interface PublicProductDetail extends PublicProduct {
  manage_stock: boolean;
  stock_quantity: number;
  options: PublicOption[];
  variants: PublicVariant[];
}

const NEW_WINDOW_DAYS = 14;

export const isNew = (created_at: string) =>
  Date.now() - new Date(created_at).getTime() < NEW_WINDOW_DAYS * 86400_000;

export const isOnSale = (p: Pick<PublicProduct, "price" | "promo_price">) =>
  p.promo_price != null && p.promo_price < p.price;

function mapProduct(p: any): PublicProduct {
  const images = (p.product_images ?? [])
    .slice()
    .sort((a: any, b: any) => a.position - b.position);
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

const STOREFRONT_COLUMNS =
  "id,slug,name,description,logo_url,banner_url,og_image_url,banner_title,banner_subtitle,banner_cta,phone,whatsapp,email,instagram,address,address_number,complement,city,state,zip_code,business_hours,status,publication_status";

export async function getStoreBySlug(slug: string): Promise<StorefrontStore | null> {
  const { data, error } = await (supabase as any)
    .from("stores")
    .select(STOREFRONT_COLUMNS)
    .eq("slug", slug)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  const [{ data: visual, error: visualError }, { data: favicon, error: faviconError }] = await Promise.all([
    supabase
      .from("store_settings")
      .select("setting_value")
      .eq("store_id", data.id)
      .eq("setting_key", "catalog_visual")
      .maybeSingle(),
    supabase
      .from("store_settings")
      .select("setting_value")
      .eq("store_id", data.id)
      .eq("setting_key", "favicon")
      .maybeSingle(),
  ]);
  if (visualError) throw visualError;
  if (faviconError) throw faviconError;
  const { data: banners, error: bannersError } = await (supabase as any)
    .from("store_banners")
    .select("id,store_id,image_url,title,subtitle,button_label,link_type,link_target,sort_order,active")
    .eq("store_id", data.id)
    .eq("active", true)
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: true });
  if (bannersError && !isMissingStoreBannersTable(bannersError)) throw bannersError;
  const settingBanners =
    isMissingStoreBannersTable(bannersError) ? await listPublicBannersFromSettings(data.id) : [];
  return {
    ...(data as unknown as Omit<StorefrontStore, "catalog_visual" | "banners">),
    favicon_url: normalizeStoragePublicUrl(readPublicFaviconUrl(favicon?.setting_value)) || null,
    catalog_visual: normalizeCatalogVisualSettings(visual?.setting_value),
    banners: isMissingStoreBannersTable(bannersError) ? settingBanners : (banners ?? []).map((banner: any) => ({
      id: banner.id,
      store_id: banner.store_id,
      image_url: banner.image_url ?? "",
      title: banner.title ?? "",
      subtitle: banner.subtitle ?? "",
      button_label: banner.button_label ?? "",
      link_type: isBannerLinkType(banner.link_type) ? banner.link_type : "home",
      link_target: banner.link_target ?? "",
      sort_order: banner.sort_order ?? 0,
      active: banner.active ?? true,
    })),
  };
}

function readPublicFaviconUrl(value: unknown) {
  if (typeof value === "string") return value;
  if (value && typeof value === "object" && "url" in value) {
    const url = (value as { url?: unknown }).url;
    return typeof url === "string" ? url : "";
  }
  return "";
}

async function listPublicBannersFromSettings(storeId: string): Promise<StoreBanner[]> {
  const { data, error } = await (supabase as any)
    .from("store_settings")
    .select("setting_value")
    .eq("store_id", storeId)
    .eq("setting_key", "catalog_banners")
    .maybeSingle();
  if (error) throw error;
  if (!Array.isArray(data?.setting_value)) return [];
  return data.setting_value
    .map((value: any, index: number) => normalizePublicBannerValue(storeId, value, index))
    .filter((banner: any) => banner.active && banner.image_url);
}

function normalizePublicBannerValue(storeId: string, value: unknown, index: number): StoreBanner {
  const raw = value && typeof value === "object" ? (value as Partial<StoreBanner>) : {};
  return {
    id: typeof raw.id === "string" ? raw.id : `${storeId}-${index}`,
    store_id: storeId,
    image_url: typeof raw.image_url === "string" ? raw.image_url : "",
    title: typeof raw.title === "string" ? raw.title : "",
    subtitle: typeof raw.subtitle === "string" ? raw.subtitle : "",
    button_label: typeof raw.button_label === "string" ? raw.button_label : "",
    link_type: isBannerLinkType(raw.link_type ?? null) ? (raw.link_type as StoreBannerLinkType) : "home",
    link_target: typeof raw.link_target === "string" ? raw.link_target : "",
    sort_order: typeof raw.sort_order === "number" ? raw.sort_order : index,
    active: typeof raw.active === "boolean" ? raw.active : true,
  };
}

function isBannerLinkType(value: string | null): value is StoreBannerLinkType {
  return storeBannerLinkTypes.includes(value as StoreBannerLinkType);
}

function isMissingStoreBannersTable(error: { code?: string; message?: string } | null) {
  return (
    error?.code === "42P01" ||
    error?.code === "PGRST205" ||
    error?.message?.toLowerCase().includes("store_banners") === true
  );
}

export async function listActiveProducts(storeId: string): Promise<PublicProduct[]> {
  const { data, error } = await (supabase as any)
    .from("products")
    .select(
      `id, name, description, price, promo_price, featured, status, created_at,
       category:categories(id,name,slug,display_order,parent_id,active),
       product_images(url,position)`,
    )
    .eq("store_id", storeId)
    .eq("status", "active")
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []).map(mapProduct);
}

export async function listPublicCategories(
  storeId: string,
): Promise<PublicCategory[]> {
  const [cats, prods] = await Promise.all([
    supabase
      .from("categories")
      .select("id, name, slug, display_order, parent_id, active")
      .eq("store_id", storeId)
      .eq("active", true)
      .order("display_order")
      .order("name"),
    supabase
      .from("products")
      .select(`id, category_id, product_images(url,position)`)
      .eq("store_id", storeId)
      .eq("status", "active"),
  ]);
  if (cats.error) throw cats.error;
  if (prods.error) throw prods.error;

  const rawCategories = (cats.data ?? []).map((c) => ({
    id: c.id,
    name: c.name,
    slug: c.slug,
    position: c.display_order,
    parent_id: c.parent_id ?? null,
    active: c.active ?? true,
    cover_url: null as string | null,
    count: 0,
    children: [] as PublicCategory[],
  }));
  const byId = new Map(rawCategories.map((category) => [category.id, category]));
  const byCat = new Map<string, { count: number; cover: string | null }>();
  for (const p of prods.data ?? []) {
    const entry = byCat.get(p.category_id ?? "") ?? { count: 0, cover: null };
    entry.count += 1;
    if (!entry.cover) {
      const imgs = (p.product_images ?? []).slice().sort((a: any, b: any) => a.position - b.position);
      entry.cover = imgs[0]?.url ?? null;
    }
    byCat.set(p.category_id ?? "", entry);
  }
  for (const category of rawCategories) {
    const direct = byCat.get(category.id);
    category.cover_url = direct?.cover ?? null;
    category.count = direct?.count ?? 0;
  }
  for (const category of rawCategories) {
    let parent = category.parent_id ? byId.get(category.parent_id) : null;
    while (parent) {
      parent.count += category.count;
      if (!parent.cover_url) parent.cover_url = category.cover_url;
      parent = parent.parent_id ? byId.get(parent.parent_id) : null;
    }
  }
  const roots: PublicCategory[] = [];
  for (const category of rawCategories) {
    const parent = category.parent_id ? byId.get(category.parent_id) : null;
    if (parent) parent.children.push(category);
    else roots.push(category);
  }
  const sort = (items: PublicCategory[]) => {
    items.sort((a, b) => a.position - b.position || a.name.localeCompare(b.name));
    items.forEach((item) => sort(item.children));
  };
  sort(roots);
  return roots;
}

export async function getPublicProduct(
  storeId: string,
  id: string,
): Promise<PublicProductDetail | null> {
  const { data, error } = await (supabase as any)
    .from("products")
    .select(
      `id, name, description, price, promo_price, featured, status, created_at,
       manage_stock, stock_quantity,
       category:categories(id,name,slug,display_order,parent_id,active),
       product_images(url,position),
       product_options(id,name,position,product_option_values(id,value,position)),
       product_variants(id,options,sku_key,price,image_url,available,stock_quantity)`,
    )
    .eq("store_id", storeId)
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;

  const base = mapProduct(data);
  const options: PublicOption[] = (data.product_options ?? [])
    .slice()
    .sort((a: any, b: any) => a.position - b.position)
    .map((o: any) => ({
      id: o.id,
      name: o.name,
      position: o.position,
      values: (o.product_option_values ?? [])
        .slice()
        .sort((a: any, b: any) => a.position - b.position),
    }));
  const variants: PublicVariant[] = (data.product_variants ?? []).map((v: any) => ({
    id: v.id,
    options: v.options ?? {},
    sku_key: v.sku_key,
    price: v.price,
    image_url: v.image_url,
    available: v.available,
    stock_quantity: v.stock_quantity ?? 0,
  }));
  return {
    ...base,
    manage_stock: !!data.manage_stock,
    stock_quantity: Number(data.stock_quantity ?? 0),
    options,
    variants,
  };
}

export async function listRelatedProducts(
  storeId: string,
  categoryId: string | null,
  excludeId: string,
  limit = 4,
): Promise<PublicProduct[]> {
  let q = supabase
    .from("products")
    .select(
      `id, name, description, price, promo_price, featured, status, created_at,
       category:categories(id,name,slug,display_order,parent_id,active),
       product_images(url,position)`,
    )
    .eq("store_id", storeId)
    .eq("status", "active")
    .neq("id", excludeId)
    .limit(limit);
  if (categoryId) q = q.eq("category_id", categoryId);
  const { data, error } = await q;
  if (error) throw error;
  return (data ?? []).map(mapProduct);
}

export async function listActiveProductsByCategorySlug(
  storeId: string,
  categorySlug: string,
  childSlug?: string,
): Promise<{ category: PublicCategory | null; products: PublicProduct[] }> {
  const categories = await listPublicCategories(storeId);
  const flat = flattenCategories(categories);
  const parent = flat.find((category) => category.slug === categorySlug && !category.parent_id);
  const target = childSlug
    ? flat.find((category) => category.slug === childSlug && category.parent_id === parent?.id)
    : parent ?? flat.find((category) => category.slug === categorySlug);
  if (!target) return { category: null, products: [] };

  const ids = [target.id, ...descendantCategoryIds(target.id, flat)];
  const { data, error } = await (supabase as any)
    .from("products")
    .select(
      `id, name, description, price, promo_price, featured, status, created_at,
       category:categories(id,name,slug,display_order,parent_id,active),
       product_images(url,position)`,
    )
    .eq("store_id", storeId)
    .eq("status", "active")
    .in("category_id", ids)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return { category: target, products: (data ?? []).map(mapProduct) };
}

function flattenCategories(categories: PublicCategory[]): PublicCategory[] {
  return categories.flatMap((category) => [category, ...flattenCategories(category.children)]);
}

function descendantCategoryIds(categoryId: string, categories: PublicCategory[]) {
  const result: string[] = [];
  const walk = (id: string) => {
    for (const child of categories.filter((category) => category.parent_id === id)) {
      result.push(child.id);
      walk(child.id);
    }
  };
  walk(categoryId);
  return result;
}
