/**
 * Primer frame de un video, sacado en el navegador de quien sube.
 *
 * El servidor intenta lo mismo con ffmpeg, pero no siempre está instalado y
 * cuando falla el artículo queda publicado sin nada que mostrar. Extraer el
 * frame acá y mandarlo junto al archivo garantiza que la vitrina siempre tenga
 * una imagen, y no cuesta nada: el video ya está en el dispositivo.
 */

const POSTER_MAX_WIDTH = 720;
const POSTER_TIMEOUT_MS = 12000;

/** Devuelve un JPEG con el primer frame útil del video, o null si no se pudo. */
export async function extractVideoPoster(file: File): Promise<Blob | null> {
  if (typeof document === "undefined" || !file.type.startsWith("video/")) return null;

  const objectUrl = URL.createObjectURL(file);
  const video = document.createElement("video");
  video.muted = true;
  video.playsInline = true;
  video.preload = "metadata";
  video.crossOrigin = "anonymous";

  const cleanup = () => {
    video.removeAttribute("src");
    video.load();
    URL.revokeObjectURL(objectUrl);
  };

  try {
    const blob = await new Promise<Blob | null>((resolve) => {
      const timer = window.setTimeout(() => resolve(null), POSTER_TIMEOUT_MS);

      const finish = (result: Blob | null) => {
        window.clearTimeout(timer);
        resolve(result);
      };

      const draw = () => {
        try {
          const width = video.videoWidth;
          const height = video.videoHeight;
          if (!width || !height) return finish(null);

          const scale = Math.min(1, POSTER_MAX_WIDTH / width);
          const canvas = document.createElement("canvas");
          canvas.width = Math.round(width * scale);
          canvas.height = Math.round(height * scale);
          const ctx = canvas.getContext("2d");
          if (!ctx) return finish(null);
          ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
          canvas.toBlob((result) => finish(result), "image/jpeg", 0.82);
        } catch {
          finish(null);
        }
      };

      video.addEventListener("error", () => finish(null), { once: true });
      video.addEventListener("seeked", draw, { once: true });
      video.addEventListener(
        "loadeddata",
        () => {
          /* Medio segundo adentro: el frame cero de muchos videos es negro.
             Si el video es más corto, se queda con lo que ya está cargado. */
          const target = Number.isFinite(video.duration) && video.duration > 0.6 ? 0.4 : 0;
          if (target > 0) {
            try {
              video.currentTime = target;
              return;
            } catch {
              // Sin seek: se dibuja el frame actual.
            }
          }
          draw();
        },
        { once: true },
      );

      video.src = objectUrl;
      video.load();
    });

    return blob;
  } catch {
    return null;
  } finally {
    cleanup();
  }
}

/** Agrega al formulario el frame de cada video, indexado como espera la API. */
export async function appendVideoPosters(form: FormData, files: File[]): Promise<void> {
  await Promise.all(
    files.map(async (file, index) => {
      if (!file.type.startsWith("video/")) return;
      const poster = await extractVideoPoster(file);
      if (poster) form.append(`poster_${index}`, poster, `poster_${index}.jpg`);
    }),
  );
}
