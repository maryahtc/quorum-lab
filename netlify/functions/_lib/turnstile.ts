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
  const data = (await res.json()) as { success?: boolean };
  if (!data.success) throw new HttpError(400, "Verificação de segurança inválida. Atualize a página e tente novamente.");
}
