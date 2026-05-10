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

  // Listen for new threads via SSE to update category stats
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
                      lastThread: { title: data.title, author: data.author?.username ?? "Anonimo" },
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
  const activeToday = categories.filter((c) => {
    if (!c.lastActivity) return false;
    return Date.now() - new Date(c.lastActivity).getTime() < 24 * 60 * 60 * 1000;
  }).length;

  const trendingCategories = useMemo(() => {
    return [...categories]
      .filter((c) => c.threadCount > 0 && c.lastActivity)
      .sort((a, b) => {
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
    <div className="mx-auto max-w-4xl px-4 py-6 md:py-8">
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center gap-3 mb-1">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-fuchsia-600/20 to-violet-600/20 border border-fuchsia-500/20">
            <MessageSquare className="h-5 w-5 text-fuchsia-400" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Foro</h1>
            <p className="text-xs text-white/40">Comunidad UZEED</p>
          </div>
        </div>
      </div>

      {/* Stats */}
      {!loading && categories.length > 0 && (
        <div className="mb-5 grid grid-cols-3 gap-2.5">
          <div className="flex items-center gap-3 rounded-xl border border-white/[0.06] bg-white/[0.02] px-4 py-3">
            <Layers className="h-4 w-4 text-fuchsia-400/60" />
            <div>
              <p className="text-base font-bold text-white/90">{totalCategories}</p>
              <p className="text-[10px] text-white/30">Categorias</p>
            </div>
          </div>
          <div className="flex items-center gap-3 rounded-xl border border-white/[0.06] bg-white/[0.02] px-4 py-3">
            <MessageSquare className="h-4 w-4 text-violet-400/60" />
            <div>
              <p className="text-base font-bold text-white/90">{totalThreads}</p>
              <p className="text-[10px] text-white/30">Temas</p>
            </div>
          </div>
          <div className="flex items-center gap-3 rounded-xl border border-white/[0.06] bg-white/[0.02] px-4 py-3">
            <Activity className="h-4 w-4 text-emerald-400/60" />
            <div>
              <p className="text-base font-bold text-white/90">{activeToday}</p>
              <p className="text-[10px] text-white/30">Activas hoy</p>
            </div>
          </div>
        </div>
      )}

      {/* Trending */}
      {!loading && trendingCategories.length > 0 && (
        <div className="mb-5 overflow-hidden rounded-xl border border-white/[0.06] bg-white/[0.02]">
          <div className="flex items-center gap-2 border-b border-white/[0.05] px-4 py-2.5">
            <Flame className="h-3.5 w-3.5 text-amber-400" />
            <span className="text-xs font-semibold text-white/50">Actividad reciente</span>
          </div>
          <div className="divide-y divide-white/[0.04]">
            {trendingCategories.map((cat) => (
              <Link
                key={cat.id}
                href={`/foro/categoria/${cat.slug}`}
                className="flex items-center gap-3 px-4 py-3 transition-colors hover:bg-white/[0.03]"
              >
                <TrendingUp className="h-3.5 w-3.5 shrink-0 text-fuchsia-400/50" />
                <div className="min-w-0 flex-1">
                  <span className="text-sm text-white/70 truncate block">{cat.lastThread?.title || cat.name}</span>
                  <span className="text-[11px] text-white/25">
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
          className="w-full rounded-xl border border-white/[0.07] bg-white/[0.03] py-2.5 pl-11 pr-4 text-sm text-white placeholder-white/25 outline-none transition-all focus:border-fuchsia-500/30 focus:ring-1 focus:ring-fuchsia-500/15"
          placeholder="Buscar categoria..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {loading ? (
        <div className="space-y-2.5">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-24 animate-pulse rounded-xl bg-white/[0.03]" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center rounded-xl border border-white/[0.08] bg-white/[0.02] p-12 text-center">
          <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-xl border border-white/[0.08] bg-white/[0.03]">
            <Layers className="h-6 w-6 text-white/15" />
          </div>
          <p className="text-sm text-white/50">
            {search ? "No se encontraron categorias" : "No hay categorias disponibles aun."}
          </p>
          {search && (
            <button type="button" onClick={() => setSearch("")} className="mt-3 text-xs text-fuchsia-400 hover:text-fuchsia-300 transition-colors">
              Limpiar busqueda
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map((cat) => (
            <Link
              key={cat.id}
              href={`/foro/categoria/${cat.slug}`}
              className="group flex items-center gap-4 rounded-xl border border-white/[0.06] bg-white/[0.02] p-4 transition-all duration-200 hover:border-fuchsia-500/15 hover:bg-white/[0.04]"
            >
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-fuchsia-500/10 to-violet-500/[0.06] border border-fuchsia-500/[0.12] transition-all group-hover:border-fuchsia-500/25">
                <MessageSquare className="h-5 w-5 text-fuchsia-400/70 transition group-hover:text-fuchsia-400" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2.5">
                  <h2 className="text-sm font-semibold group-hover:text-fuchsia-300 transition-colors">{cat.name}</h2>
                  <span className="flex items-center gap-1 rounded-full bg-white/[0.05] border border-white/[0.06] px-2 py-0.5 text-[10px] text-white/35">
                    <Users className="h-2.5 w-2.5" />
                    {cat.threadCount}
                  </span>
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
                  <div className="mt-1.5 flex items-center gap-1.5 text-[11px] text-white/25">
                    <Clock className="h-3 w-3" />
                    <span className="truncate">{cat.lastThread.title}</span>
                    <span className="text-white/15">·</span>
                    <span className="shrink-0 text-white/30">{cat.lastThread.author}</span>
                    <span className="text-white/15">·</span>
                    <span className="shrink-0 text-fuchsia-400/50">{timeAgo(cat.lastActivity)}</span>
                  </div>
                )}
              </div>
              <ChevronRight className="h-4 w-4 shrink-0 text-white/15 transition-all group-hover:text-fuchsia-400 group-hover:translate-x-0.5" />
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
