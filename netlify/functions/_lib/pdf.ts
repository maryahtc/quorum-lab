import fontkit from "@pdf-lib/fontkit";
import { PDFDocument, rgb, setCharacterSpacing, type PDFFont, type PDFImage, type PDFPage } from "pdf-lib";
import { DOC_SLOTS, DOC_SLOT_ORDER, LOWER_TEETH, SERVICES, UPPER_TEETH } from "../../../src/shared/config";
import { LABELS, elementos, enderecoCompleto, formatBytes, formatTeeth } from "../../../src/shared/format";
import { brl, type Estimate } from "../../../src/shared/pricing";
import type { Solicitacao } from "../../../src/shared/schema";
import { CORMORANT_LIGHT, INTER_LIGHT, INTER_MEDIUM, INTER_REGULAR } from "./assets/fonts";
import { Q_SYMBOL_PNG_B64 } from "./assets/qSymbol";
import type { FileDelivery } from "./email";

/**
 * PDF-resumo da solicitação, conforme o Guia de Marca:
 * capa preta com o Q em destaque e QUORUM LAB discreto; páginas internas
 * com grid, numeração e detalhes dourados mínimos.
 */

const A4 = { w: 595.28, h: 841.89 };
const M = { x: 64, top: 72, bottom: 72 };
const LABEL_W = 150;

const BLACK = rgb(11 / 255, 11 / 255, 11 / 255);
const GOLD = rgb(205 / 255, 170 / 255, 99 / 255);
const OFFWHITE = rgb(236 / 255, 233 / 255, 226 / 255);
const GREY = rgb(0.45, 0.44, 0.42);
const LIGHT_RULE = rgb(0.86, 0.85, 0.82);
const WHITE = rgb(1, 1, 1);

interface Fonts {
  title: PDFFont;
  light: PDFFont;
  regular: PDFFont;
  medium: PDFFont;
}

export interface PdfInput {
  code: string;
  createdAt: Date;
  solicitacao: Solicitacao;
  estimate: Estimate;
  files: FileDelivery[];
  thumbnail?: Uint8Array;
}

/** Desliga substituições contextuais (ex.: hífen/parênteses "case" da Inter) que desalinham o texto no pdf-lib. */
const NO_CONTEXTUAL = { calt: false, case: false, liga: false, kern: true };

const b64 = (s: string) => Uint8Array.from(Buffer.from(s, "base64"));

export async function buildPdf(input: PdfInput): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  doc.registerFontkit(fontkit);
  doc.setTitle(`Solicitação ${input.code} — Quorum Lab`);
  doc.setAuthor("Quorum Lab");
  doc.setCreator("Quorum Lab · Solicitações");
  doc.setCreationDate(input.createdAt);

  const fonts: Fonts = {
    title: await doc.embedFont(b64(CORMORANT_LIGHT), { features: NO_CONTEXTUAL }),
    light: await doc.embedFont(b64(INTER_LIGHT), { features: NO_CONTEXTUAL }),
    regular: await doc.embedFont(b64(INTER_REGULAR), { features: NO_CONTEXTUAL }),
    medium: await doc.embedFont(b64(INTER_MEDIUM), { features: NO_CONTEXTUAL }),
  };
  const q = await doc.embedPng(b64(Q_SYMBOL_PNG_B64));
  const thumb = input.thumbnail ? await doc.embedJpg(input.thumbnail).catch(() => undefined) : undefined;

  const w = new Writer(doc, fonts, input.code);
  drawCover(w, q, input);
  drawBody(w, input, thumb);
  w.finish();
  return doc.save();
}

/* -------------------------------------------------------------------------- */

class Writer {
  page!: PDFPage;
  y = 0;
  pages: { page: PDFPage; dark: boolean }[] = [];
  private supported = new Map<PDFFont, Set<number>>();

  constructor(public doc: PDFDocument, public f: Fonts, public code: string) {}

  newPage(dark = false) {
    this.page = this.doc.addPage([A4.w, A4.h]);
    this.page.drawRectangle({ x: 0, y: 0, width: A4.w, height: A4.h, color: dark ? BLACK : WHITE });
    this.pages.push({ page: this.page, dark });
    this.y = A4.h - M.top;
  }

  ensure(space: number) {
    if (this.y - space < M.bottom + 24) this.newPage();
  }

  /** Remove caracteres que a fonte não possui (ex.: emoji), evitando falha na geração. */
  clean(text: string, font: PDFFont): string {
    let set = this.supported.get(font);
    if (!set) {
      set = new Set(font.getCharacterSet());
      this.supported.set(font, set);
    }
    return Array.from(text.replace(/\t/g, " "))
      .map((ch) => (ch === "\n" || set!.has(ch.codePointAt(0)!) ? ch : ""))
      .join("");
  }

  text(t: string, x: number, y: number, font: PDFFont, size: number, color = BLACK, tracking = 0, page = this.page) {
    const s = this.clean(t, font);
    if (tracking) page.pushOperators(setCharacterSpacing(tracking));
    page.drawText(s, { x, y, font, size, color });
    if (tracking) page.pushOperators(setCharacterSpacing(0));
  }

  width(t: string, font: PDFFont, size: number, tracking = 0) {
    const s = this.clean(t, font);
    return font.widthOfTextAtSize(s, size) + tracking * Math.max(0, Array.from(s).length - 1);
  }

  wrap(t: string, font: PDFFont, size: number, maxW: number): string[] {
    const out: string[] = [];
    for (const para of this.clean(t, font).split("\n")) {
      let line = "";
      for (const word of para.split(/\s+/).filter(Boolean)) {
        const cand = line ? `${line} ${word}` : word;
        if (font.widthOfTextAtSize(cand, size) <= maxW) line = cand;
        else {
          if (line) out.push(line);
          line = word;
          while (font.widthOfTextAtSize(line, size) > maxW && line.length > 1) {
            let i = line.length - 1;
            while (i > 1 && font.widthOfTextAtSize(line.slice(0, i), size) > maxW) i--;
            out.push(line.slice(0, i));
            line = line.slice(i);
          }
        }
      }
      out.push(line);
    }
    return out;
  }

  rule(y: number, color = LIGHT_RULE, x1 = M.x, x2 = A4.w - M.x, thickness = 0.5) {
    this.page.drawLine({ start: { x: x1, y }, end: { x: x2, y }, thickness, color });
  }

  finish() {
    const total = this.pages.length;
    this.pages.forEach(({ page, dark }, i) => {
      const y = 40;
      page.drawLine({ start: { x: M.x, y: y + 14 }, end: { x: A4.w - M.x, y: y + 14 }, thickness: 0.4, color: dark ? rgb(0.3, 0.26, 0.18) : LIGHT_RULE });
      const color = dark ? rgb(0.55, 0.53, 0.5) : GREY;
      this.text(`QUORUM LAB  |  SOLICITAÇÃO ${this.code}`, M.x, y, this.f.light, 6.5, color, 0.6, page);
      const n = `${i + 1} / ${total}`;
      this.text(n, A4.w - M.x - this.width(n, this.f.light, 6.5, 0.6), y, this.f.light, 6.5, color, 0.6, page);
    });
  }
}

/* -------------------------------------------------------------------------- */

function dateTime(d: Date) {
  const date = d.toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo", day: "2-digit", month: "2-digit", year: "numeric" });
  const time = d.toLocaleTimeString("pt-BR", { timeZone: "America/Sao_Paulo", hour: "2-digit", minute: "2-digit" });
  return `${date} · ${time}`;
}

function drawCover(w: Writer, q: PDFImage, input: PdfInput) {
  w.newPage(true);
  const { f } = w;
  const s = input.solicitacao;
  const service = SERVICES[s.servico.tipo];
  const cx = A4.w / 2;

  const qw = 132;
  const qh = (qw * q.height) / q.width;
  w.page.drawImage(q, { x: cx - qw / 2, y: A4.h - 150 - qh, width: qw, height: qh });

  let y = A4.h - 150 - qh - 76;
  const title = "SOLICITAÇÃO DE PLANEJAMENTO";
  w.text(title, cx - w.width(title, f.title, 22, 3.2) / 2, y, f.title, 22, OFFWHITE, 3.2);
  y -= 30;
  w.text(input.code, cx - w.width(input.code, f.regular, 10, 2.4) / 2, y, f.regular, 10, GOLD, 2.4);
  y -= 18;
  const when = dateTime(input.createdAt);
  w.text(when, cx - w.width(when, f.light, 8.5, 0.8) / 2, y, f.light, 8.5, rgb(0.62, 0.6, 0.56), 0.8);

  // Resumo em grid de duas colunas, com filetes dourados finos.
  y = 250;
  const colW = (A4.w - 2 * M.x) / 2;
  const cells: [string, string][] = [
    ["CLÍNICA", s.clinica.nomeFantasia],
    ["SOLICITANTE", s.clinica.solicitante],
    ["SERVIÇO", service.nome],
    ["VALOR ESTIMADO", `${input.estimate.totalAPartirDe ? "a partir de " : ""}${brl(input.estimate.total)}`],
  ];
  w.page.drawLine({ start: { x: M.x, y: y + 22 }, end: { x: A4.w - M.x, y: y + 22 }, thickness: 0.5, color: GOLD });
  cells.forEach(([label, value], i) => {
    const x = M.x + (i % 2) * colW;
    const cy = y - Math.floor(i / 2) * 56;
    w.text(label, x, cy, f.light, 6.5, GOLD, 1.4);
    const v = w.wrap(value, f.regular, 10.5, colW - 20)[0] ?? "";
    w.text(v, x, cy - 17, f.regular, 10.5, OFFWHITE);
  });
  w.page.drawLine({ start: { x: M.x, y: y - 92 }, end: { x: A4.w - M.x, y: y - 92 }, thickness: 0.5, color: GOLD });
}

function section(w: Writer, n: number, title: string) {
  w.ensure(70);
  if (w.y < A4.h - M.top) w.y -= 22;
  const num = String(n).padStart(2, "0");
  w.text(num, M.x, w.y, w.f.regular, 8, GOLD, 1.2);
  w.text(title.toUpperCase(), M.x + 26, w.y - 1, w.f.title, 15, BLACK, 2);
  w.y -= 12;
  w.rule(w.y, GOLD, M.x, A4.w - M.x, 0.5);
  w.y -= 20;
}

function field(w: Writer, label: string, value: string, opts: { color?: ReturnType<typeof rgb>; font?: PDFFont; size?: number } = {}) {
  const size = opts.size ?? 9.5;
  const font = opts.font ?? w.f.regular;
  const lines = w.wrap(value || "—", font, size, A4.w - 2 * M.x - LABEL_W);
  const lh = size * 1.5;
  w.ensure(Math.max(lh * lines.length, 14) + 8);
  w.text(label.toUpperCase(), M.x, w.y + 0.5, w.f.light, 6.5, GREY, 1.1);
  lines.forEach((line, i) => w.text(line, M.x + LABEL_W, w.y - i * lh, font, size, opts.color ?? BLACK));
  w.y -= Math.max(lh * lines.length, 14) + 6;
}

function odontogram(w: Writer, label: string, selected: number[]) {
  const sel = new Set(selected);
  const cell = 15.5;
  const gap = 2;
  const gridW = 16 * cell + 15 * gap + 8;
  const h = cell * 2 + gap + 10;
  w.ensure(h + 30);
  w.text(label.toUpperCase(), M.x, w.y + 0.5, w.f.light, 6.5, GREY, 1.1);
  const x0 = M.x + LABEL_W;
  const top = w.y + 6;
  const rows = [UPPER_TEETH, LOWER_TEETH];
  rows.forEach((teeth, r) => {
    teeth.forEach((t, i) => {
      const x = x0 + i * (cell + gap) + (i >= 8 ? 8 : 0);
      const y = top - (r + 1) * cell - r * (gap + 6);
      const on = sel.has(t);
      w.page.drawRectangle({
        x, y, width: cell, height: cell,
        color: on ? GOLD : undefined,
        borderColor: on ? GOLD : LIGHT_RULE,
        borderWidth: 0.5,
      });
      const s = String(t);
      w.text(s, x + (cell - w.width(s, w.f.regular, 5.8)) / 2, y + cell / 2 - 2, w.f.regular, 5.8, on ? BLACK : GREY);
    });
  });
  const midX = x0 + 8 * (cell + gap) + 2;
  const bottom = top - 2 * cell - gap - 6;
  w.page.drawLine({ start: { x: midX, y: top + 3 }, end: { x: midX, y: bottom - 3 }, thickness: 0.4, color: GREY });
  w.page.drawLine({ start: { x: x0 - 3, y: top - cell - 3.5 }, end: { x: x0 + gridW - 5, y: top - cell - 3.5 }, thickness: 0.4, color: GREY });
  w.y = bottom - 18;
}

function drawBody(w: Writer, input: PdfInput, thumb?: PDFImage) {
  w.newPage();
  const { f } = w;
  const s = input.solicitacao;
  const service = SERVICES[s.servico.tipo];
  const c = s.clinica;

  section(w, 1, "Dados da clínica");
  field(w, "Razão social", c.razaoSocial);
  field(w, "Nome fantasia", c.nomeFantasia);
  field(w, "CNPJ", c.cnpj);
  if (c.inscricaoMunicipal) field(w, "Inscrição municipal", c.inscricaoMunicipal);
  field(w, "Responsável", c.solicitante);
  field(w, "CRO", c.cro);
  field(w, "Telefone", c.telefone);
  field(w, "WhatsApp", c.whatsapp);
  field(w, "E-mail", c.email);
  if (c.emailNotaFiscal) field(w, "E-mail para nota fiscal", c.emailNotaFiscal);
  if (c.instagram) field(w, "Instagram", c.instagram);
  field(w, "Endereço", enderecoCompleto(c));

  section(w, 2, "Dados do paciente");
  field(w, "Identificação", s.paciente.identificacao);
  field(w, "Idade", s.paciente.idade ? `${s.paciente.idade} anos` : "");
  field(w, "Observações", s.paciente.observacoes);

  section(w, 3, "Serviço solicitado");
  field(w, "Tipo de serviço", service.nome, { font: f.medium });
  field(w, "Smile Design · elementos", formatTeeth(s.servico.dentesSmile));
  field(w, "Smile Design · quantidade", elementos(s.servico.dentesSmile.length));
  if (service.enceramento) {
    field(w, "Enceramento · elementos", formatTeeth(s.servico.dentesEnceramento));
    field(w, "Enceramento · quantidade", elementos(s.servico.dentesEnceramento.length));
  }
  w.y -= 6;
  odontogram(w, "Smile Design", s.servico.dentesSmile);
  if (service.enceramento) odontogram(w, "Enceramento", s.servico.dentesEnceramento);

  section(w, 4, "Valores");
  for (const l of input.estimate.linhas) {
    const v = l.aPartirDe ? `a partir de ${brl(l.valor)}` : l.detalhe ? `${l.detalhe} = ${brl(l.valor)}` : brl(l.valor);
    field(w, l.rotulo, v);
  }
  w.y -= 4;
  w.ensure(40);
  w.rule(w.y + 8, LIGHT_RULE);
  w.y -= 12;
  w.text("VALOR ESTIMADO", M.x, w.y + 2, f.light, 6.5, GREY, 1.1);
  w.text(`${input.estimate.totalAPartirDe ? "a partir de " : ""}${brl(input.estimate.total)}`, M.x + LABEL_W, w.y - 2, f.title, 20, BLACK, 0.5);
  w.y -= 26;
  if (input.estimate.nota) field(w, "Observação", input.estimate.nota, { color: GREY, font: f.light, size: 8.5 });

  section(w, 5, "Informações clínicas");
  field(w, "Resinas existentes", LABELS.possuiResina[s.clinico.possuiResina]);
  if (s.clinico.possuiResina === "sim") field(w, "Elementos com resina", formatTeeth(s.clinico.dentesResina));
  field(w, "Intenção restauradora", `${LABELS.intencao[s.clinico.intencao]} — ${LABELS.intencaoDescricao[s.clinico.intencao].toLowerCase()}`);
  field(w, "Alteração de cor", LABELS.alteracaoCor[s.clinico.alteracaoCor]);
  field(w, "Observações clínicas", s.clinico.informacoes);

  section(w, 6, "Documentação recebida");
  for (const slot of DOC_SLOT_ORDER) {
    const rule = service.documentos[slot];
    if (!rule) continue;
    const d = input.files.find((x) => x.slot === slot);
    const status = d
      ? `Recebido · ${formatBytes(d.size)}${d.mode === "anexo" ? " · anexado ao e-mail" : d.mode === "link" ? " · link temporário no e-mail" : ""}`
      : rule === "opcional" ? "Não enviado (opcional)" : "—";
    field(w, DOC_SLOTS[slot].titulo, status);
  }
  if (thumb) {
    const maxW = 200;
    const maxH = 140;
    const scale = Math.min(maxW / thumb.width, maxH / thumb.height);
    const tw = thumb.width * scale;
    const th = thumb.height * scale;
    w.ensure(th + 20);
    w.y -= 4;
    w.page.drawImage(thumb, { x: M.x + LABEL_W, y: w.y - th, width: tw, height: th });
    w.page.drawRectangle({ x: M.x + LABEL_W, y: w.y - th, width: tw, height: th, borderColor: LIGHT_RULE, borderWidth: 0.5 });
    w.text("PRÉ-VISUALIZAÇÃO", M.x, w.y - 6, f.light, 6.5, GREY, 1.1);
    w.y -= th + 16;
  }

  section(w, 7, "Comunicação");
  field(w, "Apresentação", LABELS.apresentacao[s.comunicacao.apresentacao]);
  if (s.comunicacao.apresentacao !== "pdf") field(w, "Melhor período", LABELS.periodo[s.comunicacao.periodo]);
  field(w, "Forma de entrega", LABELS.entrega[s.comunicacao.entrega]);
}
