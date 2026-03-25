"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { Search, Heart, Users, Lock, Loader2, Flame, SlidersHorizontal, Grid3X3, LayoutList } from "lucide-react";
import { apiFetch } from "../../../lib/api";

type FeedItem = {
  id: string;
  caption: string | null;
  visibility: "FREE" | "PREMIUM";
  likeCount: number;
  viewCount: number;
  createdAt: string;
  creator: { id: string; displayName: string; avatarUrl: string | null; subscriberCount: number; user?: { username: string } };
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
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMoreFeed, setHasMoreFeed] = useState(true);
  const [hasMoreCreators, setHasMoreCreators] = useState(true);

  useEffect(() => {
    setLoading(true);
    if (tab === "feed") {
      const params = new URLSearchParams();
      if (filter) params.set("filter", filter);
      params.set("limit", "20");
      apiFetch<{ items: FeedItem[] }>(`/umate/feed?${params}`)
        .then((d) => {
          const feedItems = d?.items || [];
          setItems(feedItems);
          setHasMoreFeed(feedItems.length >= 20);
        })
        .catch(() => {})
        .finally(() => setLoading(false));
    } else {
      const params = new URLSearchParams();
      if (search) params.set("q", search);
      params.set("limit", "20");
      apiFetch<{ creators: Creator[] }>(`/umate/creators?${params}`)
        .then((d) => {
          const creatorList = d?.creators || [];
          setCreators(creatorList);
          setHasMoreCreators(creatorList.length >= 20);
        })
        .catch(() => {})
        .finally(() => setLoading(false));
    }
  }, [tab, filter, search]);

  const loadMoreFeed = useCallback(async () => {
    if (loadingMore || !hasMoreFeed) return;
    setLoadingMore(true);
    const params = new URLSearchParams();
    if (filter) params.set("filter", filter);
    params.set("limit", "20");
    params.set("offset", String(items.length));
    const d = await apiFetch<{ items: FeedItem[] }>(`/umate/feed?${params}`).catch(() => null);
    if (d?.items) {
      setItems((prev) => [...prev, ...d.items]);
      setHasMoreFeed(d.items.length >= 20);
    }
    setLoadingMore(false);
  }, [items.length, filter, loadingMore, hasMoreFeed]);

  const loadMoreCreators = useCallback(async () => {
    if (loadingMore || !hasMoreCreators) return;
    setLoadingMore(true);
    const params = new URLSearchParams();
    if (search) params.set("q", search);
    params.set("limit", "20");
    params.set("offset", String(creators.length));
    const d = await apiFetch<{ creators: Creator[] }>(`/umate/creators?${params}`).catch(() => null);
    if (d?.creators) {
      setCreators((prev) => [...prev, ...d.creators]);
      setHasMoreCreators(d.creators.length >= 20);
    }
    setLoadingMore(false);
  }, [creators.length, search, loadingMore, hasMoreCreators]);

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
    <div className="space-y-6 pb-8">
      {/* Header */}
      <div className="flex items-end justify-between pt-6">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight">Explorar</h1>
          <p className="mt-0.5 text-xs text-white/30">Descubre contenido y creadoras</p>
        </div>
      </div>

      {/* Tab bar + filters — sticky like OnlyFans */}
      <div className="sticky top-[56px] z-30 -mx-4 border-b border-white/[0.06] bg-[#08080f]/95 px-4 pb-3 pt-2 backdrop-blur-xl md:top-[56px]">
        <div className="flex items-center gap-3">
          {/* Main tabs */}
          <div className="flex rounded-xl border border-white/[0.06] bg-white/[0.02] p-0.5">
            {(["feed", "creators"] as const).map((t) => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={`rounded-lg px-4 py-2 text-xs font-semibold transition ${
                  tab === t ? "bg-rose-500/15 text-rose-300 shadow-sm" : "text-white/35 hover:text-white/60"
                }`}
              >
                {t === "feed" ? (
                  <span className="flex items-center gap-1.5"><Flame className="h-3.5 w-3.5" /> Feed</span>
                ) : (
                  <span className="flex items-center gap-1.5"><Users className="h-3.5 w-3.5" /> Creadoras</span>
                )}
              </button>
            ))}
          </div>

          {/* Feed filters */}
          {tab === "feed" && (
            <div className="flex gap-1">
              {[
                { key: "", label: "Todo" },
                { key: "free", label: "Gratis" },
                { key: "premium", label: "Premium" },
              ].map((f) => (
                <button
                  key={f.key}
                  onClick={() => setFilter(f.key)}
                  className={`rounded-full px-3 py-1.5 text-[11px] font-medium transition ${
                    filter === f.key
                      ? "bg-white/[0.1] text-white"
                      : "text-white/25 hover:text-white/50"
                  }`}
                >
                  {f.label}
                </button>
              ))}
            </div>
          )}

          {/* Creator search */}
          {tab === "creators" && (
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-white/15" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Buscar creadora..."
                className="w-full rounded-xl border border-white/[0.06] bg-white/[0.03] py-2 pl-9 pr-3 text-xs text-white placeholder:text-white/15 focus:border-rose-500/25 focus:outline-none"
              />
            </div>
          )}
        </div>
      </div>

      {loading && (
        <div className="flex justify-center py-16">
          <Loader2 className="h-7 w-7 animate-spin text-rose-400/60" />
        </div>
      )}

      {/* Feed — OnlyFans-style timeline */}
      {!loading && tab === "feed" && (
        <div className="mx-auto max-w-xl space-y-4">
          {items.map((item) => (
            <div key={item.id} className="overflow-hidden rounded-2xl border border-white/[0.06] bg-white/[0.02]">
              {/* Creator header */}
              <Link href={`/umate/profile/${item.creator.user?.username || item.creator.id}`} className="flex items-center gap-3 px-4 py-3 transition hover:bg-white/[0.02]">
                <div className="h-9 w-9 shrink-0 overflow-hidden rounded-full bg-white/10 ring-2 ring-rose-500/20">
                  {item.creator.avatarUrl && <img src={item.creator.avatarUrl} alt="" className="h-full w-full object-cover" />}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-bold">{item.creator.displayName}</p>
                  <p className="text-[10px] text-white/25">{new Date(item.createdAt).toLocaleDateString("es-CL", { day: "numeric", month: "short" })}</p>
                </div>
                {item.visibility === "PREMIUM" && !item.isBlurred && (
                  <span className="rounded-full bg-amber-500/15 px-2 py-0.5 text-[9px] font-bold text-amber-300">PREMIUM</span>
                )}
                {item.visibility === "FREE" && (
                  <span className="rounded-full bg-emerald-500/15 px-2 py-0.5 text-[9px] font-bold text-emerald-300">GRATIS</span>
                )}
              </Link>

              {/* Caption before media */}
              {item.caption && (
                <p className="px-4 pb-2 text-sm text-white/60 leading-relaxed">{item.caption}</p>
              )}

              {/* Media */}
              {item.media[0] && (
                <div className={`relative ${item.isBlurred ? "overflow-hidden" : ""}`}>
                  <div className="aspect-[4/5] bg-white/5">
                    {item.media[0].url ? (
                      <img src={item.media[0].url} alt="" className={`h-full w-full object-cover ${item.isBlurred ? "blur-2xl scale-110" : ""}`} />
                    ) : (
                      <div className={`h-full w-full bg-gradient-to-br from-rose-500/20 to-amber-500/10 ${item.isBlurred ? "blur-2xl" : ""}`} />
                    )}
                    {item.isBlurred && (
                      <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/40 backdrop-blur-sm">
                        <div className="flex h-14 w-14 items-center justify-center rounded-full bg-white/10 backdrop-blur-sm mb-3">
                          <Lock className="h-6 w-6 text-white/80" />
                        </div>
                        <p className="text-sm font-bold text-white">Contenido premium</p>
                        <p className="mt-1 text-xs text-white/50">Suscríbete para desbloquear</p>
                        <Link
                          href="/umate/plans"
                          className="mt-4 rounded-xl bg-gradient-to-r from-rose-500 to-pink-500 px-6 py-2.5 text-xs font-bold text-white shadow-lg transition hover:shadow-rose-500/25"
                        >
                          Ver planes
                        </Link>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Actions */}
              <div className="flex items-center gap-4 px-4 py-3">
                <button
                  onClick={() => toggleLike(item.id)}
                  className={`flex items-center gap-1.5 text-sm transition ${item.isLiked ? "text-rose-400" : "text-white/30 hover:text-rose-400"}`}
                >
                  <Heart className={`h-5 w-5 ${item.isLiked ? "fill-current" : ""}`} />
                  <span className="text-xs font-medium">{item.likeCount}</span>
                </button>
              </div>
            </div>
          ))}
          {/* Load more feed */}
          {hasMoreFeed && items.length > 0 && (
            <button
              onClick={loadMoreFeed}
              disabled={loadingMore}
              className="w-full rounded-xl border border-white/[0.06] bg-white/[0.02] py-3 text-xs font-medium text-white/30 transition hover:bg-white/[0.04] hover:text-white/50 disabled:opacity-50"
            >
              {loadingMore ? <Loader2 className="mx-auto h-4 w-4 animate-spin" /> : "Cargar más publicaciones"}
            </button>
          )}
        </div>
      )}

      {/* Creators grid — card layout like OnlyFans discover */}
      {!loading && tab === "creators" && (
        <div className="grid gap-4 grid-cols-2 sm:grid-cols-3 lg:grid-cols-4">
          {creators.map((c) => (
            <Link
              key={c.id}
              href={`/umate/profile/${c.user.username}`}
              className="group overflow-hidden rounded-2xl border border-white/[0.06] bg-white/[0.02] transition hover:border-rose-500/20 hover:shadow-[0_0_25px_rgba(244,63,94,0.06)]"
            >
              <div className="relative h-28 bg-gradient-to-br from-rose-500/20 to-amber-500/10 overflow-hidden">
                {c.coverUrl && <img src={c.coverUrl} alt="" className="absolute inset-0 h-full w-full object-cover transition group-hover:scale-105" />}
                <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-transparent" />
              </div>
              <div className="-mt-8 px-3 relative z-10">
                <div className="h-16 w-16 overflow-hidden rounded-full border-[3px] border-[#08080f] bg-white/10 shadow-lg">
                  {c.avatarUrl ? (
                    <img src={c.avatarUrl} alt="" className="h-full w-full object-cover" />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center text-lg font-bold text-white/30">{c.displayName[0]}</div>
                  )}
                </div>
              </div>
              <div className="px-3 pb-4 pt-1.5">
                <p className="truncate text-sm font-bold">{c.displayName}</p>
                <p className="truncate text-[10px] text-white/30">@{c.user.username}</p>
                {c.bio && <p className="mt-1.5 text-[11px] text-white/25 line-clamp-2">{c.bio}</p>}
                <div className="mt-2.5 flex items-center gap-3 text-[10px] text-white/20">
                  <span className="flex items-center gap-0.5"><Users className="h-3 w-3" /> {c.subscriberCount}</span>
                  <span className="flex items-center gap-0.5"><Heart className="h-3 w-3" /> {c.totalLikes}</span>
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
      {/* Load more creators */}
      {!loading && tab === "creators" && hasMoreCreators && creators.length > 0 && (
        <button
          onClick={loadMoreCreators}
          disabled={loadingMore}
          className="w-full rounded-xl border border-white/[0.06] bg-white/[0.02] py-3 text-xs font-medium text-white/30 transition hover:bg-white/[0.04] hover:text-white/50 disabled:opacity-50"
        >
          {loadingMore ? <Loader2 className="mx-auto h-4 w-4 animate-spin" /> : "Cargar más creadoras"}
        </button>
      )}

      {!loading && tab === "feed" && items.length === 0 && (
        <div className="mx-auto max-w-xl rounded-2xl border border-white/[0.06] bg-white/[0.02] p-16 text-center">
          <Flame className="mx-auto mb-3 h-8 w-8 text-white/10" />
          <p className="text-sm font-medium text-white/35">No hay publicaciones aún</p>
          <p className="mt-1 text-xs text-white/20">Las nuevas publicaciones aparecerán aquí</p>
        </div>
      )}

      {!loading && tab === "creators" && creators.length === 0 && (
        <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-16 text-center">
          <Users className="mx-auto mb-3 h-8 w-8 text-white/10" />
          <p className="text-sm font-medium text-white/35">No se encontraron creadoras</p>
        </div>
      )}
    </div>
  );
}
