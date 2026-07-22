import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Check,
  Eye,
  HelpCircle,
  ImageIcon,
  Loader2,
  MapPin,
  PackageCheck,
  Store,
  Truck,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { PageShell } from "@/components/page-shell";
import {
  getGeneralSettings,
  getDeliverySettings,
  getReceiptSettings,
  updateGeneralSettings,
  updateDeliverySettings,
  updateReceiptSettings,
  uploadStoreLogo,
  defaultDeliverySettings,
  defaultReceiptSettings,
  type DeliverySettings,
  type GeneralSettingsForm,
  type ReceiptSettings,
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
  address: "",
  instagram: "",
  description: "",
  logo_url: "",
};

function Configuracoes() {
  const { currentStore, refresh } = useStoreContext();
  const storeId = currentStore?.id ?? "";
  const queryClient = useQueryClient();
  const fileRef = useRef<HTMLInputElement | null>(null);
  const [activeTab, setActiveTab] = useState("Geral");
  const [form, setForm] = useState<GeneralSettingsForm>(emptyForm);
  const [receiptForm, setReceiptForm] = useState<ReceiptSettings>(defaultReceiptSettings);
  const [deliveryForm, setDeliveryForm] = useState<DeliverySettings>(defaultDeliverySettings);
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
    mutationFn: (file: File) => uploadStoreLogo(storeId, file),
    onSuccess: (url) => {
      setForm((current) => ({ ...current, logo_url: url }));
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
      await queryClient.invalidateQueries({ queryKey: ["delivery-settings", storeId] });
      window.setTimeout(() => setSaved(false), 2200);
    },
  });

  const patch = (key: keyof GeneralSettingsForm, value: string) => {
    setSaved(false);
    setForm((current) => ({ ...current, [key]: value }));
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
                <SettingsCard title="Identificação">
                  <TextInput
                    value={form.name}
                    onChange={(value) => patch("name", value)}
                    placeholder="Nome da Loja"
                    help
                  />
                  <TextInput
                    value={form.responsible_name}
                    onChange={(value) => patch("responsible_name", value)}
                    placeholder="Nome do responsável ou Razão Social"
                  />
                  <TextInput
                    value={form.tax_document}
                    onChange={(value) => patch("tax_document", value)}
                    placeholder="CPF ou CNPJ"
                  />
                  <div className="rounded-md bg-primary/10 px-4 py-3 text-[12px] leading-relaxed text-foreground">
                    Informar o CPF ou CNPJ é uma medida para validar a sua conta, preservar sua
                    privacidade e garantir a qualidade de todos os catálogos do Vynka. Os dados de
                    identificação não serão exibidos no seu Catálogo Online.
                  </div>
                </SettingsCard>

                <div className="space-y-5">
                  <div className="rounded-lg bg-muted/70 px-6 py-10 text-center">
                    <input
                      ref={fileRef}
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={(event) => {
                        const file = event.target.files?.[0];
                        if (file) uploadMutation.mutate(file);
                        event.currentTarget.value = "";
                      }}
                    />
                    <div className="mx-auto mb-3 grid h-10 w-10 place-items-center rounded-full bg-surface text-muted-foreground">
                      {uploadMutation.isPending ? (
                        <Loader2 className="h-4 w-4 animate-spin" strokeWidth={1.5} />
                      ) : (
                        <ImageIcon className="h-4 w-4" strokeWidth={1.5} />
                      )}
                    </div>
                    <div className="text-[13px] font-semibold text-foreground">
                      Upload da sua marca
                    </div>
                    <button
                      type="button"
                      onClick={() => fileRef.current?.click()}
                      disabled={uploadMutation.isPending}
                      className="mt-4 rounded-md bg-primary px-4 py-2.5 text-[13px] font-semibold text-primary-foreground transition-colors hover:bg-graphite disabled:opacity-60"
                    >
                      Escolher Imagem
                    </button>
                  </div>

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

                <SettingsCard title="Dados de contato">
                  <TextInput
                    value={form.phone}
                    onChange={(value) => patch("phone", value)}
                    placeholder="Telefone"
                    help
                  />
                  <TextInput
                    value={form.whatsapp}
                    onChange={(value) => patch("whatsapp", value)}
                    placeholder="Celular/WhatsApp"
                    help
                  />
                  <TextInput
                    value={form.address}
                    onChange={(value) => patch("address", value)}
                    placeholder="Endereço"
                  />
                  <TextInput
                    value={form.instagram}
                    onChange={(value) => patch("instagram", value)}
                    placeholder="Instagram"
                  />
                </SettingsCard>
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
                  checked={deliveryForm.delivery_enabled}
                  onClick={() => patchDelivery("delivery_enabled", !deliveryForm.delivery_enabled)}
                />
                <DeliveryOptionCard
                  icon={<MapPin className="h-6 w-6" strokeWidth={1.5} />}
                  title="Trabalho com retirada no local"
                  description="Seu endereço será informado durante o fechamento do pedido."
                  checked={deliveryForm.pickup_enabled}
                  onClick={() => patchDelivery("pickup_enabled", !deliveryForm.pickup_enabled)}
                />
              </div>

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

function TextInput({
  value,
  onChange,
  placeholder,
  help = false,
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  help?: boolean;
}) {
  return (
    <div className="flex items-center rounded-md border border-border bg-surface px-3 focus-within:border-foreground/40">
      <input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        className="min-w-0 flex-1 bg-transparent py-3 text-[14px] outline-none placeholder:text-muted-foreground"
      />
      {help && <HelpCircle className="h-4 w-4 shrink-0 text-muted-foreground" strokeWidth={1.6} />}
    </div>
  );
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
