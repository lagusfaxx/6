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
          <div className="h-12 animate-pulse rounded-2xl bg-white/[0.04]" />
          <div className="h-32 animate-pulse rounded-2xl bg-white/[0.04]" />
          <div className="h-32 animate-pulse rounded-2xl bg-white/[0.04]" />
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
      <div className="mb-4 flex items-center gap-2 text-xs text-white/40">
        <Link href="/foro" className="hover:text-fuchsia-400 transition">Foro</Link>
        <span>/</span>
        <Link href={`/foro/categoria/${thread.category.slug}`} className="hover:text-fuchsia-400 transition">{thread.category.name}</Link>
      </div>

      {/* Thread header */}
      <div className="mb-5 rounded-2xl border border-white/[0.08] bg-white/[0.03] p-4">
        <div className="flex items-start gap-3">
          <Link href={`/foro/categoria/${thread.category.slug}`} className="mt-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-white/[0.06] hover:bg-white/10 transition">
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              {thread.isPinned && <Pin className="h-3.5 w-3.5 text-amber-400 shrink-0" />}
              {thread.isLocked && <Lock className="h-3.5 w-3.5 text-red-400 shrink-0" />}
              <h1 className="text-lg font-bold">{thread.title}</h1>
            </div>
            <div className="mt-1.5 flex flex-wrap items-center gap-3 text-xs text-white/40">
              <span>por {thread.author.username}</span>
              <span className="flex items-center gap-1"><Clock className="h-3 w-3" />{formatDate(thread.createdAt)}</span>
              <span className="flex items-center gap-1"><Eye className="h-3 w-3" />{thread.views} vistas</span>
              <span className="flex items-center gap-1"><MessageCircle className="h-3 w-3" />{thread.postCount} posts</span>
            </div>
          </div>
        </div>

        {/* Admin actions */}
        {isAdmin && (
          <div className="mt-3 flex items-center gap-2 border-t border-white/[0.06] pt-3">
            <Shield className="h-3.5 w-3.5 text-amber-400" />
            <span className="text-[10px] text-amber-400/70 font-semibold uppercase tracking-wider">Admin</span>
            <button type="button" onClick={handleToggleLock} className="rounded-lg bg-white/[0.06] px-2.5 py-1 text-[11px] hover:bg-white/10 transition">
              {thread.isLocked ? "Desbloquear" : "Bloquear"}
            </button>
            <button type="button" onClick={handleDeleteThread} className="rounded-lg bg-red-500/10 px-2.5 py-1 text-[11px] text-red-400 hover:bg-red-500/20 transition">
              Eliminar tema
            </button>
          </div>
        )}
      </div>

      {/* Posts */}
      <div className="space-y-3">
        {posts.map((post, idx) => (
          <div key={post.id} className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-4">
            <div className="flex items-start gap-3">
              <Avatar src={post.author.avatarUrl} alt={post.author.username} size={36} className="shrink-0 border-white/20" />
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 text-xs">
                  <span className="font-semibold text-white/90">{post.author.username}</span>
                  {idx === 0 && (
                    <span className="rounded-full bg-fuchsia-500/10 border border-fuchsia-500/20 px-1.5 py-0.5 text-[9px] text-fuchsia-300 font-medium">OP</span>
                  )}
                  <span className="text-white/30">{timeAgo(post.createdAt)}</span>
                  {isAdmin && (
                    <button type="button" onClick={() => handleDeletePost(post.id)} className="ml-auto rounded-md p-1 text-white/20 hover:text-red-400 hover:bg-red-500/10 transition">
                      <Trash2 className="h-3 w-3" />
                    </button>
                  )}
                </div>
                <div className="mt-2 text-sm text-white/80 whitespace-pre-wrap break-words leading-relaxed">
                  {post.content}
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      <div ref={bottomRef} />

      {/* Reply box */}
      {isAuthed && !thread.isLocked ? (
        <div className="mt-4 rounded-2xl border border-white/[0.08] bg-white/[0.03] p-4">
          <textarea
            value={replyContent}
            onChange={(e) => setReplyContent(e.target.value)}
            placeholder="Escribe tu respuesta..."
            rows={3}
            className="w-full resize-none rounded-xl border border-white/10 bg-white/[0.04] px-4 py-2.5 text-sm text-white placeholder:text-white/30 focus:border-fuchsia-500/40 focus:outline-none"
          />
          <div className="mt-2 flex justify-end">
            <button
              type="button"
              onClick={handleReply}
              disabled={sending || !replyContent.trim()}
              className="flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-fuchsia-600 to-violet-600 px-4 py-2 text-sm font-semibold text-white transition hover:brightness-110 disabled:opacity-50"
            >
              <Send className="h-3.5 w-3.5" />
              {sending ? "Enviando..." : "Responder"}
            </button>
          </div>
        </div>
      ) : thread.isLocked ? (
        <div className="mt-4 rounded-2xl border border-white/10 bg-white/[0.03] p-4 text-center text-sm text-white/40">
          <Lock className="mx-auto mb-1 h-4 w-4" /> Este tema está bloqueado.
        </div>
      ) : (
        <div className="mt-4 rounded-2xl border border-white/10 bg-white/[0.03] p-4 text-center text-sm text-white/40">
          <Link href="/login?next=/foro" className="text-fuchsia-400 hover:underline">Inicia sesión</Link> para responder.
        </div>
      )}
    </div>
  );
}
