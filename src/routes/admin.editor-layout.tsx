import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowDown,
  ArrowLeft,
  ArrowUp,
  Check,
  ChevronRight,
  ExternalLink,
  Eye,
  FileText,
  ImageIcon,
  LayoutGrid,
  Loader2,
  Monitor,
  Palette,
  PanelTop,
  Pencil,
  Plus,
  RotateCcw,
  Smartphone,
  Sparkles,
  Store,
  Trash2,
  Type,
  UploadCloud,
} from "lucide-react";
import { useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { listCategories, listProducts, type Category, type ProductRecord } from "@/lib/products";
import {
  defaultCatalogVisualSettings,
  getCatalogVisualSettings,
  getGeneralSettings,
  listStoreBanners,
  normalizeCatalogVisualSettings,
  saveStoreBanners,
  storeFontFamily,
  updateCatalogVisualSettings,
  updateGeneralSettings,
  uploadStoreBranding,
  type CatalogVisualSettings,
  type GeneralSettingsForm,
  type StoreBanner,
  type StoreBannerLinkType,
  type StoreFont,
} from "@/lib/store-settings";
import { matchingTheme, storeThemes, type StoreTheme } from "@/lib/store-themes";
import { useStoreContext } from "@/lib/store-context";
import { isFrameMessage, sendPreviewUpdate, type PreviewDevice, type PreviewOverrides } from "@/lib/storefront-preview";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/admin/editor-layout")({
  head: () => ({
    meta: [
      { title: "Personalizar loja - VYNKA" },
      { name: "description", content: "Mude a aparência da sua loja e veja na hora." },
    ],
  }),
  component: LayoutEditor,
});

// Personalização da loja (escopo do catálogo, §3). Agrupada por "o que eu quero fazer", do mais
// usado para o menos usado. Tamanhos e espaçamentos são fixos; o lojista mexe em cor, fonte,
// imagem e texto.
type EditorSection = "themes" | "brand" | "colors" | "typography" | "home" | "header" | "pages";

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
  { id: "themes", title: "Temas prontos", description: "Cores e letras combinando em 1 clique", icon: Sparkles },
  { id: "brand", title: "Logo e apresentação", description: "Logo, ícone da aba e texto da loja", icon: Store },
  { id: "home", title: "Página inicial", description: "Banners e o que aparece no início", icon: LayoutGrid },
  { id: "colors", title: "Cores", description: "Ajuste cada cor da loja", icon: Palette },
  { id: "typography", title: "Letras", description: "Fonte dos títulos e dos textos", icon: Type },
  { id: "header", title: "Cabeçalho", description: "Topo da loja ao rolar a página", icon: PanelTop },
  { id: "pages", title: "Páginas", description: "Quem somos e Contato", icon: FileText },
];

type ColorKey =
  | "header_background_color"
  | "background_color"
  | "primary_color"
  | "secondary_color"
  | "button_color"
  | "button_text_color";

const colorFields: { key: ColorKey; label: string; help: string }[] = [
  { key: "header_background_color", label: "Cabeçalho e rodapé", help: "Fundo do topo e do fim da loja. A cor das letras ali se ajusta sozinha." },
  { key: "background_color", label: "Fundo", help: "Fundo das páginas da loja." },
  { key: "primary_color", label: "Títulos", help: "Nome dos produtos, títulos e preços." },
  { key: "secondary_color", label: "Textos", help: "Descrições e textos menores." },
  { key: "button_color", label: "Botões", help: "Botões como \"Adicionar ao carrinho\". Ao passar o mouse, a cor muda sozinha." },
  { key: "button_text_color", label: "Letra dos botões", help: "Cor do texto escrito dentro dos botões." },
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
  const [activeSection, setActiveSection] = useState<EditorSection>("themes");
  const [device, setDevice] = useState<PreviewDevice>("mobile");
  // No celular, controles e prévia não cabem lado a lado: um botão alterna entre os dois.
  const [mobileView, setMobileView] = useState<"edit" | "preview">("edit");
  const [store, setStore] = useState<GeneralSettingsForm>(emptyStore);
  const [visual, setVisual] = useState<CatalogVisualSettings>(defaultCatalogVisualSettings);
  const [banners, setBanners] = useState<StoreBanner[]>([]);
  const [uploading, setUploading] = useState<string | null>(null);
  const [published, setPublished] = useState(false);
  const [saveError, setSaveError] = useState("");
  // Muda a cada publicação, para o aviso "não publicadas" recalcular contra o que foi gravado.
  const [savedVersion, setSavedVersion] = useState(0);
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [store, visual, banners, savedVersion]);

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
      setSavedVersion((version) => version + 1);
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
  const applyTheme = (theme: StoreTheme) =>
    setVisual((current) => ({
      ...current,
      ...theme.colors,
      heading_font: theme.heading_font,
      body_font: theme.body_font,
    }));

  const addBanner = () => {
    setBanners((current) => [...current, {
      id: crypto.randomUUID(),
      store_id: storeId,
      image_url: "",
      title: "",
      subtitle: "",
      button_label: "",
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
          <Button asChild variant="ghost" size="icon" title="Voltar para Loja e Catálogo">
            <a href="/admin/configuracoes?aba=personalizar"><ArrowLeft /></a>
          </Button>
          <div className="min-w-0">
            <div className="truncate text-[14px] font-semibold">Personalizar loja</div>
            <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
              <span className={cn("h-1.5 w-1.5 rounded-full", dirty ? "bg-amber-500" : "bg-emerald-500")} />
              {dirty ? "Mudanças ainda não publicadas" : "Tudo publicado"}
            </div>
          </div>
        </div>

        <div className="hidden items-center rounded-md border border-border bg-muted p-1 lg:flex">
          <DeviceButton active={device === "mobile"} onClick={() => setDevice("mobile")} icon={Smartphone}>Celular</DeviceButton>
          <DeviceButton active={device === "desktop"} onClick={() => setDevice("desktop")} icon={Monitor}>Computador</DeviceButton>
        </div>

        <div className="flex items-center gap-2">
          <Button asChild variant="ghost" className="hidden md:inline-flex">
            <a href={publicHref} target="_blank" rel="noreferrer"><ExternalLink /> Ver loja</a>
          </Button>
          <Button variant="outline" onClick={discardChanges} disabled={!dirty || publishMutation.isPending} className="hidden sm:inline-flex">
            <RotateCcw /> Desfazer
          </Button>
          <Button onClick={() => publishMutation.mutate()} disabled={!dirty || publishMutation.isPending}>
            {publishMutation.isPending ? <Loader2 className="animate-spin" /> : published ? <Check /> : null}
            {published ? "Publicado" : "Publicar"}
          </Button>
        </div>
      </header>

      <main className="grid min-h-[calc(100svh-4rem)] lg:h-[calc(100svh-4rem)] lg:grid-cols-[380px_minmax(0,1fr)]">
        <aside className={cn("border-r border-border bg-white pb-24 lg:block lg:overflow-y-auto lg:pb-0", mobileView === "preview" && "hidden")}>
          <nav className="border-b border-border p-3">
            {editorSections.map((section) => {
              const Icon = section.icon;
              return (
                <button
                  key={section.id}
                  type="button"
                  onClick={() => setActiveSection(section.id)}
                  className={cn("flex min-h-11 w-full items-center gap-3 rounded-md px-3 py-2.5 text-left transition-colors", activeSection === section.id ? "bg-neutral-100 text-foreground" : "text-muted-foreground hover:bg-neutral-50 hover:text-foreground")}
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
              applyTheme={applyTheme}
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

        <section className={cn("flex min-h-[calc(100svh-4rem)] min-w-0 flex-col p-3 pb-24 sm:p-6 lg:h-full lg:min-h-0 lg:p-8", mobileView === "edit" && "hidden lg:flex")}>
          <div className="mb-3 flex items-center justify-center gap-2 lg:hidden">
            <DeviceButton active={device === "mobile"} onClick={() => setDevice("mobile")} icon={Smartphone}>Celular</DeviceButton>
            <DeviceButton active={device === "desktop"} onClick={() => setDevice("desktop")} icon={Monitor}>Computador</DeviceButton>
          </div>
          {store.slug ? (
            <LivePreview
              slug={store.slug}
              device={device}
              visible={mobileView === "preview"}
              overrides={{
                device,
                name: store.name,
                description: store.description,
                logo_url: store.logo_url,
                favicon_url: store.favicon_url,
                visual,
                banners,
              }}
              onLogoSize={(target, height) =>
                patchVisual(target === "mobile" ? "header_logo_height_mobile" : "header_logo_height_desktop", height)
              }
            />
          ) : (
            <div className="grid flex-1 place-items-center text-[13px] text-muted-foreground">Defina o link da loja em Loja e Catálogo para ver a prévia.</div>
          )}
        </section>
      </main>

      <div className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-white p-3 lg:hidden">
        <Button type="button" variant="outline" className="h-11 w-full" onClick={() => setMobileView((view) => (view === "edit" ? "preview" : "edit"))}>
          {mobileView === "edit" ? <><Eye /> Ver prévia</> : <><Pencil /> Voltar a editar</>}
        </Button>
      </div>
    </div>
  );
}

function DeviceButton({ active, onClick, icon: Icon, children }: { active: boolean; onClick: () => void; icon: typeof Monitor; children: ReactNode }) {
  return <button type="button" onClick={onClick} className={cn("inline-flex h-9 items-center gap-2 rounded px-3 text-[12px] font-medium", active ? "bg-white text-foreground shadow-sm ring-1 ring-border" : "text-muted-foreground")}><Icon className="h-4 w-4" />{children}</button>;
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
  applyTheme: (theme: StoreTheme) => void;
  setBanners: React.Dispatch<React.SetStateAction<StoreBanner[]>>;
  addBanner: () => void;
  upload: (targetId: string, kind: "logo" | "favicon" | "banner" | "about", file: File) => void;
};

function EditorControls(props: ControlsProps) {
  const { section, store, visual, banners, products, categories, patchStore, patchVisual } = props;
  const current = editorSections.find((item) => item.id === section);
  const defaults = defaultCatalogVisualSettings;
  const currentTheme = matchingTheme(visual);
  return (
    <div>
      <h2 className="text-[15px] font-semibold">{current?.title}</h2>
      <div className="mt-5 space-y-5">
        {section === "themes" && <>
          <Help>Escolha uma combinação pronta de cores e letras. Depois dá para ajustar qualquer cor em "Cores" e as letras em "Letras".</Help>
          <div className="grid grid-cols-2 gap-3">
            {storeThemes.map((theme) => <ThemeCard key={theme.id} theme={theme} active={currentTheme?.id === theme.id} onClick={() => props.applyTheme(theme)} />)}
          </div>
          {!currentTheme && <Help>Sua loja está com cores ou letras ajustadas por você.</Help>}
        </>}

        {section === "brand" && <>
          <Field label="Nome da loja" help="Aparece no topo quando a loja não tem logo, e na aba do navegador."><Input value={store.name} onChange={(event) => patchStore("name", event.target.value)} /></Field>
          <Field label="Logo" help="Com logo, o topo da loja mostra só o logo. Sem logo, mostra o nome. Para mudar o tamanho, clique no logo na prévia.">
            <ImageUpload value={store.logo_url} uploading={props.uploading === "logo"} onFile={(file) => props.upload("logo", "logo", file)} onRemove={() => patchStore("logo_url", "")} />
          </Field>
          <Field label="Ícone da aba do navegador" help="A imagem pequena que aparece na aba, ao lado do nome da loja.">
            <ImageUpload value={store.favicon_url} uploading={props.uploading === "favicon"} onFile={(file) => props.upload("favicon", "favicon", file)} onRemove={() => patchStore("favicon_url", "")} variant="favicon" />
          </Field>
          <Field label="Apresentação da loja" help="Texto curto sobre a loja. Aparece no rodapé e no início quando não há banner."><Textarea rows={5} value={store.description} onChange={(event) => patchStore("description", event.target.value)} /></Field>
        </>}

        {section === "colors" && <>
          <Help>Toque na cor para trocar. "Padrão" volta a cor original.</Help>
          {colorFields.map((field) => (
            <ColorField
              key={field.key}
              label={field.label}
              help={field.help}
              value={visual[field.key]}
              onChange={(value) => patchVisual(field.key, value)}
              onReset={visual[field.key] === defaults[field.key] ? undefined : () => patchVisual(field.key, defaults[field.key])}
            />
          ))}
        </>}

        {section === "typography" && <>
          <FontSelector label="Letra dos títulos" help="Títulos, nome dos produtos e preços." value={visual.heading_font} onChange={(value) => patchVisual("heading_font", value)} onReset={visual.heading_font === defaults.heading_font ? undefined : () => patchVisual("heading_font", defaults.heading_font)} />
          <FontSelector label="Letra dos textos" help="Descrições, menus e textos menores." value={visual.body_font} onChange={(value) => patchVisual("body_font", value)} onReset={visual.body_font === defaults.body_font ? undefined : () => patchVisual("body_font", defaults.body_font)} />
          <div className="rounded-md border border-border bg-neutral-50 p-4">
            <div style={{ fontFamily: storeFontFamily(visual.heading_font) }} className="text-[20px] font-semibold leading-tight">Nova coleção</div>
            <p style={{ fontFamily: storeFontFamily(visual.body_font) }} className="mt-2 text-[13px] leading-relaxed text-muted-foreground">Veja aqui como os títulos e os textos ficam juntos.</p>
          </div>
        </>}

        {section === "home" && <>
          <div>
            <div className="mb-2 flex items-center justify-between">
              <span className="text-[13px] font-medium">Banners</span>
              <Button size="sm" variant="outline" onClick={props.addBanner}><Plus /> Adicionar</Button>
            </div>
            <Help>O banner é só a imagem: escreva o texto que quiser na própria arte. Eles passam sozinhos no topo da página inicial.</Help>
            <div className="mt-3 space-y-3">
              {banners.length === 0 ? (
                <button type="button" onClick={props.addBanner} className="w-full rounded-md border border-dashed border-border p-6 text-[12px] text-muted-foreground">Criar o primeiro banner</button>
              ) : banners.map((banner, index) => (
                <BannerEditor
                  key={banner.id}
                  banner={banner}
                  index={index}
                  total={banners.length}
                  products={products}
                  categories={categories}
                  visual={visual}
                  uploading={props.uploading === banner.id}
                  patch={props.patchBanner}
                  remove={() => props.setBanners((items) => items.filter((item) => item.id !== banner.id))}
                  move={(direction) => props.setBanners((items) => moveItem(items, index, direction))}
                  upload={(file) => props.upload(banner.id, "banner", file)}
                />
              ))}
            </div>
          </div>
          <div className="space-y-3 border-t border-border pt-5">
            <span className="text-[13px] font-medium">O que aparece na página inicial</span>
            <Toggle label="Banners" help="Desligado, o topo mostra a apresentação da loja." checked={visual.show_banner} onChange={(checked) => patchVisual("show_banner", checked)} />
            <Toggle label="Apresentação da loja" help="Aparece no topo quando não há banner." checked={visual.show_description} onChange={(checked) => patchVisual("show_description", checked)} />
            <Toggle label="Categorias" help="Atalhos para cada categoria de produtos." checked={visual.show_categories} onChange={(checked) => patchVisual("show_categories", checked)} />
            <Toggle label="Produtos em destaque" help="Os produtos marcados como destaque no cadastro." checked={visual.show_featured} onChange={(checked) => patchVisual("show_featured", checked)} />
          </div>
        </>}

        {section === "header" && <>
          <Toggle label="Manter o cabeçalho visível ao rolar a página" help="O topo com logo e carrinho continua aparecendo enquanto o cliente desce a página." checked={visual.header_sticky} onChange={(checked) => patchVisual("header_sticky", checked)} />
          <div className="space-y-2 rounded-md border border-border p-3">
            <span className="block text-[12px] font-medium">Tamanho do logo</span>
            <Help>{store.logo_url ? "Clique no logo na prévia e arraste as alças dos cantos. Ajuste com \"Celular\" e depois com \"Computador\": cada um guarda o seu tamanho. O logo nunca passa do espaço do topo." : "Envie o logo em \"Logo e apresentação\" para ajustar o tamanho."}</Help>
            <div className="grid grid-cols-2 gap-2 text-[12px]">
              <LogoSizeRow label="Celular" value={visual.header_logo_height_mobile} onReset={visual.header_logo_height_mobile === defaults.header_logo_height_mobile ? undefined : () => patchVisual("header_logo_height_mobile", defaults.header_logo_height_mobile)} />
              <LogoSizeRow label="Computador" value={visual.header_logo_height_desktop} onReset={visual.header_logo_height_desktop === defaults.header_logo_height_desktop ? undefined : () => patchVisual("header_logo_height_desktop", defaults.header_logo_height_desktop)} />
            </div>
          </div>
          <Help>A cor do cabeçalho fica em "Cores". A faixa de aviso no topo chega numa próxima versão.</Help>
        </>}

        {section === "pages" && <>
          <Toggle label="Página Quem somos" help="Conte a história da loja. O link aparece no menu." checked={visual.about_enabled} onChange={(checked) => patchVisual("about_enabled", checked)} />
          {visual.about_enabled && <>
            <Field label="Título da página"><Input value={visual.about_title} onChange={(event) => patchVisual("about_title", event.target.value)} /></Field>
            <Field label="Texto"><Textarea rows={8} value={visual.about_description} onChange={(event) => patchVisual("about_description", event.target.value)} /></Field>
            <Field label="Imagem da página">
              <ImageUpload value={visual.about_image_url} uploading={props.uploading === "about"} onFile={(file) => props.upload("about", "about", file)} onRemove={() => patchVisual("about_image_url", "")} variant="about" />
            </Field>
          </>}
          <div className="border-t border-border pt-5">
            <Toggle label="Página Contato" help="Mostra WhatsApp, Instagram, e-mail e endereço cadastrados em Loja e Catálogo." checked={visual.contact_enabled} onChange={(checked) => patchVisual("contact_enabled", checked)} />
          </div>
        </>}
      </div>
    </div>
  );
}

function Help({ children }: { children: ReactNode }) {
  return <p className="text-[12px] leading-relaxed text-muted-foreground">{children}</p>;
}

function Field({ label, help, children }: { label: string; help?: string; children: ReactNode }) {
  return <div className="space-y-2"><span className="block text-[12px] font-medium">{label}</span>{children}{help && <Help>{help}</Help>}</div>;
}

function Toggle({ label, help, checked, onChange }: { label: string; help?: string; checked: boolean; onChange: (checked: boolean) => void }) {
  return (
    <label className="flex cursor-pointer items-start justify-between gap-4 rounded-md border border-border px-3 py-3">
      <span className="min-w-0">
        <span className="block text-[12px] font-medium">{label}</span>
        {help && <span className="mt-0.5 block text-[11px] leading-relaxed text-muted-foreground">{help}</span>}
      </span>
      <Switch checked={checked} onCheckedChange={onChange} />
    </label>
  );
}

function LogoSizeRow({ label, value, onReset }: { label: string; value: number; onReset?: () => void }) {
  return (
    <div className="rounded border border-border bg-neutral-50 px-2 py-2">
      <div className="flex items-center justify-between gap-2"><span className="font-medium">{label}</span><ResetButton onClick={onReset} /></div>
      <div className="mt-0.5 text-muted-foreground">{value} px de altura</div>
    </div>
  );
}

function ResetButton({ onClick }: { onClick?: () => void }) {
  if (!onClick) return null;
  return <button type="button" onClick={onClick} className="inline-flex items-center gap-1 text-[11px] font-medium text-muted-foreground hover:text-foreground"><RotateCcw className="h-3 w-3" /> Padrão</button>;
}

function ThemeCard({ theme, active, onClick }: { theme: StoreTheme; active: boolean; onClick: () => void }) {
  const look = normalizeCatalogVisualSettings({ ...defaultCatalogVisualSettings, ...theme.colors });
  return (
    <button type="button" onClick={onClick} className={cn("overflow-hidden rounded-md border text-left transition-shadow", active ? "border-foreground ring-2 ring-foreground/15" : "border-border hover:shadow-sm")}>
      <div style={{ backgroundColor: look.background_color }}>
        <div className="px-2 py-1.5 text-[9px] font-semibold tracking-[0.14em]" style={{ backgroundColor: look.header_background_color, color: look.header_text_color, fontFamily: storeFontFamily(theme.heading_font) }}>LOJA</div>
        <div className="px-2 py-2.5">
          <div className="text-[13px] font-semibold leading-tight" style={{ color: look.primary_color, fontFamily: storeFontFamily(theme.heading_font) }}>Nova coleção</div>
          <div className="mt-1 text-[10px]" style={{ color: look.secondary_color, fontFamily: storeFontFamily(theme.body_font) }}>Peças do dia</div>
          <span className="mt-2 inline-block px-2 py-1 text-[9px] font-semibold" style={{ backgroundColor: look.button_color, color: look.button_text_color }}>COMPRAR</span>
        </div>
      </div>
      <div className="flex items-center justify-between border-t border-border bg-white px-2 py-1.5">
        <span className="text-[12px] font-medium">{theme.name}</span>
        {active && <Check className="h-3.5 w-3.5" />}
      </div>
    </button>
  );
}

function ColorField({ label, help, value, onChange, onReset }: { label: string; help: string; value: string; onChange: (value: string) => void; onReset?: () => void }) {
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
    <div className="rounded-md border border-border bg-white p-3">
      <div className="flex items-center gap-3">
        <input
          type="color"
          value={value}
          onInput={(event) => updateColor(event.currentTarget.value)}
          onChange={(event) => updateColor(event.currentTarget.value)}
          className="h-10 w-11 shrink-0 cursor-pointer border-0 bg-transparent p-0"
          aria-label={`Escolher a cor: ${label}`}
        />
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-2">
            <span className="text-[12px] font-medium">{label}</span>
            <ResetButton onClick={onReset} />
          </div>
          <input
            type="text"
            value={draft}
            maxLength={7}
            spellCheck={false}
            onChange={(event) => updateColor(event.target.value)}
            onBlur={() => {
              if (!/^#[0-9A-F]{6}$/.test(draft)) setDraft(value.toUpperCase());
            }}
            aria-label={`Código da cor: ${label}`}
            className="mt-1 h-8 w-28 rounded border border-border bg-neutral-50 px-2 font-mono text-[11px] uppercase text-foreground outline-none focus:border-foreground/40"
          />
        </div>
      </div>
      <p className="mt-2 text-[11px] leading-relaxed text-muted-foreground">{help}</p>
    </div>
  );
}

function FontSelector({ label, help, value, onChange, onReset }: { label: string; help: string; value: StoreFont; onChange: (value: StoreFont) => void; onReset?: () => void }) {
  const selected = fontOptions.find((option) => option.value === value) ?? fontOptions[0];
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-2">
        <span className="text-[12px] font-medium">{label}</span>
        <ResetButton onClick={onReset} />
      </div>
      <Select value={value} onValueChange={(nextValue) => onChange(nextValue as StoreFont)}>
        <SelectTrigger className="h-11 bg-white text-[15px]" style={{ fontFamily: storeFontFamily(selected.value) }} aria-label={label}><span>{selected.label}</span></SelectTrigger>
        <SelectContent className="max-h-80">
          <div className="py-1">{fontOptions.map((option) => <SelectItem key={option.value} value={option.value} className="h-12 border-b border-border/60 px-3 pr-9 text-[17px] last:border-b-0" style={{ fontFamily: storeFontFamily(option.value) }}>{option.label}</SelectItem>)}</div>
        </SelectContent>
      </Select>
      <Help>{help}</Help>
    </div>
  );
}

function ImageUpload({ value, uploading, onFile, onRemove, variant = "logo" }: { value: string; uploading: boolean; onFile: (file: File) => void; onRemove: () => void; variant?: "logo" | "favicon" | "banner" | "about" }) {
  const [dimensionWarning, setDimensionWarning] = useState("");

  const selectFile = async (file: File) => {
    setDimensionWarning("");
    if (variant === "banner" || variant === "about") {
      try {
        const dimensions = await readImageDimensions(file);
        const minimumWidth = variant === "banner" ? 1920 : 1200;
        const minimumHeight = variant === "banner" ? 640 : 900;
        if (dimensions.width < minimumWidth || dimensions.height < minimumHeight) {
          setDimensionWarning(
            `Sua imagem tem ${dimensions.width} x ${dimensions.height} px. Recomendamos pelo menos ${minimumWidth} x ${minimumHeight} px para não perder qualidade.`,
          );
        }
      } catch {
        setDimensionWarning(variant === "banner" ? "Não foi possível conferir o tamanho da imagem. Verifique se ela tem pelo menos 1920 x 640 px." : "Não foi possível conferir o tamanho da imagem. Verifique se ela tem pelo menos 1200 x 900 px.");
      }
    }
    onFile(file);
  };

  return (
    <div>
      <div className="overflow-hidden rounded-md border border-border">
        <div className={cn("grid place-items-center bg-neutral-50", variant === "banner" ? "aspect-[3/1]" : variant === "about" ? "aspect-[4/3]" : "h-28")}>
          {value ? <img src={value} alt="" className={cn(variant === "about" || variant === "banner" ? "object-cover" : "object-contain", variant === "favicon" ? "h-16 w-16" : "h-full w-full")} /> : <ImageIcon className="h-7 w-7 text-muted-foreground" />}
        </div>
        <div className="flex items-center gap-2 border-t border-border p-2">
          <label className="inline-flex min-h-10 cursor-pointer items-center gap-2 rounded-md border border-border px-3 py-2 text-[12px] font-medium">
            <input type="file" accept="image/png,image/jpeg,image/webp" className="hidden" onChange={(event) => { const file = event.target.files?.[0]; if (file) void selectFile(file); event.target.value = ""; }} />
            {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <UploadCloud className="h-4 w-4" />}
            {value ? "Trocar imagem" : "Escolher imagem"}
          </label>
          {value && <button type="button" onClick={onRemove} className="min-h-10 px-2 text-[12px] text-red-600">Remover</button>}
        </div>
      </div>
      {variant === "banner" && (
        <p className="mt-2 text-[11px] leading-relaxed text-muted-foreground">
          Tamanho ideal: 1920 x 640 px (imagem deitada, 3 vezes mais larga que alta). A imagem aparece inteira, também no celular.
        </p>
      )}
      {variant === "favicon" && <p className="mt-2 text-[11px] leading-relaxed text-muted-foreground">Use uma imagem quadrada, de pelo menos 130 x 130 px.</p>}
      {variant === "about" && <p className="mt-2 text-[11px] leading-relaxed text-muted-foreground">Tamanho ideal: 1200 x 900 px.</p>}
      {dimensionWarning && <div className="mt-2 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-[11px] leading-relaxed text-amber-800">{dimensionWarning}</div>}
    </div>
  );
}

// "Quando o cliente clicar, ir para:" (escopo do catálogo, §5). Promoções e Novidades entram
// quando essas páginas existirem (lote 3); o banco já aceita os dois.
function bannerDestinations(visual: CatalogVisualSettings): { value: StoreBannerLinkType; label: string }[] {
  return [
    { value: "store_home", label: "Página inicial" },
    { value: "home", label: "Todos os produtos" },
    { value: "category", label: "Uma categoria" },
    { value: "product", label: "Um produto" },
    ...(visual.about_enabled ? [{ value: "about" as const, label: "Quem somos" }] : []),
    ...(visual.contact_enabled ? [{ value: "contact" as const, label: "Contato" }] : []),
    { value: "none", label: "Sem link" },
    { value: "external", label: "Outro endereço (fora da loja)" },
  ];
}

function BannerEditor({ banner, index, total, products, categories, visual, uploading, patch, remove, move, upload }: { banner: StoreBanner; index: number; total: number; products: ProductRecord[]; categories: Category[]; visual: CatalogVisualSettings; uploading: boolean; patch: ControlsProps["patchBanner"]; remove: () => void; move: (direction: -1 | 1) => void; upload: (file: File) => void }) {
  const [productSearch, setProductSearch] = useState("");
  const destinations = bannerDestinations(visual);
  const known = destinations.some((item) => item.value === banner.link_type);
  const filteredProducts = productSearch.trim()
    ? products.filter((product) => product.name.toLowerCase().includes(productSearch.trim().toLowerCase()))
    : products;
  const selectClass = "h-10 w-full rounded-md border border-input bg-white px-3 text-[13px]";

  return (
    <div className="overflow-hidden rounded-md border border-border bg-white">
      <div className="flex items-center gap-2 border-b border-border px-3 py-2">
        <span className={cn("h-2 w-2 shrink-0 rounded-full", banner.active ? "bg-emerald-500" : "bg-neutral-300")} />
        <span className="flex-1 text-[12px] font-semibold">Banner {index + 1}</span>
        <Button type="button" size="icon" variant="ghost" disabled={index === 0} onClick={() => move(-1)} title="Mover para cima"><ArrowUp /></Button>
        <Button type="button" size="icon" variant="ghost" disabled={index === total - 1} onClick={() => move(1)} title="Mover para baixo"><ArrowDown /></Button>
        <Button type="button" size="icon" variant="ghost" onClick={remove} title="Remover banner" className="text-red-600"><Trash2 /></Button>
      </div>
      <div className="space-y-3 p-3">
        <ImageUpload value={banner.image_url} uploading={uploading} onFile={upload} onRemove={() => patch(banner.id, "image_url", "")} variant="banner" />
        <div className="space-y-2">
          <span className="block text-[12px] font-medium">Quando o cliente clicar, ir para:</span>
          <select
            value={known ? banner.link_type : "store_home"}
            onChange={(event) => { patch(banner.id, "link_type", event.target.value as StoreBannerLinkType); patch(banner.id, "link_target", ""); }}
            className={selectClass}
          >
            {destinations.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
          </select>
        </div>
        {banner.link_type === "category" && (
          <select value={banner.link_target} onChange={(event) => patch(banner.id, "link_target", event.target.value)} className={selectClass} aria-label="Escolha a categoria">
            <option value="">Escolha a categoria</option>
            {categories.map((category) => <option key={category.id} value={category.slug}>{category.name}</option>)}
          </select>
        )}
        {banner.link_type === "product" && (
          <div className="space-y-2">
            <Input value={productSearch} onChange={(event) => setProductSearch(event.target.value)} placeholder="Buscar produto pelo nome" />
            <select value={banner.link_target} onChange={(event) => patch(banner.id, "link_target", event.target.value)} className={selectClass} aria-label="Escolha o produto">
              <option value="">Escolha o produto</option>
              {filteredProducts.map((product) => <option key={product.id} value={product.id}>{product.name}</option>)}
            </select>
          </div>
        )}
        {banner.link_type === "external" && (
          <div className="space-y-2">
            <Input type="url" value={banner.link_target} onChange={(event) => patch(banner.id, "link_target", event.target.value)} aria-label="Endereço completo" />
            <Help>Endereço completo, começando com https://. Abre em outra aba.</Help>
          </div>
        )}
        <Toggle label="Mostrar este banner" checked={banner.active} onChange={(checked) => patch(banner.id, "active", checked)} />
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

function moveItem<T>(items: T[], index: number, direction: -1 | 1) {
  const target = index + direction;
  if (target < 0 || target >= items.length) return items;
  const next = items.slice();
  [next[index], next[target]] = [next[target], next[index]];
  return next;
}

// Prévia fiel (lote 2c): a própria loja numa moldura com a largura do aparelho, recebendo as
// mudanças ainda não publicadas. No computador a loja abre com 1280 px e é reduzida para caber.
const PREVIEW_WIDTH: Record<PreviewDevice, number> = { mobile: 375, desktop: 1280 };

function LivePreview({ slug, device, visible, overrides, onLogoSize }: { slug: string; device: PreviewDevice; visible: boolean; overrides: PreviewOverrides; onLogoSize: (device: PreviewDevice, height: number) => void }) {
  const frameRef = useRef<HTMLIFrameElement>(null);
  const boxRef = useRef<HTMLDivElement>(null);
  const [box, setBox] = useState({ width: 0, height: 0 });
  const latest = useRef(overrides);
  latest.current = overrides;
  const onLogoSizeRef = useRef(onLogoSize);
  onLogoSizeRef.current = onLogoSize;

  useEffect(() => {
    const element = boxRef.current;
    if (!element) return;
    const observer = new ResizeObserver(([entry]) => setBox({ width: entry.contentRect.width, height: entry.contentRect.height }));
    observer.observe(element);
    return () => observer.disconnect();
  }, []);
  // Mede também ao trocar de aparelho ou ao abrir a prévia no celular (o aviso de tamanho pode atrasar).
  useLayoutEffect(() => {
    const element = boxRef.current;
    if (element) setBox({ width: element.clientWidth, height: element.clientHeight });
  }, [device, visible]);

  // A loja avisa quando carrega (inclusive ao navegar dentro dela) e quando o logo muda de tamanho.
  useEffect(() => {
    const onMessage = (event: MessageEvent) => {
      if (!isFrameMessage(event, frameRef.current)) return;
      if (event.data.type === "vynka-preview:ready") sendPreviewUpdate(frameRef.current, latest.current);
      if (event.data.type === "vynka-preview:logo-size") onLogoSizeRef.current(event.data.device, event.data.height);
    };
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, []);

  useEffect(() => {
    sendPreviewUpdate(frameRef.current, overrides);
  }, [overrides]);

  const frameWidth = PREVIEW_WIDTH[device];
  const scale = box.width ? Math.min(1, box.width / frameWidth) : 1;
  const frameHeight = Math.max(560, box.height / scale);

  return (
    <div ref={boxRef} className="relative min-h-[560px] flex-1 overflow-hidden">
      <div
        className="absolute left-1/2 top-0 origin-top overflow-hidden border border-black/10 bg-white shadow-xl"
        style={{ width: frameWidth, height: frameHeight, transform: `translateX(-50%) scale(${scale})` }}
      >
        <iframe ref={frameRef} key={slug} src={`/loja/${slug}`} title="Prévia da loja" className="h-full w-full border-0" />
      </div>
    </div>
  );
}
