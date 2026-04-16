"use client";

import { useEffect, useState, useCallback } from "react";
import { Film, Image as ImageIcon, Trash2, Clock, X, Eye, Plus, ArrowLeft } from "lucide-react";
import Link from "next/link";
import { apiFetch, resolveMediaUrl } from "../../../lib/api";
import useMe from "../../../hooks/useMe";
import { useStoryUpload } from "../../../components/StoryUploadContext";

type OwnStory = {
  id: string;
  mediaUrl: string;
  mediaType: "IMAGE" | "VIDEO";
  expiresAt: string;
  createdAt: string;
};

export default function StoriesPage() {
  const { me } = useMe();
  const storyUpload = useStoryUpload();

  const [stories, setStories] = useState<OwnStory[]>([]);
  const [loadingStories, setLoadingStories] = useState(true);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [viewingStory, setViewingStory] = useState<OwnStory | null>(null);
  const [error, setError] = useState<string | null>(null);

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

  useEffect(() => {
    if (!storyUpload.isOpen) {
      loadMyStories();
    }
  }, [storyUpload.isOpen, loadMyStories]);

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
    const d = Math.floor(diff / (1000 * 60 * 60 * 24));
    const h = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    if (d > 0) return `${d}d ${h}h`;
    const m = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    return `${h}h ${m}m`;
  };

  return (
    <div className="mx-auto max-w-lg px-4 py-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link
            href="/"
            className="flex h-8 w-8 items-center justify-center rounded-xl border border-white/10 bg-white/[0.04] text-white/60 hover:bg-white/10 transition"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
          </Link>
          <div>
            <h1 className="text-lg font-bold">Mis Stories</h1>
            <p className="text-xs text-white/40 mt-0.5">
              Tus stories activos · Duran 7 días
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => storyUpload.open()}
          className="flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-fuchsia-600 to-violet-600 px-4 py-2.5 text-xs font-semibold text-white hover:brightness-110 transition"
        >
          <Plus className="h-3.5 w-3.5" />
          Nueva
        </button>
      </div>

      {error && (
        <p className="rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-2 text-xs text-red-400">{error}</p>
      )}

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
          <button
            type="button"
            onClick={() => storyUpload.open()}
            className="w-full rounded-2xl border-2 border-dashed border-white/10 bg-white/[0.02] p-10 text-center transition hover:border-fuchsia-500/30 hover:bg-fuchsia-500/[0.03] group"
          >
            <div className="flex flex-col items-center gap-3">
              <div className="flex items-center gap-2 rounded-full bg-fuchsia-500/10 px-4 py-2 group-hover:bg-fuchsia-500/20 transition">
                <ImageIcon className="h-5 w-5 text-fuchsia-400" />
                <span className="text-sm font-medium text-fuchsia-300">+</span>
                <Film className="h-5 w-5 text-fuchsia-400" />
              </div>
              <div>
                <p className="text-sm text-white/60">No tienes stories activos</p>
                <p className="text-[11px] text-white/30 mt-1">Toca para subir tu primera story</p>
              </div>
            </div>
          </button>
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

                {/* Action buttons */}
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
