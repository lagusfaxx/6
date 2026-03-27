"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  BadgeCheck,
  Heart,
  Loader2,
  Search,
  Star,
  TrendingUp,
  Users,
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
      {/* Toolbar */}
      <div className="sticky top-14 z-30 border-b border-white/[0.04] bg-[#0a0a0f]/95 py-3 backdrop-blur-xl">
        <div className="mx-auto flex max-w-[1170px] flex-wrap items-center gap-3 px-4">
          <div className="relative min-w-[200px] flex-1 sm:max-w-sm">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/20" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar creadoras..."
              className="w-full rounded-full border border-white/[0.08] bg-white/[0.03] py-2 pl-10 pr-3 text-sm text-white placeholder-white/20 outline-none transition focus:border-[#00aff0]/40"
            />
          </div>

          <div className="flex items-center gap-1 rounded-full bg-white/[0.04] p-1">
            {[
              { key: "popular" as const, label: "Populares" },
              { key: "growth" as const, label: "Engagement" },
              { key: "new" as const, label: "Recientes" },
            ].map((s) => (
              <button
                key={s.key}
                onClick={() => setSort(s.key)}
                className={`rounded-full px-3 py-1.5 text-xs font-semibold transition ${
                  sort === s.key ? "bg-white text-black" : "text-white/30 hover:text-white/50"
                }`}
              >
                {s.label}
              </button>
            ))}
          </div>

          <span className="ml-auto text-xs text-white/20">{ordered.length} perfiles</span>
        </div>
      </div>

      {/* Content */}
      <div className="mx-auto max-w-[1170px] px-4 py-6">
        {loading && (
          <div className="flex justify-center py-20">
            <Loader2 className="h-6 w-6 animate-spin text-white/20" />
          </div>
        )}

        {!loading && ordered.length === 0 && (
          <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-16 text-center">
            <Users className="mx-auto mb-3 h-8 w-8 text-white/10" />
            <p className="text-sm font-medium text-white/40">No se encontraron creadoras.</p>
          </div>
        )}

        {!loading && (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {ordered.map((c) => (
              <Link
                key={c.id}
                href={`/umate/profile/${c.user.username}`}
                className="group overflow-hidden rounded-xl border border-white/[0.06] bg-white/[0.02] transition hover:border-white/[0.12] hover:bg-white/[0.04]"
              >
                <div className="relative aspect-[3/2] overflow-hidden bg-white/[0.03]">
                  {c.coverUrl ? (
                    <img src={c.coverUrl} alt="" className="h-full w-full object-cover transition duration-500 group-hover:scale-105" />
                  ) : (
                    <div className="h-full w-full bg-gradient-to-br from-[#00aff0]/10 to-purple-500/10" />
                  )}
                  <div className="absolute inset-0 bg-gradient-to-t from-[#0a0a0f] via-transparent to-transparent" />
                  {c.user.isVerified && (
                    <span className="absolute right-2 top-2 rounded-full bg-black/50 p-1 backdrop-blur-sm">
                      <BadgeCheck className="h-3.5 w-3.5 text-[#00aff0]" />
                    </span>
                  )}
                </div>
                <div className="-mt-6 relative px-4 pb-4">
                  <div className="h-12 w-12 overflow-hidden rounded-full border-2 border-[#0a0a0f] bg-[#0a0a0f]">
                    {c.avatarUrl ? (
                      <img src={c.avatarUrl} alt="" className="h-full w-full object-cover" />
                    ) : (
                      <div className="flex h-full items-center justify-center bg-white/[0.08] text-sm font-bold text-white/50">{c.displayName[0]}</div>
                    )}
                  </div>
                  <h3 className="mt-2 truncate text-sm font-bold text-white">{c.displayName}</h3>
                  <p className="text-[11px] text-white/25">@{c.user.username}</p>
                  {c.bio && <p className="mt-1.5 line-clamp-2 text-xs leading-relaxed text-white/35">{c.bio}</p>}
                  <div className="mt-3 flex items-center gap-2 text-[11px] text-white/20">
                    <span className="flex items-center gap-1"><Users className="h-3 w-3" /> {c.subscriberCount}</span>
                    <span className="flex items-center gap-1"><Heart className="h-3 w-3" /> {c.totalLikes}</span>
                  </div>
                  <div className="mt-3 rounded-full bg-[#00aff0]/10 py-2 text-center text-xs font-bold text-[#00aff0] transition group-hover:bg-[#00aff0]/20">
                    Ver perfil
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
