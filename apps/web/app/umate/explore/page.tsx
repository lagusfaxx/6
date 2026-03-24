"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { Search, Heart, Eye, Users, Lock, Loader2 } from "lucide-react";
import { apiFetch } from "../../../lib/api";

type FeedItem = {
  id: string;
  caption: string | null;
  visibility: "FREE" | "PREMIUM";
  likeCount: number;
  viewCount: number;
  createdAt: string;
  creator: { id: string; displayName: string; avatarUrl: string | null; subscriberCount: number };
  media: { id: string; type: string; url: string | null; pos: number }[];
  isBlurred: boolean;
  isLiked: boolean;
};

type Creator = {
  id: string;
  displayName: string;
  bio: string | null;
  avatarUrl: string | null;
  coverUrl: string | null;
  subscriberCount: number;
  totalPosts: number;
  totalLikes: number;
  user: { username: string };
};

export default function ExplorePage() {
  const [tab, setTab] = useState<"feed" | "creators">("feed");
  const [items, setItems] = useState<FeedItem[]>([]);
  const [creators, setCreators] = useState<Creator[]>([]);
  const [filter, setFilter] = useState<string>("");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    if (tab === "feed") {
      const params = filter ? `?filter=${filter}` : "";
      apiFetch<{ items: FeedItem[] }>(`/umate/feed${params}`)
        .then((d) => setItems(d?.items || []))
        .catch(() => {})
        .finally(() => setLoading(false));
    } else {
      const params = search ? `?q=${encodeURIComponent(search)}` : "";
      apiFetch<{ creators: Creator[] }>(`/umate/creators${params}`)
        .then((d) => setCreators(d?.creators || []))
        .catch(() => {})
        .finally(() => setLoading(false));
    }
  }, [tab, filter, search]);

  const toggleLike = useCallback(async (postId: string) => {
    const res = await apiFetch<{ liked: boolean }>(`/umate/posts/${postId}/like`, { method: "POST" });
    if (res) {
      setItems((prev) =>
        prev.map((item) =>
          item.id === postId
            ? { ...item, isLiked: res.liked, likeCount: item.likeCount + (res.liked ? 1 : -1) }
            : item,
        ),
      );
    }
  }, []);

  return (
    <div className="py-6 space-y-6">
      <h1 className="text-2xl font-bold tracking-tight">Explorar</h1>

      {/* Tabs + filters */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="flex rounded-xl border border-white/[0.06] bg-white/[0.02] p-0.5 gap-0.5">
          {(["feed", "creators"] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`rounded-lg px-4 py-2 text-xs font-medium transition ${
                tab === t ? "bg-rose-500/15 text-rose-300" : "text-white/40 hover:text-white/60"
              }`}
            >
              {t === "feed" ? "Feed" : "Creadoras"}
            </button>
          ))}
        </div>

        {tab === "feed" && (
          <div className="flex gap-1.5">
            {[
              { key: "", label: "Todo" },
              { key: "free", label: "Gratis" },
              { key: "premium", label: "Premium" },
            ].map((f) => (
              <button
                key={f.key}
                onClick={() => setFilter(f.key)}
                className={`rounded-full px-3 py-1 text-[11px] font-medium transition ${
                  filter === f.key
                    ? "bg-white/[0.1] text-white"
                    : "text-white/30 hover:text-white/50"
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>
        )}

        {tab === "creators" && (
          <div className="relative flex-1 max-w-xs">
            <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-white/20" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar creadora..."
              className="w-full rounded-xl border border-white/[0.08] bg-white/[0.03] py-2 pl-9 pr-3 text-xs text-white placeholder:text-white/20 focus:border-rose-500/30 focus:outline-none"
            />
          </div>
        )}
      </div>

      {loading && (
        <div className="flex justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-rose-400" />
        </div>
      )}

      {/* Feed grid */}
      {!loading && tab === "feed" && (
        <div className="columns-2 gap-4 sm:columns-3 lg:columns-4">
          {items.map((item) => (
            <div key={item.id} className="mb-4 break-inside-avoid overflow-hidden rounded-2xl border border-white/[0.07] bg-white/[0.02]">
              {/* Media */}
              <div className="relative">
                {item.media[0] && (
                  <div className={`relative aspect-[3/4] bg-white/5 ${item.isBlurred ? "overflow-hidden" : ""}`}>
                    {item.media[0].url ? (
                      <img src={item.media[0].url} alt="" className={`h-full w-full object-cover ${item.isBlurred ? "blur-xl scale-110" : ""}`} />
                    ) : (
                      <div className={`h-full w-full bg-gradient-to-br from-rose-500/20 to-amber-500/10 ${item.isBlurred ? "blur-xl" : ""}`} />
                    )}
                    {item.isBlurred && (
                      <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/30 p-4 text-center">
                        <Lock className="mb-2 h-6 w-6 text-rose-400" />
                        <p className="text-xs font-semibold text-white">Contenido premium</p>
                        <Link
                          href="/umate/plans"
                          className="mt-2 rounded-lg bg-rose-500/20 px-3 py-1 text-[10px] font-medium text-rose-300 transition hover:bg-rose-500/30"
                        >
                          Suscríbete para desbloquear
                        </Link>
                      </div>
                    )}
                    {item.visibility === "PREMIUM" && !item.isBlurred && (
                      <span className="absolute top-2 right-2 rounded-full bg-amber-500/20 px-2 py-0.5 text-[9px] font-bold text-amber-300">
                        PREMIUM
                      </span>
                    )}
                    {item.visibility === "FREE" && (
                      <span className="absolute top-2 right-2 rounded-full bg-emerald-500/20 px-2 py-0.5 text-[9px] font-bold text-emerald-300">
                        GRATIS
                      </span>
                    )}
                  </div>
                )}
              </div>

              {/* Info */}
              <div className="p-3">
                <Link href={`/umate/profile/${item.creator.displayName}`} className="flex items-center gap-2">
                  <div className="h-7 w-7 shrink-0 overflow-hidden rounded-full bg-white/10">
                    {item.creator.avatarUrl && <img src={item.creator.avatarUrl} alt="" className="h-full w-full object-cover" />}
                  </div>
                  <span className="truncate text-xs font-semibold">{item.creator.displayName}</span>
                </Link>
                {item.caption && <p className="mt-1.5 text-[11px] text-white/50 line-clamp-2">{item.caption}</p>}
                <div className="mt-2 flex items-center gap-3">
                  <button
                    onClick={() => toggleLike(item.id)}
                    className={`flex items-center gap-1 text-[10px] transition ${item.isLiked ? "text-rose-400" : "text-white/30 hover:text-rose-400"}`}
                  >
                    <Heart className={`h-3.5 w-3.5 ${item.isLiked ? "fill-current" : ""}`} />
                    {item.likeCount}
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Creators grid */}
      {!loading && tab === "creators" && (
        <div className="grid gap-4 grid-cols-2 sm:grid-cols-3 lg:grid-cols-4">
          {creators.map((c) => (
            <Link
              key={c.id}
              href={`/umate/profile/${c.user.username}`}
              className="group overflow-hidden rounded-2xl border border-white/[0.07] bg-white/[0.02] transition hover:border-rose-500/20"
            >
              <div className="relative h-28 bg-gradient-to-br from-rose-500/20 to-amber-500/10">
                {c.coverUrl && <img src={c.coverUrl} alt="" className="absolute inset-0 h-full w-full object-cover" />}
              </div>
              <div className="-mt-8 px-3">
                <div className="h-16 w-16 overflow-hidden rounded-full border-2 border-[#06060c] bg-white/10">
                  {c.avatarUrl ? (
                    <img src={c.avatarUrl} alt="" className="h-full w-full object-cover" />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center text-lg font-bold text-white/30">{c.displayName[0]}</div>
                  )}
                </div>
              </div>
              <div className="px-3 pb-4 pt-1">
                <p className="truncate text-sm font-semibold">{c.displayName}</p>
                <p className="truncate text-[11px] text-white/40">@{c.user.username}</p>
                {c.bio && <p className="mt-1 text-[11px] text-white/30 line-clamp-2">{c.bio}</p>}
                <div className="mt-2 flex items-center gap-3 text-[10px] text-white/30">
                  <span className="flex items-center gap-1"><Users className="h-3 w-3" />{c.subscriberCount}</span>
                  <span className="flex items-center gap-1"><Heart className="h-3 w-3" />{c.totalLikes}</span>
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}

      {!loading && tab === "feed" && items.length === 0 && (
        <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-12 text-center">
          <p className="text-sm text-white/40">Aún no hay publicaciones. ¡Sé la primera en explorar!</p>
        </div>
      )}
    </div>
  );
}
