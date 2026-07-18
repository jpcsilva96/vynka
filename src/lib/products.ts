import { supabase } from "@/integrations/supabase/client";

export type ProductStatus = "active" | "draft" | "archived";

export interface Category {
  id: string;
  name: string;
  slug: string;
  position: number;
}

export interface ProductImage {
  id?: string;
  url: string;
  storage_path?: string | null;
  position: number;
}

export interface OptionValue {
  id?: string;
  value: string;
  position: number;
}

export interface ProductOption {
  id?: string;
  name: string;
  position: number;
  values: OptionValue[];
}

export interface ProductVariant {
  id?: string;
  options: Record<string, string>;
  sku_key: string;
  price: number | null;
  image_url: string | null;
  available: boolean;
  position: number;
}

export interface ProductRecord {
  id: string;
  name: string;
  description: string | null;
  category_id: string | null;
  price: number;
  promo_price: number | null;
  featured: boolean;
  status: ProductStatus;
  created_at: string;
  updated_at: string;
  category?: Category | null;
  primary_image?: string | null;
  variant_count?: number;
}

export interface ProductFormState {
  id?: string;
  name: string;
  description: string;
  category_id: string | null;
  price: string;
  promo_price: string;
  featured: boolean;
  status: ProductStatus;
  images: ProductImage[];
  options: ProductOption[];
  variants: ProductVariant[];
}

export const emptyProductForm = (): ProductFormState => ({
  name: "",
  description: "",
  category_id: null,
  price: "",
  promo_price: "",
  featured: false,
  status: "draft",
  images: [],
  options: [],
  variants: [],
});

export const skuKey = (options: Record<string, string>) =>
  Object.keys(options)
    .sort()
    .map((k) => `${k}:${options[k]}`)
    .join("|");

export function generateVariants(
  options: ProductOption[],
  existing: ProductVariant[] = [],
): ProductVariant[] {
  const clean = options
    .map((o) => ({ name: o.name.trim(), values: o.values.map((v) => v.value.trim()).filter(Boolean) }))
    .filter((o) => o.name && o.values.length > 0);
  if (clean.length === 0) return [];

  const combos: Record<string, string>[] = clean.reduce<Record<string, string>[]>(
    (acc, opt) => {
      if (acc.length === 0) return opt.values.map((v) => ({ [opt.name]: v }));
      const next: Record<string, string>[] = [];
      for (const a of acc) for (const v of opt.values) next.push({ ...a, [opt.name]: v });
      return next;
    },
    [],
  );

  const existingByKey = new Map(existing.map((v) => [v.sku_key, v]));
  return combos.map((opts, i) => {
    const key = skuKey(opts);
    const prev = existingByKey.get(key);
    return (
      prev ?? {
        options: opts,
        sku_key: key,
        price: null,
        image_url: null,
        available: true,
        position: i,
      }
    );
  });
}

export const formatBRL = (v: number | null | undefined) =>
  v == null
    ? "—"
    : new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);

export async function uploadProductImage(file: File): Promise<ProductImage> {
  const ext = file.name.split(".").pop() ?? "jpg";
  const path = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
  const { error } = await supabase.storage.from("product-images").upload(path, file, {
    contentType: file.type,
    cacheControl: "31536000",
    upsert: false,
  });
  if (error) throw error;
  const { data, error: sErr } = await supabase.storage
    .from("product-images")
    .createSignedUrl(path, 60 * 60 * 24 * 365 * 10);
  if (sErr || !data) throw sErr ?? new Error("signed url failed");
  return { url: data.signedUrl, storage_path: path, position: 0 };
}

export async function listCategories(storeId: string): Promise<Category[]> {
  const { data, error } = await supabase
    .from("categories")
    .select("id, name, slug, display_order")
    .eq("store_id", storeId)
    .order("display_order");
  if (error) throw error;
  return (data ?? []).map((c) => ({ id: c.id, name: c.name, slug: c.slug, position: c.display_order }));
}

export async function listProducts(storeId: string): Promise<ProductRecord[]> {
  const { data, error } = await supabase
    .from("products")
    .select(
      `id, name, description, category_id, price, promo_price, featured, status, created_at, updated_at,
       category:categories(id,name,slug,display_order),
       product_images(url,position),
       product_variants(id)`,
    )
    .eq("store_id", storeId)
    .order("updated_at", { ascending: false });
  if (error) throw error;
  return (data ?? []).map((p: any) => {
    const images = (p.product_images ?? []).slice().sort((a: any, b: any) => a.position - b.position);
    return {
      ...p,
      category: p.category
        ? { id: p.category.id, name: p.category.name, slug: p.category.slug, position: p.category.display_order }
        : null,
      primary_image: images[0]?.url ?? null,
      variant_count: p.product_variants?.length ?? 0,
    } as ProductRecord;
  });
}

export async function createProduct(storeId: string, form: ProductFormState): Promise<string> {
  const priceNum = Number(form.price.replace(",", ".")) || 0;
  const promo = form.promo_price ? Number(form.promo_price.replace(",", ".")) : null;

  const { data: prod, error } = await supabase
    .from("products")
    .insert({
      store_id: storeId,
      name: form.name || "Produto sem nome",
      description: form.description,
      category_id: form.category_id,
      price: priceNum,
      promo_price: promo,
      featured: form.featured,
      status: form.status,
    })
    .select("id")
    .single();
  if (error || !prod) throw error;
  const productId = prod.id as string;

  if (form.images.length) {
    await supabase.from("product_images").insert(
      form.images.map((img, i) => ({
        product_id: productId,
        url: img.url,
        storage_path: img.storage_path ?? null,
        position: i,
      })),
    );
  }

  for (const opt of form.options) {
    if (!opt.name.trim()) continue;
    const { data: optRow } = await supabase
      .from("product_options")
      .insert({ product_id: productId, name: opt.name.trim(), position: opt.position })
      .select("id")
      .single();
    if (!optRow) continue;
    const values = opt.values.filter((v) => v.value.trim());
    if (values.length) {
      await supabase.from("product_option_values").insert(
        values.map((v, i) => ({ option_id: optRow.id, value: v.value.trim(), position: i })),
      );
    }
  }

  if (form.variants.length) {
    await supabase.from("product_variants").insert(
      form.variants.map((v, i) => ({
        store_id: storeId,
        product_id: productId,
        options: v.options,
        sku_key: v.sku_key,
        price: v.price,
        image_url: v.image_url,
        available: v.available,
        position: i,
      })),
    );
  }

  return productId;
}
