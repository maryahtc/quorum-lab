import type { Imagem } from "./model";

export const ACEITOS = ["image/jpeg", "image/png", "image/webp"];
export const ACEITOS_ATTR = ".jpg,.jpeg,.png,.webp,image/jpeg,image/png,image/webp";

/** Lado maior máximo da imagem no PDF: nitidez de sobra em A4, sem PDFs gigantes. */
const MAX_LADO = 3000;
/** PNG até este tamanho é embutido como está (prints com texto ficam mais nítidos). */
const PNG_MAX_BYTES = 6 * 1024 * 1024;

export class ImagemInvalida extends Error {}

const ext = (name: string) => name.toLowerCase().match(/\.([a-z0-9]+)$/)?.[1] ?? "";

export function aceita(file: File) {
  if (file.type) return ACEITOS.includes(file.type.toLowerCase());
  return ["jpg", "jpeg", "png", "webp"].includes(ext(file.name));
}

function carregar(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new ImagemInvalida("Não foi possível ler esta imagem."));
    img.src = url;
  });
}

/**
 * Prepara a imagem para o PDF, preservando sempre a proporção original:
 * - PNG de tamanho razoável segue sem alteração;
 * - JPG passa pelo canvas para aplicar a orientação EXIF (fotos de celular);
 * - WEBP é convertido (o PDF só aceita JPG e PNG);
 * - imagens muito grandes são reduzidas proporcionalmente, sem recorte.
 */
export async function prepararImagem(file: File): Promise<Imagem> {
  if (!aceita(file)) throw new ImagemInvalida("Formato não aceito. Use JPG, PNG ou WEBP.");
  const url = URL.createObjectURL(file);
  try {
    const img = await carregar(url);
    const largura = img.naturalWidth;
    const altura = img.naturalHeight;
    if (!largura || !altura) throw new ImagemInvalida("Imagem vazia.");

    const png = (file.type || "").toLowerCase() === "image/png" || ext(file.name) === "png";
    if (png && Math.max(largura, altura) <= MAX_LADO && file.size <= PNG_MAX_BYTES) {
      const bytes = new Uint8Array(await file.arrayBuffer());
      return { bytes, formato: "png", largura, altura, url };
    }

    const escala = Math.min(1, MAX_LADO / Math.max(largura, altura));
    const w = Math.max(1, Math.round(largura * escala));
    const h = Math.max(1, Math.round(altura * escala));
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d")!;
    ctx.fillStyle = "#ffffff"; // transparência vira branco, como na página do PDF
    ctx.fillRect(0, 0, w, h);
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(img, 0, 0, w, h);
    const blob = await new Promise<Blob | null>((r) => canvas.toBlob(r, "image/jpeg", 0.92));
    if (!blob) throw new ImagemInvalida("Não foi possível processar esta imagem.");
    URL.revokeObjectURL(url);
    return { bytes: new Uint8Array(await blob.arrayBuffer()), formato: "jpg", largura: w, altura: h, url: URL.createObjectURL(blob) };
  } catch (err) {
    URL.revokeObjectURL(url);
    throw err instanceof ImagemInvalida ? err : new ImagemInvalida("Não foi possível ler esta imagem.");
  }
}

export function liberar(img?: Imagem) {
  if (img?.url) URL.revokeObjectURL(img.url);
}

/** Imagens presentes num evento de colar (Cmd/Ctrl + V) ou soltar. */
export function imagensDe(dt: DataTransfer | null): File[] {
  if (!dt) return [];
  const files = Array.from(dt.files ?? []);
  if (files.length) return files.filter((f) => f.type.startsWith("image/") || aceita(f));
  return Array.from(dt.items ?? [])
    .filter((i) => i.kind === "file" && i.type.startsWith("image/"))
    .map((i) => i.getAsFile())
    .filter((f): f is File => !!f);
}
