import { PDFDocument } from "pdf-lib";
import { crc32, deflateSync } from "node:zlib";
import { describe, expect, it } from "vitest";
import {
  analisesValidas, arquivosTexto, dataTexto, entregaVazia, nomeArquivo, reducer, servicoTexto, temConteudo,
  type Entrega, type Imagem,
} from "../src/features/interno/entrega/model";
import { buildEntregaPdf } from "../src/features/interno/entrega/pdf";

/** PNG RGB sólido, gerado em memória (os testes não dependem de arquivos externos). */
function png(width: number, height: number): Imagem {
  const chunk = (type: string, data: Buffer) => {
    const len = Buffer.alloc(4);
    len.writeUInt32BE(data.length);
    const td = Buffer.concat([Buffer.from(type, "ascii"), data]);
    const crc = Buffer.alloc(4);
    crc.writeUInt32BE(crc32(td));
    return Buffer.concat([len, td, crc]);
  };
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;
  ihdr[9] = 2;
  const row = Buffer.concat([Buffer.from([0]), Buffer.alloc(width * 3, 0x80)]);
  const raw = Buffer.concat(Array.from({ length: height }, () => row));
  const bytes = Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", ihdr),
    chunk("IDAT", deflateSync(raw)),
    chunk("IEND", Buffer.alloc(0)),
  ]);
  return { bytes: new Uint8Array(bytes), formato: "png", largura: width, altura: height };
}

const LONGO =
  "Planejamento desenvolvido considerando proporção, exposição dentária, corredor bucal e preservação dos volumes existentes. ".repeat(12);

function caso(over: Partial<Entrega> = {}): Entrega {
  return {
    ...entregaVazia(),
    codigo: "QL-261013-7KF3",
    clinica: "Clínica Exemplo",
    dentista: "Dra. Marina Costa",
    paciente: "MC",
    servico: "smile_enceramento",
    data: "2026-10-13",
    leitura: "Planejamento desenvolvido considerando proporção, exposição dentária, corredor bucal e preservação dos volumes existentes.",
    analises: [
      { id: "a1", imagem: png(1920, 1080), titulo: "Vista frontal", descricao: "Redistribuição dos espaços e adequação das proporções dos incisivos." },
      { id: "a2", imagem: png(1080, 1440), titulo: "Perfil", descricao: "Controle do volume vestibular mantendo o posicionamento dos caninos." },
      { id: "a3", imagem: png(1600, 1000), titulo: "Sobreposição", descricao: "Sobreposição do enceramento sobre a situação inicial." },
    ],
    decisoes: [
      { id: "d1", tipo: "acrescimo", elemento: "12", descricao: "0,6 mm distal" },
      { id: "d2", tipo: "manutencao", elemento: "11 · 21", descricao: "Manutenção do comprimento" },
      { id: "d3", tipo: "atencao", elemento: "22", descricao: "Atenção ao volume vestibular" },
      { id: "d4", tipo: "ajuste", elemento: "13 a 23", descricao: "Redistribuição dos espaços" },
    ],
    orientacoes: [
      { id: "o1", texto: "Validar através de mock-up antes da execução definitiva." },
      { id: "o2", texto: "Respeitar os volumes indicados no planejamento." },
    ],
    arquivos: ["pdf", "smile", "stl_superior", "stl_inferior", "enceramento"],
    ...over,
  };
}

async function paginas(e: Entrega) {
  const doc = await PDFDocument.load(await buildEntregaPdf(e));
  for (const p of doc.getPages()) {
    expect(Math.round(p.getWidth())).toBe(595);
    expect(Math.round(p.getHeight())).toBe(842);
  }
  return doc.getPageCount();
}

describe("entrega · modelo", () => {
  it("nome do arquivo segue QUORUM_[CODIGO]_[PACIENTE].pdf, sem acentos nem caracteres especiais", () => {
    expect(nomeArquivo({ codigo: "QL-261013-7KF3", paciente: "MT" })).toBe("QUORUM_QL-261013-7KF3_MT.pdf");
    expect(nomeArquivo({ codigo: " ql-261013-7kf3 ", paciente: "M. Tê / Ção" })).toBe("QUORUM_QL-261013-7KF3_M-TE-CAO.pdf");
    expect(nomeArquivo({ codigo: "", paciente: "" })).toBe("QUORUM_SEM-CODIGO.pdf");
    expect(nomeArquivo({ codigo: "../../etc", paciente: "a\\b:c*?" })).toBe("QUORUM_ETC_ABC.pdf");
  });

  it("reordena, adiciona e exclui análises; a ordem da lista é a ordem do PDF", () => {
    let s = entregaVazia();
    for (const id of ["a", "b", "c"]) s = reducer(s, { t: "analise/add", id });
    s = reducer(s, { t: "analise/mover", id: "c", delta: -1 });
    expect(s.analises.map((a) => a.id)).toEqual(["a", "c", "b"]);
    s = reducer(s, { t: "analise/mover", id: "a", delta: -1 }); // já é a primeira
    expect(s.analises.map((a) => a.id)).toEqual(["a", "c", "b"]);
    s = reducer(s, { t: "analise/remover", id: "c" });
    expect(s.analises.map((a) => a.id)).toEqual(["a", "b"]);
    expect(analisesValidas(s)).toHaveLength(0); // vazias não entram no PDF
  });

  it("limpar volta ao estado inicial", () => {
    const s = reducer(caso(), { t: "limpar" });
    expect(temConteudo(s)).toBe(false);
    expect(s.analises).toEqual([]);
  });

  it("textos derivados: serviço 'Outro', arquivos marcados e data", () => {
    expect(servicoTexto(caso({ servico: "outro", servicoOutro: "Guia cirúrgico" }))).toBe("Guia cirúrgico");
    expect(arquivosTexto(caso({ arquivos: ["outro", "pdf"], arquivoOutro: "Fotos do mock-up" }))).toEqual(["PDF do planejamento", "Fotos do mock-up"]);
    expect(dataTexto("2026-10-13")).toBe("13/10/2026");
  });
});

describe("entrega · PDF", () => {
  it("caso fictício completo: 3 análises, 4 decisões, 2 orientações", async () => {
    const n = await paginas(caso());
    expect(n).toBeGreaterThanOrEqual(3);
    expect(n).toBeLessThanOrEqual(6);
  });

  it("formulário vazio ainda gera capa + página final", async () => {
    expect(await paginas(entregaVazia())).toBe(2);
  });

  it("sem análises, decisões ou orientações", async () => {
    expect(await paginas(caso({ analises: [], decisoes: [], orientacoes: [], arquivos: [] }))).toBe(2);
  });

  it("1 e 6 análises, horizontais e verticais", async () => {
    const um = await paginas(caso({ analises: caso().analises.slice(0, 1) }));
    const seis = await paginas(caso({ analises: [...caso().analises, ...caso().analises].map((a, i) => ({ ...a, id: `x${i}` })) }));
    expect(seis).toBeGreaterThan(um);
  });

  it("textos longos, acentos, emoji e caracteres especiais não quebram a geração", async () => {
    const n = await paginas(
      caso({
        clinica: "Clínica Odontológica São João & Associados — Unidade Ação ".repeat(3),
        leitura: LONGO,
        analises: caso().analises.map((a) => ({ ...a, titulo: "Proporções → simetria ↔ volumes 😀", descricao: LONGO })),
        decisoes: Array.from({ length: 15 }, (_, i) => ({
          id: `d${i}`, tipo: (["acrescimo", "reducao", "manutencao", "atencao", "ajuste"] as const)[i % 5],
          elemento: i === 3 ? "SuperLongoSemEspaçosQueNaoCabeNaColunaDeJeitoNenhum123456789" : "13 a 23", descricao: "Redução de volume cervical ≈ 0,3 mm • “aspas” ".repeat(3),
        })),
        orientacoes: Array.from({ length: 10 }, (_, i) => ({ id: `o${i}`, texto: `${i}: ${LONGO.slice(0, 300)}` })),
      }),
    );
    expect(n).toBeGreaterThan(5);
  });

  it("análise sem imagem (só texto) entra no PDF", async () => {
    expect(await paginas(caso({ analises: [{ id: "t", titulo: "Periodontal", descricao: "Sem print." }] }))).toBeGreaterThanOrEqual(3);
  });
});
