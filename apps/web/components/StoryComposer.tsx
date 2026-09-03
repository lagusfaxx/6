"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ArrowRight, Camera, ImagePlus, Loader2, Plus, Trash2, X } from "lucide-react";
import { getApiBase } from "../lib/api";

/** Archivo elegido y todavía sin publicar. */
type Draft = {
  id: string;
  file: File;
  url: string;
  isVideo: boolean;
};

const MAX_FILE_BYTES = 100 * 1024 * 1024; // el límite del backend
const MAX_DRAFTS = 10;

/* La subida va por XHR y no por fetch porque es la única forma de ir sabiendo
   cuánto lleva enviado: con videos de decenas de MB, un botón "Subiendo…" sin
   progreso parece colgado. */
function uploadStory(file: File, onProgress: (pct: number) => void): Promise<void> {
  return new Promise((resolve, reject) => {
    const body = new FormData();
    body.append("file", file);

    const xhr = new XMLHttpRequest();
    xhr.open("POST", `${getApiBase()}/stories/upload`);
    xhr.withCredentials = true;
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) onProgress(Math.round((e.loaded / e.total) * 100));
    };
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) resolve();
      else reject(new Error(`HTTP_${xhr.status}`));
    };
    xhr.onerror = () => reject(new Error("NETWORK"));
    xhr.onabort = () => reject(new Error("ABORTED"));
    xhr.send(body);
  });
}

/**
 * Composer de historias a pantalla completa. Se abre encima de la pantalla en
 * la que está la profesional —el inicio, su panel— para que publicar no
 * signifique irse a otra página y perder lo que estaba viendo.
 */
export default function StoryComposer({
  open,
  onClose,
  onPublished,
}: {
  open: boolean;
  onClose: () => void;
  onPublished?: (count: number) => void;
}) {
  const galleryRef = useRef<HTMLInputElement | null>(null);
  const cameraRef = useRef<HTMLInputElement | null>(null);

  const [drafts, setDrafts] = useState<Draft[]>([]);
  const [activeIdx, setActiveIdx] = useState(0);
  const [publishing, setPublishing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [publishedCount, setPublishedCount] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);

  const active = drafts[activeIdx] ?? null;

  // Las URLs de vista previa ocupan memoria hasta que se liberan.
  const draftsRef = useRef<Draft[]>([]);
  draftsRef.current = drafts;
  useEffect(() => () => draftsRef.current.forEach((d) => URL.revokeObjectURL(d.url)), []);

  const addFiles = useCallback((files: FileList | File[] | null) => {
    if (!files) return;
    const incoming = Array.from(files);
    if (incoming.length === 0) return;

    const accepted: Draft[] = [];
    let rejected: string | null = null;

    for (const file of incoming) {
      const mime = (file.type || "").toLowerCase();
      const isVideo = mime.startsWith("video/");
      if (!isVideo && !mime.startsWith("image/")) {
        rejected = "Solo puedes subir fotos o videos.";
        continue;
      }
      if (file.size > MAX_FILE_BYTES) {
        rejected = `"${file.name}" pesa más de 100 MB.`;
        continue;
      }
      accepted.push({
        id: `${file.name}-${file.size}-${file.lastModified}-${Math.random().toString(36).slice(2)}`,
        file,
        url: URL.createObjectURL(file),
        isVideo,
      });
    }

    setError(rejected);
    if (accepted.length === 0) return;

    setDrafts((prev) => {
      const room = MAX_DRAFTS - prev.length;
      if (room <= 0) {
        setError(`Puedes preparar hasta ${MAX_DRAFTS} historias a la vez.`);
        accepted.forEach((d) => URL.revokeObjectURL(d.url));
        return prev;
      }
      accepted.slice(room).forEach((d) => URL.revokeObjectURL(d.url));
      setActiveIdx(prev.length);
      return [...prev, ...accepted.slice(0, room)];
    });
  }, []);

  // Pegar desde el portapapeles: una captura recién hecha se publica sin pasar
  // por el explorador de archivos.
  useEffect(() => {
    if (!open || publishing) return;
    const onPaste = (e: ClipboardEvent) => {
      const files = Array.from(e.clipboardData?.files ?? []);
      if (files.length > 0) addFiles(files);
    };
    window.addEventListener("paste", onPaste);
    return () => window.removeEventListener("paste", onPaste);
  }, [open, publishing, addFiles]);

  const discardDrafts = useCallback(() => {
    setDrafts((prev) => {
      prev.forEach((d) => URL.revokeObjectURL(d.url));
      return [];
    });
    setActiveIdx(0);
    setError(null);
    setProgress(0);
    setPublishedCount(0);
  }, []);

  const close = useCallback(() => {
    if (publishing) return;
    discardDrafts();
    onClose();
  }, [publishing, discardDrafts, onClose]);

  // Con el composer abierto la página de atrás no debe desplazarse, y Escape
  // cierra como en cualquier modal.
  useEffect(() => {
    if (!open) return;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
    };
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prevOverflow;
      window.removeEventListener("keydown", onKey);
    };
  }, [open, close]);

  function removeDraft(id: string) {
    setDrafts((prev) => {
      const idx = prev.findIndex((d) => d.id === id);
      if (idx === -1) return prev;
      URL.revokeObjectURL(prev[idx].url);
      const next = prev.filter((d) => d.id !== id);
      setActiveIdx((i) => Math.max(0, Math.min(i > idx ? i - 1 : i, next.length - 1)));
      return next;
    });
  }

  async function publishAll() {
    if (drafts.length === 0 || publishing) return;
    setPublishing(true);
    setError(null);
    setProgress(0);
    setPublishedCount(0);

    const total = drafts.length;
    let done = 0;

    for (const draft of drafts) {
      try {
        await uploadStory(draft.file, (pct) => {
          // Progreso global: lo ya publicado más lo que lleva el archivo actual.
          setProgress(Math.round(((done + pct / 100) / total) * 100));
        });
      } catch {
        // Lo ya subido se descarta de la cola para que reintentar no duplique.
        setDrafts((prev) => {
          prev.slice(0, done).forEach((d) => URL.revokeObjectURL(d.url));
          return prev.slice(done);
        });
        setActiveIdx(0);
        setPublishedCount(done);
        setPublishing(false);
        setError(
          done > 0
            ? `Se publicaron ${done} de ${total}. La siguiente falló, inténtalo de nuevo.`
            : "No se pudo publicar. Revisa tu conexión e inténtalo de nuevo.",
        );
        if (done > 0) onPublished?.(done);
        return;
      }
      done++;
      setPublishedCount(done);
      setProgress(Math.round((done / total) * 100));
    }

    discardDrafts();
    setPublishing(false);
    onPublished?.(total);
    onClose();
  }

  const publishLabel = useMemo(() => {
    if (!publishing) return drafts.length > 1 ? `Compartir ${drafts.length}` : "Compartir";
    return drafts.length > 1 ? `Publicando ${publishedCount + 1}/${drafts.length}` : "Publicando";
  }, [publishing, drafts.length, publishedCount]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[60] flex flex-col bg-black">
      <input
        ref={galleryRef}
        type="file"
        accept="image/*,video/*"
        multiple
        className="hidden"
        onChange={(e) => {
          addFiles(e.target.files);
          e.target.value = "";
        }}
      />
      {/* capture abre la cámara directamente en el teléfono */}
      <input
        ref={cameraRef}
        type="file"
        accept="image/*,video/*"
        capture="environment"
        className="hidden"
        onChange={(e) => {
          addFiles(e.target.files);
          e.target.value = "";
        }}
      />

      {drafts.length === 0 || !active ? (
        /* Paso 1 — de dónde sale el archivo */
        <div
          onDragOver={(e) => {
            e.preventDefault();
            setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragging(false);
            addFiles(e.dataTransfer.files);
          }}
          className="relative flex flex-1 flex-col"
        >
          <div className="absolute inset-0 bg-gradient-to-b from-fuchsia-900/25 via-black to-black" />

          <div className="relative flex items-center justify-between px-4 pt-4">
            <button
              type="button"
              onClick={close}
              aria-label="Cerrar"
              className="rounded-full bg-white/10 p-2 text-white backdrop-blur transition hover:bg-white/20"
            >
              <X className="h-5 w-5" />
            </button>
            <span className="text-sm font-semibold text-white/90">Nueva historia</span>
            <span className="w-9" />
          </div>

          <div className="relative flex flex-1 flex-col items-center justify-center gap-6 px-6">
            <div
              className={`flex h-32 w-32 items-center justify-center rounded-full border-2 border-dashed transition ${
                dragging
                  ? "border-fuchsia-400 bg-fuchsia-500/15"
                  : "border-white/20 bg-white/[0.04]"
              }`}
            >
              <ImagePlus className="h-10 w-10 text-white/60" />
            </div>
            <div className="text-center">
              <p className="text-base font-semibold text-white">Comparte una foto o un video</p>
              <p className="mt-1 text-xs text-white/45">
                Vertical se ve mejor · dura 20 días · máx 100 MB
              </p>
            </div>

            <div className="flex w-full max-w-xs flex-col gap-3">
              <button
                type="button"
                onClick={() => galleryRef.current?.click()}
                className="flex items-center justify-center gap-2 rounded-full bg-gradient-to-r from-fuchsia-600 to-violet-600 py-3.5 text-sm font-bold text-white shadow-[0_10px_30px_-10px_rgba(217,70,239,0.9)] transition hover:brightness-110"
              >
                <ImagePlus className="h-4 w-4" />
                Elegir de la galería
              </button>
              <button
                type="button"
                onClick={() => cameraRef.current?.click()}
                className="flex items-center justify-center gap-2 rounded-full border border-white/15 bg-white/[0.07] py-3.5 text-sm font-semibold text-white/85 transition hover:bg-white/[0.12]"
              >
                <Camera className="h-4 w-4" />
                Tomar una ahora
              </button>
            </div>

            <p className="text-[11px] text-white/30">
              También puedes arrastrar o pegar archivos aquí
            </p>
            {error && <p className="text-xs text-red-300">{error}</p>}
          </div>
        </div>
      ) : (
        /* Paso 2 — vista previa y publicación */
        <>
          {/* El fondo difuminado rellena las franjas de una foto que no es 9:16,
              así se ve completa sin recortarla ni dejar bandas negras. */}
          <div className="absolute inset-0 overflow-hidden">
            {!active.isVideo && (
              <img
                src={active.url}
                alt=""
                className="h-full w-full scale-110 object-cover opacity-35 blur-2xl"
              />
            )}
            <div className="absolute inset-0 bg-gradient-to-b from-black/70 via-black/40 to-black/85" />
          </div>

          <div className="relative flex items-center justify-between px-4 pt-4">
            <button
              type="button"
              onClick={close}
              disabled={publishing}
              aria-label="Cerrar"
              className="rounded-full bg-black/50 p-2 text-white backdrop-blur transition hover:bg-black/70 disabled:opacity-40"
            >
              <X className="h-5 w-5" />
            </button>
            <span className="text-sm font-semibold text-white/90">
              {drafts.length > 1 ? `${activeIdx + 1} de ${drafts.length}` : "Vista previa"}
            </span>
            <button
              type="button"
              onClick={() => removeDraft(active.id)}
              disabled={publishing}
              aria-label="Descartar esta"
              className="rounded-full bg-black/50 p-2 text-white/80 backdrop-blur transition hover:bg-black/70 hover:text-red-300 disabled:opacity-40"
            >
              <Trash2 className="h-5 w-5" />
            </button>
          </div>

          <div className="relative flex min-h-0 flex-1 items-center justify-center px-4 py-3">
            <div className="relative h-full max-h-full w-full max-w-[420px] overflow-hidden rounded-3xl">
              {active.isVideo ? (
                <video
                  key={active.id}
                  src={active.url}
                  className="h-full w-full object-contain"
                  controls
                  autoPlay
                  loop
                  muted
                  playsInline
                />
              ) : (
                <img
                  key={active.id}
                  src={active.url}
                  alt="Vista previa"
                  className="h-full w-full object-contain"
                />
              )}
            </div>
          </div>

          <div className="relative px-4 pb-6">
            {error && (
              <p className="mb-3 rounded-xl border border-red-500/25 bg-red-500/10 px-3 py-2 text-center text-xs text-red-200">
                {error}
              </p>
            )}

            {/* Tira de miniaturas cuando hay varias preparadas */}
            {drafts.length > 1 && (
              <div className="mb-3 flex gap-2 overflow-x-auto pb-1">
                {drafts.map((d, i) => (
                  <button
                    key={d.id}
                    type="button"
                    onClick={() => setActiveIdx(i)}
                    disabled={publishing}
                    className={`h-14 w-11 flex-shrink-0 overflow-hidden rounded-lg border-2 transition ${
                      i === activeIdx ? "border-fuchsia-400" : "border-white/15 opacity-60"
                    } disabled:opacity-40`}
                  >
                    {d.isVideo ? (
                      <video src={d.url} className="h-full w-full object-cover" muted playsInline />
                    ) : (
                      <img src={d.url} alt="" className="h-full w-full object-cover" />
                    )}
                  </button>
                ))}
                <button
                  type="button"
                  onClick={() => galleryRef.current?.click()}
                  disabled={publishing}
                  aria-label="Agregar más"
                  className="flex h-14 w-11 flex-shrink-0 items-center justify-center rounded-lg border-2 border-dashed border-white/20 text-white/50 transition hover:text-white disabled:opacity-40"
                >
                  <Plus className="h-4 w-4" />
                </button>
              </div>
            )}

            {publishing && (
              <div className="mb-3 h-1 overflow-hidden rounded-full bg-white/15">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-fuchsia-500 to-violet-500 transition-[width] duration-200"
                  style={{ width: `${progress}%` }}
                />
              </div>
            )}

            <div className="flex items-center gap-3">
              {drafts.length === 1 && (
                <button
                  type="button"
                  onClick={() => galleryRef.current?.click()}
                  disabled={publishing}
                  className="flex items-center gap-2 rounded-full border border-white/15 bg-white/[0.08] px-4 py-3 text-sm font-medium text-white/80 backdrop-blur transition hover:bg-white/[0.14] disabled:opacity-40"
                >
                  <Plus className="h-4 w-4" />
                  Agregar
                </button>
              )}
              <button
                type="button"
                onClick={publishAll}
                disabled={publishing}
                className="flex flex-1 items-center justify-center gap-2 rounded-full bg-gradient-to-r from-fuchsia-600 to-violet-600 py-3.5 text-sm font-bold text-white shadow-[0_10px_30px_-10px_rgba(217,70,239,0.9)] transition hover:brightness-110 disabled:opacity-60"
              >
                {publishing ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <ArrowRight className="h-4 w-4" />
                )}
                {publishLabel}
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
