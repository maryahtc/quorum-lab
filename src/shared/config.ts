/**
 * CONFIGURAÇÃO CENTRAL DO SERVIÇO
 *
 * Arquivo único com preços, regras de documentação e limites de arquivos.
 * É usado pelo formulário (navegador) e pelas Netlify Functions (servidor),
 * então qualquer alteração aqui vale para os dois lados.
 */

export type ServiceId = "smile" | "smile_enceramento" | "smile_enceramento_perioguide";
export type DocSlot = "foto" | "stl_superior" | "stl_inferior" | "tomografia";

export type DocRequirement = "obrigatorio" | "opcional";

export interface ServiceDefinition {
  id: ServiceId;
  /** Nome exibido no formulário, PDF e e-mails. */
  nome: string;
  /** Descrição curta exibida na escolha do serviço. */
  descricao: string;
  /** Valor do Smile Design neste pacote (R$). */
  smileDesign: number;
  /** Se o pacote inclui enceramento cobrado por elemento. */
  enceramento: boolean;
  /** Valor inicial do PerioGuide (R$), quando incluído. */
  perioGuideAPartirDe?: number;
  /** Documentação exigida. Slots ausentes não são exibidos. */
  documentos: Partial<Record<DocSlot, DocRequirement>>;
}

/** Valor do enceramento por elemento (R$). */
export const ENCERAMENTO_POR_ELEMENTO = 80;

export const SERVICES: Record<ServiceId, ServiceDefinition> = {
  smile: {
    id: "smile",
    nome: "Smile Design",
    descricao: "Planejamento estético do sorriso.",
    smileDesign: 300,
    enceramento: false,
    documentos: {
      foto: "obrigatorio",
    },
  },
  smile_enceramento: {
    id: "smile_enceramento",
    nome: "Smile Design + Enceramento",
    descricao: "Planejamento estético com enceramento digital por elemento.",
    smileDesign: 150,
    enceramento: true,
    documentos: {
      foto: "obrigatorio",
      stl_superior: "obrigatorio",
      stl_inferior: "opcional",
    },
  },
  smile_enceramento_perioguide: {
    id: "smile_enceramento_perioguide",
    nome: "Smile Design + Enceramento + PerioGuide",
    descricao: "Planejamento completo com guia periodontal.",
    smileDesign: 150,
    enceramento: true,
    perioGuideAPartirDe: 400,
    documentos: {
      foto: "obrigatorio",
      stl_superior: "obrigatorio",
      stl_inferior: "opcional",
      tomografia: "obrigatorio",
    },
  },
};

export const SERVICE_ORDER: ServiceId[] = ["smile", "smile_enceramento", "smile_enceramento_perioguide"];

export const PERIOGUIDE_NOTA =
  "O valor final do PerioGuide será confirmado após análise da documentação.";

/* -------------------------------------------------------------------------- */
/* Arquivos                                                                    */
/* -------------------------------------------------------------------------- */

export type FileKind = "image" | "stl" | "zip";

export interface DocSlotDefinition {
  slot: DocSlot;
  titulo: string;
  kind: FileKind;
  /** Extensões aceitas, minúsculas e sem ponto. */
  extensoes: string[];
  /** Tamanho máximo por arquivo (MB). */
  maxMB: number;
  /** Prioridade para anexar ao e-mail (menor = primeiro). */
  prioridadeAnexo: number;
  instrucao?: string;
}

export const DOC_SLOTS: Record<DocSlot, DocSlotDefinition> = {
  foto: {
    slot: "foto",
    titulo: "Foto do sorriso entreaberto",
    kind: "image",
    extensoes: ["jpg", "jpeg", "png", "heic"],
    maxMB: 25,
    prioridadeAnexo: 1,
  },
  stl_superior: {
    slot: "stl_superior",
    titulo: "STL superior",
    kind: "stl",
    extensoes: ["stl"],
    maxMB: 150,
    prioridadeAnexo: 2,
  },
  stl_inferior: {
    slot: "stl_inferior",
    titulo: "STL inferior",
    kind: "stl",
    extensoes: ["stl"],
    maxMB: 150,
    prioridadeAnexo: 3,
  },
  tomografia: {
    slot: "tomografia",
    titulo: "Tomografia (DICOM)",
    kind: "zip",
    extensoes: ["zip"],
    maxMB: 1024,
    prioridadeAnexo: 4,
    instrucao: "Compacte a pasta DICOM da tomografia em um arquivo .ZIP antes do envio.",
  },
};

export const DOC_SLOT_ORDER: DocSlot[] = ["foto", "stl_superior", "stl_inferior", "tomografia"];

/** Content-Type canônico gravado no armazenamento, por extensão. */
export const CONTENT_TYPES: Record<string, string> = {
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  heic: "image/heic",
  stl: "model/stl",
  zip: "application/zip",
};

/** MIME types que o navegador pode informar para cada tipo (vazio é aceito: muitos SOs não informam). */
export const ACCEPTED_BROWSER_MIME: Record<FileKind, string[]> = {
  image: ["image/jpeg", "image/png", "image/heic", "image/heif", "image/pjpeg"],
  stl: ["model/stl", "application/sla", "application/vnd.ms-pki.stl", "application/octet-stream", "model/x.stl-binary", "model/x.stl-ascii", "text/plain"],
  zip: ["application/zip", "application/x-zip-compressed", "application/x-zip", "multipart/x-zip", "application/octet-stream"],
};

/* -------------------------------------------------------------------------- */
/* Odontograma (FDI, dentição permanente)                                      */
/* -------------------------------------------------------------------------- */

export const UPPER_TEETH = [18, 17, 16, 15, 14, 13, 12, 11, 21, 22, 23, 24, 25, 26, 27, 28];
export const LOWER_TEETH = [48, 47, 46, 45, 44, 43, 42, 41, 31, 32, 33, 34, 35, 36, 37, 38];
/** Ordem de leitura usada em listas, PDF e e-mails. */
export const TOOTH_ORDER = [...UPPER_TEETH, ...LOWER_TEETH];
export const VALID_TEETH = new Set(TOOTH_ORDER);

/* -------------------------------------------------------------------------- */
/* Textos fixos                                                                */
/* -------------------------------------------------------------------------- */

export const AVISO_ENVIO =
  "O envio da solicitação não representa o início automático do planejamento. O Quorum Lab irá conferir a documentação, prazo e aceite do trabalho em até 24 horas.";

/**
 * Os textos de /termos e /privacidade são RASCUNHOS.
 * Mudar para false somente após revisão jurídica — remove o aviso das páginas.
 */
export const LEGAL_TEXTS_DRAFT = true;
