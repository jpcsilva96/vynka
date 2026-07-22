import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Loader2, Plus, X } from "lucide-react";
import { useState } from "react";
import { PageShell } from "@/components/page-shell";
import { createStoreUser, listStoreUsers, updateStoreUser } from "@/lib/store-users.functions";
import { useStoreContext } from "@/lib/store-context";
import { cn } from "@/lib/utils";
import { formatBRL } from "@/lib/products";

export const Route = createFileRoute("/admin/usuarios")({
  head: () => ({ meta: [{ title: "Usuarios - VYNKA" }] }),
  component: UsuariosPage,
});

type PermissionKey =
  "view_all_transactions" | "discount_sales" | "manage_products" | "manage_stock";

type PermissionState = Record<PermissionKey, boolean>;

const permissionOptions: {
  key: PermissionKey;
  label: string;
  description: string;
}[] = [
  {
    key: "view_all_transactions",
    label: "Ver transações de outros usuários",
    description:
      "Permite ver todos os pedidos e vendas, inclusive de outros usuários e do catálogo online.",
  },
  {
    key: "discount_sales",
    label: "Dar desconto em vendas",
    description:
      "Permite aplicar descontos tanto no valor dos produtos, quanto no valor total do pedido.",
  },
  {
    key: "manage_products",
    label: "Cadastrar/Alterar produtos",
    description:
      "Permite que o usuário edite os dados dos produtos como preço, nome, descrição e visibilidade no catálogo.",
  },
  {
    key: "manage_stock",
    label: "Gerenciar estoque",
    description: "Permite alterar o estoque atual dos produtos e também o estoque mínimo.",
  },
];

const emptyPermissions: PermissionState = {
  view_all_transactions: false,
  discount_sales: false,
  manage_products: false,
  manage_stock: false,
};

function UsuariosPage() {
  const { currentStore } = useStoreContext();
  const storeId = currentStore?.id ?? "";
  const queryClient = useQueryClient();
  const fetchUsers = useServerFn(listStoreUsers);
  const createUser = useServerFn(createStoreUser);
  const updateUser = useServerFn(updateStoreUser);
  const [modalOpen, setModalOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<any | null>(null);

  const { data: users = [], isLoading } = useQuery({
    queryKey: ["store-users", storeId],
    queryFn: () => fetchUsers({ data: { store_id: storeId } }),
    enabled: !!storeId,
  });

  const createMutation = useMutation({
    mutationFn: (payload: NewUserPayload) => createUser({ data: payload }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["store-users", storeId] });
      setModalOpen(false);
      setSelectedUser(null);
    },
  });

  const updateMutation = useMutation({
    mutationFn: (payload: UpdateUserPayload) => updateUser({ data: payload }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["store-users", storeId] });
      setModalOpen(false);
      setSelectedUser(null);
    },
  });

  return (
    <PageShell
      title="Usuários"
      actions={
        <button
          type="button"
          onClick={() => {
            setSelectedUser(null);
            setModalOpen(true);
          }}
          className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2.5 text-[13px] font-medium text-primary-foreground transition-colors hover:bg-graphite"
        >
          <Plus className="h-4 w-4" strokeWidth={1.7} />
          Usuários
        </button>
      }
    >
      <div className="overflow-hidden rounded-lg border border-border bg-surface">
        <table className="w-full text-[13px]">
          <thead className="border-b border-border text-[12px] font-medium text-muted-foreground">
            <tr>
              <th className="px-4 py-3 text-left">Nome</th>
              <th className="px-4 py-3 text-left">Faturamento</th>
              <th className="px-4 py-3 text-left">Vendas</th>
              <th className="px-4 py-3 text-left">%</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {isLoading && (
              <tr>
                <td colSpan={4} className="px-4 py-12 text-center text-muted-foreground">
                  <Loader2 className="mx-auto h-4 w-4 animate-spin" strokeWidth={1.5} />
                </td>
              </tr>
            )}
            {!isLoading && users.length === 0 && (
              <tr>
                <td
                  colSpan={4}
                  className="px-4 py-12 text-center text-[13px] text-muted-foreground"
                >
                  Nenhum usuário cadastrado.
                </td>
              </tr>
            )}
            {users.map((user: any) => (
              <tr
                key={user.id}
                onClick={() => {
                  setSelectedUser(user);
                  setModalOpen(true);
                }}
                className="cursor-pointer transition-colors hover:bg-muted/35"
              >
                <td className="border-l-2 border-primary/35 px-4 py-4">
                  <div className="flex items-center gap-2">
                    <span className="h-2 w-2 rounded-full bg-primary/40" />
                    <span className="font-medium text-foreground">{user.name}</span>
                    {user.role === "owner" && (
                      <span className="rounded-full bg-primary/15 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-primary">
                        Owner
                      </span>
                    )}
                    {user.role === "admin" && (
                      <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-foreground">
                        Admin
                      </span>
                    )}
                  </div>
                  {user.email && (
                    <div className="mt-1 text-[11.5px] text-muted-foreground">{user.email}</div>
                  )}
                </td>
                <td className="px-4 py-4 text-foreground">{formatBRL(user.revenue)}</td>
                <td className="px-4 py-4 text-foreground">{user.sales_count}</td>
                <td className="px-4 py-4 text-foreground">{Math.round(user.share)}%</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {modalOpen && (
        <NewUserModal
          storeId={storeId}
          user={selectedUser}
          saving={createMutation.isPending || updateMutation.isPending}
          error={
            createMutation.error instanceof Error
              ? createMutation.error.message
              : updateMutation.error instanceof Error
                ? updateMutation.error.message
                : null
          }
          onClose={() => {
            setModalOpen(false);
            setSelectedUser(null);
          }}
          onSave={(payload) => {
            if ("member_id" in payload) updateMutation.mutate(payload);
            else createMutation.mutate(payload);
          }}
        />
      )}
    </PageShell>
  );
}

type NewUserPayload = {
  store_id: string;
  name: string;
  email: string;
  password: string;
  administrator: boolean;
  permissions: PermissionState;
};

type UpdateUserPayload = NewUserPayload & {
  member_id: string;
  user_id: string;
};

function NewUserModal({
  storeId,
  user,
  saving,
  error,
  onClose,
  onSave,
}: {
  storeId: string;
  user: any | null;
  saving: boolean;
  error: string | null;
  onClose: () => void;
  onSave: (payload: NewUserPayload | UpdateUserPayload) => void;
}) {
  const editing = !!user;
  const [name, setName] = useState(user?.name ?? "");
  const [email, setEmail] = useState(user?.email ?? "");
  const [password, setPassword] = useState("");
  const [administrator, setAdministrator] = useState(
    user?.role === "owner" || user?.role === "admin",
  );
  const [permissions, setPermissions] = useState<PermissionState>(() =>
    normalizePermissions(user?.permissions),
  );

  const canSave =
    !!storeId && name.trim() && email.trim() && (editing || password.length >= 6) && !saving;

  const togglePermission = (key: PermissionKey) => {
    setPermissions((current) => ({ ...current, [key]: !current[key] }));
  };

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/35 px-4">
      <div className="max-h-[92svh] w-full max-w-lg overflow-hidden rounded-lg border border-border bg-background shadow-2xl">
        <div className="flex items-center justify-between border-b border-border px-5 py-4">
          <div>
            <h2 className="text-[17px] font-semibold text-foreground">
              {editing ? "Detalhes do usuário" : "Novo usuário"}
            </h2>
            <p className="mt-1 text-[12px] text-muted-foreground">
              {editing
                ? "Altere os dados e permissões do vendedor."
                : "Cadastre um vendedor para esta loja."}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="grid h-8 w-8 place-items-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            aria-label="Fechar"
          >
            <X className="h-4 w-4" strokeWidth={1.6} />
          </button>
        </div>

        <div className="max-h-[calc(92svh-132px)] overflow-y-auto px-5 py-5">
          <div className="grid gap-4">
            <Field label="Nome">
              <input
                value={name}
                onChange={(event) => setName(event.target.value)}
                className="w-full rounded-md border border-border bg-surface px-3 py-2.5 text-[14px] outline-none focus:border-foreground/40"
              />
            </Field>
            <Field label="Email">
              <input
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                className="w-full rounded-md border border-border bg-surface px-3 py-2.5 text-[14px] outline-none focus:border-foreground/40"
              />
            </Field>
            <Field label="Senha">
              <input
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                placeholder={editing ? "Deixe em branco para manter a senha atual" : ""}
                className="w-full rounded-md border border-border bg-surface px-3 py-2.5 text-[14px] outline-none focus:border-foreground/40"
              />
            </Field>
          </div>

          <div className="mt-5 rounded-md bg-muted px-4 py-3 text-[12px] leading-relaxed text-foreground">
            <strong>Por padrão, todos os usuários têm acesso a:</strong> lançar pedidos e vendas,
            ver seus próprios pedidos, ver e cadastrar clientes e ver os produtos.
          </div>

          <div className="mt-5 space-y-4">
            <p className="text-[13px] text-muted-foreground">
              Se precisar, adicione outras permissões para{" "}
              <span className="font-medium text-foreground">{name.trim() || "este usuário"}</span>:
            </p>

            <PermissionToggle
              label="Administrador"
              description="Dá acesso a todas as funcionalidades da loja, exceto a gestão da assinatura, disponível apenas para o proprietário da conta."
              checked={administrator}
              disabled={user?.role === "owner"}
              onChange={() => setAdministrator((current) => !current)}
            />

            {permissionOptions.map((option) => (
              <PermissionToggle
                key={option.key}
                label={option.label}
                description={option.description}
                checked={permissions[option.key]}
                onChange={() => togglePermission(option.key)}
              />
            ))}
          </div>

          {error && (
            <div className="mt-5 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-[12px] text-red-700">
              {error}
            </div>
          )}
        </div>

        <div className="flex justify-end gap-2 border-t border-border px-5 py-4">
          <button
            type="button"
            onClick={onClose}
            className="rounded-md border border-border bg-surface px-4 py-2 text-[13px] font-medium text-foreground hover:bg-muted"
          >
            Cancelar
          </button>
          <button
            type="button"
            disabled={!canSave}
            onClick={() =>
              onSave(
                editing
                  ? {
                      store_id: storeId,
                      member_id: user.id,
                      user_id: user.user_id,
                      name,
                      email,
                      password,
                      administrator,
                      permissions,
                    }
                  : {
                      store_id: storeId,
                      name,
                      email,
                      password,
                      administrator,
                      permissions,
                    },
              )
            }
            className={cn(
              "inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-[13px] font-medium text-primary-foreground",
              canSave ? "hover:bg-graphite" : "cursor-not-allowed opacity-50",
            )}
          >
            {saving && <Loader2 className="h-3.5 w-3.5 animate-spin" strokeWidth={1.5} />}
            {editing ? "Salvar alterações" : "Criar usuário"}
          </button>
        </div>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-[12px] font-medium text-foreground">{label}</span>
      {children}
    </label>
  );
}

function PermissionToggle({
  label,
  description,
  checked,
  disabled = false,
  onChange,
}: {
  label: string;
  description: string;
  checked: boolean;
  disabled?: boolean;
  onChange: () => void;
}) {
  return (
    <div className="flex items-start justify-between gap-4">
      <div className="min-w-0">
        <div className="text-[14px] font-medium text-foreground">{label}</div>
        <p className="mt-0.5 text-[12px] leading-relaxed text-muted-foreground">{description}</p>
      </div>
      <button
        type="button"
        disabled={disabled}
        onClick={onChange}
        className={cn(
          "mt-0.5 flex h-5 w-9 shrink-0 items-center rounded-full p-0.5 transition-colors",
          checked ? "bg-primary" : "bg-border",
          disabled && "cursor-not-allowed opacity-60",
        )}
        aria-pressed={checked}
      >
        <span
          className={cn(
            "h-4 w-4 rounded-full bg-white transition-transform",
            checked ? "translate-x-4" : "translate-x-0",
          )}
        />
      </button>
    </div>
  );
}

function normalizePermissions(value: Partial<PermissionState> | null | undefined): PermissionState {
  return {
    view_all_transactions: !!value?.view_all_transactions,
    discount_sales: !!value?.discount_sales,
    manage_products: !!value?.manage_products,
    manage_stock: !!value?.manage_stock,
  };
}
