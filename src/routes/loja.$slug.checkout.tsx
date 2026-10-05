import { createFileRoute, Link } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { ArrowLeft, MessageCircle } from "lucide-react";
import {
  buildWhatsAppLink,
  clearCart,
  orderWhatsAppText,
  useCart,
  useCartTotals,
} from "@/lib/cart";
import { cepDigits, formatCep, lookupCep } from "@/lib/cep";
import {
  createCustomerOrder,
  EmailConfirmationRequiredError,
  ensureStoreCustomer,
  getCustomerOrder,
  signInCustomer,
  signUpCustomer,
  upsertStoreCustomer,
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

// Compra só com conta (D17): o pedido sempre é gravado (create_store_order) e a mensagem do
// WhatsApp é montada a partir do pedido gravado, com os preços do banco.
function CheckoutPage() {
  const store = useStorefront();
  const queryClient = useQueryClient();
  const items = useCart();
  const { subtotal } = useCartTotals();
  const { data: account } = useStoreCustomer(store.id);
  const [mode, setMode] = useState<"login" | "signup">("signup");
  const [customer, setCustomer] = useState({
    name: "",
    phone: "",
    email: "",
    password: "",
    notes: "",
  });
  const [address, setAddress] = useState(emptyAddress);
  const [cepStatus, setCepStatus] = useState<"idle" | "loading" | "not_found" | "failed">("idle");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!account) return;
    setCustomer((current) => ({
      ...current,
      name: account.name ?? "",
      phone: account.phone ?? "",
      email: account.email ?? "",
    }));
    setAddress({
      zip_code: formatCep(account.zip_code ?? ""),
      street: account.street ?? "",
      address_number: account.address_number ?? "",
      complement: account.complement ?? "",
      neighborhood: account.neighborhood ?? "",
      city: account.city ?? "",
      state: account.state ?? "",
    });
  }, [account]);

  const changeCep = async (value: string) => {
    const formatted = formatCep(value);
    setAddress((current) => ({ ...current, zip_code: formatted }));
    if (cepDigits(formatted).length !== 8) {
      setCepStatus("idle");
      return;
    }
    setCepStatus("loading");
    try {
      const found = await lookupCep(formatted);
      if (!found) {
        setCepStatus("not_found");
        return;
      }
      setAddress((current) =>
        cepDigits(current.zip_code) === cepDigits(formatted)
          ? {
              ...current,
              street: found.street || current.street,
              neighborhood: found.neighborhood || current.neighborhood,
              city: found.city || current.city,
              state: found.state || current.state,
            }
          : current,
      );
      setCepStatus("idle");
    } catch {
      setCepStatus("failed");
    }
  };

  const showProfileFields = mode === "signup" || !!account;

  const missingField = () => {
    if (showProfileFields && !customer.name.trim()) return "Informe seu nome.";
    if (showProfileFields && !customer.phone.trim()) return "Informe seu telefone.";
    if (!account && !customer.email.trim()) return "Informe seu e-mail.";
    if (!account && !customer.password) return "Informe sua senha.";
    if (cepDigits(address.zip_code).length !== 8) return "Informe um CEP valido.";
    if (!address.street.trim()) return "Informe a rua.";
    if (!address.address_number.trim()) return "Informe o numero.";
    if (!address.neighborhood.trim()) return "Informe o bairro.";
    if (!address.city.trim()) return "Informe a cidade.";
    if (!address.state.trim()) return "Informe o estado.";
    return "";
  };

  const authenticate = async () => {
    if (account) return account;
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
    return ensureStoreCustomer(store.id);
  };

  const finish = async () => {
    const missing = missingField();
    if (missing) {
      setError(missing);
      return;
    }
    setLoading(true);
    setError("");
    // A aba do WhatsApp é aberta já no clique: aberta depois das chamadas ao banco, o navegador
    // costuma bloquear como pop-up.
    const whatsappTab = window.open("", "_blank");
    try {
      const authed = await authenticate();
      await upsertStoreCustomer(store.id, {
        name: showProfileFields ? customer.name : authed.name,
        phone: showProfileFields ? customer.phone : authed.phone,
        email: authed.email,
        ...address,
        zip_code: cepDigits(address.zip_code),
      });
      const orderId = await createCustomerOrder({
        storeId: store.id,
        items,
        notes: customer.notes,
        deliveryAddress: { ...address, zip_code: cepDigits(address.zip_code) },
      });
      // Pedido gravado: o carrinho sai já, para um novo clique não duplicar o pedido.
      clearCart();
      void queryClient.invalidateQueries({ queryKey: ["store-customer", store.id] });
      void queryClient.invalidateQueries({ queryKey: ["customer-orders", store.id] });
      const text = await getCustomerOrder(orderId)
        .then(orderWhatsAppText)
        .catch(() => "Olá! Acabei de fazer um pedido pela loja online. Está em Minhas compras.");
      const link = buildWhatsAppLink(text, store.whatsapp);
      if (whatsappTab) {
        whatsappTab.opener = null;
        whatsappTab.location.href = link;
      } else {
        window.location.href = link;
      }
    } catch (err) {
      whatsappTab?.close();
      if (err instanceof EmailConfirmationRequiredError) {
        setError(
          "Cadastro criado. Confirme seu e-mail, depois entre com sua senha para finalizar o pedido.",
        );
        setMode("login");
        setCustomer((current) => ({ ...current, password: "" }));
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
        <Link
          to="/loja/$slug"
          params={{ slug: store.slug }}
          className="inline-flex items-center gap-2 text-[12px] font-medium uppercase tracking-[0.16em] text-neutral-500 hover:text-black"
        >
          <ArrowLeft className="h-4 w-4" /> Voltar para loja
        </Link>

        <div className="mt-8 grid gap-6 md:grid-cols-[1fr_420px]">
          <section className="border border-black/10 bg-white p-5 md:p-7">
            <div className="text-[11px] font-medium uppercase tracking-[0.24em] text-neutral-500">
              Checkout
            </div>
            <h1 className="mt-2 text-3xl font-semibold tracking-tight text-black">
              Finalizar compra
            </h1>

            {!account && (
              <>
                <p className="mt-4 text-[13px] leading-relaxed text-neutral-500">
                  Para finalizar, entre ou crie sua conta. Seu pedido fica salvo em Minhas compras.
                </p>
                <div className="mt-4 grid gap-2 sm:grid-cols-2">
                  <Choice
                    active={mode === "signup"}
                    onClick={() => setMode("signup")}
                    title="Criar conta"
                  />
                  <Choice
                    active={mode === "login"}
                    onClick={() => setMode("login")}
                    title="Ja tenho conta"
                  />
                </div>
              </>
            )}

            <div className="mt-8 grid gap-4">
              {showProfileFields && (
                <>
                  <Field
                    label="Nome"
                    value={customer.name}
                    onChange={(value) => setCustomer((current) => ({ ...current, name: value }))}
                  />
                  <Field
                    label="Telefone"
                    type="tel"
                    value={customer.phone}
                    onChange={(value) => setCustomer((current) => ({ ...current, phone: value }))}
                  />
                </>
              )}
              <Field
                label="E-mail"
                type="email"
                value={customer.email}
                disabled={!!account}
                onChange={(value) => setCustomer((current) => ({ ...current, email: value }))}
              />
              {!account && (
                <Field
                  label="Senha"
                  type="password"
                  value={customer.password}
                  onChange={(value) => setCustomer((current) => ({ ...current, password: value }))}
                />
              )}

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="grid gap-1">
                  <Field
                    label="CEP"
                    inputMode="numeric"
                    value={address.zip_code}
                    onChange={changeCep}
                  />
                  {cepStatus === "loading" && (
                    <span className="text-[12px] text-neutral-500">Buscando endereco...</span>
                  )}
                  {cepStatus === "not_found" && (
                    <span className="text-[12px] text-red-600">
                      CEP nao encontrado. Preencha o endereco.
                    </span>
                  )}
                  {cepStatus === "failed" && (
                    <span className="text-[12px] text-neutral-500">
                      Nao foi possivel buscar o CEP. Preencha o endereco.
                    </span>
                  )}
                </div>
                <Field
                  label="Rua"
                  value={address.street}
                  onChange={(value) => setAddress((current) => ({ ...current, street: value }))}
                />
                <Field
                  label="Numero"
                  value={address.address_number}
                  onChange={(value) =>
                    setAddress((current) => ({ ...current, address_number: value }))
                  }
                />
                <Field
                  label="Complemento"
                  value={address.complement}
                  onChange={(value) => setAddress((current) => ({ ...current, complement: value }))}
                />
                <Field
                  label="Bairro"
                  value={address.neighborhood}
                  onChange={(value) =>
                    setAddress((current) => ({ ...current, neighborhood: value }))
                  }
                />
                <Field
                  label="Cidade"
                  value={address.city}
                  onChange={(value) => setAddress((current) => ({ ...current, city: value }))}
                />
                <Field
                  label="Estado"
                  value={address.state}
                  onChange={(value) =>
                    setAddress((current) => ({
                      ...current,
                      state: value.toUpperCase().slice(0, 2),
                    }))
                  }
                />
              </div>
              <label className="grid gap-2">
                <span className="text-[12px] font-medium uppercase tracking-[0.14em] text-neutral-500">
                  Observacoes
                </span>
                <textarea
                  value={customer.notes}
                  onChange={(event) =>
                    setCustomer((current) => ({ ...current, notes: event.target.value }))
                  }
                  rows={4}
                  className="resize-none border border-black/10 bg-white px-3 py-3 text-[14px] outline-none focus:border-black"
                />
              </label>
            </div>
          </section>

          <aside className="border border-black/10 bg-white p-5 md:p-7">
            <div className="text-[11px] font-medium uppercase tracking-[0.24em] text-neutral-500">
              Resumo
            </div>
            {items.length === 0 ? (
              <div className="mt-6 text-[13px] text-neutral-500">Seu carrinho esta vazio.</div>
            ) : (
              <div className="mt-6 divide-y divide-black/10">
                {items.map((item) => (
                  <div key={item.key} className="flex gap-3 py-4 first:pt-0">
                    <div className="h-16 w-12 shrink-0 bg-neutral-100">
                      {item.image && (
                        <img src={item.image} alt="" className="h-full w-full object-cover" />
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="line-clamp-2 text-[13px] font-medium text-black">
                        {item.name}
                      </div>
                      <div className="mt-1 text-[12px] text-neutral-500">
                        {item.quantity} x {formatBRL(item.price)}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
            <div className="mt-6 flex items-center justify-between border-t border-black/10 pt-5">
              <span className="text-[12px] uppercase tracking-[0.18em] text-neutral-500">
                Subtotal
              </span>
              <span className="text-lg font-semibold text-black">{formatBRL(subtotal)}</span>
            </div>
            {error && (
              <div className="mt-4 border border-red-200 bg-red-50 px-3 py-2 text-[13px] text-red-700">
                {error}
              </div>
            )}
            <button
              onClick={finish}
              disabled={loading || items.length === 0}
              className="mt-6 flex w-full items-center justify-center gap-2 bg-black px-5 py-3.5 text-[12px] font-semibold uppercase tracking-[0.16em] text-white hover:bg-neutral-800 disabled:opacity-50"
            >
              <MessageCircle className="h-4 w-4" />{" "}
              {loading ? "Finalizando..." : "Finalizar pelo WhatsApp"}
            </button>
            <p className="mt-3 text-[12px] leading-relaxed text-neutral-500">
              O pedido fica salvo em Minhas compras e o WhatsApp da loja abre com o resumo. Valores
              finais conferidos pela loja.
            </p>
          </aside>
        </div>
      </div>
    </div>
  );
}

function Choice({
  active,
  title,
  onClick,
}: {
  active: boolean;
  title: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={
        active
          ? "border border-black bg-black px-3 py-3 text-[12px] font-semibold uppercase tracking-[0.12em] text-white"
          : "border border-black/10 px-3 py-3 text-[12px] font-semibold uppercase tracking-[0.12em] text-neutral-600 hover:border-black"
      }
    >
      {title}
    </button>
  );
}

function Field({
  label,
  value,
  onChange,
  type = "text",
  inputMode,
  disabled,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
  inputMode?: "numeric" | "text";
  disabled?: boolean;
}) {
  return (
    <label className="grid gap-2">
      <span className="text-[12px] font-medium uppercase tracking-[0.14em] text-neutral-500">
        {label}
      </span>
      <input
        type={type}
        inputMode={inputMode}
        value={value}
        disabled={disabled}
        onChange={(event) => onChange(event.target.value)}
        className="h-11 border border-black/10 bg-white px-3 text-[14px] outline-none focus:border-black disabled:bg-neutral-50 disabled:text-neutral-500"
      />
    </label>
  );
}
