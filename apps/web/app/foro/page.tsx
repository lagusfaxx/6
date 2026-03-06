"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { apiFetch } from "../../lib/api";
import { MessageSquare, Clock, ChevronRight, Layers } from "lucide-react";

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

  useEffect(() => {
    apiFetch<{ categories: ForumCategory[] }>("/forum/categories")
      .then((r) => setCategories(r.categories))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="mx-auto max-w-3xl px-4 py-6">
      <div className="mb-6 flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-fuchsia-600/20 to-violet-600/20 border border-fuchsia-500/20">
          <MessageSquare className="h-5 w-5 text-fuchsia-400" />
        </div>
        <div>
          <h1 className="text-xl font-bold">Foro UZEED</h1>
          <p className="text-sm text-white/50">Discusiones de la comunidad</p>
        </div>
      </div>

      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-20 animate-pulse rounded-2xl bg-white/[0.04]" />
          ))}
        </div>
      ) : categories.length === 0 ? (
        <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-8 text-center">
          <Layers className="mx-auto mb-3 h-10 w-10 text-white/20" />
          <p className="text-white/50">No hay categorías disponibles aún.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {categories.map((cat) => (
            <Link
              key={cat.id}
              href={`/foro/categoria/${cat.slug}`}
              className="group flex items-center gap-4 rounded-2xl border border-white/[0.08] bg-white/[0.03] p-4 transition hover:border-fuchsia-500/20 hover:bg-white/[0.05]"
            >
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-fuchsia-500/10">
                <MessageSquare className="h-5 w-5 text-fuchsia-400" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <h2 className="text-sm font-semibold group-hover:text-fuchsia-300 transition">{cat.name}</h2>
                  <span className="rounded-full bg-white/[0.06] px-2 py-0.5 text-[10px] text-white/40">
                    {cat.threadCount} {cat.threadCount === 1 ? "tema" : "temas"}
                  </span>
                </div>
                {cat.description && (
                  <p className="mt-0.5 text-xs text-white/40 line-clamp-1">{cat.description}</p>
                )}
                {cat.lastThread && cat.lastActivity && (
                  <div className="mt-1.5 flex items-center gap-1.5 text-[11px] text-white/30">
                    <Clock className="h-3 w-3" />
                    <span className="truncate">{cat.lastThread.title}</span>
                    <span>·</span>
                    <span className="shrink-0">{timeAgo(cat.lastActivity)}</span>
                  </div>
                )}
              </div>
              <ChevronRight className="h-4 w-4 shrink-0 text-white/20 group-hover:text-fuchsia-400 transition" />
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
