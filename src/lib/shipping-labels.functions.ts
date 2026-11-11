import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { Database } from "@/integrations/supabase/types";
import { onlyDigits } from "@/lib/br-documents";

// Etiquetas do Melhor Envio (lote E3, escopo etiquetas-melhor-envio.md): pedido do site pago, com
// Correios/transportadora. Gerar = carrinho -> pagar com o saldo da conta da loja -> gerar; depois
// imprimir, cancelar e atualizar rastreio. Só o servidor fala com o Melhor Envio e grava
// order_shipments; o pedido anda (Enviado/Entregue) pela função do banco record_shipment_status.

// Volume que a cotação devolve (o Melhor Envio monta as caixas).
type MePackage = {
  weight?: string | number;
  dimensions?: { height?: number; width?: number; length?: number };
};
type Shipment = Database["public"]["Tables"]["order_shipments"]["Row"];
type SupabaseAdmin = Awaited<
  typeof import("@/integrations/supabase/client.server")
>["supabaseAdmin"];

async function server() {
  const me = await import("./melhor-envio.server");
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return { ...me, supabaseAdmin };
}

const orderInput = z.object({ store_id: z.string().uuid(), order_id: z.string().uuid() });
const generateInput = orderInput.extend({
  document_type: z.enum(["declaration", "invoice"]),
  invoice_key: z
    .string()
    .optional()
    .transform((value) => onlyDigits(value ?? "")),
});

// Pedido que pode ter etiqueta: do site, entrega por Correios/transportadora, pago e ainda não enviado.
const LABEL_STATUSES = ["paid", "in_production"];
// Etiqueta que já saiu do carrinho e foi paga: gerar de novo só depois de cancelar.
const DONE = ["generated", "posted", "delivered", "undelivered", "paused", "suspended"];

// Ver: membro da loja ou master. Gerar/cancelar: dono, administrador, master, ou vendedor com a
// permissão "Gerar etiquetas" que o dono liga em Usuários (João, 11/11).
async function access(context: { supabase: any; userId: string }, storeId: string) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const [{ data: member, error }, { data: isPlatformAdmin }] = await Promise.all([
    supabaseAdmin
      .from("store_members")
      .select("role, permissions")
      .eq("store_id", storeId)
      .eq("user_id", context.userId)
      .eq("active", true)
      .maybeSingle(),
    context.supabase.rpc("is_platform_admin", { _user_id: context.userId }),
  ]);
  if (error) throw error;
  if (!member && !isPlatformAdmin) throw new Error("Sem permissão para esta loja.");
  const permissions = (member?.permissions ?? {}) as Record<string, unknown>;
  const canGenerate =
    !!isPlatformAdmin ||
    member?.role === "owner" ||
    member?.role === "admin" ||
    permissions.generate_labels === true;
  return { canGenerate };
}

async function loadOrder(db: SupabaseAdmin, storeId: string, orderId: string) {
  const { data, error } = await db
    .from("orders")
    .select(
      "id, number, store_id, source, status, delivery_method, delivery_address, shipping_service_id, shipping_service_name, shipping_amount, customer_id",
    )
    .eq("id", orderId)
    .eq("store_id", storeId)
    .maybeSingle();
  if (error) throw error;
  if (!data) throw new Error("Pedido não encontrado.");
  return data;
}

async function activeShipment(db: SupabaseAdmin, orderId: string): Promise<Shipment | null> {
  const { data, error } = await db
    .from("order_shipments")
    .select("*")
    .eq("order_id", orderId)
    .neq("status", "cancelled")
    .maybeSingle();
  if (error) throw error;
  return data;
}

// Mensagem para o lojista a partir do erro do Melhor Envio.
async function friendly(err: unknown, fallback: string) {
  const { melhorEnvioErrorText, ShippingNotConnectedError } = await server();
  if (err instanceof ShippingNotConnectedError) {
    return err.message === "reconnect_required"
      ? "A conexão com o Melhor Envio expirou. Reconecte em Loja e Catálogo > Integrações."
      : "Conecte a conta do Melhor Envio em Loja e Catálogo > Integrações.";
  }
  const text = melhorEnvioErrorText(err);
  if (text && /saldo|balance|insufficient/i.test(text)) {
    return `Saldo insuficiente no Melhor Envio. Coloque saldo na sua conta e tente de novo. (${text})`;
  }
  return text ? `${fallback} Melhor Envio: ${text}` : fallback;
}

async function zipDistrict(zip: string) {
  try {
    const response = await fetch(`https://viacep.com.br/ws/${zip}/json/`, {
      signal: AbortSignal.timeout(6000),
    });
    const data = response.ok ? await response.json() : null;
    return data && !data.erro ? String(data.bairro ?? "") : "";
  } catch {
    return "";
  }
}

const tracking = (
  json: unknown,
  id: string,
): { status: string | null; tracking: string | null } => {
  const row = (json as Record<string, { status?: string; tracking?: string | null }> | null)?.[id];
  const raw = row?.status ?? null;
  // A API escreve "canceled"; aqui é "cancelled", como nos avisos.
  const status = raw === "canceled" ? "cancelled" : raw === "pending" ? "cart" : raw;
  return { status, tracking: row?.tracking ?? null };
};

// Monta remetente, destinatário, produtos e volumes; cota de novo o serviço do pedido (preço e
// volumes de agora, com seguro pelo valor dos produtos, igual ao checkout).
async function buildLabel(
  db: SupabaseAdmin,
  order: Awaited<ReturnType<typeof loadOrder>>,
  doc: { type: "declaration" | "invoice"; key: string },
) {
  const { melhorEnvioConfig, melhorEnvioFetch } = await server();
  const cfg = melhorEnvioConfig();
  if (!cfg) throw new Error("Melhor Envio não configurado no servidor.");
  const serviceId = order.shipping_service_id;
  if (!serviceId) throw new Error("O pedido não tem o serviço de frete gravado.");

  const [
    { data: store, error: storeError },
    { data: settings },
    { data: items, error: itemsError },
  ] = await Promise.all([
    db
      .from("stores")
      .select(
        "name, phone, whatsapp, email, address, address_number, complement, city, state, zip_code, tax_document",
      )
      .eq("id", order.store_id)
      .single(),
    db
      .from("store_checkout_settings")
      .select("package_weight_kg, package_height_cm, package_width_cm, package_length_cm")
      .eq("store_id", order.store_id)
      .maybeSingle(),
    db
      .from("order_items")
      .select("product_id, product_name, variant_name, quantity, unit_price")
      .eq("order_id", order.id),
  ]);
  if (storeError) throw storeError;
  if (itemsError) throw itemsError;
  if (!items?.length) throw new Error("O pedido não tem itens.");

  const fromZip = onlyDigits(store.zip_code ?? "");
  if (
    fromZip.length !== 8 ||
    !store.address?.trim() ||
    !store.address_number?.trim() ||
    !store.city?.trim() ||
    !store.state?.trim()
  ) {
    throw new Error(
      "Complete o endereço da loja (rua, número, cidade, UF e CEP) em Loja e Catálogo antes de gerar a etiqueta.",
    );
  }
  const district = await zipDistrict(fromZip);
  if (!district) throw new Error("Não foi possível achar o bairro do CEP da loja. Tente de novo.");

  const address = (order.delivery_address ?? {}) as Record<string, string | undefined>;
  const { data: customer } = order.customer_id
    ? await db
        .from("customers")
        .select("name, phone, mobile, email, document")
        .eq("id", order.customer_id)
        .maybeSingle()
    : { data: null };
  // CPF da compra (endereço do pedido, E2); pedido antigo usa o da ficha.
  const cpf = onlyDigits(address.document || customer?.document || "");
  if (cpf.length !== 11) {
    throw new Error(
      "O pedido não tem o CPF do cliente, que o Melhor Envio exige. Peça ao cliente.",
    );
  }
  const toZip = onlyDigits(address.zip_code ?? "");
  if (toZip.length !== 8 || !address.street || !address.address_number) {
    throw new Error("O pedido não tem o endereço de entrega completo.");
  }

  const productIds = [...new Set(items.map((item) => item.product_id).filter(Boolean))] as string[];
  const { data: products } = await db
    .from("products")
    .select("id, weight_kg, height_cm, width_cm, length_cm")
    .in("id", productIds);
  const dims = new Map((products ?? []).map((product) => [product.id, product]));
  // Mesma regra do checkout (checkout_cart_lines): produto -> pacote padrão da loja -> fixo.
  const quoteProducts = items.map((item, index) => {
    const product = item.product_id ? dims.get(item.product_id) : undefined;
    return {
      id: String(index + 1),
      weight: Number(product?.weight_kg ?? settings?.package_weight_kg ?? 0.3),
      height: Number(product?.height_cm ?? settings?.package_height_cm ?? 4),
      width: Number(product?.width_cm ?? settings?.package_width_cm ?? 12),
      length: Number(product?.length_cm ?? settings?.package_length_cm ?? 17),
      insurance_value: Number(item.unit_price),
      quantity: item.quantity,
    };
  });
  const quotes = (await melhorEnvioFetch(cfg, order.store_id, "/api/v2/me/shipment/calculate", {
    method: "POST",
    body: {
      from: { postal_code: fromZip },
      to: { postal_code: toZip },
      products: quoteProducts,
      services: String(serviceId),
    },
  })) as {
    id: number;
    price?: string;
    custom_price?: string;
    error?: string;
    packages?: MePackage[];
  }[];
  // Com um serviço só, a API devolve o objeto em vez de lista (medido em 11/11).
  const list = Array.isArray(quotes) ? quotes : quotes ? [quotes] : [];
  const quote = list.find((option) => Number(option.id) === serviceId);
  if (!quote || quote.error) {
    throw new Error(
      `O serviço ${order.shipping_service_name ?? ""} não atende mais este endereço. ${quote?.error ?? ""}`.trim(),
    );
  }
  const insurance = items.reduce((sum, item) => sum + Number(item.unit_price) * item.quantity, 0);
  const senderDoc = onlyDigits(store.tax_document ?? "");

  const payload = {
    service: serviceId,
    from: {
      name: store.name,
      phone: onlyDigits(store.phone || store.whatsapp || ""),
      email: store.email ?? "",
      // Declaração: documento vazio (o Melhor Envio usa o da conta; medido no sandbox em 11/11).
      document: doc.type === "invoice" && senderDoc.length === 11 ? senderDoc : "",
      company_document: doc.type === "invoice" && senderDoc.length === 14 ? senderDoc : "",
      address: store.address,
      complement: store.complement ?? "",
      number: store.address_number,
      district,
      city: store.city,
      state_abbr: store.state,
      country_id: "BR",
      postal_code: fromZip,
    },
    to: {
      name: customer?.name ?? "Cliente",
      phone: onlyDigits(customer?.mobile || customer?.phone || ""),
      email: customer?.email ?? "",
      document: cpf,
      address: address.street,
      complement: address.complement ?? "",
      number: address.address_number,
      district: address.neighborhood ?? "",
      city: address.city ?? "",
      state_abbr: address.state ?? "",
      country_id: "BR",
      postal_code: toZip,
    },
    products: items.map((item) => ({
      name: [item.product_name, item.variant_name].filter(Boolean).join(" - ").slice(0, 120),
      quantity: String(item.quantity),
      unitary_value: Number(item.unit_price).toFixed(2),
    })),
    volumes: (quote.packages ?? []).map((pkg) => ({
      height: Number(pkg.dimensions?.height),
      width: Number(pkg.dimensions?.width),
      length: Number(pkg.dimensions?.length),
      weight: Number(pkg.weight),
    })),
    options: {
      insurance_value: Number(insurance.toFixed(2)),
      receipt: false,
      own_hand: false,
      reverse: false,
      non_commercial: doc.type !== "invoice",
      ...(doc.type === "invoice" ? { invoice: { key: doc.key } } : {}),
      platform: "Vynka",
      tags: [{ tag: `Pedido #${order.number ?? ""}`, url: null }],
    },
  };
  return { cfg, payload, price: Number(quote.custom_price ?? quote.price) };
}

function publicShipment(row: Shipment | null) {
  if (!row) return null;
  return {
    id: row.id,
    status: row.status,
    service_name: row.service_name,
    price: row.price === null ? null : Number(row.price),
    document_type: row.document_type,
    tracking: row.tracking,
    tracking_url: row.tracking_url,
    paid_at: row.paid_at,
    posted_at: row.posted_at,
    delivered_at: row.delivered_at,
    last_error: row.last_error,
    created_at: row.created_at,
  };
}
export type OrderShipment = NonNullable<ReturnType<typeof publicShipment>>;

/** Etiqueta ativa do pedido (se houver) e se quem está vendo pode gerar/cancelar. */
export const getOrderShipment = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => orderInput.parse(data))
  .handler(async ({ data, context }) => {
    const { canGenerate } = await access(context, data.store_id);
    const { supabaseAdmin } = await server();
    const order = await loadOrder(supabaseAdmin, data.store_id, data.order_id);
    const shipment = await activeShipment(supabaseAdmin, order.id);
    return {
      shipment: publicShipment(shipment),
      canGenerate,
      eligible:
        order.source === "website" &&
        order.delivery_method === "shipping" &&
        LABEL_STATUSES.includes(order.status),
    };
  });

/** Antes de pagar: preço de agora, saldo da conta e frete cobrado do cliente. */
export const previewLabel = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => orderInput.parse(data))
  .handler(async ({ data, context }) => {
    const { canGenerate } = await access(context, data.store_id);
    if (!canGenerate) throw new Error("Você não tem permissão para gerar etiquetas.");
    const { supabaseAdmin, melhorEnvioFetch } = await server();
    const order = await loadOrder(supabaseAdmin, data.store_id, data.order_id);
    try {
      const { cfg, price } = await buildLabel(supabaseAdmin, order, {
        type: "declaration",
        key: "",
      });
      const balance = (await melhorEnvioFetch(cfg, data.store_id, "/api/v2/me/balance")) as {
        balance?: number;
      } | null;
      return {
        price,
        balance: balance?.balance ?? null,
        charged: Number(order.shipping_amount ?? 0),
        service_name: order.shipping_service_name,
      };
    } catch (err) {
      if (err instanceof Error && !/^melhor_envio_/.test(err.message)) throw err;
      throw new Error(await friendly(err, "Não foi possível cotar a etiqueta."));
    }
  });

/** Gera a etiqueta (ou continua uma que parou no carrinho ou depois de paga). */
export const generateLabel = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => generateInput.parse(data))
  .handler(async ({ data, context }) => {
    const { canGenerate } = await access(context, data.store_id);
    if (!canGenerate) throw new Error("Você não tem permissão para gerar etiquetas.");
    if (data.document_type === "invoice" && data.invoice_key.length !== 44) {
      throw new Error("A chave da NF-e tem 44 números.");
    }
    const { supabaseAdmin, melhorEnvioConfig, melhorEnvioFetch } = await server();
    const order = await loadOrder(supabaseAdmin, data.store_id, data.order_id);
    if (
      order.source !== "website" ||
      order.delivery_method !== "shipping" ||
      !LABEL_STATUSES.includes(order.status)
    ) {
      throw new Error(
        "Este pedido não pode ter etiqueta (precisa estar pago e ainda não enviado).",
      );
    }
    let row = await activeShipment(supabaseAdmin, order.id);
    if (row && DONE.includes(row.status)) throw new Error("Este pedido já tem etiqueta gerada.");
    const cfg = melhorEnvioConfig();
    if (!cfg) throw new Error("Melhor Envio não configurado no servidor.");

    const fail = async (err: unknown, fallback: string): Promise<never> => {
      const fromVynka =
        err instanceof Error &&
        !/^melhor_envio_/.test(err.message) &&
        !(err as { status?: unknown }).status;
      const message = fromVynka ? (err as Error).message : await friendly(err, fallback);
      if (row) {
        await supabaseAdmin
          .from("order_shipments")
          .update({ last_error: message, last_error_at: new Date().toISOString() })
          .eq("id", row.id);
      }
      throw new Error(message);
    };

    // 1) Carrinho (uma vez): grava a etiqueta já com o id do Melhor Envio.
    if (!row) {
      try {
        const { payload, price } = await buildLabel(supabaseAdmin, order, {
          type: data.document_type,
          key: data.invoice_key,
        });
        const cart = (await melhorEnvioFetch(cfg, data.store_id, "/api/v2/me/cart", {
          method: "POST",
          body: payload,
        })) as { id?: string; protocol?: string; price?: string | number };
        if (!cart?.id) throw new Error("O Melhor Envio não devolveu a etiqueta.");
        const { data: inserted, error } = await supabaseAdmin
          .from("order_shipments")
          .insert({
            order_id: order.id,
            store_id: order.store_id,
            environment: cfg.env,
            me_order_id: cart.id,
            protocol: cart.protocol ?? null,
            status: "cart",
            service_id: order.shipping_service_id,
            service_name: order.shipping_service_name,
            price: Number(cart.price ?? price),
            document_type: data.document_type,
            invoice_key: data.document_type === "invoice" ? data.invoice_key : null,
            created_by: context.userId,
          })
          .select("*")
          .single();
        if (error) throw error;
        row = inserted;
      } catch (err) {
        await fail(err, "Não foi possível colocar a etiqueta no Melhor Envio.");
      }
    }
    const shipment = row as Shipment;

    // 2) Pagar com o saldo da conta da loja.
    if (shipment.status === "cart") {
      try {
        await melhorEnvioFetch(cfg, data.store_id, "/api/v2/me/shipment/checkout", {
          method: "POST",
          body: { orders: [shipment.me_order_id] },
        });
      } catch (err) {
        await fail(err, "Não foi possível pagar a etiqueta.");
      }
      const paidAt = new Date().toISOString();
      // Frete grátis para o cliente: a loja paga a etiqueta -> despesa em Finanças (João, 11/11).
      let financeEntryId: string | null = null;
      if (Number(order.shipping_amount ?? 0) === 0 && Number(shipment.price ?? 0) > 0) {
        const { data: category } = await supabaseAdmin
          .from("finance_categories")
          .select("id")
          .eq("system_key", "expense_shipping")
          .maybeSingle();
        const { data: entry } = await supabaseAdmin
          .from("finance_entries")
          .insert({
            store_id: order.store_id,
            kind: "expense",
            amount: Number(shipment.price),
            category_id: category?.id ?? null,
            description: `Etiqueta ${shipment.service_name ?? ""} · Pedido #${order.number ?? ""}`
              .replace(/\s+/g, " ")
              .slice(0, 200),
            entry_date: paidAt.slice(0, 10),
            status: "paid",
            created_by: context.userId,
          })
          .select("id")
          .single();
        financeEntryId = entry?.id ?? null;
      }
      await supabaseAdmin
        .from("order_shipments")
        .update({
          status: "released",
          paid_at: paidAt,
          finance_entry_id: financeEntryId,
          last_error: null,
          last_error_at: null,
        })
        .eq("id", shipment.id);
      shipment.status = "released";
    }

    // 3) Gerar (assíncrono no Melhor Envio) e ler o status.
    try {
      await melhorEnvioFetch(cfg, data.store_id, "/api/v2/me/shipment/generate", {
        method: "POST",
        body: { orders: [shipment.me_order_id] },
      });
    } catch (err) {
      await fail(err, "A etiqueta foi paga, mas não foi gerada. Clique em continuar.");
    }
    await new Promise((resolve) => setTimeout(resolve, 2500));
    const state = tracking(
      await melhorEnvioFetch(cfg, data.store_id, "/api/v2/me/shipment/tracking", {
        method: "POST",
        body: { orders: [shipment.me_order_id] },
      }).catch(() => null),
      shipment.me_order_id,
    );
    await supabaseAdmin.rpc("record_shipment_status", {
      _me_order_id: shipment.me_order_id,
      _status: state.status === "released" || !state.status ? "generated" : state.status,
      _tracking: state.tracking ?? undefined,
    });
    await supabaseAdmin
      .from("order_shipments")
      .update({ last_error: null, last_error_at: null })
      .eq("id", shipment.id);
    return { shipment: publicShipment(await activeShipment(supabaseAdmin, order.id)) };
  });

/** Link público do PDF da etiqueta (não guarda o arquivo). */
export const printLabel = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => orderInput.parse(data))
  .handler(async ({ data, context }) => {
    await access(context, data.store_id);
    const { supabaseAdmin, melhorEnvioConfig, melhorEnvioFetch } = await server();
    const cfg = melhorEnvioConfig();
    if (!cfg) throw new Error("Melhor Envio não configurado no servidor.");
    const order = await loadOrder(supabaseAdmin, data.store_id, data.order_id);
    const row = await activeShipment(supabaseAdmin, order.id);
    if (!row || row.status === "cart")
      throw new Error("Este pedido ainda não tem etiqueta gerada.");
    try {
      const result = (await melhorEnvioFetch(cfg, data.store_id, "/api/v2/me/shipment/print", {
        method: "POST",
        body: { mode: "public", orders: [row.me_order_id] },
      })) as { url?: string };
      if (!result?.url) throw new Error("sem_link");
      return { url: result.url };
    } catch (err) {
      throw new Error(
        await friendly(
          err,
          "A etiqueta ainda está sendo gerada. Tente de novo em alguns segundos.",
        ),
      );
    }
  });

/** Consulta o Melhor Envio e atualiza etiqueta e pedido (postado -> Enviado; entregue -> Entregue). */
export const refreshShipment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => orderInput.parse(data))
  .handler(async ({ data, context }) => {
    await access(context, data.store_id);
    const { supabaseAdmin, melhorEnvioConfig, fetchShipmentState, shipmentMovesForward } =
      await server();
    const cfg = melhorEnvioConfig();
    if (!cfg) throw new Error("Melhor Envio não configurado no servidor.");
    const order = await loadOrder(supabaseAdmin, data.store_id, data.order_id);
    const row = await activeShipment(supabaseAdmin, order.id);
    if (!row) return { shipment: null };
    try {
      // Mesma consulta e mesma regra do aviso do Melhor Envio (api.melhor-envio.webhook.ts).
      const state = await fetchShipmentState(cfg, data.store_id, row.me_order_id);
      if (shipmentMovesForward(row.status, state.status)) {
        await supabaseAdmin.rpc("record_shipment_status", {
          _me_order_id: row.me_order_id,
          _status: state.status as string,
          _tracking: state.tracking ?? undefined,
          _at: state.at ?? undefined,
        });
      }
    } catch (err) {
      throw new Error(await friendly(err, "Não foi possível consultar o Melhor Envio."));
    }
    const { data: fresh } = await supabaseAdmin
      .from("order_shipments")
      .select("*")
      .eq("id", row.id)
      .single();
    return { shipment: publicShipment(fresh?.status === "cancelled" ? null : fresh) };
  });

/** Cancela a etiqueta antes da postagem (o saldo volta para a conta da loja). */
export const cancelLabel = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => orderInput.parse(data))
  .handler(async ({ data, context }) => {
    const { canGenerate } = await access(context, data.store_id);
    if (!canGenerate) throw new Error("Você não tem permissão para cancelar etiquetas.");
    const { supabaseAdmin, melhorEnvioConfig, melhorEnvioFetch } = await server();
    const cfg = melhorEnvioConfig();
    if (!cfg) throw new Error("Melhor Envio não configurado no servidor.");
    const order = await loadOrder(supabaseAdmin, data.store_id, data.order_id);
    const row = await activeShipment(supabaseAdmin, order.id);
    if (!row) throw new Error("Este pedido não tem etiqueta ativa.");
    if (["posted", "delivered"].includes(row.status)) {
      throw new Error("A etiqueta já foi postada e não pode mais ser cancelada.");
    }
    try {
      if (row.status === "cart") {
        await melhorEnvioFetch(cfg, data.store_id, `/api/v2/me/cart/${row.me_order_id}`, {
          method: "DELETE",
        });
      } else {
        const check = (await melhorEnvioFetch(
          cfg,
          data.store_id,
          "/api/v2/me/shipment/cancellable",
          { method: "POST", body: { orders: [row.me_order_id] } },
        )) as Record<string, { cancellable?: boolean; uncancellable_reason?: string | null }>;
        const verdict = check?.[row.me_order_id];
        if (verdict && verdict.cancellable === false) {
          throw new Error(
            `O Melhor Envio não deixa cancelar esta etiqueta${verdict.uncancellable_reason ? `: ${verdict.uncancellable_reason}` : "."}`,
          );
        }
        await melhorEnvioFetch(cfg, data.store_id, "/api/v2/me/shipment/cancel", {
          method: "POST",
          body: {
            order: {
              id: row.me_order_id,
              reason_id: "2",
              description: `Cancelada pela loja no Vynka (pedido #${order.number ?? ""})`,
            },
          },
        });
      }
    } catch (err) {
      if (err instanceof Error && !/^melhor_envio_/.test(err.message)) throw err;
      throw new Error(await friendly(err, "Não foi possível cancelar a etiqueta."));
    }
    await supabaseAdmin.rpc("record_shipment_status", {
      _me_order_id: row.me_order_id,
      _status: "cancelled",
    });
    // A despesa de Finanças (frete grátis) sai junto: a etiqueta não foi usada.
    if (row.finance_entry_id) {
      await supabaseAdmin.from("finance_entries").delete().eq("id", row.finance_entry_id);
    }
    return { ok: true };
  });
