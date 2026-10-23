"use client";

/**
 * Achica una foto antes de subirla: lado mayor a `maxSide` px y JPEG.
 * Una foto de celular pasa de 4-10 MB a ~300-600 KB, así el registro con 6
 * fotos no manda 60 MB por datos móviles (la conexión se cortaba y el
 * navegador mostraba "Failed to fetch" / "Load failed").
 *
 * Si el navegador no puede decodificarla (p. ej. HEIC en Chrome) o la versión
 * comprimida no es más liviana, devuelve el archivo original.
 */
export async function compressImage(file: File, maxSide = 2000, quality = 0.85): Promise<File> {
  if (typeof window === "undefined" || !file.type.startsWith("image/")) return file;
  if (file.type === "image/gif") return file;
  try {
    const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" } as ImageBitmapOptions);
    const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height));
    const width = Math.round(bitmap.width * scale);
    const height = Math.round(bitmap.height * scale);
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      bitmap.close?.();
      return file;
    }
    ctx.drawImage(bitmap, 0, 0, width, height);
    bitmap.close?.();
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", quality));
    if (!blob || blob.size >= file.size) return file;
    const name = file.name.replace(/\.[^.]+$/, "") + ".jpg";
    return new File([blob], name, { type: "image/jpeg", lastModified: Date.now() });
  } catch {
    return file;
  }
}
