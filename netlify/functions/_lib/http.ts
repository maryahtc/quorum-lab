import { ConfigError } from "./env";

export const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" },
  });

export class HttpError extends Error {
  constructor(public status: number, message: string, public details?: unknown) {
    super(message);
  }
}

/** Converte erros em respostas sem vazar detalhes internos ou dados clínicos para o log. */
export function handleError(err: unknown, scope: string): Response {
  if (err instanceof HttpError) {
    return json({ error: err.message, details: err.details }, err.status);
  }
  if (err instanceof ConfigError) {
    console.error(`[${scope}] configuração:`, err.message);
    return json({ error: "Serviço temporariamente indisponível. Tente novamente em instantes." }, 503);
  }
  console.error(`[${scope}] erro inesperado:`, err instanceof Error ? err.message : "desconhecido");
  return json({ error: "Não foi possível concluir o envio. Tente novamente." }, 500);
}

export async function readJson(req: Request, maxBytes: number): Promise<unknown> {
  if (req.method !== "POST") throw new HttpError(405, "Método não permitido");
  const text = await req.text();
  if (text.length > maxBytes) throw new HttpError(413, "Requisição muito grande");
  try {
    return JSON.parse(text);
  } catch {
    throw new HttpError(400, "Requisição inválida");
  }
}

/** Bloqueia chamadas originadas de outros sites (CSRF / uso indevido da API). */
export function assertSameOrigin(req: Request): void {
  const origin = req.headers.get("origin");
  if (!origin) return;
  const host = req.headers.get("x-forwarded-host") ?? req.headers.get("host");
  try {
    if (new URL(origin).host !== host) throw new HttpError(403, "Origem não permitida");
  } catch (e) {
    if (e instanceof HttpError) throw e;
    throw new HttpError(403, "Origem não permitida");
  }
}
