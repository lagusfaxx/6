"use client";

import { useCallback, useEffect, useState } from "react";
import { Check, Clock, Loader2, Plus, Trash2, X } from "lucide-react";
import { apiFetch, resolveMediaUrl } from "../../../lib/api";
import useMe from "../../../hooks/useMe";
import StoryComposer from "../../../components/StoryComposer";

type OwnStory = {
  id: string;
  mediaUrl: string;
  mediaType: "IMAGE" | "VIDEO";
  expiresAt: string;
  createdAt: string;
};

function timeLeft(expiresAt: string): string {
  const diff = new Date(expiresAt).getTime() - Date.now();
  if (diff <= 0) return "Expirada";
  const days = Math.floor(diff / 86400000);
  const hours = Math.floor((diff % 86400000) / 3600000);
  if (days > 0) return `${days}d ${hours}h`;
  const mins = Math.floor((diff % 3600000) / 60000);
  return `${hours}h ${mins}m`;
}

export default function StoriesPage() {
  const { me } = useMe();

  const [stories, setStories] = useState<OwnStory[]>([]);
  const [loading, setLoading] = useState(true);
  const [composerOpen, setComposerOpen] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [viewing, setViewing] = useState<OwnStory | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const loadMyStories = useCallback(async () => {
    try {
      const data = await apiFetch<{ stories: Array<{ userId: string; stories: OwnStory[] }> }>(
        "/stories/active",
      );
      const mine = data.stories.find((g) => g.userId === me?.user?.id);
      setStories(mine?.stories ?? []);
    } catch {
      setStories([]);
    } finally {
      setLoading(false);
    }
  }, [me?.user?.id]);

  useEffect(() => {
    if (me?.user?.id) loadMyStories();
  }, [me?.user?.id, loadMyStories]);

  // Los accesos directos de "Subir historia" del menú llegan con ?nueva=1 para
  // que el composer se abra solo y publicar siga siendo un único toque.
  useEffect(() => {
    if (new URLSearchParams(window.location.search).has("nueva")) setComposerOpen(true);
  }, []);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 3000);
    return () => clearTimeout(t);
  }, [toast]);

  async function handleDelete(id: string) {
    setDeletingId(id);
    try {
      await apiFetch(`/stories/${id}`, { method: "DELETE" });
      setStories((prev) => prev.filter((s) => s.id !== id));
      if (viewing?.id === id) setViewing(null);
      setToast("Historia eliminada");
    } catch {
      setToast("No se pudo eliminar");
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <div className="mx-auto max-w-lg px-4 py-6">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-lg font-bold">Tus historias</h1>
          <p className="mt-0.5 text-xs text-white/40">
            Fotos y videos verticales que duran 20 días en el carrusel del inicio.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setComposerOpen(true)}
          className="flex shrink-0 items-center gap-1.5 rounded-full bg-gradient-to-r from-fuchsia-600 to-violet-600 px-4 py-2.5 text-xs font-bold text-white shadow-[0_10px_30px_-12px_rgba(217,70,239,0.9)] transition hover:brightness-110"
        >
          <Plus className="h-4 w-4" />
          Nueva
        </button>
      </div>

      {loading ? (
        <div className="mt-6 grid grid-cols-3 gap-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="aspect-[9/16] animate-pulse rounded-2xl bg-white/[0.04]" />
          ))}
        </div>
      ) : stories.length === 0 ? (
        <button
          type="button"
          onClick={() => setComposerOpen(true)}
          className="mt-6 flex w-full flex-col items-center gap-3 rounded-3xl border border-dashed border-white/15 bg-white/[0.02] p-10 transition hover:border-fuchsia-500/40 hover:bg-fuchsia-500/[0.04]"
        >
          <span className="flex h-14 w-14 items-center justify-center rounded-full bg-fuchsia-500/15 text-fuchsia-300">
            <Plus className="h-6 w-6" />
          </span>
          <span className="text-sm font-medium text-white/70">Publica tu primera historia</span>
          <span className="text-[11px] text-white/35">Foto o video · máx 100 MB</span>
        </button>
      ) : (
        <div className="mt-6 grid grid-cols-3 gap-3">
          {stories.map((s) => (
            <button
              key={s.id}
              type="button"
              onClick={() => setViewing(s)}
              className="relative aspect-[9/16] overflow-hidden rounded-2xl border border-white/10 bg-black"
            >
              {s.mediaType === "VIDEO" ? (
                <video
                  src={resolveMediaUrl(s.mediaUrl) ?? undefined}
                  className="h-full w-full object-cover"
                  muted
                  playsInline
                  preload="metadata"
                />
              ) : (
                <img
                  src={resolveMediaUrl(s.mediaUrl) ?? undefined}
                  alt=""
                  className="h-full w-full object-cover"
                  loading="lazy"
                />
              )}
              {s.mediaType === "VIDEO" && (
                <span className="absolute left-2 top-2 rounded-full bg-black/60 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-white/85">
                  Video
                </span>
              )}
              <span className="absolute inset-x-0 bottom-0 flex items-center gap-1 bg-gradient-to-t from-black/85 to-transparent px-2 pb-2 pt-6 text-[10px] text-white/70">
                <Clock className="h-2.5 w-2.5" />
                {timeLeft(s.expiresAt)}
              </span>
            </button>
          ))}
        </div>
      )}

      <StoryComposer
        open={composerOpen}
        onClose={() => setComposerOpen(false)}
        onPublished={(count) => {
          setToast(count === 1 ? "Historia publicada" : `${count} historias publicadas`);
          loadMyStories();
        }}
      />

      {/* Visor de una historia propia */}
      {viewing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/95 backdrop-blur-sm">
          <button
            type="button"
            onClick={() => setViewing(null)}
            aria-label="Cerrar"
            className="absolute right-4 top-4 z-10 rounded-full bg-white/10 p-2 text-white transition hover:bg-white/20"
          >
            <X className="h-5 w-5" />
          </button>
          <div className="relative mx-auto aspect-[9/16] max-h-[90vh] w-full max-w-sm overflow-hidden rounded-3xl bg-black">
            {viewing.mediaType === "VIDEO" ? (
              <video
                src={resolveMediaUrl(viewing.mediaUrl) ?? undefined}
                className="h-full w-full object-contain"
                controls
                autoPlay
                playsInline
              />
            ) : (
              <img
                src={resolveMediaUrl(viewing.mediaUrl) ?? undefined}
                alt=""
                className="h-full w-full object-contain"
              />
            )}
            <div className="absolute inset-x-0 bottom-0 flex items-center justify-between bg-gradient-to-t from-black/85 to-transparent px-4 pb-4 pt-10">
              <span className="flex items-center gap-1 text-[11px] text-white/60">
                <Clock className="h-3 w-3" />
                {timeLeft(viewing.expiresAt)}
              </span>
              <button
                type="button"
                onClick={() => handleDelete(viewing.id)}
                disabled={deletingId === viewing.id}
                className="flex items-center gap-1.5 rounded-full bg-red-500/20 px-3 py-1.5 text-xs font-medium text-red-300 transition hover:bg-red-500/30 disabled:opacity-50"
              >
                {deletingId === viewing.id ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Trash2 className="h-3.5 w-3.5" />
                )}
                Eliminar
              </button>
            </div>
          </div>
        </div>
      )}

      {toast && (
        <div className="fixed bottom-24 left-1/2 z-[70] -translate-x-1/2 rounded-full border border-white/15 bg-black/85 px-4 py-2 text-xs font-medium text-white shadow-lg backdrop-blur">
          <Check className="mr-1.5 inline h-3.5 w-3.5 text-emerald-400" />
          {toast}
        </div>
      )}
    </div>
  );
}
