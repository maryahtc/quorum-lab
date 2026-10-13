import { TOOTH_ORDER } from "./config";
import type { Solicitacao } from "./schema";

export const sortTeeth = (teeth: number[]) =>
  [...teeth].sort((a, b) => TOOTH_ORDER.indexOf(a) - TOOTH_ORDER.indexOf(b));

export const formatTeeth = (teeth: number[]) => (teeth.length ? sortTeeth(teeth).join(" · ") : "—");

export const elementos = (n: number) => `${n} ${n === 1 ? "elemento" : "elementos"}`;

export const LABELS = {
  possuiResina: { nao: "Não", sim: "Sim" },
  intencao: { faceta: "Faceta", recontorno: "Recontorno", ambos: "Ambos" },
  intencaoDescricao: {
    faceta: "Recobrimento de toda a face vestibular",
    recontorno: "Restauração parcial / acréscimos localizados",
    ambos: "Varia conforme o elemento",
  },
  alteracaoCor: { sim: "Sim", nao: "Não", indefinido: "Ainda não definido" },
  apresentacao: { pdf: "PDF técnico", conversa: "Conversa rápida com o planejador", ambos: "PDF técnico + conversa" },
  periodo: { manha: "Manhã", tarde: "Tarde", indiferente: "Tanto faz", "": "—" },
  entrega: { whatsapp: "WhatsApp", email: "E-mail" },
} as const;

export function enderecoCompleto(c: Solicitacao["clinica"]): string {
  const l1 = [c.rua, c.numero].filter(Boolean).join(", ") + (c.complemento ? ` — ${c.complemento}` : "");
  return `${l1}\n${c.bairro} · ${c.cidade}/${c.estado} · CEP ${c.cep}`;
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1).replace(".", ",")} MB`;
  return `${(bytes / 1024 / 1024 / 1024).toFixed(2).replace(".", ",")} GB`;
}
