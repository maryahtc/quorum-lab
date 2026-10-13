import { OptionList, Segmented, TextArea } from "../../../components/fields";
import { ToothPicker } from "../../../components/Odontogram";
import { LABELS } from "../../../shared/format";
import { plannedTeeth } from "../state";
import type { StepProps } from "./types";

export function StepClinico({ state, patch, errors }: StepProps) {
  const c = state.clinico;
  const planned = plannedTeeth(state);
  const err = (f: string) => errors[`clinico.${f}`];

  return (
    <>
      <Segmented
        question="O paciente possui restaurações em resina nos elementos envolvidos?"
        value={c.possuiResina}
        options={[
          { value: "nao", label: "Não" },
          { value: "sim", label: "Sim" },
        ]}
        onChange={(v) => patch("clinico", { possuiResina: v })}
        error={err("possuiResina")}
      />

      {c.possuiResina === "sim" && (
        <div className="question">
          <p className="label">Em quais elementos?</p>
          {planned.length ? (
            <ToothPicker label="Elementos com resina" options={planned} value={c.dentesResina.filter((t) => planned.includes(t))} onChange={(t) => patch("clinico", { dentesResina: t })} />
          ) : (
            <p className="hint">Selecione primeiro os dentes do planejamento na etapa 03.</p>
          )}
          {err("dentesResina") && <span className="error" role="alert">{err("dentesResina")}</span>}
        </div>
      )}

      <OptionList
        question="Qual é a intenção restauradora?"
        value={c.intencao}
        options={(["faceta", "recontorno", "ambos"] as const).map((v) => ({ value: v, label: LABELS.intencao[v], description: LABELS.intencaoDescricao[v] }))}
        onChange={(v) => patch("clinico", { intencao: v })}
        error={err("intencao")}
      />

      <Segmented
        question="Existe intenção de alteração de cor?"
        value={c.alteracaoCor}
        options={(["sim", "nao", "indefinido"] as const).map((v) => ({ value: v, label: LABELS.alteracaoCor[v] }))}
        onChange={(v) => patch("clinico", { alteracaoCor: v })}
        error={err("alteracaoCor")}
      />

      <div className="question">
        <TextArea
          label="Informações importantes para este planejamento"
          value={c.informacoes}
          onValue={(v) => patch("clinico", { informacoes: v })}
          maxLength={4000}
          rows={6}
          placeholder="Expectativas do paciente, limitações clínicas, referências…"
        />
      </div>
    </>
  );
}
