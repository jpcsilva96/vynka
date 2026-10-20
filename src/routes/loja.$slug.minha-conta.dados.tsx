import { createFileRoute } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useState, type FormEvent } from "react";
import {
  AccountField,
  AccountTitle,
  PrimaryButton,
  StatusMessage,
} from "@/components/loja/account-ui";
import { formatPhone, isValidPhone, onlyDigits } from "@/lib/br-documents";
import {
  changeCustomerPassword,
  updateCustomerProfile,
  useStoreCustomer,
} from "@/lib/customer-account";
import { useStorefront } from "@/lib/storefront-context";

// Meus dados: nome e telefone editáveis; e-mail só leitura (João, 20/10); troca de senha com a atual.
export const Route = createFileRoute("/loja/$slug/minha-conta/dados")({
  component: CustomerDataPage,
});

function CustomerDataPage() {
  const store = useStorefront();
  const queryClient = useQueryClient();
  const { data: customer } = useStoreCustomer(store.id);
  const [profile, setProfile] = useState({ name: "", phone: "" });
  const [profileStatus, setProfileStatus] = useState({ text: "", error: false });
  const [savingProfile, setSavingProfile] = useState(false);
  const [password, setPassword] = useState({ current: "", next: "", confirm: "" });
  const [passwordStatus, setPasswordStatus] = useState({ text: "", error: false });
  const [savingPassword, setSavingPassword] = useState(false);

  useEffect(() => {
    if (customer)
      setProfile({ name: customer.name ?? "", phone: onlyDigits(customer.phone ?? "") });
  }, [customer]);

  if (!customer) return null;

  const saveProfile = async (event: FormEvent) => {
    event.preventDefault();
    if (!profile.name.trim()) return setProfileStatus({ text: "Informe seu nome.", error: true });
    if (!isValidPhone(profile.phone))
      return setProfileStatus({ text: "Informe seu telefone com DDD.", error: true });
    setSavingProfile(true);
    setProfileStatus({ text: "", error: false });
    try {
      await updateCustomerProfile(store.id, customer, profile);
      await queryClient.invalidateQueries({ queryKey: ["store-customer", store.id] });
      setProfileStatus({ text: "Dados salvos.", error: false });
    } catch (err) {
      setProfileStatus({
        text: err instanceof Error ? err.message : "Não foi possível salvar.",
        error: true,
      });
    } finally {
      setSavingProfile(false);
    }
  };

  const savePassword = async (event: FormEvent) => {
    event.preventDefault();
    if (password.next.length < 6)
      return setPasswordStatus({
        text: "A nova senha precisa ter pelo menos 6 caracteres.",
        error: true,
      });
    if (password.next !== password.confirm)
      return setPasswordStatus({ text: "A confirmação não é igual à nova senha.", error: true });
    setSavingPassword(true);
    setPasswordStatus({ text: "", error: false });
    try {
      await changeCustomerPassword(store.id, password.current, password.next);
      setPassword({ current: "", next: "", confirm: "" });
      setPasswordStatus({ text: "Senha trocada.", error: false });
    } catch (err) {
      setPasswordStatus({
        text: err instanceof Error ? err.message : "Não foi possível trocar a senha.",
        error: true,
      });
    } finally {
      setSavingPassword(false);
    }
  };

  return (
    <div className="grid gap-10">
      <form onSubmit={saveProfile} className="grid gap-5">
        <AccountTitle title="Meus dados" />
        <div className="grid gap-4 sm:grid-cols-2">
          <AccountField
            label="Nome"
            value={profile.name}
            autoComplete="name"
            maxLength={120}
            onChange={(name) => setProfile((current) => ({ ...current, name }))}
          />
          <AccountField
            label="Telefone"
            type="tel"
            inputMode="tel"
            autoComplete="tel"
            value={formatPhone(profile.phone)}
            onChange={(value) =>
              setProfile((current) => ({ ...current, phone: onlyDigits(value).slice(0, 11) }))
            }
          />
          <AccountField
            label="E-mail"
            value={customer.email ?? ""}
            disabled
            hint="O e-mail identifica sua conta e não pode ser trocado por aqui."
            className="sm:col-span-2"
          />
        </div>
        <StatusMessage {...profileStatus} />
        <PrimaryButton busy={savingProfile}>
          {savingProfile ? "Salvando..." : "Salvar dados"}
        </PrimaryButton>
      </form>

      <form onSubmit={savePassword} className="grid gap-5 border-t border-black/10 pt-8">
        <AccountTitle
          title="Trocar senha"
          description="Para trocar, confirme a senha que você usa hoje."
        />
        <div className="grid gap-4 sm:grid-cols-3">
          <AccountField
            label="Senha atual"
            type="password"
            autoComplete="current-password"
            value={password.current}
            required
            onChange={(current) => setPassword((state) => ({ ...state, current }))}
          />
          <AccountField
            label="Nova senha"
            type="password"
            autoComplete="new-password"
            value={password.next}
            required
            onChange={(next) => setPassword((state) => ({ ...state, next }))}
          />
          <AccountField
            label="Confirmar nova senha"
            type="password"
            autoComplete="new-password"
            value={password.confirm}
            required
            onChange={(confirm) => setPassword((state) => ({ ...state, confirm }))}
          />
        </div>
        <StatusMessage {...passwordStatus} />
        <PrimaryButton busy={savingPassword}>
          {savingPassword ? "Trocando..." : "Trocar senha"}
        </PrimaryButton>
      </form>
    </div>
  );
}
