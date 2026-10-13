import type { Config, Context } from "@netlify/functions";
import { z } from "zod";
import { DOC_SLOTS, SERVICES } from "../../src/shared/config";
import { HEADER_BYTES, matchesSignature } from "../../src/shared/files";
import { estimate } from "../../src/shared/pricing";
import { normalizeSolicitacao, solicitacaoSchema } from "../../src/shared/schema";
import { attachmentMaxBytes, linkExpirySeconds, mailEnv } from "./_lib/env";
import { HttpError, assertSameOrigin, handleError, json, readJson } from "./_lib/http";
import { sendConfirmationEmail, sendQuorumEmail, type FileDelivery } from "./_lib/email";
import { buildPdf } from "./_lib/pdf";
import { deleteObject, headObject, presignGet, readObject, readRange } from "./_lib/storage";
import { verifyTicket } from "./_lib/token";

/**
 * 2ª etapa do envio: confere os arquivos já enviados ao armazenamento,
 * gera o PDF-resumo e envia os e-mails (Quorum + confirmação ao dentista).
 * Pode ser repetida com o mesmo ticket em caso de falha: o Resend usa o
 * código da solicitação como chave de idempotência.
 */

const bodySchema = z.object({
  ticket: z.string().min(10).max(8000),
  solicitacao: z.unknown(),
  /** Miniatura JPEG da foto gerada no navegador (opcional, só para o PDF). */
  thumbnail: z.string().max(600_000).optional(),
});

export default async (req: Request, _context: Context) => {
  try {
    assertSameOrigin(req);
    const body = bodySchema.safeParse(await readJson(req, 1024 * 1024));
    if (!body.success) throw new HttpError(400, "Requisição inválida");
    const ticket = verifyTicket(body.data.ticket);

    const parsed = solicitacaoSchema.safeParse(body.data.solicitacao);
    if (!parsed.success) {
      throw new HttpError(422, "Revise os dados do formulário", parsed.error.issues.map((i) => i.path.join(".")));
    }
    const solicitacao = normalizeSolicitacao(parsed.data);
    const service = SERVICES[solicitacao.servico.tipo];

    // Documentos do ticket precisam corresponder ao serviço escolhido.
    const slots = new Set(ticket.files.map((f) => f.slot));
    for (const [slot, rule] of Object.entries(service.documentos)) {
      if (rule === "obrigatorio" && !slots.has(slot as never)) throw new HttpError(422, "Documentação incompleta");
    }
    if (ticket.files.some((f) => !service.documentos[f.slot])) throw new HttpError(422, "Documentação incompatível com o serviço");

    // Confere existência, tamanho e assinatura real de cada arquivo.
    for (const f of ticket.files) {
      const head = await headObject(f.key);
      if (!head) throw new HttpError(422, `O arquivo "${DOC_SLOTS[f.slot].titulo}" não foi recebido. Tente novamente.`);
      if (head.size !== f.size) {
        await deleteObject(f.key);
        throw new HttpError(422, `O arquivo "${DOC_SLOTS[f.slot].titulo}" chegou incompleto. Tente novamente.`);
      }
      const bytes = await readRange(f.key, Math.min(HEADER_BYTES, f.size));
      if (!matchesSignature(DOC_SLOTS[f.slot].kind, bytes, f.size)) {
        await deleteObject(f.key);
        throw new HttpError(422, `O arquivo "${DOC_SLOTS[f.slot].titulo}" não corresponde ao formato esperado.`);
      }
    }

    const createdAt = new Date(ticket.iat * 1000);
    const est = estimate(solicitacao.servico.tipo, solicitacao.servico.dentesEnceramento);
    const thumbnail = decodeThumbnail(body.data.thumbnail);

    // Decide o que vai anexado e o que vai por link (prioridade definida em config).
    const pdfPreview = await buildPdf({ code: ticket.code, createdAt, solicitacao, estimate: est, files: [], thumbnail });
    const budget = attachmentMaxBytes() - pdfPreview.length;
    let used = 0;
    const expires = linkExpirySeconds();
    const deliveries: FileDelivery[] = [];
    for (const f of [...ticket.files].sort((a, b) => DOC_SLOTS[a.slot].prioridadeAnexo - DOC_SLOTS[b.slot].prioridadeAnexo)) {
      const attach = used + f.size <= budget;
      if (attach) used += f.size;
      deliveries.push({
        ...f,
        mode: attach ? "anexo" : "link",
        url: attach ? undefined : await presignGet(f.key, f.name, expires),
      });
    }
    const linkExpiresAt = new Date(Date.now() + expires * 1000);

    const pdf = await buildPdf({ code: ticket.code, createdAt, solicitacao, estimate: est, files: deliveries, thumbnail });
    const attachments = [{ filename: `${ticket.code}_solicitacao.pdf`, content: pdf }];
    for (const d of deliveries) {
      if (d.mode === "anexo") attachments.push({ filename: d.name, content: await readObject(d.key) });
    }

    const env = mailEnv();
    await sendQuorumEmail(env, {
      code: ticket.code,
      createdAt,
      solicitacao,
      estimate: est,
      deliveries,
      linkExpiresAt,
      attachments,
    });

    // A confirmação ao dentista não deve invalidar um envio já entregue ao Quorum.
    let confirmacaoEnviada = true;
    try {
      await sendConfirmationEmail(env, { code: ticket.code, solicitacao });
    } catch (e) {
      confirmacaoEnviada = false;
      console.error("[submit] falha na confirmação ao solicitante:", ticket.code, e instanceof Error ? e.message : "");
    }

    return json({ ok: true, code: ticket.code, confirmacaoEnviada });
  } catch (err) {
    return handleError(err, "submit");
  }
};

function decodeThumbnail(data?: string): Uint8Array | undefined {
  if (!data) return undefined;
  const m = /^data:image\/jpeg;base64,([A-Za-z0-9+/=]+)$/.exec(data);
  if (!m) return undefined;
  const bytes = new Uint8Array(Buffer.from(m[1], "base64"));
  return bytes[0] === 0xff && bytes[1] === 0xd8 ? bytes : undefined;
}

export const config: Config = {
  path: "/api/submit",
  method: "POST",
  rateLimit: { windowLimit: 6, windowSize: 60, aggregateBy: ["ip", "domain"] },
};
