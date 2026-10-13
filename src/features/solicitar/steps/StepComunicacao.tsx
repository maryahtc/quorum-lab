import { OptionList, Segmented } from "../../../components/fields";
import { LABELS } from "../../../shared/format";
import type { StepProps } from "./types";

export function StepComunicacao({ state, patch, errors }: StepProps) {
  const c = state.comunicacao;
  return (
    <>
      <OptionList
        question="Como prefere receber a apresentação do planejamento?"
        value={c.apresentacao}
        options={[
          { value: "pdf", label: "PDF técnico" },
          { value: "conversa", label: "Conversa rápida com o planejador" },
          { value: "ambos", label: "Ambos" },
        ]}
        onChange={(v) => patch("comunicacao", { apresentacao: v })}
        error={errors["comunicacao.apresentacao"]}
      />
      {(c.apresentacao === "conversa" || c.apresentacao === "ambos") && (
        <Segmented
          question="Melhor período para a conversa"
          value={c.periodo}
          options={(["manha", "tarde", "indiferente"] as const).map((v) => ({ value: v, label: LABELS.periodo[v] }))}
          onChange={(v) => patch("comunicacao", { periodo: v })}
          error={errors["comunicacao.periodo"]}
        />
      )}
      <Segmented
        question="Onde prefere receber o planejamento?"
        value={c.entrega}
        options={[
          { value: "whatsapp", label: "WhatsApp" },
          { value: "email", label: "E-mail" },
        ]}
        onChange={(v) => patch("comunicacao", { entrega: v })}
        error={errors["comunicacao.entrega"]}
      />
    </>
  );
}
