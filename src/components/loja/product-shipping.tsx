import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Loader2, MapPin, Store, Truck, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { cepDigits, formatCep } from "@/lib/cep";
import { getProductShippingOptions } from "@/lib/checkout.functions";
import { deliveryDaysLabel } from "@/lib/orders";
import { formatBRL } from "@/lib/products";

// Frete por CEP na página do produto (escopo do catálogo §7, lote 4b). Cliente logado com endereço
// salvo já vê as opções do CEP dele; "Alterar CEP" abre uma janela só com o campo de CEP. O CEP
// trocado aqui vale só para o cálculo (não muda o endereço salvo); fica guardado no navegador.
const LAST_ZIP_KEY = "vynka:cep";

function readLastZip() {
  try {
    return cepDigits(window.localStorage.getItem(LAST_ZIP_KEY) ?? "");
  } catch {
    return "";
  }
}

export function ProductShipping({
  storeId,
  productId,
  variantId,
  quantity,
  savedZip,
}: {
  storeId: string;
  productId: string;
  variantId: string | null;
  quantity: number;
  savedZip: string | null | undefined;
}) {
  const quote = useServerFn(getProductShippingOptions);
  // CEP escolhido aqui > CEP do cadastro > último CEP usado neste navegador.
  const [chosenZip, setChosenZip] = useState("");
  const [lastZip, setLastZip] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  useEffect(() => setLastZip(readLastZip()), []);
  const zip = chosenZip || cepDigits(savedZip ?? "") || lastZip;

  const { data, error, isFetching } = useQuery({
    queryKey: ["product-shipping", storeId, productId, variantId, quantity, zip],
    queryFn: () =>
      quote({
        data: { store_id: storeId, zip, product_id: productId, variant_id: variantId, quantity },
      }),
    enabled: zip.length === 8,
    staleTime: 5 * 60 * 1000,
    retry: false,
  });

  const choose = (value: string) => {
    const digits = cepDigits(value);
    setChosenZip(digits);
    try {
      window.localStorage.setItem(LAST_ZIP_KEY, digits);
    } catch {
      // Navegador sem armazenamento: o CEP vale só nesta página.
    }
  };

  return (
    <div className="mt-6 border-t border-black/10 pt-6">
      <div className="text-[11px] font-medium uppercase tracking-[0.18em] text-neutral-500">
        Frete e prazo
      </div>

      {zip.length !== 8 ? (
        <ZipForm className="mt-3" onSubmit={choose} />
      ) : (
        <>
          <div className="mt-3 flex flex-wrap items-baseline gap-x-3 gap-y-1 text-[13px] text-neutral-700">
            <span>
              Entrega para CEP{" "}
              <strong className="font-semibold text-black">{formatCep(zip)}</strong>
              {data?.address.city ? ` · ${data.address.city}/${data.address.state}` : ""}
            </span>
            <button
              type="button"
              onClick={() => setModalOpen(true)}
              className="text-[12px] text-neutral-500 underline underline-offset-2 hover:text-black"
            >
              Alterar CEP
            </button>
          </div>

          <div className="mt-3" aria-live="polite">
            {isFetching ? (
              <p className="flex items-center gap-2 text-[13px] text-neutral-500">
                <Loader2 className="h-4 w-4 animate-spin" /> Calculando o frete…
              </p>
            ) : error ? (
              <p className="text-[13px] text-red-700">
                {error instanceof Error
                  ? error.message
                  : "Não foi possível calcular o frete agora."}
              </p>
            ) : data ? (
              data.options.length === 0 ? (
                <p className="text-[13px] text-neutral-600">
                  {data.shippingUnavailable
                    ? "Não foi possível calcular o envio agora. Tente de novo em instantes."
                    : "Esta loja ainda não entrega neste CEP."}
                </p>
              ) : (
                <ul className="divide-y divide-black/10 border border-black/10">
                  {data.options.map((option) => (
                    <ShippingRow
                      key={`${option.method}-${option.service_id ?? ""}`}
                      option={option}
                    />
                  ))}
                </ul>
              )
            ) : null}
            {data?.shippingUnavailable && data.options.length > 0 && (
              <p className="mt-2 text-[12px] text-neutral-500">
                O envio por transportadora não pôde ser calculado agora; as opções acima valem.
              </p>
            )}
          </div>
        </>
      )}

      {modalOpen && (
        <ZipModal
          initial={zip}
          onClose={() => setModalOpen(false)}
          onSubmit={(value) => {
            choose(value);
            setModalOpen(false);
          }}
        />
      )}
    </div>
  );
}

function ShippingRow({
  option,
}: {
  option: Awaited<ReturnType<typeof getProductShippingOptions>>["options"][number];
}) {
  const Icon = option.method === "pickup" ? Store : option.method === "local" ? MapPin : Truck;
  const days = deliveryDaysLabel(option.min_days, option.max_days);
  return (
    <li className="flex items-center gap-3 px-4 py-3">
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
            {option.original_price > 0 && (
              <span className="block text-[11px] font-normal text-neutral-400 line-through">
                {formatBRL(option.original_price)}
              </span>
            )}
          </>
        ) : option.price > 0 ? (
          formatBRL(option.price)
        ) : (
          "Grátis"
        )}
      </span>
    </li>
  );
}

function ZipForm({
  initial = "",
  autoFocus,
  className,
  onSubmit,
}: {
  initial?: string;
  autoFocus?: boolean;
  className?: string;
  onSubmit: (zip: string) => void;
}) {
  const [value, setValue] = useState(formatCep(initial));
  const [error, setError] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (autoFocus) inputRef.current?.focus();
  }, [autoFocus]);
  return (
    <form
      className={className}
      onSubmit={(event) => {
        event.preventDefault();
        if (cepDigits(value).length !== 8) {
          setError("Informe um CEP com 8 números.");
          return;
        }
        setError("");
        onSubmit(value);
      }}
    >
      <div className="flex gap-2">
        <input
          ref={inputRef}
          value={value}
          onChange={(event) => setValue(formatCep(event.target.value))}
          inputMode="numeric"
          autoComplete="postal-code"
          placeholder="00000-000"
          aria-label="CEP"
          className="h-11 w-full min-w-0 flex-1 border border-black/15 px-3 text-[14px] outline-none focus:border-black"
        />
        <button
          type="submit"
          className="h-11 shrink-0 border border-black bg-black px-5 text-[12px] font-semibold uppercase tracking-[0.14em] text-white hover:bg-neutral-800"
        >
          Calcular
        </button>
      </div>
      <div className="mt-2 flex items-center justify-between gap-3 text-[12px]">
        <span className="text-red-700" role="alert">
          {error}
        </span>
        <a
          href="https://buscacepinter.correios.com.br/app/endereco/index.php"
          target="_blank"
          rel="noopener noreferrer"
          className="shrink-0 text-neutral-500 underline underline-offset-2 hover:text-black"
        >
          Não sei meu CEP
        </a>
      </div>
    </form>
  );
}

function ZipModal({
  initial,
  onClose,
  onSubmit,
}: {
  initial: string;
  onClose: () => void;
  onSubmit: (zip: string) => void;
}) {
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);
  return (
    <div
      className="fixed inset-0 z-50 grid place-items-center bg-black/30 px-4"
      onClick={onClose}
      role="presentation"
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="alterar-cep-titulo"
        className="w-full max-w-[380px] bg-white p-5 shadow-2xl"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <div
            id="alterar-cep-titulo"
            className="text-[12px] font-semibold uppercase tracking-[0.2em] text-black"
          >
            Alterar CEP
          </div>
          <button
            type="button"
            onClick={onClose}
            className="grid h-9 w-9 place-items-center rounded-full hover:bg-neutral-100"
            aria-label="Fechar"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <ZipForm className="mt-4" initial={initial} autoFocus onSubmit={onSubmit} />
      </div>
    </div>
  );
}
