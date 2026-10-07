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

// ---------------------------------------------------------------- Cobrança e pagamento (lote E3)

// Endereço público do app (webhook e volta do cliente): o mesmo do retorno do OAuth.
export const publicOrigin = (cfg: MercadoPagoConfig) => new URL(cfg.redirectUri).origin;

// O Mercado Pago pede data com fuso (yyyy-MM-ddTHH:mm:ss.SSS-03:00).
function brtTimestamp(date: Date) {
  const local = new Date(date.getTime() - 3 * 60 * 60 * 1000);
  return local.toISOString().replace("Z", "-03:00");
}

interface PreferenceOrder {
  id: string;
  number: string | null;
  storeName: string;
  items: { title: string; quantity: number; unit_price: number }[];
  shipping: number;
  // Fim do prazo mais longo da loja (boleto); o Pix vence antes pela regra do banco.
  expiresAt: Date;
  // Para onde o cliente volta (página "Pedido #N").
  returnUrl: string;
}

// Checkout Pro: cria a cobrança na conta da loja. external_reference = id do pedido (é por ele que o
// webhook acha o pedido). Mesma chave de idempotência por pedido: repetir não cria outra cobrança.
export async function createPreference(
  cfg: MercadoPagoConfig,
  storeId: string,
  order: PreferenceOrder,
) {
  const items = order.items.map((item) => ({
    title: item.title.slice(0, 250),
    quantity: item.quantity,
    unit_price: Number(item.unit_price.toFixed(2)),
    currency_id: "BRL",
  }));
  if (order.shipping > 0) {
    items.push({
      title: "Frete",
      quantity: 1,
      unit_price: Number(order.shipping.toFixed(2)),
      currency_id: "BRL",
    });
  }
  const https = order.returnUrl.startsWith("https://");
  const preference = (await mercadoPagoFetch(cfg, storeId, "/checkout/preferences", {
    method: "POST",
    idempotencyKey: `vynka-pref-${order.id}`,
    body: {
      items,
      // Sem "payer": o Mercado Pago usa a conta de quem estiver logado na página dele. Mandar o
      // e-mail do cadastro da loja bloqueia o pagamento quando ele difere da conta que paga
      // ("Ops, ocorreu um erro" com a conta de teste Comprador, medido em 07/10).
      external_reference: order.id,
      metadata: { order_id: order.id, store_id: storeId },
      statement_descriptor: order.storeName.replace(/[^A-Za-z0-9 ]/g, "").slice(0, 13) || undefined,
      notification_url: `${publicOrigin(cfg)}/api/mercado-pago/webhook`,
      back_urls: { success: order.returnUrl, pending: order.returnUrl, failure: order.returnUrl },
      // Volta automática só com https (o Mercado Pago recusa auto_return para localhost).
      ...(https ? { auto_return: "approved" } : {}),
      expires: true,
      expiration_date_to: brtTimestamp(order.expiresAt),
      date_of_expiration: brtTimestamp(order.expiresAt),
    },
  })) as { id?: string; init_point?: string };
  if (!preference?.id || !preference.init_point) throw new Error("mercado_pago_preference");
  return { id: preference.id, url: preference.init_point };
}

export const checkoutUrl = (preferenceId: string) =>
  `https://www.mercadopago.com.br/checkout/v1/redirect?pref_id=${encodeURIComponent(preferenceId)}`;

interface MpPayment {
  id: number;
  status: string;
  status_detail?: string;
  payment_type_id?: string;
  payment_method_id?: string;
  external_reference?: string | null;
  date_last_updated?: string | null;
  date_approved?: string | null;
  date_created?: string | null;
}

// Forma de pagamento do Mercado Pago -> a do Vynka (orders.payment_method).
function paymentMethod(payment: MpPayment): "pix" | "boleto" | "credit" | "debit" | null {
  if (payment.payment_method_id === "pix") return "pix";
  if (payment.payment_type_id === "ticket") return "boleto";
  if (payment.payment_type_id === "credit_card") return "credit";
  if (payment.payment_type_id === "debit_card" || payment.payment_type_id === "prepaid_card")
    return "debit";
  return null;
}

export async function fetchPayment(cfg: MercadoPagoConfig, storeId: string, paymentId: string) {
  return (await mercadoPagoFetch(
    cfg,
    storeId,
    `/v1/payments/${encodeURIComponent(paymentId)}`,
  )) as MpPayment;
}

// Pagamentos de um pedido (o cliente pode ter tentado mais de uma vez), do mais novo ao mais antigo.
export async function searchOrderPayments(
  cfg: MercadoPagoConfig,
  storeId: string,
  orderId: string,
) {
  const params = new URLSearchParams({
    external_reference: orderId,
    sort: "date_created",
    criteria: "desc",
    limit: "20",
  });
  const result = (await mercadoPagoFetch(cfg, storeId, `/v1/payments/search?${params}`)) as {
    results?: MpPayment[];
  };
  return result?.results ?? [];
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Grava no pedido o pagamento consultado na API (nunca o corpo do aviso) e aplica as regras do banco
// (record_order_payment: pago, prazo de Pix/boleto, cartão em análise...).
export async function applyPayment(storeId: string, payment: MpPayment) {
  const orderId = String(payment.external_reference ?? "");
  if (!UUID.test(orderId)) return { orderId: null, result: "no_reference" };
  const { data, error } = await (supabaseAdmin as any).rpc("record_order_payment", {
    _order_id: orderId,
    _store_id: storeId,
    _payment_id: String(payment.id),
    _status: payment.status,
    _status_detail: payment.status_detail ?? null,
    _method: paymentMethod(payment),
    _updated_at: payment.date_last_updated ?? payment.date_created ?? null,
    _approved_at: payment.date_approved ?? null,
  });
  if (error) throw error;
  return { orderId, result: String(data) };
}

// Se houver um aprovado, ele vale; senão, o mais recente.
export function pickPayment(payments: MpPayment[]) {
  return payments.find((p) => p.status === "approved") ?? payments[0] ?? null;
}

// Assinatura do webhook (x-signature: "ts=...,v1=..."): HMAC-SHA256 com a chave secreta do aplicativo
// sobre "id:{data.id};request-id:{x-request-id};ts:{ts};" (partes ausentes saem do texto).
export async function validWebhookSignature(
  secret: string,
  signature: string,
  requestId: string | null,
  dataId: string | null,
) {
  const parts = Object.fromEntries(
    signature.split(",").map((part) => {
      const [key, ...value] = part.split("=");
      return [key.trim(), value.join("=").trim()];
    }),
  );
  if (!parts.ts || !parts.v1) return false;
  let manifest = "";
  if (dataId) manifest += `id:${/^[a-z0-9]+$/i.test(dataId) ? dataId.toLowerCase() : dataId};`;
  if (requestId) manifest += `request-id:${requestId};`;
  manifest += `ts:${parts.ts};`;
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const mac = new Uint8Array(
    await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(manifest)),
  );
  const hex = Array.from(mac, (b) => b.toString(16).padStart(2, "0")).join("");
  if (hex.length !== parts.v1.length) return false;
  let diff = 0;
  for (let i = 0; i < hex.length; i++) diff |= hex.charCodeAt(i) ^ parts.v1.charCodeAt(i);
  return diff === 0;
}

// Loja dona da conta que recebeu o pagamento (user_id do aviso).
export async function storeByMpUser(mpUserId: string) {
  if (!/^\d{1,20}$/.test(mpUserId)) return null;
  const { data } = await (supabaseAdmin as any)
    .from("store_payment_connections")
    .select("store_id")
    .eq("mp_user_id", mpUserId)
    .maybeSingle();
  return (data?.store_id as string | undefined) ?? null;
}
