import type { ZodType } from "zod";
import { SERVICES, type DocSlot, type ServiceId } from "../../shared/config";
import {
  clinicaSchema,
  clinicoSchema,
  comunicacaoSchema,
  pacienteSchema,
  servicoSchema,
  type Solicitacao,
} from "../../shared/schema";

export interface SelectedFile {
  file: File;
  previewUrl?: string;
}

export interface FormState {
  clinica: Record<keyof Solicitacao["clinica"], string>;
  paciente: { identificacao: string; idade: string; observacoes: string };
  servico: { tipo: ServiceId | ""; dentesSmile: number[]; dentesEnceramento: number[] };
  clinico: {
    possuiResina: "" | "nao" | "sim";
    dentesResina: number[];
    intencao: "" | "faceta" | "recontorno" | "ambos";
    alteracaoCor: "" | "sim" | "nao" | "indefinido";
    informacoes: string;
  };
  comunicacao: {
    apresentacao: "" | "pdf" | "conversa" | "ambos";
    periodo: "" | "manha" | "tarde" | "indiferente";
    entrega: "" | "whatsapp" | "email";
  };
  arquivos: Partial<Record<DocSlot, SelectedFile>>;
  aceiteTermos: boolean;
  /** Honeypot anti-spam (campo invisível). */
  website: string;
}

export const initialState = (): FormState => ({
  clinica: {
    razaoSocial: "", nomeFantasia: "", documento: "", inscricaoMunicipal: "", solicitante: "", cro: "",
    telefone: "", whatsapp: "", email: "", emailNotaFiscal: "", instagram: "",
    cep: "", rua: "", numero: "", complemento: "", bairro: "", cidade: "", estado: "",
  },
  paciente: { identificacao: "", idade: "", observacoes: "" },
  servico: { tipo: "", dentesSmile: [], dentesEnceramento: [] },
  clinico: { possuiResina: "", dentesResina: [], intencao: "", alteracaoCor: "", informacoes: "" },
  comunicacao: { apresentacao: "", periodo: "", entrega: "" },
  arquivos: {},
  aceiteTermos: false,
  website: "",
});

export type Errors = Record<string, string>;

export const STEPS = [
  { id: "clinica", title: "Dados da clínica", short: "Clínica" },
  { id: "paciente", title: "Paciente", short: "Paciente" },
  { id: "servico", title: "Tipo de trabalho", short: "Trabalho" },
  { id: "clinico", title: "Informações clínicas", short: "Clínico" },
  { id: "documentacao", title: "Documentação", short: "Arquivos" },
  { id: "comunicacao", title: "Comunicação", short: "Contato" },
  { id: "revisao", title: "Revisão", short: "Revisão" },
] as const;

function issues(schema: ZodType, data: unknown, prefix: string): Errors {
  const r = schema.safeParse(data);
  if (r.success) return {};
  const out: Errors = {};
  for (const i of r.error.issues) {
    const key = [prefix, ...i.path.map(String)].join(".");
    out[key] ??= i.message;
  }
  return out;
}

/** Dentes envolvidos no planejamento (Smile Design ∪ enceramento). */
export function plannedTeeth(s: FormState): number[] {
  const def = s.servico.tipo ? SERVICES[s.servico.tipo] : undefined;
  return [...new Set([...s.servico.dentesSmile, ...(def?.enceramento ? s.servico.dentesEnceramento : [])])];
}

export function validateStep(step: number, s: FormState): Errors {
  switch (step) {
    case 0:
      return issues(clinicaSchema, s.clinica, "clinica");
    case 1:
      return issues(pacienteSchema, s.paciente, "paciente");
    case 2: {
      const e = issues(servicoSchema, s.servico, "servico");
      if (s.servico.tipo && SERVICES[s.servico.tipo].enceramento && s.servico.dentesEnceramento.length === 0) {
        e["servico.dentesEnceramento"] = "Selecione os dentes que serão encerados";
      }
      return e;
    }
    case 3: {
      const e = issues(clinicoSchema, s.clinico, "clinico");
      if (s.clinico.possuiResina === "sim") {
        const planned = new Set(plannedTeeth(s));
        if (!s.clinico.dentesResina.some((t) => planned.has(t))) e["clinico.dentesResina"] = "Indique os elementos com resina";
      }
      return e;
    }
    case 4: {
      const e: Errors = {};
      if (!s.servico.tipo) return e;
      for (const [slot, rule] of Object.entries(SERVICES[s.servico.tipo].documentos)) {
        if (rule === "obrigatorio" && !s.arquivos[slot as DocSlot]) e[`arquivos.${slot}`] = "Documento obrigatório";
      }
      return e;
    }
    case 5: {
      const e = issues(comunicacaoSchema, s.comunicacao, "comunicacao");
      if (s.comunicacao.apresentacao && s.comunicacao.apresentacao !== "pdf" && !s.comunicacao.periodo) {
        e["comunicacao.periodo"] = "Selecione o melhor período";
      }
      return e;
    }
    case 6:
      return s.aceiteTermos ? {} : { aceiteTermos: "É necessário aceitar os termos para enviar" };
    default:
      return {};
  }
}

/** Monta o payload enviado ao servidor (o servidor valida e normaliza novamente). */
export function toPayload(s: FormState) {
  const def = s.servico.tipo ? SERVICES[s.servico.tipo] : undefined;
  const planned = new Set(plannedTeeth(s));
  return {
    clinica: s.clinica,
    paciente: s.paciente,
    servico: {
      tipo: s.servico.tipo,
      dentesSmile: s.servico.dentesSmile,
      dentesEnceramento: def?.enceramento ? s.servico.dentesEnceramento : [],
    },
    clinico: {
      ...s.clinico,
      dentesResina: s.clinico.possuiResina === "sim" ? s.clinico.dentesResina.filter((t) => planned.has(t)) : [],
    },
    comunicacao: { ...s.comunicacao, periodo: s.comunicacao.apresentacao === "pdf" ? "" : s.comunicacao.periodo },
    aceiteTermos: s.aceiteTermos,
  };
}
