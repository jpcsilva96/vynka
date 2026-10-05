import { supabase } from "@/integrations/supabase/client";

// Contador de visitas da loja pública: 1 por aparelho por dia para a loja e para cada produto.
// O controle do "já contei hoje" fica só neste navegador (localStorage); ao banco vai apenas
// loja/produto, sem nenhum identificador de quem visitou. O banco ignora loja não publicada,
// produto inativo e quem está logado como lojista/membro da loja ou Master.
const PREFIX = "vynka:viewed:";

function today() {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function trackStoreView(storeId: string, productId?: string) {
  if (typeof window === "undefined" || !storeId) return;
  const day = today();
  const key = `${PREFIX}${day}:${storeId}${productId ? `:${productId}` : ""}`;
  try {
    if (window.localStorage.getItem(key)) return;
    window.localStorage.setItem(key, "1");
    // Limpa marcas de dias anteriores para não acumular.
    for (let i = window.localStorage.length - 1; i >= 0; i--) {
      const k = window.localStorage.key(i);
      if (k?.startsWith(PREFIX) && !k.startsWith(`${PREFIX}${day}:`))
        window.localStorage.removeItem(k);
    }
  } catch {
    // Sem localStorage (aba anônima restrita etc.): conta mesmo assim.
  }
  // track_store_view ainda não está no types.ts gerado.
  const rpcDb = supabase as unknown as {
    rpc: (fn: string, args: Record<string, unknown>) => PromiseLike<{ error: unknown }>;
  };
  void Promise.resolve(
    rpcDb.rpc("track_store_view", { _store_id: storeId, _product_id: productId ?? null }),
  ).catch(() => {});
}

export interface ProductViewRow {
  product_id: string;
  name: string;
  day: string; // AAAA-MM-DD (dia de Brasília)
  views: number;
}

// Visualizações de produto da loja (painel). Paginado: a API devolve no máximo 1.000 linhas por vez.
export async function listProductViews(storeId: string): Promise<ProductViewRow[]> {
  type Page = {
    data:
      { product_id: string; day: string; views: number; product: { name: string } | null }[] | null;
    error: unknown;
  };
  const viewsDb = supabase as unknown as {
    from: (table: string) => {
      select: (columns: string) => {
        eq: (
          column: string,
          value: string,
        ) => {
          order: (column: string) => { range: (from: number, to: number) => PromiseLike<Page> };
        };
      };
    };
  };
  const rows: ProductViewRow[] = [];
  const size = 1000;
  for (let from = 0; ; from += size) {
    const { data, error } = await viewsDb
      .from("product_daily_views")
      .select("product_id, day, views, product:products(name)")
      .eq("store_id", storeId)
      .order("day")
      .range(from, from + size - 1);
    if (error) throw error;
    for (const r of data ?? []) {
      rows.push({
        product_id: r.product_id,
        name: r.product?.name ?? "Produto",
        day: r.day,
        views: Number(r.views || 0),
      });
    }
    if (!data || data.length < size) break;
  }
  return rows;
}
