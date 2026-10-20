import { Link } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import { buildWhatsAppLink } from "@/lib/cart";
import { signInCustomer, signUpCustomer } from "@/lib/customer-account";
import type { CustomerAuthMode } from "@/lib/customer-auth-dialog";
import { formatPhone, isValidPhone, onlyDigits } from "@/lib/br-documents";
import { useStorefront } from "@/lib/storefront-context";

// Formulário de entrar / criar conta / esqueci a senha da loja: o mesmo na janela (cabeçalho,
// favoritar) e na página /entrar. A conta é desta loja (login por loja): entra com e-mail ou telefone.
export function CustomerAuthForm({
  initialMode = "login",
  onDone,
  onNavigate,
}: {
  initialMode?: CustomerAuthMode;
  // Entrou ou criou a conta.
  onDone: () => void;
  // Clicou num link que sai da janela (ex.: Contato).
  onNavigate?: () => void;
}) {
  const store = useStorefront();
  const queryClient = useQueryClient();
  const [mode, setMode] = useState<CustomerAuthMode>(initialMode);
  const [form, setForm] = useState({ name: "", phone: "", email: "", password: "" });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => setMode(initialMode), [initialMode]);

  const switchMode = (next: CustomerAuthMode) => {
    setMode(next);
    setError("");
  };

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setError("");
    if (mode === "signup" && !isValidPhone(form.phone)) {
      setError("Informe seu telefone com DDD.");
      return;
    }
    setLoading(true);
    try {
      if (mode === "signup") {
        await signUpCustomer({ storeId: store.id, ...form });
      } else {
        // Sem conta nesta loja, a resposta é a mesma de senha errada; criar conta é pelo link abaixo.
        await signInCustomer(store.id, form.email, form.password);
      }
      await queryClient.invalidateQueries({ queryKey: ["store-customer", store.id] });
      setForm((current) => ({ ...current, password: "" }));
      onDone();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não foi possível entrar.");
    } finally {
      setLoading(false);
    }
  };

  const set = (key: keyof typeof form) => (value: string) =>
    setForm((current) => ({ ...current, [key]: value }));

  if (mode === "forgot") {
    // Sem envio de e-mail ainda (lote de e-mails): a recuperação é com a loja.
    const whatsapp = store.whatsapp
      ? buildWhatsAppLink(
          `Olá! Esqueci a senha da minha conta na ${store.name}. Pode me ajudar a recuperar o acesso?`,
          store.whatsapp,
        )
      : null;
    return (
      <div>
        <h2 className="text-2xl font-semibold text-black">Esqueci minha senha</h2>
        <p className="mt-3 text-[14px] leading-relaxed text-neutral-600">
          Para recuperar o acesso à sua conta, fale com a {store.name}
          {whatsapp ? " pelo WhatsApp." : " pelos canais de contato."}
        </p>
        {whatsapp ? (
          <a
            href={whatsapp}
            target="_blank"
            rel="noreferrer"
            className="mt-6 flex h-12 items-center justify-center bg-black px-5 text-[12px] font-semibold uppercase tracking-[0.16em] text-white hover:bg-neutral-800"
          >
            Falar com a loja no WhatsApp
          </a>
        ) : (
          store.catalog_visual.contact_enabled && (
            <Link
              to="/loja/$slug/contato"
              params={{ slug: store.slug }}
              onClick={onNavigate}
              className="mt-6 flex h-12 items-center justify-center bg-black px-5 text-[12px] font-semibold uppercase tracking-[0.16em] text-white hover:bg-neutral-800"
            >
              Ver contatos da loja
            </Link>
          )
        )}
        <button
          type="button"
          onClick={() => switchMode("login")}
          className="mt-5 min-h-11 text-[13px] text-neutral-600 underline underline-offset-4 hover:text-black"
        >
          Voltar para entrar
        </button>
      </div>
    );
  }

  return (
    <div>
      <h2 className="text-2xl font-semibold text-black">
        {mode === "login" ? "Entrar" : "Criar conta"}
      </h2>
      <p className="mt-2 text-[13px] text-neutral-500">
        {mode === "login"
          ? `Entre na sua conta da ${store.name}.`
          : "Acompanhe suas compras, salve endereços e favorite produtos."}
      </p>

      <form onSubmit={submit} className="mt-6 grid gap-4">
        {mode === "signup" && (
          <>
            <Field
              label="Nome"
              value={form.name}
              onChange={set("name")}
              autoComplete="name"
              required
            />
            <Field
              label="Telefone"
              type="tel"
              inputMode="tel"
              autoComplete="tel"
              value={formatPhone(form.phone)}
              onChange={(value) => set("phone")(onlyDigits(value).slice(0, 11))}
              required
            />
          </>
        )}
        {mode === "login" ? (
          <Field
            label="E-mail ou telefone"
            value={form.email}
            onChange={set("email")}
            autoComplete="username"
            required
          />
        ) : (
          <Field
            label="E-mail"
            type="email"
            inputMode="email"
            autoComplete="email"
            value={form.email}
            onChange={set("email")}
            required
          />
        )}
        <Field
          label="Senha"
          type="password"
          value={form.password}
          onChange={set("password")}
          autoComplete={mode === "login" ? "current-password" : "new-password"}
          required
        />
        {mode === "login" && (
          <button
            type="button"
            onClick={() => switchMode("forgot")}
            className="-mt-1 w-max text-[12px] text-neutral-500 underline underline-offset-4 hover:text-black"
          >
            Esqueci minha senha
          </button>
        )}
        {error && (
          <div
            role="alert"
            className="border border-red-200 bg-red-50 px-3 py-2 text-[13px] text-red-700"
          >
            {error}
          </div>
        )}
        <button
          disabled={loading}
          className="h-12 bg-black px-5 text-[12px] font-semibold uppercase tracking-[0.16em] text-white hover:bg-neutral-800 disabled:opacity-50"
        >
          {loading ? "Aguarde..." : mode === "login" ? "Entrar" : "Criar conta"}
        </button>
      </form>

      <p className="mt-5 text-[13px] text-neutral-600">
        {mode === "login" ? "Novo por aqui? " : "Já tem conta? "}
        <button
          type="button"
          onClick={() => switchMode(mode === "login" ? "signup" : "login")}
          className="min-h-11 font-medium text-black underline underline-offset-4"
        >
          {mode === "login" ? "Cadastre-se" : "Entrar"}
        </button>
      </p>
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  type = "text",
  inputMode,
  autoComplete,
  required = false,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
  inputMode?: "tel" | "email";
  autoComplete?: string;
  required?: boolean;
}) {
  return (
    <label className="grid gap-2">
      <span className="text-[12px] font-medium uppercase tracking-[0.14em] text-neutral-500">
        {label}
      </span>
      <input
        type={type}
        value={value}
        required={required}
        inputMode={inputMode}
        autoComplete={autoComplete}
        onChange={(event) => onChange(event.target.value)}
        className="h-12 border border-black/10 px-3 text-[16px] outline-none focus:border-black md:h-11 md:text-[14px]"
      />
    </label>
  );
}
