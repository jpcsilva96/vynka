import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeft,
  Check,
  ChevronDown,
  Clock3,
  Copy,
  Loader2,
  Package,
  Plus,
  Printer,
  ReceiptText,
  Send,
  User,
  XCircle,
} from "lucide-react";
import { useEffect, useState } from "react";
import { PaymentMethodIcon } from "@/components/payment-method-icon";
import { OrderReceiptCard } from "@/components/order-receipt";
import { useStoreContext } from "@/lib/store-context";
import { formatBRL, listProducts, type ProductRecord } from "@/lib/products";
import {
  createCustomerDetailed,
  listCustomers,
  paymentMethodLabel,
  type CustomerLite,
  type PaymentMethod,
} from "@/lib/sales";
import {
  getOrder,
  orderStatusClass,
  deliveryDaysLabel,
  deliveryMethodLabel,
  formatDeliveryAddress,
  orderStatusLabelFor,
  replaceOrderItems,
  stageActionLabel,
  websiteNextStages,
  updateOrderCustomer,
  updateOrderNotes,
  updateOrderPayment,
  updateOrderStatus,
  type OrderItemInput,
  type OrderRecord,
  type OrderStatus,
} from "@/lib/orders";

export const Route = createFileRoute("/admin/pedidos/$id")({
  head: () => ({ meta: [{ title: "Pedido - VYNKA" }] }),
  component: PedidoDetalhe,
});

type OrderItemDraft = {
  key: string;
  product_id: string;
  product_name: string;
  quantity: string;
  unit_price: string;
  unit_cost: string;
};

type CustomerDraft = {
  name: string;
  document: string;
  notes: string;
  birth_date: string;
  email: string;
  mobile: string;
  telephone: string;
  zip_code: string;
  street: string;
  address_number: string;
  complement: string;
  neighborhood: string;
  city: string;
  state: string;
};

const emptyCustomerDraft: CustomerDraft = {
  name: "",
  document: "",
  notes: "",
  birth_date: "",
  email: "",
  mobile: "",
  telephone: "",
  zip_code: "",
  street: "",
  address_number: "",
  complement: "",
  neighborhood: "",
  city: "",
  state: "",
};

const paymentMethods: { value: PaymentMethod; label: string }[] = [
  { value: "cash", label: "Dinheiro" },
  { value: "debit", label: "Cartão de Débito" },
  { value: "credit", label: "Cartão de Crédito" },
  { value: "pix", label: "Pix" },
  { value: "payment_link", label: "Link de Pagamento" },
];

function PedidoDetalhe() {
  const { id } = Route.useParams();
  const { currentStore } = useStoreContext();
  const storeId = currentStore?.id ?? "";
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [nextStatus, setNextStatus] = useState<OrderStatus | "">("");
  const [statusMenuOpen, setStatusMenuOpen] = useState(false);
  const [modal, setModal] = useState<"customer" | "notes" | "items" | "payment" | null>(null);
  const [customerId, setCustomerId] = useState("");
  const [showNewCustomer, setShowNewCustomer] = useState(false);
  const [newCustomer, setNewCustomer] = useState<CustomerDraft>(emptyCustomerDraft);
  const [cepLoading, setCepLoading] = useState(false);
  const [notesDraft, setNotesDraft] = useState("");
  const [paymentDraft, setPaymentDraft] = useState<PaymentMethod | "">("");
  const [itemDrafts, setItemDrafts] = useState<OrderItemDraft[]>([]);

  const { data: order, isLoading } = useQuery({
    queryKey: ["order", storeId, id],
    queryFn: () => getOrder(storeId, id),
    enabled: !!storeId && !!id,
  });

  const { data: customers = [] } = useQuery({
    queryKey: ["customers", storeId, "order-edit"],
    queryFn: () => listCustomers(storeId),
    enabled: !!storeId && modal === "customer",
  });

  const { data: products = [] } = useQuery({
    queryKey: ["products", storeId, "order-edit"],
    queryFn: () => listProducts(storeId),
    enabled: !!storeId && modal === "items",
  });

  const statusMutation = useMutation({
    mutationFn: (status: OrderStatus) => updateOrderStatus(storeId, id, status),
    onSuccess: async (_, status) => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["order", storeId, id] }),
        queryClient.invalidateQueries({ queryKey: ["orders", storeId] }),
      ]);
      setNextStatus("");
      setStatusMenuOpen(false);
      if (status === "delivered") {
        navigate({ to: "/admin/historico" });
      }
    },
  });

  const orderMutation = useMutation({
    mutationFn: async (action: () => Promise<void>) => action(),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["order", storeId, id] }),
        queryClient.invalidateQueries({ queryKey: ["orders", storeId] }),
      ]);
      setModal(null);
    },
  });

  useEffect(() => {
    if (!order) return;
    setCustomerId(order.customer_id ?? "");
    setNotesDraft(order.notes ?? "");
    setPaymentDraft((order.payment_method as PaymentMethod | null) ?? "");
    setItemDrafts(
      order.items.map((item) => ({
        key: item.id,
        product_id: item.product_id ?? "",
        product_name: item.product_name,
        quantity: String(item.quantity),
        unit_price: String(item.unit_price),
        unit_cost: String(item.unit_cost ?? 0),
      })),
    );
  }, [order]);

  if (isLoading) {
    return (
      <div className="grid min-h-svh flex-1 place-items-center bg-background">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" strokeWidth={1.5} />
      </div>
    );
  }

  if (!order) {
    return (
      <div className="flex min-h-svh flex-1 flex-col items-center justify-center bg-background px-6 text-center">
        <h1 className="text-[18px] font-medium text-foreground">Pedido nao encontrado</h1>
        <Link
          to="/admin/pedidos"
          className="mt-4 text-[13px] font-medium text-foreground underline"
        >
          Voltar para pedidos
        </Link>
      </div>
    );
  }

  // Pedido do site: só o Mercado Pago confirma o pagamento (o banco também barra, lote E4). O
  // lojista pode cancelar enquanto aguarda; depois de pago, avança as etapas (só para a frente;
  // Correios/transportadora só até "Em separação", o resto vem do Melhor Envio).
  const isWebsite = order.source === "website";
  const awaitingPayment = isWebsite && order.status === "pending";
  const nextStages = websiteNextStages(order);
  const nextStage = nextStages[0];
  const shippingByCarrier =
    isWebsite &&
    order.delivery_method === "shipping" &&
    ["paid", "in_production"].includes(order.status);
  const canChangeStatus = (order.status === "pending" && !isWebsite) || nextStages.length > 0;
  const canConfirmOrder = order.status === "pending" && !isWebsite;
  const canConcludeSale = order.status === "confirmed";
  const canCancelSale = order.status !== "cancelled" && order.status !== "delivered";
  const cancelWarning =
    isWebsite && order.paid_at
      ? "Cancelar este pedido? Ele já foi pago: o reembolso ao cliente é feito na sua conta do Mercado Pago."
      : "Cancelar este pedido?";
  const statusChoices: { value: OrderStatus; label: string; icon: React.ReactNode }[] = isWebsite
    ? nextStages.map((stage) => ({ ...stage, icon: <Check className="h-4 w-4" /> }))
    : [
        { value: "confirmed", label: "Confirmado", icon: <Check className="h-4 w-4" /> },
        { value: "cancelled", label: "Cancelado", icon: <XCircle className="h-4 w-4" /> },
      ];

  const saveCustomer = () => {
    orderMutation.mutate(async () => {
      let nextCustomerId = customerId || null;
      if (showNewCustomer) {
        const created = await createCustomerDetailed(storeId, newCustomer);
        nextCustomerId = created.id;
      }
      await updateOrderCustomer(storeId, id, nextCustomerId);
      setShowNewCustomer(false);
      setNewCustomer(emptyCustomerDraft);
    });
  };

  const saveNotes = () => {
    orderMutation.mutate(() => updateOrderNotes(storeId, id, notesDraft.trim() || null));
  };

  const savePayment = () => {
    orderMutation.mutate(() =>
      updateOrderPayment(storeId, id, paymentDraft || null, paymentDraft ? {} : {}, null, null),
    );
  };

  const saveItems = () => {
    if (itemDrafts.some((item) => !item.product_id)) {
      alert("Selecione um produto cadastrado para todos os itens do pedido.");
      return;
    }
    const items: OrderItemInput[] = itemDrafts
      .filter((item) => item.product_id)
      .map((item) => ({
        product_id: item.product_id,
        product_name: item.product_name.trim(),
        quantity: Math.max(1, Number(item.quantity) || 1),
        unit_price: Math.max(0, Number(item.unit_price.replace(",", ".")) || 0),
        unit_cost: Math.max(0, Number(item.unit_cost.replace(",", ".")) || 0),
      }));
    if (items.length === 0) {
      alert("Inclua ao menos um produto no pedido.");
      return;
    }
    orderMutation.mutate(() =>
      replaceOrderItems(
        storeId,
        id,
        items,
        order.discount ?? 0,
        order.surcharge ?? 0,
        order.shipping_amount ?? 0,
      ),
    );
  };

  const chooseProduct = (index: number, productId: string) => {
    const product = products.find((item) => item.id === productId);
    setItemDrafts((current) =>
      current.map((item, i) =>
        i === index
          ? {
              ...item,
              product_id: productId,
              product_name: product?.name ?? "",
              unit_price: String(product?.promo_price ?? product?.price ?? item.unit_price),
              unit_cost: String(product?.cost_price ?? item.unit_cost),
            }
          : item,
      ),
    );
  };

  const updateNewCustomer = (key: keyof CustomerDraft, value: string) => {
    setNewCustomer((current) => ({ ...current, [key]: value }));
  };

  const lookupCep = async (value: string) => {
    const digits = value.replace(/\D/g, "");
    updateNewCustomer("zip_code", value);
    if (digits.length !== 8) return;

    setCepLoading(true);
    try {
      const response = await fetch(`https://viacep.com.br/ws/${digits}/json/`);
      const data = await response.json();
      if (!data?.erro) {
        setNewCustomer((current) => ({
          ...current,
          zip_code: value,
          street: data.logradouro || current.street,
          neighborhood: data.bairro || current.neighborhood,
          city: data.localidade || current.city,
          state: data.uf || current.state,
        }));
      }
    } catch (error) {
      console.error("[Pedidos] CEP lookup failed", error);
    } finally {
      setCepLoading(false);
    }
  };

  return (
    <div className="min-h-svh min-w-0 flex-1 bg-background">
      <header className="sticky top-0 z-20 border-b border-border bg-background/90 backdrop-blur-xl">
        <div className="flex h-20 items-center gap-4 px-6">
          <button
            onClick={() =>
              navigate({ to: order.status === "delivered" ? "/admin/historico" : "/admin/pedidos" })
            }
            aria-label="Voltar"
            className="grid h-9 w-9 place-items-center rounded-full text-muted-foreground hover:bg-muted hover:text-foreground"
          >
            <ArrowLeft className="h-4 w-4" strokeWidth={1.75} />
          </button>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-baseline gap-3">
              <h1 className="text-[22px] font-medium text-foreground">
                Pedido #{order.number ?? "-"}
              </h1>
              <span className="text-[15px] text-muted-foreground">
                Total {formatBRL(order.total)}
              </span>
            </div>
            <p className="mt-1 text-[12px] text-muted-foreground">{formatDate(order.created_at)}</p>
          </div>
          <button
            onClick={() => window.print()}
            className="hidden items-center gap-2 rounded-md border border-border bg-surface px-3 py-2 text-[12.5px] font-medium hover:bg-muted md:inline-flex"
          >
            <Printer className="h-3.5 w-3.5" strokeWidth={1.5} />
            Imprimir
          </button>
        </div>
      </header>

      <main className="px-6 py-6">
        <div className="mx-auto max-w-6xl">
          <div className="rounded-lg border border-border bg-surface p-4 shadow-sm">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <div className="flex flex-wrap items-center gap-5">
                <div className="relative flex items-center gap-2">
                  <span className="text-[13px] font-medium text-foreground">Status:</span>
                  <button
                    type="button"
                    disabled={!canChangeStatus}
                    onClick={() => canChangeStatus && setStatusMenuOpen((value) => !value)}
                    className={`inline-flex items-center gap-1.5 rounded px-2 py-1 text-[12px] font-medium ${orderStatusClass(
                      order.status,
                    )} ${canChangeStatus ? "hover:bg-muted" : "cursor-default"}`}
                  >
                    <Clock3 className="h-3.5 w-3.5" strokeWidth={1.5} />
                    {orderStatusLabelFor(order)}
                    {canChangeStatus && <ChevronDown className="h-3.5 w-3.5" strokeWidth={1.5} />}
                  </button>

                  {statusMenuOpen && (
                    <div className="absolute left-12 top-9 z-30 w-60 rounded-lg border border-border bg-background p-3 shadow-xl">
                      <div className="mb-3 flex items-center justify-between">
                        <span className="text-[14px] font-medium text-foreground">
                          Alterar status
                        </span>
                        <button
                          type="button"
                          onClick={() => setStatusMenuOpen(false)}
                          className="text-muted-foreground hover:text-foreground"
                          aria-label="Fechar status"
                        >
                          <XCircle className="h-4 w-4" strokeWidth={1.5} />
                        </button>
                      </div>
                      <div className="space-y-1">
                        {statusChoices.map((choice) => (
                          <button
                            key={choice.value}
                            type="button"
                            onClick={() => setNextStatus(choice.value)}
                            className={`flex w-full items-center gap-2 rounded-md px-2 py-2 text-left text-[13px] ${
                              nextStatus === choice.value
                                ? "bg-muted font-medium text-foreground"
                                : "text-foreground/80 hover:bg-muted/70"
                            }`}
                          >
                            <span
                              className={
                                choice.value === "cancelled" ? "text-red-600" : "text-primary"
                              }
                            >
                              {choice.icon}
                            </span>
                            {choice.label}
                          </button>
                        ))}
                      </div>
                      <p className="mt-3 text-[12px] leading-relaxed text-muted-foreground">
                        {isWebsite
                          ? "No pedido do site a etapa só avança: não dá para voltar depois."
                          : "Após confirmado ou cancelado, um pedido não pode voltar ao status Pendente."}
                      </p>
                      <button
                        disabled={!nextStatus || statusMutation.isPending}
                        onClick={() => nextStatus && statusMutation.mutate(nextStatus)}
                        className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-md bg-primary px-3 py-2 text-[12.5px] font-medium text-primary-foreground hover:bg-graphite disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        {statusMutation.isPending && (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" strokeWidth={1.5} />
                        )}
                        Alterar status
                      </button>
                    </div>
                  )}
                </div>

                <div>
                  <div className="text-[13px] font-medium text-foreground">
                    Página de andamento do pedido
                  </div>
                  <div className="text-[11.5px] text-muted-foreground">
                    Você ainda não tem catálogo
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => navigator.clipboard.writeText(window.location.href)}
                  className="inline-flex items-center gap-1.5 text-[12px] font-medium text-primary hover:text-foreground"
                >
                  <Copy className="h-3.5 w-3.5" strokeWidth={1.5} />
                  Copiar link
                </button>
              </div>

              <div className="flex items-center gap-3">
                {canCancelSale && (
                  <button
                    type="button"
                    disabled={statusMutation.isPending}
                    onClick={() =>
                      window.confirm(cancelWarning) && statusMutation.mutate("cancelled")
                    }
                    className="grid h-11 w-12 place-items-center rounded-md bg-muted text-foreground hover:bg-border disabled:cursor-not-allowed disabled:opacity-50"
                    aria-label="Cancelar venda"
                    title="Cancelar venda"
                  >
                    <XCircle className="h-4 w-4" strokeWidth={1.6} />
                  </button>
                )}

                {canConfirmOrder && (
                  <button
                    disabled={statusMutation.isPending}
                    onClick={() => statusMutation.mutate("confirmed")}
                    className="inline-flex items-center justify-center gap-2 rounded-md bg-primary px-5 py-3 text-[12.5px] font-medium text-primary-foreground hover:bg-graphite disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {statusMutation.isPending ? (
                      <Loader2 className="h-4 w-4 animate-spin" strokeWidth={1.6} />
                    ) : (
                      <Check className="h-4 w-4" strokeWidth={1.6} />
                    )}
                    Confirmar Pedido
                  </button>
                )}

                {canConcludeSale && (
                  <button
                    disabled={statusMutation.isPending}
                    onClick={() => statusMutation.mutate("delivered")}
                    className="inline-flex items-center justify-center gap-2 rounded-md bg-primary px-5 py-3 text-[12.5px] font-medium text-primary-foreground hover:bg-graphite disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {statusMutation.isPending ? (
                      <Loader2 className="h-4 w-4 animate-spin" strokeWidth={1.6} />
                    ) : (
                      <Check className="h-4 w-4" strokeWidth={1.6} />
                    )}
                    Concluir venda
                  </button>
                )}

                {nextStage && (
                  <button
                    disabled={statusMutation.isPending}
                    onClick={() => statusMutation.mutate(nextStage.value)}
                    className="inline-flex items-center justify-center gap-2 rounded-md bg-primary px-5 py-3 text-[12.5px] font-medium text-primary-foreground hover:bg-graphite disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {statusMutation.isPending ? (
                      <Loader2 className="h-4 w-4 animate-spin" strokeWidth={1.6} />
                    ) : (
                      <Check className="h-4 w-4" strokeWidth={1.6} />
                    )}
                    {stageActionLabel(nextStage.value, order.delivery_method)}
                  </button>
                )}
              </div>
            </div>
          </div>

          {awaitingPayment && (
            <div className="mt-3 rounded-md border border-border bg-surface px-4 py-3 text-[12.5px] text-foreground">
              <span className="font-medium">Aguardando o pagamento pelo Mercado Pago.</span>{" "}
              <span className="text-muted-foreground">
                O pedido é confirmado sozinho quando o pagamento for aprovado
                {order.payment_due_at
                  ? `; sem pagamento até ${formatDate(order.payment_due_at)}, ele é cancelado e as peças voltam ao estoque.`
                  : "."}
              </span>
            </div>
          )}
          {shippingByCarrier && (
            <div className="mt-3 rounded-md border border-border bg-surface px-4 py-3 text-[12.5px] text-foreground">
              <span className="font-medium">Envio por Correios/transportadora.</span>{" "}
              <span className="text-muted-foreground">
                Você marca "Em separação"; "Enviado" e "Entregue" são atualizados automaticamente
                pelo Melhor Envio quando a etiqueta for gerada pelo Vynka.
              </span>
            </div>
          )}
          {statusMutation.isError && (
            <div className="mt-3 rounded-md bg-red-50 px-4 py-3 text-[12.5px] text-red-700">
              {statusMutation.error instanceof Error
                ? statusMutation.error.message
                : "Não foi possível alterar o status."}
            </div>
          )}

          <div className="mt-0 rounded-b-lg bg-muted px-4 py-3 text-[12.5px] text-foreground">
            <Clock3
              className="mr-1.5 inline h-4 w-4 align-[-3px] text-muted-foreground"
              strokeWidth={1.5}
            />
            {formatDate(order.created_at)}
            {order.customer?.name && (
              <span className="ml-4 text-muted-foreground">Cliente: {order.customer.name}</span>
            )}
          </div>

          <div className="mt-5 grid grid-cols-1 gap-5 break-words lg:grid-cols-[minmax(0,1fr)_380px]">
            <section className="space-y-4">
              <InfoCard
                title="Cliente"
                action={
                  <button
                    type="button"
                    onClick={() => setModal("customer")}
                    className="grid h-8 w-8 place-items-center rounded-md bg-primary text-primary-foreground hover:bg-graphite"
                    aria-label="Incluir cliente"
                  >
                    {order.customer ? (
                      <User className="h-4 w-4" strokeWidth={1.6} />
                    ) : (
                      <Plus className="h-4 w-4" strokeWidth={1.7} />
                    )}
                  </button>
                }
              >
                {order.customer ? (
                  <div className="space-y-1 text-[13px]">
                    <div className="font-medium text-foreground">{order.customer.name}</div>
                    {order.customer.phone && (
                      <div className="text-muted-foreground">{order.customer.phone}</div>
                    )}
                    {order.customer.email && (
                      <div className="text-muted-foreground">{order.customer.email}</div>
                    )}
                  </div>
                ) : (
                  <span className="text-[13px] text-muted-foreground">Cliente nao informado.</span>
                )}
              </InfoCard>

              {order.stock_shortage && (
                <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-[13px] text-red-800">
                  <div className="font-medium">Pago sem estoque</div>
                  <p className="mt-1">
                    O pagamento chegou quando um dos produtos já tinha esgotado. Nada foi baixado do
                    estoque. Combine troca ou reembolso com o cliente.
                  </p>
                </div>
              )}

              {((order.status === "pending" && order.payment_due_at) ||
                order.cancel_reason === "deadline") && (
                <InfoCard title="Pagamento">
                  <div className="text-[13px] text-muted-foreground">
                    {order.cancel_reason === "deadline"
                      ? "Cancelado automaticamente: o prazo para pagar terminou. As peças voltaram ao estoque."
                      : `Aguardando pagamento até ${formatDate(order.payment_due_at!)}. Depois disso o pedido é cancelado e as peças voltam ao estoque.`}
                  </div>
                </InfoCard>
              )}

              {order.delivery_method && (
                <InfoCard title="Entrega">
                  <div className="space-y-1 text-[13px]">
                    <div className="font-medium text-foreground">
                      {order.delivery_method === "shipping" && order.shipping_service_name
                        ? order.shipping_service_name
                        : deliveryMethodLabel[order.delivery_method]}
                      {" · "}
                      {order.shipping_amount > 0 ? formatBRL(order.shipping_amount) : "Grátis"}
                    </div>
                    {deliveryDaysLabel(order.shipping_min_days, order.shipping_max_days) && (
                      <div className="text-muted-foreground">
                        Prazo: {deliveryDaysLabel(order.shipping_min_days, order.shipping_max_days)}
                      </div>
                    )}
                    <div className="text-muted-foreground">
                      {order.delivery_method === "pickup"
                        ? "O cliente retira na loja."
                        : formatDeliveryAddress(order.delivery_address)}
                    </div>
                  </div>
                </InfoCard>
              )}

              <InfoCard
                title="Observacao"
                action={
                  <button
                    type="button"
                    onClick={() => setModal("notes")}
                    className="text-[12px] font-medium text-primary hover:text-foreground"
                  >
                    Editar
                  </button>
                }
              >
                <p className="min-h-6 whitespace-pre-wrap text-[13px] text-muted-foreground">
                  {order.notes || "Nenhuma observacao."}
                </p>
              </InfoCard>

              <InfoCard
                title={`${itemCount(order)} item${itemCount(order) === 1 ? "" : "s"}`}
                action={
                  <button
                    type="button"
                    onClick={() => setModal("items")}
                    className="text-[12px] font-medium text-primary hover:text-foreground"
                  >
                    Editar
                  </button>
                }
              >
                <ul className="divide-y divide-border">
                  {order.items.map((item) => (
                    <li key={item.id} className="flex items-center gap-3 py-3 first:pt-0 last:pb-0">
                      <div className="grid h-11 w-11 shrink-0 place-items-center rounded-md bg-muted text-muted-foreground">
                        <Package className="h-4 w-4" strokeWidth={1.4} />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-[13px] font-medium text-foreground">
                          {item.product_name}
                        </div>
                        {item.variant_name && (
                          <div className="truncate text-[11.5px] text-muted-foreground">
                            {item.variant_name}
                          </div>
                        )}
                      </div>
                      <div className="text-[12px] text-muted-foreground">x{item.quantity}</div>
                      <div className="w-24 text-right text-[13px] font-medium text-foreground">
                        {formatBRL(item.total_price)}
                      </div>
                    </li>
                  ))}
                </ul>
              </InfoCard>

              <InfoCard title="Historico">
                <ol className="space-y-3 text-[13px]">
                  <HistoryLine
                    icon={<Clock3 className="h-4 w-4" strokeWidth={1.5} />}
                    label="Criado"
                    date={order.created_at}
                  />
                  <HistoryLine
                    icon={<Check className="h-4 w-4" strokeWidth={1.5} />}
                    label={orderStatusLabelFor(order)}
                    date={order.updated_at}
                  />
                </ol>
              </InfoCard>
            </section>

            <aside className="space-y-4">
              <SummaryCard order={order} />
              <PaymentCard
                order={order}
                onEdit={isWebsite ? undefined : () => setModal("payment")}
              />
              <OrderReceiptCard order={order} storeId={storeId} />
            </aside>
          </div>
        </div>
      </main>

      {modal === "customer" && (
        <EditModal title="Cliente do pedido" onClose={() => setModal(null)}>
          <div className="space-y-4">
            <label className="block">
              <span className="mb-1.5 block text-[12px] text-foreground">Selecionar cliente</span>
              <select
                value={customerId}
                onChange={(event) => setCustomerId(event.target.value)}
                className="h-10 w-full rounded-md border border-border bg-background px-3 text-[13px] outline-none focus:border-foreground/40"
              >
                <option value="">Sem cliente</option>
                {customers.map((customer: CustomerLite) => (
                  <option key={customer.id} value={customer.id}>
                    {customer.name}
                    {customer.phone ? ` - ${customer.phone}` : ""}
                  </option>
                ))}
              </select>
            </label>

            <div className="rounded-lg border border-border bg-surface p-4">
              <button
                type="button"
                onClick={() => {
                  setShowNewCustomer((value) => !value);
                  setCustomerId("");
                }}
                className="inline-flex items-center gap-2 text-[13px] font-medium text-foreground hover:text-primary"
              >
                <Plus className="h-4 w-4" strokeWidth={1.6} />
                Criar novo cliente
              </button>

              {showNewCustomer && (
                <div className="mt-4 space-y-5">
                  <FormSection title="Dados Pessoais">
                    <TextField
                      label="Nome"
                      value={newCustomer.name}
                      onChange={(value) => updateNewCustomer("name", value)}
                    />
                    <TextField
                      label="CPF/CNPJ"
                      value={newCustomer.document}
                      onChange={(value) => updateNewCustomer("document", value)}
                    />
                    <TextField
                      label="Data de aniversario"
                      type="date"
                      value={newCustomer.birth_date}
                      onChange={(value) => updateNewCustomer("birth_date", value)}
                    />
                    <label className="md:col-span-3">
                      <span className="mb-1.5 block text-[12px] text-foreground">Observacoes</span>
                      <textarea
                        value={newCustomer.notes}
                        onChange={(event) => updateNewCustomer("notes", event.target.value)}
                        rows={3}
                        className="w-full resize-none rounded-md border border-border bg-background px-3 py-2 text-[13px] outline-none focus:border-foreground/40"
                      />
                    </label>
                  </FormSection>

                  <FormSection title="Contato">
                    <TextField
                      label="Email"
                      type="email"
                      value={newCustomer.email}
                      onChange={(value) => updateNewCustomer("email", value)}
                    />
                    <TextField
                      label="Celular"
                      value={newCustomer.mobile}
                      onChange={(value) => updateNewCustomer("mobile", value)}
                    />
                    <TextField
                      label="Telefone"
                      value={newCustomer.telephone}
                      onChange={(value) => updateNewCustomer("telephone", value)}
                    />
                  </FormSection>

                  <FormSection title="Endereco">
                    <TextField label="CEP" value={newCustomer.zip_code} onChange={lookupCep} />
                    <TextField
                      label="Rua"
                      value={newCustomer.street}
                      onChange={(value) => updateNewCustomer("street", value)}
                    />
                    <TextField
                      label="Numero"
                      value={newCustomer.address_number}
                      onChange={(value) => updateNewCustomer("address_number", value)}
                    />
                    <TextField
                      label="Complemento"
                      value={newCustomer.complement}
                      onChange={(value) => updateNewCustomer("complement", value)}
                    />
                    <TextField
                      label="Bairro"
                      value={newCustomer.neighborhood}
                      onChange={(value) => updateNewCustomer("neighborhood", value)}
                    />
                    <TextField
                      label="Cidade"
                      value={newCustomer.city}
                      onChange={(value) => updateNewCustomer("city", value)}
                    />
                    <TextField
                      label="Estado"
                      value={newCustomer.state}
                      onChange={(value) =>
                        updateNewCustomer("state", value.toUpperCase().slice(0, 2))
                      }
                    />
                    {cepLoading && (
                      <div className="flex items-center gap-2 self-end pb-2 text-[12px] text-muted-foreground">
                        <Loader2 className="h-3.5 w-3.5 animate-spin" strokeWidth={1.6} />
                        Buscando CEP
                      </div>
                    )}
                  </FormSection>
                </div>
              )}
            </div>

            <ModalActions
              saving={orderMutation.isPending}
              onCancel={() => setModal(null)}
              onSave={saveCustomer}
            />
          </div>
        </EditModal>
      )}

      {modal === "notes" && (
        <EditModal title="Descrição do pedido" onClose={() => setModal(null)}>
          <div className="space-y-4">
            <label className="block">
              <span className="mb-1.5 block text-[12px] text-foreground">Descrição</span>
              <textarea
                value={notesDraft}
                onChange={(event) => setNotesDraft(event.target.value)}
                rows={5}
                className="w-full resize-none rounded-md border border-border bg-background px-3 py-2 text-[13px] outline-none focus:border-foreground/40"
              />
            </label>
            <ModalActions
              saving={orderMutation.isPending}
              onCancel={() => setModal(null)}
              onSave={saveNotes}
            />
          </div>
        </EditModal>
      )}

      {modal === "items" && (
        <EditModal title="Produtos do pedido" onClose={() => setModal(null)}>
          <div className="space-y-4">
            <div className="space-y-3">
              {itemDrafts.map((item, index) => (
                <div key={item.key} className="rounded-lg border border-border bg-surface p-4">
                  <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_96px_120px_36px]">
                    <label className="block">
                      <span className="mb-1.5 block text-[12px] text-foreground">Produto</span>
                      <select
                        value={item.product_id}
                        onChange={(event) => chooseProduct(index, event.target.value)}
                        className="h-10 w-full rounded-md border border-border bg-background px-3 text-[13px] outline-none focus:border-foreground/40"
                      >
                        <option value="">Selecione um produto</option>
                        {products.map((product: ProductRecord) => (
                          <option key={product.id} value={product.id}>
                            {product.name}
                          </option>
                        ))}
                      </select>
                    </label>
                    <TextField
                      label="Qtd."
                      value={item.quantity}
                      onChange={(value) =>
                        setItemDrafts((current) =>
                          current.map((draft, i) =>
                            i === index ? { ...draft, quantity: value.replace(/\D/g, "") } : draft,
                          ),
                        )
                      }
                    />
                    <TextField
                      label="Preço"
                      value={item.unit_price}
                      onChange={(value) =>
                        setItemDrafts((current) =>
                          current.map((draft, i) =>
                            i === index
                              ? { ...draft, unit_price: value.replace(/[^0-9.,]/g, "") }
                              : draft,
                          ),
                        )
                      }
                    />
                    <button
                      type="button"
                      onClick={() =>
                        setItemDrafts((current) => current.filter((_, i) => i !== index))
                      }
                      className="mt-5 grid h-10 w-9 place-items-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground"
                      aria-label="Remover produto"
                    >
                      <XCircle className="h-4 w-4" strokeWidth={1.5} />
                    </button>
                  </div>
                </div>
              ))}
            </div>

            <button
              type="button"
              onClick={() =>
                setItemDrafts((current) => [
                  ...current,
                  {
                    key: `new-${Date.now()}`,
                    product_id: "",
                    product_name: "",
                    quantity: "1",
                    unit_price: "0",
                    unit_cost: "0",
                  },
                ])
              }
              className="inline-flex items-center gap-2 text-[12.5px] font-medium text-primary hover:text-foreground"
            >
              <Plus className="h-4 w-4" strokeWidth={1.6} />
              Adicionar produto
            </button>

            <ModalActions
              saving={orderMutation.isPending}
              onCancel={() => setModal(null)}
              onSave={saveItems}
            />
          </div>
        </EditModal>
      )}

      {modal === "payment" && (
        <EditModal title="Forma de pagamento" onClose={() => setModal(null)}>
          <div className="space-y-4">
            <div className="space-y-2">
              {paymentMethods.map((method) => (
                <button
                  key={method.value}
                  type="button"
                  disabled={method.value === "payment_link"}
                  onClick={() => setPaymentDraft(method.value)}
                  className={`flex w-full items-center justify-between rounded-md border px-3 py-3 text-left text-[13px] ${
                    paymentDraft === method.value
                      ? "border-foreground bg-muted font-medium text-foreground"
                      : "border-border bg-background text-foreground/80 hover:bg-muted/60"
                  } ${method.value === "payment_link" ? "cursor-not-allowed opacity-60" : ""}`}
                >
                  <span className="inline-flex items-center gap-2">
                    <PaymentMethodIcon method={method.value} />
                    {method.label}
                  </span>
                  {method.value === "payment_link" && (
                    <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] uppercase tracking-[0.12em] text-muted-foreground">
                      Em breve
                    </span>
                  )}
                </button>
              ))}
            </div>
            <ModalActions
              saving={orderMutation.isPending}
              onCancel={() => setModal(null)}
              onSave={savePayment}
            />
          </div>
        </EditModal>
      )}
    </div>
  );
}

function InfoCard({
  title,
  action,
  children,
}: {
  title: string;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-lg border border-border bg-surface p-5">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-[15px] font-medium text-foreground">{title}</h2>
        {action}
      </div>
      <div className="mt-4">{children}</div>
    </div>
  );
}

function SummaryCard({ order }: { order: OrderRecord }) {
  return (
    <InfoCard title="Resumo do pedido">
      <div className="space-y-2 text-[13px]">
        <SummaryRow label="Subtotal de produtos" value={formatBRL(order.subtotal)} />
        {order.discount > 0 && (
          <SummaryRow label="Desconto" value={`-${formatBRL(order.discount)}`} />
        )}
        {order.surcharge > 0 && (
          <SummaryRow label="Acrescimo" value={`+${formatBRL(order.surcharge)}`} />
        )}
        {order.delivery_method && (
          <SummaryRow
            label="Frete"
            value={order.shipping_amount > 0 ? `+${formatBRL(order.shipping_amount)}` : "Grátis"}
          />
        )}
        <div className="mt-4 flex items-baseline justify-between border-t border-border pt-4">
          <span className="text-[15px] font-medium text-foreground">Total</span>
          <span className="text-[20px] font-medium text-foreground">{formatBRL(order.total)}</span>
        </div>
      </div>
    </InfoCard>
  );
}

// Pedido do site: sem "Editar" (a forma vem do Mercado Pago).
function PaymentCard({ order, onEdit }: { order: OrderRecord; onEdit?: () => void }) {
  const method = order.payment_method as PaymentMethod | null;
  return (
    <InfoCard
      title="Meios de pagamento"
      action={
        onEdit && (
          <button
            type="button"
            onClick={onEdit}
            className="text-[12px] font-medium text-primary hover:text-foreground"
          >
            Editar
          </button>
        )
      }
    >
      <div className="text-[13px] text-foreground">
        <span className="inline-flex items-center gap-2">
          <PaymentMethodIcon method={method} />
          {method ? (paymentMethodLabel[method] ?? method) : "Nao informado"}
        </span>
        {order.paid_amount != null && <span>: {formatBRL(order.paid_amount)}</span>}
      </div>
      {order.change_due != null && order.change_due > 0 && (
        <div className="mt-2 text-[12px] text-muted-foreground">
          Troco: {formatBRL(order.change_due)}
        </div>
      )}
    </InfoCard>
  );
}

function ReceiptCard({ order }: { order: OrderRecord }) {
  const receiptText = buildReceiptText(order);
  return (
    <InfoCard title="Recibo">
      <div className="rounded-md bg-background p-4 text-center">
        <ReceiptText className="mx-auto mb-3 h-5 w-5 text-muted-foreground" strokeWidth={1.5} />
        <div className="text-[13px] font-medium text-muted-foreground">
          RECIBO #{order.number ?? "-"}
        </div>
        <div className="mt-5 text-left text-[12px] text-muted-foreground">
          {itemCount(order)} item{itemCount(order) === 1 ? "" : "s"}
        </div>
        <div className="mt-2 border-t border-border pt-2 text-left">
          {order.items.slice(0, 3).map((item) => (
            <div
              key={item.id}
              className="flex justify-between gap-3 py-1 text-[11.5px] text-muted-foreground"
            >
              <span className="truncate">
                {item.quantity}x {item.product_name}
              </span>
              <span>{formatBRL(item.total_price)}</span>
            </div>
          ))}
        </div>
        <div className="mt-4 flex items-center justify-center gap-2">
          <button
            onClick={() => navigator.clipboard.writeText(receiptText)}
            className="grid h-8 w-8 place-items-center rounded-md border border-border text-muted-foreground hover:bg-muted hover:text-foreground"
            aria-label="Copiar recibo"
          >
            <Copy className="h-3.5 w-3.5" strokeWidth={1.5} />
          </button>
          <button
            onClick={() => window.print()}
            className="grid h-8 w-8 place-items-center rounded-md border border-border text-muted-foreground hover:bg-muted hover:text-foreground"
            aria-label="Imprimir recibo"
          >
            <Printer className="h-3.5 w-3.5" strokeWidth={1.5} />
          </button>
          <button
            onClick={() => navigator.clipboard.writeText(receiptText)}
            className="grid h-8 w-8 place-items-center rounded-md border border-border text-muted-foreground hover:bg-muted hover:text-foreground"
            aria-label="Compartilhar recibo"
          >
            <Send className="h-3.5 w-3.5" strokeWidth={1.5} />
          </button>
        </div>
      </div>
    </InfoCard>
  );
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-4">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium text-foreground">{value}</span>
    </div>
  );
}

function HistoryLine({
  icon,
  label,
  date,
}: {
  icon: React.ReactNode;
  label: string;
  date: string;
}) {
  return (
    <li className="flex items-start gap-3">
      <span className="mt-0.5 text-emerald-600">{icon}</span>
      <span>
        <span className="block font-medium text-foreground">{label}</span>
        <span className="text-muted-foreground">{formatDate(date)}</span>
      </span>
    </li>
  );
}

function EditModal({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/35 px-4 py-6">
      <div className="flex max-h-[90vh] w-full max-w-3xl flex-col overflow-hidden rounded-lg border border-border bg-background shadow-2xl">
        <div className="flex items-center justify-between border-b border-border px-5 py-4">
          <h2 className="text-[16px] font-medium text-foreground">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            className="grid h-8 w-8 place-items-center rounded-full text-muted-foreground hover:bg-muted hover:text-foreground"
            aria-label="Fechar"
          >
            <XCircle className="h-4 w-4" strokeWidth={1.5} />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-5">{children}</div>
      </div>
    </div>
  );
}

function FormSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-lg border border-border bg-background p-4">
      <h3 className="text-[13px] font-medium text-foreground">{title}</h3>
      <div className="mt-3 grid gap-3 md:grid-cols-3">{children}</div>
    </section>
  );
}

function TextField({
  label,
  value,
  onChange,
  type = "text",
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-[12px] text-foreground">{label}</span>
      <input
        type={type}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="h-10 w-full rounded-md border border-border bg-background px-3 text-[13px] outline-none focus:border-foreground/40"
      />
    </label>
  );
}

function ModalActions({
  saving,
  onCancel,
  onSave,
}: {
  saving: boolean;
  onCancel: () => void;
  onSave: () => void;
}) {
  return (
    <div className="flex justify-end gap-2 border-t border-border pt-4">
      <button
        type="button"
        onClick={onCancel}
        disabled={saving}
        className="rounded-md border border-border px-4 py-2 text-[12.5px] font-medium text-foreground hover:bg-muted disabled:opacity-50"
      >
        Cancelar
      </button>
      <button
        type="button"
        onClick={onSave}
        disabled={saving}
        className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-[12.5px] font-medium text-primary-foreground hover:bg-graphite disabled:opacity-50"
      >
        {saving && <Loader2 className="h-3.5 w-3.5 animate-spin" strokeWidth={1.5} />}
        Salvar
      </button>
    </div>
  );
}

function itemCount(order: OrderRecord) {
  return order.items.reduce((sum, item) => sum + item.quantity, 0);
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

function buildReceiptText(order: OrderRecord) {
  return [
    `Pedido #${order.number ?? "-"}`,
    ...order.items.map(
      (item) => `${item.quantity}x ${item.product_name} - ${formatBRL(item.total_price)}`,
    ),
    `Total: ${formatBRL(order.total)}`,
    `Status: ${orderStatusLabelFor(order)}`,
  ].join("\n");
}
