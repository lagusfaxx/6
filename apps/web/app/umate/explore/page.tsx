"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  BadgeCheck,
  Compass,
  Crown,
  Flame,
  Heart,
  Loader2,
  Lock,
  MessageCircle,
  Search,
  Sparkles,
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

  return (
    <div className="min-h-screen">
      {/* Sticky filter bar */}
      <div className="sticky top-14 z-30 border-b border-white/[0.04] bg-[#0a0a0f]/95 py-3 backdrop-blur-xl">
        <div className="mx-auto flex max-w-[700px] items-center gap-2 px-4">
          <div className="flex items-center gap-1 rounded-full bg-white/[0.04] p-1">
            {[
              { key: "", label: "Para ti" },
              { key: "free", label: "Gratis" },
              { key: "premium", label: "Premium" },
            ].map((f) => (
              <button
                key={f.label}
                onClick={() => setFilter(f.key)}
                className={`rounded-full px-4 py-1.5 text-xs font-semibold transition ${
                  filter === f.key
                    ? "bg-white text-black"
                    : "text-white/40 hover:text-white/60"
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>
          <div className="relative ml-auto hidden sm:block">
            <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-white/25" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar..."
              className="w-48 rounded-full border border-white/[0.06] bg-white/[0.03] py-1.5 pl-9 pr-3 text-sm text-white placeholder-white/25 outline-none transition focus:border-[#00aff0]/40 focus:w-64"
            />
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-[1170px] px-4 py-6">
        <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
          {/* Main Feed - OnlyFans Style (single column, centered posts) */}
          <div className="mx-auto w-full max-w-[600px] lg:mx-0">
            {loading && (
              <div className="flex justify-center py-20">
                <Loader2 className="h-6 w-6 animate-spin text-white/20" />
              </div>
            )}

            {!loading && filtered.length === 0 && (
              <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-16 text-center">
                <Flame className="mx-auto mb-3 h-8 w-8 text-white/10" />
                <p className="text-sm font-medium text-white/50">No hay contenido con esos filtros.</p>
                <p className="mt-1 text-xs text-white/25">Intenta con otra búsqueda.</p>
              </div>
            )}

            {!loading && (
              <div className="space-y-4">
                {filtered.map((item) => (
                  <article key={item.id} className="overflow-hidden rounded-xl border border-white/[0.06] bg-white/[0.02]">
                    {/* Creator header */}
                    <Link
                      href={`/umate/profile/${item.creator.user?.username || item.creator.id}`}
                      className="flex items-center gap-3 px-4 py-3"
                    >
                      <div className="h-10 w-10 overflow-hidden rounded-full border border-white/[0.08] bg-white/[0.06]">
                        {item.creator.avatarUrl ? (
                          <img src={item.creator.avatarUrl} alt="" className="h-full w-full object-cover" />
                        ) : (
                          <div className="flex h-full items-center justify-center text-sm font-bold text-white/40">{item.creator.displayName[0]}</div>
                        )}
                      </div>
                      <div className="flex-1">
                        <p className="text-sm font-semibold text-white">{item.creator.displayName}</p>
                        <p className="text-[11px] text-white/30">
                          @{item.creator.user?.username || "creator"} · {new Date(item.createdAt).toLocaleDateString("es-CL")}
                        </p>
                      </div>
                      <span className={`rounded-full px-2.5 py-0.5 text-[10px] font-bold ${
                        item.visibility === "FREE"
                          ? "bg-emerald-500/10 text-emerald-400"
                          : "bg-amber-500/10 text-amber-400"
                      }`}>
                        {item.visibility === "FREE" ? "Gratis" : "Premium"}
                      </span>
                    </Link>

                    {/* Caption */}
                    {item.caption && (
                      <div className="px-4 pb-3">
                        <p className="text-sm leading-relaxed text-white/70">{item.caption}</p>
                      </div>
                    )}

                    {/* Media */}
                    {item.media[0] && (
                      <div className="relative">
                        {item.media[0].url ? (
                          <img
                            src={item.media[0].url}
                            alt=""
                            className={`w-full object-cover ${item.isBlurred ? "scale-105 blur-2xl" : ""}`}
                            style={{ maxHeight: 600 }}
                          />
                        ) : (
                          <div className="aspect-[4/5] w-full bg-gradient-to-br from-white/[0.04] to-white/[0.02]" />
                        )}
                        {item.isBlurred && (
                          <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/60 backdrop-blur-sm">
                            <div className="rounded-full bg-white/10 p-4">
                              <Lock className="h-8 w-8 text-white/70" />
                            </div>
                            <p className="mt-3 text-sm font-bold text-white">Contenido premium</p>
                            <p className="mt-1 text-xs text-white/40">Suscríbete para desbloquear</p>
                            <Link
                              href="/umate/plans"
                              className="mt-3 rounded-full bg-[#00aff0] px-6 py-2 text-sm font-bold text-white transition hover:bg-[#00aff0]/90"
                            >
                              Usar cupo de suscripción
                            </Link>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Actions */}
                    <div className="flex items-center gap-4 px-4 py-3">
                      <button
                        onClick={() => toggleLike(item.id)}
                        className={`flex items-center gap-1.5 text-sm transition ${
                          item.isLiked ? "text-rose-500" : "text-white/30 hover:text-rose-400"
                        }`}
                      >
                        <Heart className={`h-5 w-5 ${item.isLiked ? "fill-current" : ""}`} />
                        <span className="text-xs font-medium">{item.likeCount}</span>
                      </button>
                      <button className="flex items-center gap-1.5 text-white/30 transition hover:text-white/50">
                        <MessageCircle className="h-5 w-5" />
                      </button>
                    </div>
                  </article>
                ))}
              </div>
            )}
          </div>

          {/* Sidebar */}
          <aside className="hidden lg:block">
            <div className="sticky top-28 space-y-4">
              {/* Suggested creators */}
              <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-bold uppercase tracking-wider text-white/30">Sugeridas para ti</p>
                  <Link href="/umate/creators" className="text-[11px] font-medium text-[#00aff0]">Ver todas</Link>
                </div>
                <div className="mt-3 space-y-1">
                  {suggestedCreators.slice(0, 5).map((c) => (
                    <Link
                      key={c.id}
                      href={`/umate/profile/${c.user.username}`}
                      className="flex items-center gap-3 rounded-lg p-2 transition hover:bg-white/[0.04]"
                    >
                      <div className="h-10 w-10 shrink-0 overflow-hidden rounded-full border border-white/[0.08] bg-white/[0.06]">
                        {c.avatarUrl ? (
                          <img src={c.avatarUrl} alt="" className="h-full w-full object-cover" />
                        ) : (
                          <div className="flex h-full items-center justify-center text-sm font-bold text-white/40">{c.displayName[0]}</div>
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-semibold text-white/90">{c.displayName}</p>
                        <p className="text-[11px] text-white/25">@{c.user.username}</p>
                      </div>
                      <span className="shrink-0 rounded-full bg-[#00aff0] px-3 py-1 text-[10px] font-bold text-white">
                        Suscribir
                      </span>
                    </Link>
                  ))}
                </div>
              </div>

              {/* Upgrade CTA */}
              <div className="rounded-xl border border-[#00aff0]/20 bg-[#00aff0]/[0.04] p-4">
                <p className="text-sm font-bold text-white">Desbloquea más contenido</p>
                <p className="mt-1 text-xs text-white/35">Activa un plan premium para acceder a publicaciones exclusivas.</p>
                <Link
                  href="/umate/plans"
                  className="mt-3 block rounded-full bg-[#00aff0] py-2 text-center text-xs font-bold text-white transition hover:bg-[#00aff0]/90"
                >
                  Ver planes
                </Link>
              </div>

              {/* Trending */}
              <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4">
                <p className="text-xs font-bold uppercase tracking-wider text-white/30">Trending</p>
                <div className="mt-3 space-y-2">
                  {["Contenido fitness", "Lifestyle premium", "Behind the scenes", "Sesiones exclusivas"].map((tag) => (
                    <div key={tag} className="flex items-center gap-2 rounded-lg bg-white/[0.03] px-3 py-2 text-xs font-medium text-white/40">
                      <Flame className="h-3 w-3 text-[#00aff0]/60" /> {tag}
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
