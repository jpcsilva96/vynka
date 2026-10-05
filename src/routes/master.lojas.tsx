import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { Plus, Search, ExternalLink, MoreHorizontal, Loader2, Copy } from "lucide-react";
import {
  listStoresForMaster,
  createStoreWithOwner,
  updateStoreStatus,
  updateStorePlan,
  resendStoreInvite,
  deleteStore,
  listPlans,
} from "@/lib/master.functions";
import { MASTER_ACTIVE_STORE_KEY } from "@/lib/master-store-access";

export const Route = createFileRoute("/master/lojas")({
  head: () => ({
    meta: [{ title: "Lojas · Painel VYNKA" }, { name: "robots", content: "noindex" }],
  }),
  component: LojasPage,
});

// Status exibido (calculado no servidor): "Convite enviado" = loja no ar, dono sem cadastro concluído.
const STATUS_LABEL: Record<string, string> = {
  invited: "Convite enviado",
  active: "Ativa",
  suspended: "Suspensa",
};

type StoreRow = { id: string; name: string };
type PlanRow = { id: string; name: string };

const errorMessage = (e: unknown, fallback: string) =>
  e instanceof Error && e.message ? e.message : fallback;

// Pergunta antes de tirar uma loja do ar.
const STATUS_CONFIRM: Record<string, string> = {
  suspended:
    "Suspender esta loja? O catálogo sai do ar e o responsável é desconectado do painel. Os dados ficam guardados e dá para reativar depois.",
};

const STATUS_FILTERS: { value: string; label: string }[] = [
  { value: "", label: "Todas" },
  { value: "invited", label: "Convite enviado" },
  { value: "active", label: "Ativas" },
  { value: "suspended", label: "Suspensas" },
];

function LojasPage() {
  const qc = useQueryClient();
  const fetchStores = useServerFn(listStoresForMaster);
  const fetchPlans = useServerFn(listPlans);
  const changeStatus = useServerFn(updateStoreStatus);
  const changePlan = useServerFn(updateStorePlan);
  const resendInvite = useServerFn(resendStoreInvite);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("");
  const [showNew, setShowNew] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [accessLink, setAccessLink] = useState<{ link: string; type: string } | null>(null);
  const [toDelete, setToDelete] = useState<{ id: string; name: string; slug: string } | null>(null);

  const { data: stores = [], isLoading } = useQuery({
    queryKey: ["master-stores"],
    queryFn: () => fetchStores({}),
  });
  const { data: plans = [] } = useQuery({
    queryKey: ["master-plans"],
    queryFn: () => fetchPlans({}),
  });

  const statusMutation = useMutation({
    mutationFn: (v: { store_id: string; status: any }) => changeStatus({ data: v }),
    onSuccess: () => {
      setActionError(null);
      qc.invalidateQueries({ queryKey: ["master-stores"] });
      qc.invalidateQueries({ queryKey: ["master-stats"] });
    },
    onError: (e) => setActionError(errorMessage(e, "Falha ao alterar o status.")),
  });

  const planMutation = useMutation({
    mutationFn: (v: { store_id: string; plan_id: string }) => changePlan({ data: v }),
    onSuccess: () => {
      setActionError(null);
      qc.invalidateQueries({ queryKey: ["master-stores"] });
    },
    onError: (e) => setActionError(errorMessage(e, "Falha ao trocar o plano.")),
  });

  const inviteMutation = useMutation({
    mutationFn: (store_id: string) =>
      resendInvite({ data: { store_id, redirect_origin: window.location.origin } }),
    onSuccess: (res) => {
      setActionError(null);
      if (res.invite_link) setAccessLink({ link: res.invite_link, type: res.link_type });
    },
    onError: (e) => setActionError(errorMessage(e, "Falha ao gerar o link de acesso.")),
  });

  const onStatusChange = (store: StoreRow, status: string) => {
    const question = STATUS_CONFIRM[status];
    if (question && !window.confirm(`${store.name}\n\n${question}`)) return;
    statusMutation.mutate({ store_id: store.id, status });
  };

  const onPlanChange = (store: StoreRow, planId: string) => {
    const plan = (plans as PlanRow[]).find((p) => p.id === planId);
    if (!window.confirm(`Trocar o plano de "${store.name}" para "${plan?.name ?? "—"}"?`)) return;
    planMutation.mutate({ store_id: store.id, plan_id: planId });
  };

  const filtered = (stores as any[]).filter((s) => {
    const q = search.toLowerCase();
    if (statusFilter && s.display_status !== statusFilter) return false;
    if (!q) return true;
    return (
      s.name.toLowerCase().includes(q) ||
      s.slug.toLowerCase().includes(q) ||
      (s.email ?? "").toLowerCase().includes(q)
    );
  });

  const openStoreAdmin = (storeId: string) => {
    window.localStorage.setItem(MASTER_ACTIVE_STORE_KEY, storeId);
    window.location.assign("/admin");
  };

  return (
    <div className="min-h-svh px-8 py-10 md:px-12">
      <header className="mb-8 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-[22px] font-medium tracking-tight">Lojas</h1>
          <p className="mt-1 text-[13px] text-muted-foreground">
            Gerencie todas as lojas da plataforma.
          </p>
        </div>
        <button
          onClick={() => setShowNew(true)}
          className="inline-flex items-center gap-2 rounded-md bg-foreground px-4 py-2 text-[13px] font-medium text-background hover:bg-graphite"
        >
          <Plus className="h-3.5 w-3.5" strokeWidth={2} /> Nova loja
        </button>
      </header>

      <div className="mb-4 flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[240px]">
          <Search
            className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground"
            strokeWidth={1.5}
          />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por nome, slug ou e-mail…"
            className="w-full rounded-md border border-border bg-surface py-2 pl-9 pr-3 text-[13px] outline-none focus:border-foreground/40"
          />
        </div>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="rounded-md border border-border bg-surface px-3 py-2 text-[13px] outline-none"
        >
          {STATUS_FILTERS.map((f) => (
            <option key={f.value} value={f.value}>
              {f.label}
            </option>
          ))}
        </select>
      </div>

      {actionError && (
        <div className="mb-4 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-[12px] text-red-800">
          {actionError}
        </div>
      )}

      <div className="overflow-hidden rounded-lg border border-border bg-surface">
        <table className="w-full text-[13px]">
          <thead className="bg-muted/40 text-[11px] uppercase tracking-wider text-muted-foreground">
            <tr>
              <th className="px-4 py-3 text-left">Loja</th>
              <th className="px-4 py-3 text-left">E-mail</th>
              <th className="px-4 py-3 text-left">Plano</th>
              <th className="px-4 py-3 text-left">Status</th>
              <th className="px-4 py-3 text-left">Criada em</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {isLoading && (
              <tr>
                <td colSpan={6} className="px-4 py-10 text-center text-muted-foreground">
                  <Loader2 className="mx-auto h-4 w-4 animate-spin" strokeWidth={1.5} />
                </td>
              </tr>
            )}
            {!isLoading && filtered.length === 0 && (
              <tr>
                <td
                  colSpan={6}
                  className="px-4 py-10 text-center text-[12px] text-muted-foreground"
                >
                  Nenhuma loja encontrada.
                </td>
              </tr>
            )}
            {filtered.map((s: any) => (
              <tr key={s.id} className="hover:bg-muted/20">
                <td className="px-4 py-3">
                  <div className="font-medium">{s.name}</div>
                  <div className="text-[11px] text-muted-foreground">/loja/{s.slug}</div>
                </td>
                <td className="px-4 py-3 text-muted-foreground">{s.email ?? "—"}</td>
                <td className="px-4 py-3">
                  <select
                    value={s.plan_id ?? ""}
                    disabled={planMutation.isPending}
                    onChange={(e) => onPlanChange(s, e.target.value)}
                    className="rounded-md border border-border bg-background px-2 py-1 text-[12px] outline-none"
                  >
                    {!s.plan_id && <option value="">—</option>}
                    {(plans as any[]).map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name}
                      </option>
                    ))}
                  </select>
                </td>
                <td className="px-4 py-3">
                  {/* No banco só existem "no ar" (active) e "suspensa"; "Convite enviado" é active. */}
                  <select
                    value={s.display_status === "suspended" ? "suspended" : "active"}
                    disabled={statusMutation.isPending}
                    onChange={(e) => onStatusChange(s, e.target.value)}
                    className="rounded-md border border-border bg-background px-2 py-1 text-[12px] outline-none"
                  >
                    <option value="active">
                      {s.display_status === "invited" ? STATUS_LABEL.invited : STATUS_LABEL.active}
                    </option>
                    <option value="suspended">{STATUS_LABEL.suspended}</option>
                  </select>
                </td>
                <td className="px-4 py-3 text-muted-foreground">
                  {new Date(s.created_at).toLocaleDateString("pt-BR")}
                </td>
                <td className="px-4 py-3 text-right">
                  <div className="flex justify-end gap-3">
                    <button
                      type="button"
                      onClick={() => openStoreAdmin(s.id)}
                      className="text-[12px] font-medium text-foreground hover:underline"
                    >
                      Admin
                    </button>
                    <button
                      type="button"
                      disabled={inviteMutation.isPending}
                      onClick={() => inviteMutation.mutate(s.id)}
                      className="text-[12px] text-muted-foreground hover:text-foreground disabled:opacity-50"
                    >
                      Reenviar acesso
                    </button>
                    {s.display_status === "suspended" && (
                      <button
                        type="button"
                        onClick={() => setToDelete({ id: s.id, name: s.name, slug: s.slug })}
                        className="text-[12px] text-red-700 hover:underline"
                      >
                        Excluir
                      </button>
                    )}
                    <a
                      href={`/loja/${s.slug}`}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1 text-[12px] text-muted-foreground hover:text-foreground"
                    >
                      Abrir <ExternalLink className="h-3 w-3" strokeWidth={1.5} />
                    </a>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {showNew && <NewStoreDialog plans={plans as any[]} onClose={() => setShowNew(false)} />}

      {toDelete && <DeleteStoreDialog store={toDelete} onClose={() => setToDelete(null)} />}

      {accessLink && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/60 px-4">
          <div className="w-full max-w-lg rounded-2xl border border-border bg-background p-6">
            <InviteLinkPanel
              title="Novo link de acesso"
              description={
                accessLink.type === "invite"
                  ? "O responsável ainda não entrou. Envie o link abaixo para ele completar o cadastro e definir a senha. Links anteriores deixam de valer."
                  : "O responsável já entrou antes. Envie o link abaixo para ele definir uma nova senha. Links anteriores deixam de valer."
              }
              link={accessLink.link}
              onClose={() => setAccessLink(null)}
            />
          </div>
        </div>
      )}
    </div>
  );
}

function InviteLinkPanel({
  title,
  description,
  link,
  onClose,
}: {
  title: string;
  description: string;
  link: string;
  onClose: () => void;
}) {
  return (
    <>
      <h2 className="text-[16px] font-medium">{title}</h2>
      <p className="mt-1 text-[12px] text-muted-foreground">{description}</p>
      <div className="mt-4 flex items-center gap-2 rounded-md border border-border bg-surface p-2">
        <code className="flex-1 truncate text-[11px]">{link}</code>
        <button
          onClick={() => navigator.clipboard.writeText(link)}
          className="grid h-7 w-7 place-items-center rounded hover:bg-muted"
        >
          <Copy className="h-3 w-3" strokeWidth={1.5} />
        </button>
      </div>
      <button
        onClick={onClose}
        className="mt-6 w-full rounded-md bg-foreground py-2 text-[13px] font-medium text-background"
      >
        Concluir
      </button>
    </>
  );
}

// Exclusão definitiva: só para loja suspensa e com o link digitado como confirmação.
function DeleteStoreDialog({
  store,
  onClose,
}: {
  store: { id: string; name: string; slug: string };
  onClose: () => void;
}) {
  const qc = useQueryClient();
  const removeFn = useServerFn(deleteStore);
  const [typed, setTyped] = useState("");
  const [error, setError] = useState<string | null>(null);
  const matches = typed.trim().toLowerCase() === store.slug.toLowerCase();

  const mutation = useMutation({
    mutationFn: () => removeFn({ data: { store_id: store.id, confirm_slug: typed.trim() } }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["master-stores"] });
      qc.invalidateQueries({ queryKey: ["master-stats"] });
      onClose();
    },
    onError: (e) => setError(errorMessage(e, "Falha ao excluir a loja.")),
  });

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/60 px-4">
      <div className="w-full max-w-lg rounded-2xl border border-border bg-background p-6">
        <h2 className="text-[16px] font-medium">Excluir loja definitivamente</h2>
        <p className="mt-2 text-[12px] text-muted-foreground">
          <strong className="text-foreground">{store.name}</strong> será apagada com produtos,
          categorias, pedidos, clientes, banners e imagens. O acesso do responsável também é
          excluído se ele não tiver outra loja.{" "}
          <strong className="text-red-700">Não dá para desfazer.</strong>
        </p>
        <label className="mt-4 block text-[12px] text-muted-foreground">
          Para confirmar, digite o link da loja:{" "}
          <code className="text-foreground">{store.slug}</code>
          <input
            value={typed}
            onChange={(e) => setTyped(e.target.value)}
            autoFocus
            className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-[13px] text-foreground outline-none focus:border-foreground/40"
          />
        </label>
        {error && (
          <div className="mt-3 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-[12px] text-red-800">
            {error}
          </div>
        )}
        <div className="mt-6 flex gap-2">
          <button
            type="button"
            onClick={onClose}
            disabled={mutation.isPending}
            className="flex-1 rounded-md border border-border py-2 text-[13px]"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={() => mutation.mutate()}
            disabled={!matches || mutation.isPending}
            className="inline-flex flex-1 items-center justify-center gap-2 rounded-md bg-red-700 py-2 text-[13px] font-medium text-white disabled:opacity-40"
          >
            {mutation.isPending && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
            Excluir definitivamente
          </button>
        </div>
      </div>
    </div>
  );
}

function NewStoreDialog({ plans, onClose }: { plans: any[]; onClose: () => void }) {
  const qc = useQueryClient();
  const createFn = useServerFn(createStoreWithOwner);
  const [form, setForm] = useState({
    owner_email: "",
    plan_id: plans[0]?.id ?? "",
  });
  const [error, setError] = useState<string | null>(null);
  const [inviteLink, setInviteLink] = useState<string | null>(null);

  const mut = useMutation({
    mutationFn: (v: typeof form) =>
      createFn({ data: { ...v, redirect_origin: window.location.origin } }),
    onSuccess: (res) => {
      qc.invalidateQueries({ queryKey: ["master-stores"] });
      qc.invalidateQueries({ queryKey: ["master-stats"] });
      if (res.invite_link) setInviteLink(res.invite_link);
      else onClose();
    },
    onError: (e: any) => setError(e?.message ?? "Falha ao criar loja."),
  });

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/60 px-4">
      <div className="w-full max-w-lg rounded-2xl border border-border bg-background p-6">
        {inviteLink ? (
          <InviteLinkPanel
            title="Loja criada"
            description="Envie o link abaixo para o responsável completar o cadastro, definir a senha e acessar o painel."
            link={inviteLink}
            onClose={onClose}
          />
        ) : (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              setError(null);
              mut.mutate(form);
            }}
          >
            <h2 className="text-[16px] font-medium">Nova loja</h2>
            <p className="mt-1 text-[12px] text-muted-foreground">
              Informe o e-mail do responsável e o plano. Ele completa o cadastro pelo link do
              convite e cria o catálogo dentro da plataforma.
            </p>

            <div className="mt-5 grid gap-3">
              <div className="grid gap-3 sm:grid-cols-2">
                <Field label="E-mail do responsável">
                  <input
                    required
                    type="email"
                    value={form.owner_email}
                    onChange={(e) => setForm({ ...form, owner_email: e.target.value })}
                    className="w-full rounded-md border border-border bg-surface px-3 py-2 text-[13px] outline-none focus:border-foreground/40"
                  />
                </Field>
                <Field label="Plano">
                  <select
                    required
                    value={form.plan_id}
                    onChange={(e) => setForm({ ...form, plan_id: e.target.value })}
                    className="w-full rounded-md border border-border bg-surface px-3 py-2 text-[13px] outline-none"
                  >
                    {plans.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name}
                      </option>
                    ))}
                  </select>
                </Field>
              </div>
            </div>

            {error && (
              <div className="mt-4 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-[12px] text-red-800">
                {error}
              </div>
            )}

            <div className="mt-6 flex justify-end gap-2">
              <button
                type="button"
                onClick={onClose}
                className="rounded-md border border-border bg-surface px-4 py-2 text-[13px] hover:bg-muted"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={mut.isPending}
                className="inline-flex items-center gap-2 rounded-md bg-foreground px-4 py-2 text-[13px] font-medium text-background hover:bg-graphite disabled:opacity-50"
              >
                {mut.isPending && (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" strokeWidth={1.5} />
                )}
                Criar loja
              </button>
            </div>
          </form>
        )}
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
