import { ENCERAMENTO_POR_ELEMENTO, PERIOGUIDE_NOTA, SERVICES, type ServiceId } from "./config";

export interface PriceLine {
  rotulo: string;
  detalhe?: string;
  valor: number;
  aPartirDe?: boolean;
}

export interface Estimate {
  linhas: PriceLine[];
  total: number;
  /** true quando o total contém parcela "a partir de" (PerioGuide). */
  totalAPartirDe: boolean;
  nota?: string;
}

/** Calcula o valor estimado. O servidor sempre recalcula — nunca confia no valor do navegador. */
export function estimate(tipo: ServiceId, dentesEnceramento: number[]): Estimate {
  const def = SERVICES[tipo];
  const linhas: PriceLine[] = [{ rotulo: "Smile Design", valor: def.smileDesign }];
  if (def.enceramento) {
    const n = dentesEnceramento.length;
    linhas.push({
      rotulo: "Enceramento",
      detalhe: `${n} × ${brl(ENCERAMENTO_POR_ELEMENTO)}`,
      valor: n * ENCERAMENTO_POR_ELEMENTO,
    });
  }
  if (def.perioGuideAPartirDe !== undefined) {
    linhas.push({ rotulo: "PerioGuide", detalhe: "a partir de", valor: def.perioGuideAPartirDe, aPartirDe: true });
  }
  return {
    linhas,
    total: linhas.reduce((a, l) => a + l.valor, 0),
    totalAPartirDe: linhas.some((l) => l.aPartirDe),
    nota: def.perioGuideAPartirDe !== undefined ? PERIOGUIDE_NOTA : undefined,
  };
}

export function brl(v: number): string {
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL", minimumFractionDigits: 0, maximumFractionDigits: 2 }).replace(/ /g, " ");
}
