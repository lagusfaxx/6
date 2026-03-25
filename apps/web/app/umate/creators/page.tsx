"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Search, Users, Heart, Star } from "lucide-react";
import { apiFetch } from "../../../lib/api";

type Creator = {
  id: string;
  displayName: string;
  bio: string | null;
  avatarUrl: string | null;
  coverUrl: string | null;
  subscriberCount: number;
  totalLikes: number;
  user: { username: string };
};

export default function CreatorsPage() {
  const [creators, setCreators] = useState<Creator[]>([]);
  const [search, setSearch] = useState("");

  useEffect(() => {
    const params = new URLSearchParams();
    if (search.trim()) params.set("q", search.trim());
    params.set("limit", "30");
    apiFetch<{ creators: Creator[] }>(`/umate/creators?${params}`).then((d) => setCreators(d?.creators || [])).catch(() => {});
  }, [search]);

  return (
    <div className="space-y-5 pb-10">
      <section className="rounded-3xl border border-fuchsia-100 bg-gradient-to-r from-white via-rose-50/70 to-orange-50 p-5">
        <h1 className="text-2xl font-black text-slate-900">Creadoras destacadas</h1>
        <p className="text-sm text-slate-600">Descubre perfiles por estilo, energía y rendimiento.</p>
      </section>

      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
        <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar creadora..." className="w-full rounded-xl border border-slate-200 bg-white py-2.5 pl-9 pr-3 text-sm text-slate-900 outline-none focus:border-fuchsia-300" />
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {creators.map((c) => (
          <Link key={c.id} href={`/umate/profile/${c.user.username}`} className="overflow-hidden rounded-3xl border border-slate-100 bg-white shadow-sm transition hover:-translate-y-1 hover:shadow-lg">
            <div className="relative h-36 bg-gradient-to-br from-fuchsia-100 to-orange-100">{c.coverUrl && <img src={c.coverUrl} alt="" className="h-full w-full object-cover" />}<span className="absolute right-3 top-3 rounded-full bg-black/60 px-2 py-1 text-[10px] font-semibold text-white">Featured</span></div>
            <div className="-mt-8 px-4 pb-4">
              <div className="h-16 w-16 overflow-hidden rounded-xl border-4 border-white bg-white shadow-sm">{c.avatarUrl && <img src={c.avatarUrl} alt="" className="h-full w-full object-cover" />}</div>
              <div className="mt-2 flex items-center justify-between">
                <p className="font-bold text-slate-900">{c.displayName}</p>
                <Star className="h-4 w-4 text-amber-500" />
              </div>
              <p className="text-xs text-slate-500">@{c.user.username}</p>
              {c.bio && <p className="mt-1 line-clamp-2 text-xs text-slate-600">{c.bio}</p>}
              <div className="mt-2 grid grid-cols-2 gap-2 text-xs text-slate-600">
                <span className="inline-flex items-center gap-1 rounded-lg bg-slate-50 px-2 py-1"><Users className="h-3.5 w-3.5 text-fuchsia-500" /> {c.subscriberCount}</span>
                <span className="inline-flex items-center gap-1 rounded-lg bg-slate-50 px-2 py-1"><Heart className="h-3.5 w-3.5 text-rose-500" /> {c.totalLikes}</span>
              </div>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
