"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { apiFetch, getApiBase, resolveMediaUrl } from "../../../../lib/api";
import useMe from "../../../../hooks/useMe";
import Avatar from "../../../../components/Avatar";
import {
  ArrowLeft,
  Clock,
  Eye,
  Heart,
  Lock,
  MessageCircle,
  Pin,
  Quote,
  Send,
  Share2,
  Shield,
  Trash2,
  User,
} from "lucide-react";

type PostAuthor = { id: string; username: string; avatarUrl: string | null };

type ForumPost = {
  id: string;
  content: string;
  author: PostAuthor;
  createdAt: string;
  updatedAt: string;
};

type ThreadDetail = {
  id: string;
  title: string;
  author: PostAuthor;
  category: { id: string; name: string; slug: string };
  views: number;
  isPinned: boolean;
  isLocked: boolean;
  createdAt: string;
  postCount: number;
};

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "ahora";
  if (mins < 60) return `hace ${mins} min`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `hace ${hours}h`;
  const days = Math.floor(hours / 24);
  return `hace ${days}d`;
}

function formatDate(iso: string): string {
  return new Intl.DateTimeFormat("es-CL", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(iso));
}

function parseOfficialProfilePost(content: string) {
  const lines = content
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);

  const nameLine = lines.find((line) => line.toLowerCase().startsWith("hilo oficial de"));
  const nicknameLine = lines.find((line) => line.toLowerCase().startsWith("nickname:"));
  const photoLine = lines.find((line) => line.toLowerCase().startsWith("foto:"));
  const profileLine = lines.find((line) => line.toLowerCase().startsWith("ver perfil:"));

  const nickname = nicknameLine?.replace(/^nickname:\s*/i, "").trim() || null;
  const photoUrlRaw = photoLine?.replace(/^foto:\s*/i, "").trim() || null;
  const profileUrlRaw = profileLine?.replace(/^ver perfil:\s*/i, "").trim() || null;

  if (!nameLine || !nickname || !profileUrlRaw) return null;

  const displayName = nameLine
    .replace(/^hilo oficial de\s*/i, "")
    .replace(/\.$/, "")
    .trim();

  // Resolve the profile path: handle full URLs, relative paths, and bare usernames
  let profilePath: string;
  if (profileUrlRaw.startsWith("http://") || profileUrlRaw.startsWith("https://")) {
    try {
      const url = new URL(profileUrlRaw);
      profilePath = url.pathname;
    } catch {
      profilePath = `/profile/${nickname}`;
    }
  } else if (profileUrlRaw.startsWith("/")) {
    profilePath = profileUrlRaw;
  } else if (profileUrlRaw.includes("/")) {
    profilePath = `/${profileUrlRaw}`;
  } else {
    // Bare username or slug
    profilePath = `/profile/${profileUrlRaw}`;
  }

  // Resolve photo URL through resolveMediaUrl
  const photoUrl = photoUrlRaw ? resolveMediaUrl(photoUrlRaw) : null;

  return {
    displayName,
    nickname,
    photoUrl,
    profilePath,
  };
}

export default function ThreadPage() {
  const params = useParams();
  const threadId = params?.id as string;
  const { me } = useMe();
  const isAuthed = Boolean(me?.user?.id);
  const isAdmin = me?.user?.role === "ADMIN";
  const bottomRef = useRef<HTMLDivElement>(null);

  const [thread, setThread] = useState<ThreadDetail | null>(null);
  const [posts, setPosts] = useState<ForumPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [replyContent, setReplyContent] = useState("");
  const [sending, setSending] = useState(false);
  const [likedPosts, setLikedPosts] = useState<Set<string>>(new Set());

  const load = useCallback(() => {
    if (!threadId) return;
    apiFetch<{ thread: ThreadDetail; posts: ForumPost[] }>(`/forum/threads/${threadId}`)
      .then((r) => {
        setThread(r.thread);
        setPosts(r.posts);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [threadId]);

  useEffect(() => { load(); }, [load]);

  // Listen for real-time new posts via SSE
  useEffect(() => {
    if (!threadId) return;
    const apiBase = getApiBase();
    if (!apiBase) return;
    let es: EventSource | null = null;
    try {
      es = new EventSource(`${apiBase}/realtime/stream`, { withCredentials: true });
      es.addEventListener("forum:newPost", (ev) => {
        try {
          const data = JSON.parse(ev.data);
          if (data.threadId === threadId && data.post) {
            setPosts((prev) => {
              if (prev.some((p) => p.id === data.post.id)) return prev;
              return [...prev, data.post];
            });
            setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: "smooth" }), 100);
          }
        } catch {}
      });
    } catch {}
    return () => { es?.close(); };
  }, [threadId]);

  const handleReply = async () => {
    if (!replyContent.trim() || !threadId) return;
    setSending(true);
    try {
      const r = await apiFetch<{ post: ForumPost }>(`/forum/threads/${threadId}/posts`, {
        method: "POST",
        body: JSON.stringify({ content: replyContent.trim() }),
      });
      setPosts((prev) => {
        if (prev.some((p) => p.id === r.post.id)) return prev;
        return [...prev, r.post];
      });
      setReplyContent("");
      setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: "smooth" }), 100);
    } catch {}
    setSending(false);
  };

  const handleDeletePost = async (postId: string) => {
    if (!confirm("Eliminar este post?")) return;
    try {
      await apiFetch(`/forum/posts/${postId}`, { method: "DELETE" });
      setPosts((prev) => prev.filter((p) => p.id !== postId));
    } catch {}
  };

  const handleDeleteThread = async () => {
    if (!confirm("Eliminar este tema completo?")) return;
    try {
      await apiFetch(`/forum/threads/${threadId}`, { method: "DELETE" });
      window.location.href = thread?.category ? `/foro/categoria/${thread.category.slug}` : "/foro";
    } catch {}
  };

  const handleToggleLock = async () => {
    if (!thread) return;
    try {
      await apiFetch(`/forum/threads/${threadId}/lock`, {
        method: "PATCH",
        body: JSON.stringify({ locked: !thread.isLocked }),
      });
      setThread((prev) => prev ? { ...prev, isLocked: !prev.isLocked } : prev);
    } catch {}
  };

  if (loading) {
    return (
      <div className="mx-auto max-w-4xl px-4 py-8">
        <div className="space-y-4">
          <div className="h-16 animate-pulse rounded-2xl bg-white/[0.03]" />
          <div className="h-48 animate-pulse rounded-2xl bg-white/[0.03]" />
          <div className="h-32 animate-pulse rounded-2xl bg-white/[0.03]" />
        </div>
      </div>
    );
  }

  if (!thread) {
    return (
      <div className="mx-auto max-w-4xl px-4 py-16 text-center">
        <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl border border-white/[0.08] bg-white/[0.03]">
          <MessageCircle className="h-7 w-7 text-white/20" />
        </div>
        <p className="text-white/50 mb-3">Tema no encontrado.</p>
        <Link href="/foro" className="text-sm text-fuchsia-400 hover:text-fuchsia-300 transition-colors">Volver al foro</Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl px-4 py-6 md:py-8">
      {/* Breadcrumb */}
      <nav className="mb-5 flex items-center gap-2 text-xs text-white/30">
        <Link href="/foro" className="hover:text-fuchsia-400 transition-colors">Foro</Link>
        <span className="text-white/15">/</span>
        <Link href={`/foro/categoria/${thread.category.slug}`} className="hover:text-fuchsia-400 transition-colors">{thread.category.name}</Link>
        <span className="text-white/15">/</span>
        <span className="text-white/50 truncate max-w-[200px]">{thread.title}</span>
      </nav>

      {/* Thread header */}
      <div className="relative mb-6 overflow-hidden rounded-2xl border border-white/[0.08] bg-gradient-to-b from-white/[0.04] to-white/[0.01]">
        <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-fuchsia-500/30 to-transparent" />
        <div className="p-5 md:p-6">
          <div className="flex items-start gap-4">
            <Link href={`/foro/categoria/${thread.category.slug}`} className="mt-1 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-white/[0.08] bg-white/[0.04] text-white/40 hover:bg-white/[0.08] hover:text-white transition-all">
              <ArrowLeft className="h-4 w-4" />
            </Link>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 flex-wrap mb-2">
                {thread.isPinned && (
                  <span className="inline-flex items-center gap-1 rounded-lg bg-amber-500/10 border border-amber-500/20 px-2 py-0.5 text-[10px] text-amber-400 font-medium">
                    <Pin className="h-2.5 w-2.5" /> Fijado
                  </span>
                )}
                {thread.isLocked && (
                  <span className="inline-flex items-center gap-1 rounded-lg bg-red-500/10 border border-red-500/20 px-2 py-0.5 text-[10px] text-red-400 font-medium">
                    <Lock className="h-2.5 w-2.5" /> Bloqueado
                  </span>
                )}
              </div>
              <h1 className="text-xl font-bold tracking-tight text-white">{thread.title}</h1>
              <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-white/35">
                <div className="flex items-center gap-2">
                  <Avatar src={thread.author.avatarUrl} alt={thread.author.username} size={20} />
                  <span className="font-medium text-white/50">{thread.author.username}</span>
                </div>
                <span className="flex items-center gap-1"><Clock className="h-3 w-3 text-white/20" />{formatDate(thread.createdAt)}</span>
                <span className="flex items-center gap-1"><Eye className="h-3 w-3 text-white/20" />{thread.views}</span>
                <span className="flex items-center gap-1"><MessageCircle className="h-3 w-3 text-white/20" />{thread.postCount}</span>
              </div>
            </div>
          </div>

          {/* Admin actions */}
          {isAdmin && (
            <div className="mt-4 flex items-center gap-2 border-t border-white/[0.06] pt-4">
              <Shield className="h-3.5 w-3.5 text-amber-400" />
              <span className="text-[10px] text-amber-400/70 font-semibold uppercase tracking-wider mr-1">Admin</span>
              <button type="button" onClick={handleToggleLock} className="rounded-xl border border-white/[0.08] bg-white/[0.04] px-3 py-1.5 text-[11px] text-white/60 hover:bg-white/[0.08] transition-all">
                {thread.isLocked ? "Desbloquear" : "Bloquear"}
              </button>
              <button type="button" onClick={handleDeleteThread} className="rounded-xl border border-red-500/20 bg-red-500/[0.06] px-3 py-1.5 text-[11px] text-red-400 hover:bg-red-500/15 transition-all">
                Eliminar tema
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Posts */}
      <div className="space-y-3">
        {posts.map((post, idx) => {
          const officialProfile = idx === 0 ? parseOfficialProfilePost(post.content) : null;
          const avatarSrc = resolveMediaUrl(post.author.avatarUrl);

          return (
            <div key={post.id} className="group/post relative overflow-hidden rounded-2xl border border-white/[0.06] bg-white/[0.02] transition-all duration-200 hover:border-white/[0.1]">
              {/* First post accent */}
              {idx === 0 && <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-fuchsia-500/25 to-transparent" />}

              <div className="p-4 md:p-5">
                {/* Post header */}
                <div className="flex items-center gap-3 mb-3">
                  <Link href={`/profile/${post.author.username}`} className="shrink-0">
                    <Avatar src={avatarSrc} alt={post.author.username} size={40} />
                  </Link>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <Link href={`/profile/${post.author.username}`} className="text-sm font-semibold text-white/90 hover:text-fuchsia-400 transition-colors">
                        {post.author.username}
                      </Link>
                      {idx === 0 && (
                        <span className="rounded-full bg-gradient-to-r from-fuchsia-500/15 to-violet-500/10 border border-fuchsia-500/20 px-2 py-0.5 text-[9px] text-fuchsia-300 font-semibold">OP</span>
                      )}
                    </div>
                    <span className="text-[11px] text-white/25">{timeAgo(post.createdAt)}</span>
                  </div>
                  {isAdmin && (
                    <button type="button" onClick={() => handleDeletePost(post.id)} className="rounded-lg p-2 text-white/15 hover:text-red-400 hover:bg-red-500/10 transition-all">
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>

                {/* Post content */}
                {officialProfile ? (
                  <div className="overflow-hidden rounded-xl border border-fuchsia-500/15 bg-gradient-to-br from-fuchsia-500/[0.06] to-violet-500/[0.04]">
                    <div className="p-4">
                      <div className="flex items-center gap-4">
                        {officialProfile.photoUrl ? (
                          <img
                            src={officialProfile.photoUrl}
                            alt={officialProfile.displayName || officialProfile.nickname}
                            className="h-20 w-20 rounded-xl object-cover border border-white/15 shadow-lg"
                          />
                        ) : (
                          <div className="flex h-20 w-20 items-center justify-center rounded-xl border border-white/10 bg-white/[0.04]">
                            <User className="h-8 w-8 text-white/20" />
                          </div>
                        )}
                        <div className="min-w-0 flex-1">
                          <p className="text-base font-bold text-white">
                            {officialProfile.displayName || officialProfile.nickname}
                          </p>
                          <p className="mt-0.5 text-sm text-fuchsia-300/70">
                            @{officialProfile.nickname}
                          </p>
                          <Link
                            href={officialProfile.profilePath}
                            className="mt-3 inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-fuchsia-600 to-violet-600 px-5 py-2.5 text-xs font-semibold text-white transition-all hover:scale-[1.02] hover:shadow-[0_8px_20px_rgba(168,85,247,0.25)]"
                          >
                            <User className="h-3.5 w-3.5" />
                            Ver perfil
                          </Link>
                        </div>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="text-sm text-white/70 whitespace-pre-wrap break-words leading-relaxed pl-[52px]">
                    {post.content}
                  </div>
                )}

                {/* Post interaction buttons */}
                {isAuthed && (
                  <div className="mt-3 flex items-center gap-1 pl-[52px]">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.preventDefault();
                        setLikedPosts((prev) => {
                          const next = new Set(prev);
                          if (next.has(post.id)) next.delete(post.id);
                          else next.add(post.id);
                          return next;
                        });
                      }}
                      className={`flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[11px] transition-all ${
                        likedPosts.has(post.id)
                          ? "text-pink-400 bg-pink-500/10 border border-pink-500/20"
                          : "text-white/25 hover:text-pink-400 hover:bg-pink-500/[0.06] border border-transparent"
                      }`}
                    >
                      <Heart className={`h-3 w-3 ${likedPosts.has(post.id) ? "fill-pink-400" : ""}`} />
                      {likedPosts.has(post.id) ? "1" : ""}
                    </button>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.preventDefault();
                        setReplyContent((prev) => `> ${post.author.username}: ${post.content.slice(0, 100)}${post.content.length > 100 ? "..." : ""}\n\n${prev}`);
                        bottomRef.current?.scrollIntoView({ behavior: "smooth" });
                      }}
                      className="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[11px] text-white/25 hover:text-fuchsia-400 hover:bg-fuchsia-500/[0.06] border border-transparent transition-all"
                    >
                      <Quote className="h-3 w-3" />
                      Citar
                    </button>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.preventDefault();
                        if (navigator.share) {
                          navigator.share({ url: window.location.href });
                        } else {
                          navigator.clipboard.writeText(window.location.href);
                        }
                      }}
                      className="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[11px] text-white/25 hover:text-violet-400 hover:bg-violet-500/[0.06] border border-transparent transition-all"
                    >
                      <Share2 className="h-3 w-3" />
                    </button>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      <div ref={bottomRef} />

      {/* Reply box */}
      {isAuthed && !thread.isLocked ? (
        <div className="mt-6 overflow-hidden rounded-2xl border border-white/[0.08] bg-white/[0.03]">
          <div className="p-4 md:p-5">
            <div className="flex items-center gap-3 mb-3">
              <Avatar src={resolveMediaUrl(me?.user?.avatarUrl)} alt={me?.user?.username} size={32} />
              <span className="text-xs text-white/40">Respondiendo como <span className="text-white/60 font-medium">{me?.user?.username}</span></span>
            </div>
            <textarea
              value={replyContent}
              onChange={(e) => setReplyContent(e.target.value)}
              placeholder="Escribe tu respuesta..."
              rows={3}
              className="w-full resize-none rounded-xl border border-white/[0.07] bg-white/[0.03] px-4 py-3 text-sm text-white placeholder:text-white/25 focus:border-fuchsia-500/30 focus:ring-1 focus:ring-fuchsia-500/15 focus:outline-none transition-all"
            />
            <div className="mt-3 flex justify-end">
              <button
                type="button"
                onClick={handleReply}
                disabled={sending || !replyContent.trim()}
                className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-fuchsia-600 to-violet-600 px-5 py-2.5 text-sm font-semibold text-white transition-all hover:scale-[1.02] hover:shadow-[0_8px_24px_rgba(168,85,247,0.25)] disabled:opacity-50 disabled:hover:scale-100"
              >
                <Send className="h-3.5 w-3.5" />
                {sending ? "Enviando..." : "Responder"}
              </button>
            </div>
          </div>
        </div>
      ) : thread.isLocked ? (
        <div className="mt-6 flex items-center justify-center gap-2 rounded-2xl border border-white/[0.08] bg-white/[0.02] p-5 text-sm text-white/35">
          <Lock className="h-4 w-4 text-white/20" />
          Este tema esta bloqueado.
        </div>
      ) : (
        <div className="mt-6 rounded-2xl border border-white/[0.08] bg-white/[0.02] p-5 text-center text-sm text-white/35">
          <Link href="/login?next=/foro" className="text-fuchsia-400 hover:text-fuchsia-300 transition-colors">Inicia sesion</Link> para responder.
        </div>
      )}
    </div>
  );
}
