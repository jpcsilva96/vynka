import { useSyncExternalStore } from "react";

// Confirmação do próprio app no lugar do window.confirm (lote de tela): abre de qualquer tela e
// devolve true (confirmou) ou false (cancelou, Esc ou clique fora). A janela fica no __root.
export interface ConfirmOptions {
  title: string;
  description?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  // Ação que apaga ou cancela algo: botão de confirmar em vermelho.
  destructive?: boolean;
}

interface ConfirmState extends ConfirmOptions {
  open: boolean;
}

let state: ConfirmState = { open: false, title: "" };
let resolver: ((value: boolean) => void) | null = null;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((listener) => listener());

export function confirmAction(options: ConfirmOptions): Promise<boolean> {
  // Um pedido aberto que ficou sem resposta conta como cancelado.
  resolver?.(false);
  state = { ...options, open: true };
  emit();
  return new Promise((resolve) => {
    resolver = resolve;
  });
}

export function answerConfirm(value: boolean) {
  resolver?.(value);
  resolver = null;
  state = { ...state, open: false };
  emit();
}

const closed: ConfirmState = { open: false, title: "" };

export function useConfirmDialog() {
  return useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    () => state,
    () => closed,
  );
}
