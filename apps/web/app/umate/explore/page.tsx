"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Search, Heart, Lock, Flame, Loader2, Sparkles, Crown, Users, Compass, WandSparkles } from "lucide-react";
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

export default function ExplorePage() {
  const [items, setItems] = useState<FeedItem[]>([]);
  const [filter, setFilter] = useState("");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    const params = new URLSearchParams();
    if (filter) params.set("filter", filter);
    params.set("limit", "42");
    apiFetch<{ items: FeedItem[] }>(`/umate/feed?${params}`)
      .then((d) => setItems(d?.items || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [filter]);

  const toggleLike = async (postId: string) => {
    const res = await apiFetch<{ liked: boolean }>(`/umate/posts/${postId}/like`, { method: "POST" }).catch(() => null);
    if (!res) return;
    setItems((prev) => prev.map((i) => (i.id === postId ? { ...i, isLiked: res.liked, likeCount: i.likeCount + (res.liked ? 1 : -1) } : i)));
  };

  const filtered = useMemo(() => items.filter((item) => {
    if (!search.trim()) return true;
    return item.creator.displayName.toLowerCase().includes(search.toLowerCase()) || (item.caption || "").toLowerCase().includes(search.toLowerCase());
  }), [items, search]);

  return (
    <div className="space-y-5 pb-10">
      <section className="rounded-3xl border border-fuchsia-100 bg-gradient-to-r from-white via-rose-50/70 to-orange-50 p-5 shadow-sm">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="inline-flex items-center gap-1 rounded-full border border-fuchsia-200 bg-white px-2.5 py-1 text-[11px] font-semibold text-fuchsia-700"><WandSparkles className="h-3 w-3" /> Discovery Feed</p>
            <h1 className="mt-2 text-3xl font-black text-slate-900">Explorar contenido</h1>
            <p className="text-sm text-slate-600">Mosaico dinámico de posts gratis, premium y perfiles sugeridos.</p>
          </div>
          <div className="flex gap-2 text-xs font-semibold">
            <span className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-slate-700">{filtered.length} publicaciones</span>
            <span className="rounded-full border border-amber-200 bg-amber-50 px-3 py-1.5 text-amber-700">{filtered.filter((i) => i.visibility === "PREMIUM").length} premium</span>
          </div>
        </div>
      </section>

      <div className="sticky top-16 z-20 rounded-2xl border border-slate-100 bg-white/95 p-3 shadow-sm backdrop-blur">
        <div className="flex flex-wrap items-center gap-2">
          {[{ key: "", label: "Todo", icon: Compass }, { key: "free", label: "Gratis", icon: Sparkles }, { key: "premium", label: "Premium", icon: Crown }].map((f) => (
            <button key={f.label} onClick={() => setFilter(f.key)} className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold ${filter === f.key ? "bg-fuchsia-100 text-fuchsia-700" : "bg-slate-100 text-slate-600"}`}>
              <f.icon className="h-3.5 w-3.5" /> {f.label}
            </button>
          ))}
          <div className="relative ml-auto w-full sm:w-80">
            <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar creadora o caption" className="w-full rounded-xl border border-slate-200 py-2 pl-8 pr-2 text-xs outline-none focus:border-fuchsia-300" />
          </div>
        </div>
      </div>

      {loading && <div className="flex justify-center py-16"><Loader2 className="h-7 w-7 animate-spin text-fuchsia-500" /></div>}

      {!loading && (
        <div className="columns-1 gap-4 md:columns-2 xl:columns-4">
          {filtered.map((item) => (
            <article key={item.id} className="mb-4 break-inside-avoid overflow-hidden rounded-3xl border border-slate-100 bg-white shadow-sm transition hover:shadow-lg">
              <Link href={`/umate/profile/${item.creator.user?.username || item.creator.id}`} className="flex items-center gap-2 px-4 py-3">
                <div className="h-9 w-9 overflow-hidden rounded-full bg-slate-200">{item.creator.avatarUrl && <img src={item.creator.avatarUrl} alt="" className="h-full w-full object-cover" />}</div>
                <div>
                  <p className="text-sm font-bold text-slate-900">{item.creator.displayName}</p>
                  <p className="text-[11px] text-slate-500">{new Date(item.createdAt).toLocaleDateString("es-CL")}</p>
                </div>
                <span className="ml-auto inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-1 text-[10px] font-bold text-slate-600"><Users className="h-3 w-3" /> Feed</span>
              </Link>
              {item.media[0] && (
                <div className="relative bg-slate-100">
                  {item.media[0].url ? <img src={item.media[0].url} alt="" className={`h-full w-full object-cover ${item.isBlurred ? "blur-xl scale-110" : ""}`} /> : <div className="h-60 w-full bg-gradient-to-br from-fuchsia-100 to-orange-100" />}
                  {item.isBlurred && (
                    <div className="absolute inset-0 flex flex-col items-center justify-center bg-gradient-to-b from-white/20 to-white/60 backdrop-blur-sm">
                      <div className="rounded-full bg-white p-3 shadow"><Lock className="h-5 w-5 text-fuchsia-600" /></div>
                      <p className="mt-2 text-xs font-bold text-slate-900">Preview premium</p>
                      <Link href="/umate/plans" className="mt-2 rounded-lg bg-gradient-to-r from-fuchsia-600 to-rose-500 px-3 py-1.5 text-xs font-bold text-white">Desbloquear</Link>
                    </div>
                  )}
                </div>
              )}
              <div className="px-4 py-3">
                {item.caption && <p className="line-clamp-3 text-sm text-slate-700">{item.caption}</p>}
                <div className="mt-2 flex items-center justify-between">
                  <button onClick={() => toggleLike(item.id)} className={`inline-flex items-center gap-1.5 text-sm ${item.isLiked ? "text-rose-500" : "text-slate-500"}`}>
                    <Heart className={`h-4 w-4 ${item.isLiked ? "fill-current" : ""}`} /> {item.likeCount}
                  </button>
                  <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${item.visibility === "FREE" ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"}`}>{item.visibility}</span>
                </div>
              </div>
            </article>
          ))}
        </div>
      )}

      {!loading && filtered.length === 0 && (
        <div className="rounded-3xl border border-slate-100 bg-white p-14 text-center text-slate-500">
          <Flame className="mx-auto mb-2 h-6 w-6 text-fuchsia-400" /> No encontramos contenido con esos filtros.
        </div>
      )}
    </div>
  );
}
