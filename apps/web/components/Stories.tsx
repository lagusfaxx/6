"use client";

import { useCallback, useContext, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { X, ChevronLeft, ChevronRight, Plus, Volume2, VolumeX, MessageCircle } from "lucide-react";
import { LocationFilterContext } from "../hooks/useLocationFilter";
import { apiFetch, resolveMediaUrl } from "../lib/api";
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

/* ─── Stories row ───────────────────────────────────────── */
export default function Stories({ showUpload = false }: { showUpload?: boolean }) {
  const locationCtx = useContext(LocationFilterContext);
  const effectiveLoc = locationCtx?.effectiveLocation ?? null;
  const { me } = useMe();

  const isProfessional = (me?.user?.profileType ?? "").toUpperCase() === "PROFESSIONAL";
  const canUpload = showUpload || isProfessional;

  const [groups, setGroups] = useState<StoryGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [viewerGroupIdx, setViewerGroupIdx] = useState<number | null>(null);

  useEffect(() => {
    // No location filter — stories should be visible in all regions
    apiFetch<{ stories: StoryGroup[] }>("/stories/active")
      .then((d) => setGroups(d.stories ?? []))
      .catch(() => setGroups([]))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-4">
        <div className="mb-3 flex items-center gap-2">
          <div className="h-4 w-4 rounded bg-white/5 animate-pulse" />
          <div className="h-3 w-20 rounded bg-white/5 animate-pulse" />
        </div>
        <div className="flex gap-4 overflow-x-auto scrollbar-hide">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="flex-shrink-0 flex flex-col items-center gap-2">
              <div className="h-20 w-20 rounded-full bg-white/5 animate-pulse" />
              <div className="h-2 w-12 rounded bg-white/5 animate-pulse" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (groups.length === 0 && !canUpload) return null;

  return (
    <>
      <div className="rounded-2xl border border-white/[0.06] bg-gradient-to-r from-fuchsia-500/[0.04] via-violet-500/[0.03] to-transparent p-4">
        {/* Section header */}
        <div className="mb-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold text-white/90">Historias</span>
            {groups.length > 0 && (
              <span className="rounded-full bg-fuchsia-500/15 border border-fuchsia-500/20 px-2 py-0.5 text-[10px] font-medium text-fuchsia-300">
                {groups.length} activas
              </span>
            )}
          </div>
          {isProfessional && (
            <Link
              href="/dashboard/stories"
              className="text-[11px] text-fuchsia-400 hover:text-fuchsia-300 transition font-medium"
            >
              + Subir story
            </Link>
          )}
        </div>

        <div className="flex gap-4 overflow-x-auto scrollbar-hide pb-1">
          {/* Upload button for professionals */}
          {canUpload && (
            <div className="flex-shrink-0 flex flex-col items-center gap-2">
              <Link
                href="/dashboard/stories"
                className="relative h-20 w-20 rounded-full border-2 border-dashed border-fuchsia-500/50 bg-fuchsia-500/5 flex items-center justify-center text-fuchsia-400 hover:border-fuchsia-400 hover:bg-fuchsia-500/10 transition hover:shadow-[0_0_20px_rgba(168,85,247,0.25)]"
              >
                <Plus className="h-7 w-7" />
              </Link>
              <span className="text-[11px] text-fuchsia-300/60 font-medium">Tu story</span>
            </div>
          )}

          {groups.map((g, i) => (
            <button
              key={g.userId}
              onClick={() => setViewerGroupIdx(i)}
              className="flex-shrink-0 flex flex-col items-center gap-2 group"
            >
              <div className="relative h-20 w-20 rounded-full p-[3px] bg-gradient-to-tr from-fuchsia-600 via-violet-500 to-pink-500 group-hover:shadow-[0_0_20px_rgba(168,85,247,0.5)] transition-shadow">
                <div className="h-full w-full rounded-full overflow-hidden bg-[#111] border-2 border-[#08090f]">
                  {g.avatarUrl ? (
                    <img
                      src={resolveMediaUrl(g.avatarUrl) ?? undefined}
                      alt={g.displayName}
                      className="h-full w-full object-cover"
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
      </div>

      {viewerGroupIdx !== null && (
        <StoryViewer
          groups={groups}
          initialGroupIndex={viewerGroupIdx}
          onClose={() => setViewerGroupIdx(null)}
        />
      )}
    </>
  );
}
