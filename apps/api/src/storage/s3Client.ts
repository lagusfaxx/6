import https from "node:https";
import fs from "node:fs";
import { createHash, createHmac } from "node:crypto";
import type { IncomingMessage } from "node:http";

/**
 * Cliente S3 mínimo (firma AWS SigV4 a mano, sin SDK).
 *
 * Se hizo así para no agregar dependencias: el build de Docker usa
 * `--frozen-lockfile` y el SDK de AWS trae decenas de paquetes. Sólo cubre lo
 * que la API necesita: subir un archivo, leerlo (con Range) y listar un prefijo.
 */

export type S3Config = {
  bucket: string;
  region: string;
  accessKeyId: string;
  secretAccessKey: string;
  sessionToken?: string;
};

export function readS3ConfigFromEnv(): S3Config | null {
  const bucket = (process.env.S3_BUCKET || "").trim();
  const region = (process.env.AWS_REGION || process.env.AWS_DEFAULT_REGION || "").trim();
  const accessKeyId = (process.env.AWS_ACCESS_KEY_ID || "").trim();
  const secretAccessKey = (process.env.AWS_SECRET_ACCESS_KEY || "").trim();
  if (!bucket || !region || !accessKeyId || !secretAccessKey) return null;
  const sessionToken = (process.env.AWS_SESSION_TOKEN || "").trim() || undefined;
  return { bucket, region, accessKeyId, secretAccessKey, sessionToken };
}

// ── SigV4 ──────────────────────────────────────────────────────────────────

const EMPTY_SHA256 = "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855";
export const UNSIGNED_PAYLOAD = "UNSIGNED-PAYLOAD";

function sha256Hex(data: string | Buffer): string {
  return createHash("sha256").update(data).digest("hex");
}

function hmac(key: string | Buffer, data: string): Buffer {
  return createHmac("sha256", key).update(data, "utf8").digest();
}

/** URI-encode según AWS: todo menos A-Z a-z 0-9 - . _ ~ */
function awsEncode(value: string): string {
  return encodeURIComponent(value).replace(/[!'()*]/g, (c) => "%" + c.charCodeAt(0).toString(16).toUpperCase());
}

function encodeKeyPath(key: string): string {
  return "/" + key.split("/").map(awsEncode).join("/");
}

export type SignInput = {
  method: string;
  host: string;
  /** Path ya codificado (ej. "/uploads/a.jpg"). */
  path: string;
  query?: Record<string, string>;
  /** Headers extra a firmar (nombres en minúscula). */
  headers?: Record<string, string>;
  payloadHash: string;
  region: string;
  accessKeyId: string;
  secretAccessKey: string;
  sessionToken?: string;
  date?: Date;
};

export function signRequest(input: SignInput): { headers: Record<string, string>; canonicalQuery: string } {
  const date = input.date ?? new Date();
  const amzDate = date.toISOString().replace(/[:-]|\.\d{3}/g, ""); // 20130524T000000Z
  const dateStamp = amzDate.slice(0, 8);

  const headers: Record<string, string> = {
    host: input.host,
    "x-amz-content-sha256": input.payloadHash,
    "x-amz-date": amzDate,
    ...(input.sessionToken ? { "x-amz-security-token": input.sessionToken } : {}),
  };
  for (const [k, v] of Object.entries(input.headers ?? {})) headers[k.toLowerCase()] = v;

  const names = Object.keys(headers).sort();
  const canonicalHeaders = names.map((n) => `${n}:${String(headers[n]).trim().replace(/\s+/g, " ")}\n`).join("");
  const signedHeaders = names.join(";");

  const canonicalQuery = Object.entries(input.query ?? {})
    .map(([k, v]) => [awsEncode(k), awsEncode(v)] as const)
    .sort((a, b) => (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : a[1] < b[1] ? -1 : a[1] > b[1] ? 1 : 0))
    .map(([k, v]) => `${k}=${v}`)
    .join("&");

  const canonicalRequest = [
    input.method,
    input.path,
    canonicalQuery,
    canonicalHeaders,
    signedHeaders,
    input.payloadHash,
  ].join("\n");

  const scope = `${dateStamp}/${input.region}/s3/aws4_request`;
  const stringToSign = ["AWS4-HMAC-SHA256", amzDate, scope, sha256Hex(canonicalRequest)].join("\n");

  const kDate = hmac("AWS4" + input.secretAccessKey, dateStamp);
  const kRegion = hmac(kDate, input.region);
  const kService = hmac(kRegion, "s3");
  const kSigning = hmac(kService, "aws4_request");
  const signature = createHmac("sha256", kSigning).update(stringToSign, "utf8").digest("hex");

  headers.authorization =
    `AWS4-HMAC-SHA256 Credential=${input.accessKeyId}/${scope}, SignedHeaders=${signedHeaders}, Signature=${signature}`;
  return { headers, canonicalQuery };
}

// ── HTTP ───────────────────────────────────────────────────────────────────

const agent = new https.Agent({ keepAlive: true, maxSockets: 16 });

export class S3Error extends Error {
  constructor(
    message: string,
    public status: number,
    public code: string,
    public bucketRegion?: string,
  ) {
    super(message);
    this.name = "S3Error";
  }
}

function hostFor(cfg: S3Config): string {
  return `${cfg.bucket}.s3.${cfg.region}.amazonaws.com`;
}

type RawRequest = {
  method: "GET" | "PUT" | "HEAD";
  key: string; // "" = raíz del bucket
  query?: Record<string, string>;
  headers?: Record<string, string>;
  payloadHash?: string;
  body?: NodeJS.ReadableStream | Buffer;
  timeoutMs?: number;
};

function rawRequest(cfg: S3Config, r: RawRequest): Promise<IncomingMessage> {
  const host = hostFor(cfg);
  const path = r.key ? encodeKeyPath(r.key) : "/";
  const { headers, canonicalQuery } = signRequest({
    method: r.method,
    host,
    path,
    query: r.query,
    headers: r.headers,
    payloadHash: r.payloadHash ?? EMPTY_SHA256,
    region: cfg.region,
    accessKeyId: cfg.accessKeyId,
    secretAccessKey: cfg.secretAccessKey,
    sessionToken: cfg.sessionToken,
  });

  return new Promise((resolve, reject) => {
    const req = https.request(
      { host, path: canonicalQuery ? `${path}?${canonicalQuery}` : path, method: r.method, headers, agent },
      resolve,
    );
    req.setTimeout(r.timeoutMs ?? 60_000, () => req.destroy(new Error("S3_TIMEOUT")));
    req.on("error", reject);
    if (!r.body) {
      req.end();
    } else if (Buffer.isBuffer(r.body)) {
      req.end(r.body);
    } else {
      r.body.on("error", (err) => req.destroy(err as Error));
      r.body.pipe(req);
    }
  });
}

async function readBody(res: IncomingMessage, limit = 16 * 1024 * 1024): Promise<string> {
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const chunk of res) {
    const b = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    size += b.length;
    if (size > limit) throw new Error("S3_RESPONSE_TOO_LARGE");
    chunks.push(b);
  }
  return Buffer.concat(chunks).toString("utf8");
}

function xmlDecode(s: string): string {
  return s
    .replace(/&#x([0-9a-fA-F]+);/g, (_, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(parseInt(d, 10)))
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, "&");
}

function xmlTag(xml: string, tag: string): string | undefined {
  const m = new RegExp(`<${tag}>([\\s\\S]*?)</${tag}>`).exec(xml);
  return m ? xmlDecode(m[1]) : undefined;
}

async function toS3Error(res: IncomingMessage): Promise<S3Error> {
  const body = await readBody(res).catch(() => "");
  const code = xmlTag(body, "Code") || `HTTP_${res.statusCode}`;
  const message = xmlTag(body, "Message") || code;
  const bucketRegion = (res.headers["x-amz-bucket-region"] as string | undefined) || xmlTag(body, "Region");
  let hint = "";
  if (code === "PermanentRedirect" || code === "AuthorizationHeaderMalformed" || res.statusCode === 301) {
    hint = bucketRegion ? ` (el bucket está en ${bucketRegion}: revisa AWS_REGION)` : " (revisa AWS_REGION)";
  } else if (code === "AccessDenied") {
    hint = " (revisa la política IAM: el nombre del bucket debe coincidir con S3_BUCKET)";
  } else if (code === "SignatureDoesNotMatch") {
    hint = " (revisa AWS_SECRET_ACCESS_KEY)";
  } else if (code === "InvalidAccessKeyId") {
    hint = " (revisa AWS_ACCESS_KEY_ID)";
  } else if (code === "NoSuchBucket") {
    hint = " (revisa S3_BUCKET)";
  }
  return new S3Error(`${code}: ${message}${hint}`, res.statusCode ?? 0, code, bucketRegion);
}

// ── Operaciones ────────────────────────────────────────────────────────────

export async function putObjectFromFile(
  cfg: S3Config,
  key: string,
  absPath: string,
  size: number,
  contentType: string,
): Promise<void> {
  const res = await rawRequest(cfg, {
    method: "PUT",
    key,
    payloadHash: UNSIGNED_PAYLOAD,
    headers: { "content-length": String(size), "content-type": contentType },
    body: fs.createReadStream(absPath),
    timeoutMs: 120_000,
  });
  if (res.statusCode !== 200) throw await toS3Error(res);
  res.resume();
}

export async function putObjectBuffer(cfg: S3Config, key: string, body: Buffer, contentType: string): Promise<void> {
  const res = await rawRequest(cfg, {
    method: "PUT",
    key,
    payloadHash: sha256Hex(body),
    headers: { "content-length": String(body.length), "content-type": contentType },
    body,
  });
  if (res.statusCode !== 200) throw await toS3Error(res);
  res.resume();
}

export async function getObjectText(cfg: S3Config, key: string): Promise<string> {
  const res = await rawRequest(cfg, { method: "GET", key });
  if (res.statusCode !== 200) throw await toS3Error(res);
  return readBody(res);
}

/**
 * Pide un objeto para hacer streaming. Devuelve la respuesta cruda de S3
 * (200, 206, 304, 404, 416…): quien llama decide qué hacer y debe consumirla.
 */
export function getObjectStream(
  cfg: S3Config,
  key: string,
  opts: { method?: "GET" | "HEAD"; range?: string } = {},
): Promise<IncomingMessage> {
  const headers: Record<string, string> = {};
  if (opts.range) headers.range = opts.range;
  return rawRequest(cfg, { method: opts.method ?? "GET", key, headers, timeoutMs: 60_000 });
}

export type S3ListedObject = { key: string; size: number; lastModified: number };

export async function listAllObjects(cfg: S3Config, prefix: string): Promise<S3ListedObject[]> {
  const out: S3ListedObject[] = [];
  let token: string | undefined;
  do {
    const query: Record<string, string> = { "list-type": "2", prefix, "max-keys": "1000" };
    if (token) query["continuation-token"] = token;
    const res = await rawRequest(cfg, { method: "GET", key: "", query });
    if (res.statusCode !== 200) throw await toS3Error(res);
    const xml = await readBody(res);
    const re = /<Contents>([\s\S]*?)<\/Contents>/g;
    let m: RegExpExecArray | null;
    while ((m = re.exec(xml))) {
      const block = m[1];
      const key = xmlTag(block, "Key");
      if (!key) continue;
      out.push({
        key,
        size: Number(xmlTag(block, "Size") || 0),
        lastModified: Date.parse(xmlTag(block, "LastModified") || "") || 0,
      });
    }
    token = xmlTag(xml, "IsTruncated") === "true" ? xmlTag(xml, "NextContinuationToken") : undefined;
  } while (token);
  return out;
}
