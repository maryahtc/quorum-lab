import { turnstileSecret } from "./env";
import { HttpError } from "./http";

export async function verifyTurnstile(token: unknown, ip?: string): Promise<void> {
  const secret = turnstileSecret();
  if (!secret) {
    console.warn("[turnstile] TURNSTILE_SECRET_KEY não configurada — verificação anti-spam desativada");
    return;
  }
  if (typeof token !== "string" || !token) throw new HttpError(400, "Confirme a verificação de segurança.");
  const body = new URLSearchParams({ secret, response: token });
  if (ip) body.set("remoteip", ip);
  const res = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", { method: "POST", body });
  const data = (await res.json()) as { success?: boolean; "error-codes"?: string[] };
  if (!data.success) {
    // Códigos da Cloudflare (ex.: timeout-or-duplicate, invalid-input-response) ajudam no diagnóstico.
    console.warn("[turnstile] verificação recusada:", (data["error-codes"] ?? []).join(", ") || "sem código");
    throw new HttpError(400, "Verificação de segurança inválida. Tente enviar novamente.");
  }
}
