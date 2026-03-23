"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { Upload, Film, Image as ImageIcon, Trash2, Clock, X, Eye } from "lucide-react";
import { apiFetch, getApiBase, resolveMediaUrl } from "../../../lib/api";
import useMe from "../../../hooks/useMe";

type OwnStory = {
  id: string;
  mediaUrl: string;
  mediaType: "IMAGE" | "VIDEO";
  expiresAt: string;
  createdAt: string;
};

export default function StoriesPage() {
  const { me } = useMe();
  const fileRef = useRef<HTMLInputElement | null>(null);

  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [preview, setPreview] = useState<{ url: string; type: string } | null>(null);
  const [stories, setStories] = useState<OwnStory[]>([]);
  const [loadingStories, setLoadingStories] = useState(true);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [viewingStory, setViewingStory] = useState<OwnStory | null>(null);

  const loadMyStories = useCallback(async () => {
    try {
      const data = await apiFetch<{ stories: Array<{ userId: string; stories: OwnStory[] }> }>("/stories/active");
      const userId = me?.user?.id;
      const mine = data.stories.find((g) => g.userId === userId);
      setStories(mine?.stories ?? []);
    } catch {
      setStories([]);
    } finally {
      setLoadingStories(false);
    }
  }, [me?.user?.id]);

  useEffect(() => {
    if (me?.user?.id) loadMyStories();
  }, [me?.user?.id, loadMyStories]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const objectUrl = URL.createObjectURL(file);
    setPreview({ url: objectUrl, type: file.type });
    setError(null);
    setSuccess(false);
  };

  const handleUpload = async () => {
    if (!fileRef.current?.files?.[0]) return;
    const file = fileRef.current.files[0];
    const formData = new FormData();
    formData.append("file", file);
    setUploading(true);
    setError(null);
    setSuccess(false);
    try {
      const apiBase = getApiBase();
      const res = await fetch(`${apiBase}/stories/upload`, {
        method: "POST",
        credentials: "include",
        body: formData,
      });
      if (!res.ok) throw new Error("UPLOAD_FAILED");
      setSuccess(true);
      setPreview(null);
      if (fileRef.current) fileRef.current.value = "";
      loadMyStories();
    } catch {
      setError("No se pudo subir el story. Intenta nuevamente.");
    } finally {
      setUploading(false);
    }
  };

  const handleClearPreview = () => {
    setPreview(null);
    if (fileRef.current) fileRef.current.value = "";
  };

  const handleDelete = async (id: string) => {
    setDeletingId(id);
    try {
      await apiFetch(`/stories/${id}`, { method: "DELETE" });
      setStories((prev) => prev.filter((s) => s.id !== id));
      if (viewingStory?.id === id) setViewingStory(null);
    } catch {
      setError("No se pudo eliminar el story.");
    } finally {
      setDeletingId(null);
    }
  };

  const timeLeft = (expiresAt: string) => {
    const diff = new Date(expiresAt).getTime() - Date.now();
    if (diff <= 0) return "Expirado";
    const h = Math.floor(diff / (1000 * 60 * 60));
    const m = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    return `${h}h ${m}m`;
  };

  return (
    <div className="mx-auto max-w-lg px-4 py-6 space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-lg font-bold">Mis Stories</h1>
        <p className="text-xs text-white/40 mt-0.5">
          Sube fotos o videos que duran 24 horas y aparecen en el carrusel.
        </p>
      </div>

      {/* Upload area */}
      <div className="rounded-2xl border border-white/10 bg-white/[0.03] overflow-hidden">
        {!preview ? (
          /* Drop zone */
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            className="flex w-full flex-col items-center justify-center gap-3 p-10 transition hover:bg-fuchsia-500/5 group"
          >
            <div className="flex items-center gap-2 rounded-full bg-fuchsia-500/10 px-4 py-2 text-fuchsia-400 group-hover:bg-fuchsia-500/20 transition">
              <ImageIcon className="h-5 w-5" />
              <span className="text-xs font-medium">+</span>
              <Film className="h-5 w-5" />
            </div>
            <div className="text-center">
              <p className="text-sm text-white/60">Toca para elegir foto o video</p>
              <p className="text-[11px] text-white/30 mt-1">Máx 100 MB · Se verá en formato vertical 9:16</p>
            </div>
          </button>
        ) : (
          /* Preview — phone-style 9:16 so user sees exactly how it'll look */
          <div className="relative">
            <div className="relative mx-auto aspect-[9/16] max-h-[480px] bg-black overflow-hidden">
              {preview.type.startsWith("video/") ? (
                <video
                  src={preview.url}
                  className="h-full w-full object-cover"
                  controls
                  muted
                  playsInline
                />
              ) : (
                <img
                  src={preview.url}
                  alt="Vista previa"
                  className="h-full w-full object-cover"
                />
              )}
              {/* Phone-frame overlay hint */}
              <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/60 to-transparent px-4 pb-4 pt-10">
                <p className="text-[11px] text-white/50 text-center">
                  Así se verá tu story
                </p>
              </div>
            </div>
            {/* Clear preview */}
            <button
              type="button"
              onClick={handleClearPreview}
              className="absolute right-3 top-3 rounded-full bg-black/60 p-1.5 text-white/70 hover:text-white transition backdrop-blur-sm"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        )}

        <input
          ref={fileRef}
          type="file"
          accept="image/*,video/*"
          className="hidden"
          onChange={handleFileChange}
        />

        {/* Actions bar */}
        <div className="border-t border-white/[0.06] p-3 space-y-2">
          {error && <p className="text-xs text-red-400 px-1">{error}</p>}
          {success && (
            <p className="text-xs text-emerald-400 px-1">
              Story publicado. Dura 24 horas.
            </p>
          )}

          <div className="flex gap-2">
            {preview && (
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                className="flex-1 rounded-xl border border-white/10 bg-white/[0.04] py-2.5 text-xs font-medium text-white/60 hover:bg-white/[0.08] transition"
              >
                Cambiar archivo
              </button>
            )}
            <button
              type="button"
              onClick={preview ? handleUpload : () => fileRef.current?.click()}
              disabled={preview ? uploading : false}
              className="flex-1 flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-fuchsia-600 to-violet-600 py-2.5 text-xs font-semibold text-white disabled:opacity-40 hover:brightness-110 transition"
            >
              <Upload className="h-3.5 w-3.5" />
              {!preview ? "Elegir archivo" : uploading ? "Subiendo…" : "Publicar story"}
            </button>
          </div>
        </div>
      </div>

      {/* Active stories */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-white/70">Stories activos</h2>
          {stories.length > 0 && (
            <span className="text-[11px] text-white/30">{stories.length} publicado{stories.length !== 1 ? "s" : ""}</span>
          )}
        </div>

        {loadingStories ? (
          <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-6 text-center text-xs text-white/30">
            Cargando…
          </div>
        ) : stories.length === 0 ? (
          <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-6 text-center text-xs text-white/30">
            No tienes stories activos. ¡Sube uno arriba!
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3">
            {stories.map((s) => (
              <div
                key={s.id}
                className="group relative overflow-hidden rounded-2xl border border-white/10 bg-black"
              >
                {/* Thumbnail */}
                <div className="aspect-[9/16] max-h-[260px]">
                  {s.mediaType === "VIDEO" ? (
                    <video
                      src={resolveMediaUrl(s.mediaUrl) ?? undefined}
                      className="h-full w-full object-cover"
                      muted
                      playsInline
                    />
                  ) : (
                    <img
                      src={resolveMediaUrl(s.mediaUrl) ?? undefined}
                      alt=""
                      className="h-full w-full object-cover"
                    />
                  )}
                </div>

                {/* Overlay info */}
                <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent px-3 pb-3 pt-8">
                  <div className="flex items-center gap-1 text-[11px] text-white/60">
                    {s.mediaType === "VIDEO" ? <Film className="h-3 w-3" /> : <ImageIcon className="h-3 w-3" />}
                    <span>{s.mediaType === "VIDEO" ? "Video" : "Foto"}</span>
                  </div>
                  <div className="flex items-center gap-1 mt-0.5 text-[10px] text-white/40">
                    <Clock className="h-2.5 w-2.5" />
                    <span>{timeLeft(s.expiresAt)}</span>
                  </div>
                </div>

                {/* Type badge */}
                {s.mediaType === "VIDEO" && (
                  <div className="absolute left-2 top-2 rounded-full bg-black/50 px-2 py-0.5 text-[10px] text-white/70 backdrop-blur-sm">
                    ▶ Video
                  </div>
                )}

                {/* Action buttons — visible on hover / always on mobile */}
                <div className="absolute right-2 top-2 flex gap-1.5 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
                  <button
                    type="button"
                    onClick={() => setViewingStory(s)}
                    className="rounded-full bg-black/50 p-1.5 text-white/70 hover:text-white backdrop-blur-sm transition"
                    title="Ver"
                  >
                    <Eye className="h-3.5 w-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDelete(s.id)}
                    disabled={deletingId === s.id}
                    className="rounded-full bg-black/50 p-1.5 text-red-400 hover:text-red-300 backdrop-blur-sm transition disabled:opacity-50"
                    title="Borrar"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Full-screen story viewer */}
      {viewingStory && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 backdrop-blur-sm">
          <button
            type="button"
            onClick={() => setViewingStory(null)}
            className="absolute right-4 top-4 z-10 rounded-full bg-white/10 p-2 text-white hover:bg-white/20 transition"
          >
            <X className="h-5 w-5" />
          </button>
          <div className="relative mx-auto aspect-[9/16] max-h-[90vh] max-w-sm overflow-hidden rounded-2xl bg-black">
            {viewingStory.mediaType === "VIDEO" ? (
              <video
                src={resolveMediaUrl(viewingStory.mediaUrl) ?? undefined}
                className="h-full w-full object-cover"
                controls
                autoPlay
                playsInline
              />
            ) : (
              <img
                src={resolveMediaUrl(viewingStory.mediaUrl) ?? undefined}
                alt=""
                className="h-full w-full object-cover"
              />
            )}
            {/* Bottom bar with delete */}
            <div className="absolute inset-x-0 bottom-0 flex items-center justify-between bg-gradient-to-t from-black/80 to-transparent px-4 pb-4 pt-10">
              <div className="text-[11px] text-white/50">
                <Clock className="mr-1 inline h-3 w-3" />
                {timeLeft(viewingStory.expiresAt)}
              </div>
              <button
                type="button"
                onClick={() => handleDelete(viewingStory.id)}
                disabled={deletingId === viewingStory.id}
                className="flex items-center gap-1.5 rounded-full bg-red-500/20 px-3 py-1.5 text-xs font-medium text-red-400 hover:bg-red-500/30 transition disabled:opacity-50"
              >
                <Trash2 className="h-3.5 w-3.5" />
                Borrar story
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
