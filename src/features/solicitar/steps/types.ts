import type { Errors, FormState } from "../state";

export type Patch = <K extends "clinica" | "paciente" | "servico" | "clinico" | "comunicacao" | "arquivos">(
  section: K,
  value: Partial<FormState[K]>,
) => void;

export interface StepProps {
  state: FormState;
  patch: Patch;
  errors: Errors;
}
