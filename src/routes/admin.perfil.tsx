import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Eye, EyeOff, Loader2 } from "lucide-react";
import { PageShell } from "@/components/page-shell";
import { UserAvatar } from "@/components/user-menu";
import { supabase } from "@/integrations/supabase/client";
import { useStoreContext } from "@/lib/store-context";
import { isValidPhone, maskPhone, onlyDigits } from "@/lib/br-documents";

export const Route = createFileRoute("/admin/perfil")({
  head: () => ({
    meta: [{ title: "Meu perfil · VYNKA" }, { name: "robots", content: "noindex" }],
  }),
  component: ProfilePage,
});

const MIN_PASSWORD = 8;

const inputClass =
  "w-full rounded-md border border-border bg-background px-3 py-2.5 text-[14px] outline-none focus:border-foreground/40";

type Notice = { kind: "ok" | "error"; text: string } | null;

function NoticeBox({ notice }: { notice: Notice }) {
  if (!notice) return null;
  return (
    <div
      className={
        notice.kind === "ok"
          ? "rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-[12px] text-emerald-800"
          : "rounded-md border border-red-200 bg-red-50 px-3 py-2 text-[12px] text-red-800"
      }
    >
      {notice.text}
    </div>
  );
}

function ProfilePage() {
  const { user, profile, refresh } = useStoreContext();
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [saving, setSaving] = useState(false);
  const [profileNotice, setProfileNotice] = useState<Notice>(null);

  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPass, setShowPass] = useState(false);
  const [changing, setChanging] = useState(false);
  const [passwordNotice, setPasswordNotice] = useState<Notice>(null);

  useEffect(() => {
    const metaName =
      typeof user?.user_metadata?.full_name === "string" ? user.user_metadata.full_name : "";
    setFullName(profile?.full_name ?? metaName);
    setPhone(maskPhone(profile?.phone ?? ""));
  }, [profile, user]);

  const saveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setProfileNotice(null);
    if (!user) return;
    if (fullName.trim().length < 3) {
      setProfileNotice({ kind: "error", text: "Informe o nome completo." });
      return;
    }
    if (phone && !isValidPhone(phone)) {
      setProfileNotice({ kind: "error", text: "Informe o celular com DDD." });
      return;
    }
    setSaving(true);
    try {
      const { error } = await supabase
        .from("profiles")
        .upsert(
          { user_id: user.id, full_name: fullName.trim(), phone: onlyDigits(phone) || null },
          { onConflict: "user_id" },
        );
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
      setPasswordNotice({ kind: "ok", text: "Senha alterada." });
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

  return (
    <PageShell title="Meu perfil" description="Seus dados de acesso ao painel.">
      <div className="grid max-w-xl gap-6">
        <form
          onSubmit={saveProfile}
          className="space-y-4 rounded-lg border border-border bg-surface p-6"
        >
          <div className="flex items-center gap-3">
            <UserAvatar className="h-12 w-12 bg-foreground text-[14px] text-background" />
            <div className="min-w-0">
              <div className="truncate text-[14px] font-medium">{fullName || user?.email}</div>
              <div className="truncate text-[12px] text-muted-foreground">{user?.email}</div>
            </div>
          </div>

          <label className="block">
            <span className="mb-1.5 block text-[12px] font-medium">Nome completo</span>
            <input
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              className={inputClass}
              autoComplete="name"
            />
          </label>
          <label className="block">
            <span className="mb-1.5 block text-[12px] font-medium">Celular</span>
            <input
              value={phone}
              onChange={(e) => setPhone(maskPhone(e.target.value))}
              className={inputClass}
              inputMode="tel"
              autoComplete="tel"
            />
          </label>
          <label className="block">
            <span className="mb-1.5 block text-[12px] font-medium">E-mail</span>
            <input value={user?.email ?? ""} disabled className={`${inputClass} opacity-60`} />
            <span className="mt-1 block text-[11px] text-muted-foreground">
              Para trocar o e-mail de acesso, fale com a VYNKA.
            </span>
          </label>

          <NoticeBox notice={profileNotice} />
          <button
            type="submit"
            disabled={saving}
            className="inline-flex items-center gap-2 rounded-md bg-foreground px-4 py-2 text-[13px] font-medium text-background disabled:opacity-50"
          >
            {saving && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
            Salvar perfil
          </button>
        </form>

        <form
          onSubmit={changePassword}
          className="space-y-4 rounded-lg border border-border bg-surface p-6"
        >
          <h2 className="text-[14px] font-medium">Alterar senha</h2>
          <label className="block">
            <span className="mb-1.5 block text-[12px] font-medium">Nova senha</span>
            <div className="relative">
              <input
                type={showPass ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className={`${inputClass} pr-10`}
                autoComplete="new-password"
              />
              <button
                type="button"
                onClick={() => setShowPass((v) => !v)}
                aria-label={showPass ? "Ocultar senha" : "Mostrar senha"}
                className="absolute right-2 top-1/2 grid h-7 w-7 -translate-y-1/2 place-items-center text-muted-foreground"
              >
                {showPass ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </label>
          <label className="block">
            <span className="mb-1.5 block text-[12px] font-medium">Confirmar nova senha</span>
            <input
              type={showPass ? "text" : "password"}
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              className={inputClass}
              autoComplete="new-password"
            />
          </label>
          <NoticeBox notice={passwordNotice} />
          <button
            type="submit"
            disabled={changing}
            className="inline-flex items-center gap-2 rounded-md border border-border px-4 py-2 text-[13px] font-medium disabled:opacity-50"
          >
            {changing && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
            Alterar senha
          </button>
        </form>
      </div>
    </PageShell>
  );
}
