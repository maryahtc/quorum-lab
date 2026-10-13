/** Leitura centralizada das variáveis de ambiente (ver README e .env.example). */

function required(name: string): string {
  const v = process.env[name]?.trim();
  if (!v) throw new ConfigError(`Variável de ambiente ausente: ${name}`);
  return v;
}

function number(name: string, fallback: number): number {
  const raw = process.env[name]?.trim();
  if (!raw) return fallback;
  const n = Number(raw);
  if (!Number.isFinite(n) || n <= 0) throw new ConfigError(`Valor inválido em ${name}: ${raw}`);
  return n;
}

export class ConfigError extends Error {}

export interface StorageEnv {
  accountId: string;
  accessKeyId: string;
  secretAccessKey: string;
  bucket: string;
}

export const storageEnv = (): StorageEnv => ({
  accountId: required("R2_ACCOUNT_ID"),
  accessKeyId: required("R2_ACCESS_KEY_ID"),
  secretAccessKey: required("R2_SECRET_ACCESS_KEY"),
  bucket: required("R2_BUCKET"),
});

export const mailEnv = () => ({
  apiKey: required("RESEND_API_KEY"),
  from: required("MAIL_FROM"),
  quorumInbox: required("QUORUM_INBOX_EMAIL")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean),
  replyTo: process.env.QUORUM_REPLY_TO?.trim() || undefined,
});

export const signingSecret = () => {
  const s = required("UPLOAD_SIGNING_SECRET");
  if (s.length < 32) throw new ConfigError("UPLOAD_SIGNING_SECRET deve ter ao menos 32 caracteres");
  return s;
};

/** Limite do conjunto de anexos do e-mail, em bytes (antes do base64). */
export const attachmentMaxBytes = () => number("ATTACHMENT_MAX_MB", 15) * 1024 * 1024;

/** Validade dos links de download. Limitada a 7 dias (máximo de URL assinada no S3/R2). */
export const retentionDays = () => Math.min(number("FILE_RETENTION_DAYS", 7), 7);

/** Turnstile é opcional em desenvolvimento; em produção configure TURNSTILE_SECRET_KEY. */
export const turnstileSecret = () => process.env.TURNSTILE_SECRET_KEY?.trim() || undefined;
