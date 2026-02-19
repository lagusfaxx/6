export interface StorageProvider {
  ensureBaseDir(): Promise<void>;
  publicUrl(filename: string): string;
}
