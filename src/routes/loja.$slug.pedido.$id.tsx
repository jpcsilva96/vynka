import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, CheckCircle2, Clock3, MessageCircle } from "lucide-react";
import { buildWhatsAppLink, orderWhatsAppText } from "@/lib/cart";
import { getCustomerOrder } from "@/lib/customer-account";
import {
  deliveryDaysLabel,
  deliveryMethodLabel,
  formatDeliveryAddress,
  orderStatusLabelFor,
} from "@/lib/orders";
import { formatBRL } from "@/lib/products";
import { useStorefront } from "@/lib/storefront-context";

export const Route = createFileRoute("/loja/$slug/pedido/$id")({
  component: OrderPage,
});

// Depois do "Finalizar": o pedido como ficou gravado. Enquanto não há pagamento online (lote E), o
// pedido fica "Aguardando pagamento". Pago: botões de WhatsApp para falar com a loja (contato, não
// venda).
function OrderPage() {
  const store = useStorefront();
  const { id } = Route.useParams();
  const { data: order, isLoading } = useQuery({
    queryKey: ["customer-order", store.id, id],
    queryFn: () => getCustomerOrder(store.id, id),
  });

  if (isLoading) {
    return (
      <div className="px-4 py-16 text-center text-[13px] text-neutral-500">
        Carregando pedido...
      </div>
    );
  }
  if (!order) {
    return (
      <div className="mx-auto max-w-[720px] px-4 py-16 text-center">
        <p className="text-[14px] text-neutral-600">
          Pedido não encontrado. Entre na sua conta para ver suas compras.
        </p>
        <Link
          to="/loja/$slug/minha-conta"
          params={{ slug: store.slug }}
          className="mt-6 inline-block bg-black px-5 py-3 text-[12px] font-semibold uppercase tracking-[0.16em] text-white"
        >
          Minha conta
        </Link>
      </div>
    );
  }

  const paid = !["pending", "confirmed", "cancelled"].includes(order.status);
  const awaiting = order.status === "pending";
  const days = deliveryDaysLabel(order.shipping_min_days, order.shipping_max_days);

  return (
    <div className="bg-neutral-50">
      <div className="mx-auto max-w-[720px] px-4 py-8 md:py-12">
        <Link
          to="/loja/$slug"
          params={{ slug: store.slug }}
          className="inline-flex items-center gap-2 text-[12px] font-medium uppercase tracking-[0.16em] text-neutral-500 hover:text-black"
        >
          <ArrowLeft className="h-4 w-4" /> Voltar para loja
        </Link>

        <section className="mt-8 border border-black/10 bg-white p-5 md:p-7">
          <div className="flex items-center gap-3">
            {paid ? (
              <CheckCircle2 className="h-6 w-6 text-emerald-600" />
            ) : (
              <Clock3 className="h-6 w-6 text-amber-600" />
            )}
            <div>
              <h1 className="text-2xl font-semibold tracking-tight text-black">
                Pedido #{order.number ?? order.id.slice(0, 8)}
              </h1>
              <div className="mt-1 text-[13px] text-neutral-500">{orderStatusLabelFor(order)}</div>
            </div>
          </div>

          {awaiting && (
            <div className="mt-5 border border-amber-200 bg-amber-50 px-4 py-3 text-[13px] leading-relaxed text-amber-800">
              Pedido recebido. O pagamento online (Pix, boleto ou cartão) estará disponível em
              breve; enquanto isso, o pedido fica aguardando pagamento.
              {order.payment_due_at && (
                <span className="mt-1 block font-medium">
                  Pague até {formatDateTime(order.payment_due_at)}. Depois disso o pedido é
                  cancelado e as peças voltam para a loja.
                </span>
              )}
            </div>
          )}

          {order.status === "cancelled" && order.cancel_reason === "deadline" && (
            <div className="mt-5 border border-black/10 bg-neutral-50 px-4 py-3 text-[13px] leading-relaxed text-neutral-700">
              O prazo para pagamento terminou e o pedido foi cancelado. Se ainda quiser os produtos,
              faça um novo pedido.
            </div>
          )}

          {order.stock_shortage && (
            <div className="mt-5 border border-red-200 bg-red-50 px-4 py-3 text-[13px] leading-relaxed text-red-800">
              Recebemos seu pagamento, mas um dos produtos esgotou antes da confirmação. A loja vai
              falar com você para combinar a troca ou o reembolso.
            </div>
          )}

          <div className="mt-6 divide-y divide-black/10">
            {order.order_items.map((item) => (
              <div key={item.id} className="flex justify-between gap-4 py-2.5 text-[13px]">
                <span>
                  {item.quantity}x {item.product_name}
                  {item.variant_name ? ` / ${item.variant_name}` : ""}
                </span>
                <span>{formatBRL(item.total_price)}</span>
              </div>
            ))}
          </div>

          <div className="mt-4 space-y-1.5 border-t border-black/10 pt-4 text-[13px]">
            <Row label="Produtos" value={formatBRL(order.subtotal)} />
            {order.delivery_method && (
              <Row
                label="Frete"
                value={order.shipping_amount > 0 ? formatBRL(order.shipping_amount) : "Grátis"}
              />
            )}
            <div className="flex justify-between pt-2 text-[16px] font-semibold text-black">
              <span>Total</span>
              <span>{formatBRL(order.total)}</span>
            </div>
          </div>

          {order.delivery_method && (
            <div className="mt-6 border-t border-black/10 pt-4 text-[13px]">
              <div className="text-[11px] font-medium uppercase tracking-[0.2em] text-neutral-500">
                Entrega
              </div>
              <div className="mt-2 font-medium text-black">
                {order.delivery_method === "shipping" && order.shipping_service_name
                  ? order.shipping_service_name
                  : deliveryMethodLabel[order.delivery_method]}
                {days ? ` · ${days}` : ""}
              </div>
              <div className="mt-1 text-neutral-600">
                {order.delivery_method === "pickup"
                  ? "Você retira na loja. Avisamos quando estiver pronto."
                  : formatDeliveryAddress(order.delivery_address)}
              </div>
            </div>
          )}

          {paid && store.whatsapp && (
            <div className="mt-6 grid gap-2 border-t border-black/10 pt-5 sm:grid-cols-2">
              <WhatsAppButton
                label="Falar com a loja sobre o pedido"
                href={buildWhatsAppLink(orderWhatsAppText(order, "order"), store.whatsapp)}
              />
              {order.delivery_method === "local" && (
                <WhatsAppButton
                  label="Falar sobre a entrega"
                  href={buildWhatsAppLink(orderWhatsAppText(order, "delivery"), store.whatsapp)}
                />
              )}
            </div>
          )}

          <Link
            to="/loja/$slug/minha-conta"
            params={{ slug: store.slug }}
            hash="compras"
            className="mt-6 inline-block text-[12px] font-medium uppercase tracking-[0.16em] text-neutral-500 hover:text-black"
          >
            Ver minhas compras
          </Link>
        </section>
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between text-neutral-600">
      <span>{label}</span>
      <span>{value}</span>
    </div>
  );
}

function WhatsAppButton({ label, href }: { label: string; href: string }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="flex items-center justify-center gap-2 border border-black px-4 py-3 text-[12px] font-semibold uppercase tracking-[0.12em] text-black hover:bg-black hover:text-white"
    >
      <MessageCircle className="h-4 w-4" /> {label}
    </a>
  );
}

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}
