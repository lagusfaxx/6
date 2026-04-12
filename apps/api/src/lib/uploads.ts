import fs from "fs/promises";
const MAX_IMAGE_SIZE = 10 * 1024 * 1024;
const MAX_VIDEO_SIZE = 100 * 1024 * 1024;

/** Extensions that could execute scripts when served by the browser or a reverse proxy */
const DANGEROUS_EXTENSIONS = new Set([
  ".html", ".htm", ".xhtml", ".svg", ".xml",
  ".php", ".jsp", ".asp", ".aspx", ".cgi",
  ".js", ".mjs", ".ts", ".css",
  ".swf", ".xss",
]);

/**
 * Sanitize a file extension by rejecting dangerous ones that could be executed
 * as scripts if served by the web server or a misconfigured reverse proxy.
 */
export function sanitizeExtension(ext: string): string {
  const lower = ext.toLowerCase();
  if (DANGEROUS_EXTENSIONS.has(lower)) return ".bin";
  return lower;
}

export type UploadedKind = "image" | "video" | "image-or-video";

export async function validateUploadedFile(file: Express.Multer.File, kind: UploadedKind) {
  const { fileTypeFromFile } = await import("file-type");
  const detected = await fileTypeFromFile(file.path);
  if (!detected) {
    await cleanupFile(file.path);
    throw new Error("INVALID_FILE_TYPE");
  }

  // iOS Safari is strict about what it can decode. To avoid "works on desktop, fails on iPhone",
  // we restrict uploaded videos to MP4 (H.264/AAC) and MOV. If you later add transcoding,
  // you can relax this.
  const allowedVideoMimes = new Set(["video/mp4", "video/quicktime"]);

  const isImage = detected.mime.startsWith("image/");
  const isVideo = detected.mime.startsWith("video/");

  if (isVideo && !allowedVideoMimes.has(detected.mime)) {
    await cleanupFile(file.path);
    throw new Error("UNSUPPORTED_VIDEO_FORMAT");
  }
  if (kind === "image" && !isImage) {
    await cleanupFile(file.path);
    throw new Error("INVALID_FILE_TYPE");
  }
  if (kind === "video" && !isVideo) {
    await cleanupFile(file.path);
    throw new Error("INVALID_FILE_TYPE");
  }
  if (kind === "image-or-video" && !isImage && !isVideo) {
    await cleanupFile(file.path);
    throw new Error("INVALID_FILE_TYPE");
  }

  if (isImage && file.size > MAX_IMAGE_SIZE) {
    await cleanupFile(file.path);
    throw new Error("FILE_TOO_LARGE");
  }
  if (isVideo && file.size > MAX_VIDEO_SIZE) {
    await cleanupFile(file.path);
    throw new Error("FILE_TOO_LARGE");
  }

  return { type: isVideo ? "VIDEO" : "IMAGE" };
}

async function cleanupFile(pathname: string) {
  try {
    await fs.unlink(pathname);
  } catch {
    // ignore cleanup errors
  }
}
