"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  BadgeCheck,
  Compass,
  Crown,
  Filter,
  Flame,
  Heart,
  Loader2,
  Lock,
  Search,
  Sparkles,
  TrendingUp,
  Users,
} from "lucide-react";
import { apiFetch } from "../../../lib/api";

type FeedItem = {
  id: string;
  caption: string | null;
  visibility: "FREE" | "PREMIUM";
  likeCount: number;
  createdAt: string;
  creator: { id: string; displayName: string; avatarUrl: string | null; user?: { username: string } };
  media: { id: string; type: string; url: string | null; pos: number }[];
  isBlurred: boolean;
  isLiked: boolean;
};

type Creator = {
  id: string;
  displayName: string;
  avatarUrl: string | null;
  subscriberCount: number;
  user: { username: string };
};

export default function ExplorePage() {
  const [items, setItems] = useState<FeedItem[]>([]);
  const [suggestedCreators, setSuggestedCreators] = useState<Creator[]>([]);
  const [filter, setFilter] = useState("");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    const params = new URLSearchParams();
    if (filter) params.set("filter", filter);
    params.set("limit", "48");
    Promise.all([
      apiFetch<{ items: FeedItem[] }>(`/umate/feed?${params}`).catch(() => null),
      apiFetch<{ creators: Creator[] }>("/umate/creators?limit=10").catch(() => null),
    ]).then(([f, c]) => {
      setItems(f?.items || []);
      setSuggestedCreators(c?.creators || []);
      setLoading(false);
    });
  }, [filter]);

  const toggleLike = async (postId: string) => {
    const res = await apiFetch<{ liked: boolean }>(`/umate/posts/${postId}/like`, { method: "POST" }).catch(() => null);
    if (!res) return;
    setItems((prev) => prev.map((i) => (i.id === postId ? { ...i, isLiked: res.liked, likeCount: i.likeCount + (res.liked ? 1 : -1) } : i)));
  };

  const filtered = useMemo(
    () =>
      items.filter((item) => {
        if (!search.trim()) return true;
        return item.creator.displayName.toLowerCase().includes(search.toLowerCase()) || (item.caption || "").toLowerCase().includes(search.toLowerCase());
      }),
    [items, search],
  );

  const premiumCount = filtered.filter((i) => i.visibility === "PREMIUM").length;
  const freeCount = filtered.filter((i) => i.visibility === "FREE").length;

  return (
    <div className="min-h-screen">
      {/* Page header */}
      <div className="border-b border-slate-100 bg-gradient-to-b from-fuchsia-50/60 to-white pb-6 pt-6 lg:pt-10">
        <div className="mx-auto max-w-[1320px] px-4 lg:px-6">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <div className="flex items-center gap-2">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-r from-fuchsia-500 to-rose-500 shadow-lg shadow-fuchsia-300/30">
                  <Compass className="h-5 w-5 text-white" />
                </div>
                <h1 className="text-3xl font-black text-slate-900">Explorar</h1>
              </div>
              <p className="mt-2 max-w-lg text-sm text-slate-500">Feed dinámico de contenido gratis, premium y creadoras sugeridas.</p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-lg bg-emerald-50 px-3 py-1.5 text-xs font-bold text-emerald-700">{freeCount} gratis</span>
              <span className="rounded-lg bg-amber-50 px-3 py-1.5 text-xs font-bold text-amber-700">{premiumCount} premium</span>
              <span className="rounded-lg bg-slate-100 px-3 py-1.5 text-xs font-bold text-slate-600">{filtered.length} total</span>
            </div>
          </div>
        </div>
      </div>

      {/* Sticky toolbar */}
      <div className="sticky top-16 z-30 border-b border-slate-100 bg-white/95 py-3 backdrop-blur-xl">
        <div className="mx-auto flex max-w-[1320px] flex-wrap items-center gap-2 px-4 lg:px-6">
          <div className="flex items-center gap-1 rounded-xl bg-slate-50 p-1">
            {[
              { key: "", label: "Todo", icon: Compass },
              { key: "free", label: "Gratis", icon: Sparkles },
              { key: "premium", label: "Premium", icon: Crown },
            ].map((f) => (
              <button
                key={f.label}
                onClick={() => setFilter(f.key)}
                className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
                  filter === f.key ? "bg-white text-fuchsia-700 shadow-sm" : "text-slate-500 hover:text-slate-700"
                }`}
              >
                <f.icon className="h-3.5 w-3.5" /> {f.label}
              </button>
            ))}
          </div>
          <div className="relative ml-auto w-full sm:w-72">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar creadora o contenido..."
              className="w-full rounded-xl border border-slate-200 bg-white py-2 pl-9 pr-3 text-sm outline-none transition focus:border-fuchsia-300 focus:ring-2 focus:ring-fuchsia-100"
            />
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-[1320px] px-4 py-6 lg:px-6">
        <div className="grid gap-6 lg:grid-cols-[1fr_280px]">
          {/* Main feed — Masonry */}
          <div>
            {loading && (
              <div className="flex justify-center py-20">
                <Loader2 className="h-8 w-8 animate-spin text-fuchsia-500" />
              </div>
            )}

            {!loading && filtered.length === 0 && (
              <div className="rounded-2xl border border-slate-100 bg-white p-16 text-center">
                <Flame className="mx-auto mb-3 h-8 w-8 text-fuchsia-300" />
                <p className="text-sm font-semibold text-slate-700">No encontramos contenido con esos filtros.</p>
                <p className="mt-1 text-xs text-slate-500">Intenta con otra búsqueda o cambia de categoría.</p>
              </div>
            )}

            {!loading && (
              <div className="columns-1 gap-4 sm:columns-2 xl:columns-3">
                {filtered.map((item) => (
                  <article key={item.id} className="mb-4 break-inside-avoid overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-sm transition hover:shadow-lg">
                    {/* Creator bar */}
                    <Link href={`/umate/profile/${item.creator.user?.username || item.creator.id}`} className="flex items-center gap-2.5 border-b border-slate-50 px-3.5 py-2.5">
                      <div className="h-8 w-8 overflow-hidden rounded-lg bg-fuchsia-100">
                        {item.creator.avatarUrl && <img src={item.creator.avatarUrl} alt="" className="h-full w-full object-cover" />}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-bold text-slate-900">{item.creator.displayName}</p>
                        <p className="text-[11px] text-slate-400">{new Date(item.createdAt).toLocaleDateString("es-CL")}</p>
                      </div>
                      <span className={`shrink-0 rounded-md px-2 py-0.5 text-[10px] font-bold ${item.visibility === "FREE" ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700"}`}>
                        {item.visibility === "FREE" ? "Gratis" : "Premium"}
                      </span>
                    </Link>

                    {/* Media */}
                    {item.media[0] && (
                      <div className="relative bg-slate-50">
                        {item.media[0].url ? (
                          <img src={item.media[0].url} alt="" className={`w-full object-cover ${item.isBlurred ? "scale-110 blur-xl" : ""}`} />
                        ) : (
                          <div className="aspect-[4/5] w-full bg-gradient-to-br from-fuchsia-100 to-orange-100" />
                        )}
                        {item.isBlurred && (
                          <div className="absolute inset-0 flex flex-col items-center justify-center bg-gradient-to-b from-white/10 to-white/50 backdrop-blur-sm">
                            <div className="rounded-full bg-white/90 p-3 shadow-lg">
                              <Lock className="h-5 w-5 text-fuchsia-600" />
                            </div>
                            <p className="mt-2 text-xs font-bold text-slate-800">Contenido premium</p>
                            <Link href="/umate/plans" className="mt-2 rounded-lg bg-gradient-to-r from-fuchsia-600 to-rose-500 px-4 py-1.5 text-xs font-bold text-white shadow-lg">
                              Desbloquear
                            </Link>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Footer */}
                    <div className="px-3.5 py-3">
                      {item.caption && <p className="line-clamp-3 text-sm leading-relaxed text-slate-700">{item.caption}</p>}
                      <div className="mt-2.5 flex items-center justify-between">
                        <button onClick={() => toggleLike(item.id)} className={`inline-flex items-center gap-1.5 text-sm font-semibold transition ${item.isLiked ? "text-rose-500" : "text-slate-400 hover:text-rose-400"}`}>
                          <Heart className={`h-4 w-4 ${item.isLiked ? "fill-current" : ""}`} /> {item.likeCount}
                        </button>
                      </div>
                    </div>
                  </article>
                ))}
              </div>
            )}
          </div>

          {/* Sidebar — Suggested creators */}
          <aside className="hidden lg:block">
            <div className="sticky top-[8.5rem] space-y-4">
              <div className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-bold uppercase tracking-wide text-slate-500">Creadoras sugeridas</p>
                  <Link href="/umate/creators" className="text-[11px] font-semibold text-fuchsia-700">Ver todas</Link>
                </div>
                <div className="mt-3 space-y-2">
                  {suggestedCreators.slice(0, 6).map((c) => (
                    <Link key={c.id} href={`/umate/profile/${c.user.username}`} className="flex items-center gap-2.5 rounded-xl p-2 transition hover:bg-slate-50">
                      <div className="h-10 w-10 shrink-0 overflow-hidden rounded-lg bg-fuchsia-100">
                        {c.avatarUrl && <img src={c.avatarUrl} alt="" className="h-full w-full object-cover" />}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-bold text-slate-900">{c.displayName}</p>
                        <p className="text-[11px] text-slate-500">@{c.user.username}</p>
                      </div>
                      <span className="shrink-0 text-[11px] font-semibold text-slate-400"><Users className="mr-0.5 inline h-3 w-3" />{c.subscriberCount}</span>
                    </Link>
                  ))}
                </div>
              </div>

              <div className="rounded-2xl border border-fuchsia-100 bg-gradient-to-br from-fuchsia-50 to-rose-50 p-4">
                <p className="text-sm font-bold text-fuchsia-800">Desbloquea más contenido</p>
                <p className="mt-1 text-xs text-fuchsia-600/80">Activa un plan premium para acceder a publicaciones exclusivas.</p>
                <Link href="/umate/plans" className="mt-3 block rounded-xl bg-gradient-to-r from-fuchsia-600 to-rose-500 py-2 text-center text-xs font-bold text-white shadow-lg shadow-fuchsia-300/30">
                  Ver planes
                </Link>
              </div>

              <div className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm">
                <p className="text-xs font-bold uppercase tracking-wide text-slate-500">Trending</p>
                <div className="mt-3 space-y-2">
                  {["Contenido fitness", "Lifestyle premium", "Behind the scenes", "Sesiones exclusivas"].map((tag) => (
                    <div key={tag} className="flex items-center gap-2 rounded-lg bg-slate-50 px-3 py-2 text-xs font-semibold text-slate-600">
                      <TrendingUp className="h-3 w-3 text-fuchsia-500" /> {tag}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </aside>
        </div>
      </div>
    </div>
  );
}
