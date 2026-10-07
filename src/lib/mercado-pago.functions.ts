/* eslint-disable @typescript-eslint/no-explicit-any -- tabelas novas ainda fora do types.ts gerado (regenerar e pendencia) */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

// Conexão de cada loja com a própria conta do Mercado Pago (lote E2). As chaves da conta ficam só no
// servidor (store_payment_connections, sem acesso do navegador); a tela vê só o status.

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
  const mp = await import("./mercado-pago.server");
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return { ...mp, supabaseAdmin: supabaseAdmin as any };
}

const storeInput = z.object({ store_id: z.string().uuid() });

export const getPaymentIntegration = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => storeInput.parse(data))
  .handler(async ({ data, context }) => {
    const { mercadoPagoConfig } = await server();
    const cfg = mercadoPagoConfig();
    const { data: rows, error } = await (context.supabase as any).rpc(
      "store_payment_connection_status",
      { _store_id: data.store_id },
    );
    if (error) throw error;
    const row = (rows ?? [])[0] ?? null;
    return {
      available: !!cfg,
      connected: !!row,
      liveMode: row ? (row.live_mode as boolean) : null,
      // Conta de teste do Mercado Pago vem com chave de produção (medido em 07/10); o e-mail
      // @testuser.com é o sinal confiável.
      testAccount:
        !!row &&
        (row.live_mode === false || /@testuser.com$/i.test(String(row.account_email ?? ""))),
      needsReconnect: !!row && row.last_error === "reconnect_required",
      accountName: row ? (row.account_name as string | null) : null,
      accountEmail: row ? (row.account_email as string | null) : null,
      connectedAt: row ? (row.connected_at as string) : null,
    };
  });

export const startPaymentConnect = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => storeInput.parse(data))
  .handler(async ({ data, context }) => {
    await assertStoreAccess(context, data.store_id, "admin");
    const { mercadoPagoConfig, pkcePair, authorizationUrl, supabaseAdmin } = await server();
    const cfg = mercadoPagoConfig();
    if (!cfg) throw new Error("Integração com o Mercado Pago ainda não está disponível.");
    const random = crypto.randomUUID().replace(/-/g, "") + crypto.randomUUID().replace(/-/g, "");
    // "local8081-..." diz à página de retorno publicada para repassar ao app local de homologação.
    const state = cfg.localRelayPort ? `local${cfg.localRelayPort}-${random}` : random;
    const { verifier, challenge } = await pkcePair();
    await supabaseAdmin
      .from("payment_oauth_states")
      .delete()
      .lt("created_at", new Date(Date.now() - STATE_TTL_MS).toISOString());
    const { error } = await supabaseAdmin.from("payment_oauth_states").insert({
      state,
      store_id: data.store_id,
      user_id: context.userId,
      code_verifier: verifier,
    });
    if (error) throw error;
    return { url: authorizationUrl(cfg, state, challenge) };
  });

export const finishPaymentConnect = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z
      .object({ code: z.string().min(10).max(4000), state: z.string().min(20).max(120) })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    const { mercadoPagoConfig, exchangeCode, saveConnection, supabaseAdmin } = await server();
    const cfg = mercadoPagoConfig();
    if (!cfg) throw new Error("Integração com o Mercado Pago ainda não está disponível.");
    const { data: pending, error } = await supabaseAdmin
      .from("payment_oauth_states")
      .select("store_id,user_id,code_verifier,created_at")
      .eq("state", data.state)
      .maybeSingle();
    if (error) throw error;
    // Uso único: apaga já, dê certo ou não.
    await supabaseAdmin.from("payment_oauth_states").delete().eq("state", data.state);
    if (
      !pending ||
      pending.user_id !== context.userId ||
      Date.now() - new Date(pending.created_at).getTime() > STATE_TTL_MS
    ) {
      throw new Error("Pedido de conexão inválido ou expirado. Clique em Conectar de novo.");
    }
    await assertStoreAccess(context, pending.store_id, "admin");
    try {
      const tokens = await exchangeCode(cfg, data.code, pending.code_verifier);
      const account = await saveConnection(pending.store_id, context.userId, tokens);
      return { store_id: pending.store_id as string, accountName: account.name };
    } catch (err) {
      console.error(
        "[mercado-pago] falha ao concluir conexão",
        err instanceof Error ? err.message : "",
      );
      throw new Error("O Mercado Pago não confirmou a autorização. Tente conectar de novo.");
    }
  });

export const disconnectPayment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => storeInput.parse(data))
  .handler(async ({ data, context }) => {
    await assertStoreAccess(context, data.store_id, "admin");
    const { supabaseAdmin } = await server();
    const { error } = await supabaseAdmin
      .from("store_payment_connections")
      .delete()
      .eq("store_id", data.store_id);
    if (error) throw error;
    return { ok: true };
  });

// Botão "Testar": confere que a conta conectada responde (renova a chave se precisar).
export const testPaymentConnection = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => storeInput.parse(data))
  .handler(async ({ data, context }) => {
    await assertStoreAccess(context, data.store_id, "member");
    const { mercadoPagoConfig, mercadoPagoFetch } = await server();
    const cfg = mercadoPagoConfig();
    if (!cfg) throw new Error("Integração com o Mercado Pago ainda não está disponível.");
    try {
      const me = (await mercadoPagoFetch(cfg, data.store_id, "/users/me")) as any;
      const name =
        [me?.first_name, me?.last_name].filter(Boolean).join(" ").trim() || me?.nickname || "";
      return { ok: true, account: String(name || me?.email || "") };
    } catch (err) {
      const message = err instanceof Error ? err.message : "";
      if (message === "reconnect_required")
        throw new Error(
          "A conexão com o Mercado Pago expirou ou foi revogada. Clique em Reconectar.",
        );
      if (message === "not_connected")
        throw new Error("Conecte sua conta do Mercado Pago primeiro.");
      throw new Error("O Mercado Pago não respondeu como esperado. Tente de novo em instantes.");
    }
  });
