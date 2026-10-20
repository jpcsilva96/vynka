import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { createMiddleware } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

// Login do cliente separado por loja (escopo login-por-loja, L3). Cada loja guarda a sessão do
// cliente na sua própria gaveta do navegador (`vynka-cliente-<loja>`), separada da sessão do painel
// (lojista/master) e da sessão das outras lojas. O endereço e a chave vêm do cliente gerado pelo
// Lovable (o app de homologação troca esse arquivo em memória; aqui não há endereço fixo).

const clients = new Map<string, SupabaseClient<Database>>();

export function storeAuthClient(storeId: string): SupabaseClient<Database> {
  let client = clients.get(storeId);
  if (!client) {
    const base = supabase as unknown as { supabaseUrl: string; supabaseKey: string };
    client = createClient<Database>(base.supabaseUrl, base.supabaseKey, {
      auth: {
        storage: typeof window !== "undefined" ? localStorage : undefined,
        storageKey: `vynka-cliente-${storeId}`,
        persistSession: true,
        autoRefreshToken: true,
      },
    });
    clients.set(storeId, client);
  }
  return client;
}

// Funções do servidor do cliente da loja (checkout, pagamento): manda o token da sessão DESTA loja
// no lugar do token do painel que o middleware geral anexa. Sem sessão na loja, manda vazio (o
// servidor responde como "não autenticado", nunca com a conta do painel).
export const attachStoreCustomerAuth = createMiddleware({ type: "function" }).client(
  async ({ next, data }) => {
    const storeId = (data as { store_id?: unknown } | undefined)?.store_id;
    let token = "";
    if (typeof storeId === "string" && storeId) {
      const { data: session } = await storeAuthClient(storeId).auth.getSession();
      token = session.session?.access_token ?? "";
    }
    return next({ headers: { Authorization: token ? `Bearer ${token}` : "" } });
  },
);

// No servidor: a conta precisa ser cliente do modelo novo e desta loja (marca gravada só pelo
// servidor no cadastro). Contas antigas ou do painel não compram como cliente.
export function assertStoreCustomer(claims: unknown, storeId: string) {
  const meta = (claims as { app_metadata?: { role?: string; store_id?: string } } | undefined)
    ?.app_metadata;
  if (meta?.role !== "customer" || meta.store_id !== storeId) {
    throw new Error("Entre na sua conta desta loja para continuar.");
  }
}
