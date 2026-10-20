import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { AccountTitle } from "@/components/loja/account-ui";
import { listCustomerOrders, useStoreCustomer } from "@/lib/customer-account";
import { deliveryMethodLabel, orderStatusLabelFor } from "@/lib/orders";
import { formatBRL } from "@/lib/products";
import { useStorefront } from "@/lib/storefront-context";

export const Route = createFileRoute("/loja/$slug/minha-conta/compras")({
  component: CustomerOrdersPage,
});

function CustomerOrdersPage() {
  const store = useStorefront();
  const { data: customer } = useStoreCustomer(store.id);
  const { data: orders = [], isLoading } = useQuery({
    queryKey: ["customer-orders", store.id],
    queryFn: () => listCustomerOrders(store.id),
    enabled: !!customer,
  });

  return (
    <div className="grid gap-5">
      <AccountTitle title="Minhas compras" />
      {isLoading ? (
        <p className="text-[13px] text-neutral-500">Carregando...</p>
      ) : orders.length === 0 ? (
        <div className="border border-dashed border-black/15 px-5 py-10 text-center text-[13px] text-neutral-500">
          Nenhuma compra na sua conta ainda.
        </div>
      ) : (
        <div className="grid gap-3">
          {orders.map((order) => (
            <article key={order.id} className="border border-black/10 bg-white p-4 md:p-5">
              <div className="flex flex-col justify-between gap-2 sm:flex-row">
                <div>
                  <Link
                    to="/loja/$slug/pedido/$id"
                    params={{ slug: store.slug, id: order.id }}
                    className="inline-flex min-h-11 items-center font-semibold text-black underline-offset-4 hover:underline sm:min-h-0"
                  >
                    Pedido #{order.number ?? order.id.slice(0, 8)}
                  </Link>
                  <div className="mt-1 text-[12px] text-neutral-500">
                    {new Date(order.created_at).toLocaleDateString("pt-BR")} ·{" "}
                    {orderStatusLabelFor(order)}
                  </div>
                </div>
                <div className="text-[16px] font-semibold text-black">{formatBRL(order.total)}</div>
              </div>
              <div className="mt-4 divide-y divide-black/10">
                {order.order_items.map((item) => (
                  <div key={item.id} className="flex justify-between gap-4 py-2 text-[13px]">
                    <span className="min-w-0 break-words">
                      {item.quantity}x {item.product_name}
                      {item.variant_name ? ` / ${item.variant_name}` : ""}
                    </span>
                    <span className="shrink-0">{formatBRL(item.total_price)}</span>
                  </div>
                ))}
              </div>
              {order.delivery_method ? (
                <div className="mt-3 flex justify-between gap-4 text-[12px] text-neutral-500">
                  <span>
                    {order.delivery_method === "shipping" && order.shipping_service_name
                      ? order.shipping_service_name
                      : deliveryMethodLabel[order.delivery_method]}
                  </span>
                  <span>
                    Frete {order.shipping_amount > 0 ? formatBRL(order.shipping_amount) : "grátis"}
                  </span>
                </div>
              ) : (
                typeof order.payment_details?.delivery_address === "object" &&
                order.payment_details.delivery_address && (
                  <div className="mt-3 text-[12px] text-neutral-500">Endereço salvo no pedido.</div>
                )
              )}
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
