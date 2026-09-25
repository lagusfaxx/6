"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  Check,
  Heart,
  Link2,
  Loader2,
  Lock,
  MessageCircle,
  Pin,
  Quote,
  Send,
  Shield,
  Trash2,
  User,
} from "lucide-react";
import { apiFetch, friendlyErrorMessage, resolveMediaUrl } from "../../../../lib/api";
import { connectRealtime } from "../../../../lib/realtime";
import useMe from "../../../../hooks/useMe";
import Avatar from "../../../../components/Avatar";
import {
  PostContent,
  authorName,
  loadDraft,
  loginHref,
  saveDraft,
  timeAgo,
  type ForumAuthor,
} from "../../_components/forumShared";

type ForumPost = {
  id: string;
  content: string;
  author: ForumAuthor;
  createdAt: string;
  updatedAt: string;
  likeCount: number;
  likedByMe: boolean;
};

type ThreadDetail = {
  id: string;
  title: string;
  author: ForumAuthor;
  category: { id: string; name: string; slug: string };
  views: number;
  isPinned: boolean;
  isLocked: boolean;
  createdAt: string;
  postCount: number;
};

type ThreadResponse = { thread: ThreadDetail; posts: ForumPost[]; page: number; pages: number };

function parseOfficialProfilePost(content: string) {
  const lines = content
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);

  const nameLine = lines.find((line) => line.toLowerCase().startsWith("hilo oficial de"));
  const nicknameLine = lines.find((line) => line.toLowerCase().startsWith("nickname:"));
  const photoLine = lines.find((line) => line.toLowerCase().startsWith("foto:"));
  const profileLine = lines.find((line) => line.toLowerCase().startsWith("ver perfil:"));

  const nickname = nicknameLine?.replace(/^nickname:\s*@?/i, "").trim() || null;
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
      profilePath = new URL(profileUrlRaw).pathname;
    } catch {
      profilePath = `/profile/${nickname}`;
    }
  } else if (profileUrlRaw.startsWith("/")) {
    profilePath = profileUrlRaw;
  } else if (profileUrlRaw.includes("/")) {
    profilePath = `/${profileUrlRaw}`;
  } else {
    profilePath = `/profile/${profileUrlRaw}`;
  }

  return {
    displayName,
    nickname,
    photoUrl: photoUrlRaw ? resolveMediaUrl(photoUrlRaw) : null,
    profilePath,
  };
}

export default function ThreadPage() {
  const params = useParams();
  const router = useRouter();
  const threadId = params?.id as string;
  const { me } = useMe();
  const myId = me?.user?.id;
  const isAuthed = Boolean(myId);
  const role = String(me?.user?.role || "").toUpperCase();
  const isStaff = role === "ADMIN" || role === "MODERATOR";
  const draftKey = `thread:${threadId}`;

  const [thread, setThread] = useState<ThreadDetail | null>(null);
  const [posts, setPosts] = useState<ForumPost[]>([]);
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [reply, setReply] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState<string | null>(null);
  const replyRef = useRef<HTMLTextAreaElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  const load = useCallback(() => {
    if (!threadId) return;
    apiFetch<ThreadResponse>(`/forum/threads/${threadId}`)
      .then((r) => {
        setThread(r.thread);
        setPosts(r.posts);
        setPage(r.page);
        setPages(r.pages);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [threadId]);

  useEffect(() => {
    load();
  }, [load, myId]);

  useEffect(() => {
    const d = loadDraft(draftKey);
    if (d) setReply(d);
  }, [draftKey]);

  // Ir al post del enlace (#post-…) una vez cargado.
  useEffect(() => {
    if (loading || typeof window === "undefined" || !window.location.hash) return;
    const el = document.getElementById(window.location.hash.slice(1));
    el?.scrollIntoView({ behavior: "smooth", block: "center" });
  }, [loading]);

  // Respuestas en tiempo real (sólo si ya están todas cargadas, para no
  // mezclar el orden con páginas pendientes).
  const allLoaded = useRef(true);
  allLoaded.current = page >= pages;
  useEffect(() => {
    if (!threadId) return;
    return connectRealtime(({ type, data }) => {
      if (type !== "forum:newPost" || data?.threadId !== threadId || !data.post) return;
      if (!allLoaded.current) return;
      setPosts((prev) =>
        prev.some((p) => p.id === data.post.id)
          ? prev
          : [...prev, { likeCount: 0, likedByMe: false, updatedAt: data.post.createdAt, ...data.post }]
      );
    });
  }, [threadId]);

  const loadMore = async () => {
    if (loadingMore || page >= pages) return;
    setLoadingMore(true);
    try {
      const r = await apiFetch<ThreadResponse>(`/forum/threads/${threadId}?page=${page + 1}`);
      setPosts((prev) => [...prev, ...r.posts.filter((p) => !prev.some((x) => x.id === p.id))]);
      setPage(r.page);
      setPages(r.pages);
    } catch {}
    setLoadingMore(false);
  };

  const goLogin = () => router.push(loginHref(`/foro/thread/${threadId}`));

  const handleReply = async () => {
    const content = reply.trim();
    if (!content || !threadId) return;
    if (!isAuthed) {
      saveDraft(draftKey, reply);
      goLogin();
      return;
    }
    setSending(true);
    setError("");
    try {
      const r = await apiFetch<{ post: ForumPost }>(`/forum/threads/${threadId}/posts`, {
        method: "POST",
        body: JSON.stringify({ content }),
      });
      setPosts((prev) => (prev.some((p) => p.id === r.post.id) ? prev : [...prev, r.post]));
      setReply("");
      saveDraft(draftKey, "");
      setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" }), 80);
    } catch (err) {
      setError(friendlyErrorMessage(err));
    }
    setSending(false);
  };

  const toggleLike = async (post: ForumPost) => {
    if (!isAuthed) return goLogin();
    const optimistic = (liked: boolean, count: number) =>
      setPosts((prev) => prev.map((p) => (p.id === post.id ? { ...p, likedByMe: liked, likeCount: count } : p)));
    optimistic(!post.likedByMe, post.likeCount + (post.likedByMe ? -1 : 1));
    try {
      const r = await apiFetch<{ liked: boolean; likeCount: number }>(`/forum/posts/${post.id}/like`, {
        method: "POST",
      });
      optimistic(r.liked, r.likeCount);
    } catch {
      optimistic(post.likedByMe, post.likeCount);
    }
  };

  const quote = (post: ForumPost) => {
    const text = post.content
      .split("\n")
      .filter((l) => !l.trim().startsWith(">"))
      .join(" ")
      .trim();
    const short = text.length > 160 ? `${text.slice(0, 160)}…` : text;
    setReply((prev) => `> @${post.author.username}: ${short}\n\n${prev}`);
    replyRef.current?.focus();
    replyRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
  };

  const copyLink = async (postId: string) => {
    const url = `${window.location.origin}/foro/thread/${threadId}#post-${postId}`;
    try {
      if (navigator.share && /Mobi|Android/i.test(navigator.userAgent)) {
        await navigator.share({ url, title: thread?.title });
      } else {
        await navigator.clipboard.writeText(url);
        setCopied(postId);
        setTimeout(() => setCopied(null), 1500);
      }
    } catch {}
  };

  const handleDeletePost = async (postId: string) => {
    if (!confirm("¿Eliminar este mensaje?")) return;
    try {
      await apiFetch(`/forum/posts/${postId}`, { method: "DELETE" });
      setPosts((prev) => prev.filter((p) => p.id !== postId));
    } catch (err) {
      alert(friendlyErrorMessage(err));
    }
  };

  const handleDeleteThread = async () => {
    if (!confirm("¿Eliminar este tema completo?")) return;
    try {
      await apiFetch(`/forum/threads/${threadId}`, { method: "DELETE" });
      router.push(thread?.category ? `/foro/categoria/${thread.category.slug}` : "/foro");
    } catch (err) {
      alert(friendlyErrorMessage(err));
    }
  };

  const toggleFlag = async (flag: "lock" | "pin") => {
    if (!thread) return;
    const next = flag === "lock" ? !thread.isLocked : !thread.isPinned;
    try {
      await apiFetch(`/forum/threads/${threadId}/${flag}`, {
        method: "PATCH",
        body: JSON.stringify(flag === "lock" ? { locked: next } : { pinned: next }),
      });
      setThread((prev) => (prev ? { ...prev, [flag === "lock" ? "isLocked" : "isPinned"]: next } : prev));
    } catch (err) {
      alert(friendlyErrorMessage(err));
    }
  };

  if (loading) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-8 space-y-4">
        <div className="h-20 animate-pulse rounded-2xl bg-white/[0.03]" />
        <div className="h-40 animate-pulse rounded-2xl bg-white/[0.03]" />
        <div className="h-28 animate-pulse rounded-2xl bg-white/[0.03]" />
      </div>
    );
  }

  if (!thread) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-16 text-center">
        <MessageCircle className="mx-auto mb-3 h-8 w-8 text-white/20" />
        <p className="mb-3 text-white/50">Tema no encontrado.</p>
        <Link href="/foro" className="text-sm text-fuchsia-400 hover:text-fuchsia-300">
          Volver al foro
        </Link>
      </div>
    );
  }

  const [first, ...replies] = posts;
  const official = first ? parseOfficialProfilePost(first.content) : null;
  const officialName = official ? official.displayName || official.nickname : "";
  const replyCount = Math.max(0, Math.max(thread.postCount, posts.length) - 1);

  const renderPost = (post: ForumPost, isFirst: boolean) => {
    const mine = post.author.id === myId;
    const canDelete = isStaff || (mine && !isFirst);
    const hideBody = isFirst && post.content.trim() === thread.title.trim();
    return (
      <article
        key={post.id}
        id={`post-${post.id}`}
        className={`scroll-mt-24 rounded-2xl border p-4 ${
          isFirst ? "border-white/[0.1] bg-white/[0.04]" : "border-white/[0.06] bg-white/[0.02]"
        }`}
      >
        <header className="mb-2 flex items-center gap-2.5">
          <Link href={`/profile/${post.author.username}`} className="shrink-0">
            <Avatar src={post.author.avatarUrl} alt={post.author.username} size={32} />
          </Link>
          <div className="min-w-0 flex-1 text-[12px]">
            <Link
              href={`/profile/${post.author.username}`}
              className="font-semibold text-white/85 hover:text-fuchsia-300"
            >
              {authorName(post.author)}
            </Link>
            {post.author.id === thread.author.id && !isFirst && (
              <span className="ml-1.5 rounded-full bg-fuchsia-500/15 px-1.5 py-0.5 text-[10px] font-semibold text-fuchsia-300">
                Autor
              </span>
            )}
            <span className="ml-1.5 text-white/35">{timeAgo(post.createdAt)}</span>
          </div>
        </header>

        {!hideBody && (
          <div className="sm:pl-[42px]">
            <PostContent content={post.content} />
          </div>
        )}

        <footer className="mt-2 flex items-center gap-1 sm:pl-[38px]">
          <button
            type="button"
            onClick={() => toggleLike(post)}
            aria-pressed={post.likedByMe}
            className={`flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-[12px] transition ${
              post.likedByMe ? "text-pink-400" : "text-white/40 hover:text-pink-400"
            }`}
          >
            <Heart className={`h-3.5 w-3.5 ${post.likedByMe ? "fill-pink-400" : ""}`} />
            {post.likeCount > 0 ? post.likeCount : "Me gusta"}
          </button>
          {!thread.isLocked && (
            <button
              type="button"
              onClick={() => quote(post)}
              className="flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-[12px] text-white/40 transition hover:text-fuchsia-300"
            >
              <Quote className="h-3.5 w-3.5" />
              Citar
            </button>
          )}
          <button
            type="button"
            onClick={() => copyLink(post.id)}
            aria-label="Copiar enlace"
            className="flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-[12px] text-white/40 transition hover:text-violet-300"
          >
            {copied === post.id ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Link2 className="h-3.5 w-3.5" />}
            {copied === post.id && <span className="text-emerald-400">Copiado</span>}
          </button>
          {canDelete && (
            <button
              type="button"
              onClick={() => handleDeletePost(post.id)}
              aria-label="Eliminar"
              className="ml-auto rounded-lg p-1.5 text-white/25 transition hover:text-red-400"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          )}
        </footer>
      </article>
    );
  };

  return (
    <div className="mx-auto max-w-3xl px-4 py-6 md:py-8">
      {/* Navegación */}
      <nav className="mb-4 flex items-center gap-2 text-xs text-white/40">
        <Link href="/foro" className="flex items-center gap-1 hover:text-fuchsia-300">
          <ArrowLeft className="h-3.5 w-3.5" /> Foro
        </Link>
        <span className="text-white/20">/</span>
        <Link href={`/foro/categoria/${thread.category.slug}`} className="hover:text-fuchsia-300">
          {thread.category.name}
        </Link>
      </nav>

      {official ? (
        /* Hilo de un perfil: la tarjeta del perfil y una invitación a opinar */
        <section className="mb-4 overflow-hidden rounded-2xl border border-fuchsia-500/15 bg-gradient-to-br from-fuchsia-500/[0.07] to-violet-500/[0.04] p-4">
          <div className="flex items-center gap-4">
            {official.photoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={official.photoUrl}
                alt={officialName}
                className="h-20 w-20 shrink-0 rounded-xl border border-white/15 object-cover"
              />
            ) : (
              <div className="flex h-20 w-20 shrink-0 items-center justify-center rounded-xl border border-white/10 bg-white/[0.04]">
                <User className="h-8 w-8 text-white/20" />
              </div>
            )}
            <div className="min-w-0 flex-1">
              <h1 className="truncate text-lg font-bold text-white">{officialName}</h1>
              <p className="text-sm text-fuchsia-300/70">@{official.nickname}</p>
              <Link
                href={official.profilePath}
                className="mt-2 inline-flex items-center gap-1.5 rounded-lg border border-white/15 px-3 py-1.5 text-xs font-medium text-white/80 transition hover:bg-white/[0.08]"
              >
                <User className="h-3.5 w-3.5" /> Ver perfil
              </Link>
            </div>
          </div>
          <p className="mt-3 text-sm text-white/55">
            ¿La conoces? Deja tu opinión para ayudar a otros usuarios. No publiques datos personales.
          </p>
        </section>
      ) : (
        <header className="mb-4">
          <div className="mb-1.5 flex flex-wrap items-center gap-2">
            {thread.isPinned && (
              <span className="inline-flex items-center gap-1 rounded-md bg-amber-500/10 px-1.5 py-0.5 text-[10px] font-medium text-amber-400">
                <Pin className="h-2.5 w-2.5" /> Fijado
              </span>
            )}
            {thread.isLocked && (
              <span className="inline-flex items-center gap-1 rounded-md bg-red-500/10 px-1.5 py-0.5 text-[10px] font-medium text-red-400">
                <Lock className="h-2.5 w-2.5" /> Cerrado
              </span>
            )}
          </div>
          <h1 className="text-xl font-bold leading-snug tracking-tight text-white md:text-2xl">{thread.title}</h1>
          <p className="mt-1 text-xs text-white/35">
            {thread.views} vistas · {replyCount} {replyCount === 1 ? "respuesta" : "respuestas"}
          </p>
        </header>
      )}

      {isStaff && (
        <div className="mb-4 flex flex-wrap items-center gap-2 rounded-xl border border-amber-500/15 bg-amber-500/[0.04] px-3 py-2">
          <Shield className="h-3.5 w-3.5 text-amber-400" />
          <span className="mr-1 text-[10px] font-semibold uppercase tracking-wider text-amber-400/80">Moderación</span>
          <AdminButton onClick={() => toggleFlag("pin")}>{thread.isPinned ? "Desfijar" : "Fijar"}</AdminButton>
          <AdminButton onClick={() => toggleFlag("lock")}>{thread.isLocked ? "Reabrir" : "Cerrar"}</AdminButton>
          <AdminButton danger onClick={handleDeleteThread}>
            Eliminar tema
          </AdminButton>
        </div>
      )}

      <div className="space-y-2.5">
        {first && !official && renderPost(first, true)}

        {replies.length > 0 && (
          <h2 className="px-1 pt-3 text-xs font-semibold uppercase tracking-wider text-white/35">
            {official ? "Opiniones" : "Respuestas"}
          </h2>
        )}
        {replies.map((p) => renderPost(p, false))}

        {page < pages && (
          <button
            type="button"
            onClick={loadMore}
            disabled={loadingMore}
            className="flex w-full items-center justify-center gap-2 rounded-xl border border-white/[0.08] bg-white/[0.02] py-3 text-sm text-white/60 transition hover:bg-white/[0.05]"
          >
            {loadingMore && <Loader2 className="h-4 w-4 animate-spin" />}
            Ver más respuestas
          </button>
        )}
      </div>

      <div ref={bottomRef} />

      {/* Responder: visible siempre; sin sesión guarda el borrador y pide login */}
      {thread.isLocked ? (
        <div className="mt-5 flex items-center justify-center gap-2 rounded-2xl border border-white/[0.08] bg-white/[0.02] p-5 text-sm text-white/40">
          <Lock className="h-4 w-4" /> Este tema está cerrado.
        </div>
      ) : (
        <div className="sticky bottom-3 z-10 mt-5 rounded-2xl border border-white/[0.1] bg-[#0d0e1a]/95 p-3 shadow-[0_-8px_30px_rgba(0,0,0,0.35)] backdrop-blur-xl">
          {replies.length === 0 && (
            <p className="mb-2 px-1 text-xs text-white/45">
              {official ? `Sé el primero en opinar sobre ${officialName}.` : "Nadie ha respondido todavía. ¡Sé el primero!"}
            </p>
          )}
          <div className="flex items-end gap-2">
            <textarea
              ref={replyRef}
              value={reply}
              onChange={(e) => setReply(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) handleReply();
              }}
              placeholder={official ? "Escribe tu opinión…" : "Escribe una respuesta…"}
              rows={reply.includes("\n") || reply.length > 80 ? 4 : 1}
              maxLength={10000}
              className="min-h-[42px] flex-1 resize-none rounded-xl border border-white/[0.08] bg-white/[0.03] px-3.5 py-2.5 text-sm text-white placeholder:text-white/30 outline-none transition focus:border-fuchsia-500/40"
            />
            <button
              type="button"
              onClick={handleReply}
              disabled={sending || !reply.trim()}
              aria-label="Enviar"
              className="flex h-[42px] shrink-0 items-center gap-1.5 rounded-xl bg-gradient-to-r from-fuchsia-600 to-violet-600 px-4 text-sm font-semibold text-white transition hover:brightness-110 disabled:opacity-40"
            >
              {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              <span className="hidden sm:inline">{isAuthed ? "Enviar" : "Entrar y enviar"}</span>
            </button>
          </div>
          {error && <p className="mt-2 px-1 text-xs text-red-400">{error}</p>}
          {!isAuthed && (
            <p className="mt-2 px-1 text-[11px] text-white/35">
              Necesitas una cuenta para publicar; guardamos lo que escribas mientras inicias sesión.
            </p>
          )}
        </div>
      )}
    </div>
  );
}

function AdminButton({
  children,
  onClick,
  danger,
}: {
  children: React.ReactNode;
  onClick: () => void;
  danger?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-lg border px-2.5 py-1 text-[11px] transition ${
        danger
          ? "border-red-500/20 text-red-400 hover:bg-red-500/10"
          : "border-white/[0.1] text-white/60 hover:bg-white/[0.06]"
      }`}
    >
      {children}
    </button>
  );
}
