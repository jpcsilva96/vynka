import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import {
  Check,
  ChevronDown,
  ChevronRight,
  Copy,
  Edit3,
  Eye,
  EyeOff,
  FolderTree,
  GripVertical,
  ListPlus,
  Loader2,
  MoreVertical,
  Plus,
  Trash2,
  X,
} from "lucide-react";
import { PageShell, EmptyState } from "@/components/page-shell";
import {
  createCategory,
  deleteCategory,
  listCategories,
  slugifyCategory,
  updateCategory,
  type Category,
  type CategoryFormState,
} from "@/lib/products";
import { useStoreContext } from "@/lib/store-context";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/admin/categorias")({
  head: () => ({
    meta: [
      { title: "Categorias · VYNKA" },
      { name: "description", content: "Organize seus produtos em categorias." },
    ],
  }),
  component: Categorias,
});

type DraftState =
  | { mode: "create"; parent_id: string | null; name: string; active: boolean }
  | { mode: "edit"; category: Category; name: string; active: boolean };

function Categorias() {
  const qc = useQueryClient();
  const { currentStore } = useStoreContext();
  const storeId = currentStore?.id ?? "";
  const [expanded, setExpanded] = useState<Set<string>>(() => new Set());
  const [draft, setDraft] = useState<DraftState | null>(null);

  const { data: categories = [], isLoading } = useQuery({
    queryKey: ["categories", storeId],
    queryFn: () => listCategories(storeId),
    enabled: !!storeId,
  });

  const tree = useMemo(() => buildCategoryTree(categories), [categories]);
  const nextPosition = categories.length ? Math.max(...categories.map((c) => c.position)) + 1 : 0;
  const refresh = () => qc.invalidateQueries({ queryKey: ["categories", storeId] });

  const createMutation = useMutation({
    mutationFn: (form: CategoryFormState) => createCategory(storeId, form),
    onSuccess: async (_, form) => {
      await refresh();
      setDraft(null);
      if (form.parent_id) {
        setExpanded((current) => new Set(current).add(form.parent_id!));
      }
    },
    onError: (error) => alert(error instanceof Error ? error.message : "Não foi possível salvar a categoria."),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, form }: { id: string; form: CategoryFormState }) => updateCategory(storeId, id, form),
    onSuccess: async () => {
      await refresh();
      setDraft(null);
    },
    onError: (error) => alert(error instanceof Error ? error.message : "Não foi possível salvar a categoria."),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteCategory(storeId, id),
    onSuccess: () => refresh(),
    onError: (error) => alert(error instanceof Error ? error.message : "Não foi possível excluir a categoria."),
  });

  const saving = createMutation.isPending || updateMutation.isPending;

  const saveDraft = () => {
    if (!draft || !draft.name.trim()) return;
    if (draft.mode === "create") {
      const name = draft.name.trim();
      createMutation.mutate({
        name,
        slug: slugifyCategory(name),
        parent_id: draft.parent_id,
        active: draft.active,
        position: nextPosition,
      });
      return;
    }

    const name = draft.name.trim();
    updateMutation.mutate({
      id: draft.category.id,
      form: {
        id: draft.category.id,
        name,
        slug: draft.category.slug || slugifyCategory(name),
        parent_id: draft.category.parent_id,
        active: draft.active,
        position: draft.category.position,
      },
    });
  };

  const duplicate = (category: Category) => {
    createMutation.mutate({
      name: `${category.name} copia`,
      slug: `${category.slug}-copia`,
      parent_id: category.parent_id,
      active: category.active,
      position: nextPosition,
    });
  };

  const startSubcategory = (category: Category) => {
    setExpanded((current) => new Set(current).add(category.id));
    setDraft({ mode: "create", parent_id: category.id, name: "", active: true });
  };

  return (
    <PageShell
      title="Categorias"
      description="Para organizar seus produtos, crie categorias e subcategorias que aparecerão no menu da loja."
      actions={
        <button
          type="button"
          onClick={() => setDraft({ mode: "create", parent_id: null, name: "", active: true })}
          className="inline-flex items-center gap-1.5 rounded-md bg-primary px-4 py-2 text-[13px] font-medium text-primary-foreground transition-colors hover:bg-graphite"
        >
          <Plus className="h-3.5 w-3.5" strokeWidth={1.75} />
          Criar categoria
        </button>
      }
    >
      {isLoading ? (
        <div className="grid min-h-[360px] place-items-center rounded-lg border border-border bg-surface text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin" strokeWidth={1.5} />
        </div>
      ) : categories.length === 0 && !draft ? (
        <button
          type="button"
          onClick={() => setDraft({ mode: "create", parent_id: null, name: "", active: true })}
          className="block w-full text-left"
        >
          <EmptyState
            icon={<FolderTree className="h-5 w-5" strokeWidth={1.5} />}
            title="Nenhuma categoria criada"
            description="Clique aqui para criar a primeira categoria do seu catálogo."
          />
        </button>
      ) : (
        <div className="overflow-hidden border border-border bg-surface shadow-sm">
          <ul className="divide-y divide-border">
            {tree.map((node) => (
              <CategoryRow
                key={node.id}
                node={node}
                draft={draft}
                saving={saving}
                expanded={expanded}
                onDraftChange={setDraft}
                onSaveDraft={saveDraft}
                onCancelDraft={() => setDraft(null)}
                onToggle={(id) =>
                  setExpanded((current) => {
                    const next = new Set(current);
                    if (next.has(id)) next.delete(id);
                    else next.add(id);
                    return next;
                  })
                }
                onEdit={(category) => setDraft({ mode: "edit", category, name: category.name, active: category.active })}
                onAddSubcategory={startSubcategory}
                onDuplicate={duplicate}
                onDelete={(category) => {
                  if (!window.confirm(`Excluir "${category.name}"? Essa ação não pode ser desfeita.`)) return;
                  deleteMutation.mutate(category.id);
                }}
              />
            ))}
            {draft?.mode === "create" && draft.parent_id === null && (
              <InlineDraftRow
                depth={0}
                draft={draft}
                saving={saving}
                placeholder="Nome da categoria"
                onChange={setDraft}
                onSave={saveDraft}
                onCancel={() => setDraft(null)}
              />
            )}
          </ul>
        </div>
      )}

      <div className="mt-8 flex items-center gap-3 text-[13px] text-primary">
        <span className="grid h-8 w-8 place-items-center rounded-md bg-primary/5 text-foreground">?</span>
        <span>Mais sobre criar e organizar as categorias</span>
      </div>
    </PageShell>
  );
}

type CategoryNode = Category & { children: CategoryNode[] };

function buildCategoryTree(categories: Category[]): CategoryNode[] {
  const byId = new Map<string, CategoryNode>();
  const roots: CategoryNode[] = [];
  for (const category of categories) byId.set(category.id, { ...category, children: [] });
  for (const category of categories) {
    const node = byId.get(category.id)!;
    const parent = category.parent_id ? byId.get(category.parent_id) : null;
    if (parent) parent.children.push(node);
    else roots.push(node);
  }
  const sort = (items: CategoryNode[]) => {
    items.sort((a, b) => a.position - b.position || a.name.localeCompare(b.name));
    items.forEach((item) => sort(item.children));
  };
  sort(roots);
  return roots;
}

function CategoryRow({
  node,
  depth = 0,
  draft,
  saving,
  expanded,
  onDraftChange,
  onSaveDraft,
  onCancelDraft,
  onToggle,
  onEdit,
  onAddSubcategory,
  onDuplicate,
  onDelete,
}: {
  node: CategoryNode;
  depth?: number;
  draft: DraftState | null;
  saving: boolean;
  expanded: Set<string>;
  onDraftChange: (draft: DraftState) => void;
  onSaveDraft: () => void;
  onCancelDraft: () => void;
  onToggle: (id: string) => void;
  onEdit: (category: Category) => void;
  onAddSubcategory: (category: Category) => void;
  onDuplicate: (category: Category) => void;
  onDelete: (category: Category) => void;
}) {
  const isExpanded = expanded.has(node.id);
  const hasChildren = node.children.length > 0;
  const editing = draft?.mode === "edit" && draft.category.id === node.id;

  return (
    <>
      {editing ? (
        <InlineDraftRow
          depth={depth}
          draft={draft}
          saving={saving}
          placeholder="Nome da categoria"
          onChange={onDraftChange}
          onSave={onSaveDraft}
          onCancel={onCancelDraft}
        />
      ) : (
        <li className="grid min-h-[66px] grid-cols-[1fr_auto] items-center gap-3 bg-surface px-4 py-2 transition-colors hover:bg-muted/30 md:px-5">
          <div className="flex min-w-0 items-center gap-3" style={{ paddingLeft: depth * 40 }}>
            <GripVertical className="h-4 w-4 shrink-0 text-muted-foreground/50" strokeWidth={1.5} />
            <button
              type="button"
              onClick={() => hasChildren && onToggle(node.id)}
              className={cn(
                "grid h-8 w-8 shrink-0 place-items-center rounded-md text-foreground transition-colors",
                hasChildren ? "hover:bg-muted" : "opacity-30",
              )}
              aria-label={isExpanded ? "Recolher subcategorias" : "Expandir subcategorias"}
            >
              {hasChildren ? (
                isExpanded ? (
                  <ChevronDown className="h-4 w-4" strokeWidth={1.8} />
                ) : (
                  <ChevronRight className="h-4 w-4" strokeWidth={1.8} />
                )
              ) : (
                <span className="h-1.5 w-1.5 rounded-full bg-current" />
              )}
            </button>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <span className="truncate text-[15px] font-medium text-primary">{node.name}</span>
                {!node.active && (
                  <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
                    Inativa
                  </span>
                )}
              </div>
              <div className="mt-0.5 text-[12px] text-muted-foreground">
                {node.product_count ?? 0} produto{node.product_count === 1 ? "" : "s"} · /categoria/{node.slug}
              </div>
            </div>
          </div>

          <div className="flex items-center justify-end gap-2">
            <IconButton label="Duplicar" onClick={() => onDuplicate(node)}>
              <Copy className="h-4 w-4" strokeWidth={1.5} />
            </IconButton>
            <IconButton label="Adicionar subcategoria" onClick={() => onAddSubcategory(node)}>
              <ListPlus className="h-4 w-4" strokeWidth={1.5} />
            </IconButton>
            <IconButton label="Editar" onClick={() => onEdit(node)}>
              <Edit3 className="h-4 w-4" strokeWidth={1.5} />
            </IconButton>
            <IconButton label="Excluir" onClick={() => onDelete(node)}>
              <Trash2 className="h-4 w-4" strokeWidth={1.5} />
            </IconButton>
            <IconButton label="Mais opções">
              <MoreVertical className="h-4 w-4" strokeWidth={1.5} />
            </IconButton>
          </div>
        </li>
      )}

      {hasChildren && isExpanded && (
        <>
          {node.children.map((child) => (
            <CategoryRow
              key={child.id}
              node={child}
              depth={depth + 1}
              draft={draft}
              saving={saving}
              expanded={expanded}
              onDraftChange={onDraftChange}
              onSaveDraft={onSaveDraft}
              onCancelDraft={onCancelDraft}
              onToggle={onToggle}
              onEdit={onEdit}
              onAddSubcategory={onAddSubcategory}
              onDuplicate={onDuplicate}
              onDelete={onDelete}
            />
          ))}
          {draft?.mode === "create" && draft.parent_id === node.id && (
            <InlineDraftRow
              depth={depth + 1}
              draft={draft}
              saving={saving}
              placeholder="Nome da subcategoria"
              onChange={onDraftChange}
              onSave={onSaveDraft}
              onCancel={onCancelDraft}
            />
          )}
        </>
      )}
      {!hasChildren && draft?.mode === "create" && draft.parent_id === node.id && (
        <InlineDraftRow
          depth={depth + 1}
          draft={draft}
          saving={saving}
          placeholder="Nome da subcategoria"
          onChange={onDraftChange}
          onSave={onSaveDraft}
          onCancel={onCancelDraft}
        />
      )}
    </>
  );
}

function InlineDraftRow({
  depth,
  draft,
  saving,
  placeholder,
  onChange,
  onSave,
  onCancel,
}: {
  depth: number;
  draft: DraftState;
  saving: boolean;
  placeholder: string;
  onChange: (draft: DraftState) => void;
  onSave: () => void;
  onCancel: () => void;
}) {
  return (
    <li className="grid min-h-[66px] grid-cols-[1fr_auto] items-center gap-3 bg-background px-4 py-2 md:px-5">
      <div className="flex min-w-0 items-center gap-3" style={{ paddingLeft: depth * 40 }}>
        <GripVertical className="h-4 w-4 shrink-0 text-muted-foreground/50" strokeWidth={1.5} />
        <div className="h-8 w-8 shrink-0" />
        <input
          autoFocus
          value={draft.name}
          onChange={(event) => onChange({ ...draft, name: event.target.value })}
          onKeyDown={(event) => {
            if (event.key === "Enter") onSave();
            if (event.key === "Escape") onCancel();
          }}
          placeholder={placeholder}
          className="min-w-0 flex-1 rounded-lg border border-primary bg-surface px-4 py-2.5 text-[15px] outline-none ring-4 ring-primary/10"
        />
      </div>

      <div className="flex items-center justify-end gap-2">
        <IconButton
          label={draft.active ? "Categoria ativa" : "Categoria inativa"}
          onClick={() => onChange({ ...draft, active: !draft.active })}
        >
          {draft.active ? (
            <Eye className="h-4 w-4" strokeWidth={1.5} />
          ) : (
            <EyeOff className="h-4 w-4" strokeWidth={1.5} />
          )}
        </IconButton>
        <IconButton label="Cancelar" onClick={onCancel}>
          <X className="h-4 w-4" strokeWidth={1.5} />
        </IconButton>
        <button
          type="button"
          disabled={saving || !draft.name.trim()}
          onClick={onSave}
          className="inline-flex h-10 items-center gap-2 rounded-md bg-primary px-4 text-[13px] font-medium text-primary-foreground transition-colors hover:bg-graphite disabled:opacity-50"
        >
          {saving ? <Loader2 className="h-4 w-4 animate-spin" strokeWidth={1.5} /> : <Check className="h-4 w-4" strokeWidth={1.5} />}
          Salvar
        </button>
      </div>
    </li>
  );
}

function IconButton({
  label,
  children,
  onClick,
}: {
  label: string;
  children: React.ReactNode;
  onClick?: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={label}
      aria-label={label}
      className="grid h-10 w-10 place-items-center rounded-full border border-border bg-surface text-foreground transition-colors hover:border-foreground/30 hover:bg-muted"
    >
      {children}
    </button>
  );
}
