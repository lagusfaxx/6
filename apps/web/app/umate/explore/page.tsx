"use client";

import { useEffect, useMemo, useState, useCallback } from "react";
import Link from "next/link";
import {
  Crown,
  Heart,
  Loader2,
  Lock,
  MessageCircle,
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
  creator: { id: string; displayName: string; avatarUrl: string | null; user?: { username: string } };
  media: { id: string; type: string; url: string | null; pos: number }[];
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

  return (
    <div className="min-h-screen">
      {/* Filter bar - uses header search, no duplicate */}
      <div className="sticky top-14 z-30 border-b border-white/[0.03] bg-[#0a0a12]/85 py-3 backdrop-blur-2xl backdrop-saturate-[1.8]">
        <div className="mx-auto flex max-w-[700px] items-center gap-2 px-4">
          <div className="flex items-center gap-0.5 rounded-xl bg-white/[0.04] p-1">
            {[
              { key: "", label: "Para ti", icon: Sparkles },
              { key: "free", label: "Gratis" },
              { key: "premium", label: "Premium", icon: Crown },
            ].map((f) => (
              <button
                key={f.label}
                onClick={() => setFilter(f.key)}
                className={`flex items-center gap-1.5 rounded-lg px-4 py-2 text-xs font-semibold transition-all duration-200 ${
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
        <div className="grid gap-6 lg:grid-cols-[1fr_300px]">
          {/* Main Feed */}
          <div className="mx-auto w-full max-w-[600px] lg:mx-0">
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
              <div className="space-y-5">
                {items.map((item) => (
                  <article key={item.id} className="overflow-hidden rounded-2xl border border-white/[0.04] bg-white/[0.02] transition-all duration-300 hover:border-white/[0.08] hover:shadow-[0_8px_40px_rgba(0,0,0,0.2)]">
                    {/* Creator header */}
                    <Link
                      href={`/umate/profile/${item.creator.user?.username || item.creator.id}`}
                      className="flex items-center gap-3 px-4 py-3 transition hover:bg-white/[0.02]"
                    >
                      <div className="h-11 w-11 shrink-0 overflow-hidden rounded-xl border border-white/[0.08] bg-gradient-to-br from-white/[0.06] to-white/[0.02]">
                        {item.creator.avatarUrl ? (
                          <img src={resolveMediaUrl(item.creator.avatarUrl) || ""} alt="" className="h-full w-full object-cover" />
                        ) : (
                          <div className="flex h-full items-center justify-center text-sm font-bold text-white/40">{(item.creator.displayName || "?")[0]}</div>
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-bold text-white/90 truncate">{item.creator.displayName}</p>
                        <p className="text-[11px] text-white/30">
                          @{item.creator.user?.username || "creator"} · {new Date(item.createdAt).toLocaleDateString("es-CL", { day: "numeric", month: "short" })}
                        </p>
                      </div>
                      <span className={`rounded-lg px-2.5 py-1 text-[10px] font-bold tracking-wide ${
                        item.visibility === "FREE"
                          ? "bg-emerald-500/10 text-emerald-400/80"
                          : "bg-gradient-to-r from-amber-500/10 to-orange-500/10 text-amber-400/80"
                      }`}>
                        {item.visibility === "FREE" ? "Gratis" : "Premium"}
                      </span>
                    </Link>

                    {/* Caption */}
                    {item.caption && (
                      <div className="px-4 pb-3">
                        <p className="text-sm leading-relaxed text-white/60">{item.caption}</p>
                      </div>
                    )}

                    {/* Media */}
                    {item.media[0] && (
                      <ProtectedMedia
                        enabled={!item.isBlurred && item.visibility === "PREMIUM"}
                        viewerUsername={me?.user?.username}
                      >
                        <div className="relative">
                          {item.isBlurred ? (
                            <div className="relative aspect-[4/5] w-full overflow-hidden">
                              {item.media[0].url ? (
                                <img
                                  src={resolveMediaUrl(item.media[0].url) || ""}
                                  alt=""
                                  className="absolute inset-0 h-full w-full object-cover scale-110 blur-3xl brightness-[0.35] saturate-150"
                                />
                              ) : (
                                <div className="absolute inset-0 bg-gradient-to-br from-[#00aff0]/15 via-purple-600/10 to-rose-500/10" />
                              )}
                              <div className="absolute inset-0 flex flex-col items-center justify-center">
                                <div className="rounded-2xl bg-white/[0.08] p-5 backdrop-blur-xl shadow-[0_8px_32px_rgba(0,0,0,0.3)]">
                                  <Lock className="h-8 w-8 text-white/60" />
                                </div>
                                <p className="mt-4 text-sm font-bold text-white/80">Contenido exclusivo</p>
                                <p className="mt-1 text-xs text-white/35">Suscríbete para desbloquear</p>
                                <Link
                                  href="/umate/plans"
                                  className="mt-4 rounded-xl bg-gradient-to-r from-[#00aff0] to-[#0090d0] px-7 py-2.5 text-sm font-bold text-white shadow-[0_4px_20px_rgba(0,175,240,0.35)] transition hover:shadow-[0_6px_28px_rgba(0,175,240,0.45)]"
                                >
                                  Desbloquear con U-Mate
                                </Link>
                              </div>
                            </div>
                          ) : item.media[0].url ? (
                            item.media[0].type === "VIDEO" ? (
                              <video
                                src={resolveMediaUrl(item.media[0].url) || ""}
                                controls
                                playsInline
                                preload="metadata"
                                className="w-full object-cover"
                                style={{ maxHeight: 600 }}
                              />
                            ) : (
                              <img
                                src={resolveMediaUrl(item.media[0].url) || ""}
                                alt=""
                                className="w-full object-cover"
                                style={{ maxHeight: 600 }}
                              />
                            )
                          ) : (
                            <div className="aspect-[4/5] w-full bg-gradient-to-br from-white/[0.04] to-white/[0.02]" />
                          )}
                        </div>
                      </ProtectedMedia>
                    )}

                    {/* Actions */}
                    <div className="flex items-center gap-1 px-4 py-3">
                      <button
                        onClick={() => toggleLike(item.id)}
                        className={`flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-sm transition ${
                          item.isLiked ? "bg-rose-500/10 text-rose-400" : "text-white/35 hover:bg-white/[0.04] hover:text-rose-400"
                        }`}
                      >
                        <Heart className={`h-5 w-5 ${item.isLiked ? "fill-current" : ""}`} />
                        <span className="text-xs font-semibold">{item.likeCount}</span>
                      </button>
                      <button
                        onClick={() => openComments === item.id ? setOpenComments(null) : loadComments(item.id)}
                        className={`flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-sm transition ${
                          openComments === item.id ? "bg-[#00aff0]/10 text-[#00aff0]" : "text-white/35 hover:bg-white/[0.04] hover:text-white/50"
                        }`}
                      >
                        <MessageCircle className="h-5 w-5" />
                        {(item.commentCount || 0) > 0 && <span className="text-xs font-semibold">{item.commentCount}</span>}
                      </button>
                    </div>

                    {/* Comments section */}
                    {openComments === item.id && (
                      <div className="border-t border-white/[0.04] px-4 py-3 space-y-3">
                        <div className="flex items-center gap-2">
                          <input
                            value={commentText}
                            onChange={(e) => setCommentText(e.target.value)}
                            onKeyDown={(e) => e.key === "Enter" && postComment(item.id)}
                            placeholder="Escribe un comentario..."
                            className="flex-1 rounded-xl border border-white/[0.06] bg-white/[0.03] px-4 py-2.5 text-sm text-white placeholder-white/20 outline-none focus:border-[#00aff0]/30"
                            maxLength={1000}
                          />
                          <button
                            onClick={() => postComment(item.id)}
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
                              <button
                                onClick={() => deleteComment(c.id, item.id)}
                                className="shrink-0 opacity-0 group-hover:opacity-100 transition text-white/30 hover:text-red-400"
                              >
                                <Trash2 className="h-3 w-3" />
                              </button>
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

          {/* Sidebar */}
          <aside className="hidden lg:block">
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
                    Ver planes desde $14.990/mes
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
