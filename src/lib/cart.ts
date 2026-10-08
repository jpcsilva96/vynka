import { useEffect, useSyncExternalStore } from "react";

export interface CartItem {
  key: string; // productId + variantKey
  productId: string;
  variantId: string | null;
  name: string;
  variantLabel: string | null;
  image: string | null;
  price: number;
  quantity: number;
}

const KEY = "vynka:cart";
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
  if (typeof window === "undefined" || previewMode) return;
  try {
    const raw = window.localStorage.getItem(KEY);
    items = raw ? (JSON.parse(raw) as CartItem[]) : [];
  } catch {
    items = [];
  }
}
function persist() {
  if (typeof window === "undefined") return;
  if (!previewMode) window.localStorage.setItem(KEY, JSON.stringify(items));
  listeners.forEach((l) => l());
}
load();

export function addToCart(item: Omit<CartItem, "quantity"> & { quantity?: number }) {
  const qty = item.quantity ?? 1;
  const existing = items.find((i) => i.key === item.key);
  if (existing) existing.quantity += qty;
  else items = [...items, { ...item, quantity: qty }];
  persist();
}
export function updateQty(key: string, qty: number) {
  items = items
    .map((i) => (i.key === key ? { ...i, quantity: Math.max(1, qty) } : i))
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

// Convenience effect: rehydrate on mount for SSR safety
export function useCartHydration() {
  useEffect(() => {
    load();
    listeners.forEach((l) => l());
  }, []);
}
