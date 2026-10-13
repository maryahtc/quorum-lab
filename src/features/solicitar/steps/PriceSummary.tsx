import type { ServiceId } from "../../../shared/config";
import { brl, estimate } from "../../../shared/pricing";

export function PriceSummary({ tipo, dentesEnceramento }: { tipo: ServiceId; dentesEnceramento: number[] }) {
  const e = estimate(tipo, dentesEnceramento);
  return (
    <div className="price" aria-live="polite">
      {e.linhas.map((l) => (
        <div className="price-row" key={l.rotulo}>
          <span>{l.rotulo}</span>
          <span className="v">
            {l.aPartirDe ? `a partir de ${brl(l.valor)}` : l.detalhe ? `${l.detalhe} = ${brl(l.valor)}` : brl(l.valor)}
          </span>
        </div>
      ))}
      <div className="price-total">
        <span className="label">Valor estimado</span>
        <span className="total">
          {e.totalAPartirDe && <small>a partir de</small>}
          {brl(e.total)}
        </span>
      </div>
      {e.nota && <p className="price-note">{e.nota}</p>}
    </div>
  );
}
