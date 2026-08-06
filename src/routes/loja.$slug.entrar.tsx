import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import type { FormEvent } from "react";
import { EmailConfirmationRequiredError, signInCustomer, signUpCustomer, upsertStoreCustomer } from "@/lib/customer-account";
import { useStorefront } from "@/lib/storefront-context";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/loja/$slug/entrar")({
  component: CustomerLoginPage,
});

function CustomerLoginPage() {
  const store = useStorefront();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [form, setForm] = useState({
    name: "",
    phone: "",
    email: "",
    password: "",
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setLoading(true);
    setError("");
    setSuccess("");
    try {
      if (mode === "signup") {
        await signUpCustomer({
          storeId: store.id,
          name: form.name,
          phone: form.phone,
          email: form.email,
          password: form.password,
        });
      } else {
        await signInCustomer(form.email, form.password);
        const { data } = await supabase.auth.getUser();
        await upsertStoreCustomer(store.id, {
          name: form.name || data.user?.user_metadata?.full_name || form.email.split("@")[0],
          phone: form.phone || data.user?.user_metadata?.phone || null,
          email: form.email,
        });
      }
      await queryClient.invalidateQueries({ queryKey: ["store-customer", store.id] });
      navigate({ to: "/loja/$slug/minha-conta", params: { slug: store.slug } });
    } catch (err) {
      if (err instanceof EmailConfirmationRequiredError) {
        setSuccess("Cadastro criado. Confirme seu e-mail e depois volte para entrar.");
        setMode("login");
        return;
      }
      setError(err instanceof Error ? err.message : "Nao foi possivel entrar.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mx-auto max-w-md px-4 py-12 md:py-16">
      <Link to="/loja/$slug" params={{ slug: store.slug }} className="text-[12px] uppercase tracking-[0.16em] text-neutral-500 hover:text-black">
        Voltar para loja
      </Link>
      <div className="mt-8 border border-black/10 bg-white p-6">
        <div className="text-[11px] font-medium uppercase tracking-[0.24em] text-neutral-500">{store.name}</div>
        <h1 className="mt-2 text-3xl font-semibold text-black">
          {mode === "login" ? "Entrar" : "Criar conta"}
        </h1>
        <p className="mt-2 text-[13px] text-neutral-500">
          Acompanhe suas compras, salve endereco e favorite produtos.
        </p>

        <form onSubmit={submit} className="mt-6 grid gap-4">
          {mode === "signup" && (
            <>
              <Field label="Nome" value={form.name} onChange={(value) => setForm((current) => ({ ...current, name: value }))} required />
              <Field label="Telefone" value={form.phone} onChange={(value) => setForm((current) => ({ ...current, phone: value }))} required />
            </>
          )}
          <Field label="E-mail" type="email" value={form.email} onChange={(value) => setForm((current) => ({ ...current, email: value }))} required />
          <Field label="Senha" type="password" value={form.password} onChange={(value) => setForm((current) => ({ ...current, password: value }))} required />
          {success && <div className="border border-emerald-200 bg-emerald-50 px-3 py-2 text-[13px] text-emerald-700">{success}</div>}
          {error && <div className="border border-red-200 bg-red-50 px-3 py-2 text-[13px] text-red-700">{error}</div>}
          <button disabled={loading} className="bg-black px-5 py-3 text-[12px] font-semibold uppercase tracking-[0.16em] text-white hover:bg-neutral-800 disabled:opacity-50">
            {loading ? "Aguarde..." : mode === "login" ? "Entrar" : "Criar conta"}
          </button>
        </form>

        <button
          type="button"
          onClick={() => setMode((current) => (current === "login" ? "signup" : "login"))}
          className="mt-5 text-[13px] text-neutral-600 underline underline-offset-4 hover:text-black"
        >
          {mode === "login" ? "Ainda nao tenho conta" : "Ja tenho conta"}
        </button>
      </div>
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  type = "text",
  required = false,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
  required?: boolean;
}) {
  return (
    <label className="grid gap-2">
      <span className="text-[12px] font-medium uppercase tracking-[0.14em] text-neutral-500">{label}</span>
      <input
        type={type}
        value={value}
        required={required}
        onChange={(event) => onChange(event.target.value)}
        className="h-11 border border-black/10 px-3 text-[14px] outline-none focus:border-black"
      />
    </label>
  );
}
