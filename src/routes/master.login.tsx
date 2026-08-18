import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Eye, EyeOff, Loader2, ShieldCheck } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useStoreContext } from "@/lib/store-context";
import { VynkaLogo } from "@/components/vynka-logo";
import { MASTER_EMAIL } from "@/lib/master-fixed-auth";

export const Route = createFileRoute("/master/login")({
  head: () => ({
    meta: [
      { title: "Painel VYNKA - Acesso administrativo" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: MasterLogin,
});

function MasterLogin() {
  const navigate = useNavigate();
  const { user, isPlatformAdmin, loading: ctxLoading, refresh } = useStoreContext();
  const [email, setEmail] = useState(MASTER_EMAIL);
  const [password, setPassword] = useState("");
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!ctxLoading && user && isPlatformAdmin) {
      navigate({ to: "/master", replace: true });
    }
  }, [ctxLoading, user, isPlatformAdmin, navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const { data, error: signErr } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });
      if (signErr || !data.user) throw signErr ?? new Error("Credenciais invalidas");

      const { data: platformUser } = await supabase
        .from("platform_users")
        .select("role, active")
        .eq("user_id", data.user.id)
        .eq("active", true)
        .maybeSingle();

      if (!platformUser) {
        await supabase.auth.signOut();
        throw new Error("Este usuario nao tem acesso ao painel administrativo da plataforma.");
      }

      await refresh();
      navigate({ to: "/master", replace: true });
    } catch (err: any) {
      setError(err?.message ?? "Falha ao entrar.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-svh bg-ink text-white/90">
      <div className="mx-auto flex min-h-svh max-w-md flex-col justify-center px-6 py-12">
        <div className="mb-8 flex flex-col items-center gap-2">
          <VynkaLogo className="text-[28px] text-white" />
          <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-[0.28em] text-white/60">
            <ShieldCheck className="h-3 w-3" strokeWidth={1.5} />
            Painel administrativo da plataforma
          </div>
        </div>

        <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-8 backdrop-blur">
          <h1 className="text-[20px] font-medium tracking-tight text-white">Acesso restrito</h1>
          <p className="mt-1 text-[13px] text-white/60">
            Somente administradores da plataforma VYNKA.
          </p>

          <form onSubmit={handleSubmit} className="mt-6 space-y-4">
            <label className="block">
              <span className="mb-1.5 block text-[12px] font-medium text-white/80">E-mail</span>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="email"
                className="w-full rounded-md border border-white/10 bg-black/40 px-3 py-2.5 text-[14px] text-white outline-none placeholder:text-white/30 focus:border-white/30"
              />
            </label>

            <label className="block">
              <span className="mb-1.5 block text-[12px] font-medium text-white/80">Senha</span>
              <div className="relative">
                <input
                  type={showPass ? "text" : "password"}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete="current-password"
                  className="w-full rounded-md border border-white/10 bg-black/40 px-3 py-2.5 pr-10 text-[14px] text-white outline-none focus:border-white/30"
                />
                <button
                  type="button"
                  onClick={() => setShowPass((v) => !v)}
                  className="absolute inset-y-0 right-0 grid w-10 place-items-center text-white/50 hover:text-white"
                  aria-label={showPass ? "Ocultar senha" : "Mostrar senha"}
                >
                  {showPass ? <EyeOff className="h-4 w-4" strokeWidth={1.5} /> : <Eye className="h-4 w-4" strokeWidth={1.5} />}
                </button>
              </div>
            </label>

            {error && (
              <div className="rounded-md border border-red-500/30 bg-red-500/10 px-3 py-2 text-[12px] text-red-200">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="inline-flex w-full items-center justify-center gap-2 rounded-md bg-white px-4 py-2.5 text-[13px] font-medium text-ink transition-colors hover:bg-white/90 disabled:opacity-50"
            >
              {loading && <Loader2 className="h-3.5 w-3.5 animate-spin" strokeWidth={1.5} />}
              Entrar
            </button>
          </form>
        </div>

        <div className="mt-8 flex items-center justify-center gap-4 text-[11px] text-white/40">
          <Link to="/" className="hover:text-white">Inicio</Link>
          <span>.</span>
          <Link to="/login" className="hover:text-white">Login da lojista</Link>
        </div>
      </div>
    </div>
  );
}
