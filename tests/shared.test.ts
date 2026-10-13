import { describe, expect, it } from "vitest";
import { matchesSignature, sanitizeFileName, validateFileMeta } from "../src/shared/files";
import { formatTeeth } from "../src/shared/format";
import { estimate } from "../src/shared/pricing";
import { normalizeSolicitacao, solicitacaoSchema } from "../src/shared/schema";
import { isValidCnpj } from "../src/shared/validators";
import { solicitacaoExemplo } from "./fixtures";

describe("valores", () => {
  it("Smile Design isolado é fixo, independente do número de dentes", () => {
    expect(estimate("smile", []).total).toBe(300);
  });
  it("enceramento cobra apenas os dentes encerados", () => {
    const e = estimate("smile_enceramento", [12, 11, 21, 22]);
    expect(e.total).toBe(150 + 4 * 80);
    expect(e.totalAPartirDe).toBe(false);
  });
  it("PerioGuide soma o valor inicial e marca 'a partir de'", () => {
    const e = estimate("smile_enceramento_perioguide", [11, 21]);
    expect(e.total).toBe(150 + 160 + 400);
    expect(e.totalAPartirDe).toBe(true);
    expect(e.nota).toMatch(/PerioGuide/);
  });
});

describe("validações", () => {
  it("CNPJ", () => {
    expect(isValidCnpj("11.222.333/0001-81")).toBe(true);
    expect(isValidCnpj("11.222.333/0001-82")).toBe(false);
    expect(isValidCnpj("00.000.000/0000-00")).toBe(false);
  });
  it("aceita a solicitação exemplo", () => {
    expect(solicitacaoSchema.safeParse(solicitacaoExemplo).success).toBe(true);
  });
  it("exige dentes de enceramento quando o serviço inclui enceramento", () => {
    const s = { ...solicitacaoExemplo, servico: { ...solicitacaoExemplo.servico, dentesEnceramento: [] } };
    expect(solicitacaoSchema.safeParse(s).success).toBe(false);
  });
  it("rejeita resina em dente fora do planejamento", () => {
    const s = { ...solicitacaoExemplo, clinico: { ...solicitacaoExemplo.clinico, dentesResina: [36] } };
    expect(solicitacaoSchema.safeParse(s).success).toBe(false);
  });
  it("normaliza: Smile Design isolado descarta dentes de enceramento", () => {
    const s = normalizeSolicitacao({ ...solicitacaoExemplo, servico: { ...solicitacaoExemplo.servico, tipo: "smile" } });
    expect(s.servico.dentesEnceramento).toEqual([]);
    expect(s.clinico.dentesResina).toEqual([11, 21]);
  });
  it("ordem FDI de leitura", () => {
    expect(formatTeeth([21, 11, 23, 13, 12, 22])).toBe("13 · 12 · 11 · 21 · 22 · 23");
  });
});

describe("arquivos", () => {
  it("sanitiza nomes", () => {
    expect(sanitizeFileName("../Foto Sorriso Ção!!.JPG")).toBe("foto-sorriso-cao.jpg");
  });
  it("valida extensão e tamanho", () => {
    expect(validateFileMeta("foto", "a.gif", 100)).toMatch(/Formato/);
    expect(validateFileMeta("foto", "a.heic", 26 * 1024 * 1024)).toMatch(/limite/);
    expect(validateFileMeta("tomografia", "dicom.zip", 500 * 1024 * 1024)).toBeNull();
  });
  it("confere assinaturas", () => {
    expect(matchesSignature("image", new Uint8Array([0xff, 0xd8, 0xff, 0xe0]), 100)).toBe(true);
    expect(matchesSignature("image", new Uint8Array([0x47, 0x49, 0x46, 0x38]), 100)).toBe(false);
    expect(matchesSignature("zip", new Uint8Array([0x50, 0x4b, 0x03, 0x04]), 100)).toBe(true);
    const stl = new Uint8Array(96);
    new DataView(stl.buffer).setUint32(80, 2, true);
    expect(matchesSignature("stl", stl, 84 + 2 * 50)).toBe(true);
    expect(matchesSignature("stl", stl, 84 + 3 * 50)).toBe(false);
    expect(matchesSignature("stl", new TextEncoder().encode("solid model".padEnd(96)), 500)).toBe(true);
  });
});
