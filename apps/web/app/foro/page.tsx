"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { apiFetch } from "../../lib/api";
import useMe from "../../hooks/useMe";
import { MessageSquare, Clock, ChevronRight, Layers, Users } from "lucide-react";

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
    const apiBase = (process.env.NEXT_PUBLIC_API_URL || "").replace(/\/+$/, "");
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

  return (
    <div className="mx-auto max-w-3xl px-4 py-6">
      {/* Header */}
      <div className="mb-6 flex items-center gap-3">
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
      <div className="h-px bg-gradient-to-r from-transparent via-fuchsia-500/20 to-transparent mb-5" />

      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-24 animate-pulse rounded-2xl bg-white/[0.03] border border-white/[0.04]" />
          ))}
        </div>
      ) : categories.length === 0 ? (
        <div className="flex flex-col items-center rounded-2xl border border-white/[0.08] bg-white/[0.02] p-10 text-center backdrop-blur-sm">
          <div className="relative mb-4">
            <div className="absolute inset-0 rounded-full bg-gradient-to-br from-fuchsia-500/15 to-violet-500/15 blur-2xl scale-[2]" />
            <div className="relative flex h-16 w-16 items-center justify-center rounded-2xl border border-white/[0.08] bg-gradient-to-br from-fuchsia-500/[0.06] to-violet-500/[0.04]">
              <Layers className="h-7 w-7 text-white/15" />
            </div>
          </div>
          <p className="text-sm text-white/50">No hay categorías disponibles aún.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {categories.map((cat, idx) => (
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
                </div>
                {cat.description && (
                  <p className="mt-0.5 text-xs text-white/35 line-clamp-1">{cat.description}</p>
                )}
                {cat.lastThread && cat.lastActivity && (
                  <div className="mt-2 flex items-center gap-1.5 text-[11px] text-white/25">
                    <Clock className="h-3 w-3" />
                    <span className="truncate">{cat.lastThread.title}</span>
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
