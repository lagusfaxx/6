import path from "node:path";
import fs from "node:fs";
import fsp from "node:fs/promises";
import { randomUUID } from "node:crypto";
import type { Request, Response } from "express";
import { config } from "../config";

export const PRIVATE_PREFIX = "private://";

/**
 * Private storage root — sibling to the public uploads dir, NEVER mounted at /uploads.
 * Override with PRIVATE_STORAGE_DIR if needed.
 */
export const PRIVATE_DIR = path.resolve(
  process.env.PRIVATE_STORAGE_DIR ||
    path.join(path.resolve(config.storageDir), "..", "umate-private"),
);

const DANGEROUS_EXTS = new Set([
  ".html", ".htm", ".xhtml", ".svg", ".xml",
  ".php", ".jsp", ".asp", ".aspx", ".cgi",
  ".js", ".mjs", ".ts", ".css", ".swf",
]);

function safeExt(ext: string): string {
  const lower = (ext || "").toLowerCase();
  return DANGEROUS_EXTS.has(lower) ? ".bin" : lower;
}

export function isPrivateRef(url: string | null | undefined): boolean {
  return typeof url === "string" && url.startsWith(PRIVATE_PREFIX);
}

/** Convert "private://umate-posts/2026-04/uuid.mp4" → "umate-posts/2026-04/uuid.mp4" */
export function privateRefToRelPath(url: string): string | null {
  if (!isPrivateRef(url)) return null;
  return url.slice(PRIVATE_PREFIX.length).replace(/^\/+/, "");
}

export async function savePrivate(params: {
  buffer: Buffer;
  originalName: string;
  mimeType: string;
  folder: string;
}): Promise<{ url: string; relPath: string; type: "image" | "video" }> {
  const safeFolder = String(params.folder).replace(/[^a-zA-Z0-9_-]/g, "");
  if (!safeFolder) throw new Error("savePrivate: folder required");
  const datePart = new Date().toISOString().slice(0, 7); // yyyy-mm
  const ext = safeExt(path.extname(params.originalName || ""));
  const name = `${randomUUID()}${ext}`;
  const relPath = `${safeFolder}/${datePart}/${name}`;
  const abs = path.join(PRIVATE_DIR, relPath);
  await fsp.mkdir(path.dirname(abs), { recursive: true });
  await fsp.writeFile(abs, params.buffer);
  const type: "image" | "video" = params.mimeType.startsWith("image/") ? "image" : "video";
  return { url: PRIVATE_PREFIX + relPath, relPath, type };
}

function contentTypeFor(relPath: string): string {
  const ext = path.extname(relPath).toLowerCase();
  switch (ext) {
    case ".mp4":  return "video/mp4";
    case ".mov":  return "video/quicktime";
    case ".webm": return "video/webm";
    case ".m4v":  return "video/x-m4v";
    case ".jpg":
    case ".jpeg": return "image/jpeg";
    case ".png":  return "image/png";
    case ".webp": return "image/webp";
    case ".gif":  return "image/gif";
    default:      return "application/octet-stream";
  }
}

/** Stream a private file with HTTP Range support. Path-traversal safe. */
export async function streamPrivateFile(relPath: string, req: Request, res: Response): Promise<void> {
  const abs = path.resolve(PRIVATE_DIR, relPath);
  const boundary = PRIVATE_DIR.endsWith(path.sep) ? PRIVATE_DIR : PRIVATE_DIR + path.sep;
  if (abs !== PRIVATE_DIR && !abs.startsWith(boundary)) {
    res.status(400).end();
    return;
  }
  let stat: fs.Stats;
  try { stat = await fsp.stat(abs); } catch {
    res.status(404).end();
    return;
  }
  if (!stat.isFile()) {
    res.status(404).end();
    return;
  }

  const total = stat.size;
  const type = contentTypeFor(relPath);

  res.setHeader("Content-Type", type);
  res.setHeader("Accept-Ranges", "bytes");
  // Don't let CDNs or browsers cache signed responses beyond the TTL of the URL
  res.setHeader("Cache-Control", "private, max-age=300");
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("Content-Disposition", "inline");
  // Prevent scripted rendering of uploaded bytes
  res.setHeader("Content-Security-Policy", "default-src 'none'; media-src 'self'; img-src 'self'");

  const range = req.headers.range;
  if (!range) {
    res.setHeader("Content-Length", String(total));
    if (req.method === "HEAD") { res.status(200).end(); return; }
    fs.createReadStream(abs).pipe(res);
    return;
  }

  const match = /^bytes=(\d*)-(\d*)$/.exec(range);
  if (!match) {
    res.setHeader("Content-Range", `bytes */${total}`);
    res.status(416).end();
    return;
  }
  const startStr = match[1];
  const endStr = match[2];
  let start = startStr ? parseInt(startStr, 10) : NaN;
  let end = endStr ? parseInt(endStr, 10) : NaN;

  if (!startStr && endStr) {
    // suffix form: bytes=-N → last N bytes
    const suffix = end;
    if (!Number.isFinite(suffix) || suffix <= 0) {
      res.setHeader("Content-Range", `bytes */${total}`);
      res.status(416).end();
      return;
    }
    start = Math.max(0, total - suffix);
    end = total - 1;
  } else {
    if (!Number.isFinite(end)) end = total - 1;
    if (!Number.isFinite(start)) start = 0;
  }

  if (start < 0 || end >= total || start > end) {
    res.setHeader("Content-Range", `bytes */${total}`);
    res.status(416).end();
    return;
  }

  const chunkSize = end - start + 1;
  res.status(206);
  res.setHeader("Content-Range", `bytes ${start}-${end}/${total}`);
  res.setHeader("Content-Length", String(chunkSize));
  if (req.method === "HEAD") { res.end(); return; }
  fs.createReadStream(abs, { start, end }).pipe(res);
}
