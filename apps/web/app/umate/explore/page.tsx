"use client";

import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import Link from "next/link";
import {
  ChevronLeft,
  ChevronRight,
  Crown,
  Heart,
  Loader2,
  Lock,
  MessageCircle,
  Play,
  Send,
  Sparkles,
  Trash2,
  Users,
  X,
} from "lucide-react";
import { apiFetch, resolveMediaUrl } from "../../../lib/api";
import useMe from "../../../hooks/useMe";
import ProtectedMedia from "../_components/ProtectedMedia";

type FeedItem = {
  id: string;
  caption: string | null;
  visibility: "FREE" | "PREMIUM";
  likeCount: number;
  commentCount?: number;
  createdAt: string;
  creator: { id: string; displayName: string; avatarUrl: string | null; subscriberCount?: number; user?: { username: string } };
  media: { id: string; type: string; url: string | null; thumbnailUrl?: string | null; pos: number; visibility?: string; isBlurred?: boolean }[];
  isBlurred: boolean;
  isLiked: boolean;
};

type Comment = {
  id: string;
  text: string;
  createdAt: string;
  user: { id: string; username: string; displayName: string | null; avatarUrl: string | null };
};

type Creator = {
  id: string;
  displayName: string;
  avatarUrl: string | null;
  subscriberCount: number;
  user: { username: string };
};

type CreatorGroup = {
  creator: FeedItem["creator"];
  posts: FeedItem[];
};

/* ── Video with thumbnail preview ── */
function VideoPreview({ src, poster, className }: { src: string; poster?: string; className?: string }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [playing, setPlaying] = useState(false);

  const handlePlay = () => {
    setPlaying(true);
    setTimeout(() => videoRef.current?.play(), 0);
  };

  return (
    <div className="relative h-full w-full">
      <video
        ref={videoRef}
        src={src}
        poster={poster}
        controls={playing}
        playsInline
        preload="metadata"
        crossOrigin="anonymous"
        className={className}
        onPause={() => {
          if (videoRef.current && videoRef.current.currentTime > 0) return;
          setPlaying(false);
        }}
        onEnded={() => setPlaying(false)}
      />
      {!playing && (
        <button
          onClick={handlePlay}
          className="absolute inset-0 flex items-center justify-center bg-black/20 transition hover:bg-black/30"
        >
          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-white/20 backdrop-blur-md shadow-[0_4px_24px_rgba(0,0,0,0.3)] transition hover:scale-110 hover:bg-white/30">
            <Play className="h-6 w-6 text-white fill-current ml-0.5" />
          </div>
        </button>
      )}
    </div>
  );
}

/* ── Media carousel within a single post ── */
function MediaCarousel({ media, viewerUsername }: {
  media: FeedItem["media"];
  viewerUsername?: string;
}) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [current, setCurrent] = useState(0);

  const scroll = (dir: number) => {
    if (!scrollRef.current) return;
    const newIdx = Math.max(0, Math.min(media.length - 1, current + dir));
    const child = scrollRef.current.children[newIdx] as HTMLElement;
    if (child) {
      child.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "start" });
      setCurrent(newIdx);
    }
  };

  const handleScroll = () => {
    if (!scrollRef.current) return;
    const el = scrollRef.current;
    const idx = Math.round(el.scrollLeft / el.offsetWidth);
    setCurrent(idx);
  };

  return (
    <div className="relative">
      <div
        ref={scrollRef}
        onScroll={handleScroll}
        className="flex overflow-x-auto snap-x snap-mandatory scrollbar-hide"
        style={{ WebkitOverflowScrolling: "touch" }}
      >
        {media.map((m, idx) => {
          const blurred = m.isBlurred === true;
          return (
            <div key={m.id || idx} className="w-full shrink-0 snap-start">
              <ProtectedMedia
                enabled={!blurred && m.visibility === "PREMIUM"}
                viewerUsername={viewerUsername}
              >
                <div className="relative aspect-[4/5] overflow-hidden bg-black">
                  {blurred ? (
                    <div className="relative h-full w-full">
                      {m.type === "VIDEO" && m.thumbnailUrl ? (
                        <img src={resolveMediaUrl(m.thumbnailUrl) || ""} alt=""
                          className="absolute inset-0 h-full w-full object-cover scale-110 blur-2xl brightness-75 saturate-150"
                        />
                      ) : m.url && m.type !== "VIDEO" ? (
                        <img src={resolveMediaUrl(m.url) || ""} alt=""
                          className="absolute inset-0 h-full w-full object-cover scale-110 blur-2xl brightness-75 saturate-150"
                        />
                      ) : (
                        <div className="absolute inset-0 bg-gradient-to-br from-[#00aff0]/30 via-purple-600/20 to-rose-500/15" />
                      )}
                      <div className="absolute inset-0 bg-black/10" />
                      {/* Video badge on blurred content */}
                      {m.type === "VIDEO" && (
                        <div className="absolute left-3 top-3 z-10 flex items-center gap-1.5 rounded-lg bg-black/50 px-2.5 py-1 backdrop-blur-sm">
                          <Play className="h-3.5 w-3.5 text-white fill-current" />
                          <span className="text-[11px] font-semibold text-white">Video</span>
                        </div>
                      )}
                      <div className="absolute inset-0 flex flex-col items-center justify-center">
                        <div className="rounded-2xl bg-white/[0.12] p-5 backdrop-blur-md shadow-[0_8px_32px_rgba(0,0,0,0.2)]">
                          <Lock className="h-8 w-8 text-white/80" />
                        </div>
                        <p className="mt-4 text-sm font-bold text-white drop-shadow-lg">Contenido exclusivo</p>
                        <p className="mt-1 text-xs text-white/60 drop-shadow-lg">Suscríbete para desbloquear</p>
                        <Link
                          href="/umate/plans"
                          className="mt-4 rounded-xl bg-gradient-to-r from-[#00aff0] to-[#0090d0] px-7 py-2.5 text-sm font-bold text-white shadow-[0_4px_20px_rgba(0,175,240,0.35)] transition hover:shadow-[0_6px_28px_rgba(0,175,240,0.45)]"
                        >
                          Desbloquear
                        </Link>
                      </div>
                    </div>
                  ) : m.url ? (
                    m.type === "VIDEO" ? (
                      <VideoPreview
                        src={resolveMediaUrl(m.url) || ""}
                        poster={m.thumbnailUrl ? resolveMediaUrl(m.thumbnailUrl) || undefined : undefined}
                        className="h-full w-full object-contain"
                      />
                    ) : (
                      <img src={resolveMediaUrl(m.url) || ""} alt="" className="h-full w-full object-contain" />
                    )
                  ) : (
                    <div className="h-full w-full bg-gradient-to-br from-white/[0.04] to-white/[0.02]" />
                  )}

                  {/* Per-media visibility badge */}
                  <span className={`absolute right-2 top-2 rounded-lg px-2 py-0.5 text-[10px] font-bold ${
                    m.visibility === "PREMIUM"
                      ? "bg-gradient-to-r from-amber-500/90 to-orange-500/90 text-white"
                      : "bg-emerald-500/90 text-white"
                  }`}>
                    {m.visibility === "PREMIUM" ? "Premium" : "Gratis"}
                  </span>
                </div>
              </ProtectedMedia>
            </div>
          );
        })}
      </div>

      {/* Dots */}
      {media.length > 1 && (
        <div className="absolute bottom-2 left-1/2 -translate-x-1/2 flex gap-1.5 z-10">
          {media.map((_, i) => (
            <div key={i} className={`h-1.5 rounded-full transition-all duration-300 ${
              i === current ? "w-5 bg-[#00aff0]" : "w-1.5 bg-white/40"
            }`} />
          ))}
        </div>
      )}

      {/* Arrows */}
      {media.length > 1 && (
        <>
          {current > 0 && (
            <button type="button" onClick={() => scroll(-1)}
              className="absolute left-2 top-1/3 z-10 flex h-9 w-9 items-center justify-center rounded-full bg-black/60 text-white/90 backdrop-blur-sm shadow-[0_2px_8px_rgba(0,0,0,0.4)] transition hover:bg-black/80 hover:text-white hover:scale-105"
            >
              <ChevronLeft className="h-5 w-5" />
            </button>
          )}
          {current < media.length - 1 && (
            <button type="button" onClick={() => scroll(1)}
              className="absolute right-2 top-1/3 z-10 flex h-9 w-9 items-center justify-center rounded-full bg-black/60 text-white/90 backdrop-blur-sm shadow-[0_2px_8px_rgba(0,0,0,0.4)] transition hover:bg-black/80 hover:text-white hover:scale-105"
            >
              <ChevronRight className="h-5 w-5" />
            </button>
          )}
        </>
      )}
    </div>
  );
}

/* ── Post list for a creator's group ── */
function PostCarousel({ posts, onLike, onOpenComments, isBlurredAll, viewerUsername, activeFilter }: {
  posts: FeedItem[];
  onLike: (id: string) => void;
  onOpenComments: (id: string) => void;
  isBlurredAll: boolean;
  viewerUsername?: string;
  activeFilter?: string;
}) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [current, setCurrent] = useState(0);

  const scroll = (dir: number) => {
    if (!scrollRef.current) return;
    const newIdx = Math.max(0, Math.min(posts.length - 1, current + dir));
    const child = scrollRef.current.children[newIdx] as HTMLElement;
    if (child) {
      child.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "start" });
      setCurrent(newIdx);
    }
  };

  const handleScroll = () => {
    if (!scrollRef.current) return;
    const el = scrollRef.current;
    const idx = Math.round(el.scrollLeft / el.offsetWidth);
    setCurrent(idx);
  };

  return (
    <div className="space-y-0">
      {/* Posts carousel */}
      <div className="group/media relative">
        <div
          ref={scrollRef}
          onScroll={handleScroll}
          className="flex overflow-x-auto snap-x snap-mandatory scrollbar-hide"
          style={{ WebkitOverflowScrolling: "touch" }}
        >
          {posts.map((post) => (
            <div key={post.id} className="w-full shrink-0 snap-start">
              {/* Show only one representative media item in explore; full gallery lives on the profile */}
              <MediaCarousel media={[
                (activeFilter === "premium"
                  ? post.media.find((m) => m.visibility === "PREMIUM")
                  : activeFilter === "free"
                    ? post.media.find((m) => m.visibility === "FREE")
                    : undefined
                ) || post.media[0]
              ]} viewerUsername={viewerUsername} />

              {/* Multi-media indicator */}
              {post.media.length > 1 && (
                <div className="flex items-center justify-center gap-1.5 py-1.5">
                  {post.media.map((_, i) => (
                    <div key={i} className={`h-1.5 rounded-full ${i === 0 ? "w-5 bg-[#00aff0]" : "w-1.5 bg-white/15"}`} />
                  ))}
                </div>
              )}

              {/* Caption + Actions */}
              <div className="px-4 py-2.5">
                {post.caption && (
                  <p className="text-sm leading-relaxed text-white/55 line-clamp-2">{post.caption}</p>
                )}
                <div className="mt-1.5 flex items-center gap-1">
                  <button
                    onClick={() => onLike(post.id)}
                    className={`flex items-center gap-1 rounded-lg px-2 py-1 text-xs transition ${
                      post.isLiked ? "bg-rose-500/10 text-rose-400" : "text-white/30 hover:bg-white/[0.04] hover:text-rose-400"
                    }`}
                  >
                    <Heart className={`h-4 w-4 ${post.isLiked ? "fill-current" : ""}`} />
                    <span className="font-semibold">{post.likeCount}</span>
                  </button>
                  <button
                    onClick={() => onOpenComments(post.id)}
                    className="flex items-center gap-1 rounded-lg px-2 py-1 text-xs text-white/30 transition hover:bg-white/[0.04] hover:text-white/50"
                  >
                    <MessageCircle className="h-4 w-4" />
                    {(post.commentCount || 0) > 0 && <span className="font-semibold">{post.commentCount}</span>}
                  </button>
                  <span className="ml-auto text-[10px] text-white/20">
                    {new Date(post.createdAt).toLocaleDateString("es-CL", { day: "numeric", month: "short" })}
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Post-level carousel dots */}
        {posts.length > 1 && (
          <div className="flex justify-center gap-1.5 py-2">
            {posts.map((_, i) => (
              <div
                key={i}
                className={`h-1.5 rounded-full transition-all duration-300 ${
                  i === current ? "w-5 bg-[#00aff0]" : "w-1.5 bg-white/15"
                }`}
              />
            ))}
          </div>
        )}

        {/* Post-level arrows */}
        {posts.length > 1 && (
          <>
            {current > 0 && (
              <button
                type="button"
                onClick={() => scroll(-1)}
                className="absolute left-2 top-1/3 z-10 flex h-9 w-9 items-center justify-center rounded-full bg-black/60 text-white/90 backdrop-blur-sm shadow-[0_2px_8px_rgba(0,0,0,0.4)] transition hover:bg-black/80 hover:text-white hover:scale-105"
              >
                <ChevronLeft className="h-5 w-5" />
              </button>
            )}
            {current < posts.length - 1 && (
              <button
                type="button"
                onClick={() => scroll(1)}
                className="absolute right-2 top-1/3 z-10 flex h-9 w-9 items-center justify-center rounded-full bg-black/60 text-white/90 backdrop-blur-sm shadow-[0_2px_8px_rgba(0,0,0,0.4)] transition hover:bg-black/80 hover:text-white hover:scale-105"
              >
                <ChevronRight className="h-5 w-5" />
              </button>
            )}
          </>
        )}
      </div>
    </div>
  );
}

export default function ExplorePage() {
  const { me } = useMe();
  const [items, setItems] = useState<FeedItem[]>([]);
  const [suggestedCreators, setSuggestedCreators] = useState<Creator[]>([]);
  const [filter, setFilter] = useState("");
  const [loading, setLoading] = useState(true);
  const [openComments, setOpenComments] = useState<string | null>(null);
  const [comments, setComments] = useState<Comment[]>([]);
  const [commentText, setCommentText] = useState("");
  const [loadingComments, setLoadingComments] = useState(false);

  useEffect(() => {
    setLoading(true);
    const params = new URLSearchParams();
    if (filter) params.set("filter", filter);
    params.set("limit", "48");
    Promise.all([
      apiFetch<{ items: FeedItem[] }>(`/umate/feed?${params}`).catch(() => null),
      apiFetch<{ creators: Creator[] }>("/umate/suggested?limit=6").catch(() => null),
    ]).then(([f, c]) => {
      setItems(f?.items || []);
      setSuggestedCreators(c?.creators || []);
      setLoading(false);
    });
  }, [filter]);

  const toggleLike = async (postId: string) => {
    const res = await apiFetch<{ liked: boolean }>(`/umate/posts/${postId}/like`, { method: "POST" }).catch(() => null);
    if (!res) return;
    setItems((prev) => prev.map((i) => (i.id === postId ? { ...i, isLiked: res.liked, likeCount: i.likeCount + (res.liked ? 1 : -1) } : i)));
  };

  const loadComments = useCallback(async (postId: string) => {
    setOpenComments(postId);
    setLoadingComments(true);
    setComments([]);
    const data = await apiFetch<{ comments: Comment[] }>(`/umate/posts/${postId}/comments`).catch(() => null);
    setComments(data?.comments || []);
    setLoadingComments(false);
  }, []);

  const postComment = async (postId: string) => {
    if (!commentText.trim()) return;
    const data = await apiFetch<{ comment: Comment }>(`/umate/posts/${postId}/comments`, {
      method: "POST",
      body: JSON.stringify({ text: commentText }),
    }).catch(() => null);
    if (data?.comment) {
      setComments((prev) => [data.comment, ...prev]);
      setCommentText("");
      setItems((prev) => prev.map((i) => (i.id === postId ? { ...i, commentCount: (i.commentCount || 0) + 1 } : i)));
    }
  };

  const deleteComment = async (commentId: string, postId: string) => {
    await apiFetch(`/umate/comments/${commentId}`, { method: "DELETE" }).catch(() => null);
    setComments((prev) => prev.filter((c) => c.id !== commentId));
    setItems((prev) => prev.map((i) => (i.id === postId ? { ...i, commentCount: Math.max(0, (i.commentCount || 1) - 1) } : i)));
  };

  // Group posts by creator
  const creatorGroups = useMemo<CreatorGroup[]>(() => {
    const map = new Map<string, CreatorGroup>();
    for (const item of items) {
      const key = item.creator.id;
      if (!map.has(key)) {
        map.set(key, { creator: item.creator, posts: [] });
      }
      map.get(key)!.posts.push(item);
    }
    return Array.from(map.values());
  }, [items]);

  return (
    <div className="min-h-screen">
      {/* Filter bar */}
      <div className="sticky top-14 z-30 border-b border-white/[0.03] bg-[#0a0a12]/85 py-3 backdrop-blur-2xl backdrop-saturate-[1.8]">
        <div className="mx-auto flex max-w-[700px] items-center gap-2 px-4">
          <div className="flex flex-wrap items-center gap-0.5 rounded-xl bg-white/[0.04] p-1">
            {[
              { key: "", label: "Para ti", icon: Sparkles },
              { key: "free", label: "Gratis" },
              { key: "premium", label: "Premium", icon: Crown },
            ].map((f) => (
              <button
                key={f.label}
                onClick={() => setFilter(f.key)}
                className={`flex items-center gap-1.5 rounded-lg px-3 sm:px-4 py-2 text-xs font-semibold transition-all duration-200 ${
                  filter === f.key
                    ? "bg-gradient-to-r from-[#00aff0] to-[#0090d0] text-white shadow-[0_2px_12px_rgba(0,175,240,0.25)]"
                    : "text-white/40 hover:text-white/60"
                }`}
              >
                {"icon" in f && f.icon && <f.icon className="h-3 w-3" />}
                {f.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-[1170px] px-4 py-6">
        <div className="flex justify-center gap-6">
          {/* Main Feed — grouped by creator */}
          <div className="w-full max-w-[600px]">
            {loading && (
              <div className="flex flex-col items-center justify-center py-24 gap-3">
                <Loader2 className="h-8 w-8 animate-spin text-[#00aff0]/60" />
                <p className="text-xs text-white/30">Cargando contenido...</p>
              </div>
            )}

            {!loading && items.length === 0 && (
              <div className="rounded-2xl border border-white/[0.04] bg-gradient-to-br from-white/[0.02] to-transparent p-16 text-center">
                <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-[#00aff0]/[0.08]">
                  <Sparkles className="h-7 w-7 text-[#00aff0]/60" />
                </div>
                <p className="text-sm font-semibold text-white/50">No hay contenido disponible</p>
                <p className="mt-1.5 text-xs text-white/30">Suscríbete a creadoras para ver su contenido aquí.</p>
                <Link
                  href="/umate/plans"
                  className="mt-5 inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-[#00aff0] to-[#0090d0] px-6 py-2.5 text-sm font-bold text-white shadow-[0_4px_20px_rgba(0,175,240,0.3)]"
                >
                  <Crown className="h-4 w-4" /> Ver planes
                </Link>
              </div>
            )}

            {!loading && (
              <div className="space-y-6">
                {creatorGroups.map((group) => (
                  <article
                    key={group.creator.id}
                    className="overflow-hidden rounded-2xl border border-white/[0.04] bg-white/[0.02] transition-all duration-300 hover:border-white/[0.08]"
                  >
                    {/* Creator header */}
                    <div className="flex items-center gap-3 px-4 py-3">
                      <Link
                        href={`/umate/profile/${group.creator.user?.username || group.creator.id}`}
                        className="flex flex-1 items-center gap-3 min-w-0 transition hover:opacity-80"
                      >
                        <div className="h-11 w-11 shrink-0 overflow-hidden rounded-full border border-white/[0.1] bg-gradient-to-br from-white/[0.06] to-white/[0.02]">
                          {group.creator.avatarUrl ? (
                            <img src={resolveMediaUrl(group.creator.avatarUrl) || ""} alt="" className="h-full w-full object-cover" />
                          ) : (
                            <div className="flex h-full items-center justify-center text-sm font-bold text-white/40">{(group.creator.displayName || "?")[0]}</div>
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-bold text-white/90 truncate">{group.creator.displayName}</p>
                          <p className="text-[11px] text-white/30">
                            @{group.creator.user?.username || "creator"} · {group.posts.length} publicacion{group.posts.length > 1 ? "es" : ""}
                          </p>
                        </div>
                      </Link>
                      {group.posts.some((p) => p.isBlurred) ? (
                        <Link
                          href="/umate/plans"
                          className="shrink-0 flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-[#00aff0] to-[#0090d0] px-4 py-2 text-xs font-bold text-white shadow-[0_2px_10px_rgba(0,175,240,0.25)] transition hover:shadow-[0_4px_16px_rgba(0,175,240,0.35)]"
                        >
                          <Crown className="h-3.5 w-3.5" />
                          <span>Suscribirse</span>
                        </Link>
                      ) : (
                        <Link
                          href={`/umate/profile/${group.creator.user?.username || group.creator.id}`}
                          className="shrink-0 rounded-xl border border-white/[0.08] px-4 py-2 text-xs font-semibold text-white/50 transition hover:bg-white/[0.04] hover:text-white/70"
                        >
                          Ver perfil
                        </Link>
                      )}
                    </div>

                    {/* Posts carousel for this creator */}
                    <PostCarousel
                      posts={group.posts}
                      onLike={toggleLike}
                      onOpenComments={(postId) =>
                        openComments === postId ? setOpenComments(null) : loadComments(postId)
                      }
                      isBlurredAll={group.posts.every((p) => p.isBlurred)}
                      viewerUsername={me?.user?.username}
                      activeFilter={filter}
                    />

                    {/* Comments section (shows for whichever post is open) */}
                    {group.posts.some((p) => p.id === openComments) && (
                      <div className="border-t border-white/[0.04] px-4 py-3 space-y-3">
                        <div className="flex items-center gap-2">
                          <input
                            value={commentText}
                            onChange={(e) => setCommentText(e.target.value)}
                            onKeyDown={(e) => e.key === "Enter" && openComments && postComment(openComments)}
                            placeholder="Escribe un comentario..."
                            className="flex-1 rounded-xl border border-white/[0.06] bg-white/[0.03] px-4 py-2.5 text-sm text-white placeholder-white/20 outline-none focus:border-[#00aff0]/30"
                            maxLength={1000}
                          />
                          <button
                            onClick={() => openComments && postComment(openComments)}
                            disabled={!commentText.trim()}
                            className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-r from-[#00aff0] to-[#0090d0] text-white shadow-[0_2px_10px_rgba(0,175,240,0.25)] transition disabled:opacity-30"
                          >
                            <Send className="h-3.5 w-3.5" />
                          </button>
                        </div>
                        {loadingComments && <div className="flex justify-center py-3"><Loader2 className="h-4 w-4 animate-spin text-[#00aff0]/50" /></div>}
                        {!loadingComments && comments.length === 0 && (
                          <p className="text-center text-xs text-white/30 py-2">Sin comentarios aún.</p>
                        )}
                        <div className="space-y-2 max-h-60 overflow-y-auto">
                          {comments.map((c) => (
                            <div key={c.id} className="group flex gap-2">
                              <div className="h-7 w-7 shrink-0 overflow-hidden rounded-lg bg-white/[0.06]">
                                {c.user.avatarUrl ? (
                                  <img src={resolveMediaUrl(c.user.avatarUrl) || ""} alt="" className="h-full w-full object-cover" />
                                ) : (
                                  <div className="flex h-full items-center justify-center text-[10px] font-bold text-white/40">{(c.user.displayName || c.user.username)[0]}</div>
                                )}
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className="text-xs">
                                  <span className="font-semibold text-white/70">{c.user.displayName || c.user.username}</span>{" "}
                                  <span className="text-white/40">{c.text}</span>
                                </p>
                                <p className="mt-0.5 text-[10px] text-white/25">{new Date(c.createdAt).toLocaleDateString("es-CL")}</p>
                              </div>
                              {me?.user?.id === c.user.id && (
                                <button
                                  onClick={() => openComments && deleteComment(c.id, openComments)}
                                  className="shrink-0 opacity-0 group-hover:opacity-100 transition text-white/30 hover:text-red-400"
                                >
                                  <Trash2 className="h-3 w-3" />
                                </button>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </article>
                ))}
              </div>
            )}
          </div>

          {/* Sidebar — positioned to the right without affecting feed centering */}
          <aside className="hidden shrink-0 lg:block w-[300px]">
            <div className="sticky top-28 space-y-4">
              {/* Suggested creators */}
              <div className="rounded-2xl border border-white/[0.04] bg-white/[0.015] p-4">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-bold uppercase tracking-wider text-white/30">Creadoras sugeridas</p>
                  <Link href="/umate/creators" className="text-[11px] font-semibold text-[#00aff0]/70 hover:text-[#00aff0]">Ver todas</Link>
                </div>
                <div className="mt-3 space-y-1">
                  {suggestedCreators.slice(0, 6).map((c) => (
                    <Link
                      key={c.id}
                      href={`/umate/profile/${c.user.username}`}
                      className="flex items-center gap-3 rounded-xl p-2 transition hover:bg-white/[0.04]"
                    >
                      <div className="h-10 w-10 shrink-0 overflow-hidden rounded-xl border border-white/[0.06] bg-gradient-to-br from-white/[0.06] to-white/[0.02]">
                        {c.avatarUrl ? (
                          <img src={resolveMediaUrl(c.avatarUrl) || ""} alt="" className="h-full w-full object-cover" />
                        ) : (
                          <div className="flex h-full items-center justify-center text-sm font-bold text-white/40">{(c.displayName || "?")[0]}</div>
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-semibold text-white/80">{c.displayName}</p>
                        <p className="text-[11px] text-white/30 flex items-center gap-1">
                          <Users className="h-2.5 w-2.5" /> {c.subscriberCount}
                        </p>
                      </div>
                      <span className="shrink-0 rounded-lg bg-gradient-to-r from-[#00aff0] to-[#0090d0] px-3 py-1 text-[10px] font-bold text-white shadow-[0_2px_8px_rgba(0,175,240,0.2)]">
                        Ver
                      </span>
                    </Link>
                  ))}
                </div>
              </div>

              {/* Premium CTA */}
              <div className="relative overflow-hidden rounded-2xl border border-[#00aff0]/10 bg-gradient-to-br from-[#00aff0]/[0.06] via-purple-500/[0.03] to-transparent p-5">
                <div className="pointer-events-none absolute -right-8 -top-8 h-32 w-32 rounded-full bg-[#00aff0]/[0.06] blur-3xl" />
                <div className="relative">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#00aff0]/10">
                    <Crown className="h-5 w-5 text-[#00aff0]" />
                  </div>
                  <p className="mt-3 text-sm font-bold text-white/90">Desbloquea todo el contenido</p>
                  <p className="mt-1 text-xs text-white/35 leading-relaxed">Accede a publicaciones exclusivas con un plan premium.</p>
                  <Link
                    href="/umate/plans"
                    className="mt-4 block rounded-xl bg-gradient-to-r from-[#00aff0] to-[#0090d0] py-2.5 text-center text-xs font-bold text-white shadow-[0_4px_16px_rgba(0,175,240,0.25)] transition hover:shadow-[0_6px_24px_rgba(0,175,240,0.35)]"
                  >
                    Ver planes premium
                  </Link>
                </div>
              </div>
            </div>
          </aside>
        </div>
      </div>
    </div>
  );
}
