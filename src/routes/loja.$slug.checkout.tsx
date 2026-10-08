/* eslint-disable @typescript-eslint/no-explicit-any -- store_checkout_settings ainda fora do types.ts gerado */
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, Check, CreditCard, Loader2, MapPin, Store, Truck } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { clearCart, useCart, useCartTotals } from "@/lib/cart";
import { formatPhone, isValidPhone, onlyDigits } from "@/lib/br-documents";
import { cepDigits, formatCep } from "@/lib/cep";
import {
  getCheckoutOptions,
  placeCheckoutOrder,
  type DeliveryOption,
  type ZipAddress,
} from "@/lib/checkout.functions";
import { startOrderPayment } from "@/lib/order-payment.functions";
import {
  EmailConfirmationRequiredError,
  getStoreCustomer,
  signInCustomer,
  signOutCustomer,
  signUpCustomer,
  upsertStoreCustomer,
  useStoreCustomer,
} from "@/lib/customer-account";
import { deliveryDaysLabel, formatDeliveryAddress } from "@/lib/orders";
import { formatBRL } from "@/lib/products";
import { useStorefront } from "@/lib/storefront-context";

export const Route = createFileRoute("/loja/$slug/checkout")({
  component: CheckoutPage,
});

const STEPS = ["Identificação", "Entrega", "Pagamento", "Revisão"] as const;
type Step = 1 | 2 | 3 | 4;

const optionKey = (option: Pick<DeliveryOption, "method" | "service_id">) =>
  `${option.method}:${option.service_id ?? ""}`;

// Checkout em etapas (lote C): identificação -> entrega -> pagamento -> revisão -> "Pedido #N".
// Opções de entrega e pedido sempre pelo servidor (checkout.functions.ts): a cidade vem do CEP e o
// frete é recalculado no "Finalizar". Venda só com pagamento integrado (Mercado Pago no lote E); o
// WhatsApp vira contato depois do pagamento, na página do pedido.
function CheckoutPage() {
  const store = useStorefront();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const items = useCart();
  const { subtotal: cartSubtotal } = useCartTotals();
  const { data: account, isLoading: accountLoading } = useStoreCustomer(store.id);
  const fetchOptions = useServerFn(getCheckoutOptions);
  const placeOrder = useServerFn(placeCheckoutOrder);
  const startPayment = useServerFn(startOrderPayment);

  const [step, setStep] = useState<Step>(1);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  // Etapa 1
  const [mode, setMode] = useState<"login" | "signup">("signup");
  const [form, setForm] = useState({ name: "", phone: "", email: "", password: "" });
  const [needsProfile, setNeedsProfile] = useState(false);

  // Etapa 2
  const [zip, setZip] = useState("");
  const [quote, setQuote] = useState<{
    zip: string;
    itemsKey: string;
    address: ZipAddress;
    subtotal: number;
    options: DeliveryOption[];
    shippingUnavailable: boolean;
  } | null>(null);
  const [choice, setChoice] = useState<string>("");
  const [street, setStreet] = useState({
    street: "",
    address_number: "",
    complement: "",
    neighborhood: "",
  });
  const [notes, setNotes] = useState("");

  const cartItems = useMemo(
    () =>
      items.map((item) => ({
        product_id: item.productId,
        variant_id: item.variantId,
        quantity: item.quantity,
      })),
    [items],
  );
  const itemsKey = JSON.stringify(cartItems);

  const { data: pickup } = useQuery({
    queryKey: ["checkout-pickup", store.id],
    queryFn: async () => {
      const { data } = await (supabase as any)
        .from("store_checkout_settings")
        .select("pickup_address,pickup_instructions")
        .eq("store_id", store.id)
        .maybeSingle();
      return (data ?? null) as {
        pickup_address: string | null;
        pickup_instructions: string | null;
      } | null;
    },
  });
  const storeAddress = [
    [store.address, store.address_number].filter(Boolean).join(", "),
    store.complement,
    [store.city, store.state].filter(Boolean).join("/"),
  ]
    .filter(Boolean)
    .join(" · ");

  // Cliente já logado nesta loja: pula a identificação e traz o endereço salvo.
  useEffect(() => {
    if (!account) return;
    setStep((current) => (current === 1 ? 2 : current));
    setZip((current) => current || formatCep(account.zip_code ?? ""));
    setStreet((current) =>
      current.street || current.address_number
        ? current
        : {
            street: account.street ?? "",
            address_number: account.address_number ?? "",
            complement: account.complement ?? "",
            neighborhood: account.neighborhood ?? "",
          },
    );
  }, [account]);

  // Opções valem para o CEP e o carrinho do cálculo; mudou um dos dois, calcula de novo.
  const validQuote =
    quote && quote.zip === cepDigits(zip) && quote.itemsKey === itemsKey ? quote : null;
  const chosen = validQuote?.options.find((option) => optionKey(option) === choice) ?? null;
  const isPickup = chosen?.method === "pickup";
  const subtotal = validQuote?.subtotal ?? cartSubtotal;
  const total = subtotal + (chosen?.price ?? 0);

  const calculate = async (value = zip) => {
    const digits = cepDigits(value);
    if (digits.length !== 8) {
      setError("Informe um CEP válido.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      const result = await fetchOptions({
        data: { store_id: store.id, zip: digits, items: cartItems },
      });
      setQuote({ zip: digits, itemsKey, ...result });
      setChoice((current) =>
        result.options.some((option) => optionKey(option) === current) ? current : "",
      );
      // Endereço do CEP preenche o que estiver vazio (ou de outro CEP).
      setStreet((current) => {
        const sameZip = cepDigits(account?.zip_code ?? "") === digits;
        return {
          street: (sameZip && current.street) || result.address.street || current.street,
          neighborhood:
            (sameZip && current.neighborhood) ||
            result.address.neighborhood ||
            current.neighborhood,
          address_number: sameZip ? current.address_number : "",
          complement: sameZip ? current.complement : "",
        };
      });
      if (result.options.length === 0) {
        setError("Não há forma de entrega disponível para este CEP. Fale com a loja.");
      }
    } catch (err) {
      setQuote(null);
      setError(err instanceof Error ? err.message : "Não foi possível calcular a entrega.");
    } finally {
      setBusy(false);
    }
  };

  // Troca de etapa volta ao topo (o indicador de etapas fica visível).
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, [step]);

  // Ao chegar na etapa 2 com CEP salvo, já calcula.
  useEffect(() => {
    if (step === 2 && !validQuote && cepDigits(zip).length === 8 && items.length > 0 && !busy) {
      void calculate(zip);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step, itemsKey]);

  const identify = async () => {
    const showProfile = mode === "signup" || needsProfile;
    if (showProfile && !form.name.trim()) return setError("Informe seu nome.");
    if (showProfile && !isValidPhone(form.phone)) return setError("Informe seu telefone com DDD.");
    if (!form.email.trim()) return setError("Informe seu e-mail.");
    if (!form.password) return setError("Informe sua senha.");
    setBusy(true);
    setError("");
    try {
      if (mode === "signup" && !needsProfile) {
        await signUpCustomer({ storeId: store.id, ...form });
      } else if (!needsProfile) {
        await signInCustomer(form.email, form.password);
      }
      let existing = await getStoreCustomer(store.id);
      if (!existing) {
        if (!needsProfile) {
          setNeedsProfile(true);
          throw new Error(
            "Primeira compra nesta loja: informe seu nome e telefone para continuar.",
          );
        }
        existing = await upsertStoreCustomer(store.id, {
          name: form.name,
          phone: form.phone,
          email: form.email,
        });
      }
      await queryClient.invalidateQueries({ queryKey: ["store-customer", store.id] });
      setStep(2);
    } catch (err) {
      if (err instanceof EmailConfirmationRequiredError) {
        setError(
          "Cadastro criado. Confirme seu e-mail e depois entre com sua senha para continuar.",
        );
        setMode("login");
        setForm((current) => ({ ...current, password: "" }));
        return;
      }
      setError(err instanceof Error ? err.message : "Não foi possível entrar.");
    } finally {
      setBusy(false);
    }
  };

  const signOut = async () => {
    await signOutCustomer();
    await queryClient.invalidateQueries({ queryKey: ["store-customer", store.id] });
    setQuote(null);
    setChoice("");
    setZip("");
    setStreet({ street: "", address_number: "", complement: "", neighborhood: "" });
    setStep(1);
  };

  const deliveryReady = () => {
    if (!validQuote) return "Calcule a entrega pelo CEP.";
    if (!chosen) return "Escolha a forma de entrega.";
    if (!isPickup) {
      if (!street.street.trim()) return "Informe a rua.";
      if (!street.address_number.trim()) return "Informe o número.";
      if (!street.neighborhood.trim()) return "Informe o bairro.";
    }
    return "";
  };

  const goTo = (target: Step) => {
    if (target >= 2 && !account) return setError("Entre ou crie sua conta para continuar.");
    if (target >= 3) {
      const missing = deliveryReady();
      if (missing) {
        setStep(2);
        return setError(missing);
      }
    }
    setError("");
    setStep(target);
  };

  const finish = async () => {
    const missing = deliveryReady();
    if (missing || !chosen || !validQuote || !account) {
      setStep(2);
      setError(missing || "Confira a entrega.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      const { orderId } = await placeOrder({
        data: {
          store_id: store.id,
          items: cartItems,
          delivery: { method: chosen.method, service_id: chosen.service_id },
          expected_shipping: chosen.price,
          zip: isPickup ? undefined : validQuote.zip,
          address: isPickup ? undefined : street,
          notes: notes.trim() || undefined,
        },
      });
      // Pedido gravado: o carrinho sai já, para um novo clique não duplicar o pedido.
      clearCart();
      if (!isPickup) {
        // Endereço usado vira o endereço salvo da conta (cidade/UF do CEP).
        void upsertStoreCustomer(store.id, {
          name: account.name,
          phone: account.phone,
          email: account.email,
          zip_code: validQuote.zip,
          ...street,
          city: validQuote.address.city,
          state: validQuote.address.state,
        }).catch(() => undefined);
      }
      void queryClient.invalidateQueries({ queryKey: ["store-customer", store.id] });
      void queryClient.invalidateQueries({ queryKey: ["customer-orders", store.id] });
      // Pedido gravado: vai pagar na página do Mercado Pago. Se a cobrança não abrir, a página do
      // pedido tem o botão "Pagar agora" para tentar de novo.
      try {
        const { url } = await startPayment({
          data: { order_id: orderId, return_origin: window.location.origin },
        });
        window.location.assign(url);
        return;
      } catch {
        await navigate({
          to: "/loja/$slug/pedido/$id",
          params: { slug: store.slug, id: orderId },
        });
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "Não foi possível finalizar.";
      setError(message);
      // Frete mudou ou opção saiu: volta para a entrega com a conta refeita.
      if (/frete mudou|não está mais disponível|não está disponível/i.test(message)) {
        setStep(2);
        void calculate(validQuote.zip);
      }
    } finally {
      setBusy(false);
    }
  };

  if (items.length === 0) {
    return (
      <div className="mx-auto max-w-[720px] px-4 py-16 text-center">
        <p className="text-[14px] text-neutral-600">Seu carrinho está vazio.</p>
        <Link
          to="/loja/$slug"
          params={{ slug: store.slug }}
          className="mt-6 inline-block bg-black px-5 py-3 text-[12px] font-semibold uppercase tracking-[0.16em] text-white"
        >
          Ver produtos
        </Link>
      </div>
    );
  }

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

        <ol className="mt-6 flex flex-wrap gap-x-5 gap-y-2" aria-label="Etapas">
          {STEPS.map((label, index) => {
            const n = (index + 1) as Step;
            const done = n < step;
            return (
              <li key={label}>
                <button
                  type="button"
                  disabled={n > step || busy}
                  onClick={() => goTo(n)}
                  className={`flex items-center gap-2 text-[12px] font-medium uppercase tracking-[0.12em] ${
                    n === step
                      ? "text-black"
                      : done
                        ? "text-neutral-600 hover:text-black"
                        : "text-neutral-400"
                  }`}
                >
                  <span
                    className={`grid h-6 w-6 place-items-center rounded-full text-[11px] ${
                      n === step
                        ? "bg-black text-white"
                        : done
                          ? "bg-neutral-200 text-black"
                          : "border border-neutral-300"
                    }`}
                  >
                    {done ? <Check className="h-3.5 w-3.5" /> : n}
                  </span>
                  {label}
                </button>
              </li>
            );
          })}
        </ol>

        <div className="mt-6 grid gap-6 md:grid-cols-[minmax(0,1fr)_340px] lg:grid-cols-[minmax(0,1fr)_380px]">
          <section className="min-w-0 border border-black/10 bg-white p-5 md:p-7">
            {step === 1 && (
              <StepTitle n={1} title="Identificação">
                {accountLoading ? (
                  <p className="mt-4 text-[13px] text-neutral-500">Carregando...</p>
                ) : account ? (
                  <div className="mt-4 text-[14px] text-black">
                    Olá, {account.name}.{" "}
                    <button type="button" onClick={signOut} className="text-neutral-500 underline">
                      Não é você? Sair
                    </button>
                  </div>
                ) : (
                  <>
                    <p className="mt-3 text-[13px] leading-relaxed text-neutral-500">
                      Entre ou crie sua conta. Seu pedido fica salvo em Minhas compras.
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
                        title="Já tenho conta"
                      />
                    </div>
                    <div className="mt-6 grid gap-4">
                      {(mode === "signup" || needsProfile) && (
                        <>
                          <Field
                            label="Nome"
                            value={form.name}
                            onChange={(v) => setForm((c) => ({ ...c, name: v }))}
                          />
                          <Field
                            label="Telefone"
                            type="tel"
                            value={formatPhone(form.phone)}
                            onChange={(v) => setForm((c) => ({ ...c, phone: onlyDigits(v).slice(0, 11) }))}
                          />
                        </>
                      )}
                      <Field
                        label="E-mail"
                        type="email"
                        value={form.email}
                        disabled={needsProfile}
                        onChange={(v) => setForm((c) => ({ ...c, email: v }))}
                      />
                      {!needsProfile && (
                        <Field
                          label="Senha"
                          type="password"
                          value={form.password}
                          onChange={(v) => setForm((c) => ({ ...c, password: v }))}
                        />
                      )}
                    </div>
                  </>
                )}
                <PrimaryButton
                  busy={busy}
                  onClick={() => (account ? goTo(2) : identify())}
                  label={
                    account
                      ? "Continuar"
                      : mode === "signup" && !needsProfile
                        ? "Criar conta e continuar"
                        : "Continuar"
                  }
                />
              </StepTitle>
            )}

            {step === 2 && (
              <StepTitle n={2} title="Entrega">
                <div className="mt-4 flex items-end gap-3">
                  <div className="w-40 min-w-0 shrink">
                    <Field
                      label="CEP"
                      inputMode="numeric"
                      value={zip}
                      onChange={(v) => setZip(formatCep(v))}
                      onEnter={() => calculate()}
                    />
                  </div>
                  <button
                    type="button"
                    onClick={() => calculate()}
                    disabled={busy}
                    className="h-11 shrink-0 border border-black px-4 text-[12px] font-semibold uppercase tracking-[0.12em] hover:bg-black hover:text-white disabled:opacity-50"
                  >
                    {busy && !validQuote ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      "Calcular"
                    )}
                  </button>
                </div>

                {validQuote && (
                  <>
                    <div className="mt-3 text-[13px] text-neutral-600">
                      <MapPin className="mr-1 inline h-3.5 w-3.5" />
                      {validQuote.address.city}/{validQuote.address.state}
                    </div>
                    <div
                      className="mt-4 grid gap-2"
                      role="radiogroup"
                      aria-label="Formas de entrega"
                    >
                      {validQuote.options.map((option) => (
                        <OptionCard
                          key={optionKey(option)}
                          option={option}
                          selected={choice === optionKey(option)}
                          onSelect={() => {
                            setChoice(optionKey(option));
                            setError("");
                          }}
                        />
                      ))}
                    </div>
                    {validQuote.shippingUnavailable && (
                      <p className="mt-2 text-[12px] text-neutral-500">
                        Correios/transportadoras indisponíveis no momento. Tente calcular de novo em
                        instantes.
                      </p>
                    )}
                  </>
                )}

                {chosen && !isPickup && (
                  <div className="mt-6 grid gap-4 sm:grid-cols-2">
                    <Field
                      label="Rua"
                      value={street.street}
                      onChange={(v) => setStreet((c) => ({ ...c, street: v }))}
                    />
                    <Field
                      label="Número"
                      value={street.address_number}
                      onChange={(v) => setStreet((c) => ({ ...c, address_number: v }))}
                    />
                    <Field
                      label="Complemento"
                      value={street.complement}
                      onChange={(v) => setStreet((c) => ({ ...c, complement: v }))}
                    />
                    <Field
                      label="Bairro"
                      value={street.neighborhood}
                      onChange={(v) => setStreet((c) => ({ ...c, neighborhood: v }))}
                    />
                  </div>
                )}

                {chosen && isPickup && (
                  <div className="mt-6 border border-black/10 bg-neutral-50 px-4 py-3 text-[13px] text-neutral-700">
                    <div className="font-medium text-black">Retirar em</div>
                    <div className="mt-1">
                      {pickup?.pickup_address || storeAddress || "Endereço informado pela loja."}
                    </div>
                    {pickup?.pickup_instructions && (
                      <div className="mt-2 whitespace-pre-line text-neutral-500">
                        {pickup.pickup_instructions}
                      </div>
                    )}
                  </div>
                )}

                <PrimaryButton
                  busy={busy}
                  onClick={() => goTo(3)}
                  label="Continuar para pagamento"
                />
              </StepTitle>
            )}

            {step === 3 && (
              <StepTitle n={3} title="Pagamento">
                <div className="mt-4 flex flex-wrap gap-2 text-[12px] font-medium text-neutral-700">
                  {["Pix", "Cartão de crédito"].map((label) => (
                    <span key={label} className="border border-black/10 px-3 py-2">
                      <CreditCard className="mr-1.5 inline h-3.5 w-3.5" />
                      {label}
                    </span>
                  ))}
                </div>
                <p className="mt-4 text-[13px] leading-relaxed text-neutral-600">
                  Você escolhe a forma e paga na página segura do Mercado Pago, depois de revisar o
                  pedido.
                </p>
                <PrimaryButton busy={busy} onClick={() => goTo(4)} label="Revisar pedido" />
              </StepTitle>
            )}

            {step === 4 && chosen && validQuote && (
              <StepTitle n={4} title="Revisão">
                <div className="mt-4 divide-y divide-black/10 text-[13px]">
                  {items.map((item) => (
                    <div key={item.key} className="flex justify-between gap-4 py-2">
                      <span>
                        {item.quantity}x {item.name}
                        {item.variantLabel ? ` / ${item.variantLabel}` : ""}
                      </span>
                      <span>{formatBRL(item.price * item.quantity)}</span>
                    </div>
                  ))}
                </div>
                <div className="mt-5 grid gap-3 border-t border-black/10 pt-4 text-[13px]">
                  <ReviewLine label="Entrega" onEdit={() => goTo(2)}>
                    {chosen.name} · {chosen.price > 0 ? formatBRL(chosen.price) : "Grátis"}
                    {deliveryDaysLabel(chosen.min_days, chosen.max_days)
                      ? ` · ${deliveryDaysLabel(chosen.min_days, chosen.max_days)}`
                      : ""}
                  </ReviewLine>
                  <ReviewLine label={isPickup ? "Retirada" : "Endereço"} onEdit={() => goTo(2)}>
                    {isPickup
                      ? pickup?.pickup_address || storeAddress || "Endereço informado pela loja."
                      : formatDeliveryAddress({ ...validQuote.address, ...street })}
                  </ReviewLine>
                  <ReviewLine label="Pagamento" onEdit={() => goTo(3)}>
                    Mercado Pago (Pix ou cartão)
                  </ReviewLine>
                </div>
                <label className="mt-5 grid gap-2">
                  <span className="text-[12px] font-medium uppercase tracking-[0.14em] text-neutral-500">
                    Observações
                  </span>
                  <textarea
                    value={notes}
                    onChange={(event) => setNotes(event.target.value)}
                    rows={3}
                    maxLength={1000}
                    className="w-full min-w-0 resize-none border border-black/10 bg-white px-3 py-3 text-[14px] outline-none focus:border-black"
                  />
                </label>
                <PrimaryButton busy={busy} onClick={finish} label="Finalizar e pagar" />
              </StepTitle>
            )}

            {error && (
              <div
                className="mt-4 border border-red-200 bg-red-50 px-3 py-2 text-[13px] text-red-700"
                role="alert"
              >
                {error}
              </div>
            )}
          </section>

          <aside className="order-first border border-black/10 bg-white p-5 md:order-none md:self-start md:p-7">
            <details className="group md:hidden">
              <summary className="flex cursor-pointer list-none items-center justify-between text-[13px]">
                <span className="text-neutral-500">
                  Resumo ({items.length} {items.length === 1 ? "item" : "itens"})
                </span>
                <span className="text-[16px] font-semibold text-black">{formatBRL(total)}</span>
              </summary>
              <div className="mt-4">
                <Summary items={items} subtotal={subtotal} chosen={chosen} total={total} />
              </div>
            </details>
            <div className="hidden md:block">
              <div className="text-[11px] font-medium uppercase tracking-[0.24em] text-neutral-500">
                Resumo
              </div>
              <div className="mt-6">
                <Summary items={items} subtotal={subtotal} chosen={chosen} total={total} />
              </div>
            </div>
          </aside>
        </div>
      </div>
    </div>
  );
}

function Summary({
  items,
  subtotal,
  chosen,
  total,
}: {
  items: ReturnType<typeof useCart>;
  subtotal: number;
  chosen: DeliveryOption | null;
  total: number;
}) {
  return (
    <>
      <div className="divide-y divide-black/10">
        {items.map((item) => (
          <div key={item.key} className="flex gap-3 py-3 first:pt-0">
            <div className="h-14 w-11 shrink-0 bg-neutral-100">
              {item.image && <img src={item.image} alt="" className="h-full w-full object-cover" />}
            </div>
            <div className="min-w-0 flex-1">
              <div className="line-clamp-2 text-[13px] font-medium text-black">{item.name}</div>
              {item.variantLabel && (
                <div className="text-[12px] text-neutral-500">{item.variantLabel}</div>
              )}
              <div className="mt-0.5 text-[12px] text-neutral-500">
                {item.quantity} x {formatBRL(item.price)}
              </div>
            </div>
          </div>
        ))}
      </div>
      <div className="mt-4 space-y-1.5 border-t border-black/10 pt-4 text-[13px] text-neutral-600">
        <div className="flex justify-between">
          <span>Produtos</span>
          <span>{formatBRL(subtotal)}</span>
        </div>
        <div className="flex justify-between">
          <span>Frete</span>
          <span>{chosen ? (chosen.price > 0 ? formatBRL(chosen.price) : "Grátis") : "—"}</span>
        </div>
        <div className="flex justify-between pt-2 text-[16px] font-semibold text-black">
          <span>Total</span>
          <span>{formatBRL(total)}</span>
        </div>
      </div>
    </>
  );
}

function OptionCard({
  option,
  selected,
  onSelect,
}: {
  option: DeliveryOption;
  selected: boolean;
  onSelect: () => void;
}) {
  const Icon = option.method === "pickup" ? Store : option.method === "local" ? MapPin : Truck;
  const days = deliveryDaysLabel(option.min_days, option.max_days);
  return (
    <button
      type="button"
      role="radio"
      aria-checked={selected}
      onClick={onSelect}
      className={`flex items-center gap-3 border px-4 py-3 text-left ${
        selected ? "border-black bg-neutral-50" : "border-black/10 hover:border-black/40"
      }`}
    >
      <span
        className={`grid h-4 w-4 shrink-0 place-items-center rounded-full border ${selected ? "border-black" : "border-neutral-400"}`}
      >
        {selected && <span className="h-2 w-2 rounded-full bg-black" />}
      </span>
      <Icon className="h-4 w-4 shrink-0 text-neutral-500" />
      <span className="min-w-0 flex-1">
        <span className="block text-[13px] font-medium text-black">{option.name}</span>
        <span className="block text-[12px] text-neutral-500">
          {option.method === "pickup" ? "Retire na loja" : days ? `Chega em ${days}` : ""}
        </span>
      </span>
      <span className="text-right text-[13px] font-semibold text-black">
        {option.free ? (
          <>
            <span className="block text-emerald-700">Grátis</span>
            <span className="block text-[11px] font-normal text-neutral-400 line-through">
              {formatBRL(option.original_price)}
            </span>
          </>
        ) : option.price > 0 ? (
          formatBRL(option.price)
        ) : (
          "Grátis"
        )}
      </span>
    </button>
  );
}

function StepTitle({
  n,
  title,
  children,
}: {
  n: number;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <div className="text-[11px] font-medium uppercase tracking-[0.24em] text-neutral-500">
        Etapa {n} de 4
      </div>
      <h1 className="mt-2 text-2xl font-semibold tracking-tight text-black">{title}</h1>
      {children}
    </div>
  );
}

function ReviewLine({
  label,
  onEdit,
  children,
}: {
  label: string;
  onEdit: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-start justify-between gap-4">
      <div>
        <div className="text-[11px] font-medium uppercase tracking-[0.18em] text-neutral-500">
          {label}
        </div>
        <div className="mt-1 text-black">{children}</div>
      </div>
      <button
        type="button"
        onClick={onEdit}
        className="text-[12px] text-neutral-500 underline hover:text-black"
      >
        Alterar
      </button>
    </div>
  );
}

function PrimaryButton({
  busy,
  onClick,
  label,
}: {
  busy: boolean;
  onClick: () => void;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={busy}
      className="mt-6 flex w-full items-center justify-center gap-2 bg-black px-5 py-3.5 text-[12px] font-semibold uppercase tracking-[0.16em] text-white hover:bg-neutral-800 disabled:opacity-50 sm:w-auto"
    >
      {busy && <Loader2 className="h-4 w-4 animate-spin" />}
      {label}
    </button>
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
  onEnter,
  type = "text",
  inputMode,
  disabled,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  onEnter?: () => void;
  type?: string;
  inputMode?: "numeric" | "text";
  disabled?: boolean;
}) {
  return (
    <label className="grid min-w-0 gap-2">
      <span className="text-[12px] font-medium uppercase tracking-[0.14em] text-neutral-500">
        {label}
      </span>
      <input
        type={type}
        inputMode={inputMode}
        value={value}
        disabled={disabled}
        onChange={(event) => onChange(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === "Enter" && onEnter) {
            event.preventDefault();
            onEnter();
          }
        }}
        className="h-11 w-full min-w-0 border border-black/10 bg-white px-3 text-[14px] outline-none focus:border-black disabled:bg-neutral-50 disabled:text-neutral-500"
      />
    </label>
  );
}
