import { z } from "zod";
import { SERVICES, VALID_TEETH, type ServiceId } from "./config";
import { isValidCnpj, onlyDigits } from "./validators";

const req = (msg = "Campo obrigatório") => z.string().trim().min(1, msg);
const opt = z.string().trim().max(300).optional().default("");
const teeth = z
  .array(z.number().int())
  .max(32)
  .refine((arr) => arr.every((t) => VALID_TEETH.has(t)), "Dente inválido")
  .refine((arr) => new Set(arr).size === arr.length, "Dente repetido");

export const UFS = [
  "AC", "AL", "AP", "AM", "BA", "CE", "DF", "ES", "GO", "MA", "MT", "MS", "MG", "PA", "PB",
  "PR", "PE", "PI", "RJ", "RN", "RS", "RO", "RR", "SC", "SP", "SE", "TO",
] as const;

const phone = (required: boolean) =>
  z
    .string()
    .trim()
    .refine((v) => (!required && v === "") || [10, 11].includes(onlyDigits(v).length), "Telefone inválido");

export const clinicaSchema = z.object({
  razaoSocial: req().max(200),
  nomeFantasia: req().max(200),
  cnpj: req().refine(isValidCnpj, "CNPJ inválido"),
  inscricaoMunicipal: opt,
  solicitante: req().max(200),
  cro: opt,
  telefone: phone(false).default(""),
  whatsapp: phone(true),
  email: z.string().trim().email("E-mail inválido").max(200),
  emailNotaFiscal: z.union([z.literal(""), z.string().trim().email("E-mail inválido").max(200)]).default(""),
  instagram: opt,
  cep: req().refine((v) => onlyDigits(v).length === 8, "CEP inválido"),
  rua: req().max(200),
  numero: req().max(20),
  complemento: opt,
  bairro: req().max(120),
  cidade: req().max(120),
  estado: z.enum(UFS, { message: "Selecione o estado" }),
});

export const pacienteSchema = z.object({
  identificacao: req("Informe iniciais ou código interno").max(60),
  idade: z
    .string()
    .trim()
    .refine((v) => v === "" || (/^\d{1,3}$/.test(v) && Number(v) <= 120), "Idade inválida")
    .default(""),
  observacoes: z.string().trim().max(2000).default(""),
});

export const servicoSchema = z.object({
  tipo: z.enum(["smile", "smile_enceramento", "smile_enceramento_perioguide"], {
    message: "Selecione o tipo de trabalho",
  }),
  dentesSmile: teeth.min(1, "Selecione ao menos um elemento"),
  dentesEnceramento: teeth.default([]),
});

export const clinicoSchema = z.object({
  possuiResina: z.enum(["nao", "sim"], { message: "Selecione uma opção" }),
  dentesResina: teeth.default([]),
  intencao: z.enum(["faceta", "recontorno", "ambos"], { message: "Selecione uma opção" }),
  alteracaoCor: z.enum(["sim", "nao", "indefinido"], { message: "Selecione uma opção" }),
  informacoes: z.string().trim().max(4000).default(""),
});

export const comunicacaoSchema = z.object({
  apresentacao: z.enum(["pdf", "conversa", "ambos"], { message: "Selecione uma opção" }),
  periodo: z.enum(["manha", "tarde", "indiferente", ""]).default(""),
  entrega: z.enum(["whatsapp", "email"], { message: "Selecione uma opção" }),
});

export const solicitacaoSchema = z
  .object({
    clinica: clinicaSchema,
    paciente: pacienteSchema,
    servico: servicoSchema,
    clinico: clinicoSchema,
    comunicacao: comunicacaoSchema,
    aceiteTermos: z.literal(true, { message: "É necessário aceitar os termos" }),
  })
  .superRefine((s, ctx) => {
    const def = SERVICES[s.servico.tipo as ServiceId];
    if (def.enceramento && s.servico.dentesEnceramento.length === 0) {
      ctx.addIssue({ code: "custom", path: ["servico", "dentesEnceramento"], message: "Selecione os dentes que serão encerados" });
    }
    if (s.clinico.possuiResina === "sim") {
      const planned = new Set([...s.servico.dentesSmile, ...s.servico.dentesEnceramento]);
      if (s.clinico.dentesResina.length === 0) {
        ctx.addIssue({ code: "custom", path: ["clinico", "dentesResina"], message: "Indique os elementos com resina" });
      } else if (!s.clinico.dentesResina.every((t) => planned.has(t))) {
        ctx.addIssue({ code: "custom", path: ["clinico", "dentesResina"], message: "Elemento fora do planejamento" });
      }
    }
    if (s.comunicacao.apresentacao !== "pdf" && s.comunicacao.periodo === "") {
      ctx.addIssue({ code: "custom", path: ["comunicacao", "periodo"], message: "Selecione o melhor período" });
    }
  });

export type Solicitacao = z.infer<typeof solicitacaoSchema>;
export type Clinica = z.infer<typeof clinicaSchema>;

/**
 * Normaliza dados que dependem de outras escolhas, para que o servidor nunca
 * receba ou registre informação incoerente (ex.: dentes de enceramento num
 * Smile Design isolado).
 */
export function normalizeSolicitacao(s: Solicitacao): Solicitacao {
  const def = SERVICES[s.servico.tipo];
  const dentesEnceramento = def.enceramento ? s.servico.dentesEnceramento : [];
  const planned = new Set([...s.servico.dentesSmile, ...dentesEnceramento]);
  return {
    ...s,
    servico: { ...s.servico, dentesEnceramento },
    clinico: {
      ...s.clinico,
      dentesResina: s.clinico.possuiResina === "sim" ? s.clinico.dentesResina.filter((t) => planned.has(t)) : [],
    },
    comunicacao: {
      ...s.comunicacao,
      periodo: s.comunicacao.apresentacao === "pdf" ? "" : s.comunicacao.periodo,
    },
  };
}
