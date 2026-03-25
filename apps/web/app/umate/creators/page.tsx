"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  BadgeCheck,
  Eye,
  Grid3X3,
  Heart,
  LayoutGrid,
  Loader2,
  Rows3,
  Search,
  SlidersHorizontal,
  Star,
  TrendingUp,
  Users,
  Users2,
} from "lucide-react";
import { apiFetch } from "../../../lib/api";

type Creator = {
  id: string;
  displayName: string;
  bio: string | null;
  avatarUrl: string | null;
  coverUrl: string | null;
  subscriberCount: number;
  totalLikes: number;
  totalPosts?: number;
  user: { username: string; isVerified?: boolean };
};

export default function CreatorsPage() {
  const [creators, setCreators] = useState<Creator[]>([]);
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState<"popular" | "growth" | "new">("popular");
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<"grid" | "list">("grid");

  useEffect(() => {
    setLoading(true);
    const params = new URLSearchParams();
    if (search.trim()) params.set("q", search.trim());
    params.set("limit", "60");
    apiFetch<{ creators: Creator[] }>(`/umate/creators?${params}`)
      .then((d) => setCreators(d?.creators || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [search]);

  const ordered = useMemo(() => {
    const list = [...creators];
    if (sort === "popular") list.sort((a, b) => b.subscriberCount - a.subscriberCount);
    if (sort === "growth") list.sort((a, b) => b.totalLikes - a.totalLikes);
    return list;
  }, [creators, sort]);

  return (
    <div className="min-h-screen">
      {/* Header */}
      <div className="border-b border-slate-100 bg-gradient-to-b from-rose-50/50 to-white pb-6 pt-6 lg:pt-10">
        <div className="mx-auto max-w-[1320px] px-4 lg:px-6">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <div className="flex items-center gap-2">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-r from-rose-500 to-fuchsia-500 shadow-lg shadow-rose-300/30">
                  <Users2 className="h-5 w-5 text-white" />
                </div>
                <h1 className="text-3xl font-black text-slate-900">Creadoras</h1>
              </div>
              <p className="mt-2 max-w-md text-sm text-slate-500">Catálogo completo de perfiles. Filtra por popularidad, engagement o estilo.</p>
            </div>
            <div className="flex items-center gap-3">
              <span className="rounded-lg bg-fuchsia-50 px-3 py-1.5 text-xs font-bold text-fuchsia-700">{ordered.length} perfiles</span>
              <span className="rounded-lg bg-slate-100 px-3 py-1.5 text-xs font-bold text-slate-600">
                {creators.reduce((a, c) => a + c.subscriberCount, 0)} suscriptores
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Toolbar */}
      <div className="sticky top-16 z-30 border-b border-slate-100 bg-white/95 py-3 backdrop-blur-xl">
        <div className="mx-auto flex max-w-[1320px] flex-wrap items-center gap-3 px-4 lg:px-6">
          <div className="relative min-w-[200px] flex-1 sm:max-w-sm">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar por nombre, username o estilo..."
              className="w-full rounded-xl border border-slate-200 bg-white py-2.5 pl-10 pr-3 text-sm outline-none transition focus:border-fuchsia-300 focus:ring-2 focus:ring-fuchsia-100"
            />
          </div>

          <div className="flex items-center gap-1 rounded-xl border border-slate-200 p-1">
            {[
              { key: "popular" as const, label: "Populares", icon: TrendingUp },
              { key: "growth" as const, label: "Engagement", icon: Heart },
              { key: "new" as const, label: "Recientes", icon: Star },
            ].map((s) => (
              <button
                key={s.key}
                onClick={() => setSort(s.key)}
                className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
                  sort === s.key ? "bg-fuchsia-50 text-fuchsia-700" : "text-slate-500 hover:text-slate-700"
                }`}
              >
                <s.icon className="h-3.5 w-3.5" /> <span className="hidden sm:inline">{s.label}</span>
              </button>
            ))}
          </div>

          <div className="ml-auto hidden items-center gap-1 rounded-lg border border-slate-200 p-0.5 sm:flex">
            <button onClick={() => setView("grid")} className={`rounded-md p-1.5 ${view === "grid" ? "bg-slate-100 text-slate-700" : "text-slate-400"}`}>
              <LayoutGrid className="h-4 w-4" />
            </button>
            <button onClick={() => setView("list")} className={`rounded-md p-1.5 ${view === "list" ? "bg-slate-100 text-slate-700" : "text-slate-400"}`}>
              <Rows3 className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="mx-auto max-w-[1320px] px-4 py-6 lg:px-6">
        {loading && (
          <div className="flex justify-center py-20">
            <Loader2 className="h-8 w-8 animate-spin text-fuchsia-500" />
          </div>
        )}

        {!loading && ordered.length === 0 && (
          <div className="rounded-2xl border border-slate-100 bg-white p-16 text-center">
            <Users className="mx-auto mb-3 h-8 w-8 text-slate-300" />
            <p className="text-sm font-semibold text-slate-700">No se encontraron creadoras.</p>
            <p className="mt-1 text-xs text-slate-500">Intenta con otro término de búsqueda.</p>
          </div>
        )}

        {!loading && view === "grid" && (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {ordered.map((c) => (
              <Link
                key={c.id}
                href={`/umate/profile/${c.user.username}`}
                className="group overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-sm transition duration-300 hover:-translate-y-1 hover:shadow-xl hover:shadow-fuchsia-100/50"
              >
                <div className="relative h-36 overflow-hidden bg-gradient-to-br from-fuchsia-100 to-orange-50">
                  {c.coverUrl && <img src={c.coverUrl} alt="" className="h-full w-full object-cover transition duration-500 group-hover:scale-105" />}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent" />
                  {c.user.isVerified && (
                    <span className="absolute right-2.5 top-2.5 rounded-full bg-white/90 p-1 shadow-sm backdrop-blur">
                      <BadgeCheck className="h-4 w-4 text-sky-500" />
                    </span>
                  )}
                </div>
                <div className="-mt-7 px-4 pb-4">
                  <div className="h-14 w-14 overflow-hidden rounded-xl border-[3px] border-white bg-white shadow-md">
                    {c.avatarUrl ? (
                      <img src={c.avatarUrl} alt="" className="h-full w-full object-cover" />
                    ) : (
                      <div className="flex h-full items-center justify-center bg-fuchsia-50 text-sm font-bold text-fuchsia-600">{c.displayName[0]}</div>
                    )}
                  </div>
                  <div className="mt-2 flex items-center gap-2">
                    <h3 className="truncate text-sm font-bold text-slate-900">{c.displayName}</h3>
                  </div>
                  <p className="text-xs text-slate-500">@{c.user.username}</p>
                  {c.bio && <p className="mt-1.5 line-clamp-2 text-xs leading-relaxed text-slate-600">{c.bio}</p>}
                  <div className="mt-3 flex items-center gap-2 text-[11px] text-slate-500">
                    <span className="inline-flex items-center gap-1 rounded-md bg-slate-50 px-2 py-1 font-semibold">
                      <Users className="h-3 w-3 text-fuchsia-500" />{c.subscriberCount}
                    </span>
                    <span className="inline-flex items-center gap-1 rounded-md bg-slate-50 px-2 py-1 font-semibold">
                      <Heart className="h-3 w-3 text-rose-400" />{c.totalLikes}
                    </span>
                    <span className="inline-flex items-center gap-1 rounded-md bg-slate-50 px-2 py-1 font-semibold">
                      <Eye className="h-3 w-3 text-sky-400" />{c.totalPosts || 0}
                    </span>
                  </div>
                  <div className="mt-3 rounded-xl bg-gradient-to-r from-fuchsia-50 to-rose-50 py-2 text-center text-xs font-bold text-fuchsia-700 transition group-hover:from-fuchsia-100 group-hover:to-rose-100">
                    Ver perfil
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}

        {!loading && view === "list" && (
          <div className="space-y-2">
            {ordered.map((c) => (
              <Link
                key={c.id}
                href={`/umate/profile/${c.user.username}`}
                className="flex items-center gap-4 rounded-xl border border-slate-100 bg-white p-3 shadow-sm transition hover:shadow-md"
              >
                <div className="h-14 w-14 shrink-0 overflow-hidden rounded-xl bg-fuchsia-100">
                  {c.avatarUrl ? <img src={c.avatarUrl} alt="" className="h-full w-full object-cover" /> : <div className="flex h-full items-center justify-center text-lg font-bold text-fuchsia-600">{c.displayName[0]}</div>}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <h3 className="truncate font-bold text-slate-900">{c.displayName}</h3>
                    {c.user.isVerified && <BadgeCheck className="h-4 w-4 shrink-0 text-sky-500" />}
                  </div>
                  <p className="text-xs text-slate-500">@{c.user.username}</p>
                  {c.bio && <p className="mt-0.5 line-clamp-1 text-xs text-slate-600">{c.bio}</p>}
                </div>
                <div className="hidden shrink-0 items-center gap-4 text-xs text-slate-500 sm:flex">
                  <span className="inline-flex items-center gap-1 font-semibold"><Users className="h-3.5 w-3.5 text-fuchsia-500" />{c.subscriberCount}</span>
                  <span className="inline-flex items-center gap-1 font-semibold"><Heart className="h-3.5 w-3.5 text-rose-400" />{c.totalLikes}</span>
                  <span className="inline-flex items-center gap-1 font-semibold"><Eye className="h-3.5 w-3.5 text-sky-400" />{c.totalPosts || 0}</span>
                </div>
                <span className="shrink-0 rounded-lg bg-fuchsia-50 px-3 py-1.5 text-xs font-bold text-fuchsia-700">Ver perfil</span>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
