import { ACCEPTED_BROWSER_MIME, DOC_SLOTS, type DocSlot } from "../../shared/config";
import { HEADER_BYTES, matchesSignature, validateFileMeta } from "../../shared/files";

/** Validação no navegador: extensão, tamanho, MIME e assinatura real (primeiros bytes). */
export async function checkFile(slot: DocSlot, file: File): Promise<string | null> {
  const meta = validateFileMeta(slot, file.name, file.size);
  if (meta) return meta;
  const def = DOC_SLOTS[slot];
  if (file.type && !ACCEPTED_BROWSER_MIME[def.kind].includes(file.type.toLowerCase())) return "Tipo de arquivo não aceito.";
  const head = new Uint8Array(await file.slice(0, HEADER_BYTES).arrayBuffer());
  if (!matchesSignature(def.kind, head, file.size)) return "O conteúdo do arquivo não corresponde ao formato informado.";
  return null;
}

const isHeic = (f: File) => /\.heic$/i.test(f.name) || /hei[cf]/i.test(f.type);

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = url;
  });
}

/** URL de pré-visualização. HEIC é convertido no navegador apenas para exibição. */
export async function previewUrl(file: File): Promise<string | undefined> {
  const direct = URL.createObjectURL(file);
  try {
    await loadImage(direct);
    return direct;
  } catch {
    URL.revokeObjectURL(direct);
  }
  if (!isHeic(file)) return undefined;
  try {
    const { default: heic2any } = await import("heic2any");
    const out = await heic2any({ blob: file, toType: "image/jpeg", quality: 0.85 });
    return URL.createObjectURL(Array.isArray(out) ? out[0] : out);
  } catch {
    return undefined;
  }
}

/** Miniatura JPEG (≤ ~450 KB) para o PDF-resumo. */
export async function thumbnailFrom(url: string | undefined): Promise<string | undefined> {
  if (!url) return undefined;
  try {
    const img = await loadImage(url);
    const scale = Math.min(1, 1100 / Math.max(img.naturalWidth, img.naturalHeight));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(img.naturalWidth * scale);
    canvas.height = Math.round(img.naturalHeight * scale);
    canvas.getContext("2d")!.drawImage(img, 0, 0, canvas.width, canvas.height);
    for (const q of [0.82, 0.7, 0.55]) {
      const data = canvas.toDataURL("image/jpeg", q);
      if (data.length < 580_000) return data;
    }
  } catch {
    /* miniatura é opcional */
  }
  return undefined;
}
