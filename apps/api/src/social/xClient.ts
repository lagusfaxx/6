import crypto from "crypto";
import { config } from "../config";

/**
 * Cliente mínimo de la API de X (Twitter).
 *
 * X sigue exigiendo OAuth 1.0a de usuario para publicar en nombre de una
 * cuenta y para subir imágenes (la subida vive todavía en el endpoint v1.1),
 * así que se firma a mano en vez de añadir una dependencia: son dos llamadas
 * y la firma HMAC-SHA1 cabe en unas pocas líneas.
 */

const TWEET_URL = "https://api.x.com/2/tweets";
const MEDIA_UPLOAD_URL = "https://upload.x.com/1.1/media/upload.json";

/** Límite de caracteres de un post en X para cuentas sin suscripción. */
export const X_MAX_CHARS = 280;

/** Errores de la API de X. `retryable` distingue un fallo pasajero de uno definitivo. */
export class XApiError extends Error {
  constructor(
    message: string,
    public status: number,
    public retryable: boolean,
  ) {
    super(message);
    this.name = "XApiError";
  }
}

export function xEnabled(): boolean {
  const c = config.x;
  return Boolean(c.apiKey && c.apiSecret && c.accessToken && c.accessSecret);
}

/** Codificación porcentual estricta de OAuth 1.0a (RFC 3986). */
function pct(value: string): string {
  return encodeURIComponent(value).replace(
    /[!'()*]/g,
    (c) => "%" + c.charCodeAt(0).toString(16).toUpperCase(),
  );
}

/**
 * Cabecera Authorization de OAuth 1.0a.
 *
 * `bodyParams` solo lleva contenido cuando el cuerpo va como
 * application/x-www-form-urlencoded: en JSON y en multipart la firma se
 * calcula solo con los parámetros de la URL, como manda la especificación.
 */
function authHeader(
  method: "GET" | "POST",
  url: string,
  bodyParams: Record<string, string> = {},
): string {
  const c = config.x;
  const oauth: Record<string, string> = {
    oauth_consumer_key: c.apiKey,
    oauth_nonce: crypto.randomBytes(16).toString("hex"),
    oauth_signature_method: "HMAC-SHA1",
    oauth_timestamp: Math.floor(Date.now() / 1000).toString(),
    oauth_token: c.accessToken,
    oauth_version: "1.0",
  };

  const parsed = new URL(url);
  const params: Record<string, string> = { ...oauth, ...bodyParams };
  parsed.searchParams.forEach((v, k) => {
    params[k] = v;
  });

  const paramString = Object.keys(params)
    .map((k) => [pct(k), pct(params[k])] as const)
    .sort((a, b) => (a[0] === b[0] ? (a[1] < b[1] ? -1 : 1) : a[0] < b[0] ? -1 : 1))
    .map(([k, v]) => `${k}=${v}`)
    .join("&");

  const baseUrl = `${parsed.origin}${parsed.pathname}`;
  const base = [method, pct(baseUrl), pct(paramString)].join("&");
  const key = `${pct(c.apiSecret)}&${pct(c.accessSecret)}`;
  oauth.oauth_signature = crypto.createHmac("sha1", key).update(base).digest("base64");

  return (
    "OAuth " +
    Object.keys(oauth)
      .sort()
      .map((k) => `${pct(k)}="${pct(oauth[k])}"`)
      .join(", ")
  );
}

/** 5xx y 429 son pasajeros; el resto (credenciales, texto duplicado) no lo son. */
function isRetryableStatus(status: number): boolean {
  return status === 429 || status >= 500;
}

async function readError(res: Response): Promise<string> {
  const body = await res.text().catch(() => "");
  return body.slice(0, 500) || res.statusText;
}

/**
 * Sube una imagen y devuelve su media_id.
 *
 * Va en multipart porque así el cuerpo queda fuera de la firma: firmar varios
 * megabytes en base64 funciona, pero es frágil y mucho más caro.
 */
export async function uploadImage(bytes: Buffer, mimeType: string): Promise<string> {
  const boundary = `----uzeed${crypto.randomBytes(12).toString("hex")}`;
  const head = Buffer.from(
    `--${boundary}\r\n` +
      `Content-Disposition: form-data; name="media"; filename="image"\r\n` +
      `Content-Type: ${mimeType}\r\n\r\n`,
  );
  const tail = Buffer.from(`\r\n--${boundary}--\r\n`);
  const body = Buffer.concat([head, bytes, tail]);

  const res = await fetch(MEDIA_UPLOAD_URL, {
    method: "POST",
    headers: {
      Authorization: authHeader("POST", MEDIA_UPLOAD_URL),
      "Content-Type": `multipart/form-data; boundary=${boundary}`,
    },
    body,
  });

  if (!res.ok) {
    throw new XApiError(
      `media/upload falló: ${await readError(res)}`,
      res.status,
      isRetryableStatus(res.status),
    );
  }

  const json = (await res.json()) as { media_id_string?: string };
  if (!json.media_id_string) {
    throw new XApiError("media/upload no devolvió media_id_string", res.status, false);
  }
  return json.media_id_string;
}

/** Publica un post y devuelve su ID en X. */
export async function postTweet(text: string, mediaIds: string[] = []): Promise<string> {
  const payload: Record<string, unknown> = { text };
  // X admite hasta 4 imágenes por post; de más devuelve 400.
  if (mediaIds.length) payload.media = { media_ids: mediaIds.slice(0, 4) };

  const res = await fetch(TWEET_URL, {
    method: "POST",
    headers: {
      Authorization: authHeader("POST", TWEET_URL),
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    throw new XApiError(
      `POST /2/tweets falló: ${await readError(res)}`,
      res.status,
      isRetryableStatus(res.status),
    );
  }

  const json = (await res.json()) as { data?: { id?: string } };
  if (!json.data?.id) {
    throw new XApiError("POST /2/tweets no devolvió el id", res.status, false);
  }
  return json.data.id;
}
