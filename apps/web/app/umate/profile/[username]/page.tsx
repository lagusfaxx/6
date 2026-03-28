"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import {
  BadgeCheck,
  Calendar,
  CheckCircle,
  Grid3X3,
  Heart,
  ImageIcon,
  Loader2,
  Lock,
  MessageCircle,
  Send,
  Share2,
  Shield,
  Trash2,
  UserMinus,
  Users,
  Video,
} from "lucide-react";
import { apiFetch, resolveMediaUrl } from "../../../../lib/api";
import useMe from "../../../../hooks/useMe";
import ProtectedMedia from "../../_components/ProtectedMedia";

type Creator = {
  id: string;
  displayName: string;
  bio: string | null;
  avatarUrl: string | null;
  coverUrl: string | null;
  subscriberCount: number;
  totalPosts: number;
  totalLikes: number;
  status: string;
  user: { username: string; isVerified: boolean };
};

type Post = {
  id: string;
  caption: string | null;
  visibility: "FREE" | "PREMIUM";
  likeCount: number;
  commentCount?: number;
  createdAt: string;
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

export default function CreatorProfilePage() {
  const { username } = useParams<{ username: string }>();
  const { me } = useMe();
  const [creator, setCreator] = useState<Creator | null>(null);
  const [posts, setPosts] = useState<Post[]>([]);
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [loading, setLoading] = useState(true);
  const [subscribing, setSubscribing] = useState(false);
  const [unsubscribing, setUnsubscribing] = useState(false);
  const [tab, setTab] = useState<"all" | "free" | "premium" | "photos" | "videos">("all");
  const [isCreatorUser, setIsCreatorUser] = useState(false);
  const [openComments, setOpenComments] = useState<string | null>(null);
  const [comments, setComments] = useState<Comment[]>([]);
  const [commentText, setCommentText] = useState("");
  const [loadingComments, setLoadingComments] = useState(false);

  useEffect(() => {
    apiFetch<{ creator: Creator; isSubscribed: boolean; posts: Post[] }>(`/umate/profile/${username}`)
      .then((d) => {
        if (!d) return;
        setCreator(d.creator);
        setPosts(d.posts);
        setIsSubscribed(d.isSubscribed);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [username]);

  useEffect(() => {
    if (!me?.user) return;
    apiFetch<{ creator: any }>("/umate/creator/me")
      .then((d) => setIsCreatorUser(Boolean(d?.creator && d.creator.status !== "SUSPENDED")))
      .catch(() => {});
  }, [me]);

  const handleSubscribe = async () => {
    if (!creator || isCreatorUser) return;
    if (!me?.user) {
      window.location.href = `/login?next=/umate/profile/${username}`;
      return;
    }
    setSubscribing(true);
    try {
      const res = await apiFetch<{ subscribed?: boolean }>(`/umate/creators/${creator.id}/subscribe`, { method: "POST" });
      if (res?.subscribed) {
        setIsSubscribed(true);
        setCreator((prev) => prev ? { ...prev, subscriberCount: prev.subscriberCount + 1 } : prev);
      }
    } catch (err: any) {
      if (err?.status === 403 && err?.body?.error === "NO_PLAN") {
        window.location.href = "/umate/plans";
      } else if (err?.status === 401) {
        window.location.href = `/login?next=/umate/profile/${username}`;
      } else {
        window.location.href = "/umate/plans";
      }
    } finally {
      setSubscribing(false);
    }
  };

  const toggleLike = async (postId: string) => {
    const res = await apiFetch<{ liked: boolean }>(`/umate/posts/${postId}/like`, { method: "POST" }).catch(() => null);
    if (!res) return;
    setPosts((prev) => prev.map((p) => (p.id === postId ? { ...p, isLiked: res.liked, likeCount: p.likeCount + (res.liked ? 1 : -1) } : p)));
  };

  const handleUnsubscribe = async () => {
    if (!creator) return;
    setUnsubscribing(true);
    const res = await apiFetch<{ unsubscribed: boolean }>(`/umate/creators/${creator.id}/unsubscribe`, { method: "POST" }).catch(() => null);
    if (res?.unsubscribed) {
      setIsSubscribed(false);
      setCreator((prev) => prev ? { ...prev, subscriberCount: Math.max(0, prev.subscriberCount - 1) } : prev);
    }
    setUnsubscribing(false);
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
      setPosts((prev) => prev.map((p) => (p.id === postId ? { ...p, commentCount: (p.commentCount || 0) + 1 } : p)));
    }
  };

  const deleteComment = async (commentId: string, postId: string) => {
    await apiFetch(`/umate/comments/${commentId}`, { method: "DELETE" }).catch(() => null);
    setComments((prev) => prev.filter((c) => c.id !== commentId));
    setPosts((prev) => prev.map((p) => (p.id === postId ? { ...p, commentCount: Math.max(0, (p.commentCount || 1) - 1) } : p)));
  };

  const filtered = posts.filter((p) => {
    if (tab === "all") return true;
    if (tab === "free") return p.visibility === "FREE";
    if (tab === "premium") return p.visibility === "PREMIUM";
    if (tab === "photos") return p.media.some((m) => m.type === "IMAGE");
    if (tab === "videos") return p.media.some((m) => m.type === "VIDEO");
    return true;
  });

  const premiumCount = posts.filter((p) => p.visibility === "PREMIUM").length;
  const freeCount = posts.filter((p) => p.visibility === "FREE").length;

  if (loading) return (
    <div className="flex flex-col items-center justify-center py-24 gap-3">
      <Loader2 className="h-8 w-8 animate-spin text-[#00aff0]/60" />
    </div>
  );
  if (!creator) return <div className="py-24 text-center text-white/30">Perfil no encontrado.</div>;

  const heroImage = creator.coverUrl || creator.avatarUrl;

  return (
    <div className="min-h-screen relative">
      {/* Blurred background image behind entire profile */}
      {heroImage && (
        <div className="fixed inset-0 z-0">
          <img
            src={resolveMediaUrl(heroImage) || ""}
            alt=""
            className="h-full w-full object-cover scale-110 blur-[80px] brightness-[0.3] saturate-150"
          />
          <div className="absolute inset-0 bg-[#0a0a12]/60" />
        </div>
      )}

      <div className="relative z-10">
      {/* Cover */}
      <div className="relative h-48 overflow-hidden md:h-64 lg:h-72">
        {creator.coverUrl ? (
          <img src={resolveMediaUrl(creator.coverUrl) || ""} alt="" className="h-full w-full object-cover" />
        ) : creator.avatarUrl ? (
          <img src={resolveMediaUrl(creator.avatarUrl) || ""} alt="" className="h-full w-full object-cover scale-125 blur-2xl brightness-75 saturate-150" />
        ) : (
          <div className="h-full w-full bg-gradient-to-br from-[#00aff0]/20 via-purple-600/15 to-pink-500/10" />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-[#0a0a12]/90 via-[#0a0a12]/30 to-transparent" />
      </div>

      {/* Profile info */}
      <div className="mx-auto max-w-[700px] px-4">
        <div className="-mt-12 flex items-end gap-4">
          {/* Avatar */}
          <div className="h-24 w-24 shrink-0 overflow-hidden rounded-2xl border-2 border-white/20 bg-white/10 shadow-[0_4px_30px_rgba(0,175,240,0.15),0_4px_24px_rgba(0,0,0,0.4)] ring-1 ring-white/5 md:h-28 md:w-28">
            {creator.avatarUrl ? (
              <img src={resolveMediaUrl(creator.avatarUrl) || ""} alt="" className="h-full w-full object-cover" />
            ) : (
              <div className="flex h-full items-center justify-center bg-gradient-to-br from-[#00aff0]/20 to-purple-600/20 text-2xl font-bold text-white/60">{(creator.displayName || "?")[0]}</div>
            )}
          </div>

          {/* Subscribe / Actions - desktop */}
          <div className="ml-auto flex items-center gap-2 pb-1">
            {isSubscribed ? (
              <button
                onClick={handleUnsubscribe}
                disabled={unsubscribing}
                className="group inline-flex items-center gap-1.5 rounded-xl bg-emerald-500/10 px-5 py-2.5 text-sm font-semibold text-emerald-400 transition hover:bg-red-500/10 hover:text-red-400 disabled:opacity-50"
              >
                {unsubscribing ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <>
                    <CheckCircle className="h-4 w-4 group-hover:hidden" />
                    <UserMinus className="hidden h-4 w-4 group-hover:block" />
                  </>
                )}
                <span className="group-hover:hidden">Suscrito</span>
                <span className="hidden group-hover:inline">Cancelar</span>
              </button>
            ) : isCreatorUser ? (
              <span className="inline-flex items-center gap-1.5 rounded-xl bg-white/[0.04] px-5 py-2.5 text-sm font-medium text-white/35">
                <Shield className="h-4 w-4" /> Modo creadora
              </span>
            ) : (
              <button
                onClick={handleSubscribe}
                disabled={subscribing}
                className="inline-flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-[#00aff0] to-[#0090d0] px-6 py-2.5 text-sm font-bold text-white shadow-[0_4px_20px_rgba(0,175,240,0.3)] transition-all duration-200 hover:shadow-[0_6px_28px_rgba(0,175,240,0.4)] hover:-translate-y-px disabled:opacity-50"
              >
                {subscribing ? <Loader2 className="h-4 w-4 animate-spin" /> : "Suscribirme"}
              </button>
            )}
            <button className="flex h-9 w-9 items-center justify-center rounded-xl border border-white/[0.06] text-white/35 transition hover:border-white/15 hover:text-white/50">
              <Share2 className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Name & info */}
        <div className="mt-3">
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-extrabold tracking-tight text-white md:text-2xl">{creator.displayName}</h1>
            {creator.user.isVerified && <BadgeCheck className="h-5 w-5 text-[#00aff0]" />}
          </div>
          <p className="text-sm text-white/30">@{creator.user.username}</p>
          {creator.bio && <p className="mt-3 text-sm leading-relaxed text-white/40">{creator.bio}</p>}

          {/* Stats row */}
          <div className="mt-5 flex gap-4">
            {[
              { value: creator.totalPosts, label: "Posts" },
              { value: creator.subscriberCount, label: "Suscriptores" },
              { value: creator.totalLikes, label: "Likes" },
            ].map((s) => (
              <div key={s.label} className="rounded-xl bg-white/[0.06] backdrop-blur-sm border border-white/[0.06] px-4 py-3 text-center flex-1">
                <p className="text-base font-extrabold text-white">{s.value}</p>
                <p className="text-[11px] text-white/30">{s.label}</p>
              </div>
            ))}
          </div>

          <div className="h-px bg-gradient-to-r from-transparent via-white/[0.06] to-transparent mt-5" />
        </div>

        {/* Content tabs */}
        <div className="mt-5 flex gap-1 overflow-x-auto pb-px scrollbar-hide">
          <div className="flex items-center gap-0.5 rounded-xl bg-white/[0.03] p-1">
            {([
              { key: "all" as const, label: "Todos", count: posts.length },
              { key: "photos" as const, label: "Fotos" },
              { key: "videos" as const, label: "Videos" },
              { key: "free" as const, label: "Gratis", count: freeCount },
              { key: "premium" as const, label: "Premium", count: premiumCount },
            ]).map((t) => (
              <button
                key={t.key}
                onClick={() => setTab(t.key)}
                className={`shrink-0 rounded-lg px-4 py-2 text-xs font-semibold transition-all duration-200 ${
                  tab === t.key
                    ? "bg-gradient-to-r from-[#00aff0] to-[#0090d0] text-white shadow-[0_2px_12px_rgba(0,175,240,0.2)]"
                    : "text-white/35 hover:text-white/50"
                }`}
              >
                {t.label}
                {"count" in t && t.count !== undefined && <span className="ml-1 opacity-60">{t.count}</span>}
              </button>
            ))}
          </div>
        </div>

        {/* Posts feed */}
        <div className="mt-5 space-y-5 pb-8">
          {filtered.map((post) => (
            <article key={post.id} className="overflow-hidden rounded-2xl border border-white/[0.06] bg-white/[0.04] backdrop-blur-sm transition-all duration-300 hover:border-white/[0.1] hover:shadow-[0_8px_40px_rgba(0,175,240,0.08)]">
              {/* Caption */}
              {post.caption && (
                <div className="px-4 pt-4 pb-3">
                  <p className="text-sm leading-relaxed text-white/70">{post.caption}</p>
                  <p className="mt-1.5 text-[11px] text-white/45">{new Date(post.createdAt).toLocaleDateString("es-CL", { day: "numeric", month: "short", year: "numeric" })}</p>
                </div>
              )}

              {/* Media */}
              {post.media[0] && (
                <ProtectedMedia
                  enabled={!post.isBlurred && post.visibility === "PREMIUM"}
                  viewerUsername={me?.user?.username}
                >
                  <div className="relative">
                    {post.isBlurred ? (
                      <div className="relative aspect-[4/5] w-full overflow-hidden">
                        {post.media[0].url ? (
                          <img
                            src={resolveMediaUrl(post.media[0].url) || ""}
                            alt=""
                            className="absolute inset-0 h-full w-full object-cover scale-110 blur-3xl brightness-50"
                          />
                        ) : (
                          <div className="absolute inset-0 bg-gradient-to-br from-[#00aff0]/20 via-purple-600/15 to-pink-500/10" />
                        )}
                        <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/40">
                          <div className="rounded-full bg-white/10 p-4 backdrop-blur-sm">
                            <Lock className="h-8 w-8 text-white/70" />
                          </div>
                          <p className="mt-3 text-sm font-bold text-white">Contenido premium</p>
                          <p className="mt-1 text-xs text-white/40">Suscríbete para desbloquear</p>
                          <Link
                            href="/umate/plans"
                            className="mt-3 rounded-full bg-[#00aff0] px-6 py-2 text-sm font-bold text-white transition hover:bg-[#00aff0]/90"
                          >
                            Incluido con tu plan U-Mate
                          </Link>
                        </div>
                      </div>
                    ) : post.media[0].url ? (
                      post.media[0].type === "VIDEO" ? (
                        <video
                          src={resolveMediaUrl(post.media[0].url) || ""}
                          controls
                          playsInline
                          preload="metadata"
                          crossOrigin="anonymous"
                          className="w-full object-cover"
                          style={{ maxHeight: 600 }}
                        />
                      ) : (
                        <img
                          src={resolveMediaUrl(post.media[0].url) || ""}
                          alt=""
                          className="w-full object-cover"
                          style={{ maxHeight: 600 }}
                        />
                      )
                    ) : (
                      <div className="aspect-[4/5] w-full bg-gradient-to-br from-white/[0.04] to-white/[0.02]" />
                    )}
                    {post.visibility === "PREMIUM" && !post.isBlurred && (
                      <span className="absolute right-3 top-3 rounded-full bg-black/60 px-2.5 py-0.5 text-[10px] font-bold text-amber-400 backdrop-blur-sm">
                        Premium
                      </span>
                    )}
                  </div>
                </ProtectedMedia>
              )}

              {/* Actions */}
              <div className="flex items-center gap-4 px-4 py-3">
                <button
                  onClick={() => toggleLike(post.id)}
                  className={`flex items-center gap-1.5 text-sm transition ${
                    post.isLiked ? "text-rose-500" : "text-white/40 hover:text-rose-400"
                  }`}
                >
                  <Heart className={`h-5 w-5 ${post.isLiked ? "fill-current" : ""}`} />
                  <span className="text-xs font-medium">{post.likeCount}</span>
                </button>
                <button
                  onClick={() => openComments === post.id ? setOpenComments(null) : loadComments(post.id)}
                  className={`flex items-center gap-1.5 text-sm transition ${
                    openComments === post.id ? "text-[#00aff0]" : "text-white/40 hover:text-white/50"
                  }`}
                >
                  <MessageCircle className="h-5 w-5" />
                  {(post.commentCount || 0) > 0 && <span className="text-xs font-medium">{post.commentCount}</span>}
                </button>
              </div>

              {/* Comments section */}
              {openComments === post.id && (
                <div className="border-t border-white/[0.04] px-4 py-3 space-y-3">
                  <div className="flex items-center gap-2">
                    <input
                      value={commentText}
                      onChange={(e) => setCommentText(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && postComment(post.id)}
                      placeholder="Escribe un comentario..."
                      className="flex-1 rounded-full border border-white/[0.06] bg-white/[0.03] px-4 py-2 text-sm text-white placeholder-white/20 outline-none focus:border-[#00aff0]/40"
                      maxLength={1000}
                    />
                    <button
                      onClick={() => postComment(post.id)}
                      disabled={!commentText.trim()}
                      className="flex h-8 w-8 items-center justify-center rounded-full bg-[#00aff0] text-white transition hover:bg-[#00aff0]/90 disabled:opacity-30"
                    >
                      <Send className="h-3.5 w-3.5" />
                    </button>
                  </div>
                  {loadingComments && <div className="flex justify-center py-3"><Loader2 className="h-4 w-4 animate-spin text-white/45" /></div>}
                  {!loadingComments && comments.length === 0 && (
                    <p className="text-center text-xs text-white/45 py-2">Sin comentarios aún.</p>
                  )}
                  <div className="space-y-2 max-h-60 overflow-y-auto">
                    {comments.map((c) => (
                      <div key={c.id} className="group flex gap-2">
                        <div className="h-7 w-7 shrink-0 overflow-hidden rounded-full bg-white/[0.06]">
                          {c.user.avatarUrl ? (
                            <img src={resolveMediaUrl(c.user.avatarUrl) || ""} alt="" className="h-full w-full object-cover" />
                          ) : (
                            <div className="flex h-full items-center justify-center text-[10px] font-bold text-white/40">{(c.user.displayName || c.user.username)[0]}</div>
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-xs">
                            <span className="font-semibold text-white/80">{c.user.displayName || c.user.username}</span>{" "}
                            <span className="text-white/50">{c.text}</span>
                          </p>
                          <p className="mt-0.5 text-[10px] text-white/45">{new Date(c.createdAt).toLocaleDateString("es-CL")}</p>
                        </div>
                        <button
                          onClick={() => deleteComment(c.id, post.id)}
                          className="shrink-0 opacity-0 group-hover:opacity-100 transition text-white/40 hover:text-red-400"
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

          {filtered.length === 0 && (
            <div className="rounded-2xl border border-white/[0.04] bg-gradient-to-br from-white/[0.02] to-transparent p-16 text-center">
              <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-white/[0.04]">
                <Grid3X3 className="h-6 w-6 text-white/15" />
              </div>
              <p className="text-sm font-medium text-white/40">No hay contenido en esta categoría</p>
              <p className="mt-1 text-xs text-white/25">Vuelve pronto para ver nuevo contenido.</p>
            </div>
          )}
        </div>
      </div>
      </div>
    </div>
  );
}
