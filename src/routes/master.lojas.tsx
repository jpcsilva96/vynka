import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { Plus, Search, ExternalLink, MoreHorizontal, Loader2, Copy } from "lucide-react";
import {
  listStoresForMaster,
  createStoreWithOwner,
  updateStoreStatus,
  listPlans,
} from "@/lib/master.functions";
import { MASTER_ACTIVE_STORE_KEY } from "@/lib/master-store-access";

export const Route = createFileRoute("/master/lojas")({
  head: () => ({
    meta: [{ title: "Lojas · Painel VYNKA" }, { name: "robots", content: "noindex" }],
  }),
  component: LojasPage,
});

const STATUS_LABEL: Record<string, string> = {
  trial: "Em teste",
  active: "Ativa",
  suspended: "Suspensa",
  cancelled: "Cancelada",
};

function LojasPage() {
  const qc = useQueryClient();
  const fetchStores = useServerFn(listStoresForMaster);
  const fetchPlans = useServerFn(listPlans);
  const changeStatus = useServerFn(updateStoreStatus);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("");
  const [showNew, setShowNew] = useState(false);

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
    onSuccess: () => qc.invalidateQueries({ queryKey: ["master-stores"] }),
  });

  const filtered = (stores as any[]).filter((s) => {
    const q = search.toLowerCase();
    if (statusFilter && s.status !== statusFilter) return false;
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
          <option value="">Todos os status</option>
          <option value="trial">Em teste</option>
          <option value="active">Ativa</option>
          <option value="suspended">Suspensa</option>
          <option value="cancelled">Cancelada</option>
        </select>
      </div>

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
                <td className="px-4 py-3">{s.plan?.name ?? "—"}</td>
                <td className="px-4 py-3">
                  <select
                    value={s.status}
                    onChange={(e) =>
                      statusMutation.mutate({ store_id: s.id, status: e.target.value })
                    }
                    className="rounded-md border border-border bg-background px-2 py-1 text-[12px] outline-none"
                  >
                    {Object.entries(STATUS_LABEL).map(([v, l]) => (
                      <option key={v} value={v}>
                        {l}
                      </option>
                    ))}
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
    </div>
  );
}

function NewStoreDialog({ plans, onClose }: { plans: any[]; onClose: () => void }) {
  const qc = useQueryClient();
  const createFn = useServerFn(createStoreWithOwner);
  const [form, setForm] = useState({
    name: "",
    slug: "",
    owner_email: "",
    owner_name: "",
    whatsapp: "",
    plan_id: plans[0]?.id ?? "",
    status: "trial" as const,
  });
  const [error, setError] = useState<string | null>(null);
  const [inviteLink, setInviteLink] = useState<string | null>(null);

  const mut = useMutation({
    mutationFn: (v: typeof form) => createFn({ data: v }),
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
          <>
            <h2 className="text-[16px] font-medium">Loja criada</h2>
            <p className="mt-1 text-[12px] text-muted-foreground">
              Envie o link abaixo para o responsável definir a senha e acessar o painel.
            </p>
            <div className="mt-4 flex items-center gap-2 rounded-md border border-border bg-surface p-2">
              <code className="flex-1 truncate text-[11px]">{inviteLink}</code>
              <button
                onClick={() => navigator.clipboard.writeText(inviteLink)}
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
              Cadastre a lojista e sua conta.
            </p>

            <div className="mt-5 grid gap-3">
              <Field label="Nome da loja">
                <input
                  required
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  className="w-full rounded-md border border-border bg-surface px-3 py-2 text-[13px] outline-none focus:border-foreground/40"
                />
              </Field>
              <Field label="Slug (URL pública)">
                <div className="flex items-center rounded-md border border-border bg-surface pl-3 focus-within:border-foreground/40">
                  <span className="text-[12px] text-muted-foreground">/loja/</span>
                  <input
                    required
                    value={form.slug}
                    placeholder="minha-loja"
                    onChange={(e) =>
                      setForm({
                        ...form,
                        slug: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ""),
                      })
                    }
                    className="w-full bg-transparent px-1 py-2 text-[13px] outline-none"
                  />
                </div>
              </Field>
              <div className="grid gap-3 sm:grid-cols-2">
                <Field label="Nome do responsável">
                  <input
                    required
                    value={form.owner_name}
                    onChange={(e) => setForm({ ...form, owner_name: e.target.value })}
                    className="w-full rounded-md border border-border bg-surface px-3 py-2 text-[13px] outline-none focus:border-foreground/40"
                  />
                </Field>
                <Field label="E-mail do responsável">
                  <input
                    required
                    type="email"
                    value={form.owner_email}
                    onChange={(e) => setForm({ ...form, owner_email: e.target.value })}
                    className="w-full rounded-md border border-border bg-surface px-3 py-2 text-[13px] outline-none focus:border-foreground/40"
                  />
                </Field>
                <Field label="WhatsApp">
                  <input
                    value={form.whatsapp}
                    onChange={(e) => setForm({ ...form, whatsapp: e.target.value })}
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
              <Field label="Status inicial">
                <select
                  value={form.status}
                  onChange={(e) => setForm({ ...form, status: e.target.value as any })}
                  className="w-full rounded-md border border-border bg-surface px-3 py-2 text-[13px] outline-none"
                >
                  <option value="trial">Em teste (14 dias)</option>
                  <option value="active">Ativa</option>
                  <option value="suspended">Suspensa</option>
                </select>
              </Field>
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
