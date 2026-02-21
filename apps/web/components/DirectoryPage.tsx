"use client";

import { useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { MapPin, SlidersHorizontal, X, ChevronDown, Search } from "lucide-react";
import { LocationFilterContext } from "../hooks/useLocationFilter";
import { apiFetch, resolveMediaUrl } from "../lib/api";
import UserLevelBadge from "./UserLevelBadge";

/* ─── Types ──────────────────────────────────────────────── */
export type DirectoryResult = {
  id: string;
  username: string;
  displayName: string;
  avatarUrl: string | null;
  coverUrl: string | null;
  age: number | null;
  distance: number | null;
  latitude: number | null;
  longitude: number | null;
  availableNow: boolean;
  isActive: boolean;
  userLevel: string;
  completedServices: number;
  profileViews: number;
  lastSeen: string | null;
  city: string | null;
  serviceCategory: string | null;
  primaryCategory: string | null;
  profileTags: string[];
  serviceTags: string[];
  gender: string | null;
};

/* Catalog constants (also used by TopHeader chips/mega menu) */
export const PRIMARY_CATEGORIES = [
  { key: "escort",     label: "Escort",        route: "/escorts" },
  { key: "masajes",    label: "Masajes",        route: "/masajistas" },
  { key: "moteles",    label: "Moteles",        route: "/moteles" },
  { key: "sexshop",   label: "Sex Shop",       route: "/sexshop" },
  { key: "trans",     label: "Trans",          route: "/escorts?profileTags=trans" },
  { key: "despedidas",label: "Despedidas",     route: "/escorts?serviceTags=despedidas" },
  { key: "videos",    label: "Videollamadas",  route: "/escorts?serviceTags=videollamadas" },
] as const;

export const PROFILE_TAGS_CATALOG = [
  "tetona", "culona", "delgada", "fitness", "gordita",
  "rubia", "morena", "pelirroja", "trigueña",
  "sumisa", "dominante", "caliente", "cariñosa", "natural",
  "tatuada", "piercing",
] as const;

export const SERVICE_TAGS_CATALOG = [
  "anal", "trios", "packs", "videollamada",
  "masaje erotico", "despedidas", "discapacitados", "fetiches",
  "bdsm", "sexo oral", "lluvia dorada", "rol",
] as const;

/* ─── Props ──────────────────────────────────────────────── */
type Props = {
  entityType?: "professional" | "establishment" | "shop";
  categorySlug: string;    // 'escort' | 'masajes' | 'motel' | 'sexshop' | …
  title: string;
  tag?: string;            // tag from [tag] route param → added to profileTags filter
};

/* ─── ProfileCard ────────────────────────────────────────── */
function ProfileCard({ p }: { p: DirectoryResult }) {
  const href = `/profesional/${p.username}`;
  const avatarSrc = p.avatarUrl ? resolveMediaUrl(p.avatarUrl) : null;
  const coverSrc  = p.coverUrl  ? resolveMediaUrl(p.coverUrl)  : null;

  return (
    <Link
      href={href}
      className="group relative flex flex-col overflow-hidden rounded-2xl bg-[#111] border border-white/5 hover:border-fuchsia-500/40 transition-all"
    >
      {/* Cover / hero photo */}
      <div className="relative aspect-[3/4] bg-[#1a1a2e] overflow-hidden">
        {coverSrc || avatarSrc ? (
          <img
            src={coverSrc || avatarSrc!}
            alt={p.displayName}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-4xl text-white/10 font-bold select-none">
            {p.displayName[0]?.toUpperCase()}
          </div>
        )}

        {/* Gradient overlay */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />

        {/* Top badges */}
        <div className="absolute top-2 left-2 right-2 flex items-start justify-between">
          <div className="flex flex-col gap-1">
            {p.availableNow && (
              <span className="rounded-full bg-emerald-500 px-2 py-0.5 text-[10px] font-bold text-white shadow-lg">
                Disponible ahora
              </span>
            )}
          </div>
          <UserLevelBadge level={p.userLevel as "SILVER" | "GOLD" | "DIAMOND" | null} />
        </div>

        {/* Bottom info */}
        <div className="absolute bottom-0 left-0 right-0 p-3">
          <div className="font-semibold text-white text-sm leading-tight truncate">
            {p.displayName}
            {p.age ? <span className="text-white/60 ml-1 font-normal">{p.age}</span> : null}
          </div>
          {p.city && (
            <div className="flex items-center gap-1 text-[11px] text-white/50 mt-0.5">
              <MapPin className="h-3 w-3" />
              <span>{p.city}</span>
              {p.distance != null && (
                <span className="ml-1 text-white/40">· {p.distance < 1 ? `${Math.round(p.distance * 1000)}m` : `${p.distance.toFixed(1)}km`}</span>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Tags row */}
      {p.profileTags.length > 0 && (
        <div className="flex flex-wrap gap-1 p-2 bg-black/30">
          {p.profileTags.slice(0, 3).map((t) => (
            <span key={t} className="rounded-full bg-fuchsia-500/10 border border-fuchsia-500/20 px-2 py-0.5 text-[10px] text-fuchsia-300 capitalize">
              {t}
            </span>
          ))}
        </div>
      )}
    </Link>
  );
}

/* ─── Main ───────────────────────────────────────────────── */
export default function DirectoryPage({ entityType = "professional", categorySlug, title, tag }: Props) {
  const searchParams = useSearchParams();
  const locationCtx = useContext(LocationFilterContext);

  /* ── local filter state ── */
  const [profileTagsFilter, setProfileTagsFilter] = useState<string[]>(
    tag ? [tag] : searchParams.get("profileTags")?.split(",").filter(Boolean) ?? [],
  );
  const [serviceTagsFilter, setServiceTagsFilter] = useState<string[]>(
    searchParams.get("serviceTags")?.split(",").filter(Boolean) ?? [],
  );
  const [maduras, setMaduras] = useState(searchParams.get("maduras") === "true");
  const [availableNow, setAvailableNow] = useState(false);
  const [sort, setSort] = useState<"featured" | "near" | "new" | "availableNow">("featured");
  const [genderFilter, setGenderFilter] = useState(searchParams.get("gender") || "");
  const [showFilters, setShowFilters] = useState(false);
  const [search, setSearch] = useState("");

  /* ── data state ── */
  const [results, setResults] = useState<DirectoryResult[]>([]);
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(0);

  /* ── location from context ── */
  const effectiveLoc = locationCtx?.effectiveLocation ?? null;
  const locationLabel = locationCtx?.state.mode === "city"
    ? locationCtx.state.selectedCity?.name ?? null
    : effectiveLoc ? "Mi ubicación" : null;

  /* ── fetch from real API ── */
  const fetchRef = useRef(0);
  const fetchResults = useCallback(async () => {
    const myFetch = ++fetchRef.current;
    setLoading(true);
    try {
      const params = new URLSearchParams({
        entityType,
        categorySlug,
        sort,
        limit: "60",
      });
      if (effectiveLoc) {
        params.set("lat", String(effectiveLoc[0]));
        params.set("lng", String(effectiveLoc[1]));
        params.set("radiusKm", "100");
      }
      if (profileTagsFilter.length) params.set("profileTags", profileTagsFilter.join(","));
      if (serviceTagsFilter.length) params.set("serviceTags", serviceTagsFilter.join(","));
      if (maduras) params.set("maduras", "true");
      if (availableNow) params.set("availableNow", "true");
      if (genderFilter) params.set("gender", genderFilter);

      const data = await apiFetch<{ results: DirectoryResult[]; total: number }>(
        `/directory/search?${params.toString()}`,
      );
      if (myFetch !== fetchRef.current) return;
      setResults(data.results ?? []);
      setTotal(data.total ?? 0);
    } catch {
      if (myFetch !== fetchRef.current) return;
      setResults([]);
    } finally {
      if (myFetch === fetchRef.current) setLoading(false);
    }
  }, [entityType, categorySlug, effectiveLoc, profileTagsFilter, serviceTagsFilter, maduras, availableNow, sort, genderFilter]);

  useEffect(() => { fetchResults(); }, [fetchResults]);

  /* ── client-side name search (filter on rendered results) ── */
  const displayed = useMemo(() => {
    if (!search.trim()) return results;
    const q = search.toLowerCase();
    return results.filter(
      (r) =>
        (r.displayName || "").toLowerCase().includes(q) ||
        (r.city || "").toLowerCase().includes(q) ||
        r.profileTags.some((t) => t.includes(q)),
    );
  }, [results, search]);

  /* ── toggle helpers ── */
  function toggleProfileTag(t: string) {
    setProfileTagsFilter((prev) =>
      prev.includes(t) ? prev.filter((x) => x !== t) : [...prev, t],
    );
  }
  function toggleServiceTag(t: string) {
    setServiceTagsFilter((prev) =>
      prev.includes(t) ? prev.filter((x) => x !== t) : [...prev, t],
    );
  }

  const activeFilterCount = profileTagsFilter.length + serviceTagsFilter.length +
    (maduras ? 1 : 0) + (availableNow ? 1 : 0) + (genderFilter ? 1 : 0);

  return (
    <div className="min-h-screen bg-[#08090f] text-white">
      {/* ── Sticky header ── */}
      <div className="sticky top-0 z-20 bg-[#08090f]/90 backdrop-blur-xl border-b border-white/5">
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center gap-3">
          {/* Title + count */}
          <div className="flex-1 min-w-0">
            <h1 className="text-lg font-bold truncate">{title}</h1>
            {locationLabel && (
              <p className="text-xs text-white/40 flex items-center gap-1">
                <MapPin className="h-3 w-3" />
                {locationLabel}
                {!loading && <span>· {total} resultado{total !== 1 ? "s" : ""}</span>}
              </p>
            )}
          </div>

          {/* Search */}
          <div className="relative hidden sm:flex items-center">
            <Search className="absolute left-3 h-4 w-4 text-white/30" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar…"
              className="h-9 rounded-xl bg-white/5 border border-white/10 pl-9 pr-3 text-sm text-white placeholder-white/30 focus:outline-none focus:border-fuchsia-500/50 w-40"
            />
          </div>

          {/* Sort */}
          <div className="relative">
            <select
              value={sort}
              onChange={(e) => setSort(e.target.value as typeof sort)}
              className="h-9 rounded-xl bg-white/5 border border-white/10 px-3 text-sm text-white appearance-none pr-7 focus:outline-none focus:border-fuchsia-500/50 cursor-pointer"
            >
              <option value="featured">Destacadas</option>
              <option value="near">Más cercanas</option>
              <option value="new">Nuevas</option>
              <option value="availableNow">Disponibles</option>
            </select>
            <ChevronDown className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-white/40" />
          </div>

          {/* Filters button */}
          <button
            onClick={() => setShowFilters((v) => !v)}
            className={`relative h-9 px-3 rounded-xl border text-sm flex items-center gap-1.5 transition ${
              showFilters || activeFilterCount > 0
                ? "border-fuchsia-500/60 bg-fuchsia-500/10 text-fuchsia-300"
                : "border-white/10 bg-white/5 text-white/70 hover:bg-white/10"
            }`}
          >
            <SlidersHorizontal className="h-4 w-4" />
            <span className="hidden sm:inline">Filtros</span>
            {activeFilterCount > 0 && (
              <span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-fuchsia-500 text-[9px] font-bold text-white">
                {activeFilterCount}
              </span>
            )}
          </button>
        </div>

        {/* ── Filter panel ── */}
        {showFilters && (
          <div className="border-t border-white/5 px-4 py-4 max-w-7xl mx-auto space-y-4">
            {/* Quick filters */}
            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => setAvailableNow((v) => !v)}
                className={`rounded-full border px-3 py-1 text-xs font-medium transition ${
                  availableNow ? "border-emerald-500 bg-emerald-500/10 text-emerald-400" : "border-white/10 text-white/50 hover:border-white/20"
                }`}
              >
                🟢 Disponible ahora
              </button>
              <button
                onClick={() => setMaduras((v) => !v)}
                className={`rounded-full border px-3 py-1 text-xs font-medium transition ${
                  maduras ? "border-amber-500 bg-amber-500/10 text-amber-400" : "border-white/10 text-white/50 hover:border-white/20"
                }`}
              >
                Maduras (40+)
              </button>
              {["FEMALE", "MALE", "OTHER"].map((g) => (
                <button
                  key={g}
                  onClick={() => setGenderFilter((v) => (v === g ? "" : g))}
                  className={`rounded-full border px-3 py-1 text-xs font-medium transition ${
                    genderFilter === g ? "border-violet-500 bg-violet-500/10 text-violet-300" : "border-white/10 text-white/50 hover:border-white/20"
                  }`}
                >
                  {g === "FEMALE" ? "Mujeres" : g === "MALE" ? "Hombres" : "Trans"}
                </button>
              ))}
            </div>

            {/* Profile tags */}
            <div>
              <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-white/40">
                Cómo se definen
              </p>
              <div className="flex flex-wrap gap-1.5">
                {PROFILE_TAGS_CATALOG.map((t) => (
                  <button
                    key={t}
                    onClick={() => toggleProfileTag(t)}
                    className={`rounded-full border px-2.5 py-1 text-xs capitalize transition ${
                      profileTagsFilter.includes(t)
                        ? "border-fuchsia-500 bg-fuchsia-500/15 text-fuchsia-300"
                        : "border-white/10 text-white/50 hover:border-white/20"
                    }`}
                  >
                    {t}
                  </button>
                ))}
              </div>
            </div>

            {/* Service tags */}
            <div>
              <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-white/40">
                Servicios
              </p>
              <div className="flex flex-wrap gap-1.5">
                {SERVICE_TAGS_CATALOG.map((t) => (
                  <button
                    key={t}
                    onClick={() => toggleServiceTag(t)}
                    className={`rounded-full border px-2.5 py-1 text-xs capitalize transition ${
                      serviceTagsFilter.includes(t)
                        ? "border-violet-500 bg-violet-500/15 text-violet-300"
                        : "border-white/10 text-white/50 hover:border-white/20"
                    }`}
                  >
                    {t}
                  </button>
                ))}
              </div>
            </div>

            {/* Clear */}
            {activeFilterCount > 0 && (
              <button
                onClick={() => {
                  setProfileTagsFilter([]);
                  setServiceTagsFilter([]);
                  setMaduras(false);
                  setAvailableNow(false);
                  setGenderFilter("");
                }}
                className="flex items-center gap-1 text-xs text-white/40 hover:text-white/70 transition"
              >
                <X className="h-3.5 w-3.5" /> Limpiar filtros
              </button>
            )}
          </div>
        )}
      </div>

      {/* ── Results grid ── */}
      <div className="max-w-7xl mx-auto px-4 py-6">
        {loading ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
            {Array.from({ length: 20 }).map((_, i) => (
              <div key={i} className="aspect-[3/4] rounded-2xl bg-white/5 animate-pulse" />
            ))}
          </div>
        ) : displayed.length === 0 ? (
          <div className="py-24 text-center">
            <p className="text-4xl mb-3">🔍</p>
            <p className="text-white/50">No encontramos resultados con estos filtros.</p>
            {activeFilterCount > 0 && (
              <button
                onClick={() => { setProfileTagsFilter([]); setServiceTagsFilter([]); setMaduras(false); setAvailableNow(false); setGenderFilter(""); }}
                className="mt-4 text-sm text-fuchsia-400 hover:text-fuchsia-300"
              >
                Limpiar filtros
              </button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
            {displayed.map((p) => (
              <ProfileCard key={p.id} p={p} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
