import sharp from "sharp";
import path from "node:path";
import fs from "node:fs/promises";

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

/**
 * Converts and resizes an image to WebP format.
 * Writes the .webp file next to the original and returns the new filename.
 * If the input is already WebP and within size limits, it's just resized.
 * Videos are returned as-is.
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
    await sharp(filePath)
      .resize(dims.width, dims.height, {
        fit: "inside",
        withoutEnlargement: true,
      })
      .webp({ quality: QUALITY.webp })
      .toFile(webpPath);

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
