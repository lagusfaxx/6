"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import {
  Search,
  Heart,
  Users,
  Image as ImageIcon,
  ChevronRight,
  Camera,
  Sparkles,
  ShieldCheck,
} from "lucide-react";
import { apiFetch, resolveMediaUrl } from "../lib/api";

/* ─── Types ──────────────────────────────────────────────── */
type CreatorResult = {
  id: string;
  userId: string;
  username: string;
  displayName: string;
  bio: string | null;
  avatarUrl: string | null;
  coverUrl: string | null;
  subscriberCount: number;
  totalPosts: number;
  totalLikes: number;
  isVerified: boolean;
  city: string | null;
  isProfessional: boolean;
  previewMedia: { url: string; type: string; thumbnailUrl: string | null }[];
  createdAt: string;
};

const SORT_OPTIONS = [
  { key: "popular", label: "Populares" },
  { key: "new", label: "Nuevas" },
  { key: "engagement", label: "Más gustadas" },
] as const;

/* ─── CreadoraCard ───────────────────────────────────────── */
function CreadoraCard({ c }: { c: CreatorResult }) {
  const coverSrc = c.coverUrl ? resolveMediaUrl(c.coverUrl) : null;
  const avatarSrc = c.avatarUrl ? resolveMediaUrl(c.avatarUrl) : null;
  const heroSrc = coverSrc || avatarSrc;

  return (
    <Link
      href={`/umate/profile/${c.username}`}
      className="uzeed-premium-card group relative flex flex-col cursor-pointer overflow-hidden rounded-2xl border border-white/[0.06] bg-[#0c0a14]"
    >
      {/* Cover hero */}
      <div className="relative aspect-[3/4] bg-[#0a0a10] overflow-hidden">
        {heroSrc ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={heroSrc}
            alt={c.displayName}
            loading="lazy"
            decoding="async"
            className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-sky-900/40 via-violet-900/30 to-fuchsia-900/20">
            <Camera className="h-10 w-10 text-white/[0.08]" />
          </div>
        )}

        {/* Gradient overlay */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent pointer-events-none" />

        {/* Top badges */}
        <div className="absolute top-2.5 left-2.5 flex gap-1.5 z-[3]">
          <span className="flex items-center gap-1 rounded-full bg-sky-500/20 backdrop-blur-sm border border-sky-500/20 px-2 py-0.5 text-[10px] font-semibold text-sky-300">
            <Camera className="h-3 w-3" />
            Creadora
          </span>
          {c.isProfessional && (
            <span className="flex items-center gap-1 rounded-full bg-fuchsia-500/20 backdrop-blur-sm border border-fuchsia-500/20 px-2 py-0.5 text-[10px] font-semibold text-fuchsia-300">
              <Sparkles className="h-3 w-3" />
              Escort
            </span>
          )}
        </div>

        {/* Bottom info */}
        <div className="absolute bottom-0 left-0 right-0 p-3 z-[3]">
          {/* Name + verification */}
          <div className="flex items-center gap-1.5 font-bold text-white text-[13px] sm:text-sm leading-tight">
            <span className="truncate">{c.displayName}</span>
            {c.isVerified && <ShieldCheck className="h-3.5 w-3.5 text-sky-400 shrink-0" />}
          </div>

          {/* City */}
          {c.city && (
            <p className="text-[11px] text-white/45 mt-0.5 truncate">{c.city}</p>
          )}

          {/* Stats row */}
          <div className="flex items-center gap-3 mt-2">
            <span className="flex items-center gap-1 text-[11px] text-white/50">
              <Users className="h-3 w-3 text-sky-400/70" />
              {c.subscriberCount}
            </span>
            <span className="flex items-center gap-1 text-[11px] text-white/50">
              <Heart className="h-3 w-3 text-pink-400/70" />
              {c.totalLikes}
            </span>
            <span className="flex items-center gap-1 text-[11px] text-white/50">
              <ImageIcon className="h-3 w-3 text-violet-400/70" />
              {c.totalPosts}
            </span>
          </div>
        </div>
      </div>
    </Link>
  );
}

/* ─── Main Component ─────────────────────────────────────── */
export default function CreadorasDirectory() {
  const searchParams = useSearchParams();
  const [results, setResults] = useState<CreatorResult[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [searchText, setSearchText] = useState(searchParams.get("q") || "");
  const [sort, setSort] = useState(searchParams.get("sort") || "popular");
  const [searchInput, setSearchInput] = useState(searchText);

  const fetchCreators = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ sort, limit: "60" });
      if (searchText) params.set("q", searchText);
      const data = await apiFetch<{ results: CreatorResult[]; total: number }>(
        `/directory/creators?${params.toString()}`,
      );
      setResults(data?.results ?? []);
      setTotal(data?.total ?? 0);
    } catch {
      setResults([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  }, [sort, searchText]);

  useEffect(() => {
    fetchCreators();
  }, [fetchCreators]);

  const handleSearch = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      setSearchText(searchInput.trim());
    },
    [searchInput],
  );

  return (
    <div className="min-h-screen bg-[#07060d]">
      {/* ── Sticky header ── */}
      <div className="sticky top-0 z-30 bg-[#07060d]/95 backdrop-blur-lg border-b border-white/[0.04]">
        <div className="max-w-7xl mx-auto px-4 py-3">
          {/* Title row */}
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2.5">
              <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-sky-500/[0.12]">
                <Camera className="h-4 w-4 text-sky-400" />
              </div>
              <div>
                <h1 className="text-base font-bold tracking-tight">Creadoras de Contenido</h1>
                {!loading && (
                  <p className="text-[11px] text-white/35">{total} creadoras</p>
                )}
              </div>
            </div>

            {/* Sort selector */}
            <div className="flex gap-1.5">
              {SORT_OPTIONS.map((opt) => (
                <button
                  key={opt.key}
                  onClick={() => setSort(opt.key)}
                  className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-all ${
                    sort === opt.key
                      ? "bg-sky-500/20 text-sky-300 border border-sky-500/30"
                      : "text-white/40 hover:text-white/60 border border-transparent"
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {/* Search */}
          <form onSubmit={handleSearch} className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-white/30" />
            <input
              type="text"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder="Buscar creadoras..."
              className="w-full rounded-xl border border-white/[0.08] bg-white/[0.04] py-2.5 pl-10 pr-4 text-sm text-white placeholder:text-white/30 focus:border-sky-500/30 focus:outline-none focus:ring-1 focus:ring-sky-500/20"
            />
          </form>
        </div>
      </div>

      {/* ── Cross-promotion banner to escorts ── */}
      <div className="max-w-7xl mx-auto px-4 pt-4">
        <Link
          href="/escorts"
          className="flex items-center gap-3 rounded-xl border border-fuchsia-500/15 bg-gradient-to-r from-fuchsia-600/[0.06] to-violet-600/[0.06] p-3 hover:border-fuchsia-500/25 transition-all"
        >
          <Sparkles className="h-5 w-5 text-fuchsia-400/70 shrink-0" />
          <div className="min-w-0">
            <p className="text-xs font-semibold text-white/70">¿Buscas una escort?</p>
            <p className="text-[10px] text-white/35">Encuentra acompañantes verificadas disponibles ahora</p>
          </div>
          <ChevronRight className="ml-auto h-4 w-4 text-white/20 shrink-0" />
        </Link>
      </div>

      {/* ── Results grid ── */}
      <div className="max-w-7xl mx-auto px-4 py-6">
        {loading ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
            {Array.from({ length: 20 }).map((_, i) => (
              <div key={i} className="aspect-[3/4] rounded-2xl bg-white/5 animate-pulse" />
            ))}
          </div>
        ) : results.length === 0 ? (
          <div className="py-24 text-center">
            <p className="text-4xl mb-3">
              <Camera className="h-10 w-10 mx-auto text-white/20" />
            </p>
            <p className="text-white/50">No encontramos creadoras con estos filtros.</p>
            {searchText && (
              <button
                onClick={() => {
                  setSearchInput("");
                  setSearchText("");
                }}
                className="mt-4 text-sm text-sky-400 hover:text-sky-300"
              >
                Limpiar búsqueda
              </button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
            {results.map((c) => (
              <CreadoraCard key={c.id} c={c} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
