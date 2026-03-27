"use client";

import { useEffect, useMemo, useState, useCallback } from "react";
import Link from "next/link";
import {
  BadgeCheck,
  Compass,
  Crown,
  Flame,
  Heart,
  Loader2,
  Lock,
  MessageCircle,
  Search,
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
  const [search, setSearch] = useState("");
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
      apiFetch<{ creators: Creator[] }>("/umate/suggested?limit=5").catch(() => null),
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

  const filtered = useMemo(
    () =>
      items.filter((item) => {
        if (!search.trim()) return true;
        return item.creator.displayName.toLowerCase().includes(search.toLowerCase()) || (item.caption || "").toLowerCase().includes(search.toLowerCase());
      }),
    [items, search],
  );

  return (
    <div className="min-h-screen">
      {/* Sticky filter bar */}
      <div className="sticky top-14 z-30 border-b border-white/[0.03] bg-[#08080d]/90 py-3 backdrop-blur-2xl backdrop-saturate-150">
        <div className="mx-auto flex max-w-[700px] items-center gap-2 px-4">
          <div className="flex items-center gap-0.5 rounded-full bg-white/[0.04] p-1">
            {[
              { key: "", label: "Para ti" },
              { key: "free", label: "Gratis" },
              { key: "premium", label: "Premium" },
            ].map((f) => (
              <button
                key={f.label}
                onClick={() => setFilter(f.key)}
                className={`rounded-full px-4 py-1.5 text-xs font-semibold transition-all duration-200 ${
                  filter === f.key
                    ? "bg-white text-black shadow-sm"
                    : "text-white/35 hover:text-white/60"
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>
          <div className="relative ml-auto hidden sm:block">
            <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-white/25" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar..."
              className="w-48 rounded-full border border-white/[0.05] bg-white/[0.025] py-1.5 pl-9 pr-3 text-sm text-white placeholder-white/20 outline-none transition-all duration-300 focus:border-[#00aff0]/30 focus:w-64 focus:shadow-[0_0_0_3px_rgba(0,175,240,0.05)]"
            />
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-[1170px] px-4 py-6">
        <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
          {/* Main Feed - OnlyFans Style (single column, centered posts) */}
          <div className="mx-auto w-full max-w-[600px] lg:mx-0">
            {loading && (
              <div className="flex justify-center py-20">
                <Loader2 className="h-6 w-6 animate-spin text-white/20" />
              </div>
            )}

            {!loading && filtered.length === 0 && (
              <div className="rounded-2xl border border-white/[0.05] bg-white/[0.015] p-20 text-center">
                <Flame className="mx-auto mb-4 h-8 w-8 text-white/[0.07]" />
                <p className="text-sm font-medium text-white/40">No hay contenido con esos filtros.</p>
                <p className="mt-1.5 text-xs text-white/20">Intenta con otra busqueda.</p>
              </div>
            )}

            {!loading && (
              <div className="space-y-4">
                {filtered.map((item) => (
                  <article key={item.id} className="overflow-hidden rounded-2xl border border-white/[0.05] bg-white/[0.02] transition-colors duration-200 hover:border-white/[0.07]">
                    {/* Creator header */}
                    <Link
                      href={`/umate/profile/${item.creator.user?.username || item.creator.id}`}
                      className="flex items-center gap-3 px-4 py-3"
                    >
                      <div className="h-10 w-10 overflow-hidden rounded-full border border-white/[0.06] bg-white/[0.04]">
                        {item.creator.avatarUrl ? (
                          <img src={resolveMediaUrl(item.creator.avatarUrl) || ""} alt="" className="h-full w-full object-cover" />
                        ) : (
                          <div className="flex h-full items-center justify-center text-sm font-bold text-white/40">{item.creator.displayName[0]}</div>
                        )}
                      </div>
                      <div className="flex-1">
                        <p className="text-sm font-semibold text-white">{item.creator.displayName}</p>
                        <p className="text-[11px] text-white/30">
                          @{item.creator.user?.username || "creator"} · {new Date(item.createdAt).toLocaleDateString("es-CL")}
                        </p>
                      </div>
                      <span className={`rounded-full px-2.5 py-0.5 text-[10px] font-bold tracking-wide ${
                        item.visibility === "FREE"
                          ? "bg-emerald-500/[0.08] text-emerald-400/80"
                          : "bg-amber-500/[0.08] text-amber-400/80"
                      }`}>
                        {item.visibility === "FREE" ? "Gratis" : "Premium"}
                      </span>
                    </Link>

                    {/* Caption */}
                    {item.caption && (
                      <div className="px-4 pb-3">
                        <p className="text-sm leading-relaxed text-white/70">{item.caption}</p>
                      </div>
                    )}

                    {/* Media */}
                    {item.media[0] && (
                      <ProtectedMedia
                        enabled={!item.isBlurred && item.visibility === "PREMIUM"}
                        viewerUsername={me?.user?.username}
                      >
                        <div className="relative">
                          {item.media[0].url ? (
                            <img
                              src={resolveMediaUrl(item.media[0].url) || ""}
                              alt=""
                              className={`w-full object-cover ${item.isBlurred ? "scale-105 blur-2xl" : ""}`}
                              style={{ maxHeight: 600 }}
                            />
                          ) : (
                            <div className="aspect-[4/5] w-full bg-gradient-to-br from-white/[0.04] to-white/[0.02]" />
                          )}
                          {item.isBlurred && (
                            <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/60 backdrop-blur-sm">
                              <div className="rounded-full bg-white/10 p-4">
                                <Lock className="h-8 w-8 text-white/70" />
                              </div>
                              <p className="mt-3 text-sm font-bold text-white">Contenido premium</p>
                              <p className="mt-1 text-xs text-white/40">Suscribete para desbloquear</p>
                              <Link
                                href="/umate/plans"
                                className="mt-3 rounded-full bg-[#00aff0] px-6 py-2 text-sm font-bold text-white transition hover:bg-[#00aff0]/90"
                              >
                                Usar cupo de suscripcion
                              </Link>
                            </div>
                          )}
                        </div>
                      </ProtectedMedia>
                    )}

                    {/* Actions */}
                    <div className="flex items-center gap-4 px-4 py-3">
                      <button
                        onClick={() => toggleLike(item.id)}
                        className={`flex items-center gap-1.5 text-sm transition ${
                          item.isLiked ? "text-rose-500" : "text-white/30 hover:text-rose-400"
                        }`}
                      >
                        <Heart className={`h-5 w-5 ${item.isLiked ? "fill-current" : ""}`} />
                        <span className="text-xs font-medium">{item.likeCount}</span>
                      </button>
                      <button
                        onClick={() => openComments === item.id ? setOpenComments(null) : loadComments(item.id)}
                        className={`flex items-center gap-1.5 text-sm transition ${
                          openComments === item.id ? "text-[#00aff0]" : "text-white/30 hover:text-white/50"
                        }`}
                      >
                        <MessageCircle className="h-5 w-5" />
                        {(item.commentCount || 0) > 0 && <span className="text-xs font-medium">{item.commentCount}</span>}
                      </button>
                    </div>

                    {/* Comments section */}
                    {openComments === item.id && (
                      <div className="border-t border-white/[0.04] px-4 py-3 space-y-3">
                        {/* Comment input */}
                        <div className="flex items-center gap-2">
                          <input
                            value={commentText}
                            onChange={(e) => setCommentText(e.target.value)}
                            onKeyDown={(e) => e.key === "Enter" && postComment(item.id)}
                            placeholder="Escribe un comentario..."
                            className="flex-1 rounded-full border border-white/[0.06] bg-white/[0.03] px-4 py-2 text-sm text-white placeholder-white/20 outline-none focus:border-[#00aff0]/40"
                            maxLength={1000}
                          />
                          <button
                            onClick={() => postComment(item.id)}
                            disabled={!commentText.trim()}
                            className="flex h-8 w-8 items-center justify-center rounded-full bg-[#00aff0] text-white shadow-[0_1px_8px_rgba(0,175,240,0.2)] transition-all duration-200 hover:bg-[#00aff0]/90 disabled:opacity-30"
                          >
                            <Send className="h-3.5 w-3.5" />
                          </button>
                        </div>

                        {/* Comment list */}
                        {loadingComments && <div className="flex justify-center py-3"><Loader2 className="h-4 w-4 animate-spin text-white/20" /></div>}
                        {!loadingComments && comments.length === 0 && (
                          <p className="text-center text-xs text-white/20 py-2">Sin comentarios aún. Sé el primero.</p>
                        )}
                        <div className="space-y-2 max-h-60 overflow-y-auto">
                          {comments.map((c) => (
                            <div key={c.id} className="group flex gap-2">
                              <div className="h-7 w-7 shrink-0 overflow-hidden rounded-full bg-white/[0.06]">
                                {c.user.avatarUrl ? (
                                  <img src={c.user.avatarUrl} alt="" className="h-full w-full object-cover" />
                                ) : (
                                  <div className="flex h-full items-center justify-center text-[10px] font-bold text-white/30">{(c.user.displayName || c.user.username)[0]}</div>
                                )}
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className="text-xs">
                                  <span className="font-semibold text-white/80">{c.user.displayName || c.user.username}</span>{" "}
                                  <span className="text-white/50">{c.text}</span>
                                </p>
                                <p className="mt-0.5 text-[10px] text-white/20">{new Date(c.createdAt).toLocaleDateString("es-CL")}</p>
                              </div>
                              <button
                                onClick={() => deleteComment(c.id, item.id)}
                                className="shrink-0 opacity-0 group-hover:opacity-100 transition text-white/15 hover:text-red-400"
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
              <div className="rounded-2xl border border-white/[0.05] bg-white/[0.02] p-4">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-bold uppercase tracking-wider text-white/30">Sugeridas para ti</p>
                  <Link href="/umate/creators" className="text-[11px] font-medium text-[#00aff0]">Ver todas</Link>
                </div>
                <div className="mt-3 space-y-1">
                  {suggestedCreators.slice(0, 5).map((c) => (
                    <Link
                      key={c.id}
                      href={`/umate/profile/${c.user.username}`}
                      className="flex items-center gap-3 rounded-lg p-2 transition hover:bg-white/[0.04]"
                    >
                      <div className="h-10 w-10 shrink-0 overflow-hidden rounded-full border border-white/[0.08] bg-white/[0.06]">
                        {c.avatarUrl ? (
                          <img src={resolveMediaUrl(c.avatarUrl) || ""} alt="" className="h-full w-full object-cover" />
                        ) : (
                          <div className="flex h-full items-center justify-center text-sm font-bold text-white/40">{c.displayName[0]}</div>
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-semibold text-white/90">{c.displayName}</p>
                        <p className="text-[11px] text-white/25">@{c.user.username}</p>
                      </div>
                      <span className="shrink-0 rounded-full bg-[#00aff0]/90 px-3 py-1 text-[10px] font-bold text-white shadow-[0_1px_8px_rgba(0,175,240,0.2)]">
                        Suscribir
                      </span>
                    </Link>
                  ))}
                </div>
              </div>

              {/* Upgrade CTA */}
              <div className="rounded-2xl border border-[#00aff0]/15 bg-[#00aff0]/[0.03] p-4">
                <p className="text-sm font-bold text-white">Desbloquea más contenido</p>
                <p className="mt-1 text-xs text-white/35">Activa un plan premium para acceder a publicaciones exclusivas.</p>
                <Link
                  href="/umate/plans"
                  className="mt-3 block rounded-full bg-[#00aff0] py-2 text-center text-xs font-bold text-white transition hover:bg-[#00aff0]/90"
                >
                  Ver planes
                </Link>
              </div>

              {/* Trending */}
              <div className="rounded-2xl border border-white/[0.05] bg-white/[0.02] p-4">
                <p className="text-xs font-bold uppercase tracking-wider text-white/30">Trending</p>
                <div className="mt-3 space-y-2">
                  {["Contenido fitness", "Lifestyle premium", "Behind the scenes", "Sesiones exclusivas"].map((tag) => (
                    <div key={tag} className="flex items-center gap-2 rounded-lg bg-white/[0.03] px-3 py-2 text-xs font-medium text-white/40">
                      <Flame className="h-3 w-3 text-[#00aff0]/60" /> {tag}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </aside>
        </div>
      </div>
    </div>
  );
}
