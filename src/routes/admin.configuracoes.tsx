import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Check,
  CheckCircle2,
  Circle,
  Eye,
  ExternalLink,
  HelpCircle,
  ImageIcon,
  Instagram,
  LayoutTemplate,
  Loader2,
  Store,
  UploadCloud,
  X,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { PageShell } from "@/components/page-shell";
import {
  DeliverySettingsTab,
  OrderStockSettingsTab,
  PaymentSettingsTab,
} from "@/components/admin/checkout-settings";
import { isProvisionalSlug } from "@/lib/provisional-store";
import { canPublish, computeChecklist, getStoreFull, publishStore } from "@/lib/onboarding";
import { formatPhone } from "@/lib/br-documents";
import {
  getGeneralSettings,
  getReceiptSettings,
  updateGeneralSettings,
  updateReceiptSettings,
  uploadStoreBranding,
  defaultReceiptSettings,
  normalizeSlug,
  type GeneralSettingsForm,
  type ReceiptSettings,
  type StoreBrandingKind,
} from "@/lib/store-settings";
import { useStoreContext } from "@/lib/store-context";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/admin/configuracoes")({
  head: () => ({
    meta: [
      { title: "Loja e Catálogo - VYNKA" },
      { name: "description", content: "Edite as informações da loja e do catálogo." },
    ],
  }),
  component: Configuracoes,
});

const tabs = [
  "Loja",
  "Personalizar loja",
  "Pedidos e Vendas",
  "Recibo",
  "Pagamentos",
  "Entrega e Retirada",
  "Integrações",
];

const emptyForm: GeneralSettingsForm = {
  name: "",
  slug: "",
  responsible_name: "",
  tax_document: "",
  phone: "",
  whatsapp: "",
  email: "",
  address: "",
  address_number: "",
  complement: "",
  city: "",
  state: "",
  zip_code: "",
  instagram: "",
  segment: "",
  description: "",
  logo_url: "",
  favicon_url: "",
  banner_url: "",
  og_image_url: "",
  banner_title: "",
  banner_subtitle: "",
  banner_cta: "",
  accepts_whatsapp_orders: true,
  accepts_site_orders: true,
};

function Configuracoes() {
  const { currentStore, refresh } = useStoreContext();
  const storeId = currentStore?.id ?? "";
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState("Loja");
  // Volta do Melhor Envio / Mercado Pago (e outros links diretos) abre a aba certa:
  // ?aba=entrega ou ?aba=pagamentos.
  useEffect(() => {
    const aba = new URLSearchParams(window.location.search).get("aba");
    if (aba === "entrega") setActiveTab("Entrega e Retirada");
    if (aba === "pagamentos") setActiveTab("Pagamentos");
    if (aba === "personalizar") setActiveTab("Personalizar loja");
  }, []);
  const [form, setForm] = useState<GeneralSettingsForm>(emptyForm);
  const [receiptForm, setReceiptForm] = useState<ReceiptSettings>(defaultReceiptSettings);
  const [uploadingImage, setUploadingImage] = useState<StoreBrandingKind | null>(null);
  const [cepLoading, setCepLoading] = useState(false);
  const [saved, setSaved] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ["general-settings", storeId],
    queryFn: () => getGeneralSettings(storeId),
    enabled: !!storeId,
  });
  const { data: receiptSettings, isLoading: receiptLoading } = useQuery({
    queryKey: ["receipt-settings", storeId],
    queryFn: () => getReceiptSettings(storeId),
    enabled: !!storeId,
  });

  useEffect(() => {
    if (data) setForm(data);
  }, [data]);
  useEffect(() => {
    if (receiptSettings) setReceiptForm(receiptSettings);
  }, [receiptSettings]);

  const saveMutation = useMutation({
    mutationFn: () => updateGeneralSettings(storeId, form),
    onSuccess: async () => {
      setSaved(true);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["general-settings", storeId] }),
        queryClient.invalidateQueries({ queryKey: ["store-publication", storeId] }),
        refresh(),
      ]);
      window.setTimeout(() => setSaved(false), 2200);
    },
  });

  const uploadMutation = useMutation({
    mutationFn: ({ kind, file }: { kind: StoreBrandingKind; file: File }) =>
      uploadStoreBranding(storeId, kind, file),
    onSuccess: (url, variables) => {
      const field =
        variables.kind === "logo"
          ? "logo_url"
          : variables.kind === "favicon"
            ? "favicon_url"
          : variables.kind === "banner"
            ? "banner_url"
            : "og_image_url";
      setForm((current) => ({ ...current, [field]: url }));
      setUploadingImage(null);
    },
    onError: () => {
      setUploadingImage(null);
    },
  });

  const receiptMutation = useMutation({
    mutationFn: () => updateReceiptSettings(storeId, receiptForm),
    onSuccess: async () => {
      setSaved(true);
      await queryClient.invalidateQueries({ queryKey: ["receipt-settings", storeId] });
      window.setTimeout(() => setSaved(false), 2200);
    },
  });

  const patch = (key: keyof GeneralSettingsForm, value: string) => {
    setSaved(false);
    setForm((current) => ({ ...current, [key]: key === "slug" ? normalizeSlug(value) : value }));
  };
  const patchPhone = (key: Extract<keyof GeneralSettingsForm, "phone" | "whatsapp">, value: string) => {
    patch(key, digitsOnly(value).slice(0, 11));
  };
  const patchCep = (value: string) => {
    const cep = digitsOnly(value).slice(0, 8);
    patch("zip_code", cep);
    if (cep.length === 8) void fillAddressFromCep(cep);
  };
  const fillAddressFromCep = async (cep: string) => {
    setCepLoading(true);
    try {
      const response = await fetch(`https://viacep.com.br/ws/${cep}/json/`);
      const data = (await response.json()) as {
        erro?: boolean;
        logradouro?: string;
        localidade?: string;
        uf?: string;
      };
      if (data.erro) return;
      setSaved(false);
      setForm((current) => ({
        ...current,
        address: data.logradouro || current.address,
        city: data.localidade || current.city,
        state: data.uf || current.state,
      }));
    } finally {
      setCepLoading(false);
    }
  };
  const patchReceipt = <K extends keyof ReceiptSettings>(key: K, value: ReceiptSettings[K]) => {
    setSaved(false);
    setReceiptForm((current) => ({ ...current, [key]: value }));
  };

  return (
    <PageShell title="Loja e Catálogo">
      <div className="space-y-7">
        <div className="flex flex-wrap gap-3">
          {tabs.map((tab) => (
            <button
              key={tab}
              type="button"
              onClick={() => setActiveTab(tab)}
              className={cn(
                "rounded-full px-4 py-1.5 text-[11px] font-semibold uppercase tracking-[0] transition-colors",
                activeTab === tab
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted text-foreground hover:bg-border",
              )}
            >
              {tab}
            </button>
          ))}
        </div>

        {activeTab === "Pedidos e Vendas" ? (
          <OrderStockSettingsTab storeId={storeId} />
        ) : activeTab === "Entrega e Retirada" ? (
          <DeliverySettingsTab storeId={storeId} storeAddress={formatStoreAddress(form)} />
        ) : activeTab === "Pagamentos" ? (
          <PaymentSettingsTab storeId={storeId} />
        ) : activeTab === "Loja" ? (
          isLoading ? (
            <div className="grid min-h-[420px] place-items-center rounded-lg border border-border bg-surface">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" strokeWidth={1.5} />
            </div>
          ) : (
            <div className="space-y-6">
              <div className="text-center">
                <div className="mx-auto grid h-20 w-20 place-items-center rounded-md bg-muted text-primary">
                  {form.logo_url ? (
                    <img
                      src={form.logo_url}
                      alt=""
                      className="h-full w-full rounded-md object-contain"
                    />
                  ) : (
                    <Store className="h-10 w-10" strokeWidth={1.3} />
                  )}
                </div>
                <h2 className="mt-3 text-[15px] font-semibold text-foreground">
                  Loja e Catálogo
                </h2>
                <p className="mt-1 text-[12px] text-muted-foreground">
                  Edite os dados exibidos no catálogo público e nos canais de atendimento.
                </p>
              </div>

              <PublicationCard storeId={storeId} hasUnsavedChanges={form !== data} />

              <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">
                <SettingsCard title="Dados da loja">
                  <LabeledField label="Nome da loja">
                    <TextInput
                      value={form.name}
                      onChange={(value) => {
                        const currentAutoSlug = normalizeSlug(form.name);
                        patch("name", value);
                        if (!form.slug || form.slug === currentAutoSlug || isProvisionalSlug(form.slug)) {
                          patch("slug", value);
                        }
                      }}
                    />
                  </LabeledField>
                  <LabeledField label="Link público do catálogo">
                    <div className="rounded-md border border-border bg-surface focus-within:border-foreground/40">
                      <div className="flex items-center px-3 py-2.5">
                        <input
                          value={form.slug}
                          onChange={(event) => patch("slug", event.target.value)}
                          className="min-w-0 flex-1 bg-transparent text-[14px] outline-none placeholder:text-muted-foreground"
                        />
                        <span className="shrink-0 text-[13px] text-muted-foreground">.vynka.com.br</span>
                      </div>
                    </div>
                    <div className="mt-2 flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground">
                      <span>{form.slug || "nome-da-loja"}.vynka.com.br</span>
                      {form.slug && (
                        <a
                          href={`/loja/${form.slug}`}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1 font-medium text-foreground hover:underline"
                        >
                          Abrir catálogo
                          <ExternalLink className="h-3 w-3" strokeWidth={1.5} />
                        </a>
                      )}
                    </div>
                  </LabeledField>
                  <LabeledField label="Nome do responsável">
                    <TextInput
                      value={form.responsible_name}
                      onChange={(value) => patch("responsible_name", value)}
                    />
                  </LabeledField>
                  <LabeledField label="CPF ou CNPJ">
                    <TextInput
                      value={form.tax_document}
                      onChange={(value) => patch("tax_document", value)}
                    />
                  </LabeledField>
                </SettingsCard>

                <SettingsCard title="Informações de contato">
                  <p className="-mt-1 mb-2 text-[12px] leading-relaxed text-muted-foreground">
                    Estes dados aparecem no rodapé da loja e nos botões de atendimento.
                  </p>
                  <LabeledField label="Telefone da loja">
                    <TextInput
                      type="tel"
                      value={formatPhone(form.phone)}
                      onChange={(value) => patchPhone("phone", value)}
                      help
                    />
                  </LabeledField>
                  <LabeledField label="WhatsApp da loja">
                    <TextInput
                      type="tel"
                      value={formatPhone(form.whatsapp)}
                      onChange={(value) => patchPhone("whatsapp", value)}
                      help
                    />
                  </LabeledField>
                  <LabeledField label="Instagram da loja">
                    <TextInput
                      value={form.instagram ? `@${form.instagram.replace(/^@/, "")}` : ""}
                      onChange={(value) => patch("instagram", value.replace(/^@/, ""))}
                    />
                  </LabeledField>
                  <LabeledField label="E-mail da loja">
                    <TextInput
                      type="email"
                      value={form.email}
                      onChange={(value) => patch("email", value)}
                    />
                  </LabeledField>
                  <LabeledField label="CEP">
                    <TextInput
                      value={formatCep(form.zip_code)}
                      onChange={patchCep}
                      trailing={cepLoading ? <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" strokeWidth={1.5} /> : null}
                    />
                  </LabeledField>
                  <LabeledField label="Endereço da loja">
                    <TextInput
                      value={form.address}
                      onChange={(value) => patch("address", value)}
                    />
                  </LabeledField>
                  <div className="grid gap-3 sm:grid-cols-[140px_minmax(0,1fr)]">
                    <LabeledField label="Número">
                      <TextInput
                        value={form.address_number}
                        onChange={(value) => patch("address_number", value)}
                      />
                    </LabeledField>
                    <LabeledField label="Complemento">
                      <TextInput
                        value={form.complement}
                        onChange={(value) => patch("complement", value)}
                      />
                    </LabeledField>
                  </div>
                  <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_88px]">
                    <LabeledField label="Cidade">
                      <TextInput
                        value={form.city}
                        onChange={(value) => patch("city", value)}
                      />
                    </LabeledField>
                    <LabeledField label="UF">
                      <TextInput
                        value={form.state}
                        onChange={(value) => patch("state", value.toUpperCase())}
                      />
                    </LabeledField>
                  </div>
                </SettingsCard>

                <div className="space-y-5">
                  <SettingsCard title="Identidade da loja online">
                    <div className="grid gap-4">
                      <ImageUploadField
                        label="Logo da loja"
                        description="Aparece no topo da loja, no rodapé e nos recibos."
                        value={form.logo_url}
                        kind="logo"
                        uploading={uploadMutation.isPending && uploadingImage === "logo"}
                        ratio="square"
                        onUpload={(kind, file) => {
                          setSaved(false);
                          setUploadingImage(kind);
                          uploadMutation.mutate({ kind, file });
                        }}
                        onRemove={() => patch("logo_url", "")}
                      />
                      <ImageUploadField
                        label="Favicon"
                        description="Pequeno ícone exibido na aba do navegador. Recomendado: 130 x 130 px."
                        value={form.favicon_url}
                        kind="favicon"
                        uploading={uploadMutation.isPending && uploadingImage === "favicon"}
                        ratio="icon"
                        onUpload={(kind, file) => {
                          setSaved(false);
                          setUploadingImage(kind);
                          uploadMutation.mutate({ kind, file });
                        }}
                        onRemove={() => patch("favicon_url", "")}
                      />
                      <ImageUploadField
                        label="Imagem de compartilhamento"
                        description="Imagem usada ao compartilhar o link da loja."
                        value={form.og_image_url}
                        kind="og"
                        uploading={uploadMutation.isPending && uploadingImage === "og"}
                        ratio="banner"
                        onUpload={(kind, file) => {
                          setSaved(false);
                          setUploadingImage(kind);
                          uploadMutation.mutate({ kind, file });
                        }}
                        onRemove={() => patch("og_image_url", "")}
                      />
                    </div>
                  </SettingsCard>

                  <SettingsCard title="Sobre a loja">
                    <textarea
                      value={form.description}
                      onChange={(event) => patch("description", event.target.value)}
                      placeholder="Informações extras"
                      className="min-h-28 w-full resize-none rounded-md border border-border bg-surface px-3 py-3 text-[14px] outline-none focus:border-foreground/40"
                    />
                    <p className="text-[11px] leading-relaxed text-muted-foreground">
                      Neste campo você pode adicionar o endereço do seu negócio, horário de
                      funcionamento e o que mais você precisar.
                    </p>
                  </SettingsCard>

                  <SettingsCard title="Moeda">
                    <div className="rounded-md border border-border bg-muted px-3 py-2.5 text-[14px] text-foreground">
                      R$ - Real brasileiro
                    </div>
                  </SettingsCard>
                </div>

              </div>

              {saveMutation.error && (
                <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-[13px] text-red-700">
                  {saveMutation.error instanceof Error
                    ? saveMutation.error.message
                    : "Não foi possível salvar as configurações."}
                </div>
              )}

              <div className="sticky bottom-4 flex justify-end">
                <button
                  type="button"
                  disabled={saveMutation.isPending}
                  onClick={() => saveMutation.mutate()}
                  className="inline-flex items-center gap-2 rounded-md bg-primary px-5 py-3 text-[13px] font-semibold text-primary-foreground shadow-lg transition-colors hover:bg-graphite disabled:opacity-60"
                >
                  {saveMutation.isPending ? (
                    <Loader2 className="h-4 w-4 animate-spin" strokeWidth={1.5} />
                  ) : saved ? (
                    <Check className="h-4 w-4" strokeWidth={1.6} />
                  ) : null}
                  {saved ? "Salvo" : "Salvar configurações"}
                </button>
              </div>
            </div>
          )
        ) : activeTab === "Personalizar loja" ? (
          <div className="grid min-h-[440px] place-items-center rounded-lg border border-border bg-surface px-6 py-12 text-center">
            <div className="max-w-md">
              <div className="mx-auto grid h-16 w-16 place-items-center rounded-md bg-muted text-primary">
                <LayoutTemplate className="h-8 w-8" strokeWidth={1.4} />
              </div>
              <h2 className="mt-5 text-[18px] font-semibold text-foreground">Deixe a loja com a cara da sua marca</h2>
              <p className="mt-2 text-[13px] leading-relaxed text-muted-foreground">
                Escolha um tema pronto, troque cores e letras, coloque seu logo e os banners da página inicial. Você vê cada mudança na hora, no celular e no computador, e só vai para a loja quando publicar.
              </p>
              <a
                href="/admin/editor-layout"
                className="mt-6 inline-flex items-center gap-2 rounded-md bg-primary px-5 py-3 text-[13px] font-semibold text-primary-foreground transition-colors hover:bg-graphite"
              >
                <LayoutTemplate className="h-4 w-4" strokeWidth={1.6} />
                Personalizar loja
              </a>
            </div>
          </div>
        ) : activeTab === "Recibo" ? (
          receiptLoading || isLoading ? (
            <div className="grid min-h-[420px] place-items-center rounded-lg border border-border bg-surface">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" strokeWidth={1.5} />
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-6 lg:grid-cols-[420px_minmax(0,1fr)]">
              <div className="space-y-5">
                <SettingsCard title="Dados da Loja">
                  <p className="text-[13px] leading-relaxed text-foreground">
                    Complete as informações da sua loja e deixe seu catálogo profissional!
                  </p>
                  <div className="grid grid-cols-2 gap-3 pt-2 text-[11px] font-semibold uppercase text-foreground">
                    <CheckItem ok={!!form.name} label="Nome da loja" />
                    <CheckItem ok={!!form.logo_url} label="Logo" />
                    <CheckItem ok={!!form.phone} label="Telefone" />
                    <CheckItem ok={!!form.whatsapp} label="WhatsApp" />
                    <CheckItem ok={!!form.address} label="Endereço" />
                  </div>
                  <button
                    type="button"
                    onClick={() => setActiveTab("Loja")}
                    className="mt-4 w-full rounded-md bg-primary px-4 py-3 text-[13px] font-semibold text-primary-foreground hover:bg-graphite"
                  >
                    Completar dados da loja
                  </button>
                </SettingsCard>

                <SettingsCard title="Exibição">
                  <ToggleRow
                    title="Adicionar dados do cliente"
                    description="Nome, endereço e telefone"
                    checked={receiptForm.include_customer}
                    onChange={() => patchReceipt("include_customer", !receiptForm.include_customer)}
                  />
                  <ToggleRow
                    title="Exibir código do produto"
                    description="Abaixo do nome do item"
                    checked={receiptForm.show_product_code}
                    onChange={() =>
                      patchReceipt("show_product_code", !receiptForm.show_product_code)
                    }
                  />
                </SettingsCard>

                <SettingsCard title="Cabeçalho e rodapé">
                  <TextInput
                    value={receiptForm.header_text}
                    onChange={(value) => patchReceipt("header_text", value)}
                    placeholder="Texto do cabeçalho"
                    help
                  />
                  <TextInput
                    value={receiptForm.footer_text}
                    onChange={(value) => patchReceipt("footer_text", value)}
                    placeholder="Texto do rodapé"
                    help
                  />
                </SettingsCard>

                {receiptMutation.error && (
                  <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-[13px] text-red-700">
                    {receiptMutation.error instanceof Error
                      ? receiptMutation.error.message
                      : "Não foi possível salvar as configurações do recibo."}
                  </div>
                )}

                <button
                  type="button"
                  disabled={receiptMutation.isPending}
                  onClick={() => receiptMutation.mutate()}
                  className="inline-flex w-full items-center justify-center gap-2 rounded-md bg-primary px-5 py-3 text-[13px] font-semibold text-primary-foreground transition-colors hover:bg-graphite disabled:opacity-60"
                >
                  {receiptMutation.isPending ? (
                    <Loader2 className="h-4 w-4 animate-spin" strokeWidth={1.5} />
                  ) : saved ? (
                    <Check className="h-4 w-4" strokeWidth={1.6} />
                  ) : null}
                  {saved ? "Salvo" : "Salvar recibo"}
                </button>
              </div>

              <div className="rounded-lg bg-muted/80 px-6 py-8">
                <div className="mb-5 flex items-center justify-center gap-2 text-[13px] font-semibold text-foreground">
                  <Eye className="h-4 w-4" strokeWidth={1.5} />
                  Prévia do seu recibo
                </div>
                <ReceiptPreview store={form} settings={receiptForm} />
              </div>
            </div>
          )
        ) : (
          <div className="rounded-lg border border-dashed border-border bg-surface/50 px-6 py-16 text-center">
            <h2 className="text-[16px] font-semibold text-foreground">{activeTab}</h2>
            <p className="mt-2 text-[13px] text-muted-foreground">
              Essa seção será configurada na próxima etapa.
            </p>
          </div>
        )}
      </div>
    </PageShell>
  );
}

function SettingsCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-lg border border-border bg-surface p-6 shadow-sm">
      <h3 className="mb-4 text-[16px] font-semibold text-foreground">{title}</h3>
      <div className="space-y-3">{children}</div>
    </section>
  );
}

// Publicar o catálogo daqui (antes só existia no último passo de /admin/onboarding).
// Mesma regra e mesma gravação do onboarding: computeChecklist/canPublish/publishStore, que leem
// a loja do banco; por isso pede para salvar antes se houver alteração na tela.
function PublicationCard({
  storeId,
  hasUnsavedChanges,
}: {
  storeId: string;
  hasUnsavedChanges: boolean;
}) {
  const { refresh } = useStoreContext();
  const queryClient = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: ["store-publication", storeId],
    queryFn: async () => {
      const store = await getStoreFull(storeId);
      if (!store) return null;
      return { store, checklist: await computeChecklist(store) };
    },
    enabled: !!storeId,
  });
  const publishMutation = useMutation({
    mutationFn: () => publishStore(storeId),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["store-publication", storeId] }),
        refresh(),
      ]);
    },
  });

  if (isLoading || !data) return null;
  const { store, checklist } = data;
  const published = store.publication_status === "published";
  const publicPath = `/loja/${store.slug}`;
  const required = [
    ["Nome da loja", checklist.hasName],
    ["Link do catálogo", checklist.hasSlug],
    ["WhatsApp ou venda pelo site", checklist.hasWhatsAppOrSite],
    ["Pelo menos um produto ativo", checklist.hasActiveProduct],
  ] as const;
  const ready = canPublish(checklist);

  return (
    <section
      className={cn(
        "rounded-lg border p-6 shadow-sm",
        published ? "border-border bg-surface" : "border-foreground/30 bg-surface",
      )}
    >
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span
              className={cn(
                "h-2 w-2 shrink-0 rounded-full",
                published ? "bg-emerald-500" : "bg-amber-500",
              )}
            />
            <h3 className="text-[16px] font-semibold text-foreground">
              {published ? "Seu catálogo está no ar" : "Seu catálogo ainda não está no ar"}
            </h3>
          </div>
          <p className="mt-1 text-[12px] leading-relaxed text-muted-foreground">
            {published
              ? "Clientes já podem ver a loja e comprar pelo link abaixo."
              : "Enquanto não publicar, quem abrir o link vê que o catálogo ainda não está publicado."}
          </p>
          {published && (
            <a
              href={publicPath}
              target="_blank"
              rel="noreferrer"
              className="mt-2 inline-flex items-center gap-1 text-[12px] font-medium text-foreground hover:underline"
            >
              {publicPath}
              <ExternalLink className="h-3 w-3" strokeWidth={1.5} />
            </a>
          )}
        </div>
        {!published && (
          <button
            type="button"
            disabled={!ready || hasUnsavedChanges || publishMutation.isPending}
            onClick={() => publishMutation.mutate()}
            className="inline-flex shrink-0 items-center justify-center gap-2 rounded-md bg-primary px-5 py-3 text-[13px] font-semibold text-primary-foreground transition-colors hover:bg-graphite disabled:opacity-50"
          >
            {publishMutation.isPending && (
              <Loader2 className="h-4 w-4 animate-spin" strokeWidth={1.5} />
            )}
            Publicar catálogo
          </button>
        )}
      </div>

      {!published && (
        <div className="mt-4 border-t border-border pt-4">
          {ready ? (
            <p className="text-[12px] text-muted-foreground">
              {hasUnsavedChanges
                ? "Salve as alterações desta página antes de publicar."
                : "Tudo pronto para publicar."}
            </p>
          ) : (
            <>
              <p className="mb-2 text-[12px] text-muted-foreground">Para publicar, falta:</p>
              <ul className="grid gap-1.5 text-[13px] sm:grid-cols-2">
                {required.map(([label, ok]) => (
                  <li key={label} className="flex items-center gap-2">
                    {ok ? (
                      <CheckCircle2 className="h-4 w-4 text-foreground" strokeWidth={1.5} />
                    ) : (
                      <Circle className="h-4 w-4 text-muted-foreground" strokeWidth={1.5} />
                    )}
                    <span className={ok ? "text-foreground" : "text-muted-foreground"}>
                      {label}
                    </span>
                  </li>
                ))}
              </ul>
            </>
          )}
          {publishMutation.error && (
            <p className="mt-3 text-[12px] text-red-700">
              {publishMutation.error instanceof Error
                ? publishMutation.error.message
                : "Não foi possível publicar."}
            </p>
          )}
        </div>
      )}
    </section>
  );
}

function ImageUploadField({
  label,
  description,
  value,
  kind,
  uploading,
  ratio,
  onUpload,
  onRemove,
}: {
  label: string;
  description: string;
  value: string;
  kind: StoreBrandingKind;
  uploading: boolean;
  ratio: "square" | "icon" | "banner";
  onUpload: (kind: StoreBrandingKind, file: File) => void;
  onRemove: () => void;
}) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  return (
    <div className="rounded-lg border border-border bg-muted/30 p-4">
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (file) onUpload(kind, file);
          event.currentTarget.value = "";
        }}
      />
      <div className="grid gap-4 md:grid-cols-[180px_minmax(0,1fr)]">
        <div
          className={cn(
            "grid overflow-hidden rounded-md border border-dashed border-border bg-surface",
            ratio === "banner" ? "aspect-[16/7]" : "aspect-square",
          )}
        >
          {value ? (
            <img src={value} alt="" className={cn("h-full w-full", ratio === "icon" ? "object-contain p-8" : "object-cover")} />
          ) : (
            <div className="grid place-items-center text-muted-foreground">
              <ImageIcon className="h-7 w-7" strokeWidth={1.4} />
            </div>
          )}
        </div>
        <div className="flex min-w-0 flex-col justify-center">
          <div className="text-[14px] font-semibold text-foreground">{label}</div>
          <p className="mt-1 text-[12px] leading-relaxed text-muted-foreground">{description}</p>
          <div className="mt-4 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              disabled={uploading}
              className="inline-flex items-center gap-2 rounded-md bg-primary px-3 py-2 text-[12px] font-semibold text-primary-foreground transition-colors hover:bg-graphite disabled:opacity-60"
            >
              {uploading ? (
                <Loader2 className="h-4 w-4 animate-spin" strokeWidth={1.5} />
              ) : (
                <UploadCloud className="h-4 w-4" strokeWidth={1.5} />
              )}
              {value ? "Trocar imagem" : "Enviar imagem"}
            </button>
            {value && (
              <button
                type="button"
                onClick={onRemove}
                className="inline-flex items-center gap-2 rounded-md border border-border bg-surface px-3 py-2 text-[12px] font-semibold text-foreground hover:border-foreground/40"
              >
                <X className="h-4 w-4" strokeWidth={1.5} />
                Remover
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function LabeledField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-[12px] font-medium text-foreground">{label}</span>
      {children}
    </label>
  );
}

function TextInput({
  value,
  onChange,
  placeholder,
  type = "text",
  help = false,
  trailing = null,
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  type?: "text" | "tel" | "email";
  help?: boolean;
  trailing?: React.ReactNode;
}) {
  return (
    <div className="flex items-center rounded-md border border-border bg-surface px-3 focus-within:border-foreground/40">
      <input
        type={type}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        className="min-w-0 flex-1 bg-transparent py-3 text-[14px] outline-none placeholder:text-muted-foreground"
      />
      {trailing}
      {help && <HelpCircle className="h-4 w-4 shrink-0 text-muted-foreground" strokeWidth={1.6} />}
    </div>
  );
}

function formatStoreAddress(store: GeneralSettingsForm) {
  const street = [store.address, store.address_number].filter((part) => part.trim()).join(", ");
  const city = [store.city, store.state].filter((part) => part.trim()).join("/");
  return [street, store.complement, city].filter((part) => part.trim()).join(" · ");
}

function digitsOnly(value: string) {
  return value.replace(/\D/g, "");
}

function formatCep(value: string) {
  const digits = digitsOnly(value).slice(0, 8);
  return digits.length > 5 ? `${digits.slice(0, 5)}-${digits.slice(5)}` : digits;
}

function CheckItem({ ok, label }: { ok: boolean; label: string }) {
  return (
    <div className="flex items-center gap-2">
      <Check className={cn("h-3.5 w-3.5", ok ? "text-primary" : "text-muted-foreground")} />
      <span>{label}</span>
    </div>
  );
}

function ToggleRow({
  title,
  description,
  checked,
  onChange,
}: {
  title: string;
  description: string;
  checked: boolean;
  onChange: () => void;
}) {
  return (
    <div className="flex items-start justify-between gap-4 py-1">
      <div>
        <div className="text-[14px] font-semibold text-foreground">{title}</div>
        <div className="mt-1 text-[13px] text-muted-foreground">{description}</div>
      </div>
      <button
        type="button"
        onClick={onChange}
        className={cn(
          "mt-0.5 flex h-5 w-9 shrink-0 items-center rounded-full p-0.5 transition-colors",
          checked ? "bg-primary" : "bg-border",
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

function ReceiptPreview({
  store,
  settings,
}: {
  store: GeneralSettingsForm;
  settings: ReceiptSettings;
}) {
  return (
    <div className="mx-auto max-w-[470px] bg-white px-6 py-9 text-slate-700 shadow-sm">
      <div className="text-center">
        {store.logo_url ? (
          <img src={store.logo_url} alt="" className="mx-auto h-12 max-w-36 object-contain" />
        ) : (
          <div className="font-semibold tracking-[0.28em] text-slate-900">VYNKA</div>
        )}
        <div className="mt-7 text-[22px] font-medium text-slate-500">RECIBO</div>
      </div>

      <div className="mt-6 text-[13px] leading-relaxed">
        <div className="font-medium text-slate-800">{store.name || "Nome da loja"}</div>
        <div>{store.address || "Endereço da loja"}</div>
        {store.whatsapp && <div>{formatPhone(store.whatsapp)}</div>}
      </div>

      {settings.include_customer && (
        <div className="mt-5 text-[13px]">
          <div className="font-medium text-slate-700">Nome do cliente</div>
          <div className="mt-1 text-slate-600">+55 11 99999-9999 - Endereço completo</div>
        </div>
      )}

      {settings.header_text && (
        <div className="mt-5 rounded-md border border-slate-300 px-4 py-3 text-[13px]">
          {settings.header_text}
        </div>
      )}

      <div className="mt-7 text-[17px] font-semibold text-slate-600">2 itens (Qtd.: 2)</div>
      <div className="mt-3 border-t-2 border-slate-500">
        {[
          ["Legging Teste", "Cinza", "$100.00"],
          ["Legging Teste", "Branco", "$100.00"],
        ].map(([name, variant, price], index) => (
          <div
            key={index}
            className="flex justify-between border-b border-slate-200 py-3 text-[13px]"
          >
            <div>
              <div className="font-medium text-slate-800">1x {name}</div>
              <div className="text-slate-500">{variant}</div>
              {settings.show_product_code && (
                <div className="mt-1 text-[11px] text-slate-400">Cod. PROD-000{index + 1}</div>
              )}
            </div>
            <div className="font-medium text-slate-900">{price}</div>
          </div>
        ))}
      </div>

      <div className="ml-auto mt-6 max-w-52 space-y-2 text-right text-[14px]">
        <div>Subtotal: $200.00</div>
        <div className="text-[18px] font-semibold text-slate-700">Total: $200.00</div>
      </div>

      {settings.footer_text && (
        <div className="mt-6 text-center text-[12px] text-slate-500">{settings.footer_text}</div>
      )}

      <div className="mt-7 border-t-2 border-slate-500 pt-5 text-center text-[12px] text-slate-500">
        21 de julho de 2026 às 15:07
      </div>
    </div>
  );
}
