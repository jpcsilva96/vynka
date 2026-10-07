/* eslint-disable @typescript-eslint/no-explicit-any -- funções novas ainda fora do types.ts gerado (regenerar é pendência) */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

// Checkout em etapas (lote C2): opções de entrega e criação do pedido, sempre pelo servidor.
// O navegador manda só itens, CEP e a opção escolhida. A cidade (código IBGE) vem do CEP, consultado
// aqui; o frete das transportadoras vem da cotação do Melhor Envio feita aqui com a conta da loja; as
// regras (cidades atendidas, retirada, frete grátis) estão no banco (checkout_delivery_options).

async function server() {
  const me = await import("./melhor-envio.server");
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return { ...me, supabaseAdmin: supabaseAdmin as any };
}

const itemsSchema = z
  .array(
    z.object({
      product_id: z.string().uuid(),
      variant_id: z.string().uuid().nullable().optional(),
      quantity: z.number().int().min(1).max(999),
    }),
  )
  .min(1, "Carrinho vazio.")
  .max(100, "Carrinho com itens demais.");

const zipSchema = z
  .string()
  .transform((value) => value.replace(/\D/g, ""))
  .refine((value) => value.length === 8, "Informe um CEP válido.");

export interface ZipAddress {
  zip_code: string;
  street: string;
  neighborhood: string;
  city: string;
  state: string;
  ibge_code: string;
}

// ViaCEP consultado no servidor: a cidade do pedido é a do CEP, não a que o navegador disser.
async function resolveZip(zip: string): Promise<ZipAddress> {
  let data: any = null;
  try {
    const response = await fetch(`https://viacep.com.br/ws/${zip}/json/`, {
      signal: AbortSignal.timeout(6000),
    });
    if (response.ok) data = await response.json();
  } catch {
    throw new Error("Não foi possível consultar o CEP agora. Tente de novo em instantes.");
  }
  if (!data || data.erro || !/^\d{7}$/.test(String(data.ibge ?? ""))) {
    throw new Error("CEP não encontrado. Confira os números.");
  }
  return {
    zip_code: zip,
    street: String(data.logradouro ?? ""),
    neighborhood: String(data.bairro ?? ""),
    city: String(data.localidade ?? ""),
    state: String(data.uf ?? "").toUpperCase(),
    ibge_code: String(data.ibge),
  };
}

const dbMessage = (error: { message?: string } | null, fallback: string) =>
  new Error(error?.message || fallback);

export interface DeliveryOption {
  method: "local" | "pickup" | "shipping";
  service_id: number | null;
  name: string;
  price: number;
  original_price: number;
  min_days: number | null;
  max_days: number | null;
  free: boolean;
}

interface Quote {
  id: number;
  name: string;
  price: number;
  min_days: number | null;
  max_days: number | null;
}

// Itens (preço e medidas do banco) → cotação do Melhor Envio → opções pela regra do banco.
async function computeOptions(
  storeId: string,
  items: z.infer<typeof itemsSchema>,
  ibgeCode: string | null,
  toZip: string | null,
) {
  const { supabaseAdmin, melhorEnvioConfig, melhorEnvioFetch } = await server();
  const { data: lines, error: linesError } = await supabaseAdmin.rpc("checkout_cart_lines", {
    _store_id: storeId,
    _items: items,
  });
  if (linesError) throw dbMessage(linesError, "Não foi possível conferir o carrinho.");
  // Em centavos, como o banco (round por linha), para o frete grátis bater no limite.
  const subtotalCents = ((lines ?? []) as any[]).reduce(
    (sum, line) => sum + Math.round(Number(line.unit_price) * line.quantity * 100),
    0,
  );
  const subtotal = subtotalCents / 100;

  let quotes: Quote[] = [];
  let shippingUnavailable = false;
  const [{ data: settings }, { data: store }] = await Promise.all([
    supabaseAdmin
      .from("store_checkout_settings")
      .select("shipping_enabled,shipping_services")
      .eq("store_id", storeId)
      .maybeSingle(),
    supabaseAdmin.from("stores").select("zip_code").eq("id", storeId).maybeSingle(),
  ]);
  const services: number[] = (settings?.shipping_services ?? []).map(Number);
  const fromZip = String(store?.zip_code ?? "").replace(/\D/g, "");
  const cfg = melhorEnvioConfig();
  if (settings?.shipping_enabled && toZip && services.length > 0) {
    if (!cfg || fromZip.length !== 8) {
      shippingUnavailable = true;
    } else {
      try {
        // Sempre com a lista de serviços (sem ela a cotação volta só parte das transportadoras;
        // medido em 06/10). Cada item vai com as próprias medidas; o Melhor Envio monta os volumes.
        const result = (await melhorEnvioFetch(cfg, storeId, "/api/v2/me/shipment/calculate", {
          method: "POST",
          body: {
            from: { postal_code: fromZip },
            to: { postal_code: toZip },
            products: ((lines ?? []) as any[]).map((line, index) => ({
              id: String(index + 1),
              weight: Number(line.weight_kg),
              height: Number(line.height_cm),
              width: Number(line.width_cm),
              length: Number(line.length_cm),
              insurance_value: Number(line.unit_price),
              quantity: line.quantity,
            })),
            services: services.join(","),
          },
        })) as any[];
        quotes = (result ?? [])
          .filter((quote) => !quote.error && (quote.custom_price ?? quote.price) != null)
          .map((quote) => {
            const range = quote.custom_delivery_range ?? quote.delivery_range ?? {};
            const days = Number(quote.custom_delivery_time ?? quote.delivery_time);
            return {
              id: Number(quote.id),
              name: [quote.company?.name, quote.name].filter(Boolean).join(" "),
              price: Number(quote.custom_price ?? quote.price),
              min_days: Number.isFinite(Number(range.min)) ? Number(range.min) : days || null,
              max_days: Number.isFinite(Number(range.max)) ? Number(range.max) : days || null,
            };
          });
      } catch (err) {
        // Melhor Envio fora do ar ou conexão expirada: entrega local e retirada continuam valendo.
        console.error(
          "[checkout] cotação Melhor Envio falhou:",
          err instanceof Error ? err.message : err,
        );
        shippingUnavailable = true;
      }
    }
  }

  const { data: options, error: optionsError } = await supabaseAdmin.rpc(
    "checkout_delivery_options",
    { _store_id: storeId, _ibge_code: ibgeCode, _subtotal: subtotal, _quotes: quotes },
  );
  if (optionsError) throw dbMessage(optionsError, "Não foi possível calcular a entrega.");
  return {
    subtotal,
    quotes,
    shippingUnavailable,
    options: ((options ?? []) as any[]).map((option): DeliveryOption => ({
      method: option.method,
      service_id: option.service_id,
      name: option.name,
      price: Number(option.price),
      original_price: Number(option.original_price),
      min_days: option.min_days,
      max_days: option.max_days,
      free: !!option.free,
    })),
  };
}

// Etapa 2: o cliente informa o CEP e vê as opções com preço e prazo.
export const getCheckoutOptions = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z.object({ store_id: z.string().uuid(), zip: zipSchema, items: itemsSchema }).parse(data),
  )
  .handler(async ({ data }) => {
    const address = await resolveZip(data.zip);
    const result = await computeOptions(
      data.store_id,
      data.items,
      address.ibge_code,
      address.zip_code,
    );
    return {
      address,
      subtotal: result.subtotal,
      options: result.options,
      shippingUnavailable: result.shippingUnavailable,
    };
  });

const placeInput = z.object({
  store_id: z.string().uuid(),
  items: itemsSchema,
  delivery: z.object({
    method: z.enum(["local", "pickup", "shipping"]),
    service_id: z.number().int().positive().nullable().optional(),
  }),
  // Valor do frete que o cliente viu; se a conta de agora der outro, o pedido não é gravado.
  expected_shipping: z.number().min(0),
  zip: zipSchema.optional(),
  address: z
    .object({
      street: z.string().trim().max(200),
      address_number: z.string().trim().min(1, "Informe o número.").max(20),
      complement: z.string().trim().max(100).optional().default(""),
      neighborhood: z.string().trim().max(100).optional().default(""),
    })
    .optional(),
  notes: z.string().max(1000).optional(),
});

const money = (value: number) =>
  value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

// "Finalizar": refaz CEP, cotação e regra; grava só se o frete for o mesmo que o cliente viu.
export const placeCheckoutOrder = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => placeInput.parse(data))
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await server();
    // Venda no site só com pagamento integrado: loja sem Mercado Pago conectado não recebe pedido.
    const { data: payment } = await supabaseAdmin
      .from("store_payment_connections")
      .select("store_id")
      .eq("store_id", data.store_id)
      .maybeSingle();
    if (!payment) {
      throw new Error("Esta loja ainda não está recebendo pagamentos online. Fale com a loja.");
    }
    const pickup = data.delivery.method === "pickup";
    let address: (ZipAddress & { address_number: string; complement: string }) | null = null;
    if (!pickup) {
      if (!data.zip || !data.address) throw new Error("Informe o endereço de entrega completo.");
      const fromZip = await resolveZip(data.zip);
      const street = data.address.street || fromZip.street;
      if (!street) throw new Error("Informe a rua.");
      address = {
        ...fromZip,
        street,
        neighborhood: data.address.neighborhood || fromZip.neighborhood,
        address_number: data.address.address_number,
        complement: data.address.complement,
      };
    }

    const result = await computeOptions(
      data.store_id,
      data.items,
      address?.ibge_code ?? null,
      address?.zip_code ?? null,
    );
    const serviceId =
      data.delivery.method === "shipping" ? (data.delivery.service_id ?? null) : null;
    const chosen = result.options.find(
      (option) => option.method === data.delivery.method && option.service_id === serviceId,
    );
    if (!chosen) {
      throw new Error("Esta forma de entrega não está mais disponível. Escolha outra.");
    }
    if (Math.abs(chosen.price - data.expected_shipping) >= 0.01) {
      throw new Error(
        `O frete mudou para ${money(chosen.price)}. Confira o valor e finalize de novo.`,
      );
    }

    const { data: orderId, error } = await supabaseAdmin.rpc("create_checkout_order", {
      _user_id: context.userId,
      _store_id: data.store_id,
      _items: data.items,
      _delivery: { method: data.delivery.method, service_id: serviceId },
      _address: address,
      _quotes: result.quotes,
      _notes: data.notes || null,
    });
    if (error) throw dbMessage(error, "Não foi possível registrar o pedido.");
    return { orderId: orderId as string };
  });
