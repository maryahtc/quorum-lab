import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import type { DocSlot } from "../../../src/shared/config";
import { signingSecret } from "./env";
import { HttpError } from "./http";

export interface UploadedFileRef {
  slot: DocSlot;
  key: string;
  /** Nome sanitizado, usado no anexo e no link. */
  name: string;
  size: number;
  ext: string;
  contentType: string;
}

export interface UploadTicket {
  code: string;
  iat: number;
  exp: number;
  files: UploadedFileRef[];
}

/** Validade do ticket: tempo para enviar arquivos grandes e concluir a solicitação. */
export const TICKET_TTL_SECONDS = 3 * 60 * 60;

const b64url = (buf: Buffer) => buf.toString("base64url");

export function signTicket(ticket: UploadTicket): string {
  const payload = b64url(Buffer.from(JSON.stringify(ticket)));
  const sig = b64url(createHmac("sha256", signingSecret()).update(payload).digest());
  return `${payload}.${sig}`;
}

export function verifyTicket(token: unknown): UploadTicket {
  if (typeof token !== "string" || !token.includes(".")) throw new HttpError(400, "Envio inválido");
  const [payload, sig] = token.split(".");
  const expected = createHmac("sha256", signingSecret()).update(payload).digest();
  const given = Buffer.from(sig, "base64url");
  if (given.length !== expected.length || !timingSafeEqual(given, expected)) {
    throw new HttpError(400, "Envio inválido");
  }
  const ticket = JSON.parse(Buffer.from(payload, "base64url").toString()) as UploadTicket;
  if (Date.now() / 1000 > ticket.exp) {
    throw new HttpError(410, "O tempo para concluir o envio expirou. Inicie o envio novamente.");
  }
  return ticket;
}

const ALPHABET = "23456789ABCDEFGHJKLMNPQRSTUVWXYZ";

/** Código legível da solicitação: QL-AAMMDD-XXXXX (data de Brasília). */
export function newRequestCode(now = new Date()): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
    year: "2-digit",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "00";
  const rand = Array.from(randomBytes(5), (b) => ALPHABET[b % ALPHABET.length]).join("");
  return `QL-${get("year")}${get("month")}${get("day")}-${rand}`;
}

/** Prefixo privado e imprevisível do armazenamento temporário. */
export const storagePrefix = (code: string) => `tmp/${code}-${randomBytes(12).toString("hex")}`;
