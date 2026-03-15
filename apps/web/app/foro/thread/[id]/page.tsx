"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { apiFetch } from "../../../../lib/api";
import { resolveMediaUrl } from "../../../../lib/api";
import useMe from "../../../../hooks/useMe";
import Avatar from "../../../../components/Avatar";
import {
  ArrowLeft,
  Clock,
  Eye,
  Lock,
  MessageCircle,
  Pin,
  Send,
  Shield,
  Trash2,
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

  const profilePath = profileUrlRaw.startsWith("/")
    ? profileUrlRaw
    : `/${profileUrlRaw}`;

  return {
    displayName,
    nickname,
    photoUrl: photoUrlRaw ? resolveMediaUrl(photoUrlRaw) || photoUrlRaw : null,
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
    const apiBase = (process.env.NEXT_PUBLIC_API_URL || "").replace(/\/+$/, "");
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
    if (!confirm("¿Eliminar este post?")) return;
    try {
      await apiFetch(`/forum/posts/${postId}`, { method: "DELETE" });
      setPosts((prev) => prev.filter((p) => p.id !== postId));
    } catch {}
  };

  const handleDeleteThread = async () => {
    if (!confirm("¿Eliminar este tema completo?")) return;
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
      <div className="mx-auto max-w-3xl px-4 py-6">
        <div className="space-y-3">
          <div className="h-14 animate-pulse rounded-2xl bg-white/[0.03] border border-white/[0.04]" />
          <div className="h-36 animate-pulse rounded-2xl bg-white/[0.03] border border-white/[0.04]" />
          <div className="h-36 animate-pulse rounded-2xl bg-white/[0.03] border border-white/[0.04]" />
        </div>
      </div>
    );
  }

  if (!thread) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-6 text-center">
        <p className="text-white/50">Tema no encontrado.</p>
        <Link href="/foro" className="mt-2 inline-block text-sm text-fuchsia-400 hover:underline">Volver al foro</Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-6">
      {/* Breadcrumb */}
      <div className="mb-4 flex items-center gap-2 text-xs text-white/30">
        <Link href="/foro" className="hover:text-fuchsia-400 transition-colors">Foro</Link>
        <span className="text-white/15">/</span>
        <Link href={`/foro/categoria/${thread.category.slug}`} className="hover:text-fuchsia-400 transition-colors">{thread.category.name}</Link>
      </div>

      {/* Thread header */}
      <div className="relative mb-5 overflow-hidden rounded-2xl border border-white/[0.07] bg-white/[0.02] p-5 backdrop-blur-sm">
        {/* Header glow */}
        <div className="pointer-events-none absolute inset-x-0 top-0 h-16 bg-gradient-to-b from-fuchsia-500/[0.03] to-transparent" />

        <div className="relative flex items-start gap-3">
          <Link href={`/foro/categoria/${thread.category.slug}`} className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-white/[0.08] bg-white/[0.04] text-white/50 hover:bg-white/10 hover:text-white transition-all">
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              {thread.isPinned && (
                <span className="flex h-5 w-5 items-center justify-center rounded-md bg-amber-500/10 border border-amber-500/20">
                  <Pin className="h-2.5 w-2.5 text-amber-400" />
                </span>
              )}
              {thread.isLocked && (
                <span className="flex h-5 w-5 items-center justify-center rounded-md bg-red-500/10 border border-red-500/20">
                  <Lock className="h-2.5 w-2.5 text-red-400" />
                </span>
              )}
              <h1 className="text-lg font-bold tracking-tight">{thread.title}</h1>
            </div>
            <div className="mt-2 flex flex-wrap items-center gap-3 text-xs text-white/35">
              <span className="font-medium text-white/45">por {thread.author.username}</span>
              <span className="flex items-center gap-1"><Clock className="h-3 w-3 text-white/20" />{formatDate(thread.createdAt)}</span>
              <span className="flex items-center gap-1"><Eye className="h-3 w-3 text-white/20" />{thread.views} vistas</span>
              <span className="flex items-center gap-1"><MessageCircle className="h-3 w-3 text-white/20" />{thread.postCount} posts</span>
            </div>
          </div>
        </div>

        {/* Admin actions */}
        {isAdmin && (
          <div className="relative mt-4 flex items-center gap-2 border-t border-white/[0.05] pt-3">
            <Shield className="h-3.5 w-3.5 text-amber-400" />
            <span className="text-[10px] text-amber-400/70 font-semibold uppercase tracking-wider">Admin</span>
            <button type="button" onClick={handleToggleLock} className="rounded-xl border border-white/[0.08] bg-white/[0.04] px-3 py-1.5 text-[11px] hover:bg-white/10 transition-all">
              {thread.isLocked ? "Desbloquear" : "Bloquear"}
            </button>
            <button type="button" onClick={handleDeleteThread} className="rounded-xl border border-red-500/20 bg-red-500/[0.06] px-3 py-1.5 text-[11px] text-red-400 hover:bg-red-500/15 transition-all">
              Eliminar tema
            </button>
          </div>
        )}
      </div>

      {/* Gradient divider */}
      <div className="h-px bg-gradient-to-r from-transparent via-fuchsia-500/15 to-transparent mb-4" />

      {/* Posts */}
      <div className="space-y-2.5">
        {posts.map((post, idx) => {
          const officialProfile = idx === 0 ? parseOfficialProfilePost(post.content) : null;

          return (
            <div key={post.id} className="group/post relative overflow-hidden rounded-2xl border border-white/[0.06] bg-white/[0.02] p-4 transition-all duration-200 hover:border-white/[0.1]">
              {/* First post glow */}
              {idx === 0 && <div className="pointer-events-none absolute inset-x-0 top-0 h-12 bg-gradient-to-b from-fuchsia-500/[0.02] to-transparent" />}

              <div className="relative flex items-start gap-3">
                <div className="shrink-0">
                  <Avatar src={post.author.avatarUrl} alt={post.author.username} size={38} className="border-white/15 ring-1 ring-white/[0.06] ring-offset-1 ring-offset-transparent" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 text-xs">
                    <span className="font-semibold text-white/90">{post.author.username}</span>
                    {idx === 0 && (
                      <span className="rounded-full bg-gradient-to-r from-fuchsia-500/15 to-violet-500/10 border border-fuchsia-500/20 px-2 py-0.5 text-[9px] text-fuchsia-300 font-semibold shadow-[0_0_8px_rgba(168,85,247,0.1)]">OP</span>
                    )}
                    <span className="text-white/25">{timeAgo(post.createdAt)}</span>
                    {isAdmin && (
                      <button type="button" onClick={() => handleDeletePost(post.id)} className="ml-auto rounded-lg border border-transparent p-1.5 text-white/15 hover:text-red-400 hover:bg-red-500/10 hover:border-red-500/20 transition-all">
                        <Trash2 className="h-3 w-3" />
                      </button>
                    )}
                  </div>

                  {officialProfile ? (
                    <div className="mt-3 overflow-hidden rounded-2xl border border-fuchsia-400/20 bg-gradient-to-br from-fuchsia-500/[0.08] to-violet-500/[0.06] p-4 shadow-[0_0_24px_rgba(168,85,247,0.06)]">
                      <div className="flex items-center gap-3">
                        {officialProfile.photoUrl ? (
                          <img
                            src={officialProfile.photoUrl}
                            alt={officialProfile.displayName || officialProfile.nickname}
                            className="h-16 w-16 rounded-xl object-cover border border-white/15 shadow-lg"
                          />
                        ) : (
                          <div className="grid h-16 w-16 place-items-center rounded-xl border border-white/10 bg-white/[0.04] text-xs text-white/40">
                            Sin foto
                          </div>
                        )}
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-bold text-white/95">
                            {officialProfile.displayName || officialProfile.nickname}
                          </p>
                          <p className="truncate text-xs text-fuchsia-200/70">
                            {officialProfile.nickname}
                          </p>
                        </div>
                        <Link
                          href={officialProfile.profilePath}
                          className="shrink-0 rounded-xl bg-gradient-to-r from-fuchsia-600 to-violet-600 px-4 py-2.5 text-xs font-semibold text-white transition-all hover:scale-[1.02] hover:shadow-[0_8px_20px_rgba(168,85,247,0.25)]"
                        >
                          Ver perfil
                        </Link>
                      </div>
                    </div>
                  ) : (
                    <div className="mt-2 text-sm text-white/75 whitespace-pre-wrap break-words leading-relaxed">
                      {post.content}
                    </div>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <div ref={bottomRef} />

      {/* Reply box */}
      {isAuthed && !thread.isLocked ? (
        <div className="mt-5 relative overflow-hidden rounded-2xl border border-white/[0.07] bg-white/[0.02] p-4 backdrop-blur-sm">
          <div className="pointer-events-none absolute inset-x-0 bottom-0 h-12 bg-gradient-to-t from-fuchsia-500/[0.02] to-transparent" />
          <textarea
            value={replyContent}
            onChange={(e) => setReplyContent(e.target.value)}
            placeholder="Escribe tu respuesta..."
            rows={3}
            className="relative w-full resize-none rounded-2xl border border-white/[0.07] bg-white/[0.03] px-4 py-3 text-sm text-white placeholder:text-white/25 focus:border-fuchsia-500/30 focus:ring-1 focus:ring-fuchsia-500/15 focus:outline-none focus:shadow-[0_0_20px_rgba(168,85,247,0.06)] transition-all"
          />
          <div className="relative mt-3 flex justify-end">
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
      ) : thread.isLocked ? (
        <div className="mt-5 rounded-2xl border border-white/[0.08] bg-white/[0.02] p-5 text-center text-sm text-white/35 backdrop-blur-sm">
          <Lock className="mx-auto mb-1.5 h-4 w-4 text-white/20" /> Este tema está bloqueado.
        </div>
      ) : (
        <div className="mt-5 rounded-2xl border border-white/[0.08] bg-white/[0.02] p-5 text-center text-sm text-white/35 backdrop-blur-sm">
          <Link href="/login?next=/foro" className="text-fuchsia-400 hover:underline">Inicia sesión</Link> para responder.
        </div>
      )}
    </div>
  );
}
