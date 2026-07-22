import { useRef, useState } from "react";
import { GripVertical, Loader2, UploadCloud, X } from "lucide-react";
import { uploadProductImage, type ProductImage } from "@/lib/products";
import { cn } from "@/lib/utils";

interface Props {
  images: ProductImage[];
  onChange: (images: ProductImage[]) => void;
}

export function ImageUploader({ images, onChange }: Props) {
  const [busy, setBusy] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const dragIndex = useRef<number | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);

  const handleFiles = async (files: FileList | File[]) => {
    setBusy(true);
    try {
      const uploaded: ProductImage[] = [];
      for (const file of Array.from(files)) {
        if (!file.type.startsWith("image/")) continue;
        const image = await uploadProductImage(file);
        uploaded.push(image);
      }
      onChange([...images, ...uploaded].map((img, i) => ({ ...img, position: i })));
    } catch (e) {
      console.error(e);
      alert("Nao foi possivel enviar as imagens.");
    } finally {
      setBusy(false);
    }
  };

  const reorder = (from: number, to: number) => {
    if (from === to) return;
    const next = images.slice();
    const [moved] = next.splice(from, 1);
    next.splice(to, 0, moved);
    onChange(next.map((img, i) => ({ ...img, position: i })));
  };

  const removeAt = (i: number) =>
    onChange(images.filter((_, idx) => idx !== i).map((img, idx) => ({ ...img, position: idx })));

  return (
    <div className="space-y-3">
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragOver(false);
          if (e.dataTransfer.files?.length) handleFiles(e.dataTransfer.files);
        }}
        onClick={() => fileInput.current?.click()}
        className={cn(
          "group relative flex cursor-pointer flex-col items-center justify-center gap-2 rounded-md border border-dashed border-border bg-background/40 px-6 py-10 text-center transition-colors hover:border-foreground/40 hover:bg-muted/40",
          dragOver && "border-foreground/60 bg-muted/60",
        )}
      >
        <div className="grid h-10 w-10 place-items-center rounded-full bg-muted text-muted-foreground">
          {busy ? (
            <Loader2 className="h-4 w-4 animate-spin" strokeWidth={1.5} />
          ) : (
            <UploadCloud className="h-4 w-4" strokeWidth={1.5} />
          )}
        </div>
        <div className="text-[13px] text-foreground">
          Arraste imagens aqui ou <span className="underline underline-offset-2">selecione</span>
        </div>
        <div className="text-[12px] text-muted-foreground">PNG, JPG ou WEBP ate 10MB</div>
        <input
          ref={fileInput}
          type="file"
          multiple
          accept="image/*"
          className="hidden"
          onChange={(e) => {
            if (e.target.files) handleFiles(e.target.files);
            e.target.value = "";
          }}
        />
      </div>

      {images.length > 0 && (
        <div className="grid grid-cols-3 gap-3 sm:grid-cols-4 md:grid-cols-6">
          {images.map((img, i) => (
            <div
              key={img.storage_path ?? img.url}
              draggable
              onDragStart={() => (dragIndex.current = i)}
              onDragOver={(e) => e.preventDefault()}
              onDrop={() => {
                if (dragIndex.current !== null) reorder(dragIndex.current, i);
                dragIndex.current = null;
              }}
              className="group relative aspect-square overflow-hidden rounded-md border border-border bg-muted"
            >
              <img src={img.url} alt="" className="h-full w-full object-cover" draggable={false} />
              {i === 0 && (
                <span className="absolute left-1.5 top-1.5 rounded bg-foreground px-1.5 py-0.5 text-[10px] uppercase tracking-wider text-background">
                  Capa
                </span>
              )}
              <button
                type="button"
                onClick={() => removeAt(i)}
                className="absolute right-1.5 top-1.5 grid h-6 w-6 place-items-center rounded-full bg-background/90 text-foreground opacity-0 shadow-sm transition-opacity group-hover:opacity-100"
              >
                <X className="h-3 w-3" strokeWidth={2} />
              </button>
              <span className="absolute bottom-1.5 left-1.5 grid h-6 w-6 cursor-grab place-items-center rounded bg-background/80 text-muted-foreground opacity-0 group-hover:opacity-100">
                <GripVertical className="h-3 w-3" strokeWidth={1.5} />
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
