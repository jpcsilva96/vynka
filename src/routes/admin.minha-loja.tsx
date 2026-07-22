import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowRight, Check, Globe2, Loader2 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { PageShell } from "@/components/page-shell";
import { supabase } from "@/integrations/supabase/client";
import { useStoreContext } from "@/lib/store-context";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/admin/minha-loja")({
  head: () => ({
    meta: [
      { title: "Catálogo Online - VYNKA" },
      { name: "description", content: "Configure seu catálogo online." },
    ],
  }),
  component: CatalogoOnline,
});

interface CatalogStoreForm {
  id: string;
  name: string;
  slug: string;
  responsible_name: string | null;
  tax_document: string | null;
}

function CatalogoOnline() {
  const { currentStore, refresh } = useStoreContext();
  const storeId = currentStore?.id ?? "";
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [accepted, setAccepted] = useState(true);
  const [error, setError] = useState("");
  const [form, setForm] = useState({
    name: "",
    slug: "",
    responsible_name: "",
    tax_document: "",
  });

  const { data, isLoading } = useQuery({
    queryKey: ["catalog-store", storeId],
    queryFn: () => getCatalogStore(storeId),
    enabled: !!storeId,
  });

  useEffect(() => {
    if (!data) return;
    setForm({
      name: data.name ?? "",
      slug: data.slug ?? "",
      responsible_name: data.responsible_name ?? "",
      tax_document: data.tax_document ?? "",
    });
  }, [data]);

  const publicPath = useMemo(() => `${form.slug || "minha-loja"}.vynka.site`, [form.slug]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      setError("");
      const nextName = form.name.trim();
      const nextSlug = normalizeSlug(form.slug || form.name);
      if (!nextName) throw new Error("Informe o nome da loja.");
      if (!nextSlug) throw new Error("Informe o link do catálogo.");
      if (!accepted) throw new Error("Aceite os termos para continuar.");

      const { data: conflict, error: conflictError } = await supabase
        .from("stores")
        .select("id")
        .eq("slug", nextSlug)
        .neq("id", storeId)
        .maybeSingle();
      if (conflictError) throw conflictError;
      if (conflict) throw new Error("Esse link de catálogo já está em uso.");

      const { error: updateError } = await supabase
        .from("stores")
        .update({
          name: nextName,
          slug: nextSlug,
          responsible_name: clean(form.responsible_name),
          tax_document: clean(form.tax_document),
          onboarding_status: "in_progress",
          onboarding_current_step: 1,
        })
        .eq("id", storeId);
      if (updateError) throw updateError;
      return nextSlug;
    },
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["catalog-store", storeId] }),
        refresh(),
      ]);
      navigate({ to: "/admin/onboarding" });
    },
    onError: (err) => {
      setError(err instanceof Error ? err.message : "Não foi possível salvar o catálogo.");
    },
  });

  const patch = (key: keyof typeof form, value: string) => {
    setError("");
    setForm((current) => ({
      ...current,
      [key]: key === "slug" ? normalizeSlug(value) : value,
    }));
  };

  return (
    <PageShell title="Catálogo Online">
      <div className="overflow-hidden rounded-lg bg-surface shadow-sm">
        <div className="grid h-36 place-items-center bg-primary md:h-40">
          <CatalogIllustration />
        </div>

        <div className="mx-auto max-w-[430px] px-5 py-10">
          <h1 className="text-center text-[25px] font-semibold leading-tight text-foreground">
            Vamos criar seu Catálogo Online?
          </h1>

          {isLoading ? (
            <div className="grid min-h-72 place-items-center">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" strokeWidth={1.5} />
            </div>
          ) : (
            <div className="mt-8 space-y-4">
              <FloatingInput
                label="Nome da Loja"
                value={form.name}
                onChange={(value) => {
                  patch("name", value);
                  if (!form.slug || form.slug === normalizeSlug(form.name)) {
                    patch("slug", normalizeSlug(value));
                  }
                }}
                placeholder="Linda Fitness"
              />

              <FloatingInput
                label="Link do catálogo"
                value={form.slug}
                onChange={(value) => patch("slug", value)}
                placeholder="linda-fitness"
                suffix=".vynka.site"
              />

              <div className="pt-3">
                <h2 className="mb-3 text-[16px] font-semibold text-foreground">Identificação</h2>
                <div className="space-y-4">
                  <FloatingInput
                    label="CPF ou CNPJ"
                    value={form.tax_document}
                    onChange={(value) => patch("tax_document", value)}
                    placeholder="451.593.478-36"
                  />
                  <FloatingInput
                    label="Nome"
                    value={form.responsible_name}
                    onChange={(value) => patch("responsible_name", value)}
                    placeholder="João Pedro Carmo Silva"
                  />
                </div>
                <p className="mt-2 text-[11px] leading-relaxed text-foreground">
                  Informar o CPF ou CNPJ é uma medida para validar a sua conta, preservar sua
                  privacidade e garantir a qualidade de todos os catálogos do Vynka.{" "}
                  <strong>
                    Os dados de identificação não serão exibidos no seu Catálogo Online.
                  </strong>
                </p>
              </div>

              <label className="flex cursor-pointer items-start gap-3 pt-6">
                <button
                  type="button"
                  onClick={() => setAccepted((current) => !current)}
                  className={cn(
                    "mt-0.5 flex h-5 w-9 shrink-0 items-center rounded-full p-0.5 transition-colors",
                    accepted ? "bg-primary" : "bg-border",
                  )}
                  aria-pressed={accepted}
                >
                  <span
                    className={cn(
                      "h-4 w-4 rounded-full bg-white transition-transform",
                      accepted ? "translate-x-4" : "translate-x-0",
                    )}
                  />
                </button>
                <span className="text-[13px] font-semibold leading-relaxed text-foreground">
                  Concordo com os{" "}
                  <a
                    className="text-primary hover:text-graphite"
                    href="#"
                    onClick={(event) => event.preventDefault()}
                  >
                    Termos de uso
                  </a>{" "}
                  e{" "}
                  <a
                    className="text-primary hover:text-graphite"
                    href="#"
                    onClick={(event) => event.preventDefault()}
                  >
                    Política de Privacidade.
                  </a>
                </span>
              </label>

              {error && (
                <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-[12px] text-red-700">
                  {error}
                </div>
              )}

              <button
                type="button"
                disabled={saveMutation.isPending}
                onClick={() => saveMutation.mutate()}
                className="mt-6 inline-flex w-full items-center justify-center gap-2 rounded-md bg-primary px-5 py-3 text-[13px] font-semibold text-primary-foreground transition-colors hover:bg-graphite disabled:opacity-60"
              >
                {saveMutation.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" strokeWidth={1.5} />
                ) : (
                  <>
                    Continuar
                    <ArrowRight className="h-4 w-4" strokeWidth={2} />
                  </>
                )}
              </button>

              <div className="flex items-center justify-center gap-2 text-[11px] text-muted-foreground">
                <Globe2 className="h-3.5 w-3.5" strokeWidth={1.5} />
                {publicPath}
              </div>
            </div>
          )}
        </div>
      </div>
    </PageShell>
  );
}

function FloatingInput({
  label,
  value,
  onChange,
  placeholder,
  suffix,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  suffix?: string;
}) {
  return (
    <label className="relative block rounded-md border border-border bg-surface px-3 py-2 focus-within:border-foreground/40">
      <span className="absolute -top-2 left-3 bg-surface px-1 text-[11px] font-medium text-muted-foreground">
        {label}
      </span>
      <div className="flex items-center gap-2">
        <input
          value={value}
          onChange={(event) => onChange(event.target.value)}
          placeholder={placeholder}
          className="min-w-0 flex-1 bg-transparent py-1.5 text-[14px] outline-none placeholder:text-muted-foreground"
        />
        {suffix && <span className="text-[12px] text-muted-foreground">{suffix}</span>}
      </div>
    </label>
  );
}

function CatalogIllustration() {
  return (
    <div className="relative h-24 w-44 text-slate-600">
      <div className="absolute left-14 top-0 h-20 w-28 rounded-md border-2 border-slate-600 bg-white p-2 shadow-sm">
        <div className="mx-auto mb-2 h-0.5 w-4 rounded bg-slate-600" />
        <div className="grid grid-cols-3 gap-2">
          {Array.from({ length: 9 }).map((_, index) => (
            <div key={index} className="space-y-1">
              <div className="h-3 rounded-sm bg-slate-200" />
              <div className="mx-auto h-0.5 w-3 rounded bg-primary" />
            </div>
          ))}
        </div>
      </div>
      <div className="absolute bottom-0 left-[102px] h-5 w-0.5 bg-slate-600" />
      <div className="absolute bottom-0 left-[74px] h-0.5 w-16 bg-slate-600" />
      <div className="absolute bottom-0 left-6 h-16 w-10 rounded-md border-2 border-slate-600 bg-white p-2 shadow-sm">
        <div className="mx-auto mb-2 h-0.5 w-3 rounded bg-slate-600" />
        <div className="space-y-1.5">
          <div className="h-1.5 rounded bg-slate-200" />
          <div className="h-1.5 rounded bg-primary/70" />
          <div className="h-1.5 rounded bg-slate-200" />
          <div className="h-1.5 rounded bg-primary/70" />
        </div>
        <div className="absolute bottom-1 left-1/2 h-1.5 w-1.5 -translate-x-1/2 rounded-full border border-slate-600" />
      </div>
      <Check className="absolute right-1 top-3 h-4 w-4 text-primary" strokeWidth={2} />
    </div>
  );
}

async function getCatalogStore(storeId: string): Promise<CatalogStoreForm | null> {
  const { data, error } = await supabase
    .from("stores")
    .select("id,name,slug,responsible_name,tax_document")
    .eq("id", storeId)
    .maybeSingle();
  if (error) throw error;
  return data;
}

function normalizeSlug(value: string) {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}

function clean(value: string) {
  return value.trim() || null;
}
