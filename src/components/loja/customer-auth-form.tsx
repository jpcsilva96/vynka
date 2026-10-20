import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import { signInCustomer, signUpCustomer } from "@/lib/customer-account";
import type { CustomerAuthMode } from "@/lib/customer-auth-dialog";
import { formatPhone, isValidPhone, onlyDigits } from "@/lib/br-documents";
import { useStorefront } from "@/lib/storefront-context";

// Formulário de entrar / criar conta da loja: o mesmo na janela (cabeçalho,
// favoritar) e na página /entrar. A conta é desta loja (login por loja): entra com e-mail ou telefone.
export function CustomerAuthForm({
  initialMode = "login",
  onDone,
}: {
  initialMode?: CustomerAuthMode;
  // Entrou ou criou a conta.
  onDone: () => void;
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
        {/* "Esqueci minha senha" entra aqui com o lote de e-mails (link enviado ao e-mail real da
            ficha; login-por-loja L5). Até lá não aparece: sem e-mail, não há como recuperar. */}
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
