// Redução de imagem no navegador antes de subir (escopo do catálogo §7.1, lote 4.1a): o plano
// grátis do Supabase não redimensiona na hora, e a foto original (~1 MB) pesava no tráfego.

export interface ResizeOptions {
  maxWidth: number;
  maxHeight: number;
  quality?: number;
}

// Formatos que o navegador redimensiona sem perder nada importante. GIF (animação) e SVG (vetor)
// sobem como vieram.
const RESIZABLE = new Set(["image/jpeg", "image/png", "image/webp", "image/bmp", "image/avif"]);

export function canResize(file: File) {
  return RESIZABLE.has(file.type);
}

function encode(canvas: HTMLCanvasElement, type: string, quality: number) {
  return new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, type, quality));
}

function hasTransparency(ctx: CanvasRenderingContext2D, width: number, height: number) {
  const data = ctx.getImageData(0, 0, width, height).data;
  for (let i = 3; i < data.length; i += 4) if (data[i] < 255) return true;
  return false;
}

// Reduz para caber em maxWidth × maxHeight (sem aumentar) e converte para WebP. Navegador que não
// gera WebP (Safari antigo) cai para JPEG, ou PNG quando há transparência.
export async function resizeImage(
  file: Blob,
  { maxWidth, maxHeight, quality = 0.82 }: ResizeOptions,
) {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, maxWidth / bitmap.width, maxHeight / bitmap.height);
  const width = Math.max(1, Math.round(bitmap.width * scale));
  const height = Math.max(1, Math.round(bitmap.height * scale));
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Não foi possível preparar a imagem.");
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(bitmap, 0, 0, width, height);
  bitmap.close();

  let blob = await encode(canvas, "image/webp", quality);
  if (!blob || blob.type !== "image/webp") {
    const fallback = hasTransparency(ctx, width, height) ? "image/png" : "image/jpeg";
    blob = await encode(canvas, fallback, quality);
  }
  if (!blob) throw new Error("Não foi possível preparar a imagem.");
  return { blob, width, height, ext: extFor(blob.type) };
}

export function extFor(type: string) {
  if (type === "image/webp") return "webp";
  if (type === "image/png") return "png";
  return "jpg";
}

// Foto de produto: versão da página do produto e miniatura das listas, com o mesmo nome-base
// (`<base>.full.<ext>` e `<base>.thumb.<ext>`). A tela acha a miniatura pelo nome, sem coluna nova.
export const PRODUCT_FULL = { maxWidth: 1200, maxHeight: 1500 } satisfies ResizeOptions;
export const PRODUCT_THUMB = {
  maxWidth: 600,
  maxHeight: 750,
  quality: 0.78,
} satisfies ResizeOptions;

const FULL_RE = /\.full\.(webp|jpg|png)$/;

// Miniatura de uma foto de produto. Foto antiga (sem `.full.`) ou de fora: devolve a própria URL.
export function thumbUrl(url: string | null | undefined): string {
  if (!url) return "";
  try {
    const parsed = new URL(url);
    if (!FULL_RE.test(parsed.pathname)) return url;
    // O bucket é público: a miniatura sai pelo endereço público, sem assinatura.
    const path = parsed.pathname
      .replace("/storage/v1/object/sign/", "/storage/v1/object/public/")
      .replace(FULL_RE, ".thumb.$1");
    return `${parsed.origin}${path}`;
  } catch {
    return url;
  }
}
