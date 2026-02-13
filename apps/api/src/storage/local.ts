import fs from "fs/promises";
import path from "path";
import type { StorageProvider } from "./types";

export class LocalStorageProvider implements StorageProvider {
  private baseDir: string;
  private publicPrefix: string;

  constructor(opts: { baseDir: string; publicPathPrefix: string }) {
    this.baseDir = path.resolve(opts.baseDir);
    this.publicPrefix = opts.publicPathPrefix.replace(/\/$/, "");
  }

  async ensureBaseDir(): Promise<void> {
    await fs.mkdir(this.baseDir, { recursive: true });
  }

  publicUrl(filename: string): string {
    return `${this.publicPrefix}/${encodeURIComponent(filename)}`;
  }
}
