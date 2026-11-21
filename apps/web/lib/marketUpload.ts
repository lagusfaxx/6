import { getApiBase } from "./api";
import { appendVideoPosters } from "./videoPoster";

/**
 * Subida de fotos y videos de un pack.
 *
 * Antes se mandaba todo en una sola petición: con 2 o 3 videos se pasaba el
 * tope de tamaño del proxy (llegaba un 413 en HTML y la vendedora veía
 * "UPLOAD_FAILED"), con más de 20 archivos el servidor lo rechazaba entero y,
 * si se cortaba la conexión, se perdía todo. Ahora se sube de a un archivo,
 * con progreso, y si uno falla los demás igual quedan arriba.
 */

export const MAX_FILE_MB = 200;

const IMAGE_EXT = /\.(jpe?g|jfif|png|webp|gif|heic|heif)$/i;
const VIDEO_EXT = /\.(mp4|m4v|mov|qt|webm)$/i;

export type PackFileKind = "image" | "video";

/** ¿Es foto o video? Algunos celulares no informan el tipo: se mira la extensión. */
export function packFileKind(file: File): PackFileKind | null {
  const type = (file.type || "").toLowerCase();
  if (type.startsWith("video/") || VIDEO_EXT.test(file.name)) return "video";
  if (type.startsWith("image/") || IMAGE_EXT.test(file.name)) return "image";
  return null;
}

/** Motivo por el que no se puede subir, o null si está bien. */
export function packFileProblem(file: File): string | null {
  if (!packFileKind(file)) return `"${file.name}" no es una foto ni un video.`;
  if (file.size > MAX_FILE_MB * 1024 * 1024) {
    return `"${file.name}" pesa ${Math.round(file.size / 1024 / 1024)} MB (máximo ${MAX_FILE_MB} MB). Prueba con un video más corto.`;
  }
  return null;
}

export type UploadResult = { file: File; ok: true } | { file: File; ok: false; error: string };

function messageFor(status: number, body: any): string {
  if (body?.message) return String(body.message);
  if (status === 413) return "El archivo es demasiado pesado. Prueba con un video más corto o en menor calidad.";
  if (status === 429) return "Estás subiendo muy rápido. Espera un minuto e intenta de nuevo.";
  if (status === 401) return "Tu sesión se cerró. Vuelve a iniciar sesión.";
  if (status === 0) return "Se cortó la conexión. Revisa tu internet e intenta de nuevo.";
  return "No se pudo subir. Intenta de nuevo.";
}

function sendOne(url: string, form: FormData, onProgress: (fraction: number) => void): Promise<void> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", url);
    xhr.withCredentials = true;
    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable && event.total > 0) onProgress(event.loaded / event.total);
    };
    xhr.onload = () => {
      let body: any = null;
      try { body = JSON.parse(xhr.responseText); } catch { /* respuesta no JSON (proxy) */ }
      if (xhr.status >= 200 && xhr.status < 300) return resolve();
      reject(new Error(messageFor(xhr.status, body)));
    };
    xhr.onerror = () => reject(new Error(messageFor(0, null)));
    xhr.ontimeout = () => reject(new Error(messageFor(0, null)));
    xhr.send(form);
  });
}

/**
 * Sube los archivos de a uno. `onProgress` recibe cuántos van y la fracción
 * total (0..1) para pintar una barra. Nunca lanza: devuelve el resultado de
 * cada archivo.
 */
export async function uploadPackFiles(
  productId: string,
  kind: "assets" | "media",
  files: File[],
  onProgress?: (state: { done: number; total: number; fraction: number; current: string }) => void,
): Promise<UploadResult[]> {
  const url = `${getApiBase()}/market/seller/products/${productId}/${kind}`;
  const totalBytes = files.reduce((sum, f) => sum + Math.max(1, f.size), 0) || 1;
  let sentBytes = 0;
  const results: UploadResult[] = [];

  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    const report = (fraction: number) =>
      onProgress?.({
        done: i,
        total: files.length,
        fraction: Math.min(1, (sentBytes + Math.max(1, file.size) * fraction) / totalBytes),
        current: file.name,
      });
    report(0);

    const problem = packFileProblem(file);
    if (problem) {
      results.push({ file, ok: false, error: problem });
    } else {
      const form = new FormData();
      form.append("files", file);
      await appendVideoPosters(form, [file]).catch(() => undefined);
      let attempt = 0;
      // Un reintento automático: en celular la conexión se corta seguido.
      for (;;) {
        try {
          await sendOne(url, form, report);
          results.push({ file, ok: true });
          break;
        } catch (err: any) {
          attempt++;
          const msg = err?.message || "No se pudo subir.";
          const retryable = /conexión|internet/i.test(msg);
          if (!retryable || attempt >= 2) {
            results.push({ file, ok: false, error: msg });
            break;
          }
          await new Promise((r) => setTimeout(r, 1500));
        }
      }
    }
    sentBytes += Math.max(1, file.size);
  }
  onProgress?.({ done: files.length, total: files.length, fraction: 1, current: "" });
  return results;
}

export function summarizeFiles(files: File[]): { images: number; videos: number } {
  let images = 0;
  let videos = 0;
  for (const f of files) {
    const k = packFileKind(f);
    if (k === "image") images++;
    else if (k === "video") videos++;
  }
  return { images, videos };
}
