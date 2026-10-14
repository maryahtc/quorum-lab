import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { AVISO_ENVIO, DOC_SLOTS, DOC_SLOT_ORDER, SERVICES } from "../../../shared/config";
import { LABELS, elementos, enderecoCompleto, formatTeeth } from "../../../shared/format";
import { brl, estimate } from "../../../shared/pricing";
import type { Solicitacao } from "../../../shared/schema";
import { documentoTipo } from "../../../shared/validators";
import type { StepProps } from "./types";

function Row({ label, children, teeth }: { label: string; children: ReactNode; teeth?: boolean }) {
  return (
    <div className="review-row">
      <dt>{label}</dt>
      <dd className={teeth ? "teeth" : undefined}>{children || "—"}</dd>
    </div>
  );
}

function Sec({ title, onEdit, children }: { title: string; onEdit: () => void; children: ReactNode }) {
  return (
    <section className="review-sec">
      <div className="review-sec-head">
        <h3>{title}</h3>
        <button type="button" className="text-btn" onClick={onEdit}>Editar</button>
      </div>
      <dl style={{ margin: 0 }}>{children}</dl>
    </section>
  );
}

export function StepRevisao({ state, errors, goTo, onConsent, footer }: StepProps & { goTo: (i: number) => void; onConsent: (v: boolean) => void; footer: ReactNode }) {
  if (!state.servico.tipo) return null;
  const def = SERVICES[state.servico.tipo];
  const c = state.clinica;
  const sv = state.servico;
  const est = estimate(def.id, def.enceramento ? sv.dentesEnceramento : []);
  const com = state.comunicacao;
  const cl = state.clinico;

  return (
    <>
      <article className="review" aria-label="Resumo da solicitação">
        <header className="review-head">
          <p className="eyebrow">Solicitação Quorum</p>
          <h3 className="display" style={{ marginTop: 14 }}>{def.nome}</h3>
        </header>

        <Sec title="Clínica" onEdit={() => goTo(0)}>
          <Row label="Clínica">{c.nomeFantasia}</Row>
          <Row label="Razão social / nome">{c.razaoSocial}</Row>
          <Row label={documentoTipo(c.documento)}>{c.documento}</Row>
          <Row label="Solicitante">{[c.solicitante, c.cro].filter(Boolean).join(" · ")}</Row>
          <Row label="Contato">{[c.whatsapp && `WhatsApp ${c.whatsapp}`, c.telefone && `Tel. ${c.telefone}`, c.email].filter(Boolean).join("\n")}</Row>
          <Row label="Endereço">{enderecoCompleto(c as Solicitacao["clinica"])}</Row>
        </Sec>

        <Sec title="Paciente" onEdit={() => goTo(1)}>
          <Row label="Identificação">{state.paciente.identificacao}</Row>
          {state.paciente.idade && <Row label="Idade">{state.paciente.idade} anos</Row>}
          {state.paciente.observacoes && <Row label="Observações">{state.paciente.observacoes}</Row>}
        </Sec>

        <Sec title="Serviço e valores" onEdit={() => goTo(2)}>
          <Row label="Serviço">{def.nome}</Row>
          <Row label={`Smile Design · ${elementos(sv.dentesSmile.length)}`} teeth>{formatTeeth(sv.dentesSmile)}</Row>
          {def.enceramento && <Row label={`Enceramento · ${elementos(sv.dentesEnceramento.length)}`} teeth>{formatTeeth(sv.dentesEnceramento)}</Row>}
          <div className="price" style={{ marginTop: 24, paddingTop: 20 }}>
            {est.linhas.map((l) => (
              <div className="price-row" key={l.rotulo}>
                <span>{l.rotulo}</span>
                <span className="v">{l.aPartirDe ? `a partir de ${brl(l.valor)}` : l.detalhe ? `${l.detalhe} = ${brl(l.valor)}` : brl(l.valor)}</span>
              </div>
            ))}
            <div className="price-total">
              <span className="label">Valor estimado</span>
              <span className="total">{est.totalAPartirDe && <small>a partir de</small>}{brl(est.total)}</span>
            </div>
            {est.nota && <p className="price-note">{est.nota}</p>}
          </div>
        </Sec>

        <Sec title="Informações clínicas" onEdit={() => goTo(3)}>
          <Row label="Resinas existentes">{cl.possuiResina ? LABELS.possuiResina[cl.possuiResina] : "—"}</Row>
          {cl.possuiResina === "sim" && <Row label="Elementos com resina" teeth>{formatTeeth(cl.dentesResina)}</Row>}
          <Row label="Intenção restauradora">{cl.intencao ? LABELS.intencao[cl.intencao] : "—"}</Row>
          <Row label="Alteração de cor">{cl.alteracaoCor ? LABELS.alteracaoCor[cl.alteracaoCor] : "—"}</Row>
          {cl.informacoes && <Row label="Observações">{cl.informacoes}</Row>}
        </Sec>

        <Sec title="Documentação" onEdit={() => goTo(4)}>
          <ul className="check-list">
            {DOC_SLOT_ORDER.map((slot) => {
              const rule = def.documentos[slot];
              const has = Boolean(state.arquivos[slot]);
              return (
                <li key={slot}>
                  <span>{DOC_SLOTS[slot].titulo}{rule === "opcional" ? " (opcional)" : ""}</span>
                  <span className={`st ${has ? "" : "off"}`}>{has ? "✓" : "—"}</span>
                </li>
              );
            })}
          </ul>
        </Sec>

        <Sec title="Preferência" onEdit={() => goTo(5)}>
          <Row label="Apresentação">{com.apresentacao ? LABELS.apresentacao[com.apresentacao] : "—"}</Row>
          {com.apresentacao && com.apresentacao !== "pdf" && <Row label="Melhor período">{LABELS.periodo[com.periodo]}</Row>}
          <Row label="Entrega">{com.entrega ? `Por ${LABELS.entrega[com.entrega]}` : "—"}</Row>
        </Sec>
      </article>

      <p className="notice">{AVISO_ENVIO}</p>

      <label className="consent">
        <input type="checkbox" checked={state.aceiteTermos} onChange={(e) => onConsent(e.target.checked)} aria-invalid={errors.aceiteTermos ? true : undefined} />
        <span>
          Li e concordo com os{" "}
          <Link to="/termos" target="_blank" rel="noopener">Termos de Prestação de Serviço</Link> e{" "}
          <Link to="/privacidade" target="_blank" rel="noopener">Política de Privacidade</Link>.
        </span>
      </label>
      {errors.aceiteTermos && <span className="error" role="alert">{errors.aceiteTermos}</span>}
      {footer}
    </>
  );
}
