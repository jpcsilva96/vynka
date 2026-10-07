/* eslint-disable @typescript-eslint/no-explicit-any -- tabelas novas ainda fora do types.ts gerado (regenerar e pendencia) */
// Só servidor. Conversa com a API do Mercado Pago usando a conta que CADA loja conectou (OAuth com
// PKCE; o dinheiro das vendas cai na conta do lojista). Doc: mercadopago.com.br/developers (OAuth:
// chave de acesso vale 180 dias, renovável com a refresh_token; código de autorização vale 10 min).
// Configuração (variáveis do servidor): MERCADOPAGO_CLIENT_ID, MERCADOPAGO_CLIENT_SECRET,
// MERCADOPAGO_REDIRECT_URI (opcional), MERCADOPAGO_TEST_TOKEN=true (opcional: pede credenciais de
// teste na troca) e MERCADOPAGO_LOCAL_RELAY_PORT (só no app local de homologação: a página de
// retorno publicada repassa a autorização para o localhost).
import { supabaseAdmin } from "@/integrations/supabase/client.server";

// Domínio do Brasil: o genérico (.com) abre antes uma tela de escolha de país, em espanhol.
const AUTH_URL = "https://auth.mercadopago.com.br/authorization";
const API_URL = "https://api.mercadopago.com";

export const DEFAULT_REDIRECT_URI =
  "https://vynka.lovable.app/admin/integracoes/mercado-pago/retorno";

export interface MercadoPagoConfig {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  testToken: boolean;
  localRelayPort: string | null;
}

export function mercadoPagoConfig(): MercadoPagoConfig | null {
  const clientId = process.env.MERCADOPAGO_CLIENT_ID;
  const clientSecret = process.env.MERCADOPAGO_CLIENT_SECRET;
  if (!clientId || !clientSecret) return null;
  const relay = process.env.MERCADOPAGO_LOCAL_RELAY_PORT;
  return {
    clientId,
    clientSecret,
    redirectUri: process.env.MERCADOPAGO_REDIRECT_URI || DEFAULT_REDIRECT_URI,
    testToken: process.env.MERCADOPAGO_TEST_TOKEN === "true",
    localRelayPort: relay && /^\d{2,5}$/.test(relay) ? relay : null,
  };
}

const base64url = (bytes: Uint8Array) =>
  btoa(String.fromCharCode(...bytes))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");

// PKCE (S256): o verificador fica no banco junto do state; o desafio vai na URL de autorização.
export async function pkcePair() {
  const verifier = base64url(crypto.getRandomValues(new Uint8Array(48))); // 64 caracteres
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(verifier));
  return { verifier, challenge: base64url(new Uint8Array(digest)) };
}

export function authorizationUrl(cfg: MercadoPagoConfig, state: string, challenge: string) {
  const params = new URLSearchParams({
    client_id: cfg.clientId,
    response_type: "code",
    platform_id: "mp",
    state,
    redirect_uri: cfg.redirectUri,
    code_challenge: challenge,
    code_challenge_method: "S256",
  });
  return `${AUTH_URL}?${params.toString()}`;
}

interface TokenResponse {
  access_token: string;
  refresh_token: string;
  expires_in: number;
  user_id: number;
  public_key?: string;
  live_mode?: boolean;
  scope?: string;
}

async function tokenRequest(cfg: MercadoPagoConfig, body: Record<string, string>) {
  const response = await fetch(`${API_URL}/oauth/token`, {
    method: "POST",
    headers: { Accept: "application/json", "Content-Type": "application/json" },
    body: JSON.stringify({
      client_id: cfg.clientId,
      client_secret: cfg.clientSecret,
      ...(cfg.testToken ? { test_token: "true" } : {}),
      ...body,
    }),
  });
  const json = (await response.json().catch(() => ({}))) as Partial<TokenResponse> & {
    error?: string;
    message?: string;
  };
  if (!response.ok || !json.access_token || !json.refresh_token || !json.user_id) {
    throw new Error(`mercado_pago_token_${response.status}_${json.error ?? "sem_token"}`);
  }
  return json as TokenResponse;
}

export function exchangeCode(cfg: MercadoPagoConfig, code: string, verifier: string) {
  return tokenRequest(cfg, {
    grant_type: "authorization_code",
    code,
    redirect_uri: cfg.redirectUri,
    code_verifier: verifier,
  });
}

export async function fetchAccount(accessToken: string) {
  const response = await fetch(`${API_URL}/users/me`, {
    headers: { Accept: "application/json", Authorization: `Bearer ${accessToken}` },
  });
  if (!response.ok) return { name: null, email: null };
  const me = (await response.json()) as {
    first_name?: string;
    last_name?: string;
    nickname?: string;
    email?: string;
  };
  const name = [me.first_name, me.last_name].filter(Boolean).join(" ").trim() || me.nickname;
  return { name: name || null, email: me.email ?? null };
}

export class PaymentNotConnectedError extends Error {
  constructor(message = "not_connected") {
    super(message);
  }
}

const expiresAt = (seconds: number) => new Date(Date.now() + seconds * 1000).toISOString();
// Sem live_mode na resposta: chave "TEST-" é de teste.
const liveMode = (tokens: TokenResponse) =>
  typeof tokens.live_mode === "boolean"
    ? tokens.live_mode
    : !tokens.access_token.startsWith("TEST-");

export async function saveConnection(storeId: string, userId: string, tokens: TokenResponse) {
  const account = await fetchAccount(tokens.access_token);
  const { error } = await (supabaseAdmin as any).from("store_payment_connections").upsert(
    {
      store_id: storeId,
      mp_user_id: tokens.user_id,
      live_mode: liveMode(tokens),
      access_token: tokens.access_token,
      refresh_token: tokens.refresh_token,
      public_key: tokens.public_key ?? null,
      expires_at: expiresAt(tokens.expires_in),
      scope: tokens.scope ?? null,
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
  access_token: string;
  refresh_token: string;
  expires_at: string;
}

async function loadConnection(storeId: string) {
  const { data, error } = await (supabaseAdmin as any)
    .from("store_payment_connections")
    .select("access_token,refresh_token,expires_at")
    .eq("store_id", storeId)
    .maybeSingle();
  if (error) throw error;
  if (!data) throw new PaymentNotConnectedError();
  return data as ConnectionRow;
}

async function markError(storeId: string, message: string) {
  await (supabaseAdmin as any)
    .from("store_payment_connections")
    .update({ last_error: message, last_error_at: new Date().toISOString() })
    .eq("store_id", storeId);
}

async function refresh(cfg: MercadoPagoConfig, storeId: string, row: ConnectionRow) {
  try {
    const tokens = await tokenRequest(cfg, {
      grant_type: "refresh_token",
      refresh_token: row.refresh_token,
    });
    const { error } = await (supabaseAdmin as any)
      .from("store_payment_connections")
      .update({
        access_token: tokens.access_token,
        refresh_token: tokens.refresh_token,
        expires_at: expiresAt(tokens.expires_in),
        public_key: tokens.public_key ?? undefined,
        last_error: null,
        last_error_at: null,
      })
      .eq("store_id", storeId);
    if (error) throw error;
    return { ...row, access_token: tokens.access_token, refresh_token: tokens.refresh_token };
  } catch {
    // Renovação recusada: o lojista revogou o acesso na conta dele. Precisa reconectar.
    await markError(storeId, "reconnect_required");
    throw new PaymentNotConnectedError("reconnect_required");
  }
}

// Chamada à API com a conta da loja: renova a chave quando faltam menos de 7 dias ou quando a API
// responde "não autenticado", e repete uma vez.
export async function mercadoPagoFetch(
  cfg: MercadoPagoConfig,
  storeId: string,
  path: string,
  init: { method?: "GET" | "POST" | "PUT"; body?: unknown; idempotencyKey?: string } = {},
) {
  let row = await loadConnection(storeId);
  if (new Date(row.expires_at).getTime() - Date.now() < 7 * 24 * 60 * 60 * 1000) {
    row = await refresh(cfg, storeId, row);
  }
  const call = (accessToken: string) =>
    fetch(`${API_URL}${path}`, {
      method: init.method ?? "GET",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`,
        ...(init.idempotencyKey ? { "X-Idempotency-Key": init.idempotencyKey } : {}),
      },
      body: init.body === undefined ? undefined : JSON.stringify(init.body),
    });
  let response = await call(row.access_token);
  if (response.status === 401) {
    row = await refresh(cfg, storeId, row);
    response = await call(row.access_token);
  }
  const json = await response.json().catch(() => null);
  if (!response.ok) throw new Error(`mercado_pago_${response.status}`);
  return json;
}
