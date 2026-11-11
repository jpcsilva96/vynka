import { createFileRoute } from "@tanstack/react-router";

// Aviso do Melhor Envio (etiquetas, lote E4). Endereço cadastrado no aplicativo Vynka em
// "Integrações > Área Dev" (só chega aviso de etiqueta gerada pelo próprio aplicativo). O corpo só
// diz QUAL etiqueta mudou: a situação é consultada na API com a conta da loja dona da etiqueta e
// gravada por record_shipment_status (postado -> Enviado; entregue -> Entregue).
// Assinatura X-ME-Signature = HMAC-SHA256 do corpo com o segredo do aplicativo (doc, 11/11), aceita
// em hex ou base64. Medido em 11/11: 5 de 5 avisos reais fecharam; sem assinatura válida = 401
// (registrado como bad_signature).
// Resposta rápida (o Melhor Envio espera até 6 s); erro inesperado = 500 para ele tentar de novo.
export const Route = createFileRoute("/api/melhor-envio/webhook")({
  server: {
    handlers: {
      GET: () => new Response("ok", { status: 200 }),
      POST: async ({ request }) => handleWebhook(request),
    },
  },
});

async function signatureMatches(secret: string, raw: string, signature: string) {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const mac = new Uint8Array(await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(raw)));
  const hex = Array.from(mac, (b) => b.toString(16).padStart(2, "0")).join("");
  const base64 = btoa(String.fromCharCode(...mac));
  const given = signature.trim();
  return given === base64 || given.toLowerCase() === hex;
}

// Link de rastreio só se for do próprio Melhor Envio (o resto do corpo é ignorado).
function trustedTrackingUrl(value: unknown) {
  if (typeof value !== "string") return null;
  try {
    const url = new URL(value);
    const host = url.hostname;
    const ok =
      url.protocol === "https:" &&
      ["melhorrastreio.com.br", "melhorenvio.com.br"].some(
        (domain) => host === domain || host.endsWith(`.${domain}`),
      );
    return ok ? url.toString() : null;
  } catch {
    return null;
  }
}

async function handleWebhook(request: Request) {
  const me = await import("@/lib/melhor-envio.server");
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const raw = await request.text();
  let body: { event?: string; data?: { id?: string; tracking_url?: string } } = {};
  try {
    body = JSON.parse(raw);
  } catch {
    body = {};
  }
  const event = typeof body.event === "string" ? body.event.slice(0, 60) : null;
  const meOrderId = typeof body.data?.id === "string" ? body.data.id.slice(0, 80) : null;
  const signature = request.headers.get("x-me-signature");
  const secret = process.env.MELHORENVIO_CLIENT_SECRET;
  const signatureOk =
    signature && secret ? await signatureMatches(secret, raw, signature).catch(() => false) : null;

  const { data: logRow } = await supabaseAdmin
    .from("shipping_webhook_events")
    .insert({ event, me_order_id: meOrderId, signature_ok: signatureOk, result: "received" })
    .select("id")
    .single();
  const finish = async (fields: { result: string; store_id?: string; order_id?: string }) => {
    if (!logRow) return;
    await supabaseAdmin
      .from("shipping_webhook_events")
      .update({ ...fields, result: fields.result.slice(0, 200) })
      .eq("id", logRow.id);
  };

  if (signatureOk !== true) {
    await finish({ result: secret ? "bad_signature" : "not_configured" });
    return new Response("invalid signature", { status: 401 });
  }

  if (!meOrderId) {
    await finish({ result: "ignored" });
    return new Response("ok", { status: 200 });
  }
  const { data: shipment } = await supabaseAdmin
    .from("order_shipments")
    .select("store_id, order_id, status")
    .eq("me_order_id", meOrderId)
    .maybeSingle();
  const cfg = me.melhorEnvioConfig();
  if (!shipment || !cfg) {
    await finish({ result: cfg ? "unknown_shipment" : "not_configured" });
    return new Response("ok", { status: 200 });
  }

  try {
    const state = await me.fetchShipmentState(cfg, shipment.store_id, meOrderId);
    if (!me.shipmentMovesForward(shipment.status, state.status)) {
      await finish({
        result: `skipped:${state.status ?? "sem_status"}`,
        store_id: shipment.store_id,
        order_id: shipment.order_id,
      });
      return new Response("ok", { status: 200 });
    }
    const { data: result, error } = await supabaseAdmin.rpc("record_shipment_status", {
      _me_order_id: meOrderId,
      _status: state.status as string,
      _tracking: state.tracking ?? undefined,
      _tracking_url: trustedTrackingUrl(body.data?.tracking_url) ?? undefined,
      _at: state.at ?? undefined,
    });
    if (error) throw error;
    await finish({
      result: `${state.status}:${result}`,
      store_id: shipment.store_id,
      order_id: shipment.order_id,
    });
    return new Response("ok", { status: 200 });
  } catch (err) {
    const message = err instanceof Error ? err.message : "erro";
    console.error("[melhor-envio] webhook: falha ao processar", message);
    await finish({
      result: `error:${message}`,
      store_id: shipment.store_id,
      order_id: shipment.order_id,
    });
    return new Response("retry", { status: 500 });
  }
}
