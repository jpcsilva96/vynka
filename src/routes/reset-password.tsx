import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { Eye, EyeOff, Loader2 } from "lucide-react";
import { useServerFn } from "@tanstack/react-start";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { getOwnerSignup } from "@/lib/owner-signup.functions";
import { VynkaLogo } from "@/components/vynka-logo";
import {
  readAccessLinkToken,
  redeemAccessLinkToken,
  type AccessLinkToken,
} from "@/lib/access-link";

export const Route = createFileRoute("/reset-password")({
  head: () => ({
    meta: [
      { title: "Definir senha · VYNKA" },
      { name: "description", content: "Defina a senha de acesso ao painel da sua loja VYNKA." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: ResetPasswordPage,
});

const MIN_PASSWORD = 8;
// Tempo para o supabase-js ler o token do link (hash da URL) e abrir a sessão.
const SESSION_WAIT_MS = 4000;

function ResetPasswordPage() {
  const navigate = useNavigate();
  const fetchSignup = useServerFn(getOwnerSignup);
  const [ready, setReady] = useState(false);
  const [checking, setChecking] = useState(true);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Link novo (?token_hash=...): a tela espera o clique em "Continuar" para usar o token.
  const [linkToken, setLinkToken] = useState<AccessLinkToken | null>(null);
  const [linkError, setLinkError] = useState<string | null>(null);
  const [starting, setStarting] = useState(false);
  const openedRef = useRef(false);

  // Sessão aberta: dono de loja nova que ainda não completou o cadastro vai para /boas-vindas.
  const open = useCallback(
    async (session: Session) => {
      if (openedRef.current) return;
      openedRef.current = true;
      if (session.user.user_metadata?.signup_completed !== true) {
        try {
          const res = await fetchSignup({});
          if (res.store && !res.store.name) {
            navigate({ to: "/boas-vindas", replace: true });
            return;
          }
        } catch {
          // sem loja ou falha na consulta: segue para a troca de senha
        }
      }
      setReady(true);
      setChecking(false);
    },
    [fetchSignup, navigate],
  );

  const continueWithLink = async () => {
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
    await open(res.session);
  };

  // O link de convite/redefinição abre uma sessão temporária; só ela permite trocar a senha.
  useEffect(() => {
    const token = readAccessLinkToken();
    if (token) {
      // Não usa uma sessão que já esteja aberta neste navegador (ex. a do master).
      setLinkToken(token);
      setChecking(false);
      return;
    }
    let active = true;
    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      if (active && session && (event === "PASSWORD_RECOVERY" || event === "SIGNED_IN")) {
        void open(session);
      }
    });
    supabase.auth.getSession().then(({ data }) => {
      if (active && data.session) void open(data.session);
    });
    const timer = setTimeout(() => {
      if (active && !openedRef.current) setChecking(false);
    }, SESSION_WAIT_MS);
    return () => {
      active = false;
      clearTimeout(timer);
      sub.subscription.unsubscribe();
    };
  }, [open]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (password.length < MIN_PASSWORD) {
      setError(`A senha precisa ter pelo menos ${MIN_PASSWORD} caracteres.`);
      return;
    }
    if (password !== confirm) {
      setError("As senhas não conferem.");
      return;
    }
    setLoading(true);
    try {
      const { error: updErr } = await supabase.auth.updateUser({ password });
      if (updErr) throw updErr;
      navigate({ to: "/admin", replace: true });
    } catch (err: any) {
      setError(err?.message ?? "Não foi possível definir a senha. Tente novamente.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-svh bg-background text-foreground">
      <div className="mx-auto flex min-h-svh max-w-md flex-col justify-center px-6 py-12">
        <div className="mb-10 flex items-center justify-center">
          <VynkaLogo className="text-[28px]" />
        </div>

        <div className="rounded-2xl border border-border bg-surface p-8">
          <h1 className="text-[20px] font-medium tracking-tight">Definir senha</h1>

          {checking && (
            <p className="mt-4 flex items-center gap-2 text-[13px] text-muted-foreground">
              <Loader2 className="h-3.5 w-3.5 animate-spin" strokeWidth={1.5} />
              Validando o link...
            </p>
          )}

          {!checking && linkToken && (
            <div className="mt-4 space-y-4">
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
                <>
                  <p className="text-[13px] text-muted-foreground">
                    Clique para continuar e escolher a senha de acesso ao painel da sua loja.
                  </p>
                  <button
                    type="button"
                    onClick={continueWithLink}
                    disabled={starting}
                    className="inline-flex w-full items-center justify-center gap-2 rounded-md bg-foreground px-4 py-2.5 text-[13px] font-medium text-background transition-colors hover:bg-graphite disabled:opacity-50"
                  >
                    {starting && <Loader2 className="h-3.5 w-3.5 animate-spin" strokeWidth={1.5} />}
                    Continuar
                  </button>
                </>
              )}
            </div>
          )}

          {!checking && !linkToken && !ready && (
            <div className="mt-4 space-y-4">
              <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-[12px] text-red-800">
                Este link é inválido ou expirou. Peça um novo convite à VYNKA ou use "Esqueci minha senha" na tela de login.
              </div>
              <Link to="/login" className="text-[13px] text-foreground underline underline-offset-2">
                Ir para o login
              </Link>
            </div>
          )}

          {ready && (
            <>
              <p className="mt-1 text-[13px] text-muted-foreground">
                Escolha a senha que você usará para acessar o painel da sua loja.
              </p>
              <form onSubmit={handleSubmit} className="mt-6 space-y-4">
                <label className="block">
                  <span className="mb-1.5 block text-[12px] font-medium">Nova senha</span>
                  <div className="relative">
                    <input
                      type={showPass ? "text" : "password"}
                      required
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      autoComplete="new-password"
                      className="w-full rounded-md border border-border bg-background px-3 py-2.5 pr-10 text-[14px] outline-none focus:border-foreground/40"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPass((v) => !v)}
                      className="absolute inset-y-0 right-0 grid w-10 place-items-center text-muted-foreground hover:text-foreground"
                      aria-label={showPass ? "Ocultar senha" : "Mostrar senha"}
                    >
                      {showPass ? <EyeOff className="h-4 w-4" strokeWidth={1.5} /> : <Eye className="h-4 w-4" strokeWidth={1.5} />}
                    </button>
                  </div>
                </label>

                <label className="block">
                  <span className="mb-1.5 block text-[12px] font-medium">Confirmar senha</span>
                  <input
                    type={showPass ? "text" : "password"}
                    required
                    value={confirm}
                    onChange={(e) => setConfirm(e.target.value)}
                    autoComplete="new-password"
                    className="w-full rounded-md border border-border bg-background px-3 py-2.5 text-[14px] outline-none focus:border-foreground/40"
                  />
                </label>

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
                  Salvar senha e entrar
                </button>
              </form>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
