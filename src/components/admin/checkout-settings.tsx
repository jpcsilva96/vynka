import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AlertTriangle,
  Check,
  ChevronsUpDown,
  CreditCard,
  Loader2,
  MapPin,
  Package,
  PackageCheck,
  ShoppingCart,
  Trash2,
  Truck,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  BOLETO_DAYS,
  BRAZIL_STATES,
  DELIVERY_DAYS,
  PACKAGE_LIMITS,
  PIX_HOURS,
  defaultCheckoutSettings,
  getCheckoutSettings,
  listDeliveryCities,
  listIbgeCities,
  saveCheckoutSettings,
  saveDeliveryCities,
  type CheckoutSettings,
  type DeliveryCity,
} from "@/lib/checkout-settings";
import { parseMoney } from "@/lib/finance";
import { cn } from "@/lib/utils";

// Telas das configurações de checkout (lote A): aba Entrega e Retirada, aba Pedidos e Vendas
// (estoque e prazos) e aba Pagamentos. Cada aba salva só os próprios campos.

const moneyText = (value: number | null) =>
  value == null ? "" : value.toFixed(2).replace(".", ",");
const decimalText = (value: number) => String(value).replace(".", ",");
const parseDecimal = (value: string) => {
  const n = Number(value.trim().replace(",", "."));
  return value.trim() && Number.isFinite(n) ? n : NaN;
};

function useCheckoutSettings(storeId: string) {
  return useQuery({
    queryKey: ["checkout-settings", storeId],
    queryFn: () => getCheckoutSettings(storeId),
    enabled: !!storeId,
  });
}

// ---------------------------------------------------------------- Entrega e Retirada

export function DeliverySettingsTab({
  storeId,
  storeAddress,
}: {
  storeId: string;
  storeAddress: string;
}) {
  const queryClient = useQueryClient();
  const { data: settings, isLoading } = useCheckoutSettings(storeId);
  const { data: savedCities, isLoading: citiesLoading } = useQuery({
    queryKey: ["delivery-cities", storeId],
    queryFn: () => listDeliveryCities(storeId),
    enabled: !!storeId,
  });
  const [form, setForm] = useState<CheckoutSettings>(defaultCheckoutSettings);
  const [cities, setCities] = useState<DeliveryCity[]>([]);
  const [text, setText] = useState({
    localPrice: "",
    minDays: "",
    maxDays: "",
    freeMin: "",
    weight: "",
    height: "",
    width: "",
    length: "",
  });
  const [freeShippingOn, setFreeShippingOn] = useState(false);
  const [customPickupAddress, setCustomPickupAddress] = useState(false);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (!settings) return;
    setForm(settings);
    setFreeShippingOn(settings.free_shipping_min_amount != null);
    setCustomPickupAddress(!!settings.pickup_address);
    setText({
      localPrice: moneyText(settings.local_delivery_price),
      minDays: String(settings.local_delivery_min_days),
      maxDays: String(settings.local_delivery_max_days),
      freeMin: moneyText(settings.free_shipping_min_amount),
      weight: decimalText(settings.package_weight_kg),
      height: decimalText(settings.package_height_cm),
      width: decimalText(settings.package_width_cm),
      length: decimalText(settings.package_length_cm),
    });
  }, [settings]);
  useEffect(() => {
    if (savedCities) setCities(savedCities);
  }, [savedCities]);

  const touch = () => {
    setSaved(false);
    setError("");
  };
  const patch = <K extends keyof CheckoutSettings>(key: K, value: CheckoutSettings[K]) => {
    touch();
    setForm((current) => ({ ...current, [key]: value }));
  };
  const patchText = (key: keyof typeof text, value: string) => {
    touch();
    setText((current) => ({ ...current, [key]: value }));
  };

  // Valida e monta o que vai para o banco; devolve a mensagem de erro, se houver.
  const build = (): { patch: Partial<CheckoutSettings> } | { error: string } => {
    const localPrice = text.localPrice.trim() ? parseMoney(text.localPrice) : 0;
    const minDays = Number(text.minDays);
    const maxDays = Number(text.maxDays);
    if (form.local_delivery_enabled) {
      if (cities.length === 0)
        return { error: "Adicione ao menos uma cidade para a entrega local." };
      if (!Number.isFinite(localPrice) || localPrice < 0)
        return { error: "Valor da entrega local inválido." };
      if (cities.some((city) => city.price != null && !(city.price >= 0)))
        return { error: "Confira o valor das cidades." };
    }
    const daysOk = (n: number) =>
      Number.isInteger(n) && n >= DELIVERY_DAYS.min && n <= DELIVERY_DAYS.max;
    if (!daysOk(minDays) || !daysOk(maxDays))
      return {
        error: `Prazo da entrega local: use dias inteiros de ${DELIVERY_DAYS.min} a ${DELIVERY_DAYS.max}.`,
      };
    if (maxDays < minDays)
      return { error: "No prazo da entrega local, o “até” não pode ser menor que o “de”." };
    if (form.pickup_enabled && customPickupAddress && !form.pickup_address.trim())
      return { error: "Informe o endereço de retirada ou use o endereço da loja." };
    const freeMin = freeShippingOn ? parseMoney(text.freeMin) : null;
    if (freeShippingOn && !(freeMin != null && freeMin > 0))
      return { error: "Informe o valor mínimo do carrinho para frete grátis." };
    const pkg = [text.weight, text.height, text.width, text.length].map(parseDecimal);
    if (!(pkg[0] > 0 && pkg[0] <= PACKAGE_LIMITS.weightKg))
      return {
        error: `Peso da embalagem padrão: maior que 0 e até ${PACKAGE_LIMITS.weightKg} kg.`,
      };
    if (pkg.slice(1).some((n) => !(n > 0 && n <= PACKAGE_LIMITS.sizeCm)))
      return {
        error: `Medidas da embalagem padrão: maiores que 0 e até ${PACKAGE_LIMITS.sizeCm} cm.`,
      };
    return {
      patch: {
        local_delivery_enabled: form.local_delivery_enabled,
        local_delivery_price: Number.isFinite(localPrice) ? localPrice : 0,
        local_delivery_min_days: minDays,
        local_delivery_max_days: maxDays,
        pickup_enabled: form.pickup_enabled,
        pickup_address: customPickupAddress ? form.pickup_address : "",
        pickup_instructions: form.pickup_instructions,
        package_weight_kg: pkg[0],
        package_height_cm: pkg[1],
        package_width_cm: pkg[2],
        package_length_cm: pkg[3],
        free_shipping_min_amount: freeMin,
        free_shipping_local: freeShippingOn && form.free_shipping_local,
      },
    };
  };

  const saveMutation = useMutation({
    mutationFn: async () => {
      const result = build();
      if ("error" in result) throw new Error(result.error);
      await saveDeliveryCities(storeId, cities);
      await saveCheckoutSettings(storeId, result.patch);
    },
    onSuccess: async () => {
      setSaved(true);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["checkout-settings", storeId] }),
        queryClient.invalidateQueries({ queryKey: ["delivery-cities", storeId] }),
      ]);
      window.setTimeout(() => setSaved(false), 2200);
    },
    onError: (err) => setError(err instanceof Error ? err.message : "Não foi possível salvar."),
  });

  if (isLoading || citiesLoading) return <LoadingBox />;

  const noOption = !form.local_delivery_enabled && !form.pickup_enabled && !form.shipping_enabled;

  return (
    <div className="space-y-6">
      <TabHeader
        icon={<Truck className="h-14 w-14" strokeWidth={1.3} />}
        title="Entrega e Retirada"
        description="Escolha como seus clientes recebem os pedidos. No checkout, cada cliente só vê as opções que valem para o CEP dele."
      />

      {noOption && (
        <Notice tone="warning">
          Nenhuma forma de entrega ligada: sem pelo menos uma, o cliente não consegue finalizar a
          compra.
        </Notice>
      )}

      <Card
        icon={<PackageCheck className="h-5 w-5" strokeWidth={1.5} />}
        title="Entrega local"
        description="Você mesmo entrega, nas cidades que escolher. Só aparece para clientes dessas cidades."
        checked={form.local_delivery_enabled}
        onToggle={() => patch("local_delivery_enabled", !form.local_delivery_enabled)}
      >
        <div className="grid gap-4 md:grid-cols-[200px_minmax(0,1fr)]">
          <Field
            label="Valor da entrega"
            hint="Vale para todas as cidades; mude abaixo se alguma for diferente."
          >
            <MoneyInput
              value={text.localPrice}
              onChange={(value) => patchText("localPrice", value)}
            />
          </Field>
          <Field label="Prazo de entrega (dias)">
            <div className="flex items-center gap-2 text-[13px] text-muted-foreground">
              de
              <NumberInput value={text.minDays} onChange={(value) => patchText("minDays", value)} />
              até
              <NumberInput value={text.maxDays} onChange={(value) => patchText("maxDays", value)} />
              dias
            </div>
          </Field>
        </div>
        <CityPicker
          cities={cities}
          defaultPrice={text.localPrice}
          onChange={(next) => {
            touch();
            setCities(next);
          }}
        />
      </Card>

      <Card
        icon={<MapPin className="h-5 w-5" strokeWidth={1.5} />}
        title="Retirada na loja"
        description="O cliente busca o pedido. Disponível para todos os clientes, de qualquer cidade."
        checked={form.pickup_enabled}
        onToggle={() => patch("pickup_enabled", !form.pickup_enabled)}
      >
        <div className="space-y-2">
          <RadioLine
            checked={!customPickupAddress}
            onSelect={() => {
              touch();
              setCustomPickupAddress(false);
            }}
            label="Endereço da loja"
            detail={storeAddress || "Endereço ainda não preenchido na aba Loja."}
          />
          <RadioLine
            checked={customPickupAddress}
            onSelect={() => {
              touch();
              setCustomPickupAddress(true);
            }}
            label="Outro endereço"
          />
          {customPickupAddress && (
            <input
              value={form.pickup_address}
              onChange={(event) => patch("pickup_address", event.target.value)}
              maxLength={300}
              placeholder="Rua, número, bairro, cidade"
              className={inputClass}
            />
          )}
        </div>
        <Field label="Horário e instruções de retirada">
          <textarea
            value={form.pickup_instructions}
            onChange={(event) => patch("pickup_instructions", event.target.value)}
            maxLength={500}
            placeholder="Ex.: Seg a Sex, 10h às 18h. Traga o número do pedido."
            className={cn(inputClass, "min-h-20 resize-none")}
          />
        </Field>
      </Card>

      <Card
        icon={<Truck className="h-5 w-5" strokeWidth={1.5} />}
        title="Correios e transportadoras"
        description="Envio para todo o Brasil com frete calculado na hora, pela sua conta do Melhor Envio."
        checked={form.shipping_enabled}
        disabled
        onToggle={() => undefined}
      >
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-dashed border-border bg-muted/30 px-4 py-3">
          <div className="text-[13px]">
            <div className="font-semibold text-foreground">Melhor Envio: não conectado</div>
            <div className="text-muted-foreground">
              A conexão da sua conta chega na próxima etapa. Depois de conectar, você escolhe aqui
              os serviços (PAC, SEDEX e outros) que quer oferecer.
            </div>
          </div>
          <button type="button" disabled className={cn(secondaryButton, "opacity-60")}>
            Conectar minha conta (em breve)
          </button>
        </div>
        <Field
          label="Embalagem padrão"
          hint="Usada no cálculo do frete para produtos sem peso e medidas cadastrados."
        >
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            <UnitInput
              unit="kg"
              label="Peso"
              value={text.weight}
              onChange={(value) => patchText("weight", value)}
            />
            <UnitInput
              unit="cm"
              label="Altura"
              value={text.height}
              onChange={(value) => patchText("height", value)}
            />
            <UnitInput
              unit="cm"
              label="Largura"
              value={text.width}
              onChange={(value) => patchText("width", value)}
            />
            <UnitInput
              unit="cm"
              label="Comprimento"
              value={text.length}
              onChange={(value) => patchText("length", value)}
            />
          </div>
        </Field>
      </Card>

      <Card
        icon={<Package className="h-5 w-5" strokeWidth={1.5} />}
        title="Frete grátis"
        description="Frete grátis quando o carrinho passar de um valor, nas modalidades que você escolher."
        checked={freeShippingOn}
        onToggle={() => {
          touch();
          setFreeShippingOn((current) => !current);
        }}
      >
        <div className="grid gap-4 md:grid-cols-[200px_minmax(0,1fr)]">
          <Field label="Carrinho a partir de">
            <MoneyInput value={text.freeMin} onChange={(value) => patchText("freeMin", value)} />
          </Field>
          <Field label="Vale para">
            <label className="flex items-center gap-2 text-[13px] text-foreground">
              <input
                type="checkbox"
                checked={form.free_shipping_local}
                onChange={() => patch("free_shipping_local", !form.free_shipping_local)}
                className="h-4 w-4 accent-[hsl(var(--primary))]"
              />
              Entrega local
            </label>
            <p className="mt-2 text-[12px] text-muted-foreground">
              Correios e transportadoras aparecem aqui depois de conectar o Melhor Envio.
            </p>
          </Field>
        </div>
      </Card>

      {error && <Notice tone="error">{error}</Notice>}
      <SaveBar
        pending={saveMutation.isPending}
        saved={saved}
        label="Salvar entrega e retirada"
        onSave={() => saveMutation.mutate()}
      />
    </div>
  );
}

function CityPicker({
  cities,
  defaultPrice,
  onChange,
}: {
  cities: DeliveryCity[];
  defaultPrice: string;
  onChange: (cities: DeliveryCity[]) => void;
}) {
  const [state, setState] = useState("");
  const [open, setOpen] = useState(false);
  const {
    data: options,
    isFetching,
    error,
  } = useQuery({
    queryKey: ["ibge-cities", state],
    queryFn: () => listIbgeCities(state),
    enabled: !!state,
    staleTime: Infinity,
  });
  const chosen = useMemo(() => new Set(cities.map((city) => city.ibge_code)), [cities]);
  const [priceText, setPriceText] = useState<Record<string, string>>({});

  const toggleCity = (ibge_code: string, city_name: string) => {
    if (chosen.has(ibge_code)) onChange(cities.filter((city) => city.ibge_code !== ibge_code));
    else onChange([...cities, { ibge_code, city_name, state, price: null }]);
  };
  const setCityPrice = (ibge_code: string, value: string) => {
    setPriceText((current) => ({ ...current, [ibge_code]: value }));
    const price = value.trim() ? parseMoney(value) : null;
    onChange(
      cities.map((city) =>
        city.ibge_code === ibge_code ? { ...city, price: price ?? null } : city,
      ),
    );
  };
  const sorted = [...cities].sort(
    (a, b) => a.state.localeCompare(b.state) || a.city_name.localeCompare(b.city_name, "pt-BR"),
  );

  return (
    <div className="space-y-3">
      <div className="text-[12px] font-medium text-foreground">Cidades atendidas</div>
      <div className="flex flex-wrap gap-2">
        <select
          value={state}
          onChange={(event) => setState(event.target.value)}
          className={cn(inputClass, "w-28")}
          aria-label="Estado"
        >
          <option value="">Estado</option>
          {BRAZIL_STATES.map((uf) => (
            <option key={uf} value={uf}>
              {uf}
            </option>
          ))}
        </select>
        <Popover open={open} onOpenChange={setOpen}>
          <PopoverTrigger asChild>
            <button
              type="button"
              disabled={!state}
              className={cn(
                inputClass,
                "flex min-w-64 flex-1 items-center justify-between text-left disabled:opacity-60",
              )}
            >
              <span className="text-muted-foreground">
                {state
                  ? isFetching
                    ? "Carregando cidades..."
                    : "Buscar e adicionar cidades"
                  : "Escolha o estado primeiro"}
              </span>
              <ChevronsUpDown className="h-4 w-4 text-muted-foreground" />
            </button>
          </PopoverTrigger>
          <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
            <Command>
              <CommandInput placeholder="Digite o nome da cidade" />
              <CommandList>
                <CommandEmpty>
                  {error ? "Não foi possível carregar as cidades." : "Nenhuma cidade encontrada."}
                </CommandEmpty>
                <CommandGroup>
                  {(options ?? []).map((city) => (
                    <CommandItem
                      key={city.ibge_code}
                      value={`${city.city_name} ${city.ibge_code}`}
                      onSelect={() => toggleCity(city.ibge_code, city.city_name)}
                    >
                      <Check
                        className={cn(
                          "mr-2 h-4 w-4",
                          chosen.has(city.ibge_code) ? "opacity-100" : "opacity-0",
                        )}
                      />
                      {city.city_name}
                    </CommandItem>
                  ))}
                </CommandGroup>
              </CommandList>
            </Command>
          </PopoverContent>
        </Popover>
      </div>

      {sorted.length === 0 ? (
        <p className="text-[12px] text-muted-foreground">Nenhuma cidade adicionada ainda.</p>
      ) : (
        <div className="divide-y divide-border rounded-md border border-border">
          {sorted.map((city) => (
            <div key={city.ibge_code} className="flex flex-wrap items-center gap-3 px-3 py-2">
              <div className="min-w-0 flex-1 text-[13px] text-foreground">
                {city.city_name} <span className="text-muted-foreground">· {city.state}</span>
              </div>
              <div className="w-36">
                <MoneyInput
                  value={priceText[city.ibge_code] ?? moneyText(city.price)}
                  placeholder={defaultPrice ? `${defaultPrice} (padrão)` : "padrão"}
                  onChange={(value) => setCityPrice(city.ibge_code, value)}
                />
              </div>
              <button
                type="button"
                onClick={() => onChange(cities.filter((item) => item.ibge_code !== city.ibge_code))}
                className="grid h-8 w-8 place-items-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground"
                aria-label={`Remover ${city.city_name}`}
              >
                <Trash2 className="h-4 w-4" strokeWidth={1.5} />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------- Pedidos e Vendas (estoque e prazos)

export function OrderStockSettingsTab({ storeId }: { storeId: string }) {
  const queryClient = useQueryClient();
  const { data: settings, isLoading } = useCheckoutSettings(storeId);
  const [stock, setStock] = useState(defaultCheckoutSettings.stock_deduction);
  const [pixHours, setPixHours] = useState("");
  const [boletoDays, setBoletoDays] = useState("");
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (!settings) return;
    setStock(settings.stock_deduction);
    setPixHours(String(settings.pix_expiration_hours));
    setBoletoDays(String(settings.boleto_expiration_days));
  }, [settings]);

  const touch = () => {
    setSaved(false);
    setError("");
  };

  const saveMutation = useMutation({
    mutationFn: async () => {
      const pix = Number(pixHours);
      const boleto = Number(boletoDays);
      if (!Number.isInteger(pix) || pix < PIX_HOURS.min || pix > PIX_HOURS.max)
        throw new Error(`Prazo do Pix: de ${PIX_HOURS.min} a ${PIX_HOURS.max} horas.`);
      if (!Number.isInteger(boleto) || boleto < BOLETO_DAYS.min || boleto > BOLETO_DAYS.max)
        throw new Error(`Prazo do boleto: de ${BOLETO_DAYS.min} a ${BOLETO_DAYS.max} dias.`);
      await saveCheckoutSettings(storeId, {
        stock_deduction: stock,
        pix_expiration_hours: pix,
        boleto_expiration_days: boleto,
      });
    },
    onSuccess: async () => {
      setSaved(true);
      await queryClient.invalidateQueries({ queryKey: ["checkout-settings", storeId] });
      window.setTimeout(() => setSaved(false), 2200);
    },
    onError: (err) => setError(err instanceof Error ? err.message : "Não foi possível salvar."),
  });

  if (isLoading) return <LoadingBox />;

  return (
    <div className="space-y-6">
      <TabHeader
        icon={<ShoppingCart className="h-14 w-14" strokeWidth={1.3} />}
        title="Pedidos e Vendas"
        description="Quando o estoque baixa e quanto tempo o cliente tem para pagar."
      />

      <section className="rounded-lg border border-border bg-surface p-6 shadow-sm">
        <h3 className="text-[16px] font-semibold text-foreground">Quando o estoque baixa</h3>
        <div className="mt-4 grid gap-3 md:grid-cols-2">
          <ChoiceCard
            checked={stock === "on_order"}
            onSelect={() => {
              touch();
              setStock("on_order");
            }}
            title="Ao fazer o pedido"
            description="As peças ficam reservadas para o cliente. Se ele não pagar no prazo, o pedido é cancelado e as peças voltam ao estoque."
          />
          <ChoiceCard
            checked={stock === "on_payment"}
            onSelect={() => {
              touch();
              setStock("on_payment");
            }}
            title="Ao confirmar o pagamento"
            description="O estoque só baixa quando o Mercado Pago confirma o pagamento. Sem reserva: outro cliente pode comprar a mesma peça antes."
          />
        </div>
        <p className="mt-3 text-[12px] text-muted-foreground">
          Em qualquer opção, cancelar um pedido devolve as peças ao estoque.
        </p>
      </section>

      <section className="rounded-lg border border-border bg-surface p-6 shadow-sm">
        <h3 className="text-[16px] font-semibold text-foreground">Prazo para pagar</h3>
        <p className="mt-1 text-[13px] text-muted-foreground">
          Passado o prazo sem pagamento, o pedido é cancelado e o Pix ou boleto vence. Se o cliente
          pagar depois, o próprio Mercado Pago devolve o dinheiro a ele.
        </p>
        <div className="mt-4 grid gap-4 md:grid-cols-3">
          <Field label="Pix" hint={`Mínimo ${PIX_HOURS.min} horas.`}>
            <UnitInput
              unit="horas"
              label="Prazo do Pix"
              value={pixHours}
              onChange={(value) => {
                touch();
                setPixHours(value);
              }}
            />
          </Field>
          <Field
            label="Boleto"
            hint={`Mínimo ${BOLETO_DAYS.min} dias (recomendação do Mercado Pago).`}
          >
            <UnitInput
              unit="dias"
              label="Prazo do boleto"
              value={boletoDays}
              onChange={(value) => {
                touch();
                setBoletoDays(value);
              }}
            />
          </Field>
          <Field label="Cartão de crédito">
            <p className="pt-2 text-[13px] text-muted-foreground">
              Sem prazo: a resposta sai na hora. Se ficar “em análise”, o pedido espera o Mercado
              Pago.
            </p>
          </Field>
        </div>
      </section>

      {error && <Notice tone="error">{error}</Notice>}
      <SaveBar
        pending={saveMutation.isPending}
        saved={saved}
        label="Salvar pedidos e vendas"
        onSave={() => saveMutation.mutate()}
      />
    </div>
  );
}

// ---------------------------------------------------------------- Pagamentos

export function PaymentSettingsTab() {
  return (
    <div className="space-y-6">
      <TabHeader
        icon={<CreditCard className="h-14 w-14" strokeWidth={1.3} />}
        title="Pagamentos"
        description="Pix, boleto e cartão de crédito pela sua conta do Mercado Pago. O dinheiro das vendas cai direto nela."
      />
      <section className="rounded-lg border border-border bg-surface p-6 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-[15px] font-semibold text-foreground">
              <span className="h-2.5 w-2.5 rounded-full bg-border" /> Mercado Pago: não conectado
            </div>
            <p className="mt-1 text-[13px] text-muted-foreground">
              A conexão da sua conta chega numa próxima etapa.
            </p>
          </div>
          <button type="button" disabled className={cn(secondaryButton, "opacity-60")}>
            Conectar minha conta (em breve)
          </button>
        </div>
        <div className="mt-5 rounded-md bg-muted/40 px-4 py-3 text-[13px] text-foreground">
          <div className="font-semibold">Antes de conectar</div>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-muted-foreground">
            <li>Tenha uma conta no Mercado Pago (o mesmo login do Mercado Livre serve).</li>
            <li>
              O dinheiro das vendas cai direto na sua conta; o Vynka não recebe nada por você.
            </li>
            <li>Parcelas e juros do cartão você configura na sua conta do Mercado Pago.</li>
          </ul>
        </div>
      </section>
    </div>
  );
}

// ---------------------------------------------------------------- peças pequenas

const inputClass =
  "w-full rounded-md border border-border bg-surface px-3 py-2.5 text-[14px] outline-none focus:border-foreground/40";
const secondaryButton =
  "inline-flex items-center gap-2 rounded-md border border-border bg-surface px-4 py-2.5 text-[13px] font-semibold text-foreground";

function LoadingBox() {
  return (
    <div className="grid min-h-[420px] place-items-center rounded-lg border border-border bg-surface">
      <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" strokeWidth={1.5} />
    </div>
  );
}

function TabHeader({
  icon,
  title,
  description,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
}) {
  return (
    <div className="text-center">
      <div className="mx-auto grid h-20 w-20 place-items-center rounded-md text-primary">
        {icon}
      </div>
      <h2 className="mt-2 text-[15px] font-semibold text-foreground">{title}</h2>
      <p className="mx-auto mt-1 max-w-xl text-[12px] text-muted-foreground">{description}</p>
    </div>
  );
}

function Card({
  icon,
  title,
  description,
  checked,
  disabled = false,
  onToggle,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
  checked: boolean;
  disabled?: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}) {
  return (
    <section
      className={cn(
        "rounded-lg border bg-surface p-6 shadow-sm transition-colors",
        checked ? "border-primary/60" : "border-border",
      )}
    >
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <div
            className={cn(
              "grid h-10 w-10 shrink-0 place-items-center rounded-md",
              checked ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground",
            )}
          >
            {icon}
          </div>
          <div>
            <h3 className="text-[16px] font-semibold text-foreground">{title}</h3>
            <p className="mt-0.5 text-[13px] text-muted-foreground">{description}</p>
          </div>
        </div>
        <button
          type="button"
          onClick={onToggle}
          disabled={disabled}
          aria-pressed={checked}
          aria-label={`${checked ? "Desligar" : "Ligar"} ${title}`}
          className={cn(
            "mt-1 flex h-5 w-9 shrink-0 items-center rounded-full p-0.5 transition-colors disabled:cursor-not-allowed disabled:opacity-50",
            checked ? "bg-primary" : "bg-border",
          )}
        >
          <span
            className={cn(
              "h-4 w-4 rounded-full bg-white transition-transform",
              checked ? "translate-x-4" : "translate-x-0",
            )}
          />
        </button>
      </div>
      {(checked || disabled) && (
        <div className="mt-5 space-y-4 border-t border-border pt-5">{children}</div>
      )}
    </section>
  );
}

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <div className="mb-1.5 text-[12px] font-medium text-foreground">{label}</div>
      {children}
      {hint && <p className="mt-1 text-[12px] text-muted-foreground">{hint}</p>}
    </div>
  );
}

function MoneyInput({
  value,
  onChange,
  placeholder = "0,00",
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}) {
  return (
    <div className="flex items-center rounded-md border border-border bg-surface px-3 focus-within:border-foreground/40">
      <span className="text-[13px] text-muted-foreground">R$</span>
      <input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        inputMode="decimal"
        placeholder={placeholder}
        className="min-w-0 flex-1 bg-transparent px-2 py-2.5 text-[14px] outline-none placeholder:text-muted-foreground"
      />
    </div>
  );
}

function NumberInput({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  return (
    <input
      value={value}
      onChange={(event) => onChange(event.target.value.replace(/\D/g, "").slice(0, 3))}
      inputMode="numeric"
      className="w-16 rounded-md border border-border bg-surface px-2 py-2.5 text-center text-[14px] text-foreground outline-none focus:border-foreground/40"
    />
  );
}

function UnitInput({
  unit,
  label,
  value,
  onChange,
}: {
  unit: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <label className="flex items-center rounded-md border border-border bg-surface px-3 focus-within:border-foreground/40">
      <span className="sr-only">{label}</span>
      <input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        inputMode="decimal"
        placeholder={label}
        className="min-w-0 flex-1 bg-transparent py-2.5 text-[14px] outline-none placeholder:text-muted-foreground"
      />
      <span className="text-[12px] text-muted-foreground">{unit}</span>
    </label>
  );
}

function RadioLine({
  checked,
  onSelect,
  label,
  detail,
}: {
  checked: boolean;
  onSelect: () => void;
  label: string;
  detail?: string;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className="flex w-full items-start gap-3 text-left"
      aria-pressed={checked}
    >
      <span
        className={cn(
          "mt-0.5 grid h-4 w-4 shrink-0 place-items-center rounded-full border",
          checked ? "border-primary" : "border-border",
        )}
      >
        {checked && <span className="h-2 w-2 rounded-full bg-primary" />}
      </span>
      <span className="text-[13px]">
        <span className="font-medium text-foreground">{label}</span>
        {detail && <span className="block text-muted-foreground">{detail}</span>}
      </span>
    </button>
  );
}

function ChoiceCard({
  checked,
  onSelect,
  title,
  description,
}: {
  checked: boolean;
  onSelect: () => void;
  title: string;
  description: string;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={checked}
      className={cn(
        "rounded-lg border p-4 text-left transition-colors",
        checked
          ? "border-primary bg-primary/5 ring-1 ring-primary/25"
          : "border-border hover:border-primary/50",
      )}
    >
      <div className="flex items-center justify-between gap-3">
        <span className="text-[14px] font-semibold text-foreground">{title}</span>
        <span
          className={cn(
            "grid h-5 w-5 place-items-center rounded-full border",
            checked ? "border-primary bg-primary text-primary-foreground" : "border-border",
          )}
        >
          {checked && <Check className="h-3 w-3" strokeWidth={2.5} />}
        </span>
      </div>
      <p className="mt-2 text-[12px] leading-relaxed text-muted-foreground">{description}</p>
    </button>
  );
}

function Notice({ tone, children }: { tone: "warning" | "error"; children: React.ReactNode }) {
  return (
    <div
      className={cn(
        "flex items-start gap-2 rounded-md border px-4 py-3 text-[13px]",
        tone === "error"
          ? "border-red-200 bg-red-50 text-red-700"
          : "border-amber-200 bg-amber-50 text-amber-800",
      )}
    >
      <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" strokeWidth={1.6} />
      <span>{children}</span>
    </div>
  );
}

function SaveBar({
  pending,
  saved,
  label,
  onSave,
}: {
  pending: boolean;
  saved: boolean;
  label: string;
  onSave: () => void;
}) {
  return (
    <div className="sticky bottom-4 flex justify-end">
      <button
        type="button"
        disabled={pending}
        onClick={onSave}
        className="inline-flex items-center gap-2 rounded-md bg-primary px-5 py-3 text-[13px] font-semibold text-primary-foreground shadow-lg transition-colors hover:bg-graphite disabled:opacity-60"
      >
        {pending ? (
          <Loader2 className="h-4 w-4 animate-spin" strokeWidth={1.5} />
        ) : saved ? (
          <Check className="h-4 w-4" strokeWidth={1.6} />
        ) : null}
        {saved ? "Salvo" : label}
      </button>
    </div>
  );
}
