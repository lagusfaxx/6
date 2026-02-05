import path from "node:path";
import fs from "node:fs/promises";
import { randomUUID } from "node:crypto";
import type { StorageProvider, UploadResult } from "./storageProvider";

function mimeToType(mime: string): "image" | "video" {
  if (mime.startsWith("image/")) return "image";
  return "video";
}

export class LocalStorageProvider implements StorageProvider {
  constructor(private uploadsDirAbs: string, private publicBaseUrl: string) {}

  async save(file: Express.Multer.File): Promise<UploadResult> {
    await fs.mkdir(this.uploadsDirAbs, { recursive: true });

    const ext = path.extname(file.originalname) || "";
    const filename = `${randomUUID()}${ext}`;
    const dest = path.join(this.uploadsDirAbs, filename);

    await fs.writeFile(dest, file.buffer);

    const url = `${this.publicBaseUrl.replace(/\/$/, "")}/uploads/${filename}`;
    return { url, type: mimeToType(file.mimetype) };
  }
}
