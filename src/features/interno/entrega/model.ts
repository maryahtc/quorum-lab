/**
 * Entrega do planejamento · modelo de dados.
 *
 * Tudo vive apenas em memória, na aba aberta. Nada é salvo, enviado ou
 * registrado: o PDF é gerado no navegador e baixado pelo planejador.
 */

export const SERVICOS = [
  { id: "smile", label: "Smile Design" },
  { id: "smile_enceramento", label: "Smile Design + Enceramento" },
  { id: "smile_enceramento_perio", label: "Smile Design + Enceramento + PerioGuide" },
  { id: "outro", label: "Outro" },
] as const;
export type ServicoId = (typeof SERVICOS)[number]["id"];

export const SUGESTOES_TITULO = [
  "Vista frontal",
  "Vista lateral",
  "Vista oclusal",
  "Sobreposição",
  "Proporções",
  "Volumes",
  "Perfil",
  "Enceramento",
  "Periodontal",
] as const;

export const DECISAO_TIPOS = [
  { id: "acrescimo", label: "Acréscimo", simbolo: "+" },
  { id: "reducao", label: "Redução", simbolo: "−" },
  { id: "manutencao", label: "Manutenção", simbolo: "○" },
  { id: "atencao", label: "Atenção", simbolo: "!" },
  { id: "ajuste", label: "Ajuste", simbolo: "↔" },
] as const;
export type DecisaoTipo = (typeof DECISAO_TIPOS)[number]["id"];
export const decisaoTipo = (id: DecisaoTipo) => DECISAO_TIPOS.find((t) => t.id === id)!;

export const SUGESTOES_ORIENTACAO = [
  "Validar através de mock-up antes da execução definitiva.",
  "Respeitar os volumes indicados no planejamento.",
  "Realizar prova clínica antes da etapa restauradora.",
  "Avaliar a adaptação do planejamento clinicamente antes da execução.",
  "Preservar os volumes existentes nas regiões não indicadas.",
  "Conferir referências de comprimento antes da transferência.",
  "Validar o planejamento clinicamente antes da execução definitiva.",
] as const;

export const ARQUIVOS = [
  { id: "pdf", label: "PDF do planejamento" },
  { id: "smile", label: "Smile Design" },
  { id: "stl_superior", label: "STL superior" },
  { id: "stl_inferior", label: "STL inferior" },
  { id: "enceramento", label: "Enceramento" },
  { id: "perioguide", label: "PerioGuide" },
  { id: "guia", label: "Guia" },
  { id: "outro", label: "Outro" },
] as const;
export type ArquivoId = (typeof ARQUIVOS)[number]["id"];

/** Comprimento indicado (não é limite) para a leitura do caso: 2 a 4 linhas. */
export const LEITURA_IDEAL = 320;

/* -------------------------------------------------------------------------- */

/** Imagem já preparada para o PDF (JPG ou PNG, orientação corrigida). */
export interface Imagem {
  bytes: Uint8Array;
  formato: "jpg" | "png";
  largura: number;
  altura: number;
  /** URL local (blob:) só para a pré-visualização na tela. */
  url?: string;
}

export interface Analise {
  id: string;
  imagem?: Imagem;
  titulo: string;
  descricao: string;
}

export interface Decisao {
  id: string;
  tipo: DecisaoTipo;
  elemento: string;
  descricao: string;
}

export interface Orientacao {
  id: string;
  texto: string;
}

export interface Entrega {
  codigo: string;
  clinica: string;
  dentista: string;
  paciente: string;
  servico: ServicoId | "";
  servicoOutro: string;
  /** AAAA-MM-DD */
  data: string;
  leitura: string;
  analises: Analise[];
  decisoes: Decisao[];
  orientacoes: Orientacao[];
  arquivos: ArquivoId[];
  arquivoOutro: string;
}

let seq = 0;
export const novoId = (p: string) => `${p}${Date.now().toString(36)}${(seq++).toString(36)}`;

export function hojeISO(d = new Date()) {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

export const entregaVazia = (): Entrega => ({
  codigo: "",
  clinica: "",
  dentista: "",
  paciente: "",
  servico: "",
  servicoOutro: "",
  data: hojeISO(),
  leitura: "",
  analises: [],
  decisoes: [],
  orientacoes: [],
  arquivos: [],
  arquivoOutro: "",
});

/* -------------------------------------------------------------------------- */

export type Acao =
  | { t: "campo"; campo: "codigo" | "clinica" | "dentista" | "paciente" | "servicoOutro" | "data" | "leitura" | "arquivoOutro"; valor: string }
  | { t: "servico"; valor: ServicoId }
  | { t: "analise/add"; id: string; imagem?: Imagem }
  | { t: "analise/set"; id: string; patch: Partial<Omit<Analise, "id">> }
  | { t: "analise/remover"; id: string }
  | { t: "analise/mover"; id: string; delta: -1 | 1 }
  | { t: "decisao/add"; id: string; tipo?: DecisaoTipo }
  | { t: "decisao/set"; id: string; patch: Partial<Omit<Decisao, "id">> }
  | { t: "decisao/remover"; id: string }
  | { t: "orientacao/add"; id: string; texto: string }
  | { t: "orientacao/set"; id: string; texto: string }
  | { t: "orientacao/remover"; id: string }
  | { t: "arquivo"; id: ArquivoId }
  | { t: "limpar" };

const patchList = <T extends { id: string }>(list: T[], id: string, patch: Partial<T>) => list.map((x) => (x.id === id ? { ...x, ...patch } : x));

export function reducer(s: Entrega, a: Acao): Entrega {
  switch (a.t) {
    case "campo":
      return { ...s, [a.campo]: a.valor };
    case "servico":
      return { ...s, servico: a.valor };
    case "analise/add":
      return { ...s, analises: [...s.analises, { id: a.id, imagem: a.imagem, titulo: "", descricao: "" }] };
    case "analise/set":
      return { ...s, analises: patchList<Analise>(s.analises, a.id, a.patch) };
    case "analise/remover":
      return { ...s, analises: s.analises.filter((x) => x.id !== a.id) };
    case "analise/mover": {
      const i = s.analises.findIndex((x) => x.id === a.id);
      const j = i + a.delta;
      if (i < 0 || j < 0 || j >= s.analises.length) return s;
      const next = [...s.analises];
      [next[i], next[j]] = [next[j], next[i]];
      return { ...s, analises: next };
    }
    case "decisao/add":
      return { ...s, decisoes: [...s.decisoes, { id: a.id, tipo: a.tipo ?? "acrescimo", elemento: "", descricao: "" }] };
    case "decisao/set":
      return { ...s, decisoes: patchList<Decisao>(s.decisoes, a.id, a.patch) };
    case "decisao/remover":
      return { ...s, decisoes: s.decisoes.filter((x) => x.id !== a.id) };
    case "orientacao/add":
      return { ...s, orientacoes: [...s.orientacoes, { id: a.id, texto: a.texto }] };
    case "orientacao/set":
      return { ...s, orientacoes: patchList<Orientacao>(s.orientacoes, a.id, { texto: a.texto }) };
    case "orientacao/remover":
      return { ...s, orientacoes: s.orientacoes.filter((x) => x.id !== a.id) };
    case "arquivo":
      return { ...s, arquivos: s.arquivos.includes(a.id) ? s.arquivos.filter((x) => x !== a.id) : [...s.arquivos, a.id] };
    case "limpar":
      return entregaVazia();
  }
}

/* -------------------------------------------------------------------------- */
/* Derivados usados pelo resumo e pelo PDF                                     */
/* -------------------------------------------------------------------------- */

const temTexto = (s: string) => s.trim().length > 0;

export function servicoTexto(e: Entrega) {
  if (e.servico === "outro") return e.servicoOutro.trim() || "Outro";
  return SERVICOS.find((s) => s.id === e.servico)?.label ?? "";
}

export function dataTexto(iso: string) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  return m ? `${m[3]}/${m[2]}/${m[1]}` : iso;
}

/** Uma análise entra no PDF se tiver imagem, título ou descrição. */
export const analisesValidas = (e: Entrega) => e.analises.filter((a) => a.imagem || temTexto(a.titulo) || temTexto(a.descricao));
export const decisoesValidas = (e: Entrega) => e.decisoes.filter((d) => temTexto(d.elemento) || temTexto(d.descricao));
export const orientacoesValidas = (e: Entrega) => e.orientacoes.filter((o) => temTexto(o.texto));

/** Arquivos marcados, na ordem da lista; "Outro" usa o texto digitado. */
export function arquivosTexto(e: Entrega): string[] {
  return ARQUIVOS.filter((a) => e.arquivos.includes(a.id)).map((a) => (a.id === "outro" ? e.arquivoOutro.trim() || "Outro" : a.label));
}

/** Há algo além da data preenchido? (usado para avisar antes de sair da página) */
export function temConteudo(e: Entrega) {
  const v = entregaVazia();
  return (
    e.codigo !== v.codigo || e.clinica !== v.clinica || e.dentista !== v.dentista || e.paciente !== v.paciente ||
    e.servico !== v.servico || e.leitura !== v.leitura || e.analises.length > 0 || e.decisoes.length > 0 ||
    e.orientacoes.length > 0 || e.arquivos.length > 0
  );
}

/** Parte segura para nome de arquivo: sem acentos, espaços viram hífen, só [A-Za-z0-9-]. */
export function parteArquivo(s: string) {
  return s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .trim()
    .replace(/\s+/g, "-")
    .replace(/[^A-Za-z0-9-]/g, "")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 40);
}

/** QUORUM_[CODIGO]_[PACIENTE].pdf */
export function nomeArquivo(e: Pick<Entrega, "codigo" | "paciente">) {
  const codigo = parteArquivo(e.codigo).toUpperCase() || "SEM-CODIGO";
  const paciente = parteArquivo(e.paciente).toUpperCase();
  return `QUORUM_${codigo}${paciente ? `_${paciente}` : ""}.pdf`;
}
