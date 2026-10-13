import { z } from "zod";
import {
  isNew,
  isOnSale,
  normalizeSearchText,
  type PublicCategory,
  type PublicProduct,
} from "@/lib/public-shop";

// Ordenar e filtrar as listas da loja (escopo do catálogo, §5). Tudo roda no navegador sobre os
// produtos ativos já carregados; o estado fica no endereço da página (dá para voltar e compartilhar).

export const sortOptions = [
  { value: "mais-vendidos", label: "Mais vendidos" },
  { value: "novidades", label: "Novidades" },
  { value: "menor-preco", label: "Menor preço" },
  { value: "maior-preco", label: "Maior preço" },
] as const;

export type SortKey = (typeof sortOptions)[number]["value"];

const sortKeys = sortOptions.map((option) => option.value) as [SortKey, ...SortKey[]];

const priceParam = z.coerce.number().nonnegative().optional().catch(undefined);

// Parâmetros do endereço: ordem, categoria, preço de/até e opções ("Tamanho:P").
export const listingSearchSchema = z.object({
  ordem: z.enum(sortKeys).optional().catch(undefined),
  categoria: z.string().optional().catch(undefined),
  min: priceParam,
  max: priceParam,
  opcao: z
    .union([z.string(), z.array(z.string())])
    .optional()
    .transform((value) => (value == null ? undefined : Array.isArray(value) ? value : [value]))
    .catch(undefined),
});

export type ListingSearch = z.infer<typeof listingSearchSchema>;

export const effectivePrice = (product: PublicProduct) =>
  isOnSale(product) ? product.promo_price! : product.price;

export function sortProducts(
  products: PublicProduct[],
  sort: SortKey,
  salesRank: Record<string, number>,
) {
  const newest = (a: PublicProduct, b: PublicProduct) => b.created_at.localeCompare(a.created_at);
  const list = products.slice();
  switch (sort) {
    case "menor-preco":
      return list.sort((a, b) => effectivePrice(a) - effectivePrice(b) || newest(a, b));
    case "maior-preco":
      return list.sort((a, b) => effectivePrice(b) - effectivePrice(a) || newest(a, b));
    case "novidades":
      return list.sort(newest);
    default:
      // Quem vendeu vem primeiro, pela posição; quem ainda não vendeu, depois, dos mais novos.
      return list.sort((a, b) => {
        const ra = salesRank[a.id] ?? Number.POSITIVE_INFINITY;
        const rb = salesRank[b.id] ?? Number.POSITIVE_INFINITY;
        return ra === rb ? newest(a, b) : ra - rb;
      });
  }
}

const optionKey = (name: string, value: string) => `${name}:${value}`;

function splitOptionKey(key: string) {
  const index = key.indexOf(":");
  return index < 0 ? null : { name: key.slice(0, index), value: key.slice(index + 1) };
}

// Ids da categoria escolhida e das subcategorias dela.
function categoryIds(categories: PublicCategory[], slug: string) {
  const root = categories.find((category) => category.slug === slug);
  if (!root) return null;
  const ids = new Set<string>();
  const walk = (category: PublicCategory) => {
    ids.add(category.id);
    category.children.forEach(walk);
  };
  walk(root);
  return ids;
}

export function filterProducts(
  products: PublicProduct[],
  search: ListingSearch,
  categories: PublicCategory[],
) {
  const ids = search.categoria ? categoryIds(categories, search.categoria) : null;
  // Mesmo grupo (ex.: P ou M) = um ou outro; grupos diferentes (tamanho e cor) = os dois.
  const wanted = new Map<string, Set<string>>();
  for (const key of search.opcao ?? []) {
    const parsed = splitOptionKey(key);
    if (!parsed) continue;
    const group = normalizeSearchText(parsed.name);
    if (!wanted.has(group)) wanted.set(group, new Set());
    wanted.get(group)!.add(normalizeSearchText(parsed.value));
  }

  return products.filter((product) => {
    if (ids && (!product.category || !ids.has(product.category.id))) return false;
    const price = effectivePrice(product);
    if (search.min != null && price < search.min) return false;
    if (search.max != null && price > search.max) return false;
    for (const [group, values] of wanted) {
      const option = product.filter_options.find(
        (item) => normalizeSearchText(item.name) === group,
      );
      if (!option || !option.values.some((value) => values.has(normalizeSearchText(value))))
        return false;
    }
    return true;
  });
}

export interface OptionFacet {
  name: string;
  values: { key: string; label: string }[];
}

// Grupos de opção presentes nos produtos (ex.: Tamanho P/M/G, Cor), na ordem em que aparecem no cadastro.
export function optionFacets(products: PublicProduct[]): OptionFacet[] {
  const groups = new Map<string, { name: string; values: Map<string, string> }>();
  for (const product of products) {
    for (const option of product.filter_options) {
      const group = normalizeSearchText(option.name);
      if (!groups.has(group)) groups.set(group, { name: option.name, values: new Map() });
      const entry = groups.get(group)!;
      for (const value of option.values) {
        const normalized = normalizeSearchText(value);
        if (!entry.values.has(normalized)) entry.values.set(normalized, value);
      }
    }
  }
  return [...groups.values()].map((group) => ({
    name: group.name,
    values: [...group.values.values()].map((label) => ({
      key: optionKey(group.name, label),
      label,
    })),
  }));
}

export function activeFilterCount(search: ListingSearch) {
  return (
    (search.categoria ? 1 : 0) +
    (search.min != null ? 1 : 0) +
    (search.max != null ? 1 : 0) +
    (search.opcao?.length ?? 0)
  );
}

export const newArrivals = (products: PublicProduct[]) =>
  products.filter((product) => isNew(product.created_at));

export const onSale = (products: PublicProduct[]) =>
  products.filter((product) => isOnSale(product));
