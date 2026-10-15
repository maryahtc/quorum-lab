import type { DocSlot } from "../../shared/config";
import { toPayload, type FormState } from "./state";
import { thumbnailFrom } from "./fileClient";

export class SubmitError extends Error {
  constructor(message: string, public retryable = true) {
    super(message);
  }
}

interface UploadInfo {
  code: string;
  ticket: string;
  uploads: { slot: DocSlot; url: string; contentType: string }[];
}

export interface SubmitSession {
  info?: UploadInfo;
  uploaded: Set<DocSlot>;
}

export type Stage = "preparando" | "enviando" | "finalizando";

async function postJson<T>(url: string, body: unknown): Promise<T> {
  let res: Response;
  try {
    res = await fetch(url, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
  } catch {
    throw new SubmitError("Sem conexão. Verifique a internet e tente novamente.");
  }
  if (res.status === 429) throw new SubmitError("Muitas tentativas em sequência. Aguarde um minuto e tente novamente.");
  const data = (await res.json().catch(() => ({}))) as { error?: string };
  if (!res.ok) throw new SubmitError(data.error ?? "Não foi possível concluir o envio.", res.status >= 500 || res.status === 410);
  return data as T;
}

function put(url: string, file: File, contentType: string, onProgress: (loaded: number) => void): Promise<void> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("PUT", url);
    xhr.setRequestHeader("content-type", contentType);
    xhr.upload.onprogress = (e) => onProgress(e.loaded);
    xhr.onload = () => (xhr.status >= 200 && xhr.status < 300 ? resolve() : reject(new SubmitError("Falha no envio de um arquivo. Tente novamente.")));
    xhr.onerror = () => reject(new SubmitError("A conexão caiu durante o envio dos arquivos. Tente novamente."));
    xhr.send(file);
  });
}

/**
 * Fluxo completo de envio. Pode ser chamado novamente com a mesma sessão
 * após uma falha: retoma do ponto em que parou, sem reenviar arquivos já recebidos.
 */
export async function submitRequest(
  state: FormState,
  session: SubmitSession,
  ctx: { startedAt: number; getTurnstileToken: () => Promise<string | undefined>; onStage: (s: Stage) => void; onProgress: (ratio: number) => void },
): Promise<{ code: string; confirmacaoEnviada: boolean }> {
  const files = Object.entries(state.arquivos) as [DocSlot, { file: File; previewUrl?: string }][];

  if (!session.info) {
    ctx.onStage("preparando");
    // Token novo a cada pedido de upload: tokens do Turnstile são de uso único.
    let turnstileToken: string | undefined;
    try {
      turnstileToken = await ctx.getTurnstileToken();
    } catch (e) {
      throw new SubmitError(e instanceof Error ? e.message : "Falha na verificação de segurança. Tente novamente.");
    }
    session.info = await postJson<UploadInfo>("/api/upload-urls", {
      turnstileToken,
      website: state.website,
      startedAt: ctx.startedAt,
      servico: state.servico.tipo,
      files: files.map(([slot, f]) => ({ slot, name: f.file.name, size: f.file.size, type: f.file.type })),
    });
    session.uploaded = new Set();
  }

  ctx.onStage("enviando");
  const total = files.reduce((a, [, f]) => a + f.file.size, 0);
  let done = files.filter(([slot]) => session.uploaded.has(slot)).reduce((a, [, f]) => a + f.file.size, 0);
  ctx.onProgress(done / total);
  for (const [slot, f] of files) {
    if (session.uploaded.has(slot)) continue;
    const target = session.info.uploads.find((u) => u.slot === slot);
    if (!target) throw new SubmitError("Sessão de envio inválida. Tente novamente.");
    try {
      await put(target.url, f.file, target.contentType, (loaded) => ctx.onProgress((done + loaded) / total));
    } catch (e) {
      // URLs de upload expiram em 15 min: na próxima tentativa, gera novas.
      session.info = undefined;
      throw e;
    }
    session.uploaded.add(slot);
    done += f.file.size;
    ctx.onProgress(done / total);
  }

  ctx.onStage("finalizando");
  const thumbnail = await thumbnailFrom(state.arquivos.foto?.previewUrl);
  try {
    return await postJson("/api/submit", { ticket: session.info.ticket, solicitacao: toPayload(state), thumbnail });
  } catch (e) {
    if (e instanceof SubmitError && /expirou/.test(e.message)) session.info = undefined;
    throw e;
  }
}
