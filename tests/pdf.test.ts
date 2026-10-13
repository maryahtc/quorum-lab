import { writeFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { buildPdf } from "../netlify/functions/_lib/pdf";
import { estimate } from "../src/shared/pricing";
import { solicitacaoExemplo } from "./fixtures";

describe("PDF", () => {
  it("gera o PDF-resumo", async () => {
    const s = solicitacaoExemplo;
    const pdf = await buildPdf({
      code: "QL-261013-7KF3Q",
      createdAt: new Date("2026-10-13T14:32:00-03:00"),
      solicitacao: s,
      estimate: estimate(s.servico.tipo, s.servico.dentesEnceramento),
      files: [
        { slot: "foto", key: "k", name: "foto.jpg", size: 4_200_000, ext: "jpg", contentType: "image/jpeg", mode: "anexo" },
        { slot: "stl_superior", key: "k", name: "sup.stl", size: 9_800_000, ext: "stl", contentType: "model/stl", mode: "anexo" },
        { slot: "tomografia", key: "k", name: "tomo.zip", size: 380_000_000, ext: "zip", contentType: "application/zip", mode: "link", url: "https://x" },
      ],
    });
    expect(pdf.length).toBeGreaterThan(10_000);
    if (process.env.PDF_OUT) writeFileSync(process.env.PDF_OUT, pdf);
  });
});
