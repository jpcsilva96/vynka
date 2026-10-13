import { X } from "lucide-react";
import { useEffect, type CSSProperties, type ReactNode } from "react";
import { cn } from "@/lib/utils";

// Gaveta lateral da loja (menu do celular, filtros): fecha com Esc, clique fora ou no X; a página por
// trás não rola enquanto ela está aberta.
export function StoreDrawer({
  open,
  onClose,
  title,
  side = "left",
  style,
  footer,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  side?: "left" | "right";
  style?: CSSProperties;
  footer?: ReactNode;
  children: ReactNode;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [open, onClose]);

  return (
    <>
      <div
        onClick={onClose}
        className={cn(
          "fixed inset-0 z-50 bg-black/30 transition-opacity",
          open ? "opacity-100" : "pointer-events-none opacity-0",
        )}
      />
      <aside
        role="dialog"
        aria-modal="true"
        aria-label={title}
        aria-hidden={!open}
        inert={!open}
        className={cn(
          "fixed top-0 z-50 flex h-svh w-[86%] max-w-[360px] flex-col bg-white shadow-2xl transition-transform duration-300",
          side === "left" ? "left-0" : "right-0",
          open ? "translate-x-0" : side === "left" ? "-translate-x-full" : "translate-x-full",
        )}
        style={style}
      >
        <div className="flex items-center justify-between border-b border-current/10 px-5 py-3">
          <span className="text-[12px] font-semibold uppercase tracking-[0.2em]">{title}</span>
          <button
            type="button"
            onClick={onClose}
            className="grid h-11 w-11 place-items-center rounded-full hover:bg-black/5"
            aria-label={`Fechar ${title.toLowerCase()}`}
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto">{children}</div>
        {footer && <div className="border-t border-current/10">{footer}</div>}
      </aside>
    </>
  );
}
