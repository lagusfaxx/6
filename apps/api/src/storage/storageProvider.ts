export type UploadResult = { url: string; type: "image" | "video" };

export interface StorageProvider {
  save(file: Express.Multer.File): Promise<UploadResult>;
}
