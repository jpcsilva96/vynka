import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { assertStoreCustomer, attachStoreCustomerAuth } from "@/lib/store-auth";

// Rastreio para o cliente (lote E5, escopo etiquetas-melhor-envio.md). A tabela order_shipments só
// é lida por membros da loja (tem preço, saldo, chave de nota); o cliente recebe pelo servidor só o
// código, o link e a etapa da etiqueta dos pedidos dele nesta loja. Sem migration.

export type CustomerShipment = {
  order_id: string;
  status: string;
  tracking: string | null;
  tracking_url: string | null;
};

// Etiqueta paga e gerada em diante (carrinho e cancelada não aparecem para o cliente).
const VISIBLE = [
  "released",
  "generated",
  "posted",
  "delivered",
  "undelivered",
  "paused",
  "suspended",
];

const input = z.object({
  store_id: z.string().uuid(),
  order_id: z.string().uuid().optional(),
});

export const listCustomerShipments = createServerFn({ method: "POST" })
  .middleware([attachStoreCustomerAuth, requireSupabaseAuth])
  .inputValidator((data: unknown) => input.parse(data))
  .handler(async ({ data, context }): Promise<CustomerShipment[]> => {
    assertStoreCustomer(context.claims, data.store_id);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // Ficha(s) do cliente nesta loja -> pedidos do site dele -> etiquetas ativas.
    const { data: customers, error: customersError } = await supabaseAdmin
      .from("customers")
      .select("id")
      .eq("store_id", data.store_id)
      .eq("user_id", context.userId);
    if (customersError) throw customersError;
    const customerIds = (customers ?? []).map((row) => row.id);
    if (customerIds.length === 0) return [];

    let ordersQuery = supabaseAdmin
      .from("orders")
      .select("id")
      .eq("store_id", data.store_id)
      .eq("source", "website")
      .in("customer_id", customerIds);
    if (data.order_id) ordersQuery = ordersQuery.eq("id", data.order_id);
    const { data: orders, error: ordersError } = await ordersQuery;
    if (ordersError) throw ordersError;
    const orderIds = (orders ?? []).map((row) => row.id);
    if (orderIds.length === 0) return [];

    const { data: shipments, error } = await supabaseAdmin
      .from("order_shipments")
      .select("order_id, status, tracking, tracking_url")
      .in("order_id", orderIds)
      .in("status", VISIBLE);
    if (error) throw error;
    return (shipments ?? []).map((row) => ({
      order_id: row.order_id,
      status: row.status,
      tracking: row.tracking,
      tracking_url: safeUrl(row.tracking_url),
    }));
  });

// O link vem do aviso do Melhor Envio (já filtrado no webhook); aqui só https passa.
function safeUrl(value: string | null) {
  if (!value) return null;
  try {
    return new URL(value).protocol === "https:" ? value : null;
  } catch {
    return null;
  }
}
