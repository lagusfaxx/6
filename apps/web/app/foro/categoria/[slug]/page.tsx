"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { apiFetch } from "../../../../lib/api";
import useMe from "../../../../hooks/useMe";
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
        <Link href="/foro" className="flex h-8 w-8 items-center justify-center rounded-lg bg-white/[0.06] hover:bg-white/10 transition">
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <div className="min-w-0 flex-1">
          <h1 className="text-lg font-bold truncate">{category?.name || "Cargando..."}</h1>
          {category?.description && <p className="text-xs text-white/40 truncate">{category.description}</p>}
        </div>
        {isAuthed && (
          <button
            type="button"
            onClick={() => setShowCreate(true)}
            className="flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-fuchsia-600 to-violet-600 px-3.5 py-2 text-xs font-semibold text-white transition hover:brightness-110"
          >
            <Plus className="h-3.5 w-3.5" /> Nuevo tema
          </button>
        )}
      </div>

      {/* Sort tabs */}
      <div className="mb-4 flex gap-1">
        {(["latest", "replies", "newest"] as const).map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => setSort(s)}
            className={`rounded-full px-3 py-1.5 text-xs font-medium transition ${sort === s ? "bg-fuchsia-500/15 text-fuchsia-300 border border-fuchsia-500/25" : "text-white/50 hover:bg-white/10"}`}
          >
            {s === "latest" ? "Actividad reciente" : s === "replies" ? "Más respuestas" : "Más nuevos"}
          </button>
        ))}
      </div>

      {/* Thread list */}
      {loading ? (
        <div className="space-y-2">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-16 animate-pulse rounded-2xl bg-white/[0.04]" />
          ))}
        </div>
      ) : threads.length === 0 ? (
        <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-8 text-center">
          <MessageSquare className="mx-auto mb-3 h-10 w-10 text-white/20" />
          <p className="text-white/50">No hay temas aún. ¡Sé el primero en crear uno!</p>
        </div>
      ) : (
        <div className="space-y-1.5">
          {threads.map((t) => (
            <Link
              key={t.id}
              href={`/foro/thread/${t.id}`}
              className="group flex items-center gap-3 rounded-2xl border border-white/[0.06] bg-white/[0.02] px-4 py-3 transition hover:border-fuchsia-500/20 hover:bg-white/[0.04]"
            >
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  {t.isPinned && <Pin className="h-3 w-3 shrink-0 text-amber-400" />}
                  {t.isLocked && <Lock className="h-3 w-3 shrink-0 text-red-400" />}
                  <h3 className="text-sm font-medium truncate group-hover:text-fuchsia-300 transition">{t.title}</h3>
                </div>
                <div className="mt-1 flex items-center gap-3 text-[11px] text-white/35">
                  <span>{t.author.username}</span>
                  <span className="flex items-center gap-1"><MessageCircle className="h-3 w-3" />{t.replyCount}</span>
                  <span className="flex items-center gap-1"><Eye className="h-3 w-3" />{t.views}</span>
                  <span className="flex items-center gap-1"><Clock className="h-3 w-3" />{timeAgo(t.lastPostAt)}</span>
                </div>
              </div>
              <ChevronRight className="h-4 w-4 shrink-0 text-white/15 group-hover:text-fuchsia-400 transition" />
            </Link>
          ))}
        </div>
      )}

      {/* Create Thread Modal */}
      {showCreate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setShowCreate(false)} />
          <div className="relative w-full max-w-lg rounded-2xl border border-white/15 bg-[#0d0e1a] p-5 shadow-2xl">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-base font-bold">Nuevo tema</h2>
              <button type="button" onClick={() => setShowCreate(false)} className="rounded-lg p-1.5 hover:bg-white/10 transition">
                <X className="h-4 w-4" />
              </button>
            </div>
            <input
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              placeholder="Título del tema"
              maxLength={200}
              className="mb-3 w-full rounded-xl border border-white/10 bg-white/[0.04] px-4 py-2.5 text-sm text-white placeholder:text-white/30 focus:border-fuchsia-500/40 focus:outline-none"
            />
            <textarea
              value={newContent}
              onChange={(e) => setNewContent(e.target.value)}
              placeholder="Escribe tu mensaje..."
              rows={5}
              className="mb-4 w-full resize-none rounded-xl border border-white/10 bg-white/[0.04] px-4 py-2.5 text-sm text-white placeholder:text-white/30 focus:border-fuchsia-500/40 focus:outline-none"
            />
            <div className="flex justify-end gap-2">
              <button type="button" onClick={() => setShowCreate(false)} className="rounded-xl px-4 py-2 text-sm text-white/60 hover:bg-white/10 transition">
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleCreate}
                disabled={creating || !newTitle.trim() || !newContent.trim()}
                className="rounded-xl bg-gradient-to-r from-fuchsia-600 to-violet-600 px-5 py-2 text-sm font-semibold text-white transition hover:brightness-110 disabled:opacity-50"
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
