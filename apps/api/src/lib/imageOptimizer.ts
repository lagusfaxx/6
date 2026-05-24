import sharp from "sharp";
import path from "node:path";
import fs from "node:fs/promises";
import heicConvert from "heic-convert";

const HEIC_EXTS = new Set([".heic", ".heif"]);

async function readDecodableImage(filePath: string): Promise<Buffer> {
  const raw = await fs.readFile(filePath);
  const ext = path.extname(filePath).toLowerCase();
  if (!HEIC_EXTS.has(ext)) return raw;
  // The prebuilt sharp binary on linux-x64 ships libheif but no HEVC decoder
  // (libde265), so any iPhone HEIC blows up with "Support for this compression
  // format has not been built in". heic-convert is a pure-JS HEIC→JPEG decoder
  // that lets us hand sharp something it can actually read.
  const jpeg = await heicConvert({ buffer: raw, format: "JPEG", quality: 0.92 });
  return Buffer.from(jpeg);
}

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

export class ImageOptimizationError extends Error {
  code = "IMAGE_OPTIMIZATION_FAILED" as const;
  constructor(public reason: string) {
    super(`Image optimization failed: ${reason}`);
  }
}

/**
 * Converts and resizes an image to WebP format.
 * Writes the .webp file next to the original and returns the new filename.
 * Videos are returned as-is. iPhone HEIC files are decoded to JPEG in JS first
 * because the prebuilt sharp binary has no HEVC decoder. If decoding still
 * fails (corrupt input, unrecognized format) we throw — returning the original
 * filename used to leave records pointing to URLs the browser can't render,
 * which made photos "disappear" from professional profiles.
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
  const baseName = path.basename(filePath, ext);
  const webpFilename = `${baseName}.webp`;
  const webpPath = path.join(dir, webpFilename);

  try {
    const input = await readDecodableImage(filePath);
    await sharp(input, { failOn: "none" })
      // Honor EXIF orientation so portrait iPhone photos aren't sideways.
      .rotate()
      .resize(dims.width, dims.height, {
        fit: "inside",
        withoutEnlargement: true,
      })
      .webp({ quality: QUALITY.webp })
      .toFile(webpPath);
  } catch (err) {
    // Couldn't decode the input (corrupt file, unrecognized format, or HEIC
    // that even heic-convert rejects). Clean up any partial webp output and
    // signal the caller so the original is removed and the user gets an
    // actionable error instead of an unrenderable URL in their profile.
    await fs.unlink(webpPath).catch(() => {});
    const reason = err instanceof Error ? err.message : String(err);
    throw new ImageOptimizationError(reason);
  }

  if (webpPath !== filePath) {
    await fs.unlink(filePath).catch(() => {});
  }

  return { optimizedPath: webpPath, filename: webpFilename };
}

/**
 * Optimizes a multer file in-place. Returns the new filename for URL generation.
 * Throws ImageOptimizationError if sharp cannot decode the image — callers
 * should treat this as an unprocessable file and surface a user-facing error.
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
