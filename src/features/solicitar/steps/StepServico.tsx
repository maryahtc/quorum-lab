import { Odontogram } from "../../../components/Odontogram";
import { ENCERAMENTO_POR_ELEMENTO, SERVICES, SERVICE_ORDER, type ServiceId } from "../../../shared/config";
import { brl } from "../../../shared/pricing";
import { PriceSummary } from "./PriceSummary";
import type { StepProps } from "./types";

function priceLine(id: ServiceId) {
  const s = SERVICES[id];
  if (!s.enceramento) return `${brl(s.smileDesign)} · valor fixo`;
  const parts = [`Smile Design ${brl(s.smileDesign)}`, `Enceramento ${brl(ENCERAMENTO_POR_ELEMENTO)} por elemento`];
  if (s.perioGuideAPartirDe) parts.push(`PerioGuide a partir de ${brl(s.perioGuideAPartirDe)}`);
  return parts.join(" · ");
}

export function StepServico({ state, patch, errors }: StepProps) {
  const sv = state.servico;
  const def = sv.tipo ? SERVICES[sv.tipo] : undefined;

  return (
    <>
      <div className="services" role="radiogroup" aria-label="Tipo de trabalho">
        {SERVICE_ORDER.map((id, i) => {
          const s = SERVICES[id];
          return (
            <button key={id} type="button" className="service" role="radio" aria-checked={sv.tipo === id} onClick={() => patch("servico", { tipo: id })}>
              <span className="s-num">{String(i + 1).padStart(2, "0")}</span>
              <span>
                <span className="s-name">{s.nome}</span>
                <span className="s-desc">{s.descricao}</span>
                <span className="s-prices">{priceLine(id)}</span>
              </span>
              <span className="s-from">
                {s.enceramento ? "a partir de" : "valor"}
                <b>{brl(s.smileDesign + (s.perioGuideAPartirDe ?? 0))}</b>
              </span>
            </button>
          );
        })}
      </div>
      {errors["servico.tipo"] && <span className="error" role="alert">{errors["servico.tipo"]}</span>}

      {def && (
        <>
          <section className="group" aria-labelledby="g-sd">
            <div className="group-title"><h3 id="g-sd">Dentes do Smile Design</h3></div>
            <p className="step-intro" style={{ margin: "0 0 28px" }}>
              Selecione os elementos que fazem parte do planejamento.
              {!def.enceramento && " O valor do Smile Design é fixo, independente da quantidade."}
            </p>
            <Odontogram label="Dentes do Smile Design" value={sv.dentesSmile} onChange={(t) => patch("servico", { dentesSmile: t })} />
            {errors["servico.dentesSmile"] && <span className="error" role="alert">{errors["servico.dentesSmile"]}</span>}
          </section>

          {def.enceramento && (
            <section className="group" aria-labelledby="g-enc">
              <div className="group-title"><h3 id="g-enc">Dentes que serão encerados</h3></div>
              <p className="step-intro" style={{ margin: "0 0 20px" }}>
                O enceramento é cobrado por elemento ({brl(ENCERAMENTO_POR_ELEMENTO)}), apenas sobre os dentes selecionados aqui.
                O filete dourado indica os dentes do Smile Design.
              </p>
              {sv.dentesSmile.length > 0 && (
                <div className="odonto-tools" style={{ margin: "0 0 24px" }}>
                  <button type="button" className="text-btn" onClick={() => patch("servico", { dentesEnceramento: sv.dentesSmile })}>
                    Usar os mesmos dentes do Smile Design
                  </button>
                  {sv.dentesEnceramento.length > 0 && (
                    <button type="button" className="text-btn" onClick={() => patch("servico", { dentesEnceramento: [] })}>
                      Limpar seleção
                    </button>
                  )}
                </div>
              )}
              <Odontogram
                label="Dentes que serão encerados"
                value={sv.dentesEnceramento}
                hint={sv.dentesSmile}
                onChange={(t) => patch("servico", { dentesEnceramento: t })}
              />
              {errors["servico.dentesEnceramento"] && <span className="error" role="alert">{errors["servico.dentesEnceramento"]}</span>}
            </section>
          )}

          <PriceSummary tipo={def.id} dentesEnceramento={def.enceramento ? sv.dentesEnceramento : []} />
        </>
      )}
    </>
  );
}
