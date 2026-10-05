import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { Copy, ExternalLink, KeyRound, Loader2, Search, Users } from "lucide-react";
import { listStoreUsersForMaster, resendStoreInvite } from "@/lib/master.functions";
import { MASTER_ACTIVE_STORE_KEY } from "@/lib/master-store-access";

export const Route = createFileRoute("/master/usuarios")({
  head: () => ({
    meta: [{ title: "Usuários · Painel VYNKA" }, { name: "robots", content: "noindex" }],
  }),
  component: UsuariosPage,
});

type StoreUser = Awaited<ReturnType<typeof listStoreUsersForMaster>>[number];

const STORE_STATUS: Record<string, string> = {
  active: "Ativa",
  trial: "Ativa",
  suspended: "Suspensa",
  cancelled: "Suspensa",
};

function UsuariosPage() {
  const fetchUsers = useServerFn(listStoreUsersForMaster);
  const resendInvite = useServerFn(resendStoreInvite);
  const {
    data: users = [],
    isLoading,
    isError,
  } = useQuery({
    queryKey: ["master-store-users"],
    queryFn: () => fetchUsers({}),
  });
  const [search, setSearch] = useState("");
  const [link, setLink] = useState<{ storeName: string; url: string } | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const linkMutation = useMutation({
    mutationFn: (u: StoreUser) =>
      resendInvite({ data: { store_id: u.store!.id, redirect_origin: window.location.origin } }),
    onSuccess: (res, u) => {
      setActionError(null);
      setCopied(false);
      if (res.invite_link) setLink({ storeName: u.store?.name ?? "", url: res.invite_link });
    },
    onError: (e) =>
      setActionError(e instanceof Error ? e.message : "Falha ao gerar o link de acesso."),
  });

  const openStoreAdmin = (storeId: string) => {
    window.localStorage.setItem(MASTER_ACTIVE_STORE_KEY, storeId);
    window.location.assign("/admin");
  };

  const q = search.trim().toLowerCase();
  const filtered = (users as StoreUser[]).filter(
    (u) =>
      !q ||
      (u.name ?? "").toLowerCase().includes(q) ||
      (u.email ?? "").toLowerCase().includes(q) ||
      (u.store?.name ?? "").toLowerCase().includes(q),
  );

  return (
    <div className="min-h-svh px-8 py-10 md:px-12">
      <header className="mb-8">
        <h1 className="text-[22px] font-medium tracking-tight">Usuários</h1>
        <p className="mt-1 text-[13px] text-muted-foreground">
          Logins de administração das lojas (dono e administradores).
        </p>
      </header>

      <div className="mb-4 flex max-w-sm items-center gap-2 rounded-md border border-border bg-surface px-3">
        <Search className="h-4 w-4 text-muted-foreground" />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Buscar por nome, e-mail ou loja"
          className="h-9 w-full bg-transparent text-[13px] outline-none"
        />
      </div>

      {actionError && (
        <p className="mb-4 rounded-md bg-red-50 px-4 py-2 text-[13px] text-red-700">
          {actionError}
        </p>
      )}
      {link && (
        <div className="mb-4 rounded-md border border-border bg-surface p-4 text-[13px]">
          <div className="font-medium">Link de acesso de {link.storeName}</div>
          <p className="mt-1 text-[12px] text-muted-foreground">
            Envie ao responsável. Gerar um novo link invalida os anteriores.
          </p>
          <div className="mt-3 flex items-center gap-2">
            <input
              readOnly
              value={link.url}
              className="h-9 w-full rounded-md border border-border bg-background px-3 text-[12px]"
            />
            <button
              type="button"
              onClick={() => {
                void navigator.clipboard?.writeText(link.url).then(() => setCopied(true));
              }}
              className="inline-flex h-9 shrink-0 items-center gap-1 rounded-md bg-foreground px-3 text-[12px] font-medium text-background"
            >
              <Copy className="h-3.5 w-3.5" /> {copied ? "Copiado" : "Copiar"}
            </button>
          </div>
        </div>
      )}

      <div className="overflow-x-auto rounded-lg border border-border bg-surface">
        <table className="w-full min-w-[760px] text-[13px]">
          <thead className="bg-muted/40 text-[11px] uppercase tracking-wider text-muted-foreground">
            <tr>
              <th className="px-4 py-3 text-left">Usuário</th>
              <th className="px-4 py-3 text-left">Loja</th>
              <th className="px-4 py-3 text-left">Papel</th>
              <th className="px-4 py-3 text-left">Situação</th>
              <th className="px-4 py-3 text-left">Último acesso</th>
              <th className="px-4 py-3 text-right">Ações</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {isLoading && (
              <tr>
                <td colSpan={6} className="px-4 py-10 text-center">
                  <Loader2 className="mx-auto h-4 w-4 animate-spin text-muted-foreground" />
                </td>
              </tr>
            )}
            {isError && (
              <tr>
                <td colSpan={6} className="px-4 py-10 text-center text-[12px] text-red-700">
                  Não foi possível carregar os usuários.
                </td>
              </tr>
            )}
            {!isLoading && !isError && filtered.length === 0 && (
              <tr>
                <td
                  colSpan={6}
                  className="px-4 py-12 text-center text-[12px] text-muted-foreground"
                >
                  <Users className="mx-auto mb-2 h-5 w-5" strokeWidth={1.5} />
                  Nenhum usuário encontrado.
                </td>
              </tr>
            )}
            {filtered.map((u) => (
              <tr key={`${u.user_id}-${u.store?.id}`}>
                <td className="px-4 py-3">
                  <div className="font-medium">{u.name || "Sem nome"}</div>
                  <div className="text-[12px] text-muted-foreground">
                    {[u.email, u.phone].filter(Boolean).join(" · ") || "—"}
                  </div>
                </td>
                <td className="px-4 py-3">
                  <div>{u.store?.name ?? "—"}</div>
                  <div className="text-[12px] text-muted-foreground">
                    {u.store
                      ? `/loja/${u.store.slug} · ${STORE_STATUS[u.store.status] ?? u.store.status}`
                      : ""}
                  </div>
                </td>
                <td className="px-4 py-3">{u.role === "owner" ? "Dono" : "Administrador"}</td>
                <td className="px-4 py-3">
                  {!u.member_active ? (
                    <span className="rounded bg-muted px-2 py-0.5 text-[11px]">Desativado</span>
                  ) : u.signup_done ? (
                    <span className="rounded bg-emerald-50 px-2 py-0.5 text-[11px] text-emerald-700">
                      Ativo
                    </span>
                  ) : (
                    <span className="rounded bg-amber-50 px-2 py-0.5 text-[11px] text-amber-700">
                      Convite enviado
                    </span>
                  )}
                </td>
                <td className="px-4 py-3 text-muted-foreground">
                  {u.last_sign_in_at
                    ? new Date(u.last_sign_in_at).toLocaleString("pt-BR", {
                        dateStyle: "short",
                        timeStyle: "short",
                      })
                    : "Nunca"}
                </td>
                <td className="px-4 py-3">
                  <div className="flex justify-end gap-1">
                    {u.store && u.role === "owner" && (
                      <button
                        type="button"
                        onClick={() => linkMutation.mutate(u)}
                        disabled={linkMutation.isPending}
                        className="inline-flex items-center gap-1 rounded px-2 py-1 text-[12px] text-muted-foreground hover:bg-muted hover:text-foreground disabled:opacity-50"
                        title={
                          u.signup_done
                            ? "Link para redefinir a senha"
                            : "Link para concluir o cadastro"
                        }
                      >
                        <KeyRound className="h-3.5 w-3.5" /> Link de acesso
                      </button>
                    )}
                    {u.store && (
                      <button
                        type="button"
                        onClick={() => openStoreAdmin(u.store!.id)}
                        className="inline-flex items-center gap-1 rounded px-2 py-1 text-[12px] text-muted-foreground hover:bg-muted hover:text-foreground"
                      >
                        <ExternalLink className="h-3.5 w-3.5" /> Acessar loja
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
