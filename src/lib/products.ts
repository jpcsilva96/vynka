import { supabase } from "@/integrations/supabase/client";

export type ProductStatus = "active" | "draft" | "archived";

export interface Category {
  id: string;
  name: string;
  slug: string;
  position: number;
  parent_id: string | null;
  active: boolean;
  product_count?: number;
}

export interface CategoryFormState {
  id?: string;
  name: string;
  slug: string;
  parent_id: string | null;
  active: boolean;
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
  stock_quantity: number;
  // Quantidade como veio do banco ao abrir a tela (só grava se o lojista mudou).
  loaded_stock?: number;
  position: number;
}

export interface ProductRecord {
  id: string;
  name: string;
  description: string | null;
  category_id: string | null;
  price: number;
  promo_price: number | null;
  cost_price: number;
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
  cost_price: string;
  featured: boolean;
  manage_stock: boolean;
  // Quantidade do produto sem variação (com variação, vale a de cada variação).
  stock_quantity: number;
  // Como veio do banco ao abrir a tela (só grava se o lojista mudou).
  loaded_stock?: number;
  // Peso (kg) e medidas (cm) para o frete; vazio = embalagem padrão da loja.
  weight_kg: string;
  height_cm: string;
  width_cm: string;
  length_cm: string;
  status: ProductStatus;
  images: ProductImage[];
  options: ProductOption[];
  variants: ProductVariant[];
}

interface ProductListImageRow {
  url: string;
  position: number;
}

interface ProductListRow extends Omit<
  ProductRecord,
  "category" | "primary_image" | "variant_count"
> {
  category?: {
    id: string;
    name: string;
    slug: string;
    display_order: number;
    parent_id?: string | null;
    active?: boolean;
  } | null;
  product_images?: ProductListImageRow[] | null;
  product_variants?: { id: string }[] | null;
}

interface ProductEditImageRow {
  id: string;
  url: string;
  storage_path: string | null;
  position: number;
}

interface ProductEditOptionValueRow {
  id: string;
  value: string;
  position: number;
}

interface ProductEditOptionRow {
  id: string;
  name: string;
  position: number;
  product_option_values?: ProductEditOptionValueRow[] | null;
}

interface ProductEditVariantRow {
  id: string;
  options: Record<string, string> | null;
  sku_key: string;
  price: number | string | null;
  image_url: string | null;
  available: boolean;
  stock_quantity?: number | null;
  position: number;
}

interface ProductEditRow {
  id: string;
  name: string | null;
  description: string | null;
  category_id: string | null;
  price: number | string | null;
  promo_price: number | string | null;
  cost_price: number | string | null;
  featured: boolean;
  manage_stock?: boolean | null;
  stock_quantity?: number | null;
  weight_kg?: number | string | null;
  height_cm?: number | string | null;
  width_cm?: number | string | null;
  length_cm?: number | string | null;
  status: ProductStatus;
  product_images?: ProductEditImageRow[] | null;
  product_options?: ProductEditOptionRow[] | null;
  product_variants?: ProductEditVariantRow[] | null;
}

export const emptyProductForm = (): ProductFormState => ({
  name: "",
  description: "",
  category_id: null,
  price: "",
  promo_price: "",
  cost_price: "",
  featured: false,
  manage_stock: false,
  stock_quantity: 0,
  weight_kg: "",
  height_cm: "",
  width_cm: "",
  length_cm: "",
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
    .map((o) => ({
      name: o.name.trim(),
      values: o.values.map((v) => v.value.trim()).filter(Boolean),
    }))
    .filter((o) => o.name && o.values.length > 0);
  if (clean.length === 0) return [];

  const combos: Record<string, string>[] = clean.reduce<Record<string, string>[]>((acc, opt) => {
    if (acc.length === 0) return opt.values.map((v) => ({ [opt.name]: v }));
    const next: Record<string, string>[] = [];
    for (const a of acc) for (const v of opt.values) next.push({ ...a, [opt.name]: v });
    return next;
  }, []);

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
        stock_quantity: 0,
        position: i,
      }
    );
  });
}

export const formatBRL = (v: number | null | undefined) =>
  v == null
    ? "—"
    : new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);

const parseMoney = (value: string) => Number(value.replace(",", ".")) || 0;

export function slugifyCategory(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

const moneyToInput = (value: number | string | null | undefined) => {
  if (value == null) return "";
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return "";
  return parsed.toFixed(2);
};

export async function uploadProductImage(storeId: string, file: File): Promise<ProductImage> {
  const ext = file.name.split(".").pop() ?? "jpg";
  // A pasta da loja permite que a policy do bucket restrinja escrita por loja.
  const path = `${storeId}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
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
  const [{ data, error }, counts] = await Promise.all([
    supabase
      .from("categories")
      .select("id, name, slug, display_order, parent_id, active")
      .eq("store_id", storeId)
      .order("display_order")
      .order("name"),
    supabase.from("products").select("id, category_id").eq("store_id", storeId),
  ]);
  if (error) throw error;
  if (counts.error) throw counts.error;
  const countByCategory = new Map<string, number>();
  for (const product of counts.data ?? []) {
    if (!product.category_id) continue;
    countByCategory.set(product.category_id, (countByCategory.get(product.category_id) ?? 0) + 1);
  }
  return (data ?? []).map((c) => ({
    id: c.id,
    name: c.name,
    slug: c.slug,
    position: c.display_order,
    parent_id: c.parent_id ?? null,
    active: c.active ?? true,
    product_count: countByCategory.get(c.id) ?? 0,
  }));
}

export async function createCategory(storeId: string, form: CategoryFormState): Promise<string> {
  const name = form.name.trim();
  const slug = slugifyCategory(form.slug || name);
  if (!name || !slug) throw new Error("Nome e slug sao obrigatorios.");

  const { data, error } = await supabase
    .from("categories")
    .insert({
      store_id: storeId,
      name,
      slug,
      parent_id: form.parent_id || null,
      active: form.active,
      display_order: form.position,
      position: form.position,
    } as any)
    .select("id")
    .single();
  if (error || !data) throw error;
  return data.id as string;
}

export async function updateCategory(
  storeId: string,
  categoryId: string,
  form: CategoryFormState,
): Promise<void> {
  const name = form.name.trim();
  const slug = slugifyCategory(form.slug || name);
  if (!name || !slug) throw new Error("Nome e slug sao obrigatorios.");
  if (form.parent_id === categoryId)
    throw new Error("Uma categoria nao pode ser filha dela mesma.");

  const categories = await listCategories(storeId);
  let cursor = form.parent_id
    ? categories.find((category) => category.id === form.parent_id)
    : null;
  while (cursor) {
    if (cursor.parent_id === categoryId) {
      throw new Error("Essa alteracao criaria um ciclo de subcategorias.");
    }
    cursor = cursor.parent_id
      ? (categories.find((category) => category.id === cursor?.parent_id) ?? null)
      : null;
  }

  const { error } = await supabase
    .from("categories")
    .update({
      name,
      slug,
      parent_id: form.parent_id || null,
      active: form.active,
      display_order: form.position,
      position: form.position,
    } as any)
    .eq("store_id", storeId)
    .eq("id", categoryId);
  if (error) throw error;
}

export async function deleteCategory(storeId: string, categoryId: string): Promise<void> {
  const [
    { count: productsCount, error: productsError },
    { count: childrenCount, error: childrenError },
  ] = await Promise.all([
    supabase
      .from("products")
      .select("id", { count: "exact", head: true })
      .eq("store_id", storeId)
      .eq("category_id", categoryId),
    supabase
      .from("categories")
      .select("id", { count: "exact", head: true })
      .eq("store_id", storeId)
      .eq("parent_id", categoryId),
  ]);
  if (productsError || childrenError) throw productsError ?? childrenError;
  if ((productsCount ?? 0) > 0) {
    throw new Error(
      "Esta categoria possui produtos vinculados. Remova ou altere a categoria dos produtos antes de excluir.",
    );
  }
  if ((childrenCount ?? 0) > 0) {
    throw new Error("Esta categoria possui subcategorias. Exclua ou mova as subcategorias antes.");
  }

  const { error } = await supabase
    .from("categories")
    .delete()
    .eq("store_id", storeId)
    .eq("id", categoryId);
  if (error) throw error;
}

export async function listProducts(storeId: string): Promise<ProductRecord[]> {
  const { data, error } = await supabase
    .from("products")
    .select(
      `id, name, description, category_id, price, promo_price, cost_price, featured, status, created_at, updated_at,
       category:categories(id,name,slug,display_order),
       product_images(url,position),
       product_variants(id)`,
    )
    .eq("store_id", storeId)
    .order("updated_at", { ascending: false });
  if (error) throw error;
  return ((data ?? []) as ProductListRow[]).map((p) => {
    const images = (p.product_images ?? []).slice().sort((a, b) => a.position - b.position);
    return {
      ...p,
      category: p.category
        ? {
            id: p.category.id,
            name: p.category.name,
            slug: p.category.slug,
            position: p.category.display_order,
            parent_id: p.category.parent_id ?? null,
            active: p.category.active ?? true,
          }
        : null,
      primary_image: images[0]?.url ?? null,
      variant_count: p.product_variants?.length ?? 0,
    } as ProductRecord;
  });
}

const dimensionToInput = (value: number | string | null | undefined) =>
  value == null || value === "" ? "" : String(Number(value)).replace(".", ",");

const DIMENSION_LIMITS = {
  weight_kg: { label: "Peso", max: 30, unit: "kg" },
  height_cm: { label: "Altura", max: 100, unit: "cm" },
  width_cm: { label: "Largura", max: 100, unit: "cm" },
  length_cm: { label: "Comprimento", max: 100, unit: "cm" },
} as const;

// Peso/medidas para o banco: vazio vira null (usa a embalagem padrão da loja); valor fora do limite
// para aqui com mensagem clara, antes de o banco recusar.
export function productDimensions(form: ProductFormState) {
  const out: Record<keyof typeof DIMENSION_LIMITS, number | null> = {
    weight_kg: null,
    height_cm: null,
    width_cm: null,
    length_cm: null,
  };
  for (const key of Object.keys(DIMENSION_LIMITS) as (keyof typeof DIMENSION_LIMITS)[]) {
    const raw = form[key].trim();
    if (!raw) continue;
    const value = Number(raw.replace(",", "."));
    const { label, max, unit } = DIMENSION_LIMITS[key];
    if (!Number.isFinite(value) || value <= 0 || value > max) {
      throw new Error(
        `${label}: informe um valor maior que 0 e até ${max} ${unit}, ou deixe vazio.`,
      );
    }
    out[key] = value;
  }
  return out;
}

export async function getProductForEdit(
  storeId: string,
  productId: string,
): Promise<ProductFormState | null> {
  const { data, error } = await supabase
    .from("products")
    .select(
      `id, name, description, category_id, price, promo_price, cost_price, featured, manage_stock, stock_quantity, status,
       weight_kg, height_cm, width_cm, length_cm,
       product_images(id,url,storage_path,position),
       product_options(id,name,position,product_option_values(id,value,position)),
       product_variants(id,options,sku_key,price,image_url,available,stock_quantity,position)`,
    )
    .eq("store_id", storeId)
    .eq("id", productId)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;

  // Colunas de peso/medidas ainda fora do types.ts gerado.
  const product = data as unknown as ProductEditRow;
  const images = (product.product_images ?? [])
    .slice()
    .sort((a, b) => a.position - b.position)
    .map((img, index) => ({
      id: img.id,
      url: img.url,
      storage_path: img.storage_path,
      position: index,
    }));

  const options = (product.product_options ?? [])
    .slice()
    .sort((a, b) => a.position - b.position)
    .map((opt, index) => ({
      id: opt.id,
      name: opt.name,
      position: index,
      values: (opt.product_option_values ?? [])
        .slice()
        .sort((a, b) => a.position - b.position)
        .map((value, valueIndex) => ({
          id: value.id,
          value: value.value,
          position: valueIndex,
        })),
    }));

  const variants = (product.product_variants ?? [])
    .slice()
    .sort((a, b) => a.position - b.position)
    .map((variant, index) => ({
      id: variant.id,
      options: variant.options ?? {},
      sku_key: variant.sku_key,
      price: variant.price == null ? null : Number(variant.price),
      image_url: variant.image_url,
      available: variant.available,
      stock_quantity: variant.stock_quantity ?? 0,
      loaded_stock: variant.stock_quantity ?? 0,
      position: index,
    }));

  return {
    id: product.id,
    name: product.name ?? "",
    description: product.description ?? "",
    category_id: product.category_id,
    price: moneyToInput(product.price),
    promo_price: moneyToInput(product.promo_price),
    cost_price: moneyToInput(product.cost_price),
    featured: product.featured,
    manage_stock: product.manage_stock ?? false,
    stock_quantity: Number(product.stock_quantity ?? 0),
    loaded_stock: Number(product.stock_quantity ?? 0),
    weight_kg: dimensionToInput(product.weight_kg),
    height_cm: dimensionToInput(product.height_cm),
    width_cm: dimensionToInput(product.width_cm),
    length_cm: dimensionToInput(product.length_cm),
    status: product.status,
    images,
    options,
    variants,
  };
}

export async function createProduct(storeId: string, form: ProductFormState): Promise<string> {
  const priceNum = parseMoney(form.price);
  const promo = form.promo_price ? parseMoney(form.promo_price) : null;
  const cost = parseMoney(form.cost_price);
  const dimensions = productDimensions(form);

  const { data: prod, error } = await supabase
    .from("products")
    .insert({
      ...(dimensions as object),
      store_id: storeId,
      name: form.name || "Produto sem nome",
      description: form.description,
      category_id: form.category_id,
      price: priceNum,
      promo_price: promo,
      cost_price: cost,
      featured: form.featured,
      manage_stock: form.manage_stock,
      ...({
        stock_quantity: form.manage_stock && form.variants.length === 0 ? form.stock_quantity : 0,
      } as object),
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
      await supabase
        .from("product_option_values")
        .insert(
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
        stock_quantity: form.manage_stock ? Math.max(0, v.stock_quantity ?? 0) : 0,
        position: i,
      })),
    );
  }

  return productId;
}

export async function updateProduct(
  storeId: string,
  productId: string,
  form: ProductFormState,
): Promise<void> {
  const priceNum = parseMoney(form.price);
  const promo = form.promo_price ? parseMoney(form.promo_price) : null;
  const cost = parseMoney(form.cost_price);
  const dimensions = productDimensions(form);

  const { error } = await supabase
    .from("products")
    .update({
      ...(dimensions as object),
      name: form.name || "Produto sem nome",
      description: form.description,
      category_id: form.category_id,
      price: priceNum,
      promo_price: promo,
      cost_price: cost,
      featured: form.featured,
      manage_stock: form.manage_stock,
      // Quantidade do produto sem variação: só quando o lojista mudou (venda com a tela aberta fica).
      ...(form.manage_stock &&
      form.variants.length === 0 &&
      form.stock_quantity !== form.loaded_stock
        ? ({ stock_quantity: form.stock_quantity } as object)
        : {}),
      status: form.status,
    })
    .eq("store_id", storeId)
    .eq("id", productId);
  if (error) throw error;

  // Variações ficam no lugar (mesmo id): os pedidos apontam para elas e o estoque é baixado e
  // devolvido nelas. Imagens e opções continuam sendo regravadas.
  const [{ error: imageDelete }, { error: optionDelete }] = await Promise.all([
    supabase.from("product_images").delete().eq("product_id", productId),
    supabase.from("product_options").delete().eq("product_id", productId),
  ]);
  if (imageDelete || optionDelete) {
    throw imageDelete ?? optionDelete;
  }

  if (form.images.length) {
    const { error: imageError } = await supabase.from("product_images").insert(
      form.images.map((img, i) => ({
        product_id: productId,
        url: img.url,
        storage_path: img.storage_path ?? null,
        position: i,
      })),
    );
    if (imageError) throw imageError;
  }

  for (const opt of form.options) {
    if (!opt.name.trim()) continue;
    const { data: optRow, error: optError } = await supabase
      .from("product_options")
      .insert({ product_id: productId, name: opt.name.trim(), position: opt.position })
      .select("id")
      .single();
    if (optError) throw optError;
    const values = opt.values.filter((v) => v.value.trim());
    if (values.length) {
      const { error: valuesError } = await supabase.from("product_option_values").insert(
        values.map((v, i) => ({
          option_id: optRow.id,
          value: v.value.trim(),
          position: i,
        })),
      );
      if (valuesError) throw valuesError;
    }
  }

  await saveVariantsInPlace(storeId, productId, form);
}

// Atualiza as variações que já existem (pelo id ou pela combinação), insere as novas e apaga só as
// que saíram. A quantidade só é gravada quando o lojista mudou o número na tela: assim uma venda
// feita enquanto a tela estava aberta não é desfeita ao salvar.
async function saveVariantsInPlace(storeId: string, productId: string, form: ProductFormState) {
  const { data: current, error: loadError } = await supabase
    .from("product_variants")
    .select("id, sku_key")
    .eq("product_id", productId);
  if (loadError) throw loadError;
  const byId = new Map((current ?? []).map((row) => [row.id as string, row]));
  const byKey = new Map((current ?? []).map((row) => [row.sku_key as string, row]));

  const kept = new Set<string>();
  const updates: { id: string; patch: Record<string, unknown> }[] = [];
  const inserts: Record<string, unknown>[] = [];
  form.variants.forEach((v, i) => {
    const match = (v.id && byId.get(v.id)) || byKey.get(v.sku_key);
    const fields = {
      options: v.options,
      sku_key: v.sku_key,
      price: v.price,
      image_url: v.image_url,
      available: v.available,
      position: i,
    };
    const stock = Math.max(0, v.stock_quantity ?? 0);
    if (match && !kept.has(match.id as string)) {
      kept.add(match.id as string);
      const stockChanged = form.manage_stock && stock !== (v.loaded_stock ?? null);
      updates.push({
        id: match.id as string,
        patch: stockChanged ? { ...fields, stock_quantity: stock } : fields,
      });
    } else {
      inserts.push({
        ...fields,
        store_id: storeId,
        product_id: productId,
        stock_quantity: form.manage_stock ? stock : 0,
      });
    }
  });

  const removed = (current ?? []).map((row) => row.id as string).filter((id) => !kept.has(id));
  if (removed.length) {
    const { error } = await supabase.from("product_variants").delete().in("id", removed);
    if (error) throw error;
  }
  for (const { id, patch } of updates) {
    const { error } = await supabase
      .from("product_variants")
      .update(patch as never)
      .eq("id", id)
      .eq("product_id", productId);
    if (error) throw error;
  }
  if (inserts.length) {
    const { error } = await supabase.from("product_variants").insert(inserts as never);
    if (error) throw error;
  }
}
