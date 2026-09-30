import path from "node:path";
import type { Request, Response, NextFunction } from "express";
import { getObjectStream, readS3ConfigFromEnv, type S3Config } from "./s3Client";

/**
 * Lectura desde S3 cuando el archivo no está en el disco local.
 *
 * Sólo actúa con STORAGE_DRIVER=mirror (o s3) y credenciales completas. Con el
 * valor por defecto (local) todo sigue exactamente igual que antes.
 */

export const S3_PUBLIC_PREFIX = "uploads/";
export const S3_PRIVATE_PREFIX = "umate-private/";

export type StorageDriver = "local" | "mirror";

export function storageDriver(): StorageDriver {
  const v = (process.env.STORAGE_DRIVER || "local").trim().toLowerCase();
  return v === "mirror" || v === "s3" ? "mirror" : "local";
}

let cachedCfg: S3Config | null | undefined;
export function activeS3Config(): S3Config | null {
  if (storageDriver() === "local") return null;
  if (cachedCfg === undefined) cachedCfg = readS3ConfigFromEnv();
  return cachedCfg;
}

const CONTENT_TYPES: Record<string, string> = {
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".webp": "image/webp",
  ".gif": "image/gif",
  ".avif": "image/avif",
  ".heic": "image/heic",
  ".heif": "image/heif",
  ".mp4": "video/mp4",
  ".m4v": "video/x-m4v",
  ".mov": "video/quicktime",
  ".webm": "video/webm",
  ".mp3": "audio/mpeg",
  ".m4a": "audio/mp4",
  ".ogg": "audio/ogg",
  ".wav": "audio/wav",
  ".pdf": "application/pdf",
};

export function contentTypeForKey(key: string): string {
  return CONTENT_TYPES[path.extname(key).toLowerCase()] || "application/octet-stream";
}

/** "/carpeta/a%20b.jpg" → "carpeta/a b.jpg"; null si el path no es seguro. */
export function safeRelativeKey(urlPath: string): string | null {
  const parts = urlPath.replace(/^\/+/, "").split("/");
  const out: string[] = [];
  for (const raw of parts) {
    let seg: string;
    try {
      seg = decodeURIComponent(raw);
    } catch {
      return null;
    }
    // Igual que express.static: sin "..", sin dotfiles, sin separadores raros.
    if (!seg || seg.startsWith(".") || seg.includes("\\") || seg.includes("\0") || seg.includes("/")) return null;
    out.push(seg);
  }
  return out.length ? out.join("/") : null;
}

const PASS_HEADERS = ["content-length", "content-range", "etag", "last-modified"];

/**
 * Hace streaming de un objeto S3 a la respuesta. Devuelve false (sin escribir
 * nada) si el objeto no existe o S3 falla, para que quien llama responda 404.
 */
export async function serveFromS3(
  key: string,
  req: Request,
  res: Response,
  headers: Record<string, string>,
): Promise<boolean> {
  const cfg = activeS3Config();
  if (!cfg) return false;
  if (req.method !== "GET" && req.method !== "HEAD") return false;

  const range = typeof req.headers.range === "string" ? req.headers.range : undefined;
  let upstream;
  try {
    upstream = await getObjectStream(cfg, key, { method: req.method as "GET" | "HEAD", range });
  } catch (err) {
    console.error("[s3] fallback read failed", key, (err as Error)?.message);
    return false;
  }

  const status = upstream.statusCode ?? 0;
  if (status === 416) {
    upstream.resume();
    const cr = upstream.headers["content-range"];
    if (cr) res.setHeader("Content-Range", String(cr));
    res.status(416).end();
    return true;
  }
  if (status !== 200 && status !== 206) {
    upstream.resume();
    if (status !== 404 && status !== 403) console.error("[s3] fallback read status", status, key);
    return false;
  }

  for (const [k, v] of Object.entries(headers)) res.setHeader(k, v);
  res.setHeader("Content-Type", contentTypeForKey(key));
  res.setHeader("Accept-Ranges", "bytes");
  for (const h of PASS_HEADERS) {
    const v = upstream.headers[h];
    if (v) res.setHeader(h, String(v));
  }
  res.status(status);

  if (req.method === "HEAD") {
    upstream.resume();
    res.end();
    return true;
  }
  res.on("close", () => upstream.destroy());
  upstream.on("error", () => res.destroy());
  upstream.pipe(res);
  return true;
}

/** Middleware para /uploads: va después de express.static (sólo llega si el archivo no está en disco). */
export function uploadsS3Fallback(headers: Record<string, string>) {
  return async (req: Request, res: Response, next: NextFunction) => {
    if (!activeS3Config()) return next();
    const rel = safeRelativeKey(req.path);
    if (!rel) return next();
    try {
      if (await serveFromS3(S3_PUBLIC_PREFIX + rel, req, res, headers)) return;
    } catch (err) {
      console.error("[s3] fallback error", (err as Error)?.message);
      if (res.headersSent) return;
    }
    next();
  };
}
