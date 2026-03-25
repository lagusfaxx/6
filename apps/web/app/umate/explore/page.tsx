"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Search, Heart, Users, Lock, Flame, Loader2 } from "lucide-react";
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
    params.set("limit", "24");
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

  const filtered = items.filter((item) => {
    if (!search.trim()) return true;
    return item.creator.displayName.toLowerCase().includes(search.toLowerCase()) || (item.caption || "").toLowerCase().includes(search.toLowerCase());
  });

  return (
    <div className="space-y-5 pb-8">
      <div>
        <h1 className="text-2xl font-black text-slate-900">Explorar</h1>
        <p className="text-sm text-slate-500">Discovery feed con contenido gratis y premium.</p>
      </div>

      <div className="sticky top-16 z-20 rounded-2xl border border-slate-100 bg-white/95 p-3 shadow-sm backdrop-blur">
        <div className="flex flex-wrap items-center gap-2">
          {["", "free", "premium"].map((f) => (
            <button key={f || "all"} onClick={() => setFilter(f)} className={`rounded-full px-3 py-1.5 text-xs font-semibold ${filter === f ? "bg-fuchsia-100 text-fuchsia-700" : "bg-slate-100 text-slate-600"}`}>
              {f === "" ? "Todo" : f === "free" ? "Gratis" : "Premium"}
            </button>
          ))}
          <div className="relative ml-auto w-full sm:w-72">
            <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar en el feed" className="w-full rounded-xl border border-slate-200 py-2 pl-8 pr-2 text-xs outline-none" />
          </div>
        </div>
      </div>

      {loading && <div className="flex justify-center py-16"><Loader2 className="h-7 w-7 animate-spin text-fuchsia-500" /></div>}

      {!loading && (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {filtered.map((item) => (
            <article key={item.id} className="overflow-hidden rounded-3xl border border-slate-100 bg-white shadow-sm">
              <Link href={`/umate/profile/${item.creator.user?.username || item.creator.id}`} className="flex items-center gap-2 px-4 py-3">
                <div className="h-9 w-9 overflow-hidden rounded-full bg-slate-200">{item.creator.avatarUrl && <img src={item.creator.avatarUrl} alt="" className="h-full w-full object-cover" />}</div>
                <div>
                  <p className="text-sm font-bold text-slate-900">{item.creator.displayName}</p>
                  <p className="text-[11px] text-slate-500">{new Date(item.createdAt).toLocaleDateString("es-CL")}</p>
                </div>
              </Link>
              {item.media[0] && (
                <div className="relative aspect-[4/5] bg-slate-100">
                  {item.media[0].url ? <img src={item.media[0].url} alt="" className={`h-full w-full object-cover ${item.isBlurred ? "blur-xl scale-110" : ""}`} /> : <div className="h-full w-full bg-gradient-to-br from-fuchsia-100 to-orange-100" />}
                  {item.isBlurred && (
                    <div className="absolute inset-0 flex flex-col items-center justify-center bg-white/45 backdrop-blur-md">
                      <div className="rounded-full bg-white p-3 shadow"><Lock className="h-5 w-5 text-fuchsia-600" /></div>
                      <p className="mt-3 text-sm font-bold text-slate-900">Preview premium</p>
                      <p className="text-xs text-slate-600">Desbloquéalo con tu plan</p>
                      <Link href="/umate/plans" className="mt-3 rounded-lg bg-gradient-to-r from-fuchsia-600 to-rose-500 px-4 py-2 text-xs font-bold text-white">Ver planes</Link>
                    </div>
                  )}
                  {!item.isBlurred && (
                    <span className={`absolute right-3 top-3 rounded-full px-2 py-1 text-[10px] font-bold ${item.visibility === "FREE" ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"}`}>
                      {item.visibility === "FREE" ? "GRATIS" : "PREMIUM"}
                    </span>
                  )}
                </div>
              )}
              <div className="px-4 py-3">
                {item.caption && <p className="line-clamp-2 text-sm text-slate-700">{item.caption}</p>}
                <button onClick={() => toggleLike(item.id)} className={`mt-2 inline-flex items-center gap-1.5 text-sm ${item.isLiked ? "text-rose-500" : "text-slate-500"}`}>
                  <Heart className={`h-4 w-4 ${item.isLiked ? "fill-current" : ""}`} /> {item.likeCount}
                </button>
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
