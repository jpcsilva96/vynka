import { createFileRoute } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { useState, type FormEvent } from "react";
import {
  AccountField,
  AccountTitle,
  PrimaryButton,
  SecondaryButton,
  StatusMessage,
} from "@/components/loja/account-ui";
import { cepDigits, formatCep, lookupCep } from "@/lib/cep";
import {
  MAX_CUSTOMER_ADDRESSES,
  deleteCustomerAddress,
  saveCustomerAddress,
  setDefaultCustomerAddress,
  useCustomerAddresses,
  useStoreCustomer,
  type CustomerAddress,
  type CustomerAddressForm,
} from "@/lib/customer-account";
import { useStorefront } from "@/lib/storefront-context";

// Meus endereços (catálogo lote 5; banco no lote 5a): até 10, um principal. O principal é o que o
// checkout já preenche.
export const Route = createFileRoute("/loja/$slug/minha-conta/enderecos")({
  component: CustomerAddressesPage,
});

type Draft = CustomerAddressForm & { id?: string; label: string; is_default: boolean };

const emptyDraft: Draft = {
  label: "",
  zip_code: "",
  street: "",
  address_number: "",
  complement: "",
  neighborhood: "",
  city: "",
  state: "",
  is_default: false,
};

const toDraft = (address: CustomerAddress): Draft => ({
  id: address.id,
  label: address.label ?? "",
  zip_code: formatCep(address.zip_code),
  street: address.street,
  address_number: address.address_number,
  complement: address.complement ?? "",
  neighborhood: address.neighborhood,
  city: address.city,
  state: address.state,
  is_default: address.is_default,
});

function CustomerAddressesPage() {
  const store = useStorefront();
  const queryClient = useQueryClient();
  const { data: customer } = useStoreCustomer(store.id);
  const { data: addresses = [], isLoading } = useCustomerAddresses(store.id, !!customer);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [status, setStatus] = useState({ text: "", error: false });

  if (!customer) return null;

  const refresh = async () => {
    await queryClient.invalidateQueries({ queryKey: ["customer-addresses", store.id] });
    await queryClient.invalidateQueries({ queryKey: ["store-customer", store.id] });
  };

  const run = async (action: () => Promise<void>, done: string) => {
    setStatus({ text: "", error: false });
    try {
      await action();
      await refresh();
      setStatus({ text: done, error: false });
    } catch (err) {
      setStatus({
        text: err instanceof Error ? err.message : "Não foi possível salvar.",
        error: true,
      });
    }
  };

  const full = addresses.length >= MAX_CUSTOMER_ADDRESSES;

  return (
    <div className="grid gap-6">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <AccountTitle
          title="Meus endereços"
          description={`O principal já vem preenchido na hora de comprar. Até ${MAX_CUSTOMER_ADDRESSES} endereços.`}
        />
        {!draft && !full && (
          <SecondaryButton
            onClick={() => {
              setStatus({ text: "", error: false });
              setDraft({ ...emptyDraft });
            }}
          >
            Novo endereço
          </SecondaryButton>
        )}
      </div>

      {!draft && <StatusMessage {...status} />}

      {draft && (
        <AddressForm
          draft={draft}
          onChange={(update) => setDraft((current) => (current ? update(current) : current))}
          onCancel={() => setDraft(null)}
          onSave={async () => {
            let ok = false;
            await run(
              async () => {
                await saveCustomerAddress(store.id, customer, draft);
                ok = true;
              },
              draft.id ? "Endereço atualizado." : "Endereço salvo.",
            );
            if (ok) setDraft(null);
          }}
          status={status}
        />
      )}

      {isLoading ? (
        <p className="text-[13px] text-neutral-500">Carregando...</p>
      ) : addresses.length === 0 && !draft ? (
        <div className="border border-dashed border-black/15 px-5 py-10 text-center text-[13px] text-neutral-500">
          Nenhum endereço salvo ainda.
        </div>
      ) : (
        <ul className="grid gap-3 lg:grid-cols-2">
          {addresses.map((address) => (
            <AddressCard
              key={address.id}
              address={address}
              onEdit={() => {
                setStatus({ text: "", error: false });
                setDraft(toDraft(address));
              }}
              onMakeDefault={() =>
                run(
                  () => setDefaultCustomerAddress(store.id, address.id),
                  "Endereço principal trocado.",
                )
              }
              onDelete={() =>
                run(() => deleteCustomerAddress(store.id, address.id), "Endereço apagado.")
              }
            />
          ))}
        </ul>
      )}
      {full && !draft && (
        <p className="text-[12px] text-neutral-500">
          Você chegou ao limite de {MAX_CUSTOMER_ADDRESSES} endereços. Apague um para salvar outro.
        </p>
      )}
    </div>
  );
}

function AddressCard({
  address,
  onEdit,
  onMakeDefault,
  onDelete,
}: {
  address: CustomerAddress;
  onEdit: () => void;
  onMakeDefault: () => void;
  onDelete: () => void;
}) {
  const [confirming, setConfirming] = useState(false);
  const linkClass =
    "min-h-11 text-[12px] font-medium uppercase tracking-[0.14em] text-neutral-600 underline-offset-4 hover:text-black hover:underline";
  return (
    <li className="border border-black/10 bg-white p-4">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-[14px] font-semibold text-black">{address.label || "Endereço"}</span>
        {address.is_default && (
          <span className="border border-black px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-black">
            Principal
          </span>
        )}
      </div>
      <p className="mt-2 break-words text-[13px] leading-relaxed text-neutral-600">
        {address.street}, {address.address_number}
        {address.complement ? ` · ${address.complement}` : ""}
        <br />
        {address.neighborhood} · {address.city}/{address.state}
        <br />
        CEP {formatCep(address.zip_code)}
      </p>
      {confirming ? (
        <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1">
          <span className="text-[13px] text-black">Apagar este endereço?</span>
          <button type="button" onClick={onDelete} className={`${linkClass} text-red-700`}>
            Sim, apagar
          </button>
          <button type="button" onClick={() => setConfirming(false)} className={linkClass}>
            Não
          </button>
        </div>
      ) : (
        <div className="mt-3 flex flex-wrap gap-x-5 gap-y-1">
          <button type="button" onClick={onEdit} className={linkClass}>
            Editar
          </button>
          {!address.is_default && (
            <button type="button" onClick={onMakeDefault} className={linkClass}>
              Tornar principal
            </button>
          )}
          <button type="button" onClick={() => setConfirming(true)} className={linkClass}>
            Apagar
          </button>
        </div>
      )}
    </li>
  );
}

function AddressForm({
  draft,
  onChange,
  onCancel,
  onSave,
  status,
}: {
  draft: Draft;
  onChange: (update: (draft: Draft) => Draft) => void;
  onCancel: () => void;
  onSave: () => Promise<void>;
  status: { text: string; error: boolean };
}) {
  const [cepStatus, setCepStatus] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const set = (key: keyof Draft) => (value: string) =>
    onChange((current) => ({ ...current, [key]: value }));

  // CEP completo: busca rua, bairro, cidade e UF (número e complemento ficam com o cliente).
  const changeCep = async (value: string) => {
    const zip = formatCep(value);
    onChange((current) => ({ ...current, zip_code: zip }));
    if (cepDigits(zip).length !== 8) return setCepStatus("");
    setCepStatus("Buscando endereço…");
    try {
      const found = await lookupCep(zip);
      if (!found)
        return setCepStatus("CEP não encontrado. Confira os números ou preencha o endereço.");
      // Só aplica se o CEP ainda é o buscado (o cliente pode ter digitado outro no meio).
      onChange((current) =>
        current.zip_code !== zip
          ? current
          : {
              ...current,
              street: found.street || current.street,
              neighborhood: found.neighborhood || current.neighborhood,
              city: found.city || current.city,
              state: found.state || current.state,
            },
      );
      setCepStatus("");
    } catch {
      setCepStatus("Não foi possível buscar o CEP agora. Preencha o endereço.");
    }
  };

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    const missing =
      cepDigits(draft.zip_code).length !== 8
        ? "Informe o CEP com 8 números."
        : !draft.street.trim()
          ? "Informe a rua."
          : !draft.address_number.trim()
            ? "Informe o número (ou S/N)."
            : !draft.neighborhood.trim()
              ? "Informe o bairro."
              : !draft.city.trim()
                ? "Informe a cidade."
                : !/^[A-Za-z]{2}$/.test(draft.state.trim())
                  ? "Informe o estado com 2 letras (ex.: SP)."
                  : "";
    if (missing) return setError(missing);
    setError("");
    setSaving(true);
    try {
      await onSave();
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={submit} className="grid gap-4 border border-black/10 bg-white p-4 md:p-6">
      <h3 className="text-[16px] font-semibold text-black">
        {draft.id ? "Editar endereço" : "Novo endereço"}
      </h3>
      <div className="grid gap-4 sm:grid-cols-2">
        <AccountField
          label="CEP"
          value={draft.zip_code}
          onChange={changeCep}
          inputMode="numeric"
          autoComplete="postal-code"
          hint={cepStatus}
        />
        <AccountField
          label="Nome do endereço (opcional)"
          value={draft.label}
          onChange={set("label")}
          maxLength={40}
          hint="Ex.: Casa, Trabalho"
        />
        <AccountField
          label="Rua"
          value={draft.street}
          onChange={set("street")}
          autoComplete="address-line1"
          maxLength={200}
          className="sm:col-span-2"
        />
        <AccountField
          label="Número"
          value={draft.address_number}
          onChange={set("address_number")}
          maxLength={20}
        />
        <AccountField
          label="Complemento"
          value={draft.complement}
          onChange={set("complement")}
          autoComplete="address-line2"
          maxLength={120}
        />
        <AccountField
          label="Bairro"
          value={draft.neighborhood}
          onChange={set("neighborhood")}
          maxLength={120}
        />
        <AccountField
          label="Cidade"
          value={draft.city}
          onChange={set("city")}
          autoComplete="address-level2"
          maxLength={120}
        />
        <AccountField
          label="Estado (UF)"
          value={draft.state}
          onChange={(value) => set("state")(value.toUpperCase().slice(0, 2))}
          autoComplete="address-level1"
        />
      </div>
      {!draft.id || !draft.is_default ? (
        <label className="flex min-h-11 items-center gap-3 text-[14px] text-black">
          <input
            type="checkbox"
            checked={draft.is_default}
            onChange={(event) => {
              const checked = event.target.checked;
              onChange((current) => ({ ...current, is_default: checked }));
            }}
            className="h-5 w-5"
          />
          Usar como endereço principal
        </label>
      ) : null}
      <StatusMessage text={error || (status.error ? status.text : "")} error />
      <div className="flex flex-col gap-3 sm:flex-row">
        <PrimaryButton busy={saving}>{saving ? "Salvando..." : "Salvar endereço"}</PrimaryButton>
        <SecondaryButton onClick={onCancel}>Cancelar</SecondaryButton>
      </div>
    </form>
  );
}
