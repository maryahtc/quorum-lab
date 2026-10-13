import { TextArea, TextField } from "../../../components/fields";
import type { StepProps } from "./types";

export function StepPaciente({ state, patch, errors }: StepProps) {
  const p = state.paciente;
  return (
    <>
      <p className="step-intro">Para preservar a privacidade do paciente, não é necessário informar o nome completo.</p>
      <div className="grid">
        <TextField
          className="col-4"
          label="Identificação do paciente"
          required
          value={p.identificacao}
          onValue={(v) => patch("paciente", { identificacao: v })}
          error={errors["paciente.identificacao"]}
          hint="Iniciais ou código interno da clínica."
          maxLength={60}
          autoComplete="off"
        />
        <TextField
          className="col-2"
          label="Idade"
          value={p.idade}
          onValue={(v) => patch("paciente", { idade: v.replace(/\D/g, "").slice(0, 3) })}
          error={errors["paciente.idade"]}
          inputMode="numeric"
          autoComplete="off"
        />
        <TextArea className="col-6" label="Observações" value={p.observacoes} onValue={(v) => patch("paciente", { observacoes: v })} maxLength={2000} rows={4} />
      </div>
    </>
  );
}
