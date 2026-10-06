import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Check,
  ArrowDown,
  ArrowUp,
  Eye,
  ExternalLink,
  HelpCircle,
  ImageIcon,
  Instagram,
  LayoutTemplate,
  Loader2,
  MapPin,
  Plus,
  PackageCheck,
  ShoppingCart,
  Store,
  Trash2,
  Truck,
  UploadCloud,
  X,
} from "lucide-react";
import { useEffect, useRef, useState, type CSSProperties } from "react";
import { PageShell } from "@/components/page-shell";
import {
  DeliverySettingsTab,
  OrderStockSettingsTab,
  PaymentSettingsTab,
} from "@/components/admin/checkout-settings";
import { isProvisionalSlug } from "@/lib/provisional-store";
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
  type CatalogStyle,
  type CatalogSection,
  type CatalogVisualSettings,
  type StoreBanner,
  type StoreBannerLinkType,
  type StoreBrandingKind,
} from "@/lib/store-settings";
import type { Category, ProductRecord } from "@/lib/products";
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
  "Visual do Catálogo",
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

const catalogStyleOptions: { value: CatalogStyle; title: string }[] = [
  { value: "minimal", title: "Linda Moda Fitness" },
];

function Configuracoes() {
  const { currentStore, refresh } = useStoreContext();
  const storeId = currentStore?.id ?? "";
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState("Loja");
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
          <PaymentSettingsTab />
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

              <div className="grid gap-5 xl:grid-cols-2">
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
                      placeholder="Linda Fitness"
                    />
                  </LabeledField>
                  <LabeledField label="Link publico do catalogo">
                    <div className="rounded-md border border-border bg-surface focus-within:border-foreground/40">
                      <div className="flex items-center px-3 py-2.5">
                        <input
                          value={form.slug}
                          onChange={(event) => patch("slug", event.target.value)}
                          placeholder="linda-fitness"
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
                  <LabeledField label="Nome do responsavel">
                    <TextInput
                      value={form.responsible_name}
                      onChange={(value) => patch("responsible_name", value)}
                      placeholder="Joao Pedro Carmo Silva"
                    />
                  </LabeledField>
                  <LabeledField label="CPF ou CNPJ">
                    <TextInput
                      value={form.tax_document}
                      onChange={(value) => patch("tax_document", value)}
                      placeholder="000.000.000-00"
                    />
                  </LabeledField>
                </SettingsCard>

                <SettingsCard title="Informações de contato">
                  <p className="-mt-1 mb-2 text-[12px] leading-relaxed text-muted-foreground">
                    Estes dados aparecem no rodapé da loja e nos botões de atendimento.
                  </p>
                  <LabeledField label="Telefone da loja">
                    <TextInput
                      value={formatPhone(form.phone)}
                      onChange={(value) => patchPhone("phone", value)}
                      placeholder="(11)99999-9999"
                      help
                    />
                  </LabeledField>
                  <LabeledField label="WhatsApp da loja">
                    <TextInput
                      value={formatPhone(form.whatsapp)}
                      onChange={(value) => patchPhone("whatsapp", value)}
                      placeholder="(11)99999-9999"
                      help
                    />
                  </LabeledField>
                  <LabeledField label="Instagram da loja">
                    <TextInput
                      value={form.instagram ? `@${form.instagram.replace(/^@/, "")}` : ""}
                      onChange={(value) => patch("instagram", value.replace(/^@/, ""))}
                      placeholder="@sualoja"
                    />
                  </LabeledField>
                  <LabeledField label="E-mail da loja">
                    <TextInput
                      value={form.email}
                      onChange={(value) => patch("email", value)}
                      placeholder="E-mail"
                    />
                  </LabeledField>
                  <LabeledField label="CEP">
                    <TextInput
                      value={formatCep(form.zip_code)}
                      onChange={patchCep}
                      placeholder="00000-000"
                      trailing={cepLoading ? <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" strokeWidth={1.5} /> : null}
                    />
                  </LabeledField>
                  <LabeledField label="Endereço da loja">
                    <TextInput
                      value={form.address}
                      onChange={(value) => patch("address", value)}
                      placeholder="Rua"
                    />
                  </LabeledField>
                  <div className="grid gap-3 sm:grid-cols-[140px_minmax(0,1fr)]">
                    <LabeledField label="Número">
                      <TextInput
                        value={form.address_number}
                        onChange={(value) => patch("address_number", value)}
                        placeholder="Número"
                      />
                    </LabeledField>
                    <LabeledField label="Complemento">
                      <TextInput
                        value={form.complement}
                        onChange={(value) => patch("complement", value)}
                        placeholder="Sala, bloco, referência"
                      />
                    </LabeledField>
                  </div>
                  <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_88px]">
                    <LabeledField label="Cidade">
                      <TextInput
                        value={form.city}
                        onChange={(value) => patch("city", value)}
                        placeholder="Cidade"
                      />
                    </LabeledField>
                    <LabeledField label="UF">
                      <TextInput
                        value={form.state}
                        onChange={(value) => patch("state", value.toUpperCase())}
                        placeholder="UF"
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
        ) : activeTab === "Visual do Catálogo" ? (
          <div className="grid min-h-[440px] place-items-center rounded-lg border border-border bg-surface px-6 py-12 text-center">
            <div className="max-w-md">
              <div className="mx-auto grid h-16 w-16 place-items-center rounded-md bg-muted text-primary">
                <LayoutTemplate className="h-8 w-8" strokeWidth={1.4} />
              </div>
              <h2 className="mt-5 text-[18px] font-semibold text-foreground">Editor de layout</h2>
              <p className="mt-2 text-[13px] leading-relaxed text-muted-foreground">
                As configurações de cores, fontes, banners, cabeçalho e exibição dos produtos ficam concentradas no editor de layout.
              </p>
              <a
                href="/admin/editor-layout"
                className="mt-6 inline-flex items-center gap-2 rounded-md bg-primary px-5 py-3 text-[13px] font-semibold text-primary-foreground transition-colors hover:bg-graphite"
              >
                <LayoutTemplate className="h-4 w-4" strokeWidth={1.6} />
                Editar layout
              </a>
            </div>
          </div>
        ) : activeTab === "Recibo" ? (
          receiptLoading || isLoading ? (
            <div className="grid min-h-[420px] place-items-center rounded-lg border border-border bg-surface">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" strokeWidth={1.5} />
            </div>
          ) : (
            <div className="grid gap-6 lg:grid-cols-[420px_minmax(0,1fr)]">
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
  help = false,
  trailing = null,
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  help?: boolean;
  trailing?: React.ReactNode;
}) {
  return (
    <div className="flex items-center rounded-md border border-border bg-surface px-3 focus-within:border-foreground/40">
      <input
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

function formatPhone(value: string) {
  const digits = digitsOnly(value).slice(0, 11);
  if (digits.length <= 2) return digits ? `(${digits}` : "";
  if (digits.length <= 7) return `(${digits.slice(0, 2)})${digits.slice(2)}`;
  return `(${digits.slice(0, 2)})${digits.slice(2, 7)}-${digits.slice(7)}`;
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

function BannerManager({
  banners,
  products,
  categories,
  uploadingBannerId,
  isUploading,
  onAdd,
  onRemove,
  onMove,
  onPatch,
  onUpload,
}: {
  banners: StoreBanner[];
  products: ProductRecord[];
  categories: Category[];
  uploadingBannerId: string | null;
  isUploading: boolean;
  onAdd: () => void;
  onRemove: (bannerId: string) => void;
  onMove: (index: number, dir: -1 | 1) => void;
  onPatch: <K extends keyof StoreBanner>(bannerId: string, key: K, value: StoreBanner[K]) => void;
  onUpload: (bannerId: string, file: File) => void;
}) {
  return (
    <SettingsCard title="Banners do Catálogo">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="max-w-2xl text-[13px] leading-relaxed text-muted-foreground">
          Cadastre imagens de destaque e direcione cada banner para um produto,
          categoria ou link externo.
        </p>
        <button
          type="button"
          onClick={onAdd}
          className="inline-flex items-center gap-2 rounded-md bg-primary px-3 py-2 text-[12px] font-semibold text-primary-foreground transition-colors hover:bg-graphite"
        >
          <Plus className="h-4 w-4" strokeWidth={1.7} />
          Adicionar banner
        </button>
      </div>

      {banners.length === 0 ? (
        <button
          type="button"
          onClick={onAdd}
          className="grid min-h-36 place-items-center rounded-md border border-dashed border-border bg-muted/30 px-4 text-center text-[13px] font-medium text-muted-foreground hover:border-foreground/40 hover:text-foreground"
        >
          Criar primeiro banner
        </button>
      ) : (
        <div className="space-y-4">
          {banners.map((banner, index) => (
            <div key={banner.id} className="rounded-lg border border-border bg-muted/25 p-4">
              <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                <div>
                  <div className="text-[13px] font-semibold text-foreground">
                    Banner {index + 1}
                  </div>
                  <div className="text-[11px] text-muted-foreground">
                    {banner.active ? "Ativo no catálogo" : "Oculto no catálogo"}
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => onMove(index, -1)}
                    disabled={index === 0}
                    className="grid h-8 w-8 place-items-center rounded-md border border-border bg-surface text-foreground disabled:opacity-40"
                    title="Subir banner"
                  >
                    <ArrowUp className="h-4 w-4" strokeWidth={1.6} />
                  </button>
                  <button
                    type="button"
                    onClick={() => onMove(index, 1)}
                    disabled={index === banners.length - 1}
                    className="grid h-8 w-8 place-items-center rounded-md border border-border bg-surface text-foreground disabled:opacity-40"
                    title="Descer banner"
                  >
                    <ArrowDown className="h-4 w-4" strokeWidth={1.6} />
                  </button>
                  <button
                    type="button"
                    onClick={() => onPatch(banner.id, "active", !banner.active)}
                    className={cn(
                      "rounded-md px-3 py-2 text-[11px] font-semibold",
                      banner.active
                        ? "bg-primary text-primary-foreground"
                        : "border border-border bg-surface text-muted-foreground",
                    )}
                  >
                    {banner.active ? "Ativo" : "Inativo"}
                  </button>
                  <button
                    type="button"
                    onClick={() => onRemove(banner.id)}
                    className="grid h-8 w-8 place-items-center rounded-md border border-border bg-surface text-foreground hover:border-red-200 hover:text-red-600"
                    title="Remover banner"
                  >
                    <Trash2 className="h-4 w-4" strokeWidth={1.6} />
                  </button>
                </div>
              </div>

              <div className="grid gap-4 lg:grid-cols-[280px_minmax(0,1fr)]">
                <ImageUploadField
                  label="Imagem"
                  description="Use uma imagem horizontal para melhor resultado."
                  value={banner.image_url}
                  kind="banner"
                  uploading={isUploading && uploadingBannerId === banner.id}
                  ratio="banner"
                  onUpload={(_, file) => onUpload(banner.id, file)}
                  onRemove={() => onPatch(banner.id, "image_url", "")}
                />

                <div className="space-y-3">
                  <div className="grid gap-3 md:grid-cols-2">
                    <LabeledField label="Título">
                      <TextInput
                        value={banner.title}
                        onChange={(value) => onPatch(banner.id, "title", value)}
                        placeholder="Promoção de verão"
                      />
                    </LabeledField>
                    <LabeledField label="Texto do botão">
                      <TextInput
                        value={banner.button_label}
                        onChange={(value) => onPatch(banner.id, "button_label", value)}
                        placeholder="Ver oferta"
                      />
                    </LabeledField>
                  </div>

                  <LabeledField label="Subtítulo">
                    <textarea
                      value={banner.subtitle}
                      onChange={(event) => onPatch(banner.id, "subtitle", event.target.value)}
                      placeholder="Escolha uma frase curta para apoiar a campanha."
                      className="min-h-20 w-full resize-none rounded-md border border-border bg-surface px-3 py-3 text-[14px] outline-none focus:border-foreground/40"
                    />
                  </LabeledField>

                  <div className="grid gap-3 md:grid-cols-[180px_minmax(0,1fr)]">
                    <LabeledField label="Direcionamento">
                      <select
                        value={banner.link_type}
                        onChange={(event) => {
                          onPatch(banner.id, "link_type", event.target.value as StoreBannerLinkType);
                          onPatch(banner.id, "link_target", "");
                        }}
                        className="h-11 w-full rounded-md border border-border bg-surface px-3 text-[14px] outline-none focus:border-foreground/40"
                      >
                        <option value="store_home">Página inicial da loja</option>
                        <option value="home">Lista de produtos</option>
                        <option value="product">Produto específico</option>
                        <option value="category">Categoria</option>
                        <option value="external">Link externo</option>
                      </select>
                    </LabeledField>
                    <BannerTargetField
                      banner={banner}
                      products={products}
                      categories={categories}
                      onPatch={onPatch}
                    />
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </SettingsCard>
  );
}

function BannerTargetField({
  banner,
  products,
  categories,
  onPatch,
}: {
  banner: StoreBanner;
  products: ProductRecord[];
  categories: Category[];
  onPatch: <K extends keyof StoreBanner>(bannerId: string, key: K, value: StoreBanner[K]) => void;
}) {
  if (banner.link_type === "store_home") {
    return (
      <LabeledField label="Destino">
        <div className="rounded-md border border-border bg-muted px-3 py-3 text-[13px] text-muted-foreground">
          Leva para o início da loja.
        </div>
      </LabeledField>
    );
  }

  if (banner.link_type === "home") {
    return (
      <LabeledField label="Destino">
        <div className="rounded-md border border-border bg-muted px-3 py-3 text-[13px] text-muted-foreground">
          Leva para a lista de produtos do catálogo.
        </div>
      </LabeledField>
    );
  }

  if (banner.link_type === "product") {
    return (
      <LabeledField label="Produto">
        <select
          value={banner.link_target}
          onChange={(event) => onPatch(banner.id, "link_target", event.target.value)}
          className="h-11 w-full rounded-md border border-border bg-surface px-3 text-[14px] outline-none focus:border-foreground/40"
        >
          <option value="">Selecione um produto</option>
          {products.map((product) => (
            <option key={product.id} value={product.id}>
              {product.name}
            </option>
          ))}
        </select>
      </LabeledField>
    );
  }

  if (banner.link_type === "category") {
    return (
      <LabeledField label="Categoria">
        <select
          value={banner.link_target}
          onChange={(event) => onPatch(banner.id, "link_target", event.target.value)}
          className="h-11 w-full rounded-md border border-border bg-surface px-3 text-[14px] outline-none focus:border-foreground/40"
        >
          <option value="">Selecione uma categoria</option>
          {categories.map((category) => (
            <option key={category.id} value={category.slug}>
              {category.name}
            </option>
          ))}
        </select>
      </LabeledField>
    );
  }

  return (
    <LabeledField label="Link externo">
      <TextInput
        value={banner.link_target}
        onChange={(value) => onPatch(banner.id, "link_target", value)}
        placeholder="https://exemplo.com/promocao"
      />
    </LabeledField>
  );
}

function StyleMiniPreview({ style }: { style: CatalogStyle }) {
  const commercial = style === "commercial";
  const elegant = style === "elegant";
  const editorial = style === "editorial";
  return (
    <div
      className={cn(
        "overflow-hidden rounded-md border border-border bg-white",
        elegant && "bg-[#faf7f2]",
        commercial && "bg-[#fff7ed]",
        editorial && "bg-[#f7f5f0]",
      )}
    >
      <div
        className={cn(
          "h-12 bg-neutral-100",
          elegant && "bg-stone-200",
          commercial && "bg-orange-200",
          editorial && "bg-zinc-200",
        )}
      />
      <div className="space-y-2 p-3">
        <div
          className={cn(
            "h-2 w-2/3 rounded bg-neutral-900",
            commercial && "h-3 w-3/4 bg-orange-600",
            editorial && "w-1/2",
          )}
        />
        <div className="grid grid-cols-3 gap-2">
          {[0, 1, 2].map((item) => (
            <div
              key={item}
              className={cn("space-y-1", commercial && "rounded border border-orange-200 bg-white p-1")}
            >
              <div
                className={cn(
                  "aspect-[3/4] bg-neutral-100",
                  elegant && "rounded",
                  commercial && "aspect-square bg-orange-100",
                  editorial && "aspect-[4/5]",
                )}
              />
              <div className="h-1.5 w-4/5 rounded bg-neutral-200" />
              {commercial && <div className="h-1.5 w-1/2 rounded bg-orange-500" />}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function ColorInput({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <label className="flex items-center gap-3 rounded-md border border-border bg-surface px-3 py-2.5">
      <input
        type="color"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="h-9 w-10 shrink-0 cursor-pointer rounded border-0 bg-transparent p-0"
      />
      <span className="min-w-0 flex-1">
        <span className="block text-[12px] font-semibold text-foreground">{label}</span>
        <span className="block text-[12px] uppercase text-muted-foreground">{value}</span>
      </span>
    </label>
  );
}

function SegmentedControl({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: [string, string][];
  onChange: (value: string) => void;
}) {
  return (
    <div>
      <div className="mb-2 text-[12px] font-semibold text-foreground">{label}</div>
      <div className="grid grid-cols-2 overflow-hidden rounded-md border border-border bg-muted p-1">
        {options.map(([optionValue, optionLabel]) => (
          <button
            key={optionValue}
            type="button"
            onClick={() => onChange(optionValue)}
            className={cn(
              "rounded px-3 py-2 text-[12px] font-semibold transition-colors",
              value === optionValue ? "bg-surface text-foreground shadow-sm" : "text-muted-foreground",
            )}
          >
            {optionLabel}
          </button>
        ))}
      </div>
    </div>
  );
}

const sectionLabels: Record<CatalogSection, string> = {
  banner: "Banner",
  description: "Descrição",
  categories: "Categorias",
  featured: "Destaques",
  products: "Produtos",
  promos: "Promoções",
};

function SectionOrderEditor({
  order,
  onChange,
}: {
  order: CatalogSection[];
  onChange: (order: CatalogSection[]) => void;
}) {
  const move = (index: number, dir: -1 | 1) => {
    const nextIndex = index + dir;
    if (nextIndex < 0 || nextIndex >= order.length) return;
    const next = order.slice();
    [next[index], next[nextIndex]] = [next[nextIndex], next[index]];
    onChange(next);
  };

  return (
    <div className="pt-2">
      <div className="mb-2 text-[12px] font-semibold text-foreground">Ordem das seções</div>
      <div className="space-y-2">
        {order.map((section, index) => (
          <div
            key={section}
            className="flex items-center justify-between gap-3 rounded-md border border-border bg-muted/40 px-3 py-2"
          >
            <span className="text-[13px] font-medium text-foreground">{sectionLabels[section]}</span>
            <div className="flex gap-1">
              <button
                type="button"
                onClick={() => move(index, -1)}
                disabled={index === 0}
                className="rounded border border-border bg-surface px-2 py-1 text-[11px] disabled:opacity-40"
              >
                Subir
              </button>
              <button
                type="button"
                onClick={() => move(index, 1)}
                disabled={index === order.length - 1}
                className="rounded border border-border bg-surface px-2 py-1 text-[11px] disabled:opacity-40"
              >
                Descer
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function CatalogVisualPreview({
  store,
  settings,
  banners,
}: {
  store: GeneralSettingsForm;
  settings: CatalogVisualSettings;
  banners: StoreBanner[];
}) {
  const mockProducts = [
    ["Vestido Linho", "R$ 189,90"],
    ["Bolsa Mini", "R$ 129,90"],
    ["Camisa Off", "R$ 99,90"],
    ["Sandalia", "R$ 159,90"],
  ];
  const commercial = false;
  const elegant = true;
  const editorial = false;
  const minimal = false;
  const styleName =
    catalogStyleOptions.find((style) => style.value === settings.catalog_style)?.title ??
    "Minimalista";
  const previewBackground = elegant ? "#f7f4ef" : settings.background_color;
  const previewPrimary = elegant ? "#5b1022" : settings.primary_color;
  const previewSecondary = elegant ? "#c59a36" : settings.secondary_color;
  const previewButton = elegant ? "#5b1022" : settings.button_color;
  const previewBanner = banners.find((banner) => banner.active) ?? banners[0] ?? null;
  return (
    <section className="overflow-hidden rounded-lg border border-border bg-surface shadow-sm">
      <div className="flex items-center justify-between border-b border-border px-4 py-3">
        <div>
          <div className="text-[13px] font-semibold text-foreground">Prévia</div>
          <div className="text-[11px] text-muted-foreground">Simulação do catálogo público</div>
        </div>
        <div className="rounded-full bg-muted px-3 py-1 text-[11px] font-semibold capitalize text-foreground">
          {styleName}
        </div>
      </div>
      <div
        className="p-4"
        style={
          {
            backgroundColor: previewBackground,
            "--preview-primary": previewPrimary,
            "--preview-secondary": previewSecondary,
            "--preview-button": previewButton,
          } as CSSProperties
        }
      >
        <div
          className={cn(
            "overflow-hidden border border-black/10 bg-white",
            elegant && "rounded-xl border-[#5b1022]/20 bg-[#f7f4ef]",
            commercial && "rounded-md bg-[#f6f7fb]",
            editorial && "rounded-none bg-white",
            minimal && "rounded-md",
          )}
        >
          {commercial && (
            <div className="bg-[var(--preview-button)] px-4 py-1.5 text-center text-[9px] font-black uppercase tracking-[0.16em] text-white">
              Catalogo atualizado • Peça pelo WhatsApp
            </div>
          )}
          {elegant && (
            <div className="bg-[#c59a36] px-4 py-1.5 text-center text-[9px] font-black uppercase tracking-[0.18em] text-[#2b0b12]">
              Conforto • Estilo • Confiança
            </div>
          )}
          <div
            className={cn(
              "flex items-center justify-between border-b border-black/10 px-4 py-3",
              elegant && "justify-center gap-4 border-[#c59a36]/30 bg-[#5b1022] py-4",
              editorial && "border-b-0 py-4",
            )}
          >
            <div className="flex items-center gap-2">
              {store.logo_url ? (
                <img src={store.logo_url} alt="" className="h-7 w-7 rounded object-contain" />
              ) : (
                <div className="h-7 w-7 rounded bg-neutral-100" />
              )}
              <span
                className={cn(
                  "text-[12px] font-semibold text-[var(--preview-primary)]",
                  elegant && "font-serif text-[22px] font-semibold tracking-[0.08em] text-[#f7f4ef]",
                  commercial && "font-black uppercase",
                  editorial && "font-serif text-[20px] font-light",
                )}
              >
                {store.name || "Minha loja"}
              </span>
            </div>
            {!elegant && <div className={cn("h-2 w-14 rounded bg-neutral-100", commercial && "h-6 w-20 bg-[#25d366]", editorial && "h-px w-20 bg-black")} />}
          </div>

          {settings.show_banner && (
            <div
              className={cn(
                "relative bg-neutral-100",
                commercial ? "m-3 h-28 rounded-md" : editorial ? "grid h-48 grid-cols-[0.9fr_1.1fr] bg-white" : elegant ? "grid h-52 grid-cols-[0.9fr_1.1fr] bg-[#5b1022]" : "h-36",
              )}
            >
              {previewBanner?.image_url ? (
                <img
                  src={previewBanner.image_url}
                  alt=""
                  className={cn(
                    "h-full w-full object-cover",
                    elegant && "col-start-2",
                    editorial && "col-start-2",
                  )}
                />
              ) : (
                <div className={cn("h-full w-full bg-gradient-to-br from-neutral-100 to-neutral-300", elegant && "col-start-2 from-[#eadfce] to-[#f7f4ef]", editorial && "col-start-2")} />
              )}
              <div className={cn("absolute inset-0 bg-black/25", elegant && "left-auto right-0 w-[55%] bg-black/10", editorial && "left-auto right-0 w-[55%]")} />
              {elegant && <div className="absolute left-4 top-4 h-[calc(100%-32px)] w-[42%] border-y border-[#c59a36]/35" />}
              {editorial && <div className="absolute left-4 top-4 h-[calc(100%-32px)] w-[42%] border-y border-black" />}
              <div className={cn("absolute bottom-4 left-4 right-4", elegant && "right-auto max-w-[42%] text-left", editorial && "bottom-6 left-6 right-auto max-w-[42%]")}>
                <div
                  className={cn(
                    "leading-none text-white",
                    commercial ? "text-[24px] font-black uppercase" : elegant ? "font-serif text-[34px] font-semibold text-[#f7f4ef]" : minimal ? "text-[24px] font-semibold" : "font-serif text-[30px] text-neutral-950",
                  )}
                >
                  {previewBanner?.title || store.name || "Nova coleção"}
                </div>
                <button
                  type="button"
                  className={cn(
                    "mt-3 px-4 py-2 text-[9px] font-semibold uppercase tracking-[0.18em]",
                    elegant && "rounded-md bg-[#c59a36] font-bold text-[#2b0b12]",
                    commercial && "rounded-md font-black",
                    editorial && "bg-transparent px-0 text-neutral-950 underline underline-offset-4",
                    !editorial && "text-white",
                  )}
                  style={!elegant && !editorial ? { backgroundColor: settings.button_color } : undefined}
                >
                  {previewBanner?.button_label || "Ver produtos"}
                </button>
              </div>
            </div>
          )}

          <div className={cn("p-4", commercial ? "space-y-3" : elegant ? "space-y-7 p-6" : editorial ? "space-y-8 p-6" : "space-y-5")}>
            {settings.show_description && (
              <div
                className={cn(
                  "text-[11px] leading-relaxed text-neutral-600",
                  minimal && "rounded border border-black/5 bg-neutral-50 p-3",
                  elegant && "mx-auto max-w-[75%] text-center text-[12px]",
                  commercial && "rounded-md border border-black/10 bg-white p-3 font-semibold shadow-sm",
                  editorial && "border-y border-black py-4 font-serif text-[18px] leading-tight text-neutral-900",
                )}
              >
                {stripHtml(store.description) || "Descrição curta da loja para apresentar a marca."}
              </div>
            )}

            {settings.show_categories && (
              <div>
                <div className={cn("mb-2 text-[10px] font-semibold uppercase tracking-[0.2em] text-[var(--preview-secondary)]", editorial && "font-serif text-[18px] normal-case tracking-[0] text-neutral-950")}>
                  Categorias
                </div>
                <div
                  className={cn(
                    commercial ? "flex gap-2 overflow-hidden" : elegant ? "flex justify-center gap-5 border-y border-black/10 py-3" : editorial ? "grid grid-cols-2 gap-2" : "flex gap-2 overflow-hidden",
                  )}
                >
                  {["Novidades", "Mais vendidos", "Promoções"].map((item) => (
                    <div
                      key={item}
                      className={cn(
                        "text-center text-[10px]",
                        minimal && "rounded-full border border-black/10 px-3 py-2",
                        elegant && "border-b border-black/20 px-1 pb-1 font-serif text-[13px]",
                        commercial && "rounded-md border border-black/10 bg-white px-3 py-2 font-black uppercase shadow-sm",
                        editorial && "border border-black px-3 py-4 font-serif text-[16px]",
                      )}
                    >
                      {item}
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div>
              <div className="mb-2 text-[10px] font-semibold uppercase tracking-[0.2em] text-[var(--preview-secondary)]">
                Produtos
              </div>
              <div
                className={cn(
                  settings.product_layout === "list"
                    ? "grid gap-2"
                    : commercial || settings.product_card_style === "compact"
                    ? "grid grid-cols-3 gap-2"
                    : elegant
                    ? "grid grid-cols-2 gap-4"
                    : editorial
                    ? "grid grid-cols-2 gap-3"
                    : "grid grid-cols-2 gap-3",
                )}
              >
                {mockProducts.map(([name, price], index) => (
                  <div
                    key={name}
                    className={cn(
                      "bg-white",
                      settings.product_layout === "list" ? "flex gap-3 p-2" : "p-2",
                      minimal && "rounded border border-black/10",
                      elegant && "rounded-lg border border-black/5 bg-transparent p-0",
                      commercial && "rounded-md border border-black/10 p-1 shadow-sm",
                      editorial && "border-0 p-0",
                      editorial && index === 0 && settings.product_layout !== "list" && "col-span-2",
                    )}
                  >
                    <div
                      className={cn(
                        "bg-neutral-100",
                        settings.product_layout === "list"
                          ? "h-14 w-14 shrink-0"
                          : commercial || settings.product_card_style === "compact"
                          ? "aspect-square"
                          : elegant
                          ? "aspect-[4/5] rounded-lg"
                          : editorial
                          ? index === 0
                            ? "aspect-[16/8]"
                            : "aspect-[4/5]"
                          : "aspect-[3/4]",
                      )}
                    />
                    <div className={settings.product_layout === "list" ? "flex-1" : elegant ? "mt-3" : "mt-2"}>
                      <div
                        className={cn(
                          "truncate text-[10px] font-semibold text-[var(--preview-primary)]",
                          elegant && "font-serif text-[13px] font-light",
                          commercial && "font-black uppercase",
                          editorial && "font-serif text-[15px] font-light",
                        )}
                      >
                        {name}
                      </div>
                      {settings.show_price && (
                        <div className={cn("mt-0.5 text-[10px] text-neutral-600", commercial && "text-[13px] font-black text-[var(--preview-button)]", elegant && "text-[11px]", editorial && "text-[11px]")}>{price}</div>
                      )}
                      {settings.show_whatsapp_button && (
                        <div
                          className={cn(
                            "mt-2 h-5 w-full",
                            minimal && "rounded-sm",
                            elegant && "rounded-full border border-[var(--preview-button)] bg-transparent",
                            commercial && "rounded-md",
                            editorial && "h-px bg-neutral-900",
                          )}
                          style={!elegant && !editorial ? { backgroundColor: settings.button_color } : undefined}
                        />
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function stripHtml(value: string) {
  return value.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
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
        {store.whatsapp && <div>{store.whatsapp}</div>}
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
