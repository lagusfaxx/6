import path from "node:path";
import fs from "node:fs";
import fsp from "node:fs/promises";
import type { Request, Response } from "express";
import sharp from "sharp";
import { config } from "../config";
import { PRIVATE_DIR, isPrivateRef, privateRefToRelPath } from "./privateStorage";

/**
 * Heavily blurred + downscaled previews are SAFE TO SERVE PUBLICLY.
 * They reveal only coarse color/shape information, and the actual pixel
 * data of the underlying asset never leaves the server.
 *
 * Cached to disk so the Sharp pipeline runs at most once per media.
 */
const BLUR_CACHE_DIR = path.resolve(
  process.env.UMATE_BLUR_CACHE_DIR ||
    path.join(path.resolve(config.storageDir), "..", "umate-blur-cache"),
);

/** Tiny + heavily blurred: 32px wide, sigma 12. At CSS display size it's a
 *  formless color smudge — but still matches the photo's palette. */
const BLUR_WIDTH = 32;
const BLUR_SIGMA = 12;
const BLUR_QUALITY = 45;

export function buildBlurPreviewUrl(mediaId: string, subject: "asset" | "thumb"): string {
  const base = (config.apiUrl || "").replace(/\/$/, "");
  const suffix = subject === "thumb" ? "/blur-thumb" : "/blur";
  return `${base}/umate/media/${encodeURIComponent(mediaId)}${suffix}`;
}

async function ensureCacheDir(): Promise<void> {
  await fsp.mkdir(BLUR_CACHE_DIR, { recursive: true });
}

function cachePathFor(mediaId: string, subject: "asset" | "thumb"): string {
  const safeId = mediaId.replace(/[^a-zA-Z0-9_-]/g, "");
  return path.join(BLUR_CACHE_DIR, `${safeId}-${subject}.webp`);
}

/** Generate a cached blurred preview from a private file. */
async function generateBlurPreview(sourceRelPath: string, cacheAbs: string): Promise<boolean> {
  const sourceAbs = path.resolve(PRIVATE_DIR, sourceRelPath);
  const boundary = PRIVATE_DIR.endsWith(path.sep) ? PRIVATE_DIR : PRIVATE_DIR + path.sep;
  if (sourceAbs !== PRIVATE_DIR && !sourceAbs.startsWith(boundary)) return false;
  try {
    await fsp.access(sourceAbs);
  } catch {
    return false;
  }
  try {
    await ensureCacheDir();
    await sharp(sourceAbs, { failOn: "none" })
      .rotate()
      .resize(BLUR_WIDTH, undefined, { fit: "inside", withoutEnlargement: false })
      .blur(BLUR_SIGMA)
      .webp({ quality: BLUR_QUALITY })
      .toFile(cacheAbs);
    return true;
  } catch {
    return false;
  }
}

/** Stream a solid-color placeholder for media that has no usable source (e.g. video without thumbnail). */
async function streamFallbackPlaceholder(res: Response): Promise<void> {
  const buf = await sharp({
    create: {
      width: BLUR_WIDTH,
      height: BLUR_WIDTH,
      channels: 3,
      background: { r: 30, g: 25, b: 45 },
    },
  })
    .blur(BLUR_SIGMA)
    .webp({ quality: BLUR_QUALITY })
    .toBuffer();
  res.setHeader("Content-Type", "image/webp");
  res.setHeader("Cache-Control", "public, max-age=86400, immutable");
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.status(200).end(buf);
}

/**
 * Serve a public, pre-blurred preview of a private umate media asset.
 * No auth or signature: the response itself is already a safe derivative.
 */
export async function handleBlurPreview(
  req: Request,
  res: Response,
  subject: "asset" | "thumb",
  lookup: (mediaId: string) => Promise<{ url: string | null; thumbnailUrl: string | null } | null>,
): Promise<void> {
  const mediaId = String(req.params.mediaId || "");
  if (!mediaId) {
    res.status(400).end();
    return;
  }

  const cacheAbs = cachePathFor(mediaId, subject);

  const serveFromCache = (): boolean => {
    try {
      const st = fs.statSync(cacheAbs);
      if (!st.isFile()) return false;
      res.setHeader("Content-Type", "image/webp");
      res.setHeader("Cache-Control", "public, max-age=86400, immutable");
      res.setHeader("X-Content-Type-Options", "nosniff");
      res.setHeader("Content-Length", String(st.size));
      if (req.method === "HEAD") {
        res.status(200).end();
        return true;
      }
      fs.createReadStream(cacheAbs).pipe(res);
      return true;
    } catch {
      return false;
    }
  };

  if (serveFromCache()) return;

  const media = await lookup(mediaId);
  if (!media) {
    await streamFallbackPlaceholder(res);
    return;
  }

  const source = subject === "thumb" ? media.thumbnailUrl : media.url;
  if (!source || !isPrivateRef(source)) {
    await streamFallbackPlaceholder(res);
    return;
  }

  const rel = privateRefToRelPath(source);
  if (!rel) {
    await streamFallbackPlaceholder(res);
    return;
  }

  const ok = await generateBlurPreview(rel, cacheAbs);
  if (!ok) {
    await streamFallbackPlaceholder(res);
    return;
  }
  if (serveFromCache()) return;
  await streamFallbackPlaceholder(res);
}
