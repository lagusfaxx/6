"use client";

import { useCallback, useEffect, useState } from "react";
import { apiFetch } from "../../lib/api";
import { Flame, Loader2, ChevronLeft, ChevronRight, Play, Eye } from "lucide-react";

type VideoItem = {
  title?: string;
  url?: string;
  thumbnail?: string;
  thumbnailUrl?: string;
  thumb?: string;
  duration?: string;
  views?: string | number;
  rating?: string | number;
  preview?: string;
};

export default function HotPage() {
  const [videos, setVideos] = useState<VideoItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);

  const loadVideos = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await apiFetch<any>(`/hot/trending?page=${page}`);
      const items: VideoItem[] = Array.isArray(res)
        ? res
        : Array.isArray(res?.data)
          ? res.data
          : Array.isArray(res?.videos)
            ? res.videos
            : Array.isArray(res?.results)
              ? res.results
              : [];
      setVideos(items);
    } catch {
      setError("No se pudieron cargar los videos.");
    } finally {
      setLoading(false);
    }
  }, [page]);

  useEffect(() => {
    loadVideos();
  }, [loadVideos]);

  function getThumb(v: VideoItem) {
    return v.thumbnail || v.thumbnailUrl || v.thumb || "";
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-6 text-white">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-red-500 to-orange-500">
          <Flame className="h-5 w-5 text-white" />
        </div>
        <div>
          <h1 className="text-2xl font-bold">Hot</h1>
          <p className="text-xs text-white/40">Contenido trending</p>
        </div>
      </div>

      {/* Age verification notice */}
      <div className="mb-6 rounded-xl border border-red-500/20 bg-red-500/5 px-4 py-3 text-xs text-red-200/70">
        Contenido exclusivo para mayores de 18 anos. Al acceder confirmas que eres mayor de edad.
      </div>

      {/* Content */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-red-400" />
        </div>
      ) : error ? (
        <div className="rounded-xl border border-red-500/20 bg-red-500/10 p-6 text-center text-sm text-red-200">
          {error}
          <button onClick={loadVideos} className="mt-3 block mx-auto rounded-lg border border-white/10 bg-white/5 px-4 py-2 text-xs hover:bg-white/10 transition">
            Reintentar
          </button>
        </div>
      ) : videos.length === 0 ? (
        <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-8 text-center text-sm text-white/40">
          No hay videos disponibles en este momento.
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {videos.map((video, idx) => {
            const thumb = getThumb(video);
            return (
              <a
                key={`${video.url || idx}`}
                href={video.url || "#"}
                target="_blank"
                rel="noopener noreferrer"
                className="group overflow-hidden rounded-xl border border-white/[0.08] bg-white/[0.03] transition hover:border-red-500/20 hover:-translate-y-0.5"
              >
                <div className="relative aspect-video bg-black/40 overflow-hidden">
                  {thumb ? (
                    <img
                      src={thumb}
                      alt={video.title || "Video"}
                      className="h-full w-full object-cover transition group-hover:scale-105"
                      loading="lazy"
                    />
                  ) : (
                    <div className="flex h-full items-center justify-center">
                      <Play className="h-8 w-8 text-white/20" />
                    </div>
                  )}
                  <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition bg-black/30">
                    <Play className="h-10 w-10 text-white/90 drop-shadow-lg" />
                  </div>
                  {video.duration && (
                    <span className="absolute bottom-1.5 right-1.5 rounded bg-black/70 px-1.5 py-0.5 text-[10px] font-medium text-white/90">
                      {video.duration}
                    </span>
                  )}
                </div>
                <div className="p-2.5">
                  <h3 className="text-xs font-medium text-white/80 line-clamp-2 leading-snug">
                    {video.title || "Sin titulo"}
                  </h3>
                  <div className="mt-1.5 flex items-center gap-2 text-[10px] text-white/40">
                    {video.views && (
                      <span className="flex items-center gap-0.5">
                        <Eye className="h-2.5 w-2.5" />
                        {typeof video.views === "number"
                          ? video.views.toLocaleString()
                          : video.views}
                      </span>
                    )}
                    {video.rating && (
                      <span>{video.rating}%</span>
                    )}
                  </div>
                </div>
              </a>
            );
          })}
        </div>
      )}

      {/* Pagination */}
      <div className="mt-6 flex items-center justify-center gap-3">
        <button
          disabled={page <= 1}
          onClick={() => setPage((p) => Math.max(1, p - 1))}
          className="flex h-9 items-center gap-1 rounded-lg border border-white/10 bg-white/5 px-4 text-xs text-white/70 hover:bg-white/10 transition disabled:opacity-30"
        >
          <ChevronLeft className="h-3.5 w-3.5" /> Anterior
        </button>
        <span className="text-xs text-white/40">Pagina {page}</span>
        <button
          onClick={() => setPage((p) => p + 1)}
          className="flex h-9 items-center gap-1 rounded-lg border border-white/10 bg-white/5 px-4 text-xs text-white/70 hover:bg-white/10 transition"
        >
          Siguiente <ChevronRight className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
}
