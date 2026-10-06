/* eslint-disable @typescript-eslint/no-explicit-any -- tabelas novas ainda fora do types.ts gerado (regenerar e pendencia) */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

// Conexão de cada loja com a própria conta do Melhor Envio + serviços + cotação de teste.
// As chaves da conta ficam só no servidor (store_shipping_connections, sem acesso do navegador).

const STATE_TTL_MS = 15 * 60 * 1000;

async function assertStoreAccess(
  context: { supabase: any; userId: string },
  storeId: string,
  level: "member" | "admin",
) {
  const [{ data: allowed }, { data: isPlatformAdmin }] = await Promise.all([
    context.supabase.rpc(level === "admin" ? "is_store_admin" : "is_store_member", {
      _store_id: storeId,
      _user_id: context.userId,
    }),
    context.supabase.rpc("is_platform_admin", { _user_id: context.userId }),
  ]);
  if (!allowed && !isPlatformAdmin) throw new Error("Sem permissão para esta loja.");
}

async function server() {
  const me = await import("./melhor-envio.server");
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return { ...me, supabaseAdmin: supabaseAdmin as any };
}

const friendly = (err: unknown) => {
  const message = err instanceof Error ? err.message : "";
  if (message === "reconnect_required")
    return "A conexão com o Melhor Envio expirou ou foi revogada. Clique em Reconectar.";
  if (message === "not_connected") return "Conecte sua conta do Melhor Envio primeiro.";
  return "O Melhor Envio não respondeu como esperado. Tente de novo em instantes.";
};

const storeInput = z.object({ store_id: z.string().uuid() });

export const getShippingIntegration = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => storeInput.parse(data))
  .handler(async ({ data, context }) => {
    const { melhorEnvioConfig } = await server();
    const cfg = melhorEnvioConfig();
    const { data: rows, error } = await (context.supabase as any).rpc(
      "store_shipping_connection_status",
      { _store_id: data.store_id },
    );
    if (error) throw error;
    const row = (rows ?? [])[0] ?? null;
    const sameEnv = !!row && !!cfg && row.environment === cfg.env;
    return {
      available: !!cfg,
      environment: cfg?.env ?? null,
      connected: sameEnv,
      needsReconnect: sameEnv && row.last_error === "reconnect_required",
      accountName: sameEnv ? (row.account_name as string | null) : null,
      accountEmail: sameEnv ? (row.account_email as string | null) : null,
      connectedAt: sameEnv ? (row.connected_at as string) : null,
    };
  });

export const startShippingConnect = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => storeInput.parse(data))
  .handler(async ({ data, context }) => {
    await assertStoreAccess(context, data.store_id, "admin");
    const { melhorEnvioConfig, SCOPES, supabaseAdmin } = await server();
    const cfg = melhorEnvioConfig();
    if (!cfg) throw new Error("Integração com o Melhor Envio ainda não está disponível.");
    const random = crypto.randomUUID().replace(/-/g, "") + crypto.randomUUID().replace(/-/g, "");
    // "local8081-..." diz à página de retorno publicada para repassar ao app local de homologação.
    const state = cfg.localRelayPort ? `local${cfg.localRelayPort}-${random}` : random;
    await supabaseAdmin
      .from("shipping_oauth_states")
      .delete()
      .lt("created_at", new Date(Date.now() - STATE_TTL_MS).toISOString());
    const { error } = await supabaseAdmin.from("shipping_oauth_states").insert({
      state,
      store_id: data.store_id,
      user_id: context.userId,
      environment: cfg.env,
    });
    if (error) throw error;
    const params = new URLSearchParams({
      client_id: cfg.clientId,
      redirect_uri: cfg.redirectUri,
      response_type: "code",
      state,
      scope: SCOPES,
    });
    return { url: `${cfg.baseUrl}/oauth/authorize?${params.toString()}` };
  });

export const finishShippingConnect = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z
      .object({ code: z.string().min(10).max(4000), state: z.string().min(20).max(120) })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    const { melhorEnvioConfig, exchangeCode, saveConnection, supabaseAdmin } = await server();
    const cfg = melhorEnvioConfig();
    if (!cfg) throw new Error("Integração com o Melhor Envio ainda não está disponível.");
    const { data: pending, error } = await supabaseAdmin
      .from("shipping_oauth_states")
      .select("store_id,user_id,environment,created_at")
      .eq("state", data.state)
      .maybeSingle();
    if (error) throw error;
    // Uso único: apaga já, dê certo ou não.
    await supabaseAdmin.from("shipping_oauth_states").delete().eq("state", data.state);
    if (
      !pending ||
      pending.user_id !== context.userId ||
      pending.environment !== cfg.env ||
      Date.now() - new Date(pending.created_at).getTime() > STATE_TTL_MS
    ) {
      throw new Error("Pedido de conexão inválido ou expirado. Clique em Conectar de novo.");
    }
    await assertStoreAccess(context, pending.store_id, "admin");
    try {
      const tokens = await exchangeCode(cfg, data.code);
      const account = await saveConnection(cfg, pending.store_id, context.userId, tokens);
      return { store_id: pending.store_id as string, accountName: account.name };
    } catch (err) {
      console.error(
        "[melhor-envio] falha ao concluir conexão",
        err instanceof Error ? err.message : "",
      );
      throw new Error("O Melhor Envio não confirmou a autorização. Tente conectar de novo.");
    }
  });

export const disconnectShipping = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => storeInput.parse(data))
  .handler(async ({ data, context }) => {
    await assertStoreAccess(context, data.store_id, "admin");
    const { supabaseAdmin } = await server();
    const { error } = await supabaseAdmin
      .from("store_shipping_connections")
      .delete()
      .eq("store_id", data.store_id);
    if (error) throw error;
    // Sem conta conectada, Correios/transportadoras saem do checkout.
    await supabaseAdmin
      .from("store_checkout_settings")
      .update({ shipping_enabled: false })
      .eq("store_id", data.store_id);
    return { ok: true };
  });

export interface ShippingService {
  id: number;
  name: string;
  company: string;
  picture: string | null;
}

export const listShippingServices = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => storeInput.parse(data))
  .handler(async ({ data, context }): Promise<ShippingService[]> => {
    await assertStoreAccess(context, data.store_id, "member");
    const { melhorEnvioConfig, melhorEnvioFetch } = await server();
    const cfg = melhorEnvioConfig();
    if (!cfg) return [];
    try {
      const list = (await melhorEnvioFetch(
        cfg,
        data.store_id,
        "/api/v2/me/shipment/services",
      )) as any[];
      return (list ?? []).map((service) => ({
        id: Number(service.id),
        name: String(service.name ?? ""),
        company: String(service.company?.name ?? ""),
        picture: service.company?.picture ?? null,
      }));
    } catch (err) {
      throw new Error(friendly(err));
    }
  });

export interface ShippingQuote {
  id: number;
  name: string;
  company: string;
  price: number | null;
  days: number | null;
  error: string | null;
}

export const testShippingQuote = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z
      .object({ store_id: z.string().uuid(), to_zip: z.string().regex(/^\d{8}$/, "CEP inválido.") })
      .parse(data),
  )
  .handler(async ({ data, context }): Promise<ShippingQuote[]> => {
    await assertStoreAccess(context, data.store_id, "member");
    const { melhorEnvioConfig, melhorEnvioFetch, supabaseAdmin } = await server();
    const cfg = melhorEnvioConfig();
    if (!cfg) throw new Error("Integração com o Melhor Envio ainda não está disponível.");
    const [{ data: store }, { data: settings }] = await Promise.all([
      supabaseAdmin.from("stores").select("zip_code").eq("id", data.store_id).maybeSingle(),
      supabaseAdmin
        .from("store_checkout_settings")
        .select(
          "package_weight_kg,package_height_cm,package_width_cm,package_length_cm,shipping_services",
        )
        .eq("store_id", data.store_id)
        .maybeSingle(),
    ]);
    const from = String(store?.zip_code ?? "").replace(/\D/g, "");
    if (from.length !== 8)
      throw new Error("Cadastre o CEP da loja (aba Loja) para calcular o frete.");
    try {
      // Sempre mandar a lista de serviços: sem ela, a cotação pelo aplicativo volta só com parte das
      // transportadoras (medido em 06/10: só Jadlog, sem Correios, na mesma conta). Usa os que a loja
      // escolheu; sem escolha, todos os disponíveis.
      let serviceIds: number[] = (settings?.shipping_services ?? []).map(Number);
      if (serviceIds.length === 0) {
        const available = (await melhorEnvioFetch(
          cfg,
          data.store_id,
          "/api/v2/me/shipment/services",
        )) as any[];
        serviceIds = (available ?? []).map((service) => Number(service.id));
      }
      const quotes = (await melhorEnvioFetch(cfg, data.store_id, "/api/v2/me/shipment/calculate", {
        method: "POST",
        body: {
          from: { postal_code: from },
          to: { postal_code: data.to_zip },
          package: {
            weight: Number(settings?.package_weight_kg ?? 0.3),
            height: Number(settings?.package_height_cm ?? 4),
            width: Number(settings?.package_width_cm ?? 12),
            length: Number(settings?.package_length_cm ?? 17),
          },
          services: serviceIds.join(","),
        },
      })) as any[];
      return (quotes ?? []).map((quote) => ({
        id: Number(quote.id),
        name: String(quote.name ?? ""),
        company: String(quote.company?.name ?? ""),
        price: quote.error ? null : Number(quote.custom_price ?? quote.price),
        days: quote.error ? null : Number(quote.custom_delivery_time ?? quote.delivery_time),
        error: quote.error ? String(quote.error) : null,
      }));
    } catch (err) {
      throw new Error(friendly(err));
    }
  });
