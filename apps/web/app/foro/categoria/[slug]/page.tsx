"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { apiFetch } from "../../../../lib/api";
import useMe from "../../../../hooks/useMe";
import Avatar from "../../../../components/Avatar";
import {
  ArrowLeft,
  ChevronRight,
  Clock,
  Eye,
  MessageCircle,
  MessageSquare,
  Pin,
  Lock,
  Plus,
  Search,
  X,
} from "lucide-react";

type ThreadItem = {
  id: string;
  title: string;
  author: { id: string; username: string; avatarUrl: string | null };
  replyCount: number;
  views: number;
  isPinned: boolean;
  isLocked: boolean;
  lastPostAt: string;
  createdAt: string;
};

type CategoryInfo = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
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

export default function CategoryPage() {
  const params = useParams();
  const router = useRouter();
  const slug = params?.slug as string;
  const { me } = useMe();
  const isAuthed = Boolean(me?.user?.id);

  const [category, setCategory] = useState<CategoryInfo | null>(null);
  const [threads, setThreads] = useState<ThreadItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [sort, setSort] = useState<"latest" | "replies" | "newest">("latest");
  const [showCreate, setShowCreate] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newContent, setNewContent] = useState("");
  const [creating, setCreating] = useState(false);
  const [search, setSearch] = useState("");

  const load = useCallback(() => {
    if (!slug) return;
    apiFetch<{ category: CategoryInfo; threads: ThreadItem[] }>(
      `/forum/categories/${slug}/threads?sort=${sort}`
    )
      .then((r) => {
        setCategory(r.category);
        setThreads(r.threads);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [slug, sort]);

  useEffect(() => { load(); }, [load]);

  // Listen for new threads via SSE
  useEffect(() => {
    if (!category) return;
    const apiBase = (process.env.NEXT_PUBLIC_API_URL || "").replace(/\/+$/, "");
    if (!apiBase) return;
    let es: EventSource | null = null;
    try {
      es = new EventSource(`${apiBase}/realtime/stream`, { withCredentials: true });
      es.addEventListener("forum:newThread", (ev) => {
        try {
          const data = JSON.parse(ev.data);
          if (data.category?.slug === slug && data.id) {
            const newThread: ThreadItem = {
              id: data.id,
              title: data.title,
              author: data.author,
              replyCount: 0,
              views: 0,
              isPinned: false,
              isLocked: false,
              lastPostAt: data.createdAt ?? new Date().toISOString(),
              createdAt: data.createdAt ?? new Date().toISOString(),
            };
            setThreads((prev) => {
              if (prev.some((t) => t.id === data.id)) return prev;
              return [newThread, ...prev];
            });
          }
        } catch {}
      });
    } catch {}
    return () => { es?.close(); };
  }, [category, slug]);

  const handleCreate = async () => {
    if (!newTitle.trim() || !newContent.trim() || !category) return;
    setCreating(true);
    try {
      const res = await apiFetch<{ thread: { id: string } }>("/forum/threads", {
        method: "POST",
        body: JSON.stringify({ categoryId: category.id, title: newTitle.trim(), content: newContent.trim() }),
      });
      setShowCreate(false);
      setNewTitle("");
      setNewContent("");
      router.push(`/foro/thread/${res.thread.id}`);
    } catch {
      // error handled silently
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="mx-auto max-w-3xl px-4 py-6">
      {/* Header */}
      <div className="mb-5 flex items-center gap-3">
        <Link href="/foro" className="flex h-9 w-9 items-center justify-center rounded-xl border border-white/[0.08] bg-white/[0.04] text-white/50 hover:bg-white/10 hover:text-white hover:border-white/15 transition-all">
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <div className="min-w-0 flex-1">
          <h1 className="text-lg font-bold truncate tracking-tight">{category?.name || "Cargando..."}</h1>
          {category?.description && <p className="text-[11px] text-white/35 truncate">{category.description}</p>}
        </div>
        {isAuthed && (
          <button
            type="button"
            onClick={() => setShowCreate(true)}
            className="flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-fuchsia-600 to-violet-600 px-4 py-2.5 text-xs font-semibold text-white transition-all hover:scale-[1.02] hover:shadow-[0_8px_24px_rgba(168,85,247,0.25)]"
          >
            <Plus className="h-3.5 w-3.5" /> Nuevo tema
          </button>
        )}
      </div>

      {/* Gradient divider */}
      <div className="h-px bg-gradient-to-r from-transparent via-fuchsia-500/20 to-transparent mb-4" />

      {/* Thread count stats */}
      {!loading && threads.length > 0 && (
        <div className="mb-3 flex items-center gap-4 text-[11px] text-white/30">
          <span className="flex items-center gap-1.5">
            <MessageSquare className="h-3 w-3 text-fuchsia-400/50" />
            {threads.length} {threads.length === 1 ? "tema" : "temas"}
          </span>
          <span className="flex items-center gap-1.5">
            <MessageCircle className="h-3 w-3 text-violet-400/50" />
            {threads.reduce((s, t) => s + t.replyCount, 0)} respuestas
          </span>
          <span className="flex items-center gap-1.5">
            <Eye className="h-3 w-3 text-white/20" />
            {threads.reduce((s, t) => s + t.views, 0)} vistas
          </span>
        </div>
      )}

      {/* Search */}
      <div className="relative mb-3">
        <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-white/20" />
        <input
          className="w-full rounded-2xl border border-white/[0.07] bg-white/[0.03] py-2.5 pl-11 pr-4 text-sm text-white placeholder-white/25 outline-none backdrop-blur-sm transition-all duration-200 focus:border-fuchsia-500/30 focus:bg-white/[0.05] focus:ring-1 focus:ring-fuchsia-500/15"
          placeholder="Buscar tema..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {/* Sort tabs */}
      <div className="mb-4 flex gap-1 p-1 rounded-2xl bg-white/[0.02] border border-white/[0.05]">
        {(["latest", "replies", "newest"] as const).map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => setSort(s)}
            className={`flex-1 rounded-xl px-3 py-2 text-xs font-medium transition-all duration-200 ${sort === s ? "bg-gradient-to-r from-fuchsia-500/15 to-violet-500/10 text-fuchsia-300 border border-fuchsia-500/20 shadow-[0_0_12px_rgba(168,85,247,0.06)]" : "text-white/40 hover:text-white/60 hover:bg-white/[0.03]"}`}
          >
            {s === "latest" ? "Actividad reciente" : s === "replies" ? "Más respuestas" : "Más nuevos"}
          </button>
        ))}
      </div>

      {/* Thread list */}
      {loading ? (
        <div className="space-y-2">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-20 animate-pulse rounded-2xl bg-white/[0.03] border border-white/[0.04]" />
          ))}
        </div>
      ) : (search ? threads.filter((t) => t.title.toLowerCase().includes(search.toLowerCase()) || t.author.username.toLowerCase().includes(search.toLowerCase())) : threads).length === 0 ? (
        <div className="flex flex-col items-center rounded-2xl border border-white/[0.08] bg-white/[0.02] p-10 text-center">
          <div className="relative mb-4">
            <div className="absolute inset-0 rounded-full bg-gradient-to-br from-fuchsia-500/15 to-violet-500/15 blur-2xl scale-[2]" />
            <div className="relative flex h-16 w-16 items-center justify-center rounded-2xl border border-white/[0.08] bg-gradient-to-br from-fuchsia-500/[0.06] to-violet-500/[0.04]">
              <MessageSquare className="h-7 w-7 text-white/15" />
            </div>
          </div>
          <p className="text-sm text-white/50">No hay temas aún. ¡Sé el primero en crear uno!</p>
        </div>
      ) : (
        <div className="space-y-1.5">
          {(search ? threads.filter((t) => t.title.toLowerCase().includes(search.toLowerCase()) || t.author.username.toLowerCase().includes(search.toLowerCase())) : threads).map((t) => (
            <Link
              key={t.id}
              href={`/foro/thread/${t.id}`}
              className="group relative flex items-center gap-3 overflow-hidden rounded-2xl border border-white/[0.06] bg-white/[0.02] px-4 py-3.5 transition-all duration-200 hover:border-fuchsia-500/15 hover:bg-white/[0.04] hover:shadow-[0_0_20px_rgba(168,85,247,0.04)]"
            >
              {/* Hover glow */}
              <div className="pointer-events-none absolute inset-0 rounded-2xl bg-gradient-to-r from-fuchsia-500/[0.02] to-transparent opacity-0 transition-opacity group-hover:opacity-100" />

              {/* Author avatar */}
              <div className="relative shrink-0">
                <Avatar src={t.author.avatarUrl} alt={t.author.username} size={36} />
              </div>

              <div className="relative min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  {t.isPinned && (
                    <span className="flex h-5 w-5 items-center justify-center rounded-md bg-amber-500/10 border border-amber-500/20">
                      <Pin className="h-2.5 w-2.5 text-amber-400" />
                    </span>
                  )}
                  {t.isLocked && (
                    <span className="flex h-5 w-5 items-center justify-center rounded-md bg-red-500/10 border border-red-500/20">
                      <Lock className="h-2.5 w-2.5 text-red-400" />
                    </span>
                  )}
                  <h3 className="text-sm font-medium truncate group-hover:text-fuchsia-300 transition-colors duration-200">{t.title}</h3>
                </div>
                <div className="mt-1.5 flex items-center gap-3 text-[11px] text-white/30">
                  <span className="font-medium text-white/40">{t.author.username}</span>
                  <span className="flex items-center gap-1 text-white/25">
                    <MessageCircle className="h-3 w-3" />
                    {t.replyCount}
                  </span>
                  <span className="flex items-center gap-1 text-white/25">
                    <Eye className="h-3 w-3" />
                    {t.views}
                  </span>
                  <span className="flex items-center gap-1 text-fuchsia-400/40">
                    <Clock className="h-3 w-3" />
                    {timeAgo(t.lastPostAt)}
                  </span>
                </div>
              </div>
              <ChevronRight className="relative h-4 w-4 shrink-0 text-white/10 group-hover:text-fuchsia-400 group-hover:translate-x-0.5 transition-all" />
            </Link>
          ))}
        </div>
      )}

      {/* Create Thread Modal */}
      {showCreate && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/70 backdrop-blur-md" onClick={() => setShowCreate(false)} />
          <div className="relative w-full max-w-lg rounded-t-3xl sm:rounded-3xl border border-white/[0.1] bg-[#0d0e1a]/95 backdrop-blur-2xl p-6 shadow-[0_-12px_60px_rgba(0,0,0,0.5),0_0_40px_rgba(168,85,247,0.05)]">
            {/* Decorative gradient */}
            <div className="pointer-events-none absolute inset-x-0 top-0 h-24 rounded-t-3xl sm:rounded-t-3xl bg-gradient-to-b from-fuchsia-500/[0.04] to-transparent" />

            <div className="relative mb-5 flex items-center justify-between">
              <h2 className="text-base font-bold tracking-tight">Nuevo tema</h2>
              <button type="button" onClick={() => setShowCreate(false)} className="rounded-xl border border-white/[0.08] bg-white/[0.04] p-2 text-white/50 hover:text-white hover:bg-white/10 transition-all">
                <X className="h-4 w-4" />
              </button>
            </div>
            <input
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              placeholder="Título del tema"
              maxLength={200}
              className="relative mb-3 w-full rounded-2xl border border-white/[0.07] bg-white/[0.03] px-4 py-3 text-sm text-white placeholder:text-white/25 focus:border-fuchsia-500/30 focus:ring-1 focus:ring-fuchsia-500/15 focus:outline-none transition-all"
            />
            <textarea
              value={newContent}
              onChange={(e) => setNewContent(e.target.value)}
              placeholder="Escribe tu mensaje..."
              rows={5}
              className="relative mb-4 w-full resize-none rounded-2xl border border-white/[0.07] bg-white/[0.03] px-4 py-3 text-sm text-white placeholder:text-white/25 focus:border-fuchsia-500/30 focus:ring-1 focus:ring-fuchsia-500/15 focus:outline-none transition-all"
            />
            <div className="relative flex justify-end gap-2">
              <button type="button" onClick={() => setShowCreate(false)} className="rounded-xl border border-white/[0.08] bg-white/[0.04] px-4 py-2.5 text-sm text-white/60 hover:bg-white/10 transition-all">
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleCreate}
                disabled={creating || !newTitle.trim() || !newContent.trim()}
                className="rounded-xl bg-gradient-to-r from-fuchsia-600 to-violet-600 px-5 py-2.5 text-sm font-semibold text-white transition-all hover:scale-[1.02] hover:shadow-[0_8px_24px_rgba(168,85,247,0.25)] disabled:opacity-50 disabled:hover:scale-100"
              >
                {creating ? "Creando..." : "Publicar"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
