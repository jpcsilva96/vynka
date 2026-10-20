/* eslint-disable @typescript-eslint/no-explicit-any -- store_checkout_settings ainda fora do types.ts gerado */
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useMemo, useState } from "react";
import {
  ArrowLeft,
  Check,
  ChevronDown,
  CreditCard,
  Loader2,
  MapPin,
  Store,
  Truck,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { clearCart, useCart, useCartTotals } from "@/lib/cart";
import { cepDigits, formatCep } from "@/lib/cep";
import {
  getCheckoutOptions,
  placeCheckoutOrder,
  type DeliveryOption,
  type ZipAddress,
} from "@/lib/checkout.functions";
import { startOrderPayment } from "@/lib/order-payment.functions";
import { CustomerAuthForm } from "@/components/loja/customer-auth-form";
import {
  rememberCheckoutAddress,
  signOutCustomer,
  useCustomerAddresses,
  useStoreCustomer,
  type CustomerAddress,
} from "@/lib/customer-account";
import { deliveryDaysLabel, formatDeliveryAddress } from "@/lib/orders";
import { formatBRL } from "@/lib/products";
import { useStorefront, useStorefrontPreview } from "@/lib/storefront-context";

export const Route = createFileRoute("/loja/$slug/checkout")({
  component: CheckoutRoute,
});

// Na prévia do editor a compra fica desligada: o checkout criaria um pedido de verdade.
function CheckoutRoute() {
  const store = useStorefront();
  const preview = useStorefrontPreview();
  if (!preview) return <CheckoutPage />;
  return (
    <div className="mx-auto max-w-xl px-4 py-16 text-center">
      <h1 className="text-2xl font-semibold text-black">Na prévia a compra fica desligada</h1>
      <p className="mt-3 text-[14px] leading-relaxed text-neutral-600">
        Aqui você confere a aparência da loja. Para testar uma compra, abra a loja publicada.
      </p>
      <Link
        to="/loja/$slug"
        params={{ slug: store.slug }}
        className="mt-6 inline-flex bg-black px-5 py-3 text-[12px] font-semibold uppercase tracking-[0.16em] text-white hover:bg-neutral-800"
      >
        Voltar para a loja
      </Link>
    </div>
  );
}

type Step = 1 | 2 | 3;
const NEW_ADDRESS = "new";

const optionKey = (option: Pick<DeliveryOption, "method" | "service_id">) =>
  `${option.method}:${option.service_id ?? ""}`;

// Checkout em 3 passos numa página só (catálogo lote 6, §10): identificação -> entrega ->
// pagamento, um abrindo depois do outro, com o resumo ao lado (no celular, recolhido no topo).
// Opções de entrega e pedido sempre pelo servidor (checkout.functions.ts): a cidade vem do CEP e o
// frete é recalculado no "Finalizar". Venda só com pagamento integrado (Mercado Pago); o WhatsApp
// vira contato depois do pagamento, na página do pedido.
function CheckoutPage() {
  const store = useStorefront();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const items = useCart();
  const { subtotal: cartSubtotal } = useCartTotals();
  const { data: account, isLoading: accountLoading } = useStoreCustomer(store.id);
  const { data: savedAddresses = [], isFetched: addressesFetched } = useCustomerAddresses(
    store.id,
    !!account,
  );
  const fetchOptions = useServerFn(getCheckoutOptions);
  const placeOrder = useServerFn(placeCheckoutOrder);
  const startPayment = useServerFn(startOrderPayment);

  const [open, setOpen] = useState<Step>(1);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  // Entrega: endereço salvo escolhido (id) ou outro endereço digitado.
  const [addressChoice, setAddressChoice] = useState<string>("");
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
  const [street, setStreet] = useState(emptyStreet);
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

  // Opções valem para o CEP e o carrinho do cálculo; mudou um dos dois, calcula de novo.
  const validQuote =
    quote && quote.zip === cepDigits(zip) && quote.itemsKey === itemsKey ? quote : null;
  const chosen = validQuote?.options.find((option) => optionKey(option) === choice) ?? null;
  const isPickup = chosen?.method === "pickup";
  const usingSaved = addressChoice !== "" && addressChoice !== NEW_ADDRESS;
  const subtotal = validQuote?.subtotal ?? cartSubtotal;
  const total = subtotal + (chosen?.price ?? 0);

  // keepStreet: endereço salvo escolhido; o CEP só traz as opções, a rua fica a salva.
  const calculate = async (value = zip, keepStreet = usingSaved) => {
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
      // Outro endereço: o CEP preenche rua e bairro; número e complemento ficam com o cliente.
      if (!keepStreet) {
        setStreet((current) => ({
          street: result.address.street || current.street,
          neighborhood: result.address.neighborhood || current.neighborhood,
          address_number: "",
          complement: "",
        }));
      }
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

  const selectSaved = (address: CustomerAddress) => {
    setAddressChoice(address.id);
    setZip(formatCep(address.zip_code));
    setStreet({
      street: address.street,
      address_number: address.address_number,
      complement: address.complement ?? "",
      neighborhood: address.neighborhood,
    });
    setError("");
    void calculate(address.zip_code, true);
  };

  const selectNew = () => {
    setAddressChoice(NEW_ADDRESS);
    setZip("");
    setQuote(null);
    setStreet(emptyStreet);
    setError("");
  };

  // Conta pronta: abre a entrega. Com endereços salvos, já escolhe o principal e calcula o frete.
  useEffect(() => {
    if (!account) return;
    setOpen((current) => (current === 1 ? 2 : current));
  }, [account]);
  useEffect(() => {
    if (!account || !addressesFetched || addressChoice) return;
    const main = savedAddresses.find((address) => address.is_default) ?? savedAddresses[0];
    if (main) selectSaved(main);
    else setAddressChoice(NEW_ADDRESS);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [account, addressesFetched, savedAddresses]);

  // Carrinho mudou com a entrega já calculada: refaz a conta com o mesmo CEP.
  useEffect(() => {
    if (quote && quote.itemsKey !== itemsKey && cepDigits(zip).length === 8 && items.length > 0) {
      void calculate(zip);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [itemsKey]);

  // Troca de passo leva o passo aberto para a vista.
  useEffect(() => {
    document
      .getElementById(`checkout-passo-${open}`)
      ?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [open]);

  const deliveryReady = () => {
    if (!validQuote) return usingSaved ? "Calculando a entrega..." : "Calcule a entrega pelo CEP.";
    if (!chosen) return "Escolha a forma de entrega.";
    if (!isPickup) {
      if (!street.street.trim()) return "Informe a rua.";
      if (!street.address_number.trim()) return "Informe o número.";
      if (!street.neighborhood.trim()) return "Informe o bairro.";
    }
    return "";
  };

  const goTo = (target: Step) => {
    if (target >= 2 && !account) {
      setOpen(1);
      return setError("Entre ou crie sua conta para continuar.");
    }
    if (target >= 3) {
      const missing = deliveryReady();
      if (missing) {
        setOpen(2);
        return setError(missing);
      }
    }
    setError("");
    setOpen(target);
  };

  const signOut = async () => {
    await signOutCustomer(store.id);
    await queryClient.invalidateQueries({ queryKey: ["store-customer", store.id] });
    queryClient.removeQueries({ queryKey: ["customer-addresses", store.id] });
    setQuote(null);
    setChoice("");
    setZip("");
    setAddressChoice("");
    setStreet(emptyStreet);
    setOpen(1);
  };

  const finish = async () => {
    const missing = deliveryReady();
    if (missing || !chosen || !validQuote || !account) {
      setOpen(2);
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
        // Endereço usado vira o principal em Meus endereços (cidade/UF do CEP); o banco copia o
        // principal para a ficha. Já salvo, só passa a ser o principal.
        void rememberCheckoutAddress(store.id, account, {
          zip_code: validQuote.zip,
          ...street,
          city: validQuote.address.city,
          state: validQuote.address.state,
        })
          .then(() => queryClient.invalidateQueries({ queryKey: ["customer-addresses", store.id] }))
          .catch(() => undefined);
      }
      void queryClient.invalidateQueries({ queryKey: ["store-customer", store.id] });
      void queryClient.invalidateQueries({ queryKey: ["customer-orders", store.id] });
      // Pedido gravado: vai pagar na página do Mercado Pago. Se a cobrança não abrir, a página do
      // pedido tem o botão "Pagar agora" para tentar de novo.
      try {
        const { url } = await startPayment({
          data: { store_id: store.id, order_id: orderId, return_origin: window.location.origin },
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
        setOpen(2);
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

  const deliveryDone = open === 3 && !!chosen && !!validQuote;
  const deliverySummary = chosen
    ? `${chosen.name} · ${chosen.price > 0 ? formatBRL(chosen.price) : "Grátis"}${
        deliveryDaysLabel(chosen.min_days, chosen.max_days)
          ? ` · ${deliveryDaysLabel(chosen.min_days, chosen.max_days)}`
          : ""
      }`
    : "";
  const addressSummary = isPickup
    ? pickup?.pickup_address || storeAddress || "Endereço informado pela loja."
    : validQuote
      ? formatDeliveryAddress({ ...validQuote.address, ...street })
      : "";
  const errorBox = error && (
    <div
      className="mt-4 border border-red-200 bg-red-50 px-3 py-2 text-[13px] text-red-700"
      role="alert"
    >
      {error}
    </div>
  );

  return (
    <div className="bg-neutral-50">
      <div className="mx-auto max-w-[1120px] px-4 py-6 md:px-8 md:py-10">
        <Link
          to="/loja/$slug"
          params={{ slug: store.slug }}
          className="inline-flex min-h-11 items-center gap-2 text-[12px] font-medium uppercase tracking-[0.16em] text-neutral-500 hover:text-black"
        >
          <ArrowLeft className="h-4 w-4" /> Voltar para loja
        </Link>

        <div className="mt-4 grid gap-4 md:grid-cols-[minmax(0,1fr)_340px] md:gap-6 lg:grid-cols-[minmax(0,1fr)_380px]">
          <div className="grid min-w-0 gap-3 md:self-start">
            <Section
              n={1}
              title="Identificação"
              state={account ? "done" : "open"}
              summary={
                account ? `${account.name}${account.email ? ` · ${account.email}` : ""}` : ""
              }
              action={
                account ? (
                  <button
                    type="button"
                    onClick={signOut}
                    className="min-h-11 text-[12px] text-neutral-500 underline underline-offset-4 hover:text-black"
                  >
                    Não é você? Sair
                  </button>
                ) : null
              }
            >
              {accountLoading ? (
                <p className="mt-4 text-[13px] text-neutral-500">Carregando...</p>
              ) : account ? null : (
                <div className="mt-4">
                  <p className="mb-5 text-[13px] leading-relaxed text-neutral-500">
                    Entre ou crie sua conta. Seu pedido fica salvo em Minhas compras.
                  </p>
                  <CustomerAuthForm initialMode="signup" compact onDone={() => setError("")} />
                </div>
              )}
              {open === 1 && errorBox}
            </Section>

            <Section
              n={2}
              title="Entrega"
              state={!account ? "locked" : open === 2 ? "open" : open > 2 ? "done" : "locked"}
              summary={deliveryDone ? `${deliverySummary}\n${addressSummary}` : ""}
              action={
                open > 2 ? (
                  <button
                    type="button"
                    onClick={() => goTo(2)}
                    className="min-h-11 text-[12px] text-neutral-500 underline underline-offset-4 hover:text-black"
                  >
                    Alterar
                  </button>
                ) : null
              }
            >
              {savedAddresses.length > 0 && (
                <div className="mt-4 grid gap-2" role="radiogroup" aria-label="Endereço de entrega">
                  {savedAddresses.map((address) => (
                    <RadioCard
                      key={address.id}
                      selected={addressChoice === address.id}
                      onSelect={() => selectSaved(address)}
                      title={
                        address.label || (address.is_default ? "Endereço principal" : "Endereço")
                      }
                      detail={formatDeliveryAddress(address)}
                    />
                  ))}
                  <RadioCard
                    selected={addressChoice === NEW_ADDRESS}
                    onSelect={selectNew}
                    title="Usar outro endereço"
                    detail="Informe o CEP para ver as opções de entrega."
                  />
                </div>
              )}

              {(addressChoice === NEW_ADDRESS || savedAddresses.length === 0) && (
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
                    className="h-12 shrink-0 border border-black px-4 text-[12px] font-semibold uppercase tracking-[0.12em] hover:bg-black hover:text-white disabled:opacity-50 md:h-11"
                  >
                    {busy && !validQuote ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      "Calcular"
                    )}
                  </button>
                </div>
              )}

              {busy && usingSaved && !validQuote && (
                <p className="mt-4 flex items-center gap-2 text-[13px] text-neutral-500">
                  <Loader2 className="h-4 w-4 animate-spin" /> Calculando a entrega...
                </p>
              )}

              {validQuote && (
                <>
                  <div className="mt-5 text-[12px] font-medium uppercase tracking-[0.14em] text-neutral-500">
                    Forma de entrega · <MapPin className="inline h-3.5 w-3.5" />{" "}
                    {validQuote.address.city}/{validQuote.address.state}
                  </div>
                  <div className="mt-3 grid gap-2" role="radiogroup" aria-label="Formas de entrega">
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

              {chosen && !isPickup && !usingSaved && (
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

              {open === 2 && errorBox}
              <PrimaryButton busy={busy} onClick={() => goTo(3)} label="Continuar para pagamento" />
            </Section>

            <Section
              n={3}
              title="Pagamento"
              state={open === 3 && deliveryDone ? "open" : "locked"}
              summary=""
            >
              <div className="mt-4 divide-y divide-black/10 border-y border-black/10 text-[13px]">
                <ReviewRow label="Itens">
                  {items.reduce((sum, item) => sum + item.quantity, 0)}{" "}
                  {items.reduce((sum, item) => sum + item.quantity, 0) === 1 ? "item" : "itens"} ·{" "}
                  {formatBRL(subtotal)}
                </ReviewRow>
                <ReviewRow label={isPickup ? "Retirada" : "Entrega"}>
                  {deliverySummary}
                  <span className="block text-neutral-500">{addressSummary}</span>
                </ReviewRow>
                <ReviewRow label="Total">
                  <span className="text-[16px] font-semibold">{formatBRL(total)}</span>
                </ReviewRow>
              </div>
              <div className="mt-4 flex flex-wrap gap-2 text-[12px] font-medium text-neutral-700">
                {["Pix", "Cartão de crédito"].map((label) => (
                  <span key={label} className="border border-black/10 px-3 py-2">
                    <CreditCard className="mr-1.5 inline h-3.5 w-3.5" />
                    {label}
                  </span>
                ))}
              </div>
              <p className="mt-3 text-[13px] leading-relaxed text-neutral-600">
                Você escolhe a forma e paga na página segura do Mercado Pago.
              </p>
              <label className="mt-5 grid gap-2">
                <span className="text-[12px] font-medium uppercase tracking-[0.14em] text-neutral-500">
                  Observações (opcional)
                </span>
                <textarea
                  value={notes}
                  onChange={(event) => setNotes(event.target.value)}
                  rows={3}
                  maxLength={1000}
                  className="w-full min-w-0 resize-none border border-black/10 bg-white px-3 py-3 text-[16px] outline-none focus:border-black md:text-[14px]"
                />
              </label>
              {open === 3 && errorBox}
              <PrimaryButton busy={busy} onClick={finish} label="Finalizar e pagar" />
            </Section>
          </div>

          <aside className="order-first border border-black/10 bg-white p-4 md:order-none md:sticky md:top-6 md:self-start md:p-7">
            <details className="group md:hidden">
              <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-3 text-[13px]">
                <span className="flex items-center gap-1.5 text-neutral-500">
                  Resumo ({items.length} {items.length === 1 ? "item" : "itens"})
                  <ChevronDown className="h-4 w-4 transition-transform group-open:rotate-180" />
                </span>
                <span className="text-[16px] font-semibold text-black">{formatBRL(total)}</span>
              </summary>
              <div className="mt-4">
                <Summary items={items} subtotal={subtotal} chosen={chosen} total={total} />
              </div>
            </details>
            <div className="hidden md:block">
              <div className="text-[11px] font-medium uppercase tracking-[0.24em] text-neutral-500">
                Resumo da compra
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

const emptyStreet = { street: "", address_number: "", complement: "", neighborhood: "" };

// Passo do checkout: aberto (conteúdo), feito (resumo + Alterar) ou bloqueado (só o título).
function Section({
  n,
  title,
  state,
  summary,
  action,
  children,
}: {
  n: Step;
  title: string;
  state: "open" | "done" | "locked";
  summary: string;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section
      id={`checkout-passo-${n}`}
      aria-current={state === "open" ? "step" : undefined}
      className={`scroll-mt-4 border bg-white p-4 md:p-6 ${state === "open" ? "border-black/20" : "border-black/10"}`}
    >
      <div className="flex items-start justify-between gap-3">
        <h2
          className={`flex items-center gap-3 font-semibold tracking-tight ${state === "locked" ? "text-neutral-400" : "text-black"}`}
        >
          <span
            className={`grid h-7 w-7 shrink-0 place-items-center rounded-full text-[12px] ${
              state === "done"
                ? "bg-neutral-200 text-black"
                : state === "open"
                  ? "bg-black text-white"
                  : "border border-neutral-300"
            }`}
          >
            {state === "done" ? <Check className="h-3.5 w-3.5" /> : n}
          </span>
          {title}
        </h2>
        {state === "done" && action}
      </div>
      {state === "done" && summary && (
        <p className="mt-2 whitespace-pre-line break-words pl-10 text-[13px] leading-relaxed text-neutral-600">
          {summary}
        </p>
      )}
      {state === "open" && children}
    </section>
  );
}

function RadioCard({
  selected,
  onSelect,
  title,
  detail,
}: {
  selected: boolean;
  onSelect: () => void;
  title: string;
  detail: string;
}) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={selected}
      onClick={onSelect}
      className={`flex min-h-12 items-start gap-3 border px-4 py-3 text-left ${
        selected ? "border-black bg-neutral-50" : "border-black/10 hover:border-black/40"
      }`}
    >
      <span
        className={`mt-0.5 grid h-4 w-4 shrink-0 place-items-center rounded-full border ${selected ? "border-black" : "border-neutral-400"}`}
      >
        {selected && <span className="h-2 w-2 rounded-full bg-black" />}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-[13px] font-medium text-black">{title}</span>
        <span className="block break-words text-[12px] text-neutral-500">{detail}</span>
      </span>
    </button>
  );
}

function ReviewRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex gap-4 py-3">
      <div className="w-20 shrink-0 text-[11px] font-medium uppercase tracking-[0.16em] text-neutral-500">
        {label}
      </div>
      <div className="min-w-0 flex-1 break-words text-black">{children}</div>
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
