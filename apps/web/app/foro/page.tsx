"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { apiFetch, getApiBase } from "../../lib/api";
import useMe from "../../hooks/useMe";
import {
  MessageSquare,
  Clock,
  ChevronRight,
  Layers,
  Users,
  Search,
  TrendingUp,
  BarChart3,
  Flame,
  Activity,
} from "lucide-react";

type ForumCategory = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  threadCount: number;
  lastActivity: string | null;
  lastThread: { title: string; author: string } | null;
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

export default function ForumPage() {
  const [categories, setCategories] = useState<ForumCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const { me } = useMe();
  const isAuthed = Boolean(me?.user?.id);

  useEffect(() => {
    apiFetch<{ categories: ForumCategory[] }>("/forum/categories")
      .then((r) => setCategories(r.categories))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  // Listen for new threads via SSE to update category stats (authenticated only)
  useEffect(() => {
    if (!isAuthed) return;
    const apiBase = getApiBase();
    if (!apiBase) return;
    let es: EventSource | null = null;
    try {
      es = new EventSource(`${apiBase}/realtime/stream`, { withCredentials: true });
      es.addEventListener("forum:newThread", (ev) => {
        try {
          const data = JSON.parse(ev.data);
          if (data.category?.slug) {
            setCategories((prev) =>
              prev.map((cat) =>
                cat.slug === data.category.slug
                  ? {
                      ...cat,
                      threadCount: cat.threadCount + 1,
                      lastActivity: data.createdAt ?? new Date().toISOString(),
                      lastThread: { title: data.title, author: data.author?.username ?? "Anónimo" },
                    }
                  : cat
              )
            );
          }
        } catch {}
      });
    } catch {}
    return () => { es?.close(); };
  }, [isAuthed]);

  const totalThreads = categories.reduce((sum, c) => sum + c.threadCount, 0);
  const totalCategories = categories.length;

  // Get trending/most active categories (sorted by threadCount desc)
  const trendingCategories = useMemo(() => {
    return [...categories]
      .filter((c) => c.threadCount > 0 && c.lastActivity)
      .sort((a, b) => {
        // Sort by most recent activity
        const aTime = a.lastActivity ? new Date(a.lastActivity).getTime() : 0;
        const bTime = b.lastActivity ? new Date(b.lastActivity).getTime() : 0;
        return bTime - aTime;
      })
      .slice(0, 3);
  }, [categories]);

  const filtered = useMemo(() => {
    if (!search) return categories;
    const q = search.toLowerCase();
    return categories.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        (c.description && c.description.toLowerCase().includes(q))
    );
  }, [categories, search]);

  return (
    <div className="mx-auto max-w-3xl px-4 py-6">
      {/* Header */}
      <div className="mb-5 flex items-center gap-3">
        <div className="relative">
          <div className="absolute inset-0 rounded-xl bg-gradient-to-br from-fuchsia-500/30 to-violet-500/30 blur-xl scale-150" />
          <div className="relative flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br from-fuchsia-600/25 to-violet-600/25 border border-fuchsia-500/20 shadow-[0_0_20px_rgba(168,85,247,0.1)]">
            <MessageSquare className="h-5 w-5 text-fuchsia-400" />
          </div>
        </div>
        <div>
          <h1 className="text-xl font-bold tracking-tight">Foro UZEED</h1>
          <p className="text-[11px] text-white/40">Discusiones de la comunidad</p>
        </div>
      </div>

      {/* Gradient divider */}
      <div className="h-px bg-gradient-to-r from-transparent via-fuchsia-500/20 to-transparent mb-4" />

      {/* Stats bar */}
      {!loading && categories.length > 0 && (
        <div className="mb-4 grid grid-cols-3 gap-2">
          <div className="flex items-center gap-2.5 rounded-2xl border border-white/[0.06] bg-white/[0.02] px-3.5 py-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-gradient-to-br from-fuchsia-500/15 to-violet-500/10 border border-fuchsia-500/15">
              <Layers className="h-3.5 w-3.5 text-fuchsia-400" />
            </div>
            <div>
              <p className="text-sm font-bold text-white/90">{totalCategories}</p>
              <p className="text-[10px] text-white/30">Categorías</p>
            </div>
          </div>
          <div className="flex items-center gap-2.5 rounded-2xl border border-white/[0.06] bg-white/[0.02] px-3.5 py-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-gradient-to-br from-violet-500/15 to-fuchsia-500/10 border border-violet-500/15">
              <MessageSquare className="h-3.5 w-3.5 text-violet-400" />
            </div>
            <div>
              <p className="text-sm font-bold text-white/90">{totalThreads}</p>
              <p className="text-[10px] text-white/30">Temas</p>
            </div>
          </div>
          <div className="flex items-center gap-2.5 rounded-2xl border border-white/[0.06] bg-white/[0.02] px-3.5 py-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-500/15 to-teal-500/10 border border-emerald-500/15">
              <Activity className="h-3.5 w-3.5 text-emerald-400" />
            </div>
            <div>
              <p className="text-sm font-bold text-white/90">
                {categories.filter((c) => {
                  if (!c.lastActivity) return false;
                  return Date.now() - new Date(c.lastActivity).getTime() < 24 * 60 * 60 * 1000;
                }).length}
              </p>
              <p className="text-[10px] text-white/30">Activas hoy</p>
            </div>
          </div>
        </div>
      )}

      {/* Trending section */}
      {!loading && trendingCategories.length > 0 && (
        <div className="mb-4 overflow-hidden rounded-2xl border border-white/[0.06] bg-white/[0.02]">
          <div className="flex items-center gap-2 border-b border-white/[0.05] px-4 py-2.5">
            <Flame className="h-3.5 w-3.5 text-amber-400" />
            <span className="text-xs font-semibold text-white/60">Actividad reciente</span>
          </div>
          <div className="divide-y divide-white/[0.04]">
            {trendingCategories.map((cat) => (
              <Link
                key={cat.id}
                href={`/foro/categoria/${cat.slug}`}
                className="flex items-center gap-3 px-4 py-2.5 transition-colors hover:bg-white/[0.03]"
              >
                <TrendingUp className="h-3 w-3 shrink-0 text-fuchsia-400/60" />
                <div className="min-w-0 flex-1">
                  <span className="text-xs font-medium text-white/70 truncate block">{cat.lastThread?.title || cat.name}</span>
                  <span className="text-[10px] text-white/25">
                    {cat.lastThread?.author && `por ${cat.lastThread.author} · `}
                    {cat.name}
                  </span>
                </div>
                {cat.lastActivity && (
                  <span className="shrink-0 text-[10px] text-fuchsia-400/50">{timeAgo(cat.lastActivity)}</span>
                )}
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* Search */}
      <div className="relative mb-4">
        <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-white/20" />
        <input
          className="w-full rounded-2xl border border-white/[0.07] bg-white/[0.03] py-3 pl-11 pr-4 text-sm text-white placeholder-white/25 outline-none backdrop-blur-sm transition-all duration-200 focus:border-fuchsia-500/30 focus:bg-white/[0.05] focus:ring-1 focus:ring-fuchsia-500/15 focus:shadow-[0_0_20px_rgba(168,85,247,0.08)]"
          placeholder="Buscar categoría..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-24 animate-pulse rounded-2xl bg-white/[0.03] border border-white/[0.04]" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center rounded-2xl border border-white/[0.08] bg-white/[0.02] p-10 text-center backdrop-blur-sm">
          <div className="relative mb-4">
            <div className="absolute inset-0 rounded-full bg-gradient-to-br from-fuchsia-500/15 to-violet-500/15 blur-2xl scale-[2]" />
            <div className="relative flex h-16 w-16 items-center justify-center rounded-2xl border border-white/[0.08] bg-gradient-to-br from-fuchsia-500/[0.06] to-violet-500/[0.04]">
              <Layers className="h-7 w-7 text-white/15" />
            </div>
          </div>
          <p className="text-sm text-white/50">
            {search ? "No se encontraron categorías" : "No hay categorías disponibles aún."}
          </p>
          {search && (
            <button
              type="button"
              onClick={() => setSearch("")}
              className="mt-3 text-xs text-fuchsia-400 hover:underline"
            >
              Limpiar búsqueda
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map((cat, idx) => (
            <Link
              key={cat.id}
              href={`/foro/categoria/${cat.slug}`}
              className="group relative flex items-center gap-4 overflow-hidden rounded-2xl border border-white/[0.07] bg-white/[0.02] p-4 transition-all duration-200 hover:border-fuchsia-500/20 hover:bg-white/[0.04] hover:shadow-[0_0_24px_rgba(168,85,247,0.06)]"
              style={{ animationDelay: `${idx * 60}ms` }}
            >
              {/* Subtle hover glow */}
              <div className="pointer-events-none absolute inset-0 rounded-2xl bg-gradient-to-r from-fuchsia-500/[0.03] to-transparent opacity-0 transition-opacity group-hover:opacity-100" />

              <div className="relative flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-fuchsia-500/10 to-violet-500/[0.06] border border-fuchsia-500/[0.12] transition-all duration-200 group-hover:border-fuchsia-500/25 group-hover:shadow-[0_0_16px_rgba(168,85,247,0.1)]">
                <MessageSquare className="h-5 w-5 text-fuchsia-400/80 transition group-hover:text-fuchsia-400" />
              </div>
              <div className="relative min-w-0 flex-1">
                <div className="flex items-center gap-2.5">
                  <h2 className="text-sm font-semibold group-hover:text-fuchsia-300 transition-colors duration-200">{cat.name}</h2>
                  <span className="flex items-center gap-1 rounded-full bg-white/[0.05] border border-white/[0.06] px-2 py-0.5 text-[10px] text-white/35">
                    <Users className="h-2.5 w-2.5" />
                    {cat.threadCount} {cat.threadCount === 1 ? "tema" : "temas"}
                  </span>
                  {/* Activity indicator for categories active in last hour */}
                  {cat.lastActivity && Date.now() - new Date(cat.lastActivity).getTime() < 3600000 && (
                    <span className="flex items-center gap-1 rounded-full bg-emerald-500/10 border border-emerald-500/15 px-2 py-0.5 text-[10px] text-emerald-400/70">
                      <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
                      Activo
                    </span>
                  )}
                </div>
                {cat.description && (
                  <p className="mt-0.5 text-xs text-white/35 line-clamp-1">{cat.description}</p>
                )}
                {cat.lastThread && cat.lastActivity && (
                  <div className="mt-2 flex items-center gap-1.5 text-[11px] text-white/25">
                    <Clock className="h-3 w-3" />
                    <span className="truncate">{cat.lastThread.title}</span>
                    <span className="text-white/15">·</span>
                    <span className="shrink-0 text-white/30">{cat.lastThread.author}</span>
                    <span className="text-white/15">·</span>
                    <span className="shrink-0 text-fuchsia-400/50">{timeAgo(cat.lastActivity)}</span>
                  </div>
                )}
              </div>
              <ChevronRight className="relative h-4 w-4 shrink-0 text-white/15 transition-all group-hover:text-fuchsia-400 group-hover:translate-x-0.5" />
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
