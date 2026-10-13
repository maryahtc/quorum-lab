import { beforeEach, describe, expect, it, vi } from "vitest";
import { solicitacaoExemplo } from "./fixtures";

/**
 * Fluxo completo das Functions com R2 e Resend simulados (fetch mockado).
 * Confere: tickets assinados, verificação dos arquivos, regra de anexo × link,
 * assunto/destinatários dos e-mails e confirmação ao solicitante.
 */

const stored = new Map<string, Uint8Array>();
const emails: { to: string[]; subject: string; text: string; attachments?: { filename: string }[]; headers: Record<string, string> }[] = [];

function stl(sizeTriangles: number) {
  const b = new Uint8Array(84 + sizeTriangles * 50);
  new DataView(b.buffer).setUint32(80, sizeTriangles, true);
  return b;
}
const JPG = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, ...new Array(2000).fill(1)]);
function zip(size: number) {
  const b = new Uint8Array(size);
  b.set([0x50, 0x4b, 0x03, 0x04]);
  return b;
}

beforeEach(() => {
  stored.clear();
  emails.length = 0;
  Object.assign(process.env, {
    R2_ACCOUNT_ID: "acc",
    R2_ACCESS_KEY_ID: "key",
    R2_SECRET_ACCESS_KEY: "secret",
    R2_BUCKET: "bucket",
    RESEND_API_KEY: "re_test",
    MAIL_FROM: "Quorum Lab <solicitacoes@example.com>",
    QUORUM_INBOX_EMAIL: "quorum@example.com",
    UPLOAD_SIGNING_SECRET: "x".repeat(40),
    ATTACHMENT_MAX_MB: "1",
  });
  delete process.env.TURNSTILE_SECRET_KEY;

  vi.stubGlobal("fetch", async (input: RequestInfo | URL, init?: RequestInit) => {
    const req = input instanceof Request ? input : new Request(input, init);
    const url = new URL(req.url);
    if (url.hostname === "api.resend.com") {
      const body = JSON.parse(await req.text());
      emails.push({ ...body, headers: Object.fromEntries(req.headers) });
      return new Response(JSON.stringify({ id: "1" }), { status: 200 });
    }
    if (url.hostname.endsWith("r2.cloudflarestorage.com")) {
      expect(req.headers.get("authorization")).toMatch(/AWS4-HMAC-SHA256/);
      const key = decodeURIComponent(url.pathname.replace("/bucket/", ""));
      const obj = stored.get(key);
      if (!obj) return new Response(null, { status: 404 });
      if (req.method === "HEAD") return new Response(null, { status: 200, headers: { "content-length": String(obj.length) } });
      const range = req.headers.get("range");
      if (range) {
        const end = Number(/bytes=0-(\d+)/.exec(range)![1]);
        return new Response(obj.slice(0, end + 1) as unknown as BodyInit, { status: 206 });
      }
      return new Response(obj as unknown as BodyInit, { status: 200 });
    }
    throw new Error(`fetch inesperado: ${url}`);
  });
});

const ctx = { ip: "127.0.0.1" } as never;
const post = (path: string, body: unknown) =>
  new Request(`https://quorum.test${path}`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });

async function uploadAndSubmit(files: Record<string, Uint8Array>, name: Record<string, string>) {
  const { default: uploadUrls } = await import("../netlify/functions/upload-urls");
  const { default: submit } = await import("../netlify/functions/submit");
  const res = await uploadUrls(
    post("/api/upload-urls", {
      startedAt: Date.now() - 60_000,
      servico: solicitacaoExemplo.servico.tipo,
      files: Object.entries(files).map(([slot, b]) => ({ slot, name: name[slot], size: b.length, type: "" })),
    }),
    ctx,
  );
  const data = await res.json();
  expect(res.status, JSON.stringify(data)).toBe(200);
  expect(data.code).toMatch(/^QL-\d{6}-[A-Z2-9]{5}$/);
  // "upload" direto ao storage: grava pela chave contida na URL assinada.
  for (const u of data.uploads) {
    const url = new URL(u.url);
    expect(url.searchParams.get("X-Amz-Expires")).toBe("900");
    stored.set(decodeURIComponent(url.pathname.replace("/bucket/", "")), files[u.slot]);
  }
  const out = await submit(post("/api/submit", { ticket: data.ticket, solicitacao: solicitacaoExemplo }), ctx);
  return { status: out.status, body: await out.json(), code: data.code as string };
}

describe("Functions", () => {
  it("envia PDF + anexos pequenos e link para a tomografia acima do limite", async () => {
    const r = await uploadAndSubmit(
      { foto: JPG, stl_superior: stl(100), tomografia: zip(3 * 1024 * 1024) },
      { foto: "Sorriso Paciente.JPG", stl_superior: "arcada sup.stl", tomografia: "dicom.zip" },
    );
    expect(r.status, JSON.stringify(r.body)).toBe(200);
    expect(emails).toHaveLength(2);
    const [quorum, confirm] = emails;
    expect(quorum.to).toEqual(["quorum@example.com"]);
    expect(quorum.subject).toBe("NOVA SOLICITAÇÃO QUORUM | Clínica Exemplo | Smile Design + Enceramento + PerioGuide");
    expect(quorum.headers["idempotency-key"]).toBe(`quorum-${r.code}`);
    const names = quorum.attachments!.map((a) => a.filename);
    expect(names[0]).toBe(`${r.code}_solicitacao.pdf`);
    expect(names).toContain(`${r.code}_foto_sorriso-paciente.jpg`);
    expect(names).toContain(`${r.code}_stl_superior_arcada-sup.stl`);
    expect(names.some((n) => n.endsWith(".zip"))).toBe(false);
    expect(quorum.text).toMatch(/Tomografia \(DICOM\) ✓ \(link\)/);
    expect(quorum.text).toMatch(/X-Amz-Expires=604800/);
    expect(quorum.text).toMatch(/Valor estimado:\na partir de R\$ 870/);
    expect(confirm.to).toEqual(["contato@exemplo.com.br"]);
    expect(confirm.subject).toBe("Solicitação recebida | Quorum Lab");
    expect(confirm.text).toContain(r.code);
    expect(confirm.attachments).toBeUndefined();
  });

  it("aceita validade curta de link para teste de expiração", async () => {
    process.env.FILE_RETENTION_DAYS = "0.01";
    const r = await uploadAndSubmit(
      { foto: JPG, stl_superior: stl(100), tomografia: zip(3 * 1024 * 1024) },
      { foto: "f.jpg", stl_superior: "s.stl", tomografia: "t.zip" },
    );
    delete process.env.FILE_RETENTION_DAYS;
    expect(r.status).toBe(200);
    expect(emails[0].text).toMatch(/X-Amz-Expires=864(&|$|\s)/);
  });

  it("rejeita arquivo cujo conteúdo não corresponde à extensão", async () => {
    const r = await uploadAndSubmit(
      { foto: zip(500), stl_superior: stl(10), tomografia: zip(500) },
      { foto: "foto.jpg", stl_superior: "a.stl", tomografia: "t.zip" },
    );
    expect(r.status).toBe(422);
    expect(emails).toHaveLength(0);
  });

  it("recusa ticket adulterado", async () => {
    const { default: submit } = await import("../netlify/functions/submit");
    const res = await submit(post("/api/submit", { ticket: "abc.def", solicitacao: solicitacaoExemplo }), ctx);
    expect(res.status).toBe(400);
  });

  it("bloqueia envio rápido demais (anti-spam)", async () => {
    const { default: uploadUrls } = await import("../netlify/functions/upload-urls");
    const res = await uploadUrls(post("/api/upload-urls", { startedAt: Date.now(), servico: "smile", files: [{ slot: "foto", name: "a.jpg", size: 10, type: "image/jpeg" }] }), ctx);
    expect(res.status).toBe(400);
  });

  it("exige documentação obrigatória do serviço", async () => {
    const { default: uploadUrls } = await import("../netlify/functions/upload-urls");
    const res = await uploadUrls(
      post("/api/upload-urls", { startedAt: Date.now() - 60_000, servico: "smile_enceramento", files: [{ slot: "foto", name: "a.jpg", size: 10, type: "image/jpeg" }] }),
      ctx,
    );
    expect(res.status).toBe(422);
    expect((await res.json()).details).toHaveProperty("stl_superior");
  });
});
