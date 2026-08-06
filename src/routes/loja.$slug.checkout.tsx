import { createFileRoute, Link } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, MessageCircle } from "lucide-react";
import {
  buildWhatsAppLink,
  cartWhatsAppText,
  clearCart,
  useCart,
  useCartTotals,
} from "@/lib/cart";
import {
  createCustomerOrder,
  EmailConfirmationRequiredError,
  signInCustomer,
  signUpCustomer,
  updateCustomerAddress,
  useStoreCustomer,
  type CustomerAddressForm,
} from "@/lib/customer-account";
import { formatBRL } from "@/lib/products";
import { useStorefront } from "@/lib/storefront-context";

export const Route = createFileRoute("/loja/$slug/checkout")({
  component: CheckoutPage,
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

function CheckoutPage() {
  const store = useStorefront();
  const queryClient = useQueryClient();
  const items = useCart();
  const { subtotal } = useCartTotals();
  const { data: account } = useStoreCustomer(store.id);
  const [mode, setMode] = useState<"guest" | "login" | "signup">("guest");
  const [customer, setCustomer] = useState({
    name: "",
    phone: "",
    email: "",
    password: "",
    notes: "",
  });
  const [address, setAddress] = useState(emptyAddress);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!account) return;
    setMode("guest");
    setCustomer((current) => ({
      ...current,
      name: account.name ?? "",
      phone: account.phone ?? "",
      email: account.email ?? "",
    }));
    setAddress({
      zip_code: account.zip_code ?? "",
      street: account.street ?? "",
      address_number: account.address_number ?? "",
      complement: account.complement ?? "",
      neighborhood: account.neighborhood ?? "",
      city: account.city ?? "",
      state: account.state ?? "",
    });
  }, [account]);

  const addressText = [address.street, address.address_number, address.complement, address.neighborhood, address.city, address.state, address.zip_code]
    .filter(Boolean)
    .join(", ");

  const message = useMemo(() => {
    const customerLines = [
      customer.name ? `Nome: ${customer.name}` : "",
      customer.phone ? `Telefone: ${customer.phone}` : "",
      customer.email ? `E-mail: ${customer.email}` : "",
      addressText ? `Endereco: ${addressText}` : "",
      customer.notes ? `Observacoes: ${customer.notes}` : "",
    ].filter(Boolean);
    const base = cartWhatsAppText(items, subtotal);
    return customerLines.length ? `${base}\n\nDados do cliente:\n${customerLines.join("\n")}` : base;
  }, [addressText, customer, items, subtotal]);

  const authenticate = async () => {
    if (account) return account;
    if (mode === "guest") return null;
    if (mode === "signup") {
      await signUpCustomer({
        storeId: store.id,
        name: customer.name,
        phone: customer.phone,
        email: customer.email,
        password: customer.password,
      });
    } else {
      await signInCustomer(customer.email, customer.password);
    }
    await queryClient.invalidateQueries({ queryKey: ["store-customer", store.id] });
    const fresh = await queryClient.fetchQuery({
      queryKey: ["store-customer", store.id],
      queryFn: async () => {
        const mod = await import("@/lib/customer-account");
        return mod.getStoreCustomer(store.id);
      },
    });
    return fresh;
  };

  const finish = async () => {
    setLoading(true);
    setError("");
    try {
      const authedCustomer = await authenticate();
      if (authedCustomer) {
        const updatedCustomer = await updateCustomerAddress(store.id, authedCustomer, address);
        await createCustomerOrder({
          storeId: store.id,
          customer: updatedCustomer,
          items,
          subtotal,
          notes: customer.notes,
          deliveryAddress: address,
        });
        await queryClient.invalidateQueries({ queryKey: ["customer-orders", store.id] });
      }
      window.open(buildWhatsAppLink(message, store.whatsapp), "_blank", "noopener,noreferrer");
      if (authedCustomer) clearCart();
    } catch (err) {
      if (err instanceof EmailConfirmationRequiredError) {
        setError("Cadastro criado. Confirme seu e-mail antes de entrar e salvar o pedido em Minhas compras.");
        return;
      }
      setError(err instanceof Error ? err.message : "Nao foi possivel finalizar.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-neutral-50">
      <div className="mx-auto max-w-[1120px] px-4 py-8 md:px-8 md:py-12">
        <Link to="/loja/$slug" params={{ slug: store.slug }} className="inline-flex items-center gap-2 text-[12px] font-medium uppercase tracking-[0.16em] text-neutral-500 hover:text-black">
          <ArrowLeft className="h-4 w-4" /> Voltar para loja
        </Link>

        <div className="mt-8 grid gap-6 md:grid-cols-[1fr_420px]">
          <section className="border border-black/10 bg-white p-5 md:p-7">
            <div className="text-[11px] font-medium uppercase tracking-[0.24em] text-neutral-500">Checkout</div>
            <h1 className="mt-2 text-3xl font-semibold tracking-tight text-black">Finalizar compra</h1>

            {!account && (
              <div className="mt-6 grid gap-2 sm:grid-cols-3">
                <Choice active={mode === "guest"} onClick={() => setMode("guest")} title="Visitante" />
                <Choice active={mode === "login"} onClick={() => setMode("login")} title="Entrar" />
                <Choice active={mode === "signup"} onClick={() => setMode("signup")} title="Criar conta" />
              </div>
            )}

            <div className="mt-8 grid gap-4">
              {(mode === "signup" || account) && (
                <>
                  <Field label="Nome" value={customer.name} onChange={(value) => setCustomer((current) => ({ ...current, name: value }))} />
                  <Field label="Telefone" value={customer.phone} onChange={(value) => setCustomer((current) => ({ ...current, phone: value }))} />
                </>
              )}
              {(mode === "login" || mode === "signup" || account) && (
                <Field label="E-mail" value={customer.email} onChange={(value) => setCustomer((current) => ({ ...current, email: value }))} />
              )}
              {(mode === "login" || mode === "signup") && (
                <Field label="Senha" type="password" value={customer.password} onChange={(value) => setCustomer((current) => ({ ...current, password: value }))} />
              )}
              {mode === "guest" && !account && (
                <>
                  <Field label="Nome" value={customer.name} onChange={(value) => setCustomer((current) => ({ ...current, name: value }))} />
                  <Field label="Telefone" value={customer.phone} onChange={(value) => setCustomer((current) => ({ ...current, phone: value }))} />
                </>
              )}

              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="CEP" value={address.zip_code} onChange={(value) => setAddress((current) => ({ ...current, zip_code: value }))} />
                <Field label="Rua" value={address.street} onChange={(value) => setAddress((current) => ({ ...current, street: value }))} />
                <Field label="Numero" value={address.address_number} onChange={(value) => setAddress((current) => ({ ...current, address_number: value }))} />
                <Field label="Complemento" value={address.complement} onChange={(value) => setAddress((current) => ({ ...current, complement: value }))} />
                <Field label="Bairro" value={address.neighborhood} onChange={(value) => setAddress((current) => ({ ...current, neighborhood: value }))} />
                <Field label="Cidade" value={address.city} onChange={(value) => setAddress((current) => ({ ...current, city: value }))} />
                <Field label="Estado" value={address.state} onChange={(value) => setAddress((current) => ({ ...current, state: value }))} />
              </div>
              <label className="grid gap-2">
                <span className="text-[12px] font-medium uppercase tracking-[0.14em] text-neutral-500">Observacoes</span>
                <textarea
                  value={customer.notes}
                  onChange={(event) => setCustomer((current) => ({ ...current, notes: event.target.value }))}
                  rows={4}
                  className="resize-none border border-black/10 bg-white px-3 py-3 text-[14px] outline-none focus:border-black"
                />
              </label>
            </div>
          </section>

          <aside className="border border-black/10 bg-white p-5 md:p-7">
            <div className="text-[11px] font-medium uppercase tracking-[0.24em] text-neutral-500">Resumo</div>
            {items.length === 0 ? (
              <div className="mt-6 text-[13px] text-neutral-500">Seu carrinho esta vazio.</div>
            ) : (
              <div className="mt-6 divide-y divide-black/10">
                {items.map((item) => (
                  <div key={item.key} className="flex gap-3 py-4 first:pt-0">
                    <div className="h-16 w-12 shrink-0 bg-neutral-100">
                      {item.image && <img src={item.image} alt="" className="h-full w-full object-cover" />}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="line-clamp-2 text-[13px] font-medium text-black">{item.name}</div>
                      <div className="mt-1 text-[12px] text-neutral-500">{item.quantity} x {formatBRL(item.price)}</div>
                    </div>
                  </div>
                ))}
              </div>
            )}
            <div className="mt-6 flex items-center justify-between border-t border-black/10 pt-5">
              <span className="text-[12px] uppercase tracking-[0.18em] text-neutral-500">Subtotal</span>
              <span className="text-lg font-semibold text-black">{formatBRL(subtotal)}</span>
            </div>
            {error && <div className="mt-4 border border-red-200 bg-red-50 px-3 py-2 text-[13px] text-red-700">{error}</div>}
            <button
              onClick={finish}
              disabled={loading || items.length === 0}
              className="mt-6 flex w-full items-center justify-center gap-2 bg-black px-5 py-3.5 text-[12px] font-semibold uppercase tracking-[0.16em] text-white hover:bg-neutral-800 disabled:opacity-50"
            >
              <MessageCircle className="h-4 w-4" /> {loading ? "Finalizando..." : "Finalizar pelo WhatsApp"}
            </button>
            <p className="mt-3 text-[12px] leading-relaxed text-neutral-500">
              {account || mode !== "guest"
                ? "O pedido ficara salvo na area Minhas compras."
                : "Como visitante, o pedido sera enviado apenas pelo WhatsApp."}
            </p>
          </aside>
        </div>
      </div>
    </div>
  );
}

function Choice({ active, title, onClick }: { active: boolean; title: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={active ? "border border-black bg-black px-3 py-3 text-[12px] font-semibold uppercase tracking-[0.12em] text-white" : "border border-black/10 px-3 py-3 text-[12px] font-semibold uppercase tracking-[0.12em] text-neutral-600 hover:border-black"}
    >
      {title}
    </button>
  );
}

function Field({ label, value, onChange, type = "text" }: { label: string; value: string; onChange: (value: string) => void; type?: string }) {
  return (
    <label className="grid gap-2">
      <span className="text-[12px] font-medium uppercase tracking-[0.14em] text-neutral-500">{label}</span>
      <input
        type={type}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="h-11 border border-black/10 bg-white px-3 text-[14px] outline-none focus:border-black"
      />
    </label>
  );
}
