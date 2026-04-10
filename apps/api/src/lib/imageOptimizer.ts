import sharp from "sharp";
import path from "node:path";
import fs from "node:fs/promises";
import { buildWatermark } from "./watermark";

/** Quality settings per use case */
const QUALITY = { webp: 80, avif: 65 } as const;

/** Max dimensions by usage context */
export const IMAGE_SIZES = {
  avatar: { width: 256, height: 256 },
  cover: { width: 1200, height: 800 },
  gallery: { width: 1200, height: 1200 },
  thumbnail: { width: 400, height: 400 },
  banner: { width: 1400, height: 400 },
} as const;

export type ImageUseCase = keyof typeof IMAGE_SIZES;

/** Prefix added to filenames once a watermark has been baked in. Used as an
 *  idempotency marker so that repeated processing never stamps twice. */
export const WATERMARK_PREFIX = "wm_";

/** Use cases that should NOT receive a watermark (too small to be readable
 *  or not user-visible content). */
const NO_WATERMARK_USECASES = new Set<ImageUseCase>(["avatar", "thumbnail"]);

/** Below this width (in px) we skip the watermark even on supported use
 *  cases — the stamp becomes noisy on very small outputs. */
const MIN_WATERMARK_WIDTH = 400;

function shouldWatermark(useCase: ImageUseCase): boolean {
  if (NO_WATERMARK_USECASES.has(useCase)) return false;
  return true;
}

/** Compute the output dimensions that sharp will produce for a
 *  `fit: "inside", withoutEnlargement: true` resize. */
function computeFittedSize(
  srcW: number,
  srcH: number,
  maxW: number,
  maxH: number,
): { width: number; height: number } {
  if (!srcW || !srcH) return { width: maxW, height: maxH };
  if (srcW <= maxW && srcH <= maxH) return { width: srcW, height: srcH };
  const ratio = Math.min(maxW / srcW, maxH / srcH);
  return {
    width: Math.max(1, Math.round(srcW * ratio)),
    height: Math.max(1, Math.round(srcH * ratio)),
  };
}

/**
 * Converts and resizes an image to WebP format, applying the Uzeed
 * watermark when appropriate. Writes the output next to the original
 * (with a `wm_` prefix) and returns the new filename. Videos are
 * returned as-is. The returned filename carries the `wm_` prefix when
 * a watermark was actually stamped, so callers store the marked URL.
 */
export async function optimizeImage(
  filePath: string,
  useCase: ImageUseCase = "gallery",
): Promise<{ optimizedPath: string; filename: string }> {
  const ext = path.extname(filePath).toLowerCase();

  // Skip videos
  const videoExts = new Set([".mp4", ".mov", ".webm", ".avi", ".mkv"]);
  if (videoExts.has(ext)) {
    return { optimizedPath: filePath, filename: path.basename(filePath) };
  }

  const dims = IMAGE_SIZES[useCase];
  const dir = path.dirname(filePath);
  const rawBase = path.basename(filePath, ext);
  // Strip any pre-existing watermark prefix from the base — we'll re-add it
  // if this run stamps the image, so we never double up (wm_wm_...).
  const baseName = rawBase.startsWith(WATERMARK_PREFIX)
    ? rawBase.slice(WATERMARK_PREFIX.length)
    : rawBase;
  const willWatermark = shouldWatermark(useCase);
  const outBase = willWatermark ? `${WATERMARK_PREFIX}${baseName}` : baseName;
  const webpFilename = `${outBase}.webp`;
  const webpPath = path.join(dir, webpFilename);

  try {
    // Read metadata once so we can size the watermark to the *resized*
    // output dimensions (not the original) and avoid an extra sharp pass.
    const meta = await sharp(filePath).metadata();
    const fitted = computeFittedSize(
      meta.width || dims.width,
      meta.height || dims.height,
      dims.width,
      dims.height,
    );

    let pipeline = sharp(filePath)
      .rotate() // auto-orient based on EXIF
      .resize(dims.width, dims.height, {
        fit: "inside",
        withoutEnlargement: true,
      });

    if (willWatermark && fitted.width >= MIN_WATERMARK_WIDTH) {
      try {
        const wm = await buildWatermark(fitted.width);
        pipeline = pipeline.composite([
          { input: wm, gravity: "southeast" },
        ]);
      } catch {
        // If watermark build fails, keep the un-stamped pipeline so the
        // upload still succeeds.
      }
    }

    await pipeline.webp({ quality: QUALITY.webp }).toFile(webpPath);

    // Remove original if it's a different file
    if (webpPath !== filePath) {
      await fs.unlink(filePath).catch(() => {});
    }

    return { optimizedPath: webpPath, filename: webpFilename };
  } catch {
    // If sharp fails (corrupt image, unsupported format), return original
    return { optimizedPath: filePath, filename: path.basename(filePath) };
  }
}

/**
 * Optimizes a multer file in-place. Returns the new filename for URL generation.
 */
export async function optimizeUploadedImage(
  file: Express.Multer.File,
  useCase: ImageUseCase = "gallery",
): Promise<string> {
  const mime = (file.mimetype || "").toLowerCase();

  // Only process images
  if (!mime.startsWith("image/")) return file.filename;

  // Skip SVGs and GIFs (animated)
  if (mime === "image/svg+xml" || mime === "image/gif") return file.filename;

  const { filename } = await optimizeImage(file.path, useCase);
  return filename;
}

/**
 * Result of processing an in-memory image buffer: a new WebP buffer (resized
 * and watermark-stamped when appropriate) plus the filename and mime type
 * callers should forward to `storageProvider.save(...)`. If the input is not
 * an optimisable image (video, GIF, SVG, or sharp failure) the caller's
 * original buffer/filename/mime are returned untouched.
 */
export type ProcessedBuffer = {
  buffer: Buffer;
  filename: string;
  mimeType: string;
};

/**
 * Resize, watermark and re-encode an in-memory image buffer. Mirrors the
 * `optimizeImage`/`optimizeUploadedImage` pipeline for routes that save
 * directly from `memoryStorage` (umate, chat attachments).
 *
 * The returned filename is renamed to end in `.webp` with the `wm_` prefix
 * whenever a watermark was actually applied, keeping the stored URL in sync
 * with the backfill naming scheme.
 */
export async function optimizeImageBuffer(
  buffer: Buffer,
  originalFilename: string,
  mimeType: string,
  useCase: ImageUseCase = "gallery",
): Promise<ProcessedBuffer> {
  const mime = (mimeType || "").toLowerCase();
  const passthrough: ProcessedBuffer = {
    buffer,
    filename: originalFilename,
    mimeType,
  };

  // Only process still images
  if (!mime.startsWith("image/")) return passthrough;
  if (mime === "image/svg+xml" || mime === "image/gif") return passthrough;

  try {
    const dims = IMAGE_SIZES[useCase];
    const meta = await sharp(buffer).metadata();
    const fitted = computeFittedSize(
      meta.width || dims.width,
      meta.height || dims.height,
      dims.width,
      dims.height,
    );

    let pipeline = sharp(buffer)
      .rotate()
      .resize(dims.width, dims.height, {
        fit: "inside",
        withoutEnlargement: true,
      });

    const willWatermark =
      shouldWatermark(useCase) && fitted.width >= MIN_WATERMARK_WIDTH;

    if (willWatermark) {
      try {
        const wm = await buildWatermark(fitted.width);
        pipeline = pipeline.composite([
          { input: wm, gravity: "southeast" },
        ]);
      } catch {
        // Ignore watermark failure, keep upload flowing
      }
    }

    const out = await pipeline.webp({ quality: QUALITY.webp }).toBuffer();

    const ext = path.extname(originalFilename) || "";
    const rawBase = path.basename(originalFilename, ext);
    const baseName = rawBase.startsWith(WATERMARK_PREFIX)
      ? rawBase.slice(WATERMARK_PREFIX.length)
      : rawBase;
    const outBase = willWatermark ? `${WATERMARK_PREFIX}${baseName}` : baseName;
    return {
      buffer: out,
      filename: `${outBase || "image"}.webp`,
      mimeType: "image/webp",
    };
  } catch {
    return passthrough;
  }
}
