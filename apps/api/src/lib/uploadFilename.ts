import path from "path";
import fs from "fs/promises";
import { randomBytes } from "crypto";
import type { Request, Response, NextFunction } from "express";

/**
 * Extensiones que se pueden servir desde /uploads. Todo lo demás (.html,
 * .svg, .js…) queda como ".bin": así nadie aloja una página propia en el
 * dominio de la API aunque logre colar un archivo.
 */
const MEDIA_EXTENSIONS = new Set([
  ".jpg", ".jpeg", ".png", ".webp", ".gif", ".avif", ".heic", ".heif",
  ".mp4", ".mov", ".m4v", ".webm",
]);

const MIME_TO_EXT: Record<string, string> = {
  "image/jpeg": ".jpg",
  "image/png": ".png",
  "image/webp": ".webp",
  "image/gif": ".gif",
  "image/avif": ".avif",
  "image/heic": ".heic",
  "image/heif": ".heif",
  "video/mp4": ".mp4",
  "video/quicktime": ".mov",
  "video/webm": ".webm",
};

export function isServableUploadExt(ext: string): boolean {
  return MEDIA_EXTENSIONS.has(ext.toLowerCase());
}

/** Extensión segura: la del nombre si es de medios, si no la del tipo declarado, si no ".bin". */
export function safeUploadExt(originalname: string | undefined, mimetype: string | undefined): string {
  const fromName = path.extname(originalname || "").toLowerCase();
  if (MEDIA_EXTENSIONS.has(fromName)) return fromName;
  return MIME_TO_EXT[(mimetype || "").toLowerCase()] || ".bin";
}

/**
 * Nombre para `multer.diskStorage`: marca de tiempo + azar (no se puede
 * adivinar ni pisar el archivo de otra persona) + una parte legible del
 * nombre original + extensión segura.
 */
export function safeUploadFilename(file: { originalname?: string; mimetype?: string }, prefix = ""): string {
  const ext = safeUploadExt(file.originalname, file.mimetype);
  const rawBase = path.basename(file.originalname || "", path.extname(file.originalname || ""));
  const safeBase = rawBase.replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 40);
  const rand = randomBytes(6).toString("hex");
  return `${prefix}${Date.now()}-${rand}${safeBase ? `-${safeBase}` : ""}${ext}`;
}

function uploadedFiles(req: Request): Express.Multer.File[] {
  const out: Express.Multer.File[] = [];
  if (req.file) out.push(req.file);
  const files = req.files as Express.Multer.File[] | Record<string, Express.Multer.File[]> | undefined;
  if (Array.isArray(files)) out.push(...files);
  else if (files) for (const list of Object.values(files)) out.push(...list);
  return out;
}

/**
 * Si la petición termina en error (4xx/5xx), borra los archivos que multer
 * dejó en disco. Sin esto, un registro rechazado o un adjunto a un chat
 * prohibido dejaba el archivo servido públicamente para siempre, y repetirlo
 * llenaba el disco.
 */
export function cleanupUploadsOnError(req: Request, res: Response, next: NextFunction) {
  res.on("finish", () => {
    if (res.statusCode < 400) return;
    for (const file of uploadedFiles(req)) {
      if (file.path) fs.unlink(file.path).catch(() => {});
    }
  });
  next();
}

/**
 * Opciones de entrada para ffmpeg con archivos del usuario: sólo puede leer
 * archivos locales (sin http, tcp, etc.) y no acepta listas de reproducción
 * (HLS/concat), que son la vía clásica para hacerle pedir URLs internas.
 */
export const FFMPEG_SAFE_INPUT_ARGS = ["-protocol_whitelist", "file"] as const;

/** true si el buffer parece un video real y no una lista de reproducción disfrazada. */
export function looksLikePlainVideo(buffer: Buffer): boolean {
  const head = buffer.subarray(0, 512).toString("latin1").trimStart();
  return !/^(#EXTM3U|ffconcat|#EXT-X-|<\?xml|<MPD)/i.test(head);
}
