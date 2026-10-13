import { DOC_SLOTS, DOC_SLOT_ORDER, SERVICES } from "../../../src/shared/config";
import { elementos, formatBytes, formatTeeth } from "../../../src/shared/format";
import { brl, type Estimate } from "../../../src/shared/pricing";
import type { Solicitacao } from "../../../src/shared/schema";
import type { UploadedFileRef } from "./token";

export interface FileDelivery extends UploadedFileRef {
  mode: "anexo" | "link";
  url?: string;
}

type MailEnv = { apiKey: string; from: string; quorumInbox: string[]; replyTo?: string };

interface Attachment {
  filename: string;
  content: Uint8Array;
}

const GOLD = "#CDAA63";
const BLACK = "#0B0B0B";
const INK = "#ECE9E2";
const MUTED = "#8E8A82";

const esc = (s: string) =>
  s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

async function send(
  env: MailEnv,
  idempotencyKey: string,
  msg: { to: string[]; subject: string; html: string; text: string; replyTo?: string; attachments?: Attachment[] },
) {
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      authorization: `Bearer ${env.apiKey}`,
      "content-type": "application/json",
      "idempotency-key": idempotencyKey,
    },
    body: JSON.stringify({
      from: env.from,
      to: msg.to,
      subject: msg.subject,
      html: msg.html,
      text: msg.text,
      reply_to: msg.replyTo,
      attachments: msg.attachments?.map((a) => ({
        filename: a.filename,
        content: Buffer.from(a.content).toString("base64"),
      })),
    }),
  });
  if (res.ok) return;
  const data = (await res.json().catch(() => ({}))) as { name?: string; message?: string };
  // Mesma chave já usada: este e-mail já foi enviado numa tentativa anterior.
  if (res.status === 409 && data.name === "invalid_idempotent_request") return;
  throw new Error(`Resend ${res.status} ${data.name ?? ""} ${data.message ?? ""}`.trim());
}

const siteUrl = () => (process.env.URL ?? "").replace(/\/$/, "");

function layout(inner: string, preheader: string): string {
  const logo = siteUrl()
    ? `<img src="${siteUrl()}/brand/q-96.png" width="34" height="${Math.round((34 * 934) / 1305)}" alt="Quorum Lab" style="display:block;border:0;margin:0 auto;">`
    : `<span style="font-family:Georgia,serif;color:${GOLD};letter-spacing:6px;font-size:13px;">QUORUM LAB</span>`;
  return `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="color-scheme" content="dark"><meta name="supported-color-schemes" content="dark"></head>
<body style="margin:0;padding:0;background:${BLACK};" bgcolor="${BLACK}">
<div style="display:none;max-height:0;overflow:hidden;">${esc(preheader)}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" bgcolor="${BLACK}" style="background:${BLACK};">
<tr><td align="center" style="padding:48px 20px;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;">
<tr><td align="center" style="padding-bottom:40px;">${logo}</td></tr>
${inner}
<tr><td style="padding-top:48px;border-top:1px solid #3a3326;font-family:Helvetica,Arial,sans-serif;font-size:10px;letter-spacing:2px;color:${MUTED};">QUORUM LAB</td></tr>
</table></td></tr></table></body></html>`;
}

const h = (t: string) =>
  `<tr><td style="padding:28px 0 10px;font-family:Helvetica,Arial,sans-serif;font-size:10px;letter-spacing:2.5px;text-transform:uppercase;color:${GOLD};">${esc(t)}</td></tr>`;
const row = (label: string, value: string) =>
  `<tr><td style="padding:4px 0;font-family:Helvetica,Arial,sans-serif;font-size:14px;line-height:21px;color:${INK};"><span style="color:${MUTED};">${esc(label)}</span><br>${value}</td></tr>`;

export async function sendQuorumEmail(
  env: MailEnv,
  p: {
    code: string;
    createdAt: Date;
    solicitacao: Solicitacao;
    estimate: Estimate;
    deliveries: FileDelivery[];
    linkExpiresAt: Date;
    attachments: Attachment[];
  },
) {
  const s = p.solicitacao;
  const service = SERVICES[s.servico.tipo];
  const total = `${p.estimate.totalAPartirDe ? "a partir de " : ""}${brl(p.estimate.total)}`;
  const docs = DOC_SLOT_ORDER.filter((slot) => service.documentos[slot]).map((slot) => {
    const d = p.deliveries.find((x) => x.slot === slot);
    return { slot, titulo: DOC_SLOTS[slot].titulo, d };
  });
  const links = p.deliveries.filter((d) => d.mode === "link");
  const validade = p.linkExpiresAt.toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo", dateStyle: "short", timeStyle: "short" });

  const subject = `NOVA SOLICITAÇÃO QUORUM | ${s.clinica.nomeFantasia} | ${service.nome}`;

  const text = [
    "Nova solicitação recebida.",
    "",
    `Código: ${p.code}`,
    "",
    "Clínica:",
    s.clinica.nomeFantasia,
    "",
    "Solicitante:",
    s.clinica.solicitante,
    "",
    "Paciente:",
    s.paciente.identificacao,
    "",
    "Serviço:",
    service.nome,
    `Smile Design: ${formatTeeth(s.servico.dentesSmile)}`,
    ...(service.enceramento ? [`Enceramento: ${formatTeeth(s.servico.dentesEnceramento)}`] : []),
    "",
    "Valor estimado:",
    total,
    "",
    "Documentação:",
    ...docs.map(({ titulo, d }) => `${titulo} ${d ? (d.mode === "anexo" ? "✓ (anexo)" : "✓ (link)") : "—"}`),
    ...(links.length
      ? ["", `Arquivos por link (válidos até ${validade}; excluídos automaticamente após o prazo):`, ...links.map((l) => `${DOC_SLOTS[l.slot].titulo} (${formatBytes(l.size)}): ${l.url}`)]
      : []),
    "",
    "PDF completo da solicitação em anexo.",
  ].join("\n");

  const docsHtml = docs
    .map(({ titulo, d }) => {
      const status = !d ? "—" : d.mode === "anexo" ? `✓ <span style="color:${MUTED};">anexo · ${formatBytes(d.size)}</span>` : `✓ <span style="color:${MUTED};">link · ${formatBytes(d.size)}</span>`;
      return row(titulo, status);
    })
    .join("");
  const linksHtml = links.length
    ? h("Download dos arquivos") +
      links
        .map((l) => row(DOC_SLOTS[l.slot].titulo, `<a href="${esc(l.url!)}" style="color:${GOLD};">Baixar arquivo</a> <span style="color:${MUTED};">· ${formatBytes(l.size)}</span>`))
        .join("") +
      `<tr><td style="padding:10px 0 0;font-family:Helvetica,Arial,sans-serif;font-size:12px;line-height:18px;color:${MUTED};">Links privados, válidos até ${esc(validade)}. Após esse prazo os arquivos são excluídos automaticamente. Baixe e registre no ADAX LAB antes do vencimento. Não encaminhe este e-mail.</td></tr>`
    : "";

  const html = layout(
    `<tr><td style="font-family:Georgia,'Times New Roman',serif;font-size:24px;letter-spacing:4px;color:${INK};font-weight:300;">NOVA SOLICITAÇÃO</td></tr>
<tr><td style="padding-top:8px;font-family:Helvetica,Arial,sans-serif;font-size:12px;letter-spacing:2px;color:${GOLD};">${esc(p.code)}</td></tr>
${h("Clínica")}${row("Nome", esc(s.clinica.nomeFantasia))}${row("Solicitante", esc(s.clinica.solicitante))}
${h("Paciente")}${row("Identificação", esc(s.paciente.identificacao))}
${h("Serviço")}${row("Tipo", esc(service.nome))}${row(`Smile Design · ${elementos(s.servico.dentesSmile.length)}`, formatTeeth(s.servico.dentesSmile))}${
      service.enceramento ? row(`Enceramento · ${elementos(s.servico.dentesEnceramento.length)}`, formatTeeth(s.servico.dentesEnceramento)) : ""
    }
${h("Valor estimado")}${p.estimate.linhas.map((l) => row(l.rotulo, `${l.detalhe && !l.aPartirDe ? esc(l.detalhe) + " = " : l.aPartirDe ? "a partir de " : ""}${brl(l.valor)}`)).join("")}
<tr><td style="padding:8px 0;font-family:Georgia,serif;font-size:22px;color:${GOLD};">${esc(total)}</td></tr>
${h("Documentação")}${docsHtml}${linksHtml}
<tr><td style="padding-top:28px;font-family:Helvetica,Arial,sans-serif;font-size:13px;color:${MUTED};">PDF completo da solicitação em anexo.</td></tr>`,
    `${s.clinica.nomeFantasia} · ${service.nome}`,
  );

  await send(env, `quorum-${p.code}`, {
    to: env.quorumInbox,
    subject,
    html,
    text,
    replyTo: s.clinica.email,
    attachments: p.attachments,
  });
}

export async function sendConfirmationEmail(env: MailEnv, p: { code: string; solicitacao: Solicitacao }) {
  const text = [
    "Recebemos sua solicitação de planejamento.",
    "",
    "Nossa equipe irá conferir a documentação e confirmar o aceite, prazo e valor do trabalho em até 24 horas.",
    "",
    "Solicitação:",
    p.code,
    "",
    "Quorum Lab",
  ].join("\n");
  const html = layout(
    `<tr><td style="font-family:Georgia,'Times New Roman',serif;font-size:24px;letter-spacing:4px;color:${INK};font-weight:300;text-align:center;">SOLICITAÇÃO RECEBIDA</td></tr>
<tr><td style="padding:32px 0 0;font-family:Helvetica,Arial,sans-serif;font-size:15px;line-height:24px;color:${INK};">Recebemos sua solicitação de planejamento.</td></tr>
<tr><td style="padding:16px 0 0;font-family:Helvetica,Arial,sans-serif;font-size:15px;line-height:24px;color:${INK};">Nossa equipe irá conferir a documentação e confirmar o aceite, prazo e valor do trabalho em até 24 horas.</td></tr>
${h("Solicitação")}
<tr><td style="font-family:Helvetica,Arial,sans-serif;font-size:16px;letter-spacing:2px;color:${GOLD};">${esc(p.code)}</td></tr>
<tr><td style="padding-top:40px;font-family:Georgia,serif;font-size:16px;letter-spacing:3px;color:${INK};">Quorum Lab</td></tr>`,
    "Recebemos sua solicitação de planejamento.",
  );
  await send(env, `confirmacao-${p.code}`, {
    to: [p.solicitacao.clinica.email],
    subject: "Solicitação recebida | Quorum Lab",
    html,
    text,
    replyTo: env.replyTo,
  });
}
