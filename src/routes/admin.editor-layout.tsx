import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowDown,
  ArrowLeft,
  ArrowUp,
  Check,
  ChevronRight,
  ExternalLink,
  ImageIcon,
  LayoutGrid,
  Loader2,
  Monitor,
  Package,
  Palette,
  PanelBottom,
  PanelTop,
  Plus,
  RotateCcw,
  Settings2,
  Smartphone,
  Store,
  Trash2,
  Type,
  UploadCloud,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { listCategories, listProducts, type Category, type ProductRecord } from "@/lib/products";
import {
  defaultCatalogVisualSettings,
  getCatalogVisualSettings,
  getGeneralSettings,
  listStoreBanners,
  saveStoreBanners,
  storeFontFamily,
  updateCatalogVisualSettings,
  updateGeneralSettings,
  uploadStoreBranding,
  type CatalogSection,
  type CatalogStyle,
  type CatalogVisualSettings,
  type GeneralSettingsForm,
  type StoreBanner,
  type StoreBannerLinkType,
  type StoreFont,
} from "@/lib/store-settings";
import { useStoreContext } from "@/lib/store-context";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/admin/editor-layout")({
  head: () => ({
    meta: [
      { title: "Editor de Layout - VYNKA" },
      { name: "description", content: "Edite e visualize o layout da loja em tempo real." },
    ],
  }),
  component: LayoutEditor,
});

type EditorSection = "brand" | "colors" | "typography" | "home" | "products" | "header" | "footer" | "advanced";
type PreviewDevice = "mobile" | "desktop";

const emptyStore: GeneralSettingsForm = {
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

const editorSections: { id: EditorSection; title: string; description: string; icon: typeof Store }[] = [
  { id: "brand", title: "Imagem da marca", description: "Nome, logo e apresentação", icon: Store },
  { id: "colors", title: "Cores e estilo", description: "Paleta e identidade visual", icon: Palette },
  { id: "typography", title: "Editar letras", description: "Fontes e tamanhos", icon: Type },
  { id: "home", title: "Página inicial", description: "Banners e seções", icon: LayoutGrid },
  { id: "products", title: "Lista de produtos", description: "Cards, preços e exibição", icon: Package },
  { id: "header", title: "Cabeçalho", description: "Marca e navegação", icon: PanelTop },
  { id: "footer", title: "Rodapé", description: "Contato e redes sociais", icon: PanelBottom },
  { id: "advanced", title: "Opções avançadas", description: "Ordem das seções", icon: Settings2 },
];

const styleOptions: { value: CatalogStyle; label: string; description: string }[] = [
  { value: "minimal", label: "Minimalista", description: "Limpo e direto" },
  { value: "elegant", label: "Elegante", description: "Clássico e refinado" },
  { value: "commercial", label: "Comercial", description: "Ofertas em destaque" },
  { value: "editorial", label: "Editorial", description: "Imagens e tipografia" },
];

const fontOptions: { value: StoreFont; label: string }[] = [
  { value: "inter", label: "Inter" },
  { value: "montserrat", label: "Montserrat" },
  { value: "playfair", label: "Playfair Display" },
  { value: "cormorant", label: "Cormorant Garamond" },
  { value: "georgia", label: "Georgia" },
  { value: "roboto", label: "Roboto" },
  { value: "open-sans", label: "Open Sans" },
  { value: "lato", label: "Lato" },
  { value: "poppins", label: "Poppins" },
  { value: "raleway", label: "Raleway" },
  { value: "nunito", label: "Nunito" },
  { value: "merriweather", label: "Merriweather" },
  { value: "libre-baskerville", label: "Libre Baskerville" },
  { value: "oswald", label: "Oswald" },
  { value: "dancing-script", label: "Dancing Script" },
];

function LayoutEditor() {
  const { currentStore, refresh } = useStoreContext();
  const storeId = currentStore?.id ?? "";
  const queryClient = useQueryClient();
  const [activeSection, setActiveSection] = useState<EditorSection>("brand");
  const [device, setDevice] = useState<PreviewDevice>("desktop");
  const [store, setStore] = useState<GeneralSettingsForm>(emptyStore);
  const [visual, setVisual] = useState<CatalogVisualSettings>(defaultCatalogVisualSettings);
  const [banners, setBanners] = useState<StoreBanner[]>([]);
  const [uploading, setUploading] = useState<string | null>(null);
  const [published, setPublished] = useState(false);
  const [saveError, setSaveError] = useState("");
  const initialRef = useRef<{ store: GeneralSettingsForm; visual: CatalogVisualSettings; banners: StoreBanner[] } | null>(null);
  const initializedStoreRef = useRef("");

  const { data: storedGeneral, isLoading: generalLoading } = useQuery({
    queryKey: ["general-settings", storeId],
    queryFn: () => getGeneralSettings(storeId),
    enabled: !!storeId,
  });
  const { data: storedVisual, isLoading: visualLoading } = useQuery({
    queryKey: ["catalog-visual-settings", storeId],
    queryFn: () => getCatalogVisualSettings(storeId),
    enabled: !!storeId,
  });
  const { data: storedBanners, isLoading: bannersLoading } = useQuery({
    queryKey: ["store-banners", storeId],
    queryFn: () => listStoreBanners(storeId),
    enabled: !!storeId,
  });
  const { data: products = [] } = useQuery({
    queryKey: ["products", storeId],
    queryFn: () => listProducts(storeId),
    enabled: !!storeId,
  });
  const { data: categories = [] } = useQuery({
    queryKey: ["categories", storeId],
    queryFn: () => listCategories(storeId),
    enabled: !!storeId,
  });

  const loading = generalLoading || visualLoading || bannersLoading;

  useEffect(() => {
    if (loading || !storeId || initializedStoreRef.current === storeId) return;
    const next = {
      store: storedGeneral ?? emptyStore,
      visual: storedVisual ?? defaultCatalogVisualSettings,
      banners: storedBanners ?? [],
    };
    setStore(next.store);
    setVisual(next.visual);
    setBanners(next.banners);
    initialRef.current = structuredClone(next);
    initializedStoreRef.current = storeId;
  }, [loading, storeId, storedGeneral, storedVisual, storedBanners]);

  const dirty = useMemo(() => {
    if (!initialRef.current) return false;
    return JSON.stringify({ store, visual, banners }) !== JSON.stringify(initialRef.current);
  }, [store, visual, banners]);

  const publishMutation = useMutation({
    mutationFn: async () => {
      setSaveError("");
      await Promise.all([
        updateGeneralSettings(storeId, store),
        updateCatalogVisualSettings(storeId, visual),
        saveStoreBanners(storeId, banners),
      ]);
    },
    onSuccess: async () => {
      initialRef.current = structuredClone({ store, visual, banners });
      setPublished(true);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["general-settings", storeId] }),
        queryClient.invalidateQueries({ queryKey: ["catalog-visual-settings", storeId] }),
        queryClient.invalidateQueries({ queryKey: ["store-banners", storeId] }),
        refresh(),
      ]);
      window.setTimeout(() => setPublished(false), 2500);
    },
    onError: (error) => setSaveError(error instanceof Error ? error.message : "Não foi possível publicar as alterações."),
  });

  const uploadMutation = useMutation({
    mutationFn: ({ kind, file }: { targetId: string; kind: "logo" | "favicon" | "banner" | "about"; file: File }) =>
      uploadStoreBranding(storeId, kind, file),
    onSuccess: (url, variables) => {
      if (variables.kind === "logo") {
        setStore((current) => ({ ...current, logo_url: url }));
      } else if (variables.kind === "favicon") {
        setStore((current) => ({ ...current, favicon_url: url }));
      } else if (variables.kind === "about") {
        setVisual((current) => ({ ...current, about_image_url: url }));
      } else {
        setBanners((current) => current.map((banner) => banner.id === variables.targetId ? { ...banner, image_url: url } : banner));
      }
      setUploading(null);
    },
    onError: () => {
      setUploading(null);
      setSaveError("Não foi possível enviar a imagem.");
    },
  });

  const discardChanges = () => {
    if (!initialRef.current) return;
    const initial = structuredClone(initialRef.current);
    setStore(initial.store);
    setVisual(initial.visual);
    setBanners(initial.banners);
    setSaveError("");
  };

  const patchStore = <K extends keyof GeneralSettingsForm>(key: K, value: GeneralSettingsForm[K]) =>
    setStore((current) => ({ ...current, [key]: value }));
  const patchVisual = <K extends keyof CatalogVisualSettings>(key: K, value: CatalogVisualSettings[K]) =>
    setVisual((current) => ({ ...current, [key]: value }));
  const patchBanner = <K extends keyof StoreBanner>(id: string, key: K, value: StoreBanner[K]) =>
    setBanners((current) => current.map((banner) => banner.id === id ? { ...banner, [key]: value } : banner));

  const addBanner = () => {
    const id = crypto.randomUUID();
    setBanners((current) => [...current, {
      id,
      store_id: storeId,
      image_url: "",
      title: "Novo destaque",
      subtitle: "Apresente uma promoção ou novidade da sua loja.",
      button_label: "Ver produtos",
      link_type: "home",
      link_target: "",
      sort_order: current.length,
      active: true,
    }]);
  };

  if (loading || !initialRef.current) {
    return <div className="grid min-h-svh w-full place-items-center bg-[#f4f5f7]"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>;
  }

  const publicHref = store.slug ? `/loja/${store.slug}` : "/admin/configuracoes";

  return (
    <div className="min-h-svh w-full bg-[#eef0f3] text-foreground">
      <header className="sticky top-0 z-40 flex h-16 items-center justify-between gap-3 border-b border-border bg-white px-3 sm:px-5">
        <div className="flex min-w-0 items-center gap-3">
          <Button asChild variant="ghost" size="icon" title="Fechar editor">
            <Link to="/admin/configuracoes"><ArrowLeft /></Link>
          </Button>
          <div className="min-w-0">
            <div className="truncate text-[14px] font-semibold">Editor de Layout</div>
            <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
              <span className={cn("h-1.5 w-1.5 rounded-full", dirty ? "bg-amber-500" : "bg-emerald-500")} />
              {dirty ? "Alterações não publicadas" : "Layout publicado"}
            </div>
          </div>
        </div>

        <div className="hidden items-center rounded-md border border-border bg-muted p-1 sm:flex">
          <DeviceButton active={device === "mobile"} onClick={() => setDevice("mobile")} icon={Smartphone}>Celular</DeviceButton>
          <DeviceButton active={device === "desktop"} onClick={() => setDevice("desktop")} icon={Monitor}>Computador</DeviceButton>
        </div>

        <div className="flex items-center gap-2">
          <Button asChild variant="ghost" className="hidden md:inline-flex">
            <a href={publicHref} target="_blank" rel="noreferrer"><ExternalLink /> Ver loja</a>
          </Button>
          <Button variant="outline" onClick={discardChanges} disabled={!dirty || publishMutation.isPending} className="hidden sm:inline-flex">
            <RotateCcw /> Descartar
          </Button>
          <Button onClick={() => publishMutation.mutate()} disabled={!dirty || publishMutation.isPending}>
            {publishMutation.isPending ? <Loader2 className="animate-spin" /> : published ? <Check /> : null}
            {published ? "Publicado" : "Publicar alterações"}
          </Button>
        </div>
      </header>

      <main className="grid min-h-[calc(100svh-4rem)] lg:h-[calc(100svh-4rem)] lg:grid-cols-[360px_minmax(0,1fr)]">
        <aside className="border-r border-border bg-white lg:overflow-y-auto">
          <nav className="border-b border-border p-3">
            {editorSections.map((section) => {
              const Icon = section.icon;
              return (
                <button
                  key={section.id}
                  type="button"
                  onClick={() => setActiveSection(section.id)}
                  className={cn("flex w-full items-center gap-3 rounded-md px-3 py-2.5 text-left transition-colors", activeSection === section.id ? "bg-neutral-100 text-foreground" : "text-muted-foreground hover:bg-neutral-50 hover:text-foreground")}
                >
                  <Icon className="h-4 w-4 shrink-0" strokeWidth={1.6} />
                  <span className="min-w-0 flex-1">
                    <span className="block text-[13px] font-medium">{section.title}</span>
                    <span className="block truncate text-[11px] text-muted-foreground">{section.description}</span>
                  </span>
                  <ChevronRight className="h-4 w-4 shrink-0" />
                </button>
              );
            })}
          </nav>

          <div className="p-5">
            <EditorControls
              section={activeSection}
              store={store}
              visual={visual}
              banners={banners}
              products={products}
              categories={categories}
              uploading={uploading}
              patchStore={patchStore}
              patchVisual={patchVisual}
              patchBanner={patchBanner}
              setBanners={setBanners}
              addBanner={addBanner}
              upload={(targetId, kind, file) => {
                setUploading(targetId);
                uploadMutation.mutate({ targetId, kind, file });
              }}
            />
            {saveError && <div className="mt-4 rounded-md border border-red-200 bg-red-50 p-3 text-[12px] text-red-700">{saveError}</div>}
          </div>
        </aside>

        <section className="min-w-0 overflow-auto p-3 sm:p-6 lg:p-8">
          <div className="mb-3 flex items-center justify-center gap-2 sm:hidden">
            <DeviceButton active={device === "mobile"} onClick={() => setDevice("mobile")} icon={Smartphone}>Celular</DeviceButton>
            <DeviceButton active={device === "desktop"} onClick={() => setDevice("desktop")} icon={Monitor}>Computador</DeviceButton>
          </div>
          <div className={cn("mx-auto overflow-hidden border border-black/10 bg-white shadow-xl transition-[max-width] duration-300", device === "mobile" ? "max-w-[390px]" : "max-w-[1180px]")}>
            <StorefrontPreview store={store} visual={visual} banners={banners} products={products} device={device} showAboutPage={activeSection === "header" && visual.about_enabled} />
          </div>
        </section>
      </main>
    </div>
  );
}

function DeviceButton({ active, onClick, icon: Icon, children }: { active: boolean; onClick: () => void; icon: typeof Monitor; children: ReactNode }) {
  return <button type="button" onClick={onClick} className={cn("inline-flex h-8 items-center gap-2 rounded px-3 text-[12px] font-medium", active ? "bg-white text-foreground shadow-sm ring-1 ring-border" : "text-muted-foreground")}><Icon className="h-4 w-4" />{children}</button>;
}

type ControlsProps = {
  section: EditorSection;
  store: GeneralSettingsForm;
  visual: CatalogVisualSettings;
  banners: StoreBanner[];
  products: ProductRecord[];
  categories: Category[];
  uploading: string | null;
  patchStore: <K extends keyof GeneralSettingsForm>(key: K, value: GeneralSettingsForm[K]) => void;
  patchVisual: <K extends keyof CatalogVisualSettings>(key: K, value: CatalogVisualSettings[K]) => void;
  patchBanner: <K extends keyof StoreBanner>(id: string, key: K, value: StoreBanner[K]) => void;
  setBanners: React.Dispatch<React.SetStateAction<StoreBanner[]>>;
  addBanner: () => void;
  upload: (targetId: string, kind: "logo" | "favicon" | "banner" | "about", file: File) => void;
};

function EditorControls(props: ControlsProps) {
  const { section, store, visual, banners, products, categories, patchStore, patchVisual } = props;
  const title = editorSections.find((item) => item.id === section)?.title;
  return (
    <div>
      <h2 className="text-[15px] font-semibold">{title}</h2>
      <div className="mt-5 space-y-5">
        {section === "brand" && <>
          <Field label="Nome exibido na loja"><Input value={store.name} onChange={(event) => patchStore("name", event.target.value)} /></Field>
          <Field label="Logo">
            <ImageUpload value={store.logo_url} uploading={props.uploading === "logo"} onFile={(file) => props.upload("logo", "logo", file)} onRemove={() => patchStore("logo_url", "")} />
          </Field>
          <Field label="Favicon">
            <ImageUpload value={store.favicon_url} uploading={props.uploading === "favicon"} onFile={(file) => props.upload("favicon", "favicon", file)} onRemove={() => patchStore("favicon_url", "")} variant="favicon" />
          </Field>
          <Field label="Apresentação da loja"><Textarea rows={5} value={store.description} onChange={(event) => patchStore("description", event.target.value)} placeholder="Conte um pouco sobre a sua marca." /></Field>
        </>}

        {section === "colors" && <>
          <div className="grid grid-cols-2 gap-2">
            <ColorField label="Títulos" value={visual.primary_color} onChange={(value) => patchVisual("primary_color", value)} />
            <ColorField label="Descrições" value={visual.secondary_color} onChange={(value) => patchVisual("secondary_color", value)} />
            <ColorField label="Fundo" value={visual.background_color} onChange={(value) => patchVisual("background_color", value)} />
            <ColorField label="Botão normal" value={visual.button_color} onChange={(value) => patchVisual("button_color", value)} />
            <ColorField label="Botão com mouse" value={visual.button_hover_color} onChange={(value) => patchVisual("button_hover_color", value)} />
            <ColorField label="Letra do botão" value={visual.button_text_color} onChange={(value) => patchVisual("button_text_color", value)} />
          </div>
          <Field label="Estilo do catálogo">
            <div className="grid grid-cols-2 gap-2">
              {styleOptions.map((option) => <button key={option.value} type="button" onClick={() => patchVisual("catalog_style", option.value)} className={cn("rounded-md border p-3 text-left", visual.catalog_style === option.value ? "border-foreground bg-neutral-50 ring-1 ring-foreground/10" : "border-border")}><span className="block text-[12px] font-semibold">{option.label}</span><span className="mt-1 block text-[10px] text-muted-foreground">{option.description}</span></button>)}
            </div>
          </Field>
        </>}

        {section === "typography" && <>
          <FontSelector label="Fonte dos títulos" value={visual.heading_font} onChange={(value) => patchVisual("heading_font", value)} />
          <ScaleControl label="Tamanho dos títulos" value={visual.heading_scale} minimum={80} maximum={140} onChange={(value) => patchVisual("heading_scale", value)} />
          <FontSelector label="Fonte dos textos" value={visual.body_font} onChange={(value) => patchVisual("body_font", value)} />
          <ScaleControl label="Tamanho dos textos" value={visual.body_scale} minimum={85} maximum={125} onChange={(value) => patchVisual("body_scale", value)} />
          <div className="rounded-md border border-border bg-neutral-50 p-4">
            <div style={{ fontFamily: storeFontFamily(visual.heading_font), fontSize: `${20 * (visual.heading_scale / 100)}px` }} className="font-semibold leading-tight">Sua marca em destaque</div>
            <p style={{ fontFamily: storeFontFamily(visual.body_font), fontSize: `${13 * (visual.body_scale / 100)}px` }} className="mt-2 leading-relaxed text-muted-foreground">Veja aqui uma amostra da combinação escolhida.</p>
          </div>
        </>}

        {section === "home" && <>
          <Toggle label="Mostrar banners" checked={visual.show_banner} onChange={(checked) => patchVisual("show_banner", checked)} />
          <Toggle label="Mostrar descrição" checked={visual.show_description} onChange={(checked) => patchVisual("show_description", checked)} />
          <Toggle label="Mostrar categorias" checked={visual.show_categories} onChange={(checked) => patchVisual("show_categories", checked)} />
          <Toggle label="Mostrar destaques" checked={visual.show_featured} onChange={(checked) => patchVisual("show_featured", checked)} />
          <div className="border-t border-border pt-5">
            <div className="mb-3 flex items-center justify-between"><Label>Banners</Label><Button size="sm" variant="outline" onClick={props.addBanner}><Plus /> Adicionar</Button></div>
            {banners.length === 0 ? <button type="button" onClick={props.addBanner} className="w-full rounded-md border border-dashed border-border p-6 text-[12px] text-muted-foreground">Criar primeiro banner</button> : <div className="space-y-3">{banners.map((banner, index) => <BannerEditor key={banner.id} banner={banner} index={index} total={banners.length} products={products} categories={categories} uploading={props.uploading === banner.id} patch={props.patchBanner} remove={() => props.setBanners((current) => current.filter((item) => item.id !== banner.id))} move={(direction) => props.setBanners((current) => moveItem(current, index, direction))} upload={(file) => props.upload(banner.id, "banner", file)} />)}</div>}
          </div>
        </>}

        {section === "products" && <>
          <Field label="Exibição"><Segmented value={visual.product_layout} options={[["grid", "Grade"], ["list", "Lista"]]} onChange={(value) => patchVisual("product_layout", value as CatalogVisualSettings["product_layout"])} /></Field>
          <Field label="Tamanho dos cards"><Segmented value={visual.product_card_style} options={[["large", "Imagem grande"], ["compact", "Compacto"]]} onChange={(value) => patchVisual("product_card_style", value as CatalogVisualSettings["product_card_style"])} /></Field>
          <Toggle label="Mostrar preços" checked={visual.show_price} onChange={(checked) => patchVisual("show_price", checked)} />
          <Toggle label="Mostrar botão do WhatsApp" checked={visual.show_whatsapp_button} onChange={(checked) => patchVisual("show_whatsapp_button", checked)} />
        </>}

        {section === "header" && <>
          <Field label="Nome do menu de categorias"><Input value={visual.header_categories_label} onChange={(event) => patchVisual("header_categories_label", event.target.value)} placeholder="Categorias" /></Field>
          <div className="border-t border-border pt-5">
            <Toggle label="Exibir página Quem somos" checked={visual.about_enabled} onChange={(checked) => patchVisual("about_enabled", checked)} />
          </div>
          {visual.about_enabled && <>
            <Field label="Nome no cabeçalho"><Input value={visual.about_menu_label} onChange={(event) => patchVisual("about_menu_label", event.target.value)} placeholder="Quem somos" /></Field>
            <Field label="Título da página"><Input value={visual.about_title} onChange={(event) => patchVisual("about_title", event.target.value)} placeholder="Quem somos" /></Field>
            <Field label="Descrição"><Textarea rows={8} value={visual.about_description} onChange={(event) => patchVisual("about_description", event.target.value)} placeholder="Conte a história, os valores e o propósito da sua loja." /></Field>
            <Field label="Imagem da página">
              <ImageUpload value={visual.about_image_url} uploading={props.uploading === "about"} onFile={(file) => props.upload("about", "about", file)} onRemove={() => patchVisual("about_image_url", "")} variant="about" />
            </Field>
          </>}
          <div className="border-t border-border pt-5">
            <Toggle label="Exibir página Contato" checked={visual.contact_enabled} onChange={(checked) => patchVisual("contact_enabled", checked)} />
          </div>
          <Toggle label="Exibir nome da loja" checked={visual.header_show_store_name} onChange={(checked) => patchVisual("header_show_store_name", checked)} />
          <Toggle label="Centralizar logotipo" checked={visual.header_logo_centered} onChange={(checked) => patchVisual("header_logo_centered", checked)} />
          <SizeControl label="Largura do logotipo" value={visual.header_logo_size} minimum={24} maximum={160} onChange={(value) => patchVisual("header_logo_size", value)} />
          <div className="grid grid-cols-2 gap-2">
            <ColorField label="Fundo" value={visual.header_background_color} onChange={(value) => patchVisual("header_background_color", value)} />
            <ColorField label="Letras e ícones" value={visual.header_text_color} onChange={(value) => patchVisual("header_text_color", value)} />
          </div>
          <ScaleControl label="Transparência do fundo" value={visual.header_background_opacity} minimum={0} maximum={100} onChange={(value) => patchVisual("header_background_opacity", value)} />
          <Toggle label="Manter visível ao rolar" checked={visual.header_sticky} onChange={(checked) => patchVisual("header_sticky", checked)} />
        </>}

        {section === "footer" && <>
          <Field label="WhatsApp"><Input value={store.whatsapp} onChange={(event) => patchStore("whatsapp", event.target.value)} placeholder="(11) 99999-9999" /></Field>
          <Field label="Instagram"><Input value={store.instagram} onChange={(event) => patchStore("instagram", event.target.value)} placeholder="@sualoja" /></Field>
          <Field label="E-mail"><Input type="email" value={store.email} onChange={(event) => patchStore("email", event.target.value)} /></Field>
        </>}

        {section === "advanced" && <SectionOrder order={visual.section_order} onChange={(order) => patchVisual("section_order", order)} />}
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) { return <div className="space-y-2"><Label className="text-[12px]">{label}</Label>{children}</div>; }
function Toggle({ label, checked, onChange }: { label: string; checked: boolean; onChange: (checked: boolean) => void }) { return <div className="flex items-center justify-between gap-4 rounded-md border border-border px-3 py-3"><span className="text-[12px] font-medium">{label}</span><Switch checked={checked} onCheckedChange={onChange} /></div>; }

function ColorField({ label, value, onChange }: { label?: string; value: string; onChange: (value: string) => void }) {
  const [draft, setDraft] = useState(value.toUpperCase());

  useEffect(() => {
    setDraft(value.toUpperCase());
  }, [value]);

  const updateColor = (nextValue: string) => {
    const nextDraft = nextValue.toUpperCase();
    setDraft(nextDraft);
    if (/^#[0-9A-F]{6}$/.test(nextDraft)) onChange(nextDraft.toLowerCase());
  };

  return (
    <div className="rounded-md border border-border bg-white p-2">
      <label className="flex cursor-pointer items-center gap-2">
        <input
          type="color"
          value={value}
          onInput={(event) => updateColor(event.currentTarget.value)}
          onChange={(event) => updateColor(event.currentTarget.value)}
          className="h-8 w-9 shrink-0 cursor-pointer border-0 bg-transparent p-0"
          aria-label={`Selecionar ${label?.toLowerCase() ?? "cor"}`}
        />
        <span className="block text-[11px] font-medium">{label ?? "Cor"}</span>
      </label>
      <input
        type="text"
        value={draft}
        maxLength={7}
        spellCheck={false}
        onChange={(event) => updateColor(event.target.value)}
        onBlur={() => {
          if (!/^#[0-9A-F]{6}$/.test(draft)) setDraft(value.toUpperCase());
        }}
        aria-label={`Código da cor ${label?.toLowerCase() ?? "selecionada"}`}
        className="mt-2 h-8 w-full rounded border border-border bg-neutral-50 px-2 font-mono text-[11px] uppercase text-foreground outline-none focus:border-foreground/40"
      />
    </div>
  );
}

function Segmented({ value, options, onChange }: { value: string; options: [string, string][]; onChange: (value: string) => void }) {
  return <div className="grid grid-cols-2 rounded-md border border-border bg-muted p-1">{options.map(([id, label]) => <button key={id} type="button" onClick={() => onChange(id)} className={cn("rounded px-2 py-2 text-[11px] font-medium", value === id ? "bg-white shadow-sm" : "text-muted-foreground")}>{label}</button>)}</div>;
}

function FontSelector({ label, value, onChange }: { label: string; value: StoreFont; onChange: (value: StoreFont) => void }) {
  const selected = fontOptions.find((option) => option.value === value) ?? fontOptions[0];
  return <Field label={label}><Select value={value} onValueChange={(nextValue) => onChange(nextValue as StoreFont)}><SelectTrigger className="h-11 bg-white text-[15px]" style={{ fontFamily: storeFontFamily(selected.value) }} aria-label={label}><span>{selected.label}</span></SelectTrigger><SelectContent className="max-h-80"><div className="py-1">{fontOptions.map((option) => <SelectItem key={option.value} value={option.value} className="h-12 border-b border-border/60 px-3 pr-9 text-[17px] last:border-b-0" style={{ fontFamily: storeFontFamily(option.value) }}>{option.label}</SelectItem>)}</div></SelectContent></Select></Field>;
}

function ScaleControl({ label, value, minimum, maximum, onChange }: { label: string; value: number; minimum: number; maximum: number; onChange: (value: number) => void }) {
  const update = (nextValue: string) => onChange(Number(nextValue));
  return <Field label={label}><div className="rounded-md border border-border bg-white px-3 py-3"><div className="flex items-center gap-3"><input type="range" min={minimum} max={maximum} step={5} value={value} onInput={(event) => update(event.currentTarget.value)} onChange={(event) => update(event.currentTarget.value)} className="min-w-0 flex-1 accent-black" /><output className="w-11 text-right text-[11px] font-semibold tabular-nums">{value}%</output></div><div className="mt-1 flex justify-between text-[10px] text-muted-foreground"><span>Menor</span><span>Maior</span></div></div></Field>;
}

function SizeControl({ label, value, minimum, maximum, onChange }: { label: string; value: number; minimum: number; maximum: number; onChange: (value: number) => void }) {
  const update = (nextValue: string) => onChange(Number(nextValue));
  return <Field label={label}><div className="rounded-md border border-border bg-white px-3 py-3"><div className="flex items-center gap-3"><input type="range" min={minimum} max={maximum} step={4} value={value} onInput={(event) => update(event.currentTarget.value)} onChange={(event) => update(event.currentTarget.value)} className="min-w-0 flex-1 accent-black" /><output className="w-12 text-right text-[11px] font-semibold tabular-nums">{value}px</output></div><div className="mt-1 flex justify-between text-[10px] text-muted-foreground"><span>Menor</span><span>Maior</span></div></div></Field>;
}

function ImageUpload({ value, uploading, onFile, onRemove, variant = "logo" }: { value: string; uploading: boolean; onFile: (file: File) => void; onRemove: () => void; variant?: "logo" | "favicon" | "banner" | "about" }) {
  const [dimensionWarning, setDimensionWarning] = useState("");

  const selectFile = async (file: File) => {
    setDimensionWarning("");
    if (variant === "banner" || variant === "about") {
      try {
        const dimensions = await readImageDimensions(file);
        const minimumWidth = variant === "banner" ? 1920 : 1200;
        const minimumHeight = variant === "banner" ? 800 : 900;
        if (dimensions.width < minimumWidth || dimensions.height < minimumHeight) {
          setDimensionWarning(
            `Sua imagem tem ${dimensions.width} x ${dimensions.height} px. Recomendamos pelo menos ${minimumWidth} x ${minimumHeight} px para evitar perda de qualidade.`,
          );
        }
      } catch {
        setDimensionWarning(variant === "banner" ? "Não foi possível conferir o tamanho da imagem. Verifique se ela tem pelo menos 1920 x 800 px." : "Não foi possível conferir o tamanho da imagem. Verifique se ela tem pelo menos 1200 x 900 px.");
      }
    }
    onFile(file);
  };

  return (
    <div>
      <div className="overflow-hidden rounded-md border border-border">
        <div className={cn("grid place-items-center bg-neutral-50", variant === "banner" ? "aspect-[12/5]" : variant === "about" ? "aspect-[4/3]" : "h-28")}>
          {value ? <img src={value} alt="" className={cn(variant === "about" ? "object-cover" : "object-contain", variant === "favicon" ? "h-16 w-16" : "h-full w-full")} /> : <ImageIcon className="h-7 w-7 text-muted-foreground" />}
        </div>
        <div className="flex items-center gap-2 border-t border-border p-2">
          <label className="inline-flex cursor-pointer items-center gap-2 rounded-md border border-border px-3 py-2 text-[11px] font-medium">
            <input type="file" accept="image/png,image/jpeg,image/webp" className="hidden" onChange={(event) => { const file = event.target.files?.[0]; if (file) void selectFile(file); event.target.value = ""; }} />
            {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <UploadCloud className="h-4 w-4" />}
            {value ? "Trocar imagem" : "Enviar imagem"}
          </label>
          {value && <button type="button" onClick={onRemove} className="text-[11px] text-red-600">Remover</button>}
        </div>
      </div>
      {variant === "banner" && (
        <div className="mt-2 rounded-md border border-blue-100 bg-blue-50 px-3 py-2 text-[11px] leading-relaxed text-blue-800">
          Tamanho recomendado: <strong>1920 x 800 px</strong> (proporção 12:5). Use JPG, PNG ou WebP e mantenha textos importantes no centro.
        </div>
      )}
      {variant === "favicon" && (
        <div className="mt-2 rounded-md border border-blue-100 bg-blue-50 px-3 py-2 text-[11px] leading-relaxed text-blue-800">
          Tamanho recomendado: <strong>130 x 130 px</strong>. Use uma imagem quadrada em PNG, JPG ou WebP.
        </div>
      )}
      {variant === "about" && (
        <div className="mt-2 rounded-md border border-blue-100 bg-blue-50 px-3 py-2 text-[11px] leading-relaxed text-blue-800">
          Tamanho recomendado: <strong>1200 x 900 px</strong> (proporção 4:3). Use JPG, PNG ou WebP.
        </div>
      )}
      {dimensionWarning && <div className="mt-2 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-[11px] leading-relaxed text-amber-800">{dimensionWarning}</div>}
    </div>
  );
}

function BannerEditor({ banner, index, total, products, categories, uploading, patch, remove, move, upload }: { banner: StoreBanner; index: number; total: number; products: ProductRecord[]; categories: Category[]; uploading: boolean; patch: ControlsProps["patchBanner"]; remove: () => void; move: (direction: -1 | 1) => void; upload: (file: File) => void }) {
  const [editing, setEditing] = useState(!banner.image_url);
  const previousImage = useRef(banner.image_url);

  useEffect(() => {
    if (!previousImage.current && banner.image_url) setEditing(false);
    previousImage.current = banner.image_url;
  }, [banner.image_url]);

  const destinationLabel =
    banner.link_type === "store_home" ? "Página inicial da loja" :
    banner.link_type === "home" ? "Lista de produtos" :
    banner.link_type === "product" ? products.find((product) => product.id === banner.link_target)?.name || "Produto não selecionado" :
    banner.link_type === "category" ? categories.find((category) => category.slug === banner.link_target)?.name || "Categoria não selecionada" :
    banner.link_target || "Link externo não informado";

  return (
    <div className="overflow-hidden rounded-md border border-border bg-white">
      {banner.image_url && <img src={banner.image_url} alt="" className="aspect-[12/5] w-full object-cover" />}
      <div className="p-3">
        <div className="flex items-start gap-2">
          <span className={cn("mt-1.5 h-2 w-2 shrink-0 rounded-full", banner.active ? "bg-emerald-500" : "bg-neutral-300")} />
          <div className="min-w-0 flex-1">
            <div className="truncate text-[12px] font-semibold">{banner.title || `Banner ${index + 1}`}</div>
            <div className="mt-0.5 truncate text-[10px] text-muted-foreground">Destino: {destinationLabel}</div>
          </div>
          <span className="text-[10px] text-muted-foreground">{index + 1}/{total}</span>
        </div>

        {!banner.image_url ? (
          <div className="mt-3">
            <ImageUpload value="" uploading={uploading} onFile={upload} onRemove={() => undefined} variant="banner" />
          </div>
        ) : editing ? (
          <div className="mt-4 space-y-3 border-t border-border pt-4">
            <ImageUpload value={banner.image_url} uploading={uploading} onFile={upload} onRemove={() => patch(banner.id, "image_url", "")} variant="banner" />
            <Field label="Título"><Input value={banner.title} onChange={(event) => patch(banner.id, "title", event.target.value)} /></Field>
            <Field label="Descrição"><Textarea value={banner.subtitle} onChange={(event) => patch(banner.id, "subtitle", event.target.value)} /></Field>
            <Field label="Texto do botão"><Input value={banner.button_label} onChange={(event) => patch(banner.id, "button_label", event.target.value)} /></Field>
            <Field label="Direcionar cliente para">
              <select value={banner.link_type} onChange={(event) => { patch(banner.id, "link_type", event.target.value as StoreBannerLinkType); patch(banner.id, "link_target", ""); }} className="h-9 w-full rounded-md border border-input bg-white px-3 text-[12px]">
                <option value="store_home">Página inicial da loja</option>
                <option value="home">Lista de todos os produtos</option>
                <option value="product">Um produto específico</option>
                <option value="category">Uma categoria de produtos</option>
                <option value="external">Um link externo</option>
              </select>
            </Field>
            {banner.link_type === "product" && <Field label="Escolha o produto"><select value={banner.link_target} onChange={(event) => patch(banner.id, "link_target", event.target.value)} className="h-9 w-full rounded-md border border-input bg-white px-3 text-[12px]"><option value="">Selecione um produto</option>{products.map((product) => <option key={product.id} value={product.id}>{product.name}</option>)}</select></Field>}
            {banner.link_type === "category" && <Field label="Escolha a categoria"><select value={banner.link_target} onChange={(event) => patch(banner.id, "link_target", event.target.value)} className="h-9 w-full rounded-md border border-input bg-white px-3 text-[12px]"><option value="">Selecione uma categoria</option>{categories.map((category) => <option key={category.id} value={category.slug}>{category.name}</option>)}</select></Field>}
            {banner.link_type === "external" && <Field label="Link externo"><Input value={banner.link_target} onChange={(event) => patch(banner.id, "link_target", event.target.value)} placeholder="https://" /></Field>}
            <Toggle label="Banner ativo" checked={banner.active} onChange={(checked) => patch(banner.id, "active", checked)} />
            <Button type="button" className="w-full" onClick={() => setEditing(false)}><Check /> Concluir edição</Button>
          </div>
        ) : (
          <div className="mt-3 flex items-center gap-2">
            <Button type="button" size="sm" variant="outline" className="flex-1" onClick={() => setEditing(true)}><Settings2 /> Editar</Button>
            <Button type="button" size="icon" variant="outline" disabled={index === 0} onClick={() => move(-1)} title="Mover para cima"><ArrowUp /></Button>
            <Button type="button" size="icon" variant="outline" disabled={index === total - 1} onClick={() => move(1)} title="Mover para baixo"><ArrowDown /></Button>
            <Button type="button" size="icon" variant="ghost" onClick={remove} title="Remover banner" className="text-red-600"><Trash2 /></Button>
          </div>
        )}
      </div>
    </div>
  );
}

function readImageDimensions(file: File) {
  return new Promise<{ width: number; height: number }>((resolve, reject) => {
    const imageUrl = URL.createObjectURL(file);
    const image = new Image();
    image.onload = () => {
      resolve({ width: image.naturalWidth, height: image.naturalHeight });
      URL.revokeObjectURL(imageUrl);
    };
    image.onerror = () => {
      reject(new Error("Não foi possível ler as dimensões da imagem."));
      URL.revokeObjectURL(imageUrl);
    };
    image.src = imageUrl;
  });
}

const sectionLabels: Record<CatalogSection, string> = { banner: "Banner", description: "Descrição", categories: "Categorias", featured: "Destaques", products: "Produtos", promos: "Promoções" };
function SectionOrder({ order, onChange }: { order: CatalogSection[]; onChange: (order: CatalogSection[]) => void }) {
  return <div><p className="mb-3 text-[12px] leading-relaxed text-muted-foreground">Defina a sequência das seções na página inicial.</p><div className="space-y-2">{order.map((section, index) => <div key={section} className="flex items-center gap-2 rounded-md border border-border p-2"><span className="min-w-0 flex-1 text-[12px] font-medium">{sectionLabels[section]}</span><Button size="icon" variant="ghost" disabled={index === 0} onClick={() => onChange(moveItem(order, index, -1))}><ArrowUp /></Button><Button size="icon" variant="ghost" disabled={index === order.length - 1} onClick={() => onChange(moveItem(order, index, 1))}><ArrowDown /></Button></div>)}</div></div>;
}

function moveItem<T>(items: T[], index: number, direction: -1 | 1) {
  const target = index + direction;
  if (target < 0 || target >= items.length) return items;
  const next = items.slice();
  [next[index], next[target]] = [next[target], next[index]];
  return next;
}

function StorefrontPreview({ store, visual, banners, products, device, showAboutPage }: { store: GeneralSettingsForm; visual: CatalogVisualSettings; banners: StoreBanner[]; products: ProductRecord[]; device: PreviewDevice; showAboutPage: boolean }) {
  const activeBanner = banners.find((banner) => banner.active && banner.image_url) ?? banners.find((banner) => banner.active);
  const shownProducts = products.filter((product) => product.status === "active").slice(0, device === "mobile" ? 4 : 8);
  const fallbackProducts = shownProducts.length ? shownProducts : Array.from({ length: device === "mobile" ? 4 : 8 }, (_, index) => ({ id: String(index), name: ["Produto essencial", "Nova coleção", "Mais vendido", "Oferta especial"][index % 4], price: 89.9 + index * 20, promo_price: null, primary_image: null } as ProductRecord));
  const editorial = visual.catalog_style === "editorial";
  const elegant = visual.catalog_style === "elegant";
  const commercial = visual.catalog_style === "commercial";
  const radius = editorial ? "0px" : elegant ? "6px" : "4px";
  const previewHeaderBackground = colorWithOpacity(visual.header_background_color, visual.header_background_opacity);
  const previewBrand = <div className="flex min-w-0 items-center gap-3">{store.logo_url ? <span className="flex h-14 shrink-0 items-center justify-center" style={{ width: visual.header_logo_size }}><img src={store.logo_url} alt="" className="h-full w-full object-contain" /></span> : <div className="grid h-14 shrink-0 place-items-center" style={{ width: visual.header_logo_size }}><span className="grid h-14 w-14 place-items-center border border-current text-[11px] font-bold">V</span></div>}{visual.header_show_store_name && <span className={cn("truncate text-[16px] font-semibold", elegant && "text-[20px]", editorial && "text-[22px] font-normal")}>{store.name || "Minha loja"}</span>}</div>;
  const previewNav = device === "desktop" && <nav className="flex items-center justify-center gap-8 text-[12px] opacity-75"><span>Início</span><span>{visual.header_categories_label || "Categorias"}</span>{visual.about_enabled && <span>{visual.about_menu_label || "Quem somos"}</span>}{visual.contact_enabled && <span>Contato</span>}</nav>;
  const previewActions = <div className="flex justify-end gap-2"><div className="h-8 w-8 rounded-full border border-current/20" /><div className="h-8 w-8 rounded-full border border-current/20" /></div>;
  return <div style={{ backgroundColor: visual.background_color, color: visual.primary_color, "--shop-primary": visual.primary_color, "--shop-secondary": visual.secondary_color, "--shop-button": visual.button_color, "--shop-button-hover": visual.button_hover_color, "--shop-button-text": visual.button_text_color, "--shop-radius": radius, "--store-heading-font": storeFontFamily(visual.heading_font), "--store-body-font": storeFontFamily(visual.body_font), "--store-heading-scale": visual.heading_scale / 100, "--store-body-size": `${14 * (visual.body_scale / 100)}px` } as CSSProperties} className="storefront-typography min-h-[760px]">
    {commercial && <div className="bg-[var(--shop-button)] px-4 py-2 text-center text-[10px] font-bold uppercase text-[var(--shop-button-text)]">Catálogo atualizado • Compre pelo WhatsApp</div>}
    <header className={cn("z-20 border-b border-black/10", visual.header_sticky && "sticky top-0")} style={{ backgroundColor: previewHeaderBackground, color: visual.header_text_color }}>
      {visual.header_logo_centered ? <><div className={cn("grid h-20 grid-cols-[1fr_auto_1fr] items-center gap-3 px-5", device === "desktop" && "px-10")}><div className="h-8 w-8 rounded-full border border-current/20" />{previewBrand}{previewActions}</div>{previewNav && <div className="border-t border-current/10 px-10 py-3">{previewNav}</div>}</> : <div className={cn("flex h-20 items-center justify-between gap-5 px-5", device === "desktop" && "px-10")}>{previewBrand}{previewNav}{previewActions}</div>}
    </header>

    {showAboutPage ? <main className={cn("mx-auto max-w-6xl px-5 py-12", device === "desktop" && "px-10 py-16")}>
      <h1 className={cn("text-center text-[32px] font-semibold leading-tight", device === "desktop" && "text-[44px]")}>{visual.about_title || "Quem somos"}</h1>
      <div className={cn("mt-10 items-center gap-10", visual.about_image_url && device === "desktop" ? "grid grid-cols-2" : "mx-auto max-w-2xl")}>
        {visual.about_image_url && <div className="aspect-[4/3] overflow-hidden rounded-md bg-black/5"><img src={visual.about_image_url} alt="" className="h-full w-full object-cover" /></div>}
        <p className={cn("whitespace-pre-line text-[14px] leading-7 text-[var(--shop-secondary)]", visual.about_image_url && device === "mobile" ? "mt-7" : !visual.about_image_url && "text-center")}>{visual.about_description || `Conheça a história e o propósito da ${store.name || "nossa loja"}.`}</p>
      </div>
    </main> : <>
    {visual.show_banner && <section className={cn("relative overflow-hidden bg-black/5", device === "mobile" ? "min-h-72" : "min-h-[360px]", editorial && device === "desktop" && "grid grid-cols-2")}>
      {activeBanner?.image_url ? <img src={activeBanner.image_url} alt="" className={cn("absolute inset-0 h-full w-full object-cover", editorial && device === "desktop" && "relative col-start-2")} /> : <div className={cn("absolute inset-0 bg-neutral-200", editorial && device === "desktop" && "relative col-start-2")} />}
      <div className={cn("absolute inset-0 bg-black/30", editorial && device === "desktop" && "right-1/2 bg-white")} />
      <div className={cn("absolute inset-x-5 bottom-8 max-w-xl text-white", device === "desktop" && "inset-x-10 bottom-12", editorial && device === "desktop" && "left-10 right-[55%] top-1/2 -translate-y-1/2 text-[var(--shop-primary)]")}><h1 className={cn("text-[30px] font-semibold leading-tight", device === "desktop" && "text-[44px]", elegant && "font-serif font-normal", commercial && "font-sans font-black uppercase")}>{activeBanner?.title || "Descubra a nova coleção"}</h1><p className="mt-3 max-w-md text-[13px] leading-relaxed opacity-90">{activeBanner?.subtitle || "Produtos escolhidos para combinar com o estilo da sua loja."}</p><button type="button" className="mt-5 rounded-[var(--shop-radius)] bg-[var(--shop-button)] px-5 py-3 text-[11px] font-semibold text-[var(--shop-button-text)] transition-colors hover:bg-[var(--shop-button-hover)]">{activeBanner?.button_label || "Ver produtos"}</button></div>
    </section>}

    <main className={cn("mx-auto max-w-6xl space-y-10 px-5 py-8", device === "desktop" && "px-10 py-12")}>
      {visual.show_description && <section className={cn("mx-auto max-w-2xl text-center", editorial && "border-y border-black/20 py-8 text-left")}><h2 className="text-[20px] font-semibold">Bem-vindo à {store.name || "nossa loja"}</h2><p className="mt-3 text-[13px] leading-relaxed text-[var(--shop-secondary)]">{stripHtml(store.description) || "Use este espaço para apresentar sua marca e contar aos clientes o que torna seus produtos especiais."}</p></section>}
      {visual.show_categories && <section><SectionTitle>Categorias</SectionTitle><div className={cn("grid gap-3", device === "mobile" ? "grid-cols-2" : "grid-cols-4")}>{["Novidades", "Mais vendidos", "Promoções", "Coleções"].map((name) => <div key={name} className="border border-black/10 bg-white/50 px-4 py-5 text-center text-[12px] font-medium">{name}</div>)}</div></section>}
      <section><SectionTitle>{visual.show_featured ? "Produtos em destaque" : "Produtos"}</SectionTitle><div className={cn(visual.product_layout === "list" ? "grid gap-3" : "grid gap-4", visual.product_layout === "grid" && (device === "mobile" ? "grid-cols-2" : visual.product_card_style === "compact" ? "grid-cols-4" : "grid-cols-3"))}>{fallbackProducts.map((product) => <div key={product.id} className={cn("bg-white/70", visual.product_layout === "list" ? "flex items-center gap-4 border border-black/10 p-3" : commercial ? "border border-black/10 p-2 shadow-sm" : "p-0")}><div className={cn("overflow-hidden bg-neutral-100", visual.product_layout === "list" ? "h-20 w-20 shrink-0" : visual.product_card_style === "compact" ? "aspect-square" : "aspect-[4/5]")} style={{ borderRadius: radius }}>{product.primary_image ? <img src={product.primary_image} alt="" className="h-full w-full object-cover" /> : <div className="grid h-full place-items-center"><ImageIcon className="h-6 w-6 text-neutral-300" /></div>}</div><div className={cn("min-w-0", visual.product_layout === "grid" && "py-3")}><div className="truncate text-[12px] font-medium">{product.name}</div>{visual.show_price && <div className="mt-1 text-[12px] text-[var(--shop-secondary)]">{formatCurrency(product.promo_price ?? product.price)}</div>}{visual.show_whatsapp_button && <button type="button" className="mt-3 rounded-[var(--shop-radius)] bg-[var(--shop-button)] px-3 py-2 text-[10px] font-semibold text-[var(--shop-button-text)] transition-colors hover:bg-[var(--shop-button-hover)]">Comprar</button>}</div></div>)}</div></section>
    </main>
    </>}
    <footer className="mt-10 border-t border-black/10 px-5 py-8 text-[11px] text-[var(--shop-secondary)]"><div className={cn("mx-auto flex max-w-6xl gap-3", device === "mobile" ? "flex-col" : "items-center justify-between")}><strong className="text-[var(--shop-primary)]">{store.name || "Minha loja"}</strong><span>{[store.whatsapp, store.email, store.instagram && `@${store.instagram.replace(/^@/, "")}`].filter(Boolean).join(" • ") || "Contato da loja"}</span></div></footer>
  </div>;
}

function SectionTitle({ children }: { children: ReactNode }) { return <h2 className="mb-4 text-[16px] font-semibold">{children}</h2>; }
function stripHtml(value: string) { return value.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim(); }
function formatCurrency(value: number) { return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value); }
function colorWithOpacity(color: string, opacity: number) {
  const alpha = Math.round((Math.min(100, Math.max(0, opacity)) / 100) * 255).toString(16).padStart(2, "0");
  return `${color}${alpha}`;
}
