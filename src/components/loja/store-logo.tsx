import { useEffect, useRef, useState, type CSSProperties, type PointerEvent } from "react";
import { logoSlot, type CatalogVisualSettings } from "@/lib/store-settings";
import { postToEditor, type PreviewDevice } from "@/lib/storefront-preview";
import { cn } from "@/lib/utils";

// Logo no espaço fixo do cabeçalho (escopo do catálogo, §3): um tamanho para celular e outro para
// computador; cresce até caber no espaço, sem achatar nem espichar, e o cabeçalho nunca cresce.
// Na prévia do editor, clicar no logo mostra alças para ajustar o tamanho arrastando.
export function StoreLogo({
  src,
  alt,
  visual,
  previewDevice,
}: {
  src: string;
  alt: string;
  visual: CatalogVisualSettings;
  previewDevice: PreviewDevice | null;
}) {
  if (!previewDevice) {
    return (
      <img
        src={src}
        alt={alt}
        className="h-[var(--logo-h)] w-auto max-w-[var(--logo-max-w)] shrink-0 object-contain md:h-[var(--logo-h-md)] md:max-w-[var(--logo-max-w-md)]"
        style={
          {
            "--logo-h": `${visual.header_logo_height_mobile}px`,
            "--logo-h-md": `${visual.header_logo_height_desktop}px`,
            "--logo-max-w": `${logoSlot.mobile.width}px`,
            "--logo-max-w-md": `${logoSlot.desktop.width}px`,
          } as CSSProperties
        }
      />
    );
  }
  return <ResizableLogo src={src} alt={alt} visual={visual} device={previewDevice} />;
}

type Corner = "nw" | "ne" | "sw" | "se";

function ResizableLogo({ src, alt, visual, device }: { src: string; alt: string; visual: CatalogVisualSettings; device: PreviewDevice }) {
  const mobile = device === "mobile";
  const slot = logoSlot[device];
  const saved = mobile ? visual.header_logo_height_mobile : visual.header_logo_height_desktop;
  const [ratio, setRatio] = useState(1);
  const [selected, setSelected] = useState(false);
  const [dragHeight, setDragHeight] = useState<number | null>(null);
  const boxRef = useRef<HTMLSpanElement>(null);
  const drag = useRef<{ x: number; y: number; height: number; sx: number; sy: number } | null>(null);

  // Maior altura que ainda cabe no espaço, mantendo a proporção da imagem.
  const maxHeight = Math.max(logoSlot.minHeight, Math.min(slot.height, Math.floor(slot.width / ratio)));
  const clamp = (value: number) => Math.round(Math.min(maxHeight, Math.max(logoSlot.minHeight, value)));
  const height = clamp(dragHeight ?? saved);

  useEffect(() => {
    if (!selected) return;
    const onDown = (event: globalThis.PointerEvent) => {
      if (!boxRef.current?.contains(event.target as Node)) setSelected(false);
    };
    document.addEventListener("pointerdown", onDown);
    return () => document.removeEventListener("pointerdown", onDown);
  }, [selected]);

  const startDrag = (corner: Corner) => (event: PointerEvent<HTMLSpanElement>) => {
    event.preventDefault();
    event.stopPropagation();
    try {
      event.currentTarget.setPointerCapture(event.pointerId);
    } catch {
      // Sem captura o arraste continua funcionando enquanto o ponteiro estiver sobre a alça.
    }
    drag.current = {
      x: event.clientX,
      y: event.clientY,
      height,
      sx: corner.endsWith("e") ? 1 : -1,
      sy: corner.startsWith("s") ? 1 : -1,
    };
  };
  const onDrag = (event: PointerEvent<HTMLSpanElement>) => {
    const start = drag.current;
    if (!start) return;
    // Arraste livre nas duas direções; vale o movimento maior, convertido para altura.
    const byWidth = ((event.clientX - start.x) * start.sx) / ratio;
    const byHeight = (event.clientY - start.y) * start.sy;
    const delta = Math.abs(byWidth) > Math.abs(byHeight) ? byWidth : byHeight;
    setDragHeight(clamp(start.height + delta));
  };
  const endDrag = () => {
    if (!drag.current) return;
    drag.current = null;
    if (dragHeight != null) postToEditor({ type: "vynka-preview:logo-size", device, height: dragHeight });
    setDragHeight(null);
  };

  return (
    <span
      ref={boxRef}
      className={cn("relative inline-flex shrink-0 cursor-pointer", selected && "outline outline-2 outline-offset-2 outline-sky-500")}
      onClick={(event) => {
        // Na prévia, clicar no logo seleciona em vez de navegar.
        event.preventDefault();
        event.stopPropagation();
        setSelected(true);
      }}
      title="Clique e arraste as alças para mudar o tamanho do logo"
    >
      <img
        src={src}
        alt={alt}
        draggable={false}
        onLoad={(event) => {
          const image = event.currentTarget;
          if (image.naturalWidth && image.naturalHeight) setRatio(image.naturalWidth / image.naturalHeight);
        }}
        style={{ height, maxWidth: slot.width }}
        className="block w-auto object-contain"
      />
      {selected &&
        (["nw", "ne", "sw", "se"] as Corner[]).map((corner) => (
          <span
            key={corner}
            onPointerDown={startDrag(corner)}
            onPointerMove={onDrag}
            onPointerUp={endDrag}
            onPointerCancel={endDrag}
            className={cn(
              "absolute h-4 w-4 touch-none rounded-full border-2 border-white bg-sky-500 shadow",
              corner === "nw" && "-left-3 -top-3 cursor-nwse-resize",
              corner === "ne" && "-right-3 -top-3 cursor-nesw-resize",
              corner === "sw" && "-bottom-3 -left-3 cursor-nesw-resize",
              corner === "se" && "-bottom-3 -right-3 cursor-nwse-resize",
            )}
          />
        ))}
    </span>
  );
}
