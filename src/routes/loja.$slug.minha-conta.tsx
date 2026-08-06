import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { ProductCard } from "@/components/loja/product-card";
import {
  listCustomerOrders,
  listFavoriteProducts,
  signOutCustomer,
  updateCustomerAddress,
  useStoreCustomer,
  type CustomerAddressForm,
} from "@/lib/customer-account";
import { formatBRL } from "@/lib/products";
import { orderStatusLabel } from "@/lib/orders";
import { useStorefront } from "@/lib/storefront-context";

export const Route = createFileRoute("/loja/$slug/minha-conta")({
  component: CustomerAccountPage,
});

const emptyAddress: CustomerAddressForm = {
  zip_code: "",
  street: "",
  address_number: "",
  complement: "",
  neighborhood: "",
  city: "",
  state: "",
};

function CustomerAccountPage() {
  const store = useStorefront();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { data: customer, isLoading } = useStoreCustomer(store.id);
  const [address, setAddress] = useState(emptyAddress);
  const [saving, setSaving] = useState(false);

  const { data: orders = [] } = useQuery({
    queryKey: ["customer-orders", store.id],
    queryFn: () => listCustomerOrders(store.id),
    enabled: !!customer,
  });
  const { data: favorites = [] } = useQuery({
    queryKey: ["customer-favorite-products", store.id],
    queryFn: () => listFavoriteProducts(store.id),
    enabled: !!customer,
  });

  useEffect(() => {
    if (!isLoading && !customer) {
      navigate({ to: "/loja/$slug/entrar", params: { slug: store.slug } });
    }
  }, [customer, isLoading, navigate, store.slug]);

  useEffect(() => {
    if (!customer) return;
    setAddress({
      zip_code: customer.zip_code ?? "",
      street: customer.street ?? "",
      address_number: customer.address_number ?? "",
      complement: customer.complement ?? "",
      neighborhood: customer.neighborhood ?? "",
      city: customer.city ?? "",
      state: customer.state ?? "",
    });
  }, [customer]);

  const saveAddress = async () => {
    if (!customer) return;
    setSaving(true);
    try {
      await updateCustomerAddress(store.id, customer, address);
      await queryClient.invalidateQueries({ queryKey: ["store-customer", store.id] });
    } finally {
      setSaving(false);
    }
  };

  const logout = async () => {
    await signOutCustomer();
    await queryClient.invalidateQueries({ queryKey: ["store-customer", store.id] });
    navigate({ to: "/loja/$slug", params: { slug: store.slug } });
  };

  if (isLoading || !customer) return <div className="min-h-[60vh]" />;

  return (
    <div className="mx-auto max-w-[1280px] px-4 py-10 md:px-8 md:py-14">
      <div className="flex flex-col justify-between gap-4 border-b border-black/10 pb-8 md:flex-row md:items-end">
        <div>
          <div className="text-[11px] font-medium uppercase tracking-[0.24em] text-neutral-500">{store.name}</div>
          <h1 className="mt-2 text-4xl font-semibold tracking-tight text-black">Minha conta</h1>
          <p className="mt-2 text-[14px] text-neutral-500">{customer.name} · {customer.email}</p>
        </div>
        <button onClick={logout} className="w-max border border-black px-4 py-2 text-[12px] font-semibold uppercase tracking-[0.16em] hover:bg-black hover:text-white">
          Sair
        </button>
      </div>

      <section className="grid gap-8 py-10 lg:grid-cols-[0.85fr_1.15fr]">
        <div className="border border-black/10 bg-white p-5">
          <h2 className="text-xl font-semibold text-black">Endereco de entrega</h2>
          <div className="mt-5 grid gap-4 sm:grid-cols-2">
            <Field label="CEP" value={address.zip_code} onChange={(value) => setAddress((current) => ({ ...current, zip_code: value }))} />
            <Field label="Rua" value={address.street} onChange={(value) => setAddress((current) => ({ ...current, street: value }))} />
            <Field label="Numero" value={address.address_number} onChange={(value) => setAddress((current) => ({ ...current, address_number: value }))} />
            <Field label="Complemento" value={address.complement} onChange={(value) => setAddress((current) => ({ ...current, complement: value }))} />
            <Field label="Bairro" value={address.neighborhood} onChange={(value) => setAddress((current) => ({ ...current, neighborhood: value }))} />
            <Field label="Cidade" value={address.city} onChange={(value) => setAddress((current) => ({ ...current, city: value }))} />
            <Field label="Estado" value={address.state} onChange={(value) => setAddress((current) => ({ ...current, state: value }))} />
          </div>
          <button onClick={saveAddress} disabled={saving} className="mt-5 bg-black px-5 py-3 text-[12px] font-semibold uppercase tracking-[0.16em] text-white hover:bg-neutral-800 disabled:opacity-50">
            {saving ? "Salvando..." : "Salvar endereco"}
          </button>
        </div>

        <div id="compras">
          <h2 className="text-xl font-semibold text-black">Minhas compras</h2>
          <div className="mt-5 grid gap-3">
            {orders.length === 0 ? (
              <div className="border border-dashed border-black/15 px-5 py-10 text-center text-[13px] text-neutral-500">
                Nenhuma compra vinculada a sua conta ainda.
              </div>
            ) : (
              orders.map((order) => (
                <article key={order.id} className="border border-black/10 bg-white p-5">
                  <div className="flex flex-col justify-between gap-2 sm:flex-row">
                    <div>
                      <div className="font-semibold text-black">Pedido #{order.number ?? order.id.slice(0, 8)}</div>
                      <div className="mt-1 text-[12px] text-neutral-500">
                        {new Date(order.created_at).toLocaleDateString("pt-BR")} · {orderStatusLabel(order.status)}
                      </div>
                    </div>
                    <div className="text-[16px] font-semibold text-black">{formatBRL(order.total)}</div>
                  </div>
                  <div className="mt-4 divide-y divide-black/10">
                    {order.order_items.map((item) => (
                      <div key={item.id} className="flex justify-between gap-4 py-2 text-[13px]">
                        <span>{item.quantity}x {item.product_name}{item.variant_name ? ` / ${item.variant_name}` : ""}</span>
                        <span>{formatBRL(item.total_price)}</span>
                      </div>
                    ))}
                  </div>
                  {typeof order.payment_details?.delivery_address === "object" && order.payment_details.delivery_address && (
                    <div className="mt-3 text-[12px] text-neutral-500">Endereco salvo no pedido.</div>
                  )}
                </article>
              ))
            )}
          </div>
        </div>
      </section>

      <section id="favoritos" className="border-t border-black/10 py-10">
        <div className="flex items-end justify-between gap-4">
          <div>
            <h2 className="text-xl font-semibold text-black">Meus favoritos</h2>
            <p className="mt-1 text-[13px] text-neutral-500">Produtos salvos para ver depois.</p>
          </div>
          <Link to="/loja/$slug" params={{ slug: store.slug }} hash="produtos" className="text-[12px] font-medium uppercase tracking-[0.16em] text-neutral-500 hover:text-black">
            Ver catalogo
          </Link>
        </div>
        {favorites.length === 0 ? (
          <div className="mt-6 border border-dashed border-black/15 px-5 py-10 text-center text-[13px] text-neutral-500">
            Nenhum favorito salvo.
          </div>
        ) : (
          <div className="mt-8 grid grid-cols-2 gap-x-4 gap-y-10 md:grid-cols-3 lg:grid-cols-4">
            {favorites.map((product) => <ProductCard key={product.id} product={product} />)}
          </div>
        )}
      </section>
    </div>
  );
}

function Field({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return (
    <label className="grid gap-2">
      <span className="text-[12px] font-medium uppercase tracking-[0.14em] text-neutral-500">{label}</span>
      <input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="h-10 border border-black/10 px-3 text-[14px] outline-none focus:border-black"
      />
    </label>
  );
}
