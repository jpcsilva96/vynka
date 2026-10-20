import { useSyncExternalStore } from "react";

// Janela de entrar/criar conta da loja (catálogo lote 5, §9): abre de qualquer ponto da loja
// (cabeçalho, favoritar) sem sair da página.
export type CustomerAuthMode = "login" | "signup" | "forgot";

let state: { open: boolean; mode: CustomerAuthMode } = { open: false, mode: "login" };
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((listener) => listener());

export function openCustomerAuth(mode: CustomerAuthMode = "login") {
  state = { open: true, mode };
  emit();
}

export function closeCustomerAuth() {
  state = { ...state, open: false };
  emit();
}

const closed = { open: false, mode: "login" as CustomerAuthMode };

export function useCustomerAuthDialog() {
  return useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    () => state,
    () => closed,
  );
}
