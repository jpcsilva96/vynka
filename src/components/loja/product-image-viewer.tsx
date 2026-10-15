import {
  useEffect,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
  type WheelEvent as ReactWheelEvent,
} from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { ChevronLeft, ChevronRight, X } from "lucide-react";

// Foto do produto em tela cheia (lote 4.1d): a foto aparece inteira e amplia com os dedos (pinça),
// toque duplo, clique ou rodinha do mouse. Ampliada, arrasta para ver o resto; sem zoom, arrastar
// para o lado troca a foto.

const MAX_SCALE = 4;
const CLICK_SCALE = 2.5;

type View = { s: number; x: number; y: number };
const RESET: View = { s: 1, x: 0, y: 0 };

export function ProductImageViewer({
  open,
  onOpenChange,
  images,
  index,
  onIndexChange,
  alt,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  images: string[];
  index: number;
  onIndexChange: (index: number) => void;
  alt: string;
}) {
  const count = images.length;
  const go = (step: number) => {
    if (count < 2) return;
    onIndexChange((index + step + count) % count);
  };

  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-white" />
        <DialogPrimitive.Content
          className="fixed inset-0 z-50 flex flex-col bg-white outline-none"
          onKeyDown={(event) => {
            if (event.key === "ArrowLeft") go(-1);
            if (event.key === "ArrowRight") go(1);
          }}
        >
          <DialogPrimitive.Title className="sr-only">{alt}</DialogPrimitive.Title>
          <DialogPrimitive.Description className="sr-only">
            Foto ampliada. Use os dedos, clique ou a rodinha do mouse para aproximar.
          </DialogPrimitive.Description>
          <div className="flex h-14 shrink-0 items-center justify-between px-4">
            <span className="text-[12px] font-medium tracking-[0.16em] text-neutral-500">
              {count > 1 ? `${index + 1} / ${count}` : ""}
            </span>
            <DialogPrimitive.Close
              className="grid h-10 w-10 place-items-center text-black hover:bg-neutral-100"
              aria-label="Fechar"
            >
              <X className="h-6 w-6" />
            </DialogPrimitive.Close>
          </div>
          <div className="relative min-h-0 flex-1">
            {/* key: cada foto começa sem zoom. */}
            <ZoomStage
              key={`${index}-${images[index]}`}
              src={images[index] ?? ""}
              alt={alt}
              onSwipe={go}
            />
            {count > 1 && (
              <>
                <button
                  type="button"
                  onClick={() => go(-1)}
                  className="absolute left-2 top-1/2 hidden h-12 w-12 -translate-y-1/2 place-items-center bg-white/80 text-black hover:bg-white md:grid"
                  aria-label="Foto anterior"
                >
                  <ChevronLeft className="h-7 w-7" />
                </button>
                <button
                  type="button"
                  onClick={() => go(1)}
                  className="absolute right-2 top-1/2 hidden h-12 w-12 -translate-y-1/2 place-items-center bg-white/80 text-black hover:bg-white md:grid"
                  aria-label="Próxima foto"
                >
                  <ChevronRight className="h-7 w-7" />
                </button>
              </>
            )}
          </div>
          {count > 1 && (
            <div className="flex h-10 shrink-0 items-center justify-center gap-2">
              {images.map((url, dot) => (
                <button
                  key={`${url}-${dot}`}
                  type="button"
                  onClick={() => onIndexChange(dot)}
                  className={
                    dot === index
                      ? "h-2 w-2 rounded-full bg-black"
                      : "h-2 w-2 rounded-full bg-neutral-300"
                  }
                  aria-label={`Foto ${dot + 1}`}
                />
              ))}
            </div>
          )}
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}

function ZoomStage({
  src,
  alt,
  onSwipe,
}: {
  src: string;
  alt: string;
  onSwipe: (step: number) => void;
}) {
  const stageRef = useRef<HTMLDivElement>(null);
  const imgRef = useRef<HTMLImageElement>(null);
  const [view, setView] = useState<View>(RESET);
  const viewRef = useRef<View>(RESET);
  viewRef.current = view;

  // Gesto em andamento: dedos/mouse ativos e o ponto de partida de cada tipo de gesto.
  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const pinch = useRef<{ dist: number; mid: { x: number; y: number }; view: View } | null>(null);
  const drag = useRef<{ x: number; y: number; view: View; moved: boolean; type: string } | null>(
    null,
  );
  const lastTap = useRef(0);

  // Ponto relativo ao centro da área da foto.
  const local = (clientX: number, clientY: number) => {
    const rect = stageRef.current!.getBoundingClientRect();
    return { x: clientX - rect.left - rect.width / 2, y: clientY - rect.top - rect.height / 2 };
  };

  // Não deixa a foto ampliada sair da tela: o deslocamento máximo é a sobra de cada lado.
  const clamp = (next: View): View => {
    const stage = stageRef.current;
    const img = imgRef.current;
    const s = Math.min(MAX_SCALE, Math.max(1, next.s));
    if (!stage || !img || s === 1) return RESET;
    const maxX = Math.max(0, (img.offsetWidth * s - stage.clientWidth) / 2);
    const maxY = Math.max(0, (img.offsetHeight * s - stage.clientHeight) / 2);
    return {
      s,
      x: Math.min(maxX, Math.max(-maxX, next.x)),
      y: Math.min(maxY, Math.max(-maxY, next.y)),
    };
  };

  // Aproxima mantendo parado o ponto sob o dedo/cursor.
  const zoomAt = (point: { x: number; y: number }, s: number, from: View = viewRef.current) => {
    const ratio = Math.min(MAX_SCALE, Math.max(1, s)) / from.s;
    setView(
      clamp({
        s,
        x: point.x - (point.x - from.x) * ratio,
        y: point.y - (point.y - from.y) * ratio,
      }),
    );
  };

  const toggleAt = (clientX: number, clientY: number) => {
    if (viewRef.current.s > 1) setView(RESET);
    else zoomAt(local(clientX, clientY), CLICK_SCALE);
  };

  const onPointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    try {
      event.currentTarget.setPointerCapture(event.pointerId);
    } catch {
      // Ponteiro já solto: segue sem captura.
    }
    pointers.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
    if (pointers.current.size === 2) {
      const [a, b] = [...pointers.current.values()];
      pinch.current = {
        dist: Math.hypot(a.x - b.x, a.y - b.y),
        mid: local((a.x + b.x) / 2, (a.y + b.y) / 2),
        view: viewRef.current,
      };
      drag.current = null;
    } else if (pointers.current.size === 1) {
      drag.current = {
        x: event.clientX,
        y: event.clientY,
        view: viewRef.current,
        moved: false,
        type: event.pointerType,
      };
    }
  };

  const onPointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (!pointers.current.has(event.pointerId)) return;
    pointers.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
    if (pinch.current && pointers.current.size >= 2) {
      const [a, b] = [...pointers.current.values()];
      const start = pinch.current;
      const s = Math.min(
        MAX_SCALE,
        Math.max(1, start.view.s * (Math.hypot(a.x - b.x, a.y - b.y) / start.dist)),
      );
      const mid = local((a.x + b.x) / 2, (a.y + b.y) / 2);
      const ratio = s / start.view.s;
      setView(
        clamp({
          s,
          x: mid.x - (start.mid.x - start.view.x) * ratio,
          y: mid.y - (start.mid.y - start.view.y) * ratio,
        }),
      );
      return;
    }
    const current = drag.current;
    if (!current) return;
    const dx = event.clientX - current.x;
    const dy = event.clientY - current.y;
    if (Math.abs(dx) > 6 || Math.abs(dy) > 6) current.moved = true;
    if (current.view.s > 1)
      setView(clamp({ ...current.view, x: current.view.x + dx, y: current.view.y + dy }));
  };

  const onPointerUp = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (!pointers.current.has(event.pointerId)) return;
    pointers.current.delete(event.pointerId);
    if (pinch.current) {
      // Soltou um dos dedos: o que ficou continua arrastando dali.
      pinch.current = null;
      const rest = [...pointers.current.values()][0];
      drag.current = rest
        ? { x: rest.x, y: rest.y, view: viewRef.current, moved: true, type: "touch" }
        : null;
      return;
    }
    const current = drag.current;
    drag.current = null;
    if (!current || event.type === "pointercancel") return;
    const dx = event.clientX - current.x;
    const dy = event.clientY - current.y;
    if (!current.moved) {
      if (current.type === "mouse") {
        toggleAt(event.clientX, event.clientY);
      } else {
        // Toque duplo amplia/volta; toque simples não faz nada.
        const now = Date.now();
        if (now - lastTap.current < 300) {
          lastTap.current = 0;
          toggleAt(event.clientX, event.clientY);
        } else {
          lastTap.current = now;
        }
      }
      return;
    }
    // Sem zoom, arrastar para o lado troca a foto.
    if (current.view.s === 1 && Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy))
      onSwipe(dx < 0 ? 1 : -1);
  };

  const onWheel = (event: ReactWheelEvent<HTMLDivElement>) => {
    zoomAt(
      local(event.clientX, event.clientY),
      viewRef.current.s * (event.deltaY < 0 ? 1.2 : 1 / 1.2),
    );
  };

  // Girou o celular ou mudou o tamanho da janela: refaz o limite do arrasto.
  useEffect(() => {
    const onResize = () => setView((current) => clamp(current));
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  return (
    <div
      ref={stageRef}
      className="absolute inset-0 flex touch-none select-none items-center justify-center overflow-hidden"
      style={{ cursor: view.s > 1 ? "zoom-out" : "zoom-in" }}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
      onWheel={onWheel}
    >
      {src && (
        <img
          ref={imgRef}
          src={src}
          alt={alt}
          draggable={false}
          className="max-h-full max-w-full object-contain"
          style={{
            transform: `translate(${view.x}px, ${view.y}px) scale(${view.s})`,
            transition: pointers.current.size ? "none" : "transform 150ms ease-out",
          }}
        />
      )}
    </div>
  );
}
