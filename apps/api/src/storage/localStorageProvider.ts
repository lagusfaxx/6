import path from "node:path";
import fs from "node:fs/promises";
import { randomUUID } from "node:crypto";

export type UploadResult = { url: string; type: "image" | "video" };

type ConstructorOpts =
  | { baseDir: string; publicPathPrefix: string }
  | { uploadsDirAbs: string; publicBaseUrl: string };

type SaveInput =
  | Express.Multer.File
  | { buffer: Buffer; filename: string; mimeType: string; folder?: string };

function mimeToType(mime: string): "image" | "video" {
  if (mime.startsWith("image/")) return "image";
  return "video";
}

export class LocalStorageProvider {
  private uploadsDirAbs: string;
  private publicBaseUrl: string;

  constructor(a: any, b?: any) {
    // Backward compatible:
    // - new LocalStorageProvider({ baseDir, publicPathPrefix })
    // - new LocalStorageProvider(uploadsDirAbs, publicBaseUrl)
    if (typeof a === "string") {
      this.uploadsDirAbs = path.resolve(a);
      this.publicBaseUrl = String(b || "").replace(/\/$/, "");
    } else if (a && typeof a === "object" && "baseDir" in a) {
      this.uploadsDirAbs = path.resolve(String(a.baseDir));
      this.publicBaseUrl = String(a.publicPathPrefix || "").replace(/\/$/, "");
    } else if (a && typeof a === "object" && "uploadsDirAbs" in a) {
      this.uploadsDirAbs = path.resolve(String(a.uploadsDirAbs));
      this.publicBaseUrl = String(a.publicBaseUrl || "").replace(/\/$/, "");
    } else {
      // fallback
      this.uploadsDirAbs = path.resolve("uploads");
      this.publicBaseUrl = "";
    }
  }

  async ensureBaseDir(): Promise<void> {
    await fs.mkdir(this.uploadsDirAbs, { recursive: true });
  }

  publicUrl(filename: string): string {
    const base = this.publicBaseUrl;
    // Encode each path segment individually to preserve subdirectory separators
    const encoded = filename.split("/").map(encodeURIComponent).join("/");
    if (!base) return `/uploads/${encoded}`;
    return `${base}/${encoded}`;
  }

  async save(file: SaveInput): Promise<UploadResult & { filename: string }> {
    await this.ensureBaseDir();

    const isMulter = (file as any).originalname && (file as any).mimetype;
    const filenameIn = isMulter ? (file as any).originalname : (file as any).filename;
    const mime = isMulter ? (file as any).mimetype : (file as any).mimeType;
    const buffer = isMulter ? (file as any).buffer : (file as any).buffer;
    const folder = !isMulter ? (file as any).folder : undefined;

    const ext = path.extname(filenameIn || "") || "";
    const safeFolder = folder ? String(folder).replace(/[^a-zA-Z0-9_-]/g, "") : "";
    const unique = randomUUID();

    // Use real subdirectory when folder is specified, for cleaner file organization
    let filename: string;
    let abs: string;
    if (safeFolder) {
      const subDir = path.join(this.uploadsDirAbs, safeFolder);
      await fs.mkdir(subDir, { recursive: true });
      filename = `${safeFolder}/${unique}${ext}`;
      abs = path.join(subDir, `${unique}${ext}`);
    } else {
      filename = `${unique}${ext}`;
      abs = path.join(this.uploadsDirAbs, filename);
    }

    await fs.writeFile(abs, buffer);
    return { url: this.publicUrl(filename), type: mimeToType(String(mime || "")), filename };
  }
}
