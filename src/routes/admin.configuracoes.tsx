import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Check,
  Eye,
  HelpCircle,
  ImageIcon,
  Instagram,
  LayoutTemplate,
  Loader2,
  MapPin,
  PackageCheck,
  Palette,
  ShoppingCart,
  Store,
  Truck,
  UploadCloud,
  X,
} from "lucide-react";
import { useEffect, useRef, useState, type CSSProperties } from "react";
import { PageShell } from "@/components/page-shell";
import {
  defaultCatalogVisualSettings,
  getGeneralSettings,
  getCatalogVisualSettings,
  getDeliverySettings,
  getReceiptSettings,
  updateGeneralSettings,
  updateCatalogVisualSettings,
  updateDeliverySettings,
  updateReceiptSettings,
  uploadStoreBranding,
  defaultDeliverySettings,
  defaultReceiptSettings,
  type CatalogStyle,
  type CatalogSection,
  type CatalogVisualSettings,
  type DeliverySettings,
  type GeneralSettingsForm,
  type ReceiptSettings,
  type StoreBrandingKind,
} from "@/lib/store-settings";
import { useStoreContext } from "@/lib/store-context";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/admin/configuracoes")({
  head: () => ({
    meta: [
      { title: "Configurações - VYNKA" },
      { name: "description", content: "Preferências da sua conta e da sua loja." },
    ],
  }),
  component: Configuracoes,
});

const tabs = [
  "Geral",
  "Visual do Catálogo",
  "Pedidos e Vendas",
  "Recibo",
  "Pagamentos",
  "Entrega e Retirada",
  "Integrações",
];

const emptyForm: GeneralSettingsForm = {
  name: "",
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
  banner_url: "",
  og_image_url: "",
  banner_title: "",
  banner_subtitle: "",
  banner_cta: "",
  accepts_whatsapp_orders: true,
  accepts_site_orders: true,
};

const catalogStyleOptions: {
  value: CatalogStyle;
  title: string;
  description: string;
}[] = [
  {
    value: "minimal",
    title: "Linda Moda Fitness",
    description: "Layout exemplo com visual boutique, hero forte, vinho, dourado e cards de produto.",
  },
];

const styleDefaults: Record<
  CatalogStyle,
  Pick<
    CatalogVisualSettings,
    "product_card_style" | "product_layout" | "show_whatsapp_button" | "show_price"
  >
> = {
  minimal: {
    product_card_style: "large",
    product_layout: "grid",
    show_whatsapp_button: true,
    show_price: true,
  },
  elegant: {
    product_card_style: "large",
    product_layout: "grid",
    show_whatsapp_button: true,
    show_price: true,
  },
  commercial: {
    product_card_style: "compact",
    product_layout: "grid",
    show_whatsapp_button: true,
    show_price: true,
  },
  editorial: {
    product_card_style: "large",
    product_layout: "grid",
    show_whatsapp_button: false,
    show_price: true,
  },
};

function Configuracoes() {
  const { currentStore, refresh } = useStoreContext();
  const storeId = currentStore?.id ?? "";
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState("Geral");
  const [form, setForm] = useState<GeneralSettingsForm>(emptyForm);
  const [visualForm, setVisualForm] = useState<CatalogVisualSettings>(
    defaultCatalogVisualSettings,
  );
  const [receiptForm, setReceiptForm] = useState<ReceiptSettings>(defaultReceiptSettings);
  const [deliveryForm, setDeliveryForm] = useState<DeliverySettings>(defaultDeliverySettings);
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
  const { data: visualSettings, isLoading: visualLoading } = useQuery({
    queryKey: ["catalog-visual-settings", storeId],
    queryFn: () => getCatalogVisualSettings(storeId),
    enabled: !!storeId,
  });
  const { data: deliverySettings, isLoading: deliveryLoading } = useQuery({
    queryKey: ["delivery-settings", storeId],
    queryFn: () => getDeliverySettings(storeId),
    enabled: !!storeId,
  });

  useEffect(() => {
    if (data) setForm(data);
  }, [data]);
  useEffect(() => {
    if (receiptSettings) setReceiptForm(receiptSettings);
  }, [receiptSettings]);
  useEffect(() => {
    if (visualSettings) setVisualForm(visualSettings);
  }, [visualSettings]);
  useEffect(() => {
    if (deliverySettings) setDeliveryForm(deliverySettings);
  }, [deliverySettings]);

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

  const deliveryMutation = useMutation({
    mutationFn: () => updateDeliverySettings(storeId, deliveryForm),
    onSuccess: async () => {
      setSaved(true);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["delivery-settings", storeId] }),
        queryClient.invalidateQueries({ queryKey: ["general-settings", storeId] }),
        refresh(),
      ]);
      window.setTimeout(() => setSaved(false), 2200);
    },
  });

  const visualMutation = useMutation({
    mutationFn: () => updateCatalogVisualSettings(storeId, visualForm),
    onSuccess: async () => {
      setSaved(true);
      await queryClient.invalidateQueries({ queryKey: ["catalog-visual-settings", storeId] });
      window.setTimeout(() => setSaved(false), 2200);
    },
  });

  const patch = (key: keyof GeneralSettingsForm, value: string) => {
    setSaved(false);
    setForm((current) => ({ ...current, [key]: value }));
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
  const patchGeneralBoolean = (
    key: Extract<keyof GeneralSettingsForm, "accepts_whatsapp_orders" | "accepts_site_orders">,
    value: boolean,
  ) => {
    setSaved(false);
    setForm((current) => ({ ...current, [key]: value }));
  };
  const patchVisual = <K extends keyof CatalogVisualSettings>(
    key: K,
    value: CatalogVisualSettings[K],
  ) => {
    setSaved(false);
    setVisualForm((current) => ({ ...current, [key]: value }));
  };
  const applyCatalogStyle = (style: CatalogStyle) => {
    setSaved(false);
    setVisualForm((current) => ({
      ...current,
      ...styleDefaults[style],
      catalog_style: style,
    }));
  };
  const patchReceipt = <K extends keyof ReceiptSettings>(key: K, value: ReceiptSettings[K]) => {
    setSaved(false);
    setReceiptForm((current) => ({ ...current, [key]: value }));
  };
  const patchDelivery = <K extends keyof DeliverySettings>(key: K, value: DeliverySettings[K]) => {
    setSaved(false);
    setDeliveryForm((current) => ({ ...current, [key]: value }));
  };

  return (
    <PageShell title="Configurações">
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

        {activeTab === "Geral" ? (
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
                  Informações gerais
                </h2>
                <p className="mt-1 text-[12px] text-muted-foreground">
                  Forneça detalhes sobre seu negócio
                </p>
              </div>

              <div className="grid gap-5 xl:grid-cols-2">
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
                        label="Banner principal"
                        description="Imagem de destaque usada na página inicial da loja."
                        value={form.banner_url}
                        kind="banner"
                        uploading={uploadMutation.isPending && uploadingImage === "banner"}
                        ratio="banner"
                        onUpload={(kind, file) => {
                          setSaved(false);
                          setUploadingImage(kind);
                          uploadMutation.mutate({ kind, file });
                        }}
                        onRemove={() => patch("banner_url", "")}
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
                    <TextInput
                      value={form.banner_title}
                      onChange={(value) => patch("banner_title", value)}
                      placeholder="Texto principal do banner"
                    />
                    <TextInput
                      value={form.banner_cta}
                      onChange={(value) => patch("banner_cta", value)}
                      placeholder="Texto do botao do banner"
                    />
                    <textarea
                      value={form.banner_subtitle}
                      onChange={(event) => patch("banner_subtitle", event.target.value)}
                      placeholder="Texto secundario do banner"
                      className="min-h-24 w-full resize-none rounded-md border border-border bg-surface px-3 py-3 text-[14px] outline-none focus:border-foreground/40"
                    />
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
          visualLoading || isLoading ? (
            <div className="grid min-h-[420px] place-items-center rounded-lg border border-border bg-surface">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" strokeWidth={1.5} />
            </div>
          ) : (
            <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_420px]">
              <div className="space-y-5">
                <div className="text-center">
                  <div className="mx-auto grid h-20 w-20 place-items-center rounded-md text-primary">
                    <Palette className="h-14 w-14" strokeWidth={1.3} />
                  </div>
                  <h2 className="mt-2 text-[15px] font-semibold text-foreground">
                    Visual do Catálogo
                  </h2>
                  <p className="mt-1 text-[12px] text-muted-foreground">
                    Ajuste o tema, as cores e como seus produtos aparecem na loja publica.
                  </p>
                </div>

                <SettingsCard title="Estilo do Catálogo">
                  <div className="grid gap-3 md:grid-cols-2">
                    {catalogStyleOptions.map((style) => (
                      <button
                        key={style.value}
                        type="button"
                        onClick={() => applyCatalogStyle(style.value)}
                        className={cn(
                          "min-h-36 rounded-lg border bg-surface p-4 text-left transition-all hover:border-primary/60",
                          visualForm.catalog_style === style.value
                            ? "border-primary ring-1 ring-primary/25"
                            : "border-border",
                        )}
                      >
                        <StyleMiniPreview style={style.value} />
                        <div className="mt-3 flex items-start gap-3">
                          <div className="grid h-8 w-8 shrink-0 place-items-center rounded-md bg-muted text-primary">
                            <LayoutTemplate className="h-4 w-4" strokeWidth={1.5} />
                          </div>
                          <div>
                            <div className="text-[14px] font-semibold text-foreground">{style.title}</div>
                            <div className="mt-1 text-[12px] leading-relaxed text-muted-foreground">
                              {style.description}
                            </div>
                          </div>
                        </div>
                      </button>
                    ))}
                  </div>
                </SettingsCard>
                <SettingsCard title="Cores">
                  <div className="grid gap-3 md:grid-cols-2">
                    <ColorInput label="Cor principal" value={visualForm.primary_color} onChange={(v) => patchVisual("primary_color", v)} />
                    <ColorInput label="Cor secundaria" value={visualForm.secondary_color} onChange={(v) => patchVisual("secondary_color", v)} />
                    <ColorInput label="Cor de fundo" value={visualForm.background_color} onChange={(v) => patchVisual("background_color", v)} />
                    <ColorInput label="Cor dos botoes" value={visualForm.button_color} onChange={(v) => patchVisual("button_color", v)} />
                  </div>
                </SettingsCard>

                <SettingsCard title="Cards de produto">
                  <SegmentedControl
                    label="Estilo do card"
                    value={visualForm.product_card_style}
                    options={[
                      ["large", "Imagem grande"],
                      ["compact", "Compacto"],
                    ]}
                    onChange={(value) =>
                      patchVisual("product_card_style", value as CatalogVisualSettings["product_card_style"])
                    }
                  />
                  <SegmentedControl
                    label="Exibição"
                    value={visualForm.product_layout}
                    options={[
                      ["grid", "Grade"],
                      ["list", "Lista"],
                    ]}
                    onChange={(value) =>
                      patchVisual("product_layout", value as CatalogVisualSettings["product_layout"])
                    }
                  />
                  <ToggleRow
                    title="Mostrar preço"
                    description="Exibe valores nos cards e listas de produtos."
                    checked={visualForm.show_price}
                    onChange={() => patchVisual("show_price", !visualForm.show_price)}
                  />
                  <ToggleRow
                    title="Mostrar botão de WhatsApp"
                    description="Exibe o atalho de interesse nos cards do catalogo."
                    checked={visualForm.show_whatsapp_button}
                    onChange={() =>
                      patchVisual("show_whatsapp_button", !visualForm.show_whatsapp_button)
                    }
                  />
                </SettingsCard>

                <SettingsCard title="Página inicial">
                  <ToggleRow
                    title="Mostrar banner"
                    description="Exibe a area principal no topo do catalogo."
                    checked={visualForm.show_banner}
                    onChange={() => patchVisual("show_banner", !visualForm.show_banner)}
                  />
                  <ToggleRow
                    title="Mostrar descrição da loja"
                    description="Mostra um bloco com o texto institucional."
                    checked={visualForm.show_description}
                    onChange={() => patchVisual("show_description", !visualForm.show_description)}
                  />
                  <ToggleRow
                    title="Mostrar produtos em destaque"
                    description="Usa os produtos marcados como destaque."
                    checked={visualForm.show_featured}
                    onChange={() => patchVisual("show_featured", !visualForm.show_featured)}
                  />
                  <ToggleRow
                    title="Mostrar categorias"
                    description="Exibe as categorias antes da listagem de produtos."
                    checked={visualForm.show_categories}
                    onChange={() => patchVisual("show_categories", !visualForm.show_categories)}
                  />
                  <SectionOrderEditor
                    order={visualForm.section_order}
                    onChange={(order) => patchVisual("section_order", order)}
                  />
                </SettingsCard>

                {visualMutation.error && (
                  <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-[13px] text-red-700">
                    {visualMutation.error instanceof Error
                      ? visualMutation.error.message
                      : "Nao foi possivel salvar o visual do catalogo."}
                  </div>
                )}

                <div className="sticky bottom-4 flex justify-end">
                  <button
                    type="button"
                    disabled={visualMutation.isPending}
                    onClick={() => visualMutation.mutate()}
                    className="inline-flex items-center gap-2 rounded-md bg-primary px-5 py-3 text-[13px] font-semibold text-primary-foreground shadow-lg transition-colors hover:bg-graphite disabled:opacity-60"
                  >
                    {visualMutation.isPending ? (
                      <Loader2 className="h-4 w-4 animate-spin" strokeWidth={1.5} />
                    ) : saved ? (
                      <Check className="h-4 w-4" strokeWidth={1.6} />
                    ) : null}
                    {saved ? "Salvo" : "Salvar visual"}
                  </button>
                </div>
              </div>

              <div className="xl:sticky xl:top-6 xl:self-start">
                <CatalogVisualPreview store={form} settings={visualForm} />
              </div>
            </div>
          )
        ) : activeTab === "Pedidos e Vendas" ? (
          isLoading ? (
            <div className="grid min-h-[420px] place-items-center rounded-lg border border-border bg-surface">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" strokeWidth={1.5} />
            </div>
          ) : (
            <div className="space-y-6">
              <div className="text-center">
                <div className="mx-auto grid h-20 w-20 place-items-center rounded-md text-primary">
                  <ShoppingCart className="h-14 w-14" strokeWidth={1.3} />
                </div>
                <h2 className="mt-2 text-[15px] font-semibold text-foreground">
                  Pedidos e vendas
                </h2>
                <p className="mt-1 text-[12px] text-muted-foreground">
                  Defina por onde seus clientes podem finalizar as compras.
                </p>
              </div>

              <div className="grid gap-5 lg:grid-cols-2">
                <SettingsCard title="Canais de pedido">
                  <ToggleRow
                    title="Receber pedidos pelo WhatsApp"
                    description="Os botões Comprar pelo WhatsApp usarão este número."
                    checked={form.accepts_whatsapp_orders}
                    onChange={() =>
                      patchGeneralBoolean("accepts_whatsapp_orders", !form.accepts_whatsapp_orders)
                    }
                  />
                  <ToggleRow
                    title="Receber pedidos pelo site"
                    description="Permite finalizar a compra pela sacola da loja."
                    checked={form.accepts_site_orders}
                    onChange={() =>
                      patchGeneralBoolean("accepts_site_orders", !form.accepts_site_orders)
                    }
                  />
                </SettingsCard>

                <SettingsCard title="Contato de vendas">
                  <TextInput
                    value={form.whatsapp}
                    onChange={(value) => patch("whatsapp", value)}
                    placeholder="WhatsApp de pedidos"
                    help
                  />
                  <TextInput
                    value={form.email}
                    onChange={(value) => patch("email", value)}
                    placeholder="E-mail de contato"
                  />
                </SettingsCard>
              </div>

              {saveMutation.error && (
                <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-[13px] text-red-700">
                  {saveMutation.error instanceof Error
                    ? saveMutation.error.message
                    : "Não foi possível salvar as configurações de pedidos."}
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
                  {saved ? "Salvo" : "Salvar pedidos e vendas"}
                </button>
              </div>
            </div>
          )
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
                    onClick={() => setActiveTab("Geral")}
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
        ) : activeTab === "Entrega e Retirada" ? (
          deliveryLoading ? (
            <div className="grid min-h-[420px] place-items-center rounded-lg border border-border bg-surface">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" strokeWidth={1.5} />
            </div>
          ) : (
            <div className="space-y-8">
              <div className="text-center">
                <div className="mx-auto grid h-20 w-20 place-items-center rounded-md text-primary">
                  <Truck className="h-14 w-14" strokeWidth={1.3} />
                </div>
                <h2 className="mt-2 text-[15px] font-semibold text-foreground">
                  Entrega e Retirada
                </h2>
                <p className="mt-1 text-[12px] text-muted-foreground">
                  Quais as opções você disponibiliza em seu negócio?
                </p>
              </div>

              <div className="grid gap-5 lg:grid-cols-2">
                <DeliveryOptionCard
                  icon={<PackageCheck className="h-6 w-6" strokeWidth={1.5} />}
                  title="Trabalho com entregas"
                  description="Um campo obrigatório de endereço será solicitado aos seus clientes."
                  checked={deliveryForm.delivery_available}
                  onClick={() =>
                    patchDelivery("delivery_available", !deliveryForm.delivery_available)
                  }
                />
                <DeliveryOptionCard
                  icon={<MapPin className="h-6 w-6" strokeWidth={1.5} />}
                  title="Trabalho com retirada no local"
                  description="Seu endereço será informado durante o fechamento do pedido."
                  checked={deliveryForm.pickup_available}
                  onClick={() => patchDelivery("pickup_available", !deliveryForm.pickup_available)}
                />
              </div>

              <SettingsCard title="Detalhes de atendimento">
                <ToggleRow
                  title="Combinar entrega pelo WhatsApp"
                  description="Use o WhatsApp para acertar valor, prazo ou forma de entrega."
                  checked={deliveryForm.combine_delivery_whatsapp}
                  onChange={() =>
                    patchDelivery(
                      "combine_delivery_whatsapp",
                      !deliveryForm.combine_delivery_whatsapp,
                    )
                  }
                />
                <TextInput
                  value={deliveryForm.address}
                  onChange={(value) => patchDelivery("address", value)}
                  placeholder="Endereco ou instrucoes de retirada"
                />
                <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_110px_160px]">
                  <TextInput
                    value={deliveryForm.city}
                    onChange={(value) => patchDelivery("city", value)}
                    placeholder="Cidade"
                  />
                  <TextInput
                    value={deliveryForm.state}
                    onChange={(value) => patchDelivery("state", value.toUpperCase())}
                    placeholder="UF"
                  />
                  <TextInput
                    value={deliveryForm.zip_code}
                    onChange={(value) => patchDelivery("zip_code", value)}
                    placeholder="CEP"
                  />
                </div>
                <TextInput
                  value={deliveryForm.business_hours}
                  onChange={(value) => patchDelivery("business_hours", value)}
                  placeholder="Horario de atendimento"
                />
                <textarea
                  value={deliveryForm.delivery_notes}
                  onChange={(event) => patchDelivery("delivery_notes", event.target.value)}
                  placeholder="Observacoes sobre entrega"
                  className="min-h-24 w-full resize-none rounded-md border border-border bg-surface px-3 py-3 text-[14px] outline-none focus:border-foreground/40"
                />
              </SettingsCard>

              {deliveryMutation.error && (
                <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-[13px] text-red-700">
                  {deliveryMutation.error instanceof Error
                    ? deliveryMutation.error.message
                    : "Não foi possível salvar as configurações de entrega e retirada."}
                </div>
              )}

              <div className="sticky bottom-4 flex justify-end">
                <button
                  type="button"
                  disabled={deliveryMutation.isPending}
                  onClick={() => deliveryMutation.mutate()}
                  className="inline-flex items-center gap-2 rounded-md bg-primary px-5 py-3 text-[13px] font-semibold text-primary-foreground shadow-lg transition-colors hover:bg-graphite disabled:opacity-60"
                >
                  {deliveryMutation.isPending ? (
                    <Loader2 className="h-4 w-4 animate-spin" strokeWidth={1.5} />
                  ) : saved ? (
                    <Check className="h-4 w-4" strokeWidth={1.6} />
                  ) : null}
                  {saved ? "Salvo" : "Salvar entrega e retirada"}
                </button>
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

function DeliveryOptionCard({
  icon,
  title,
  description,
  checked,
  onClick,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
  checked: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex min-h-32 items-center justify-between gap-5 rounded-lg border bg-surface p-6 text-left shadow-sm transition-all hover:border-primary/60 hover:shadow-md",
        checked ? "border-primary ring-1 ring-primary/25" : "border-border",
      )}
      aria-pressed={checked}
    >
      <div className="flex items-start gap-4">
        <div
          className={cn(
            "grid h-11 w-11 shrink-0 place-items-center rounded-md",
            checked ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground",
          )}
        >
          {icon}
        </div>
        <div>
          <h3 className="text-[17px] font-semibold text-foreground">{title}</h3>
          <p className="mt-1 text-[12px] leading-relaxed text-muted-foreground">{description}</p>
        </div>
      </div>
      <span
        className={cn(
          "grid h-6 w-6 shrink-0 place-items-center rounded-full border",
          checked ? "border-primary bg-primary text-primary-foreground" : "border-border bg-muted",
        )}
      >
        {checked && <Check className="h-3.5 w-3.5" strokeWidth={2} />}
      </span>
    </button>
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
  ratio: "square" | "banner";
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
            ratio === "square" ? "aspect-square" : "aspect-[16/7]",
          )}
        >
          {value ? (
            <img src={value} alt="" className="h-full w-full object-cover" />
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
}: {
  store: GeneralSettingsForm;
  settings: CatalogVisualSettings;
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
              {store.banner_url ? (
                <img
                  src={store.banner_url}
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
                  {store.banner_title || store.name || "Nova coleção"}
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
                  {store.banner_cta || "Ver produtos"}
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
