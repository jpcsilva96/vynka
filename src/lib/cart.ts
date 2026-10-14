import { useSyncExternalStore } from "react";

export interface CartItem {
  key: string; // productId + variantKey
  productId: string;
  variantId: string | null;
  name: string;
  variantLabel: string | null;
  image: string | null;
  price: number;
  quantity: number;
  // Estoque ao adicionar (null = sem controle). Pode ficar velho: o banco confere de novo ao gravar
  // o pedido.
  maxQty?: number | null;
}

// Um carrinho por loja: item de outra loja não chega ao checkout (o banco recusava com "produto não
// está mais disponível"). A chave antiga, única para todas as lojas, é descartada.
const LEGACY_KEY = "vynka:cart";
const keyFor = (id: string) => `vynka:cart:${id}`;
let storeId: string | null = null;
let items: CartItem[] = [];
const listeners = new Set<() => void>();

// Na prévia do editor o carrinho funciona só na memória: não lê nem grava o carrinho real.
let previewMode = false;
export function setCartPreviewMode(enabled: boolean) {
  if (previewMode === enabled) return;
  previewMode = enabled;
  items = [];
  if (!enabled) load();
  listeners.forEach((l) => l());
}

function load() {
  if (typeof window === "undefined" || previewMode || !storeId) return;
  try {
    const raw = window.localStorage.getItem(keyFor(storeId));
    items = raw ? (JSON.parse(raw) as CartItem[]) : [];
  } catch {
    items = [];
  }
}
function persist() {
  if (typeof window === "undefined") return;
  if (!previewMode && storeId) {
    try {
      window.localStorage.setItem(keyFor(storeId), JSON.stringify(items));
    } catch {
      // Navegador sem armazenamento: o carrinho segue só na memória.
    }
  }
  listeners.forEach((l) => l());
}

// Chamado pelo layout da loja quando a loja aberta é conhecida.
export function setCartStore(id: string | null) {
  if (storeId === id) return;
  storeId = id;
  items = [];
  if (typeof window !== "undefined") {
    try {
      window.localStorage.removeItem(LEGACY_KEY);
    } catch {
      // ignora
    }
  }
  load();
  listeners.forEach((l) => l());
}

const capped = (qty: number, max: number | null | undefined) =>
  max == null ? qty : Math.min(qty, max);

export function addToCart(item: Omit<CartItem, "quantity"> & { quantity?: number }) {
  const qty = item.quantity ?? 1;
  // Lista nova a cada mudança: alterar o item no lugar não avisa a tela (o cabeçalho ficava com a
  // contagem antiga ao somar num item que já estava no carrinho).
  const existing = items.some((i) => i.key === item.key);
  items = existing
    ? items.map((i) =>
        i.key === item.key
          ? { ...i, ...item, quantity: Math.max(1, capped(i.quantity + qty, item.maxQty)) }
          : i,
      )
    : [...items, { ...item, quantity: Math.max(1, capped(qty, item.maxQty)) }];
  persist();
}
export function updateQty(key: string, qty: number) {
  items = items
    .map((i) => (i.key === key ? { ...i, quantity: Math.max(1, capped(qty, i.maxQty)) } : i))
    .filter((i) => i.quantity > 0);
  persist();
}
export function removeItem(key: string) {
  items = items.filter((i) => i.key !== key);
  persist();
}
export function clearCart() {
  items = [];
  persist();
}

const subscribe = (cb: () => void) => {
  listeners.add(cb);
  return () => listeners.delete(cb);
};
const getSnapshot = () => items;
const getServerSnapshot = () => [] as CartItem[];

export function useCart() {
  const list = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  return list;
}
export function useCartTotals() {
  const list = useCart();
  const count = list.reduce((s, i) => s + i.quantity, 0);
  const subtotal = list.reduce((s, i) => s + i.price * i.quantity, 0);
  return { count, subtotal };
}

// UI state — drawer open/close
let drawerOpen = false;
const drawerListeners = new Set<() => void>();
export function openCart() {
  drawerOpen = true;
  drawerListeners.forEach((l) => l());
}
export function closeCart() {
  drawerOpen = false;
  drawerListeners.forEach((l) => l());
}
export function useCartDrawer() {
  return useSyncExternalStore(
    (cb) => {
      drawerListeners.add(cb);
      return () => drawerListeners.delete(cb);
    },
    () => drawerOpen,
    () => false,
  );
}

// WhatsApp configuration — placeholder; can be moved to config later
export const STORE_NAME = "VYNKA";

export function buildWhatsAppLink(text: string, phone?: string | null) {
  const digits = phone?.replace(/\D/g, "") ?? "";
  return `https://wa.me/${digits}?text=${encodeURIComponent(text)}`;
}

// Mensagem sobre um pedido já gravado (contato depois do pagamento; o WhatsApp não fecha venda):
// itens, frete e total vêm do banco, não do carrinho.
export function orderWhatsAppText(
  order: {
    number: number | null;
    total: number;
    shipping_amount?: number;
    order_items: {
      product_name: string;
      variant_name: string | null;
      quantity: number;
      total_price: number;
    }[];
  },
  topic: "order" | "delivery" = "order",
) {
  const brl = (v: number) =>
    new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(Number(v));
  const lines = order.order_items.map(
    (i) =>
      `• ${i.product_name}${i.variant_name ? ` — ${i.variant_name}` : ""} × ${i.quantity} — ${brl(i.total_price)}`,
  );
  const ref = order.number ? `pedido nº ${order.number}` : "meu pedido";
  const title =
    topic === "delivery"
      ? `Olá! Quero falar sobre a entrega do ${ref}:`
      : `Olá! Quero falar sobre o ${ref}:`;
  const shipping = order.shipping_amount ? `\nFrete: ${brl(order.shipping_amount)}` : "";
  return `${title}\n\n${lines.join("\n")}${shipping}\n\nTotal: ${brl(order.total)}`;
}
