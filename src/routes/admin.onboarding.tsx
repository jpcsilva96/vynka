import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  CheckCircle2,
  Circle,
  Copy,
  ExternalLink,
  Loader2,
  Trash2,
  UploadCloud,
} from "lucide-react";
import { AppHeader } from "@/components/app-header";
import { RichEditor } from "@/components/products/rich-editor";
import { ImageUploader } from "@/components/products/image-uploader";
import { VariationsBuilder } from "@/components/products/variations-builder";
import { WhatsAppIcon } from "@/components/loja/store-header";
import { useStoreContext } from "@/lib/store-context";
import {
  SEGMENTS,
  canPublish,
  computeChecklist,
  digitsOnly,
  getStoreFull,
  isValidWhatsApp,
  progressPercent,
  publishStore,
  saveStep,
  uniqueSlugFromName,
  updateStore,
  uploadBranding,
  validateImage,
  type BrandingKind,
  type StoreFullRow,
} from "@/lib/onboarding";
import { isProvisionalName, isProvisionalSlug } from "@/lib/provisional-store";
import {
  createProduct,
  emptyProductForm,
  listCategories,
  type ProductFormState,
} from "@/lib/products";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/admin/onboarding")({
  head: () => ({ meta: [{ title: "Configuração inicial · VYNKA" }] }),
  component: OnboardingRoute,
});

const STEPS = [
  { n: 1, title: "Dados da loja" },
  { n: 2, title: "Identidade visual" },
  { n: 3, title: "Atendimento e entrega" },
  { n: 4, title: "Primeiro produto" },
  { n: 5, title: "Revisão e publicação" },
];

function OnboardingRoute() {
  const { currentStore, refresh, loading } = useStoreContext();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [step, setStep] = useState<number>(1);

  const storeId = currentStore?.id ?? "";
  const { data: store, isFetching } = useQuery({
    queryKey: ["store-full", storeId],
    queryFn: () => getStoreFull(storeId),
    enabled: !!storeId,
  });

  useEffect(() => {
    if (store) setStep(Math.min(5, Math.max(1, store.onboarding_current_step || 1)));
  }, [store?.id]);

  useEffect(() => {
    if (loading || !currentStore) return;
    if (currentStore.onboarding_status === "completed") {
      navigate({ to: "/admin/configuracoes", replace: true });
    }
  }, [loading, currentStore, navigate]);

  if (loading || isFetching || !store) {
    return (
      <div className="grid min-h-svh flex-1 place-items-center bg-background">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" strokeWidth={1.5} />
      </div>
    );
  }

  const invalidate = async () => {
    await refresh();
    await qc.invalidateQueries({ queryKey: ["store-full", storeId] });
  };

  return (
    <div className="flex min-h-svh min-w-0 flex-1 flex-col bg-background">
      <AppHeader title="Configuração inicial" description="Publique sua loja em minutos." />

      <div className="border-b border-border bg-surface">
        <div className="mx-auto max-w-6xl px-6 py-5 md:px-10">
          <div className="flex items-center justify-between text-[12px] text-muted-foreground">
            <span>Etapa {step} de 5</span>
            <span>{Math.round(((step - 1) / 4) * 100)}%</span>
          </div>
          <div className="mt-2 h-1 w-full overflow-hidden rounded-full bg-border">
            <div
              className="h-full bg-foreground transition-all"
              style={{ width: `${((step - 1) / 4) * 100}%` }}
            />
          </div>
          <ol className="mt-5 grid grid-cols-5 gap-2">
            {STEPS.map((s) => (
              <li key={s.n}>
                <button
                  type="button"
                  onClick={() => setStep(s.n)}
                  className={cn(
                    "flex w-full items-center gap-2 border-t-2 pt-3 text-left text-[12px] transition-colors",
                    step === s.n
                      ? "border-foreground text-foreground"
                      : "border-border text-muted-foreground hover:text-foreground",
                  )}
                >
                  <span
                    className={cn(
                      "grid h-5 w-5 shrink-0 place-items-center rounded-full text-[10px] font-medium",
                      step > s.n
                        ? "bg-foreground text-background"
                        : step === s.n
                        ? "bg-foreground text-background"
                        : "bg-border text-muted-foreground",
                    )}
                  >
                    {step > s.n ? <Check className="h-3 w-3" strokeWidth={2} /> : s.n}
                  </span>
                  <span className="hidden truncate md:inline">{s.title}</span>
                </button>
              </li>
            ))}
          </ol>
        </div>
      </div>

      <main className="flex-1 px-6 py-8 md:px-10 md:py-12">
        <div className="mx-auto max-w-6xl">
          {step === 1 && <Step1 store={store} onDone={async () => { await invalidate(); setStep(2); }} />}
          {step === 2 && <Step2 store={store} onBack={() => setStep(1)} onDone={async () => { await invalidate(); setStep(3); }} />}
          {step === 3 && <Step3 store={store} onBack={() => setStep(2)} onDone={async () => { await invalidate(); setStep(4); }} />}
          {step === 4 && <Step4 store={store} onBack={() => setStep(3)} onDone={async () => { await invalidate(); setStep(5); }} />}
          {step === 5 && <Step5 store={store} onBack={() => setStep(4)} />}
        </div>
      </main>
    </div>
  );
}

// ---------- STEP FOOTER ----------
function StepFooter({
  onBack,
  onSave,
  onSaveExit,
  primary = "Salvar e continuar",
  disabled,
  saving,
}: {
  onBack?: () => void;
  onSave: () => void | Promise<void>;
  onSaveExit?: () => void | Promise<void>;
  primary?: string;
  disabled?: boolean;
  saving?: boolean;
}) {
  return (
    <div className="mt-10 flex flex-col-reverse items-stretch gap-2 border-t border-border pt-6 md:flex-row md:items-center md:justify-between">
      <div className="flex items-center gap-2">
        {onBack && (
          <button
            type="button"
            onClick={onBack}
            className="inline-flex items-center gap-1.5 rounded-md border border-border bg-surface px-4 py-2.5 text-[13px] font-medium text-foreground hover:bg-muted"
          >
            <ArrowLeft className="h-3.5 w-3.5" strokeWidth={1.5} />
            Voltar
          </button>
        )}
      </div>
      <div className="flex items-center gap-2">
        {onSaveExit && (
          <button
            type="button"
            onClick={onSaveExit}
            className="rounded-md border border-border bg-surface px-4 py-2.5 text-[13px] font-medium text-foreground hover:bg-muted"
          >
            Salvar e sair
          </button>
        )}
        <button
          type="button"
          onClick={onSave}
          disabled={disabled || saving}
          className="inline-flex items-center gap-1.5 rounded-md bg-primary px-5 py-2.5 text-[13px] font-medium text-primary-foreground hover:bg-graphite disabled:opacity-50"
        >
          {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
          {primary}
          {!saving && <ArrowRight className="h-3.5 w-3.5" strokeWidth={1.5} />}
        </button>
      </div>
    </div>
  );
}

function SectionHead({ title, description }: { title: string; description: string }) {
  return (
    <div className="mb-8">
      <h1 className="font-serif text-[28px] font-light leading-tight text-foreground md:text-[36px]">{title}</h1>
      <p className="mt-2 text-[14px] text-muted-foreground">{description}</p>
    </div>
  );
}

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-[12px] font-medium text-foreground">{label}</span>
      {children}
      {hint && <span className="mt-1 block text-[11px] text-muted-foreground">{hint}</span>}
    </label>
  );
}

function Card({ children, className }: { children: React.ReactNode; className?: string }) {
  return <div className={cn("rounded-lg border border-border bg-surface p-6 md:p-8", className)}>{children}</div>;
}

// ---------- STEP 1 ----------
function Step1({ store, onDone }: { store: StoreFullRow; onDone: () => Promise<void> }) {
  const navigate = useNavigate();
  const [f, setF] = useState({
    name: isProvisionalName(store.name) ? "" : (store.name ?? ""),
    description: store.description ?? "",
    segment: store.segment ?? "",
    whatsapp: store.whatsapp ?? "",
    email: store.email ?? "",
    instagram: store.instagram ?? "",
  });
  const [saving, setSaving] = useState(false);

  const save = async (exit: boolean) => {
    setSaving(true);
    try {
      // O link nasce provisório; ao informar o nome, ele passa a ser derivado do nome.
      const slug = isProvisionalSlug(store.slug)
        ? await uniqueSlugFromName(store.id, f.name)
        : undefined;
      await saveStep(store.id, 2, slug ? { ...f, slug } : f);
      if (exit) navigate({ to: "/admin" });
      else await onDone();
    } catch (e) {
      console.error(e);
      alert("Não foi possível salvar.");
    } finally {
      setSaving(false);
    }
  };

  const valid = f.name.trim().length > 1;

  return (
    <div>
      <SectionHead title="Vamos começar pela sua loja" description="Essas informações serão exibidas no seu catálogo." />
      <Card>
        <div className="grid gap-5 md:grid-cols-2">
          <Field label="Nome da loja">
            <input
              value={f.name}
              onChange={(e) => setF({ ...f, name: e.target.value })}
              maxLength={80}
              className="w-full rounded-md border border-border bg-background px-3 py-2.5 text-[14px] outline-none focus:border-foreground/40"
            />
          </Field>
          <Field label="Segmento">
            <select
              value={f.segment}
              onChange={(e) => setF({ ...f, segment: e.target.value })}
              className="w-full appearance-none rounded-md border border-border bg-background px-3 py-2.5 text-[14px] outline-none focus:border-foreground/40"
            >
              <option value="">Selecione</option>
              {SEGMENTS.map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          </Field>
          <Field label="WhatsApp" hint="DDD + número (apenas dígitos)">
            <input
              inputMode="tel"
              value={f.whatsapp}
              onChange={(e) => setF({ ...f, whatsapp: digitsOnly(e.target.value) })}
              placeholder="11999999999"
              className="w-full rounded-md border border-border bg-background px-3 py-2.5 text-[14px] outline-none focus:border-foreground/40"
            />
          </Field>
          <Field label="E-mail de contato">
            <input
              type="email"
              value={f.email}
              onChange={(e) => setF({ ...f, email: e.target.value })}
              className="w-full rounded-md border border-border bg-background px-3 py-2.5 text-[14px] outline-none focus:border-foreground/40"
            />
          </Field>
          <Field label="Instagram" hint="Sem @">
            <input
              value={f.instagram}
              onChange={(e) => setF({ ...f, instagram: e.target.value.replace(/^@/, "") })}
              className="w-full rounded-md border border-border bg-background px-3 py-2.5 text-[14px] outline-none focus:border-foreground/40"
            />
          </Field>
          <div className="md:col-span-2">
            <Field label="Descrição da loja">
              <RichEditor
                value={f.description}
                onChange={(html) => setF({ ...f, description: html })}
                placeholder="Conte a história da sua marca em poucas linhas…"
              />
            </Field>
          </div>
        </div>
      </Card>
      <StepFooter
        onSave={() => save(false)}
        onSaveExit={() => save(true)}
        disabled={!valid}
        saving={saving}
      />
    </div>
  );
}

// ---------- STEP 2 ----------
function Step2({
  store,
  onDone,
  onBack,
}: {
  store: StoreFullRow;
  onBack: () => void;
  onDone: () => Promise<void>;
}) {
  const navigate = useNavigate();
  const [f, setF] = useState({
    logo_url: store.logo_url,
    banner_url: store.banner_url,
    og_image_url: store.og_image_url,
    banner_title: store.banner_title ?? "",
    banner_subtitle: store.banner_subtitle ?? "",
    banner_cta: store.banner_cta ?? "Ver coleção",
  });
  const [saving, setSaving] = useState(false);

  const save = async (exit: boolean) => {
    setSaving(true);
    try {
      await saveStep(store.id, 3, f);
      if (exit) navigate({ to: "/admin" });
      else await onDone();
    } catch (e) {
      console.error(e);
      alert("Não foi possível salvar.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div>
      <SectionHead title="Deixe sua loja com a sua identidade" description="Envie logo, banner e defina os textos que aparecerão no topo da loja." />
      <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_360px]">
        <Card>
          <div className="space-y-6">
            <BrandingSlot
              label="Logo"
              hint="PNG ou SVG (fundo transparente ideal)."
              value={f.logo_url}
              storeId={store.id}
              kind="logo"
              allowSvg
              onChange={(url) => setF({ ...f, logo_url: url })}
            />
            <BrandingSlot
              label="Banner principal"
              hint="Recomendado 2400×1200px."
              value={f.banner_url}
              storeId={store.id}
              kind="banner"
              onChange={(url) => setF({ ...f, banner_url: url })}
            />
            <BrandingSlot
              label="Imagem de compartilhamento"
              hint="Aparece ao compartilhar o link (1200×630px)."
              value={f.og_image_url}
              storeId={store.id}
              kind="og"
              onChange={(url) => setF({ ...f, og_image_url: url })}
            />

            <div className="grid gap-5 border-t border-border pt-6 md:grid-cols-2">
              <Field label="Texto principal do banner">
                <input
                  value={f.banner_title}
                  onChange={(e) => setF({ ...f, banner_title: e.target.value })}
                  placeholder="O essencial, refinado."
                  className="w-full rounded-md border border-border bg-background px-3 py-2.5 text-[14px] outline-none focus:border-foreground/40"
                />
              </Field>
              <Field label="Texto do botão">
                <input
                  value={f.banner_cta}
                  onChange={(e) => setF({ ...f, banner_cta: e.target.value })}
                  className="w-full rounded-md border border-border bg-background px-3 py-2.5 text-[14px] outline-none focus:border-foreground/40"
                />
              </Field>
              <div className="md:col-span-2">
                <Field label="Texto secundário">
                  <textarea
                    value={f.banner_subtitle}
                    onChange={(e) => setF({ ...f, banner_subtitle: e.target.value })}
                    rows={2}
                    className="w-full rounded-md border border-border bg-background px-3 py-2.5 text-[14px] outline-none focus:border-foreground/40"
                  />
                </Field>
              </div>
            </div>
          </div>
        </Card>

        <aside className="space-y-4">
          <div className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
            Pré-visualização
          </div>
          <div className="overflow-hidden rounded-lg border border-border bg-white">
            <div className="relative aspect-[4/3] w-full bg-neutral-100">
              {f.banner_url ? (
                <img src={f.banner_url} alt="" className="h-full w-full object-cover" />
              ) : (
                <div className="grid h-full place-items-center text-[12px] text-neutral-400">
                  Sem banner
                </div>
              )}
              <div className="absolute inset-0 bg-gradient-to-t from-black/45 to-transparent" />
              <div className="absolute inset-x-0 bottom-0 p-5">
                <div className="font-serif text-[22px] font-light leading-tight text-white">
                  {f.banner_title || "Título do banner"}
                </div>
                <p className="mt-1.5 text-[11px] text-white/80">
                  {f.banner_subtitle || "Subtítulo curto para acompanhar"}
                </p>
                <button className="mt-3 border border-white bg-white px-4 py-1.5 text-[10px] font-medium uppercase tracking-[0.2em] text-neutral-900">
                  {f.banner_cta || "Ver mais"}
                </button>
              </div>
            </div>
            <div className="flex items-center gap-3 border-t border-neutral-100 p-4">
              {f.logo_url ? (
                <img src={f.logo_url} alt="" className="h-6 w-auto object-contain" />
              ) : (
                <div className="text-[13px] font-medium">{store.name}</div>
              )}
            </div>
          </div>
        </aside>
      </div>
      <StepFooter
        onBack={onBack}
        onSave={() => save(false)}
        onSaveExit={() => save(true)}
        saving={saving}
      />
    </div>
  );
}

function BrandingSlot({
  label,
  hint,
  value,
  storeId,
  kind,
  allowSvg,
  onChange,
}: {
  label: string;
  hint?: string;
  value: string | null;
  storeId: string;
  kind: BrandingKind;
  allowSvg?: boolean;
  onChange: (url: string | null) => void;
}) {
  const [busy, setBusy] = useState(false);
  const [drag, setDrag] = useState(false);
  const input = useRef<HTMLInputElement>(null);

  const handle = async (file: File) => {
    const err = validateImage(file, allowSvg);
    if (err) return alert(err);
    setBusy(true);
    try {
      const url = await uploadBranding(storeId, kind, file);
      onChange(url);
    } catch (e) {
      console.error(e);
      alert("Não foi possível enviar o arquivo.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div>
      <div className="mb-1.5 flex items-center justify-between">
        <span className="text-[12px] font-medium text-foreground">{label}</span>
        {hint && <span className="text-[11px] text-muted-foreground">{hint}</span>}
      </div>
      {value ? (
        <div className="flex items-center gap-4 rounded-md border border-border bg-background p-3">
          <img src={value} alt="" className="h-16 w-16 rounded object-cover" />
          <div className="flex-1 text-[12px] text-muted-foreground">Arquivo enviado</div>
          <button
            type="button"
            onClick={() => input.current?.click()}
            className="rounded-md border border-border px-3 py-1.5 text-[12px] hover:bg-muted"
          >
            Substituir
          </button>
          <button
            type="button"
            onClick={() => onChange(null)}
            className="grid h-8 w-8 place-items-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground"
          >
            <Trash2 className="h-4 w-4" strokeWidth={1.5} />
          </button>
        </div>
      ) : (
        <div
          onClick={() => input.current?.click()}
          onDragOver={(e) => { e.preventDefault(); setDrag(true); }}
          onDragLeave={() => setDrag(false)}
          onDrop={(e) => {
            e.preventDefault(); setDrag(false);
            const f = e.dataTransfer.files?.[0]; if (f) handle(f);
          }}
          className={cn(
            "flex cursor-pointer flex-col items-center justify-center gap-2 rounded-md border border-dashed border-border bg-background/40 py-8 text-center transition-colors hover:border-foreground/40",
            drag && "border-foreground/60 bg-muted/60",
          )}
        >
          <div className="grid h-10 w-10 place-items-center rounded-full bg-muted text-muted-foreground">
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <UploadCloud className="h-4 w-4" strokeWidth={1.5} />}
          </div>
          <div className="text-[13px]">Arraste ou <span className="underline">selecione</span></div>
        </div>
      )}
      <input
        ref={input}
        type="file"
        accept={allowSvg ? "image/png,image/jpeg,image/webp,image/svg+xml" : "image/png,image/jpeg,image/webp"}
        className="hidden"
        onChange={(e) => { const f = e.target.files?.[0]; if (f) handle(f); e.target.value = ""; }}
      />
    </div>
  );
}

// ---------- STEP 3 ----------
function Step3({ store, onDone, onBack }: { store: StoreFullRow; onBack: () => void; onDone: () => Promise<void> }) {
  const navigate = useNavigate();
  const [f, setF] = useState({
    accepts_whatsapp_orders: store.accepts_whatsapp_orders,
    accepts_site_orders: store.accepts_site_orders,
    pickup_available: store.pickup_available,
    delivery_available: store.delivery_available,
    combine_delivery_whatsapp: store.combine_delivery_whatsapp,
    whatsapp: store.whatsapp ?? "",
    address: store.address ?? "",
    city: store.city ?? "",
    state: store.state ?? "",
    zip_code: store.zip_code ?? "",
    business_hours: store.business_hours ?? "",
    delivery_notes: store.delivery_notes ?? "",
  });
  const [saving, setSaving] = useState(false);

  const errors = useMemo(() => {
    const e: string[] = [];
    if (f.accepts_whatsapp_orders && !isValidWhatsApp(f.whatsapp)) e.push("Informe um WhatsApp válido para receber pedidos.");
    if (f.pickup_available && !f.address.trim()) e.push("Informe endereço ou instruções de retirada.");
    if (!f.accepts_whatsapp_orders && !f.accepts_site_orders) e.push("Selecione ao menos uma forma de receber pedidos.");
    return e;
  }, [f]);

  const save = async (exit: boolean) => {
    if (errors.length) return alert(errors[0]);
    setSaving(true);
    try {
      await saveStep(store.id, 4, f);
      if (exit) navigate({ to: "/admin" });
      else await onDone();
    } catch (e) {
      console.error(e);
      alert("Não foi possível salvar.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div>
      <SectionHead title="Como seus clientes compram?" description="Defina os canais de pedido e as opções de entrega." />
      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <div className="text-[12px] uppercase tracking-[0.14em] text-muted-foreground">Formas de pedido</div>
          <div className="mt-4 space-y-3">
            <Switch label="Receber pedidos pelo WhatsApp" checked={f.accepts_whatsapp_orders} onChange={(v) => setF({ ...f, accepts_whatsapp_orders: v })} />
            <Switch label="Receber pedidos pelo site" checked={f.accepts_site_orders} onChange={(v) => setF({ ...f, accepts_site_orders: v })} />
          </div>
          {f.accepts_whatsapp_orders && (
            <div className="mt-5">
              <Field label="WhatsApp de pedidos" hint="DDD + número">
                <input
                  inputMode="tel"
                  value={f.whatsapp}
                  onChange={(e) => setF({ ...f, whatsapp: digitsOnly(e.target.value) })}
                  className="w-full rounded-md border border-border bg-background px-3 py-2.5 text-[14px] outline-none focus:border-foreground/40"
                />
              </Field>
            </div>
          )}
        </Card>

        <Card>
          <div className="text-[12px] uppercase tracking-[0.14em] text-muted-foreground">Entrega</div>
          <div className="mt-4 space-y-3">
            <Switch label="Retirada no local" checked={f.pickup_available} onChange={(v) => setF({ ...f, pickup_available: v })} />
            <Switch label="Entrega" checked={f.delivery_available} onChange={(v) => setF({ ...f, delivery_available: v })} />
            <Switch label="Combinar entrega pelo WhatsApp" checked={f.combine_delivery_whatsapp} onChange={(v) => setF({ ...f, combine_delivery_whatsapp: v })} />
          </div>
        </Card>

        <Card className="md:col-span-2">
          <div className="text-[12px] uppercase tracking-[0.14em] text-muted-foreground">Endereço e atendimento</div>
          <div className="mt-4 grid gap-5 md:grid-cols-2">
            <Field label="Endereço"><input value={f.address} onChange={(e) => setF({ ...f, address: e.target.value })} className="w-full rounded-md border border-border bg-background px-3 py-2.5 text-[14px] outline-none focus:border-foreground/40" /></Field>
            <Field label="CEP"><input value={f.zip_code} onChange={(e) => setF({ ...f, zip_code: e.target.value })} className="w-full rounded-md border border-border bg-background px-3 py-2.5 text-[14px] outline-none focus:border-foreground/40" /></Field>
            <Field label="Cidade"><input value={f.city} onChange={(e) => setF({ ...f, city: e.target.value })} className="w-full rounded-md border border-border bg-background px-3 py-2.5 text-[14px] outline-none focus:border-foreground/40" /></Field>
            <Field label="Estado"><input value={f.state} maxLength={2} onChange={(e) => setF({ ...f, state: e.target.value.toUpperCase() })} className="w-full rounded-md border border-border bg-background px-3 py-2.5 text-[14px] outline-none focus:border-foreground/40" /></Field>
            <Field label="Horário de atendimento"><input value={f.business_hours} onChange={(e) => setF({ ...f, business_hours: e.target.value })} placeholder="Seg — Sáb · 10h às 20h" className="w-full rounded-md border border-border bg-background px-3 py-2.5 text-[14px] outline-none focus:border-foreground/40" /></Field>
            <Field label="Observações sobre entrega"><input value={f.delivery_notes} onChange={(e) => setF({ ...f, delivery_notes: e.target.value })} className="w-full rounded-md border border-border bg-background px-3 py-2.5 text-[14px] outline-none focus:border-foreground/40" /></Field>
          </div>
        </Card>
      </div>
      {errors.length > 0 && (
        <p className="mt-4 text-[12px] text-red-600">{errors[0]}</p>
      )}
      <StepFooter onBack={onBack} onSave={() => save(false)} onSaveExit={() => save(true)} disabled={errors.length > 0} saving={saving} />
    </div>
  );
}

function Switch({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex cursor-pointer items-center justify-between gap-4">
      <span className="text-[14px] text-foreground">{label}</span>
      <button
        type="button"
        onClick={() => onChange(!checked)}
        className={cn(
          "relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors",
          checked ? "bg-foreground" : "bg-border",
        )}
      >
        <span
          className={cn(
            "inline-block h-4 w-4 transform rounded-full bg-background transition-transform",
            checked ? "translate-x-4" : "translate-x-0.5",
          )}
        />
      </button>
    </label>
  );
}

// ---------- STEP 4 ----------
function Step4({ store, onDone, onBack }: { store: StoreFullRow; onBack: () => void; onDone: () => Promise<void> }) {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [form, setForm] = useState<ProductFormState>(() => ({ ...emptyProductForm(), status: "active" }));
  const [newCat, setNewCat] = useState("");
  const [saving, setSaving] = useState(false);
  const { data: categories = [], refetch: refetchCats } = useQuery({
    queryKey: ["categories", store.id],
    queryFn: () => listCategories(store.id),
  });
  const { data: existingCount = 0 } = useQuery({
    queryKey: ["active-products-count", store.id],
    queryFn: async () => {
      const { count } = await supabase.from("products").select("id", { count: "exact", head: true }).eq("store_id", store.id).eq("status", "active");
      return count ?? 0;
    },
  });

  const patch = (p: Partial<ProductFormState>) => setForm((f) => ({ ...f, ...p }));

  const addCategory = async () => {
    if (!newCat.trim()) return;
    const slug = newCat.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
    const { data } = await supabase.from("categories").insert({ store_id: store.id, name: newCat.trim(), slug, display_order: categories.length }).select("id,name,slug,display_order").single();
    if (data) {
      setNewCat("");
      await refetchCats();
      patch({ category_id: data.id });
    }
  };

  const priceNum = Number(form.price.replace(",", "."));
  const promoNum = form.promo_price ? Number(form.promo_price.replace(",", ".")) : null;
  const errors = useMemo(() => {
    const e: string[] = [];
    if (!form.name.trim()) e.push("Informe o nome do produto.");
    if (!priceNum || priceNum <= 0) e.push("Informe um preço válido.");
    if (promoNum != null && promoNum >= priceNum) e.push("O preço promocional deve ser menor que o preço.");
    if (form.images.length === 0) e.push("Envie ao menos uma imagem.");
    return e;
  }, [form, priceNum, promoNum]);

  const canSkip = existingCount > 0;

  const save = async (exit: boolean) => {
    if (errors.length && !canSkip) return alert(errors[0]);
    setSaving(true);
    try {
      if (!errors.length) {
        await createProduct(store.id, form);
      }
      await saveStep(store.id, 5, {});
      qc.invalidateQueries({ queryKey: ["active-products-count", store.id] });
      if (exit) navigate({ to: "/admin" });
      else await onDone();
    } catch (e) {
      console.error(e);
      alert("Não foi possível salvar o produto.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div>
      <SectionHead title="Cadastre seu primeiro produto" description="Um catálogo precisa de pelo menos um produto ativo para ser publicado." />
      {canSkip && (
        <div className="mb-6 rounded-md border border-border bg-surface px-4 py-3 text-[13px] text-muted-foreground">
          Você já possui {existingCount} produto{existingCount === 1 ? "" : "s"} ativo{existingCount === 1 ? "" : "s"}. Você pode adicionar outro ou avançar.
        </div>
      )}
      <Card>
        <div className="grid gap-5 md:grid-cols-2">
          <Field label="Nome do produto"><input value={form.name} onChange={(e) => patch({ name: e.target.value })} className="w-full rounded-md border border-border bg-background px-3 py-2.5 text-[14px] outline-none focus:border-foreground/40" /></Field>
          <Field label="Categoria">
            <div className="flex gap-2">
              <select value={form.category_id ?? ""} onChange={(e) => patch({ category_id: e.target.value || null })} className="flex-1 rounded-md border border-border bg-background px-3 py-2.5 text-[14px]">
                <option value="">Sem categoria</option>
                {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            <div className="mt-2 flex gap-2">
              <input value={newCat} onChange={(e) => setNewCat(e.target.value)} placeholder="Criar nova categoria" className="flex-1 rounded-md border border-border bg-background px-3 py-2 text-[13px]" />
              <button type="button" onClick={addCategory} className="rounded-md border border-border px-3 py-2 text-[12px] hover:bg-muted">Adicionar</button>
            </div>
          </Field>
          <Field label="Preço"><div className="flex items-center rounded-md border border-border bg-background pl-3"><span className="text-[13px] text-muted-foreground">R$</span><input inputMode="decimal" value={form.price} onChange={(e) => patch({ price: e.target.value.replace(/[^\d.,]/g, "") })} placeholder="0,00" className="w-full bg-transparent px-2 py-2.5 text-[14px] outline-none" /></div></Field>
          <Field label="Preço promocional"><div className="flex items-center rounded-md border border-border bg-background pl-3"><span className="text-[13px] text-muted-foreground">R$</span><input inputMode="decimal" value={form.promo_price} onChange={(e) => patch({ promo_price: e.target.value.replace(/[^\d.,]/g, "") })} placeholder="0,00" className="w-full bg-transparent px-2 py-2.5 text-[14px] outline-none" /></div></Field>
          <div className="md:col-span-2">
            <Field label="Descrição">
              <RichEditor value={form.description} onChange={(html) => patch({ description: html })} />
            </Field>
          </div>
          <div className="md:col-span-2">
            <Field label="Imagens"><ImageUploader images={form.images} onChange={(images) => patch({ images })} /></Field>
          </div>
          <Switch label="Produto em destaque" checked={form.featured} onChange={(v) => patch({ featured: v })} />
          <Switch label="Produto ativo" checked={form.status === "active"} onChange={(v) => patch({ status: v ? "active" : "draft" })} />
        </div>
        <div className="mt-8 border-t border-border pt-6">
          <div className="mb-3 text-[12px] uppercase tracking-[0.14em] text-muted-foreground">Variações (opcional)</div>
          <VariationsBuilder
            options={form.options}
            variants={form.variants}
            onOptionsChange={(options) => patch({ options })}
            onVariantsChange={(variants) => patch({ variants })}
            onManageStockChange={(manage_stock) => patch({ manage_stock })}
          />
        </div>
      </Card>
      {errors.length > 0 && !canSkip && (
        <p className="mt-4 text-[12px] text-red-600">{errors[0]}</p>
      )}
      <StepFooter
        onBack={onBack}
        onSave={() => save(false)}
        onSaveExit={() => save(true)}
        primary={canSkip && errors.length ? "Avançar" : "Salvar produto e continuar"}
        saving={saving}
      />
    </div>
  );
}

// ---------- STEP 5 ----------
function Step5({ store, onBack }: { store: StoreFullRow; onBack: () => void }) {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { refresh } = useStoreContext();
  const [publishing, setPublishing] = useState(false);
  const [published, setPublished] = useState(store.publication_status === "published");
  const [copied, setCopied] = useState(false);

  const { data: checklist } = useQuery({
    queryKey: ["store-checklist", store.id],
    queryFn: () => computeChecklist(store),
  });

  const publicUrl = typeof window !== "undefined" ? `${window.location.origin}/loja/${store.slug}` : `/loja/${store.slug}`;

  const doPublish = async () => {
    setPublishing(true);
    try {
      await publishStore(store.id);
      setPublished(true);
      await refresh();
      qc.invalidateQueries({ queryKey: ["store-full", store.id] });
    } catch (e) {
      alert((e as Error).message || "Não foi possível publicar.");
    } finally {
      setPublishing(false);
    }
  };

  const copyLink = async () => {
    try { await navigator.clipboard.writeText(publicUrl); setCopied(true); setTimeout(() => setCopied(false), 1500); } catch {}
  };

  return (
    <div>
      <SectionHead title={published ? "Seu catálogo está no ar." : "Sua loja está pronta para ser publicada"} description={published ? "Compartilhe o link e comece a receber pedidos." : "Revise as informações abaixo e publique quando quiser."} />

      {published && (
        <Card className="mb-6 border-foreground bg-foreground text-background">
          <div className="flex items-center gap-3">
            <CheckCircle2 className="h-5 w-5" strokeWidth={1.5} />
            <div className="text-[14px] font-medium">Publicado com sucesso</div>
          </div>
          <div className="mt-4 flex flex-wrap items-center gap-2">
            <code className="rounded bg-background/10 px-3 py-2 text-[12px]">{publicUrl}</code>
            <button onClick={copyLink} className="inline-flex items-center gap-1.5 rounded-md bg-background px-3 py-2 text-[12px] font-medium text-foreground hover:opacity-90">
              <Copy className="h-3.5 w-3.5" strokeWidth={1.5} />
              {copied ? "Copiado!" : "Copiar link"}
            </button>
            <a href={publicUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 rounded-md border border-background/30 px-3 py-2 text-[12px] font-medium hover:bg-background/10">
              <ExternalLink className="h-3.5 w-3.5" strokeWidth={1.5} />
              Abrir loja
            </a>
            <a
              href={`https://wa.me/?text=${encodeURIComponent(`Confira minha loja: ${publicUrl}`)}`}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1.5 rounded-md border border-background/30 px-3 py-2 text-[12px] font-medium hover:bg-background/10"
            >
              <WhatsAppIcon className="h-3.5 w-3.5" />
              Compartilhar no WhatsApp
            </a>
          </div>
          <button onClick={() => navigate({ to: "/admin" })} className="mt-6 inline-flex items-center gap-1.5 rounded-md bg-background px-4 py-2 text-[13px] font-medium text-foreground hover:opacity-90">
            Ir para o dashboard
          </button>
        </Card>
      )}

      <div className="grid gap-6 md:grid-cols-[minmax(0,1fr)_320px]">
        <Card>
          <div className="text-[12px] uppercase tracking-[0.14em] text-muted-foreground">Resumo da loja</div>
          <div className="mt-5 flex items-center gap-4">
            {store.logo_url && <img src={store.logo_url} alt="" className="h-12 w-12 rounded-md object-cover" />}
            <div>
              <div className="text-[18px] font-medium text-foreground">{store.name}</div>
              <div className="text-[12px] text-muted-foreground">{publicUrl}</div>
            </div>
          </div>
          <div className="mt-6 grid gap-3 text-[13px] md:grid-cols-2">
            <Info label="Segmento" value={store.segment} />
            <Info label="WhatsApp" value={store.whatsapp} />
            <Info label="E-mail" value={store.email} />
            <Info label="Instagram" value={store.instagram ? `@${store.instagram}` : null} />
            <Info label="Cidade" value={[store.city, store.state].filter(Boolean).join(" - ") || null} />
            <Info label="Horário" value={store.business_hours} />
          </div>
        </Card>

        <Card>
          <div className="text-[12px] uppercase tracking-[0.14em] text-muted-foreground">Checklist</div>
          <ul className="mt-4 space-y-3 text-[13px]">
            {checklist && [
              ["Dados preenchidos", checklist.hasName],
              ["Logo enviada", checklist.hasLogo],
              ["WhatsApp ou site", checklist.hasWhatsAppOrSite],
              ["Produto ativo", checklist.hasActiveProduct],
              ["Slug válido", checklist.hasSlug],
              ["Forma de pedido", checklist.hasOrderChannel],
            ].map(([l, ok]) => (
              <li key={l as string} className="flex items-center gap-2">
                {ok ? <CheckCircle2 className="h-4 w-4 text-foreground" strokeWidth={1.5} /> : <Circle className="h-4 w-4 text-muted-foreground" strokeWidth={1.5} />}
                <span className={ok ? "text-foreground" : "text-muted-foreground"}>{l}</span>
              </li>
            ))}
          </ul>
          {checklist && (
            <div className="mt-4 text-[12px] text-muted-foreground">
              Progresso: {progressPercent(checklist)}%
            </div>
          )}
        </Card>
      </div>

      {!published && (
        <div className="mt-8 flex flex-col-reverse items-stretch gap-2 border-t border-border pt-6 md:flex-row md:items-center md:justify-between">
          <button onClick={onBack} className="inline-flex items-center gap-1.5 rounded-md border border-border bg-surface px-4 py-2.5 text-[13px] font-medium hover:bg-muted">
            <ArrowLeft className="h-3.5 w-3.5" /> Voltar e editar
          </button>
          <div className="flex items-center gap-2">
            <Link to="/admin/preview" className="rounded-md border border-border bg-surface px-4 py-2.5 text-[13px] font-medium hover:bg-muted">
              Visualizar loja
            </Link>
            <button
              type="button"
              onClick={doPublish}
              disabled={publishing || !checklist || !canPublish(checklist)}
              className="inline-flex items-center gap-1.5 rounded-md bg-primary px-5 py-2.5 text-[13px] font-medium text-primary-foreground hover:bg-graphite disabled:opacity-50"
            >
              {publishing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
              Publicar catálogo
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function Info({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <div>
      <div className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground">{label}</div>
      <div className="mt-1 text-foreground">{value || <span className="text-muted-foreground">—</span>}</div>
    </div>
  );
}
