"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Search, Users, Heart, Star, BadgeCheck, SlidersHorizontal } from "lucide-react";
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
  user: { username: string };
};

export default function CreatorsPage() {
  const [creators, setCreators] = useState<Creator[]>([]);
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState<"popular" | "growth" | "new">("popular");

  useEffect(() => {
    const params = new URLSearchParams();
    if (search.trim()) params.set("q", search.trim());
    params.set("limit", "48");
    apiFetch<{ creators: Creator[] }>(`/umate/creators?${params}`).then((d) => setCreators(d?.creators || [])).catch(() => {});
  }, [search]);

  const ordered = useMemo(() => {
    const list = [...creators];
    if (sort === "popular") list.sort((a, b) => b.subscriberCount - a.subscriberCount);
    if (sort === "growth") list.sort((a, b) => b.totalLikes - a.totalLikes);
    return list;
  }, [creators, sort]);

  return (
    <div className="space-y-5 pb-12">
      <section className="rounded-3xl border border-fuchsia-100 bg-gradient-to-r from-white via-rose-50/70 to-orange-50 p-6 shadow-sm">
        <h1 className="text-3xl font-black text-slate-900">Catálogo de creadoras</h1>
        <p className="text-sm text-slate-600">Explora perfiles por crecimiento, afinidad y estilo de contenido.</p>
      </section>

      <section className="rounded-2xl border border-slate-100 bg-white p-3 shadow-sm">
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative min-w-[260px] flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar por nombre, username o estilo" className="w-full rounded-xl border border-slate-200 bg-white py-2.5 pl-9 pr-3 text-sm text-slate-900 outline-none focus:border-fuchsia-300" />
          </div>
          <div className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-3 py-2 text-xs text-slate-600">
            <SlidersHorizontal className="h-3.5 w-3.5" />
            <select value={sort} onChange={(e) => setSort(e.target.value as typeof sort)} className="bg-transparent outline-none">
              <option value="popular">Más populares</option>
              <option value="growth">Mayor engagement</option>
              <option value="new">Más recientes</option>
            </select>
          </div>
          <span className="rounded-full bg-slate-100 px-3 py-1.5 text-xs font-semibold text-slate-700">{ordered.length} perfiles</span>
        </div>
      </section>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {ordered.map((c) => (
          <Link key={c.id} href={`/umate/profile/${c.user.username}`} className="overflow-hidden rounded-3xl border border-slate-100 bg-white shadow-sm transition hover:-translate-y-1 hover:shadow-lg">
            <div className="relative h-36 bg-gradient-to-br from-fuchsia-100 to-orange-100">{c.coverUrl && <img src={c.coverUrl} alt="" className="h-full w-full object-cover" />}<span className="absolute right-3 top-3 rounded-full bg-black/60 px-2 py-1 text-[10px] font-semibold text-white">Creator</span></div>
            <div className="-mt-8 px-4 pb-4">
              <div className="h-16 w-16 overflow-hidden rounded-xl border-4 border-white bg-white shadow-sm">{c.avatarUrl && <img src={c.avatarUrl} alt="" className="h-full w-full object-cover" />}</div>
              <div className="mt-2 flex items-center justify-between">
                <p className="font-bold text-slate-900">{c.displayName}</p>
                <BadgeCheck className="h-4 w-4 text-sky-500" />
              </div>
              <p className="text-xs text-slate-500">@{c.user.username}</p>
              {c.bio && <p className="mt-1 line-clamp-2 text-xs text-slate-600">{c.bio}</p>}
              <div className="mt-3 grid grid-cols-3 gap-2 text-xs text-slate-600">
                <span className="inline-flex items-center gap-1 rounded-lg bg-slate-50 px-2 py-1"><Users className="h-3.5 w-3.5 text-fuchsia-500" /> {c.subscriberCount}</span>
                <span className="inline-flex items-center gap-1 rounded-lg bg-slate-50 px-2 py-1"><Heart className="h-3.5 w-3.5 text-rose-500" /> {c.totalLikes}</span>
                <span className="inline-flex items-center gap-1 rounded-lg bg-slate-50 px-2 py-1"><Star className="h-3.5 w-3.5 text-amber-500" /> {c.totalPosts || 0}</span>
              </div>
              <div className="mt-3 rounded-xl bg-fuchsia-50 px-3 py-2 text-center text-xs font-semibold text-fuchsia-700">Ver perfil público</div>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
