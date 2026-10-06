/* eslint-disable @typescript-eslint/no-explicit-any -- tabelas novas ainda fora do types.ts gerado (regenerar e pendencia) */
// Só servidor. Conversa com a API do Melhor Envio usando a conta que CADA loja conectou (OAuth2).
// Doc: https://docs.melhorenvio.com.br (chave de acesso vale 30 dias; a de renovação, 45).
// Configuração (variáveis do servidor): MELHORENVIO_ENV (sandbox|production), MELHORENVIO_CLIENT_ID,
// MELHORENVIO_CLIENT_SECRET, MELHORENVIO_REDIRECT_URI (opcional) e MELHORENVIO_LOCAL_RELAY_PORT (só no
// app local de homologação: a página de retorno publicada repassa a autorização para o localhost).
import { supabaseAdmin } from "@/integrations/supabase/client.server";

export type MelhorEnvioEnv = "sandbox" | "production";

const BASE_URL: Record<MelhorEnvioEnv, string> = {
  sandbox: "https://sandbox.melhorenvio.com.br",
  production: "https://melhorenvio.com.br",
};

export const DEFAULT_REDIRECT_URI =
  "https://vynka.lovable.app/admin/integracoes/melhor-envio/retorno";

// Cotação agora; etiquetas (carrinho, compra, geração, impressão, rastreio) num lote seguinte. Pedidas
// já na conexão para o lojista não ter que autorizar de novo.
export const SCOPES = [
  "users-read",
  "shipping-calculate",
  "shipping-companies",
  "cart-read",
  "cart-write",
  "shipping-checkout",
  "shipping-generate",
  "shipping-print",
  "shipping-tracking",
  "shipping-cancel",
  "orders-read",
].join(" ");

export interface MelhorEnvioConfig {
  env: MelhorEnvioEnv;
  baseUrl: string;
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  localRelayPort: string | null;
}

export function melhorEnvioConfig(): MelhorEnvioConfig | null {
  const env = process.env.MELHORENVIO_ENV === "production" ? "production" : "sandbox";
  const clientId = process.env.MELHORENVIO_CLIENT_ID;
  const clientSecret = process.env.MELHORENVIO_CLIENT_SECRET;
  if (!clientId || !clientSecret) return null;
  const relay = process.env.MELHORENVIO_LOCAL_RELAY_PORT;
  return {
    env,
    baseUrl: BASE_URL[env],
    clientId,
    clientSecret,
    redirectUri: process.env.MELHORENVIO_REDIRECT_URI || DEFAULT_REDIRECT_URI,
    localRelayPort: relay && /^\d{2,5}$/.test(relay) ? relay : null,
  };
}

const headers = (token?: string) => ({
  Accept: "application/json",
  "Content-Type": "application/json",
  // O Melhor Envio pede User-Agent identificando a aplicação.
  "User-Agent": "Vynka",
  ...(token ? { Authorization: `Bearer ${token}` } : {}),
});

interface TokenResponse {
  access_token: string;
  refresh_token: string;
  expires_in: number;
  scope?: string;
}

async function tokenRequest(cfg: MelhorEnvioConfig, body: Record<string, string>) {
  const response = await fetch(`${cfg.baseUrl}/oauth/token`, {
    method: "POST",
    headers: headers(),
    body: JSON.stringify({ client_id: cfg.clientId, client_secret: cfg.clientSecret, ...body }),
  });
  const json = (await response.json().catch(() => ({}))) as Partial<TokenResponse> & {
    error?: string;
  };
  if (!response.ok || !json.access_token || !json.refresh_token) {
    throw new Error(`melhor_envio_token_${response.status}_${json.error ?? "sem_token"}`);
  }
  return json as TokenResponse;
}

export function exchangeCode(cfg: MelhorEnvioConfig, code: string) {
  return tokenRequest(cfg, {
    grant_type: "authorization_code",
    redirect_uri: cfg.redirectUri,
    code,
  });
}

export async function fetchAccount(cfg: MelhorEnvioConfig, accessToken: string) {
  const response = await fetch(`${cfg.baseUrl}/api/v2/me`, { headers: headers(accessToken) });
  if (!response.ok) return { name: null, email: null };
  const me = (await response.json()) as { firstname?: string; lastname?: string; email?: string };
  const name = [me.firstname, me.lastname].filter(Boolean).join(" ").trim();
  return { name: name || null, email: me.email ?? null };
}

export class ShippingNotConnectedError extends Error {
  constructor(message = "not_connected") {
    super(message);
  }
}

const expiresAt = (seconds: number) => new Date(Date.now() + seconds * 1000).toISOString();

export async function saveConnection(
  cfg: MelhorEnvioConfig,
  storeId: string,
  userId: string,
  tokens: TokenResponse,
) {
  const account = await fetchAccount(cfg, tokens.access_token);
  const { error } = await (supabaseAdmin as any).from("store_shipping_connections").upsert(
    {
      store_id: storeId,
      environment: cfg.env,
      access_token: tokens.access_token,
      refresh_token: tokens.refresh_token,
      expires_at: expiresAt(tokens.expires_in),
      scope: tokens.scope ?? SCOPES,
      account_name: account.name,
      account_email: account.email,
      connected_by: userId,
      connected_at: new Date().toISOString(),
      last_error: null,
      last_error_at: null,
    },
    { onConflict: "store_id" },
  );
  if (error) throw error;
  return account;
}

interface ConnectionRow {
  environment: MelhorEnvioEnv;
  access_token: string;
  refresh_token: string;
  expires_at: string;
}

async function loadConnection(cfg: MelhorEnvioConfig, storeId: string) {
  const { data, error } = await (supabaseAdmin as any)
    .from("store_shipping_connections")
    .select("environment,access_token,refresh_token,expires_at")
    .eq("store_id", storeId)
    .maybeSingle();
  if (error) throw error;
  const row = data as ConnectionRow | null;
  // Conta de teste não vale no ambiente real (e vice-versa).
  if (!row || row.environment !== cfg.env) throw new ShippingNotConnectedError();
  return row;
}

async function markError(storeId: string, message: string) {
  await (supabaseAdmin as any)
    .from("store_shipping_connections")
    .update({ last_error: message, last_error_at: new Date().toISOString() })
    .eq("store_id", storeId);
}

async function refresh(cfg: MelhorEnvioConfig, storeId: string, row: ConnectionRow) {
  try {
    const tokens = await tokenRequest(cfg, {
      grant_type: "refresh_token",
      refresh_token: row.refresh_token,
    });
    const { error } = await (supabaseAdmin as any)
      .from("store_shipping_connections")
      .update({
        access_token: tokens.access_token,
        refresh_token: tokens.refresh_token,
        expires_at: expiresAt(tokens.expires_in),
        last_error: null,
        last_error_at: null,
      })
      .eq("store_id", storeId);
    if (error) throw error;
    return { ...row, access_token: tokens.access_token, refresh_token: tokens.refresh_token };
  } catch {
    // Renovação recusada: o lojista revogou ou passaram os 45 dias. Precisa reconectar.
    await markError(storeId, "reconnect_required");
    throw new ShippingNotConnectedError("reconnect_required");
  }
}

// Chamada à API com a conta da loja: renova a chave quando falta menos de 1 dia ou quando a API
// responde "não autenticado", e repete uma vez.
export async function melhorEnvioFetch(
  cfg: MelhorEnvioConfig,
  storeId: string,
  path: string,
  init: { method?: "GET" | "POST"; body?: unknown } = {},
) {
  let row = await loadConnection(cfg, storeId);
  if (new Date(row.expires_at).getTime() - Date.now() < 24 * 60 * 60 * 1000) {
    row = await refresh(cfg, storeId, row);
  }
  const call = (accessToken: string) =>
    fetch(`${cfg.baseUrl}${path}`, {
      method: init.method ?? "GET",
      headers: headers(accessToken),
      body: init.body === undefined ? undefined : JSON.stringify(init.body),
    });
  let response = await call(row.access_token);
  if (response.status === 401) {
    row = await refresh(cfg, storeId, row);
    response = await call(row.access_token);
  }
  const json = await response.json().catch(() => null);
  if (!response.ok) throw new Error(`melhor_envio_${response.status}`);
  return json;
}
