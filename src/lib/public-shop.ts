import { supabase } from "@/integrations/supabase/client";
import type { Category, ProductStatus } from "@/lib/products";
import type { StorefrontStore } from "@/lib/storefront-context";

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

export interface PublicVariant {
  id: string;
  options: Record<string, string>;
  sku_key: string;
  price: number | null;
  image_url: string | null;
  available: boolean;
}

export interface PublicOption {
  id: string;
  name: string;
  position: number;
  values: { id: string; value: string; position: number }[];
}

export interface PublicProductDetail extends PublicProduct {
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
    category: p.category ?? null,
    images,
    primary_image: images[0]?.url ?? null,
  };
}

const STOREFRONT_COLUMNS =
  "id,slug,name,description,logo_url,banner_url,og_image_url,banner_title,banner_subtitle,banner_cta,whatsapp,email,instagram,address,city,state,business_hours,status,publication_status";

export async function getStoreBySlug(slug: string): Promise<StorefrontStore | null> {
  const { data, error } = await supabase
    .from("stores")
    .select(STOREFRONT_COLUMNS)
    .eq("slug", slug)
    .maybeSingle();
  if (error) throw error;
  return (data as unknown as StorefrontStore) ?? null;
}

export async function listActiveProducts(storeId: string): Promise<PublicProduct[]> {
  const { data, error } = await supabase
    .from("products")
    .select(
      `id, name, description, price, promo_price, featured, status, created_at,
       category:categories(id,name,slug,position),
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
): Promise<(Category & { cover_url: string | null; count: number })[]> {
  const [cats, prods] = await Promise.all([
    supabase
      .from("categories")
      .select("id, name, slug, position")
      .eq("store_id", storeId)
      .order("position"),
    supabase
      .from("products")
      .select(`id, category_id, product_images(url,position)`)
      .eq("store_id", storeId)
      .eq("status", "active"),
  ]);
  if (cats.error) throw cats.error;
  if (prods.error) throw prods.error;

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
  return (cats.data ?? []).map((c) => {
    const e = byCat.get(c.id);
    return { ...c, cover_url: e?.cover ?? null, count: e?.count ?? 0 };
  });
}

export async function getPublicProduct(
  storeId: string,
  id: string,
): Promise<PublicProductDetail | null> {
  const { data, error } = await supabase
    .from("products")
    .select(
      `id, name, description, price, promo_price, featured, status, created_at,
       category:categories(id,name,slug,position),
       product_images(url,position),
       product_options(id,name,position,product_option_values(id,value,position)),
       product_variants(id,options,sku_key,price,image_url,available)`,
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
  }));
  return { ...base, options, variants };
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
       category:categories(id,name,slug,position),
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
