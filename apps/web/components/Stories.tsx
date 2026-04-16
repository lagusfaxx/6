"use client";

import { useCallback, useContext, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { X, ChevronLeft, ChevronRight, Plus, Volume2, VolumeX, MessageCircle, Radio, Upload, Image as ImageIcon, Film, CheckCircle } from "lucide-react";
import { LocationFilterContext } from "../hooks/useLocationFilter";
import { apiFetch, getApiBase, resolveMediaUrl } from "../lib/api";
import useMe from "../hooks/useMe";

/* ─── Types ─────────────────────────────────────────────── */
type StoryItem = {
  id: string;
  mediaUrl: string;
  mediaType: "IMAGE" | "VIDEO";
  expiresAt: string;
  createdAt: string;
};

type StoryGroup = {
  userId: string;
  username: string;
  displayName: string;
  avatarUrl: string | null;
  profileHref: string;
  stories: StoryItem[];
};

type LiveStreamItem = {
  id: string;
  title: string | null;
  viewerCount: number;
  host: { id: string; displayName: string; username: string; avatarUrl: string | null };
};

const STORY_DURATION_MS = 5000;

/* ─── StoryViewer ───────────────────────────────────────── */
function StoryViewer({
  groups,
  initialGroupIndex,
  onClose,
}: {
  groups: StoryGroup[];
  initialGroupIndex: number;
  onClose: () => void;
}) {
  const [groupIdx, setGroupIdx] = useState(initialGroupIndex);
  const [storyIdx, setStoryIdx] = useState(0);
  const [progress, setProgress] = useState(0);
  const [muted, setMuted] = useState(true);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const startTimeRef = useRef<number>(Date.now());

  const group = groups[groupIdx];
  const story = group?.stories[storyIdx];
  const isVideo = story?.mediaType === "VIDEO";
  const totalStories = group?.stories.length ?? 0;

  const goNext = useCallback(() => {
    if (storyIdx < totalStories - 1) {
      setStoryIdx((i) => i + 1);
      setProgress(0);
    } else if (groupIdx < groups.length - 1) {
      setGroupIdx((g) => g + 1);
      setStoryIdx(0);
      setProgress(0);
    } else {
      onClose();
    }
  }, [storyIdx, totalStories, groupIdx, groups.length, onClose]);

  const goPrev = useCallback(() => {
    if (storyIdx > 0) {
      setStoryIdx((i) => i - 1);
      setProgress(0);
    } else if (groupIdx > 0) {
      const prevGroup = groups[groupIdx - 1];
      setGroupIdx((g) => g - 1);
      setStoryIdx(prevGroup.stories.length - 1);
      setProgress(0);
    }
  }, [storyIdx, groupIdx, groups]);

  useEffect(() => {
    if (isVideo) return;
    setProgress(0);
    startTimeRef.current = Date.now();
    timerRef.current = setInterval(() => {
      const elapsed = Date.now() - startTimeRef.current;
      const pct = Math.min(100, (elapsed / STORY_DURATION_MS) * 100);
      setProgress(pct);
      if (pct >= 100) {
        if (timerRef.current) clearInterval(timerRef.current);
        goNext();
      }
    }, 50);
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [storyIdx, groupIdx, isVideo, goNext]);

  useEffect(() => {
    if (!isVideo || !videoRef.current) return;
    const vid = videoRef.current;
    const handleEnded = () => goNext();
    const handleTimeUpdate = () => {
      if (vid.duration) setProgress((vid.currentTime / vid.duration) * 100);
    };
    vid.addEventListener("ended", handleEnded);
    vid.addEventListener("timeupdate", handleTimeUpdate);
    vid.muted = muted;
    vid.play().catch(() => {});
    return () => {
      vid.removeEventListener("ended", handleEnded);
      vid.removeEventListener("timeupdate", handleTimeUpdate);
    };
  }, [storyIdx, groupIdx, isVideo, muted, goNext]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      else if (e.key === "ArrowRight") goNext();
      else if (e.key === "ArrowLeft") goPrev();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [goNext, goPrev, onClose]);

  if (!group || !story) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 backdrop-blur-sm">
      <button
        onClick={onClose}
        className="absolute top-4 right-4 z-50 rounded-full bg-black/60 p-2 text-white hover:bg-black/80 transition"
      >
        <X className="h-5 w-5" />
      </button>

      <div className="relative mx-auto h-[90vh] max-h-[700px] w-full max-w-sm overflow-hidden rounded-2xl bg-black shadow-2xl">
        {/* Progress bars */}
        <div className="absolute top-2 left-2 right-2 z-20 flex gap-1">
          {group.stories.map((_, i) => (
            <div key={i} className="h-0.5 flex-1 rounded-full bg-white/20 overflow-hidden">
              <div
                className="h-full bg-white transition-none"
                style={{
                  width: i < storyIdx ? "100%" : i === storyIdx ? `${progress}%` : "0%",
                }}
              />
            </div>
          ))}
        </div>

        {/* Author */}
        <div className="absolute top-6 left-3 right-3 z-20 flex items-center gap-2">
          {group.avatarUrl ? (
            <img
              src={resolveMediaUrl(group.avatarUrl) ?? undefined}
              alt={group.displayName}
              className="h-9 w-9 rounded-full object-cover border-2 border-white/30"
              decoding="async"
            />
          ) : (
            <div className="h-9 w-9 rounded-full bg-fuchsia-600 flex items-center justify-center text-white text-sm font-bold">
              {group.displayName[0]?.toUpperCase()}
            </div>
          )}
          <div>
            <p className="text-sm font-semibold text-white">{group.displayName}</p>
            <p className="text-[10px] text-white/50">
              {new Date(story.createdAt).toLocaleTimeString("es-CL", { hour: "2-digit", minute: "2-digit" })}
            </p>
          </div>
          {isVideo && (
            <button
              onClick={() => setMuted((v) => !v)}
              className="ml-auto rounded-full bg-black/40 p-1.5 text-white"
            >
              {muted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
            </button>
          )}
        </div>

        {/* Media */}
        {isVideo ? (
          <video
            ref={videoRef}
            key={`${groupIdx}-${storyIdx}`}
            src={resolveMediaUrl(story.mediaUrl) ?? undefined}
            className="h-full w-full object-cover"
            muted={muted}
            playsInline
            autoPlay
          />
        ) : (
          <img
            key={`${groupIdx}-${storyIdx}`}
            src={resolveMediaUrl(story.mediaUrl) ?? undefined}
            alt=""
            className="h-full w-full object-cover"
            decoding="async"
          />
        )}

        {/* Tap zones */}
        <button onClick={goPrev} className="absolute left-0 top-0 h-full w-1/3 z-10" aria-label="Anterior" />
        <button onClick={goNext} className="absolute right-0 top-0 h-full w-1/3 z-10" aria-label="Siguiente" />

        {/* Bottom CTAs - Conversion focused */}
        <div className="absolute bottom-0 left-0 right-0 z-20 p-4 bg-gradient-to-t from-black/80 to-transparent">
          <div className="flex gap-2">
            <Link
              href={`/chat/${group.userId}`}
              onClick={onClose}
              className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-fuchsia-600 to-violet-600 py-2.5 text-sm font-semibold text-white hover:brightness-110 transition shadow-[0_8px_20px_rgba(168,85,247,0.3)]"
            >
              <MessageCircle className="h-4 w-4" />
              Enviar mensaje
            </Link>
            <Link
              href={group.profileHref}
              onClick={onClose}
              className="flex items-center justify-center rounded-xl bg-white/10 border border-white/20 backdrop-blur px-4 py-2.5 text-sm font-semibold text-white hover:bg-white/20 transition"
            >
              Ver perfil
            </Link>
          </div>
        </div>

        {/* Desktop side arrows */}
        {groupIdx > 0 && (
          <button
            onClick={(e) => { e.stopPropagation(); setGroupIdx((g) => g - 1); setStoryIdx(0); setProgress(0); }}
            className="absolute -left-14 top-1/2 -translate-y-1/2 hidden sm:flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-white hover:bg-white/20 transition"
          >
            <ChevronLeft className="h-5 w-5" />
          </button>
        )}
        {groupIdx < groups.length - 1 && (
          <button
            onClick={(e) => { e.stopPropagation(); setGroupIdx((g) => g + 1); setStoryIdx(0); setProgress(0); }}
            className="absolute -right-14 top-1/2 -translate-y-1/2 hidden sm:flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-white hover:bg-white/20 transition"
          >
            <ChevronRight className="h-5 w-5" />
          </button>
        )}
      </div>
    </div>
  );
}

/* ─── Quick-upload modal (Instagram-style) ─────────────── */
function StoryUploadModal({ onClose, onUploaded }: { onClose: () => void; onUploaded: () => void }) {
  const fileRef = useRef<HTMLInputElement | null>(null);
  const [preview, setPreview] = useState<{ url: string; type: string } | null>(null);
  const [uploading, setUploading] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // auto-open picker immediately
    fileRef.current?.click();
  }, []);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose]);

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) { onClose(); return; }
    setPreview({ url: URL.createObjectURL(file), type: file.type });
    setError(null);
  };

  const handleUpload = async () => {
    if (!fileRef.current?.files?.[0]) return;
    setUploading(true);
    setError(null);
    const formData = new FormData();
    formData.append("file", fileRef.current.files[0]);
    try {
      const res = await fetch(`${getApiBase()}/stories/upload`, {
        method: "POST",
        credentials: "include",
        body: formData,
      });
      if (!res.ok) throw new Error();
      setDone(true);
      onUploaded();
      setTimeout(onClose, 1400);
    } catch {
      setError("No se pudo subir. Intenta de nuevo.");
      setUploading(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 backdrop-blur-sm p-4"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="relative w-full max-w-xs">
        {/* Close */}
        <button
          onClick={onClose}
          className="absolute -top-10 right-0 z-10 rounded-full bg-white/10 p-2 text-white hover:bg-white/20 transition"
        >
          <X className="h-5 w-5" />
        </button>

        {done ? (
          /* ── Success state ── */
          <div className="flex flex-col items-center justify-center gap-3 rounded-2xl bg-white/5 border border-white/10 py-14">
            <CheckCircle className="h-12 w-12 text-emerald-400" />
            <p className="text-sm font-semibold text-white">¡Story publicado!</p>
            <p className="text-xs text-white/40">Dura 7 días en el carrusel</p>
          </div>
        ) : !preview ? (
          /* ── Empty picker state ── */
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            className="flex w-full flex-col items-center justify-center gap-4 rounded-2xl border-2 border-dashed border-fuchsia-500/40 bg-fuchsia-500/5 py-16 hover:border-fuchsia-400/60 hover:bg-fuchsia-500/10 transition"
          >
            <div className="flex items-center gap-2 rounded-full bg-fuchsia-500/15 px-5 py-2.5 text-fuchsia-400">
              <ImageIcon className="h-5 w-5" />
              <span className="text-sm font-semibold">+</span>
              <Film className="h-5 w-5" />
            </div>
            <div className="text-center space-y-1">
              <p className="text-sm font-medium text-white/80">Elegir foto o video</p>
              <p className="text-[11px] text-white/30">Máx 100 MB · Formato vertical 9:16</p>
            </div>
          </button>
        ) : (
          /* ── Preview + publish ── */
          <div className="rounded-2xl overflow-hidden border border-white/10 bg-black">
            <div className="relative mx-auto aspect-[9/16] max-h-[72vh] overflow-hidden">
              {preview.type.startsWith("video/") ? (
                <video src={preview.url} className="h-full w-full object-cover" muted controls playsInline />
              ) : (
                <img src={preview.url} alt="Vista previa" className="h-full w-full object-cover" />
              )}
              <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/60 to-transparent px-4 pb-3 pt-10">
                <p className="text-[11px] text-white/50 text-center">Así se verá tu story</p>
              </div>
              <button
                type="button"
                onClick={() => { setPreview(null); if (fileRef.current) fileRef.current.value = ""; }}
                className="absolute right-2 top-2 rounded-full bg-black/60 p-1.5 text-white/70 hover:text-white transition backdrop-blur-sm"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="p-3 space-y-2">
              {error && <p className="text-xs text-red-400 px-1">{error}</p>}
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => fileRef.current?.click()}
                  className="flex-1 rounded-xl border border-white/10 bg-white/[0.04] py-2.5 text-xs font-medium text-white/60 hover:bg-white/[0.08] transition"
                >
                  Cambiar
                </button>
                <button
                  type="button"
                  onClick={handleUpload}
                  disabled={uploading}
                  className="flex-1 flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-fuchsia-600 to-violet-600 py-2.5 text-xs font-semibold text-white disabled:opacity-40 hover:brightness-110 transition"
                >
                  <Upload className="h-3.5 w-3.5" />
                  {uploading ? "Subiendo…" : "Publicar"}
                </button>
              </div>
            </div>
          </div>
        )}

        <input ref={fileRef} type="file" accept="image/*,video/*" className="hidden" onChange={handleFile} />
      </div>
    </div>
  );
}

/* ─── Stories row ───────────────────────────────────────── */
export default function Stories() {
  const locationCtx = useContext(LocationFilterContext);
  const effectiveLoc = locationCtx?.effectiveLocation ?? null;
  const router = useRouter();
  const { me } = useMe();

  const isProfessional = (me?.user?.profileType ?? "").toUpperCase() === "PROFESSIONAL";
  const canUpload = isProfessional;

  const [groups, setGroups] = useState<StoryGroup[]>([]);
  const [liveStreams, setLiveStreams] = useState<LiveStreamItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [viewerGroupIdx, setViewerGroupIdx] = useState<number | null>(null);
  const [showUploadModal, setShowUploadModal] = useState(false);

  const reloadStories = useCallback(() => {
    apiFetch<{ stories: StoryGroup[] }>("/stories/active")
      .then((d) => setGroups(d.stories ?? []))
      .catch(() => {});
  }, []);

  useEffect(() => {
    let done = 0;
    const checkDone = () => { done++; if (done >= 2) setLoading(false); };

    apiFetch<{ stories: StoryGroup[] }>("/stories/active")
      .then((d) => setGroups(d.stories ?? []))
      .catch(() => setGroups([]))
      .finally(checkDone);

    apiFetch<{ streams: LiveStreamItem[] }>("/live/active")
      .then((d) => setLiveStreams(d.streams ?? []))
      .catch(() => setLiveStreams([]))
      .finally(checkDone);
  }, []);

  const handleGoLive = () => {
    // Navigate to the live panel — the professional starts from there
    router.push("/live");
  };

  if (loading) {
    return (
      <div>
        <div className="mb-2 flex items-center gap-2">
          <div className="h-4 w-4 rounded bg-white/5 animate-pulse" />
          <div className="h-3 w-20 rounded bg-white/5 animate-pulse" />
        </div>
        <div className="flex gap-4 overflow-x-auto scrollbar-hide">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="flex-shrink-0 flex flex-col items-center gap-2">
              <div className="h-16 w-16 rounded-full bg-white/5 animate-pulse" />
              <div className="h-2 w-12 rounded bg-white/5 animate-pulse" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  const totalActive = groups.length + liveStreams.length;
  if (totalActive === 0 && !canUpload) return null;

  return (
    <>
      <div className="mb-2 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold text-white/90">Historias</span>
          {totalActive > 0 && (
            <span className="rounded-full bg-fuchsia-500/15 border border-fuchsia-500/20 px-2 py-0.5 text-[10px] font-medium text-fuchsia-300">
              {totalActive} activas
            </span>
          )}
          {liveStreams.length > 0 && (
            <span className="rounded-full bg-red-500/15 border border-red-500/20 px-2 py-0.5 text-[10px] font-bold text-red-300 flex items-center gap-1">
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-red-400" />
              {liveStreams.length} en vivo
            </span>
          )}
        </div>
        <div className="flex items-center gap-3">
          {isProfessional && (
            <button
              onClick={handleGoLive}
              className="flex items-center gap-1 text-[11px] text-red-400 hover:text-red-300 transition font-medium"
            >
              <Radio className="h-3 w-3" />
              Ir en vivo
            </button>
          )}
          {isProfessional && (
            <button
              onClick={() => setShowUploadModal(true)}
              className="text-[11px] text-fuchsia-400 hover:text-fuchsia-300 transition font-medium"
            >
              + Subir story
            </button>
          )}
        </div>
      </div>

      <div className="flex gap-4 overflow-x-auto scrollbar-hide pb-1">
        {/* Go Live button for professionals — navigates to live panel */}
        {isProfessional && (
          <div className="flex-shrink-0 flex flex-col items-center gap-2">
            <button
              onClick={handleGoLive}
              className="relative h-16 w-16 rounded-full border-2 border-dashed border-red-500/50 bg-red-500/5 flex items-center justify-center text-red-400 hover:border-red-400 hover:bg-red-500/10 transition hover:shadow-[0_0_20px_rgba(239,68,68,0.25)]"
            >
              <Radio className="h-6 w-6" />
            </button>
            <span className="text-[11px] text-red-300/60 font-medium">En vivo</span>
          </div>
        )}

        {/* Upload story button for professionals */}
        {canUpload && (
          <div className="flex-shrink-0 flex flex-col items-center gap-2">
            <button
              onClick={() => setShowUploadModal(true)}
              className="relative h-16 w-16 rounded-full border-2 border-dashed border-fuchsia-500/50 bg-fuchsia-500/5 flex items-center justify-center text-fuchsia-400 hover:border-fuchsia-400 hover:bg-fuchsia-500/10 transition hover:shadow-[0_0_20px_rgba(168,85,247,0.25)]"
            >
              <Plus className="h-6 w-6" />
            </button>
            <span className="text-[11px] text-fuchsia-300/60 font-medium">Tu story</span>
          </div>
        )}

        {/* Active live streams — shown first with red ring */}
        {liveStreams.map((s) => (
          <Link
            key={`live-${s.id}`}
            href={`/live/${s.id}`}
            className="flex-shrink-0 flex flex-col items-center gap-2 group"
          >
            <div className="relative h-16 w-16 rounded-full p-[3px] bg-gradient-to-tr from-red-600 via-red-500 to-orange-500 group-hover:shadow-[0_0_20px_rgba(239,68,68,0.5)] transition-shadow">
              <div className="h-full w-full rounded-full overflow-hidden bg-[#111] border-2 border-[#08090f]">
                {s.host.avatarUrl ? (
                  <img
                    src={resolveMediaUrl(s.host.avatarUrl) ?? undefined}
                    alt={s.host.displayName}
                    className="h-full w-full object-cover"
                    loading="lazy"
                    decoding="async"
                  />
                ) : (
                  <div className="h-full w-full flex items-center justify-center text-xl font-bold text-white bg-gradient-to-br from-red-700/50 to-orange-700/50">
                    {s.host.displayName[0]?.toUpperCase()}
                  </div>
                )}
              </div>
              <span className="absolute bottom-0 right-0 flex items-center gap-0.5 rounded-full bg-red-600 px-1.5 py-0.5 text-[8px] font-bold text-white shadow-lg border border-[#08090f]">
                <span className="h-1 w-1 animate-pulse rounded-full bg-white" />
                LIVE
              </span>
            </div>
            <span className="max-w-[72px] truncate text-[11px] text-white/60 font-medium group-hover:text-white/80 transition">
              {s.host.displayName.split(" ")[0]}
            </span>
          </Link>
        ))}

        {/* Stories */}
        {groups.map((g, i) => (
          <button
            key={g.userId}
            onClick={() => setViewerGroupIdx(i)}
            className="flex-shrink-0 flex flex-col items-center gap-2 group"
          >
            <div className="relative h-16 w-16 rounded-full p-[3px] bg-gradient-to-tr from-fuchsia-600 via-violet-500 to-pink-500 group-hover:shadow-[0_0_20px_rgba(168,85,247,0.5)] transition-shadow">
              <div className="h-full w-full rounded-full overflow-hidden bg-[#111] border-2 border-[#08090f]">
                {g.avatarUrl ? (
                  <img
                    src={resolveMediaUrl(g.avatarUrl) ?? undefined}
                    alt={g.displayName}
                    className="h-full w-full object-cover"
                    loading="lazy"
                    decoding="async"
                  />
                ) : (
                  <div className="h-full w-full flex items-center justify-center text-xl font-bold text-white bg-gradient-to-br from-fuchsia-700/50 to-violet-700/50">
                    {g.displayName[0]?.toUpperCase()}
                  </div>
                )}
              </div>
              {g.stories.some((s) => s.mediaType === "VIDEO") && (
                <span className="absolute bottom-0 right-0 h-5 w-5 rounded-full bg-fuchsia-500 flex items-center justify-center text-[9px] text-white font-bold shadow-lg border border-[#08090f]">
                  ▶
                </span>
              )}
            </div>
            <span className="max-w-[72px] truncate text-[11px] text-white/60 font-medium group-hover:text-white/80 transition">
              {g.displayName.split(" ")[0]}
            </span>
          </button>
        ))}
      </div>

      {viewerGroupIdx !== null && (
        <StoryViewer
          groups={groups}
          initialGroupIndex={viewerGroupIdx}
          onClose={() => setViewerGroupIdx(null)}
        />
      )}

      {showUploadModal && (
        <StoryUploadModal
          onClose={() => setShowUploadModal(false)}
          onUploaded={reloadStories}
        />
      )}
    </>
  );
}
