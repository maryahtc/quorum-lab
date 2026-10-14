import type { DecisaoTipo } from "./model";

/** Mesmo desenho vetorial usado no PDF (as fontes da marca não têm ○ nem ↔). */
export function DecisaoSimbolo({ tipo, size = 12 }: { tipo: DecisaoTipo; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="-6 -6 12 12" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth={1} strokeLinecap="square">
      {tipo === "acrescimo" && <path d="M-4.5 0H4.5M0 -4.5V4.5" />}
      {tipo === "reducao" && <path d="M-4.5 0H4.5" />}
      {tipo === "manutencao" && <circle r={4.3} />}
      {tipo === "atencao" && (
        <>
          <path d="M0 -4.5V1.6" />
          <circle cy={3.9} r={0.8} fill="currentColor" stroke="none" />
        </>
      )}
      {tipo === "ajuste" && <path d="M-5.2 0H5.2M-5.2 0L-2.7 -2.5M-5.2 0L-2.7 2.5M5.2 0L2.7 -2.5M5.2 0L2.7 2.5" strokeLinecap="round" />}
    </svg>
  );
}
