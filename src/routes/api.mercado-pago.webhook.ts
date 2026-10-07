/* eslint-disable @typescript-eslint/no-explicit-any -- tabelas novas ainda fora do types.ts gerado (regenerar e pendencia) */
import { createFileRoute } from "@tanstack/react-router";

// Webhook do Mercado Pago (lote E3). Endereço cadastrado no aplicativo Vynka e mandado em cada
// cobrança (notification_url). O corpo do aviso não é confiado: com o id do pagamento, o servidor
// consulta a API com a chave da loja dona da conta e só então grava (record_order_payment).
// Assinatura (x-signature) conferida quando vier; aviso repetido (mesmo x-request-id já processado)
// é ignorado. Resposta 200 rápida; erro inesperado = 500 para o Mercado Pago tentar de novo.
export const Route = createFileRoute("/api/mercado-pago/webhook")({
  server: {
    handlers: {
      GET: () => new Response("ok", { status: 200 }),
      POST: async ({ request }) => handleWebhook(request),
    },
  },
});

async function handleWebhook(request: Request) {
  const mp = await import("@/lib/mercado-pago.server");
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const db = supabaseAdmin as any;
  const url = new URL(request.url);
  const body = (await request.json().catch(() => ({}))) as {
    type?: string;
    action?: string;
    user_id?: number | string;
    data?: { id?: string | number };
  };
  const topic = String(
    body.type ?? url.searchParams.get("type") ?? url.searchParams.get("topic") ?? "",
  );
  const dataId = String(
    url.searchParams.get("data.id") ?? body.data?.id ?? url.searchParams.get("id") ?? "",
  );
  const requestId = request.headers.get("x-request-id");
  const signature = request.headers.get("x-signature");
  const mpUserId = String(body.user_id ?? "");
  // O Mercado Pago manda o mesmo aviso em dois formatos: "?data.id=&type=" (webhook) e "?id=&topic="
  // (antigo). A assinatura só inclui o id quando ele vem como data.id no endereço; usar o "id" do
  // formato antigo recusava avisos legítimos (medido em 07/10: 7 de 8 recusados no pedido #22).
  const signedId = url.searchParams.get("data.id");
  const format = signedId ? "webhook" : "ipn";

  const log = async (fields: Record<string, unknown>) => {
    const row = {
      request_id: requestId,
      topic: topic || null,
      resource_id: dataId || null,
      mp_user_id: /^\d{1,18}$/.test(mpUserId) ? mpUserId : null,
      ...fields,
      result: `${format}:${String(fields.result ?? "")}`.slice(0, 200),
    };
    const { error } = requestId
      ? await db.from("payment_webhook_events").upsert(row, { onConflict: "request_id" })
      : await db.from("payment_webhook_events").insert(row);
    if (error) console.error("[mercado-pago] webhook: falha ao registrar aviso", error.message);
  };

  const secret = process.env.MERCADOPAGO_WEBHOOK_SECRET;
  if (signature && secret) {
    const ok = await mp.validWebhookSignature(secret, signature, requestId, signedId);
    if (!ok) {
      await log({ result: "bad_signature", processed_at: new Date().toISOString() });
      return new Response("invalid signature", { status: 401 });
    }
  }

  if (requestId) {
    const { data: seen } = await db
      .from("payment_webhook_events")
      .select("processed_at")
      .eq("request_id", requestId)
      .maybeSingle();
    if (seen?.processed_at) return new Response("ok", { status: 200 });
  }

  if (topic !== "payment" || !/^\d{1,20}$/.test(dataId)) {
    await log({ result: "ignored", processed_at: new Date().toISOString() });
    return new Response("ok", { status: 200 });
  }

  const cfg = mp.mercadoPagoConfig();
  const storeId = cfg ? await mp.storeByMpUser(mpUserId) : null;
  if (!cfg || !storeId) {
    await log({
      result: cfg ? "unknown_seller" : "not_configured",
      processed_at: new Date().toISOString(),
    });
    return new Response("ok", { status: 200 });
  }

  try {
    const payment = await mp.fetchPayment(cfg, storeId, dataId);
    const { orderId, result } = await mp.applyPayment(storeId, payment);
    await log({
      store_id: storeId,
      order_id: orderId,
      result: `${payment.status}:${result}`,
      processed_at: new Date().toISOString(),
    });
    return new Response("ok", { status: 200 });
  } catch (err) {
    const message = err instanceof Error ? err.message : "erro";
    console.error("[mercado-pago] webhook: falha ao processar", message);
    await log({ store_id: storeId, result: `error:${message}`.slice(0, 200) });
    return new Response("retry", { status: 500 });
  }
}
