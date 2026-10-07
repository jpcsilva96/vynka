/* eslint-disable @typescript-eslint/no-explicit-any -- tabelas novas ainda fora do types.ts gerado (regenerar e pendencia) */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

// Pagamento do pedido do site pelo Mercado Pago (lote E3), sempre pelo servidor e com a conta da
// loja. Só o cliente dono do pedido abre ou atualiza o pagamento.
// * startOrderPayment: cria (ou reaproveita) a cobrança do Checkout Pro e devolve o endereço.
// * syncOrderPayment: na volta do Mercado Pago, consulta os pagamentos do pedido e grava. O webhook
//   faz o mesmo sozinho; isto só adianta a tela (e cobre o app local, que não recebe webhook).

async function server() {
  const mp = await import("./mercado-pago.server");
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return { ...mp, supabaseAdmin: supabaseAdmin as any };
}

const orderInput = z.object({ order_id: z.string().uuid() });

async function loadCustomerOrder(supabaseAdmin: any, orderId: string, userId: string) {
  const { data: order, error } = await supabaseAdmin
    .from("orders")
    .select(
      "id, number, store_id, status, source, created_at, total, shipping_amount, mp_preference_id, paid_at, " +
        "customer:customers(user_id, name, email), order_items(product_name, variant_name, quantity, unit_price), " +
        "store:stores(name, slug)",
    )
    .eq("id", orderId)
    .maybeSingle();
  if (error) throw error;
  const customer = Array.isArray(order?.customer) ? order.customer[0] : order?.customer;
  if (!order || order.source !== "website" || customer?.user_id !== userId) {
    throw new Error("Pedido não encontrado.");
  }
  const store = Array.isArray(order.store) ? order.store[0] : order.store;
  return { order, customer, store };
}

export const startOrderPayment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    orderInput.extend({ return_origin: z.string().url().max(200).optional() }).parse(data),
  )
  .handler(async ({ data, context }) => {
    const { mercadoPagoConfig, createPreference, checkoutUrl, publicOrigin, supabaseAdmin } =
      await server();
    const cfg = mercadoPagoConfig();
    if (!cfg) throw new Error("Pagamento online indisponível no momento.");
    const { order, customer, store } = await loadCustomerOrder(
      supabaseAdmin,
      data.order_id,
      context.userId,
    );
    if (order.status !== "pending" || order.paid_at) {
      throw new Error(
        order.status === "cancelled"
          ? "Este pedido foi cancelado. Faça um novo pedido."
          : "Este pedido já foi pago.",
      );
    }
    if (order.mp_preference_id) return { url: checkoutUrl(order.mp_preference_id) };

    const { data: settings } = await supabaseAdmin
      .from("store_checkout_settings")
      .select("boleto_expiration_days")
      .eq("store_id", order.store_id)
      .maybeSingle();
    const days = Number(settings?.boleto_expiration_days ?? 3);
    // Volta para o mesmo endereço em que o cliente está (app publicado; localhost só no app local
    // de homologação).
    const published = publicOrigin(cfg);
    const origin =
      data.return_origin &&
      (new URL(data.return_origin).origin === published ||
        (cfg.localRelayPort &&
          /^http:\/\/localhost:\d{2,5}$/.test(new URL(data.return_origin).origin)))
        ? new URL(data.return_origin).origin
        : published;

    try {
      const preference = await createPreference(cfg, order.store_id, {
        id: order.id,
        number: order.number ?? null,
        storeName: String(store?.name ?? "Vynka"),
        items: (order.order_items ?? []).map((item: any) => ({
          title: [item.product_name, item.variant_name].filter(Boolean).join(" / "),
          quantity: Number(item.quantity),
          unit_price: Number(item.unit_price),
        })),
        shipping: Number(order.shipping_amount ?? 0),
        expiresAt: new Date(new Date(order.created_at).getTime() + days * 24 * 60 * 60 * 1000),
        returnUrl: `${origin}/loja/${store?.slug}/pedido/${order.id}`,
      });
      const { error } = await supabaseAdmin
        .from("orders")
        .update({ mp_preference_id: preference.id })
        .eq("id", order.id);
      if (error) throw error;
      return { url: preference.url };
    } catch (err) {
      const message = err instanceof Error ? err.message : "";
      console.error("[mercado-pago] falha ao criar cobrança", message);
      if (message === "not_connected" || message === "reconnect_required") {
        throw new Error("Esta loja ainda não está recebendo pagamentos online. Fale com a loja.");
      }
      throw new Error("Não foi possível abrir o pagamento agora. Tente de novo em instantes.");
    }
  });

export const syncOrderPayment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => orderInput.parse(data))
  .handler(async ({ data, context }) => {
    const { mercadoPagoConfig, searchOrderPayments, pickPayment, applyPayment, supabaseAdmin } =
      await server();
    const cfg = mercadoPagoConfig();
    if (!cfg) return { updated: false };
    const { order } = await loadCustomerOrder(supabaseAdmin, data.order_id, context.userId);
    if (!order.mp_preference_id) return { updated: false };
    try {
      const payment = pickPayment(await searchOrderPayments(cfg, order.store_id, order.id));
      if (!payment) return { updated: false };
      const { result } = await applyPayment(order.store_id, payment);
      return { updated: result !== "stale" && result !== "not_found", status: payment.status };
    } catch (err) {
      console.error(
        "[mercado-pago] falha ao consultar pagamento",
        err instanceof Error ? err.message : "",
      );
      return { updated: false };
    }
  });
