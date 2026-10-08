import { useEffect, useState } from "react";
import type { CatalogVisualSettings, StoreBanner } from "@/lib/store-settings";

// Prévia fiel da personalização (escopo do catálogo, §3, lote 2c): o editor abre a própria loja
// numa moldura (iframe) e manda por mensagem as mudanças ainda não publicadas. A loja só aceita
// mensagens da mesma origem e só entra no modo prévia quando está dentro do editor.

export const PREVIEW_EDITOR_PATH = "/admin/editor-layout";

export interface PreviewOverrides {
  /** Aparelho escolhido no editor: decide qual tamanho do logo a prévia ajusta. */
  device: PreviewDevice;
  name: string;
  description: string;
  logo_url: string;
  favicon_url: string;
  visual: CatalogVisualSettings;
  banners: StoreBanner[];
}

export type PreviewDevice = "mobile" | "desktop";

type EditorMessage = { type: "vynka-preview:update"; overrides: PreviewOverrides };
type FrameMessage =
  | { type: "vynka-preview:ready" }
  | { type: "vynka-preview:logo-size"; device: PreviewDevice; height: number };

/** A loja está dentro da moldura do editor (mesma origem)? */
export function isPreviewFrame() {
  if (typeof window === "undefined" || window.self === window.top) return false;
  try {
    return (
      window.top!.location.origin === window.location.origin &&
      window.top!.location.pathname === PREVIEW_EDITOR_PATH
    );
  } catch {
    // Moldura de outro site: nunca é prévia.
    return false;
  }
}

/** Lado da loja: recebe as mudanças do editor. */
export function usePreviewOverrides(enabled: boolean) {
  const [overrides, setOverrides] = useState<PreviewOverrides | null>(null);
  useEffect(() => {
    if (!enabled) return;
    const onMessage = (event: MessageEvent<EditorMessage>) => {
      if (event.origin !== window.location.origin || event.source !== window.parent) return;
      if (event.data?.type === "vynka-preview:update") setOverrides(event.data.overrides);
    };
    window.addEventListener("message", onMessage);
    postToEditor({ type: "vynka-preview:ready" });
    return () => window.removeEventListener("message", onMessage);
  }, [enabled]);
  return overrides;
}

export function postToEditor(message: FrameMessage) {
  window.parent.postMessage(message, window.location.origin);
}

/** Lado do editor: manda as mudanças e escuta o tamanho do logo. */
export function sendPreviewUpdate(frame: HTMLIFrameElement | null, overrides: PreviewOverrides) {
  frame?.contentWindow?.postMessage(
    { type: "vynka-preview:update", overrides } satisfies EditorMessage,
    window.location.origin,
  );
}

export function isFrameMessage(event: MessageEvent, frame: HTMLIFrameElement | null): event is MessageEvent<FrameMessage> {
  return (
    event.origin === window.location.origin &&
    !!frame &&
    event.source === frame.contentWindow &&
    typeof event.data?.type === "string" &&
    event.data.type.startsWith("vynka-preview:")
  );
}
