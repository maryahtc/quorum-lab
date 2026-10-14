import fontkit from "@pdf-lib/fontkit";
import { PDFDocument, rgb, setCharacterSpacing, type Color, type PDFFont, type PDFImage, type PDFPage } from "pdf-lib";
import {
  analisesValidas, arquivosTexto, dataTexto, decisaoTipo, decisoesValidas, orientacoesValidas, servicoTexto,
  type DecisaoTipo, type Entrega,
} from "./model";

/**
 * PDF técnico de entrega do planejamento, gerado inteiramente no navegador.
 *
 * Segue o Guia de Marca: capa preta com o Q em destaque e QUORUM LAB discreto;
 * páginas internas brancas, com numeração editorial, filetes finos e dourado
 * mínimo. As imagens são protagonistas e nunca são distorcidas ou recortadas.
 */

const A4 = { w: 595.28, h: 841.89 };
const M = { x: 64, top: 76, bottom: 84 };
const CW = A4.w - 2 * M.x;

const BLACK = rgb(11 / 255, 11 / 255, 11 / 255);
const GOLD = rgb(205 / 255, 170 / 255, 99 / 255);
const OFFWHITE = rgb(236 / 255, 233 / 255, 226 / 255);
const GREY = rgb(0.45, 0.44, 0.42);
const SOFT = rgb(0.62, 0.6, 0.56);
const RULE = rgb(0.86, 0.85, 0.82);
const WHITE = rgb(1, 1, 1);

/** Altura máxima de uma imagem (uma vertical não ocupa a página inteira). */
const IMG_MAX_H = 520;
/** Uma imagem pode encolher até este fator para caber no restante da página. */
const IMG_MIN_SCALE = 0.72;

/** Desliga substituições contextuais da Inter que desalinham o texto no pdf-lib. */
const NO_CONTEXTUAL = { calt: false, case: false, liga: false, kern: true };

/** Caracteres comuns que as fontes embutidas não possuem: troca por equivalentes. */
const SUBSTITUTOS: Record<string, string> = { "→": "›", "←": "‹", "↔": "‹›", "⟶": "›", "•": "·", "○": "o", "≈": "~", "≥": ">=", "≤": "<=" };

interface Fonts {
  title: PDFFont;
  light: PDFFont;
  regular: PDFFont;
  medium: PDFFont;
}

function b64(s: string) {
  const bin = atob(s);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

/** Fontes e símbolo Q: os mesmos arquivos do PDF da solicitação, carregados só na hora de gerar. */
async function loadAssets() {
  const [fonts, q] = await Promise.all([
    import("../../../../netlify/functions/_lib/assets/fonts"),
    import("../../../../netlify/functions/_lib/assets/qSymbol"),
  ]);
  return { fonts, q: q.Q_SYMBOL_PNG_B64 };
}

export async function buildEntregaPdf(e: Entrega, opts: { geradoEm?: Date } = {}): Promise<Uint8Array> {
  const assets = await loadAssets();
  const doc = await PDFDocument.create();
  doc.registerFontkit(fontkit);
  const codigo = e.codigo.trim();
  doc.setTitle(`Planejamento digital${codigo ? ` ${codigo}` : ""} — Quorum Lab`);
  doc.setAuthor("Quorum Lab");
  doc.setCreator("Quorum Lab · Entrega do planejamento");
  doc.setProducer("Quorum Lab");
  doc.setCreationDate(opts.geradoEm ?? new Date());

  const f: Fonts = {
    title: await doc.embedFont(b64(assets.fonts.CORMORANT_LIGHT), { features: NO_CONTEXTUAL }),
    light: await doc.embedFont(b64(assets.fonts.INTER_LIGHT), { features: NO_CONTEXTUAL }),
    regular: await doc.embedFont(b64(assets.fonts.INTER_REGULAR), { features: NO_CONTEXTUAL }),
    medium: await doc.embedFont(b64(assets.fonts.INTER_MEDIUM), { features: NO_CONTEXTUAL }),
  };
  const q = await doc.embedPng(b64(assets.q));

  const w = new Writer(doc, f, codigo);
  drawCover(w, q, e);
  await drawBody(w, q, e);
  w.finish();
  return doc.save();
}

/* -------------------------------------------------------------------------- */

class Writer {
  page!: PDFPage;
  y = 0;
  pages: { page: PDFPage; dark: boolean }[] = [];
  private supported = new Map<PDFFont, Set<number>>();

  constructor(public doc: PDFDocument, public f: Fonts, public codigo: string) {}

  newPage(dark = false) {
    this.page = this.doc.addPage([A4.w, A4.h]);
    this.page.drawRectangle({ x: 0, y: 0, width: A4.w, height: A4.h, color: dark ? BLACK : WHITE });
    this.pages.push({ page: this.page, dark });
    this.y = A4.h - M.top;
  }

  /** Espaço útil restante até a margem inferior. */
  get room() {
    return this.y - M.bottom;
  }

  ensure(space: number) {
    if (this.room < space) {
      this.newPage();
      return true;
    }
    return false;
  }

  get atTop() {
    return this.y >= A4.h - M.top;
  }

  /** Remove o que a fonte não possui (ex.: emoji), em vez de falhar a geração. */
  clean(text: string, font: PDFFont): string {
    let set = this.supported.get(font);
    if (!set) {
      set = new Set(font.getCharacterSet());
      this.supported.set(font, set);
    }
    return Array.from(text.replace(/\t/g, " ").replace(/\r\n?/g, "\n"))
      .flatMap((ch) => Array.from(SUBSTITUTOS[ch] ?? ch))
      .filter((ch) => ch === "\n" || set!.has(ch.codePointAt(0)!))
      .join("");
  }

  text(t: string, x: number, y: number, font: PDFFont, size: number, color: Color = BLACK, tracking = 0, page = this.page) {
    const s = this.clean(t, font);
    if (tracking) page.pushOperators(setCharacterSpacing(tracking));
    page.drawText(s, { x, y, font, size, color });
    if (tracking) page.pushOperators(setCharacterSpacing(0));
  }

  width(t: string, font: PDFFont, size: number, tracking = 0) {
    const s = this.clean(t, font);
    return font.widthOfTextAtSize(s, size) + tracking * Math.max(0, Array.from(s).length - 1);
  }

  centered(t: string, y: number, font: PDFFont, size: number, color: Color, tracking = 0) {
    this.text(t, (A4.w - this.width(t, font, size, tracking)) / 2, y, font, size, color, tracking);
  }

  /** Quebra por largura; palavras maiores que a linha são partidas (nada sai da página). */
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
    while (out.length && !out[out.length - 1]) out.pop();
    return out;
  }

  /** Parágrafo que continua na página seguinte se não couber. */
  paragraph(t: string, font: PDFFont, size: number, leading: number, color: Color = BLACK, x = M.x, maxW = CW) {
    for (const line of this.wrap(t, font, size, maxW)) {
      this.ensure(leading);
      this.y -= leading;
      if (line) this.text(line, x, this.y + leading - size, font, size, color);
    }
  }

  rule(y: number, color: Color = RULE, x1 = M.x, x2 = A4.w - M.x, thickness = 0.5) {
    this.page.drawLine({ start: { x: x1, y }, end: { x: x2, y }, thickness, color });
  }

  finish() {
    const total = this.pages.length;
    this.pages.forEach(({ page, dark }, i) => {
      if (dark) return; // capa limpa, sem rodapé
      const y = 40;
      page.drawLine({ start: { x: M.x, y: y + 14 }, end: { x: A4.w - M.x, y: y + 14 }, thickness: 0.4, color: RULE });
      const left = `QUORUM LAB  |  PLANEJAMENTO DIGITAL${this.codigo ? `  ·  ${this.codigo}` : ""}`;
      this.text(left, M.x, y, this.f.light, 6.5, GREY, 0.6, page);
      const n = `${i + 1} / ${total}`;
      this.text(n, A4.w - M.x - this.width(n, this.f.light, 6.5, 0.6), y, this.f.light, 6.5, GREY, 0.6, page);
    });
  }
}

/* -------------------------------------------------------------------------- */
/* Capa                                                                        */
/* -------------------------------------------------------------------------- */

function drawCover(w: Writer, q: PDFImage, e: Entrega) {
  w.newPage(true);
  const { f } = w;

  const qw = 118;
  const qh = (qw * q.height) / q.width;
  const qTop = A4.h - 168;
  w.page.drawImage(q, { x: (A4.w - qw) / 2, y: qTop - qh, width: qw, height: qh });

  let y = qTop - qh - 40;
  w.centered("QUORUM LAB", y, f.title, 12, OFFWHITE, 4.2);

  y = 430;
  w.centered("PLANEJAMENTO DIGITAL", y, f.title, 25, OFFWHITE, 4);
  const codigo = e.codigo.trim();
  if (codigo) {
    y -= 30;
    w.centered(codigo, y, f.regular, 10, GOLD, 2.6);
  }

  // Ficha do caso: discreta, alinhada à esquerda, um único filete dourado.
  const rows: [string, string][] = [
    ["CLÍNICA", e.clinica.trim()],
    ["DENTISTA", e.dentista.trim()],
    ["PACIENTE", e.paciente.trim()],
    ["SERVIÇO", servicoTexto(e)],
    ["DATA", dataTexto(e.data)],
  ];
  const labelW = 96;
  const valueW = CW - labelW;
  const lines = rows.map(([, v]) => w.wrap(v || "—", f.light, 9.5, valueW).slice(0, 2));
  const rowH = (n: number) => 12 + n * 13;
  let top = 108 + lines.reduce((s, l) => s + rowH(l.length), 0);
  w.rule(top + 18, GOLD, M.x, A4.w - M.x, 0.5);
  rows.forEach(([label], i) => {
    w.text(label, M.x, top - 0.5, f.light, 6.5, GOLD, 1.6);
    lines[i].forEach((line, j) => w.text(line, M.x + labelW, top - j * 13, f.light, 9.5, OFFWHITE, 0.2));
    top -= rowH(lines[i].length);
  });
}

/* -------------------------------------------------------------------------- */
/* Corpo                                                                       */
/* -------------------------------------------------------------------------- */

const HEAD = { size: 15, leading: 19, gapBefore: 14 };
const headingLines = (w: Writer, title: string) => w.wrap(title.toUpperCase(), w.f.title, HEAD.size, CW - 40);

/** Altura exata que o cabeçalho ocupará na posição atual (ou no topo de uma página nova). */
function headingHeight(w: Writer, title: string, atTop = w.atTop) {
  return (atTop ? 0 : HEAD.gapBefore) + 12 + (headingLines(w, title).length - 1) * HEAD.leading + 10 + 18;
}

/** Cabeçalho editorial: "02 / VISTA FRONTAL", com filete dourado fino. */
function heading(w: Writer, n: number, title: string, opts: { keepWith?: number } = {}) {
  w.ensure(headingHeight(w, title) + (opts.keepWith ?? 60));
  if (!w.atTop) w.y -= HEAD.gapBefore;
  const num = String(n).padStart(2, "0");
  const base = w.y - 12;
  w.text(num, M.x, base + 1, w.f.regular, 8, GOLD, 1.2);
  const slashX = M.x + w.width(num, w.f.regular, 8, 1.2) + 8;
  w.text("/", slashX, base + 1, w.f.light, 8, SOFT);
  const lines = headingLines(w, title);
  lines.forEach((line, i) => w.text(line, slashX + 14, base - i * HEAD.leading, w.f.title, HEAD.size, BLACK, 2));
  w.y = base - (lines.length - 1) * HEAD.leading - 10;
  w.rule(w.y, GOLD, M.x, A4.w - M.x, 0.5);
  w.y -= 18;
}

async function drawBody(w: Writer, q: PDFImage, e: Entrega) {
  w.newPage();
  const { f } = w;
  let n = 0;

  const leitura = e.leitura.trim();
  if (leitura) {
    heading(w, ++n, "Leitura do caso");
    w.paragraph(leitura, f.title, 15, 22, BLACK);
    w.y -= 26;
  }

  for (const a of analisesValidas(e)) await drawAnalise(w, ++n, a);

  const decisoes = decisoesValidas(e);
  if (decisoes.length) {
    // A seção de decisões ganha presença: abre página nova se restar pouco espaço.
    if (!w.atTop && w.room < 360) w.newPage();
    heading(w, ++n, "Decisões do planejamento", { keepWith: 120 });
    w.text("Existe critério antes de existir arquivo.", M.x, w.y - 10, f.title, 12.5, GREY, 0.3);
    w.y -= 34;
    drawDecisoes(w, decisoes);
    w.y -= 20;
  }

  const orientacoes = orientacoesValidas(e);
  if (orientacoes.length) {
    heading(w, ++n, "Orientações para execução");
    orientacoes.forEach((o, i) => {
      const lines = w.wrap(o.texto.trim(), f.regular, 11, CW - 40);
      const h = lines.length * 17 + 18;
      w.ensure(Math.min(h, 120));
      const top = w.y;
      w.text(String(i + 1).padStart(2, "0"), M.x, top - 12, f.regular, 8, GOLD, 1.2);
      w.y = top - 1;
      w.paragraph(o.texto.trim(), f.regular, 11, 17, BLACK, M.x + 40, CW - 40);
      w.y -= 10;
      if (i < orientacoes.length - 1) w.rule(w.y + 2);
      w.y -= 8;
    });
    w.y -= 14;
  }

  const arquivos = arquivosTexto(e);
  if (arquivos.length) {
    heading(w, ++n, "Arquivos da entrega");
    for (const nome of arquivos) {
      const lines = w.wrap(nome, f.regular, 11, CW - 22);
      w.ensure(lines.length * 17 + 10);
      w.page.drawRectangle({ x: M.x, y: w.y - 10.5, width: 4, height: 4, color: GOLD });
      w.paragraph(nome, f.regular, 11, 17, BLACK, M.x + 22, CW - 22);
      w.y -= 6;
    }
  }

  drawSignOff(w, q);
}

async function drawAnalise(w: Writer, n: number, a: Entrega["analises"][number]) {
  const { f } = w;
  const titulo = a.titulo.trim() || "Análise";
  const desc = a.descricao.trim();
  const descLines = desc ? w.wrap(desc, f.light, 11, CW - 40) : [];
  const descH = descLines.length ? 14 + descLines.length * 16.5 : 0;
  // Ao calcular o espaço da imagem, considera no máximo ~6 linhas de descrição;
  // textos mais longos continuam na página seguinte.
  const descReserve = Math.min(descH, 14 + 6 * 16.5);

  if (!a.imagem) {
    heading(w, n, titulo, { keepWith: descReserve || 20 });
    if (desc) w.paragraph(desc, f.light, 11, 16.5, BLACK, M.x, CW - 40);
    w.y -= 30;
    return;
  }

  const img = a.imagem;
  const image = img.formato === "png" ? await w.doc.embedPng(img.bytes) : await w.doc.embedJpg(img.bytes);
  // Proporção sempre a do arquivo embutido: nunca distorce.
  const ratio = image.height / image.width;
  let iw = CW;
  let ih = iw * ratio;
  if (ih > IMG_MAX_H) {
    ih = IMG_MAX_H;
    iw = ih / ratio;
  }

  // Cabe aqui (inteira ou levemente reduzida)? Senão, abre página nova.
  const avail0 = w.room - headingHeight(w, titulo) - 2 - descReserve;
  if (!w.atTop && avail0 < ih * IMG_MIN_SCALE) w.newPage();
  const avail = w.room - headingHeight(w, titulo) - 2 - descReserve;
  if (ih > avail) {
    const s = avail / ih;
    ih *= s;
    iw *= s;
  }

  heading(w, n, titulo, { keepWith: ih + descReserve });
  w.y -= 2;
  w.page.drawImage(image, { x: M.x, y: w.y - ih, width: iw, height: ih });
  w.page.drawRectangle({ x: M.x, y: w.y - ih, width: iw, height: ih, borderColor: RULE, borderWidth: 0.4 });
  w.y -= ih;
  if (desc) {
    w.y -= 12;
    w.paragraph(desc, f.light, 11, 16.5, BLACK, M.x, CW - 40);
  }
  w.y -= 34;
}

/* -------------------------------------------------------------------------- */
/* Decisões                                                                    */
/* -------------------------------------------------------------------------- */

/** Símbolos desenhados em vetor (as fontes não têm ○ nem ↔); mesma cor para todos os tipos. */
function symbol(page: PDFPage, tipo: DecisaoTipo, cx: number, cy: number, s = 10.5, color: Color = GOLD) {
  const t = 1.15;
  const r = s / 2;
  const line = (x1: number, y1: number, x2: number, y2: number) =>
    page.drawLine({ start: { x: cx + x1, y: cy + y1 }, end: { x: cx + x2, y: cy + y2 }, thickness: t, color });
  switch (tipo) {
    case "acrescimo":
      line(-r, 0, r, 0);
      line(0, -r, 0, r);
      break;
    case "reducao":
      line(-r, 0, r, 0);
      break;
    case "manutencao":
      page.drawEllipse({ x: cx, y: cy, xScale: r, yScale: r, borderColor: color, borderWidth: t });
      break;
    case "atencao":
      line(0, -r * 0.3, 0, r);
      page.drawEllipse({ x: cx, y: cy - r * 0.85, xScale: 0.95, yScale: 0.95, color });
      break;
    case "ajuste": {
      const a = r * 0.55;
      line(-r - 1, 0, r + 1, 0);
      line(-r - 1, 0, -r - 1 + a, a);
      line(-r - 1, 0, -r - 1 + a, -a);
      line(r + 1, 0, r + 1 - a, a);
      line(r + 1, 0, r + 1 - a, -a);
      break;
    }
  }
}

function drawDecisoes(w: Writer, decisoes: Entrega["decisoes"]) {
  const { f } = w;
  const gap = 36;
  const cols = decisoes.length > 1 ? 2 : 1;
  const colW = cols === 2 ? (CW - gap) / 2 : CW;
  const symW = 24;

  const cell = (d: Entrega["decisoes"][number]) => {
    const elemento = w.wrap(d.elemento.trim() || "—", f.medium, 14, colW - symW - 18);
    const desc = d.descricao.trim() ? w.wrap(d.descricao.trim(), f.regular, 11, colW) : [];
    const h = 20 + elemento.length * 19 + (desc.length ? 7 + desc.length * 16 : 0) + 12;
    return { d, elemento, desc, h };
  };

  for (let i = 0; i < decisoes.length; i += cols) {
    const row = decisoes.slice(i, i + cols).map(cell);
    const h = Math.max(...row.map((c) => c.h));
    w.ensure(h + 4);
    const top = w.y;
    w.rule(top, RULE);
    row.forEach((c, k) => {
      const x = M.x + k * (colW + gap);
      const tipo = decisaoTipo(c.d.tipo);
      // Linha de tipo: micro-rótulo silencioso à direita.
      const label = tipo.label.toUpperCase();
      w.text(label, x + colW - w.width(label, f.light, 6.3, 1.4), top - 13, f.light, 6.3, GREY, 1.4);
      let y = top - 20 - 14;
      symbol(w.page, c.d.tipo, x + 6, y + 5);
      w.text("/", x + symW - 6, y, f.light, 13, SOFT);
      c.elemento.forEach((line, j) => w.text(line, x + symW + 6, y - j * 19, f.medium, 14, BLACK, 0.2));
      y -= (c.elemento.length - 1) * 19;
      if (c.desc.length) {
        y -= 21;
        c.desc.forEach((line, j) => w.text(line, x, y - j * 16, f.regular, 11, BLACK));
      }
    });
    w.y = top - h;
  }
  w.rule(w.y, RULE);
}

/* -------------------------------------------------------------------------- */

function drawSignOff(w: Writer, q: PDFImage) {
  const { f } = w;
  const qw = 30;
  const qh = (qw * q.height) / q.width;
  const block = qh + 66; // Q, filete, QUORUM LAB e a frase
  w.ensure(block + 12);
  // Assinatura no pé da última página (ou logo abaixo do conteúdo, se faltar espaço).
  const top = Math.min(w.y - 12, M.bottom + block - 8);
  w.page.drawImage(q, { x: (A4.w - qw) / 2, y: top - qh, width: qw, height: qh });
  w.page.drawLine({ start: { x: A4.w / 2 - 18, y: top - qh - 16 }, end: { x: A4.w / 2 + 18, y: top - qh - 16 }, thickness: 0.5, color: GOLD });
  w.centered("QUORUM LAB", top - qh - 38, f.title, 12, BLACK, 4);
  w.centered("Precisão, planejamento e decisão.", top - qh - 56, f.light, 8.5, GREY, 0.4);
  w.y = top - block;
}
