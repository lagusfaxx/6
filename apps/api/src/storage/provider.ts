export type StoredFile = {
  url: string;
  path: string;
};

export interface StorageProvider {
  save(params: { buffer: Buffer; mimeType: string; filename: string; folder: string }): Promise<StoredFile>;
}
