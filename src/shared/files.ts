import { DOC_SLOTS, type DocSlot, type FileKind } from "./config";

export function extensionOf(name: string): string {
  const m = /\.([a-z0-9]+)$/i.exec(name.trim());
  return m ? m[1].toLowerCase() : "";
}

/** Nome seguro para armazenamento: sem acentos, espaços, barras ou caracteres de controle. */
export function sanitizeFileName(name: string): string {
  const ext = extensionOf(name);
  const base = name
    .replace(/\.[^.]*$/, "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-zA-Z0-9_-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 60)
    .toLowerCase();
  return `${base || "arquivo"}${ext ? "." + ext : ""}`;
}

export const HEADER_BYTES = 96;

/**
 * Confere a assinatura real do arquivo (primeiros bytes), independente da
 * extensão ou do MIME informado pelo navegador.
 */
export function matchesSignature(kind: FileKind, head: Uint8Array, totalSize: number): boolean {
  const ascii = (from: number, to: number) => String.fromCharCode(...head.slice(from, to));
  switch (kind) {
    case "image": {
      const jpeg = head[0] === 0xff && head[1] === 0xd8 && head[2] === 0xff;
      const png = head[0] === 0x89 && ascii(1, 4) === "PNG";
      const heic = ascii(4, 8) === "ftyp" && ["heic", "heix", "heim", "heis", "hevc", "hevx", "mif1", "msf1"].includes(ascii(8, 12));
      return jpeg || png || heic;
    }
    case "stl": {
      if (totalSize < 84) return false;
      if (ascii(0, 5).toLowerCase() === "solid") return true;
      const triangles = new DataView(head.buffer, head.byteOffset, head.byteLength).getUint32(80, true);
      return totalSize === 84 + triangles * 50;
    }
    case "zip":
      return head[0] === 0x50 && head[1] === 0x4b && head[2] === 0x03 && head[3] === 0x04;
  }
}

export function validateFileMeta(slot: DocSlot, name: string, size: number): string | null {
  const def = DOC_SLOTS[slot];
  const ext = extensionOf(name);
  if (!def.extensoes.includes(ext)) return `Formato não aceito. Envie ${def.extensoes.map((e) => "." + e).join(", ")}.`;
  if (size <= 0) return "Arquivo vazio.";
  if (size > def.maxMB * 1024 * 1024) return `Arquivo acima do limite de ${def.maxMB >= 1024 ? def.maxMB / 1024 + " GB" : def.maxMB + " MB"}.`;
  return null;
}
