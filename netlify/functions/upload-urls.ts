import type { Config, Context } from "@netlify/functions";
import { z } from "zod";
import { ACCEPTED_BROWSER_MIME, CONTENT_TYPES, DOC_SLOTS, SERVICES, type DocSlot } from "../../src/shared/config";
import { extensionOf, sanitizeFileName, validateFileMeta } from "../../src/shared/files";
import { HttpError, assertSameOrigin, handleError, json, readJson } from "./_lib/http";
import { presignPut } from "./_lib/storage";
import { TICKET_TTL_SECONDS, newRequestCode, signTicket, storagePrefix, type UploadedFileRef } from "./_lib/token";
import { verifyTurnstile } from "./_lib/turnstile";

/**
 * 1ª etapa do envio: valida os metadados dos arquivos e devolve URLs
 * assinadas (15 min) para upload direto ao armazenamento privado.
 * Os arquivos nunca passam pela função (limite de 6 MB do Netlify).
 */

const MIN_FILL_SECONDS = 20;
const UPLOAD_URL_TTL = 15 * 60;

const bodySchema = z.object({
  turnstileToken: z.string().optional(),
  website: z.string().optional(), // honeypot: deve chegar vazio
  startedAt: z.number(),
  servico: z.enum(["smile", "smile_enceramento", "smile_enceramento_perioguide"]),
  files: z
    .array(
      z.object({
        slot: z.enum(["foto", "stl_superior", "stl_inferior", "tomografia"]),
        name: z.string().min(1).max(255),
        size: z.number().int().positive(),
        type: z.string().max(100),
      }),
    )
    .min(1)
    .max(4),
});

export default async (req: Request, context: Context) => {
  try {
    assertSameOrigin(req);
    const parsed = bodySchema.safeParse(await readJson(req, 16 * 1024));
    if (!parsed.success) throw new HttpError(400, "Requisição inválida");
    const body = parsed.data;

    // Anti-spam silencioso: robôs recebem uma resposta genérica.
    if (body.website || Date.now() - body.startedAt < MIN_FILL_SECONDS * 1000) {
      throw new HttpError(400, "Não foi possível validar o envio. Revise o formulário e tente novamente.");
    }
    await verifyTurnstile(body.turnstileToken, context.ip);

    const service = SERVICES[body.servico];
    const seen = new Set<DocSlot>();
    const errors: Record<string, string> = {};
    for (const f of body.files) {
      if (seen.has(f.slot)) throw new HttpError(400, "Arquivo duplicado");
      seen.add(f.slot);
      if (!service.documentos[f.slot]) {
        errors[f.slot] = "Documento não previsto para este serviço";
        continue;
      }
      const metaError = validateFileMeta(f.slot, f.name, f.size);
      if (metaError) errors[f.slot] = metaError;
      const accepted = ACCEPTED_BROWSER_MIME[DOC_SLOTS[f.slot].kind];
      if (f.type && !accepted.includes(f.type.toLowerCase())) errors[f.slot] = "Tipo de arquivo não aceito";
    }
    for (const [slot, rule] of Object.entries(service.documentos)) {
      if (rule === "obrigatorio" && !seen.has(slot as DocSlot)) errors[slot] = "Documento obrigatório";
    }
    if (Object.keys(errors).length) throw new HttpError(422, "Documentação inválida", errors);

    const code = newRequestCode();
    const prefix = storagePrefix(code);
    const refs: UploadedFileRef[] = body.files.map((f) => {
      const ext = extensionOf(f.name);
      const name = `${code}_${f.slot}_${sanitizeFileName(f.name)}`;
      return { slot: f.slot, key: `${prefix}/${name}`, name, size: f.size, ext, contentType: CONTENT_TYPES[ext] };
    });

    const now = Math.floor(Date.now() / 1000);
    const ticket = signTicket({ code, iat: now, exp: now + TICKET_TTL_SECONDS, files: refs });
    const uploads = await Promise.all(
      refs.map(async (r) => ({ slot: r.slot, url: await presignPut(r.key, UPLOAD_URL_TTL), contentType: r.contentType })),
    );
    return json({ code, ticket, uploads });
  } catch (err) {
    return handleError(err, "upload-urls");
  }
};

export const config: Config = {
  path: "/api/upload-urls",
  method: "POST",
  rateLimit: { windowLimit: 6, windowSize: 60, aggregateBy: ["ip", "domain"] },
};
