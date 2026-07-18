import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Eye, EyeOff, Loader2 } from "lucide-react";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { useStoreContext } from "@/lib/store-context";
import { VynkaLogo } from "@/components/vynka-logo";

const searchSchema = z.object({
  reason: z.enum(["no-store", "suspended"]).optional(),
});

export const Route = createFileRoute("/login")({
  head: () => ({
    meta: [
      { title: "Entrar · VYNKA" },
      { name: "description", content: "Acesse o painel da sua loja VYNKA." },
      { name: "robots", content: "noindex" },
    ],
  }),
  validateSearch: (s) => searchSchema.parse(s),
  component: LoginPage,
});

function LoginPage() {
  const navigate = useNavigate();
  const { reason } = Route.useSearch();
  const { user, memberships, loading: ctxLoading, refresh } = useStoreContext();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPass, setShowPass] = useState(false);
  const [remember, setRemember] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // já autenticada e com loja → vai pro painel
  useEffect(() => {
    if (!ctxLoading && user && memberships.length > 0) {
      navigate({ to: "/", replace: true });
    }
  }, [ctxLoading, user, memberships, navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const { data, error: signErr } = await supabase.auth.signInWithPassword({ email, password });
      if (signErr || !data.user) throw signErr ?? new Error("Falha no login");

      const { data: mem } = await supabase
        .from("store_members")
        .select("id, store:stores(id,slug,status)")
        .eq("user_id", data.user.id)
        .eq("active", true);

      const active = (mem ?? []).find((m: any) => m.store && ["trial", "active"].includes(m.store.status));
      if (!mem || mem.length === 0) {
        await supabase.auth.signOut();
        throw new Error("Seu usuário não está vinculado a nenhuma loja. Fale com a VYNKA.");
      }
      if (!active) {
        await supabase.auth.signOut();
        throw new Error("Sua loja está suspensa ou cancelada. Entre em contato com a VYNKA.");
      }
      await refresh();
      navigate({ to: "/", replace: true });
    } catch (err: any) {
      setError(err?.message ?? "Não foi possível entrar. Verifique suas credenciais.");
      if (!remember) await supabase.auth.signOut();
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
          <h1 className="text-[20px] font-medium tracking-tight">Entrar na sua loja</h1>
          <p className="mt-1 text-[13px] text-muted-foreground">
            Acesse o painel administrativo da sua loja VYNKA.
          </p>

          {reason === "no-store" && (
            <div className="mt-4 rounded-md border border-border bg-muted/40 px-3 py-2 text-[12px] text-muted-foreground">
              Sua sessão terminou ou sua conta não está vinculada a nenhuma loja.
            </div>
          )}

          <form onSubmit={handleSubmit} className="mt-6 space-y-4">
            <label className="block">
              <span className="mb-1.5 block text-[12px] font-medium">E-mail</span>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="email"
                className="w-full rounded-md border border-border bg-background px-3 py-2.5 text-[14px] outline-none focus:border-foreground/40"
              />
            </label>

            <label className="block">
              <span className="mb-1.5 block text-[12px] font-medium">Senha</span>
              <div className="relative">
                <input
                  type={showPass ? "text" : "password"}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete="current-password"
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

            <div className="flex items-center justify-between text-[12px]">
              <label className="flex items-center gap-2 text-muted-foreground">
                <input
                  type="checkbox"
                  checked={remember}
                  onChange={(e) => setRemember(e.target.checked)}
                  className="h-3.5 w-3.5 rounded border-border"
                />
                Lembrar de mim
              </label>
              <button
                type="button"
                onClick={async () => {
                  if (!email) { setError("Informe o e-mail para redefinir a senha."); return; }
                  const { error } = await supabase.auth.resetPasswordForEmail(email, {
                    redirectTo: `${window.location.origin}/reset-password`,
                  });
                  if (error) setError(error.message);
                  else setError("Enviamos um e-mail com o link de redefinição.");
                }}
                className="text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
              >
                Esqueci minha senha
              </button>
            </div>

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
              Entrar
            </button>
          </form>

          <p className="mt-6 text-center text-[12px] text-muted-foreground">
            Ainda não tem acesso?{" "}
            <a href="mailto:contato@vynka.app" className="text-foreground underline underline-offset-2">
              Entre em contato com a VYNKA
            </a>
          </p>
        </div>

        <div className="mt-8 flex items-center justify-center gap-4 text-[11px] text-muted-foreground">
          <Link to="/" className="hover:text-foreground">Início</Link>
          <span>·</span>
          <Link to="/master/login" className="hover:text-foreground">Painel VYNKA</Link>
        </div>
      </div>
    </div>
  );
}
