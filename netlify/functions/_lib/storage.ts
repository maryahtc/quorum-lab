import { AwsClient } from "aws4fetch";
import { storageEnv } from "./env";

/**
 * Armazenamento temporário em Cloudflare R2 (API compatível com S3).
 * O bucket é privado: só há acesso por URLs assinadas e de curta duração.
 * A exclusão automática é feita pela regra de ciclo de vida do bucket (ver README).
 */
function client() {
  const env = storageEnv();
  const aws = new AwsClient({
    accessKeyId: env.accessKeyId,
    secretAccessKey: env.secretAccessKey,
    service: "s3",
    region: "auto",
  });
  const urlFor = (key: string) =>
    new URL(`https://${env.accountId}.r2.cloudflarestorage.com/${env.bucket}/${key.split("/").map(encodeURIComponent).join("/")}`);
  return { aws, urlFor };
}

export async function presignPut(key: string, expiresSeconds: number): Promise<string> {
  const { aws, urlFor } = client();
  const url = urlFor(key);
  url.searchParams.set("X-Amz-Expires", String(expiresSeconds));
  const signed = await aws.sign(new Request(url, { method: "PUT" }), { aws: { signQuery: true } });
  return signed.url;
}

export async function presignGet(key: string, downloadName: string, expiresSeconds: number): Promise<string> {
  const { aws, urlFor } = client();
  const url = urlFor(key);
  url.searchParams.set("X-Amz-Expires", String(expiresSeconds));
  url.searchParams.set("response-content-disposition", `attachment; filename="${downloadName}"`);
  const signed = await aws.sign(new Request(url, { method: "GET" }), { aws: { signQuery: true } });
  return signed.url;
}

export async function headObject(key: string): Promise<{ size: number } | null> {
  const { aws, urlFor } = client();
  const res = await aws.fetch(urlFor(key), { method: "HEAD" });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`HEAD ${res.status}`);
  return { size: Number(res.headers.get("content-length") ?? 0) };
}

export async function readRange(key: string, bytes: number): Promise<Uint8Array> {
  const { aws, urlFor } = client();
  const res = await aws.fetch(urlFor(key), { headers: { range: `bytes=0-${bytes - 1}` } });
  if (!res.ok) throw new Error(`GET range ${res.status}`);
  return new Uint8Array(await res.arrayBuffer());
}

export async function readObject(key: string): Promise<Buffer> {
  const { aws, urlFor } = client();
  const res = await aws.fetch(urlFor(key));
  if (!res.ok) throw new Error(`GET ${res.status}`);
  return Buffer.from(await res.arrayBuffer());
}

export async function deleteObject(key: string): Promise<void> {
  const { aws, urlFor } = client();
  await aws.fetch(urlFor(key), { method: "DELETE" });
}
