import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useCallback, useEffect, useRef, useState } from "react";
import { Eye, EyeOff, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { VynkaLogo } from "@/components/vynka-logo";
import { useStoreContext } from "@/lib/store-context";
import { completeOwnerSignup, getOwnerSignup } from "@/lib/owner-signup.functions";
import { isValidCpf, isValidPhone, maskCpf, maskPhone } from "@/lib/br-documents";
import { normalizeSlug } from "@/lib/store-settings";
import {
  readAccessLinkToken,
  redeemAccessLinkToken,
  type AccessLinkToken,
} from "@/lib/access-link";

export const Route = createFileRoute("/boas-vindas")({
  head: () => ({
    meta: [
      { title: "Boas-vindas · VYNKA" },
      { name: "description", content: "Complete seu cadastro e crie o acesso à sua loja VYNKA." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: WelcomePage,
});

const MIN_PASSWORD = 8;
// Tempo para o supabase-js ler o token do link (hash da URL) e abrir a sessão.
const SESSION_WAIT_MS = 4000;

const inputClass =
  "w-full rounded-md border border-border bg-background px-3 py-2.5 text-[14px] outline-none focus:border-foreground/40";

// Enquanto digita, aceita hífen no fim ("minha-"); o link final passa por normalizeSlug.
const typingSlug = (value: string) =>
  value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9-]+/g, "-")
    .replace(/-{2,}/g, "-")
    .replace(/^-+/, "")
    .slice(0, 60);

type Form = {
  full_name: string;
  cpf: string;
  phone: string;
  store_name: string;
  slug: string;
  password: string;
  confirm: string;
};

function WelcomePage() {
  const navigate = useNavigate();
  const { refresh } = useStoreContext();
  const fetchSignup = useServerFn(getOwnerSignup);
  const saveSignup = useServerFn(completeOwnerSignup);

  const [email, setEmail] = useState<string | null>(null);
  const [checking, setChecking] = useState(true);
  const [noStore, setNoStore] = useState(false);
  const [slugTouched, setSlugTouched] = useState(false);
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState<Form>({
    full_name: "",
    cpf: "",
    phone: "",
    store_name: "",
    slug: "",
    password: "",
    confirm: "",
  });

  // Link novo (?token_hash=...): a tela espera o clique em "Começar cadastro" para usar o token.
  const [linkToken, setLinkToken] = useState<AccessLinkToken | null>(null);
  const [linkError, setLinkError] = useState<string | null>(null);
  const [starting, setStarting] = useState(false);
  const loadedRef = useRef(false);

  // Sessão aberta (pelo token ou já existente): carrega os dados do cadastro.
  const loadSignup = useCallback(
    async (userEmail: string | undefined) => {
      if (loadedRef.current) return;
      loadedRef.current = true;
      setEmail(userEmail ?? "");
      try {
        const res = await fetchSignup({});
        if (!res.store) {
          setNoStore(true);
        } else {
          setForm((f) => ({
            ...f,
            full_name: res.profile.full_name,
            phone: maskPhone(res.profile.phone),
            store_name: res.store!.name,
            slug: res.store!.slug,
          }));
          if (res.store.slug) setSlugTouched(true);
        }
      } catch {
        setNoStore(true);
      } finally {
        setChecking(false);
      }
    },
    [fetchSignup],
  );

  const startSignup = async () => {
    if (!linkToken) return;
    setStarting(true);
    setLinkError(null);
    const res = await redeemAccessLinkToken(linkToken);
    setStarting(false);
    if (!res.session) {
      setLinkError(res.error);
      return;
    }
    setLinkToken(null);
    setChecking(true);
    await loadSignup(res.session.user.email);
  };

  // O link do convite abre uma sessão temporária; só ela permite gravar o cadastro e a senha.
  useEffect(() => {
    const token = readAccessLinkToken();
    if (token) {
      // Não usa uma sessão que já esteja aberta neste navegador (ex. a do master).
      setLinkToken(token);
      setChecking(false);
      return;
    }
    let active = true;
    const open = (userEmail: string | undefined) => {
      if (active) void loadSignup(userEmail);
    };
    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      if (session && (event === "PASSWORD_RECOVERY" || event === "SIGNED_IN")) {
        void open(session.user.email);
      }
    });
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) void open(data.session.user.email);
    });
    const timer = setTimeout(() => {
      if (active && !loadedRef.current) setChecking(false);
    }, SESSION_WAIT_MS);
    return () => {
      active = false;
      clearTimeout(timer);
      sub.subscription.unsubscribe();
    };
  }, [loadSignup]);

  const patch = (key: keyof Form, value: string) => setForm((f) => ({ ...f, [key]: value }));

  const onStoreNameChange = (value: string) => {
    setForm((f) => ({
      ...f,
      store_name: value,
      slug: slugTouched ? f.slug : normalizeSlug(value),
    }));
  };

  const validate = (): string | null => {
    if (form.full_name.trim().length < 3) return "Informe o nome completo.";
    if (form.cpf && !isValidCpf(form.cpf))
      return "CPF inválido. Confira os números ou deixe em branco.";
    if (!isValidPhone(form.phone)) return "Informe o celular com DDD.";
    if (form.store_name.trim().length < 2) return "Informe o nome da loja.";
    if (normalizeSlug(form.slug).length < 2) return "Informe o link da loja.";
    if (form.password.length < MIN_PASSWORD)
      return `A senha precisa ter pelo menos ${MIN_PASSWORD} caracteres.`;
    if (form.password !== form.confirm) return "As senhas não conferem.";
    return null;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    const invalid = validate();
    if (invalid) {
      setError(invalid);
      return;
    }
    setLoading(true);
    try {
      await saveSignup({
        data: {
          full_name: form.full_name,
          cpf: form.cpf,
          phone: form.phone,
          store_name: form.store_name,
          slug: normalizeSlug(form.slug),
        },
      });
      const { error: updErr } = await supabase.auth.updateUser({
        password: form.password,
        data: { full_name: form.full_name.trim(), signup_completed: true },
      });
      if (updErr) throw updErr;
      await refresh();
      navigate({ to: "/admin", replace: true });
    } catch (err) {
      setError(
        err instanceof Error && err.message
          ? err.message
          : "Não foi possível concluir o cadastro. Tente novamente.",
      );
    } finally {
      setLoading(false);
    }
  };

  const origin = typeof window !== "undefined" ? window.location.host : "vynka.lovable.app";
  const ready = !checking && !linkToken && email !== null && !noStore;

  return (
    <div className="min-h-svh bg-background text-foreground">
      <div className="mx-auto flex min-h-svh max-w-lg flex-col justify-center px-6 py-12">
        <div className="mb-10 flex items-center justify-center">
          <VynkaLogo className="text-[28px]" />
        </div>

        <div className="rounded-2xl border border-border bg-surface p-8">
          <h1 className="text-[22px] font-medium tracking-tight">Seja bem-vindo à VYNKA!</h1>
          <p className="mt-2 text-[13px] leading-relaxed text-muted-foreground">
            Que bom ter você aqui. Complete seu cadastro e dê um nome à sua loja: em poucos minutos
            você já pode cadastrar seus produtos, registrar suas vendas e, quando quiser, publicar
            seu catálogo para os clientes.
          </p>

          {checking && (
            <p className="mt-6 flex items-center gap-2 text-[13px] text-muted-foreground">
              <Loader2 className="h-3.5 w-3.5 animate-spin" strokeWidth={1.5} />
              Validando o link...
            </p>
          )}

          {!checking && linkToken && (
            <div className="mt-6 space-y-4">
              {linkError ? (
                <>
                  <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-[12px] text-red-800">
                    {linkError}
                  </div>
                  <Link
                    to="/login"
                    className="text-[13px] text-foreground underline underline-offset-2"
                  >
                    Ir para o login
                  </Link>
                </>
              ) : (
                <button
                  type="button"
                  onClick={startSignup}
                  disabled={starting}
                  className="inline-flex w-full items-center justify-center gap-2 rounded-md bg-foreground px-4 py-2.5 text-[13px] font-medium text-background transition-colors hover:bg-graphite disabled:opacity-50"
                >
                  {starting && <Loader2 className="h-3.5 w-3.5 animate-spin" strokeWidth={1.5} />}
                  Começar cadastro
                </button>
              )}
            </div>
          )}

          {!checking && !linkToken && (email === null || noStore) && (
            <div className="mt-6 space-y-4">
              <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-[12px] text-red-800">
                {email === null
                  ? "Este link é inválido ou expirou. Peça um novo convite à VYNKA."
                  : "Não encontramos uma loja vinculada ao seu acesso. Fale com a VYNKA."}
              </div>
              <Link
                to="/login"
                className="text-[13px] text-foreground underline underline-offset-2"
              >
                Ir para o login
              </Link>
            </div>
          )}

          {ready && (
            <form onSubmit={handleSubmit} className="mt-6 space-y-5">
              <fieldset className="space-y-4">
                <legend className="mb-1 text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
                  Seus dados
                </legend>
                <Field label="Nome completo">
                  <input
                    required
                    value={form.full_name}
                    onChange={(e) => patch("full_name", e.target.value)}
                    autoComplete="name"
                    className={inputClass}
                  />
                </Field>
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field label="CPF (opcional)">
                    <input
                      inputMode="numeric"
                      value={form.cpf}
                      onChange={(e) => patch("cpf", maskCpf(e.target.value))}
                      className={inputClass}
                    />
                  </Field>
                  <Field label="Nº de celular">
                    <input
                      required
                      inputMode="tel"
                      value={form.phone}
                      onChange={(e) => patch("phone", maskPhone(e.target.value))}
                      autoComplete="tel"
                      className={inputClass}
                    />
                  </Field>
                </div>
                <Field label="E-mail">
                  <input
                    value={email ?? ""}
                    readOnly
                    disabled
                    className={`${inputClass} cursor-not-allowed opacity-70`}
                  />
                </Field>
              </fieldset>

              <fieldset className="space-y-4">
                <legend className="mb-1 text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
                  Sua loja
                </legend>
                <Field label="Nome da loja">
                  <input
                    required
                    value={form.store_name}
                    onChange={(e) => onStoreNameChange(e.target.value)}
                    className={inputClass}
                  />
                </Field>
                <Field label="Link da loja">
                  <input
                    required
                    value={form.slug}
                    onChange={(e) => {
                      setSlugTouched(true);
                      patch("slug", typingSlug(e.target.value));
                    }}
                    className={inputClass}
                  />
                  <span className="mt-1.5 block truncate text-[11px] text-muted-foreground">
                    {origin}/loja/{form.slug || "nome-da-loja"}
                  </span>
                </Field>
              </fieldset>

              <fieldset className="space-y-4">
                <legend className="mb-1 text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
                  Senha de acesso
                </legend>
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field label="Senha">
                    <div className="relative">
                      <input
                        type={showPass ? "text" : "password"}
                        required
                        value={form.password}
                        onChange={(e) => patch("password", e.target.value)}
                        autoComplete="new-password"
                        className={`${inputClass} pr-10`}
                      />
                      <button
                        type="button"
                        onClick={() => setShowPass((v) => !v)}
                        className="absolute inset-y-0 right-0 grid w-10 place-items-center text-muted-foreground hover:text-foreground"
                        aria-label={showPass ? "Ocultar senha" : "Mostrar senha"}
                      >
                        {showPass ? (
                          <EyeOff className="h-4 w-4" strokeWidth={1.5} />
                        ) : (
                          <Eye className="h-4 w-4" strokeWidth={1.5} />
                        )}
                      </button>
                    </div>
                  </Field>
                  <Field label="Confirmar senha">
                    <input
                      type={showPass ? "text" : "password"}
                      required
                      value={form.confirm}
                      onChange={(e) => patch("confirm", e.target.value)}
                      autoComplete="new-password"
                      className={inputClass}
                    />
                  </Field>
                </div>
                <p className="text-[11px] text-muted-foreground">
                  Mínimo de {MIN_PASSWORD} caracteres.
                </p>
              </fieldset>

              {error && (
                <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-[12px] text-red-800">
                  {error}
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                className="inline-flex w-full items-center justify-center gap-2 rounded-md bg-foreground px-4 py-2.5 text-[13px] font-medium text-background transition-colors hover:bg-graphite disabled:opacity-50"
              >
                {loading && <Loader2 className="h-3.5 w-3.5 animate-spin" strokeWidth={1.5} />}
                Concluir cadastro e entrar
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-[12px] font-medium">{label}</span>
      {children}
    </label>
  );
}
