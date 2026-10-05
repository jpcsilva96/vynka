import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Eye, EyeOff, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useStoreContext } from "@/lib/store-context";

export const Route = createFileRoute("/master/configuracoes")({
  head: () => ({
    meta: [{ title: "Configurações · Painel VYNKA" }, { name: "robots", content: "noindex" }],
  }),
  component: MasterConfiguracoes,
});

const MIN_PASSWORD = 8;
type Notice = { kind: "ok" | "error"; text: string } | null;

// Perfil do Master: nome e troca de senha (a senha real fica no Supabase Auth; MASTER_PASSWORD
// do ambiente só serve para criar o primeiro master).
function MasterConfiguracoes() {
  const { user, profile, refresh } = useStoreContext();
  const [fullName, setFullName] = useState("");
  const [profileNotice, setProfileNotice] = useState<Notice>(null);
  const [saving, setSaving] = useState(false);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [show, setShow] = useState(false);
  const [passwordNotice, setPasswordNotice] = useState<Notice>(null);
  const [changing, setChanging] = useState(false);

  useEffect(() => {
    setFullName(profile?.full_name ?? "");
  }, [profile?.full_name]);

  const saveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setProfileNotice(null);
    if (!user) return;
    if (fullName.trim().length < 3) {
      setProfileNotice({ kind: "error", text: "Informe o nome completo." });
      return;
    }
    setSaving(true);
    try {
      const { error } = await supabase
        .from("profiles")
        .upsert({ user_id: user.id, full_name: fullName.trim() }, { onConflict: "user_id" });
      if (error) throw error;
      await refresh();
      setProfileNotice({ kind: "ok", text: "Perfil atualizado." });
    } catch {
      setProfileNotice({ kind: "error", text: "Não foi possível salvar. Tente novamente." });
    } finally {
      setSaving(false);
    }
  };

  const changePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordNotice(null);
    if (password.length < MIN_PASSWORD) {
      setPasswordNotice({
        kind: "error",
        text: `A senha precisa ter pelo menos ${MIN_PASSWORD} caracteres.`,
      });
      return;
    }
    if (password !== confirm) {
      setPasswordNotice({ kind: "error", text: "As senhas não conferem." });
      return;
    }
    setChanging(true);
    try {
      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw error;
      setPassword("");
      setConfirm("");
      setPasswordNotice({ kind: "ok", text: "Senha alterada. Use a nova senha no próximo login." });
    } catch (err) {
      const message = err instanceof Error ? err.message : "";
      setPasswordNotice({
        kind: "error",
        text: /different from the old/i.test(message)
          ? "A nova senha precisa ser diferente da atual."
          : "Não foi possível alterar a senha. Saia e entre de novo, depois tente outra vez.",
      });
    } finally {
      setChanging(false);
    }
  };

  const input =
    "h-10 w-full rounded-md border border-border bg-background px-3 text-[14px] outline-none focus:border-foreground";

  return (
    <div className="min-h-svh px-8 py-10 md:px-12">
      <header className="mb-8">
        <h1 className="text-[22px] font-medium tracking-tight">Configurações</h1>
        <p className="mt-1 text-[13px] text-muted-foreground">
          Seu perfil de acesso ao Painel VYNKA.
        </p>
      </header>

      <div className="grid max-w-xl gap-6">
        <form
          onSubmit={saveProfile}
          className="space-y-4 rounded-lg border border-border bg-surface p-6"
        >
          <h2 className="text-[15px] font-medium">Meu perfil</h2>
          <label className="grid gap-1 text-[12px] text-muted-foreground">
            Nome
            <input
              className={input}
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
            />
          </label>
          <label className="grid gap-1 text-[12px] text-muted-foreground">
            E-mail
            <input
              className={`${input} bg-muted text-muted-foreground`}
              value={user?.email ?? ""}
              readOnly
            />
          </label>
          {profileNotice && <NoticeBox notice={profileNotice} />}
          <button
            type="submit"
            disabled={saving}
            className="inline-flex items-center gap-2 rounded-md bg-foreground px-4 py-2 text-[13px] font-medium text-background disabled:opacity-50"
          >
            {saving && <Loader2 className="h-3.5 w-3.5 animate-spin" />} Salvar
          </button>
        </form>

        <form
          onSubmit={changePassword}
          className="space-y-4 rounded-lg border border-border bg-surface p-6"
        >
          <h2 className="text-[15px] font-medium">Trocar senha</h2>
          <label className="grid gap-1 text-[12px] text-muted-foreground">
            Nova senha
            <div className="relative">
              <input
                className={`${input} pr-10`}
                type={show ? "text" : "password"}
                autoComplete="new-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
              <button
                type="button"
                onClick={() => setShow((v) => !v)}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground"
                aria-label={show ? "Ocultar senha" : "Mostrar senha"}
              >
                {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </label>
          <label className="grid gap-1 text-[12px] text-muted-foreground">
            Confirmar nova senha
            <input
              className={input}
              type={show ? "text" : "password"}
              autoComplete="new-password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
            />
          </label>
          {passwordNotice && <NoticeBox notice={passwordNotice} />}
          <button
            type="submit"
            disabled={changing}
            className="inline-flex items-center gap-2 rounded-md bg-foreground px-4 py-2 text-[13px] font-medium text-background disabled:opacity-50"
          >
            {changing && <Loader2 className="h-3.5 w-3.5 animate-spin" />} Alterar senha
          </button>
        </form>
      </div>
    </div>
  );
}

function NoticeBox({ notice }: { notice: NonNullable<Notice> }) {
  return (
    <p
      className={
        notice.kind === "ok"
          ? "rounded-md bg-emerald-50 px-3 py-2 text-[13px] text-emerald-700"
          : "rounded-md bg-red-50 px-3 py-2 text-[13px] text-red-700"
      }
    >
      {notice.text}
    </p>
  );
}
