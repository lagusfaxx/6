"use client";

import { useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { useSearchParams } from "next/navigation";
import { MapPin, SlidersHorizontal, X, ChevronDown, Search, Map as MapIcon, Sparkles, Flame, Video, Crown, ShieldCheck } from "lucide-react";
import { LocationFilterContext } from "../hooks/useLocationFilter";
import { apiFetch, isRateLimitError, resolveMediaUrl } from "../lib/api";
import { filterUserTags, hasPremiumBadge, hasVerifiedBadge } from "../lib/systemBadges";
import StatusBadgeIcon from "./StatusBadgeIcon";
import UserLevelBadge from "./UserLevelBadge";
import type { MapMarker } from "./MapboxMap";
const MapboxMap = dynamic(() => import("./MapboxMap"), { ssr: false });
const ProfilePreviewModal = dynamic(() => import("./ProfilePreviewModal"), { ssr: false });
const Stories = dynamic(() => import("./Stories"), { ssr: false });

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
  profileType?: string | null;
  avgResponseMinutes?: number | null;
  websiteUrl?: string | null;
  externalOnly?: boolean;
  adminQualityScore?: number | null;
};

/* Catalog constants (also used by TopHeader chips/mega menu) */
export const PRIMARY_CATEGORIES = [
  { key: "escort",     label: "Escort",        route: "/escorts" },
  { key: "masajes",    label: "Masajes",        route: "/masajistas" },
  { key: "moteles",    label: "Moteles",        route: "/moteles" },
  { key: "sexshop",   label: "Sex Shop",       route: "/sexshop" },
  { key: "trans",     label: "Trans",          route: "/escorts?profileTags=trans" },
  { key: "despedidas",label: "Despedidas",     route: "/escorts?serviceTags=despedidas" },
  { key: "videos",    label: "Videollamadas",  route: "/escorts?serviceTags=videollamada" },
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
function ProfileCard({
  p,
  entityType,
  categorySlug,
  onOpenModal,
}: {
  p: DirectoryResult;
  entityType: string;
  categorySlug?: string;
  onOpenModal: (profile: DirectoryResult) => void;
}) {
  const isExternal = p.externalOnly && p.websiteUrl;
  let href: string;
  if (isExternal) {
    href = p.websiteUrl!;
  } else if (entityType === "establishment") {
    href = categorySlug === "motel" ? `/hospedaje/${p.id}` : `/establecimiento/${p.id}`;
  } else if (entityType === "shop") {
    href = `/sexshop/${p.username || p.id}`;
  } else {
    href = `/profesional/${p.id}`;
  }
  const avatarSrc = p.avatarUrl ? resolveMediaUrl(p.avatarUrl) : null;
  const coverSrc  = p.coverUrl  ? resolveMediaUrl(p.coverUrl)  : null;

  const userTags = filterUserTags(p.profileTags);
  const maxVisibleTags = 2;
  const extraTagCount = userTags.length - maxVisibleTags;

  const cardRef = useRef<HTMLDivElement>(null);

  const handleCardClick = useCallback(async (e: React.MouseEvent) => {
    // Don't intercept clicks on links/buttons inside the card
    const target = e.target as HTMLElement;
    if (target.closest("a") || target.closest("button")) return;
    e.preventDefault();
    e.stopPropagation();

    // Establishments & shops → navigate directly to detail page (or external site)
    if (entityType === "establishment" || entityType === "shop") {
      if (isExternal) {
        window.open(href, "_blank", "noopener,noreferrer");
      } else {
        window.location.href = href;
      }
      return;
    }

    // Professionals → open full ProfilePreviewModal (same as /services)
    onOpenModal(p);
  }, [p, entityType, href, onOpenModal]);

  const tierClass = p.userLevel === "DIAMOND" ? "uzeed-tier-diamond" : p.userLevel === "GOLD" ? "uzeed-tier-gold" : "";

  return (
    <div
      ref={cardRef}
      onClick={handleCardClick}
      className={`uzeed-premium-card uzeed-card-feed group relative flex flex-col cursor-pointer ${tierClass}`}
    >
      {/* Cover / hero photo with shimmer effect */}
      <div className="uzeed-card-shimmer relative aspect-[3/4] bg-[#0a0a10] overflow-hidden">
        {coverSrc || avatarSrc ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={coverSrc || avatarSrc!}
            alt={p.displayName}
            loading="lazy"
            decoding="async"
            fetchPriority="low"
            className="uzeed-card-img w-full h-full object-cover"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-fuchsia-900/40 via-violet-900/30 to-indigo-900/20">
            <span className="text-5xl font-black text-white/[0.06] select-none tracking-tighter">
              {p.displayName[0]?.toUpperCase()}
            </span>
          </div>
        )}

        {/* Multi-layer gradient overlay for depth */}
        <div className="uzeed-card-gradient absolute inset-0 pointer-events-none" />
        <div className="absolute inset-0 bg-gradient-to-br from-fuchsia-600/[0.04] via-transparent to-violet-600/[0.04] pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity duration-500" />

        {/* Top-left: status badges */}
        <div className="absolute top-2.5 left-2.5 flex flex-col gap-1.5 z-[3]">
          {p.availableNow && (
            <span className="uzeed-badge-pill uzeed-badge-online">
              <span className="uzeed-badge-dot" />
              Online
            </span>
          )}
        </div>

        {/* Top-right: level badge */}
        <div className="absolute top-2.5 right-2.5 z-[3]">
          <UserLevelBadge level={p.userLevel as "SILVER" | "GOLD" | "DIAMOND" | null} />
        </div>

        {/* Bottom info overlay with premium layout */}
        <div className="absolute bottom-0 left-0 right-0 p-3 z-[3]">
          {/* Name + age + verification badges */}
          <div className="flex items-center gap-1.5 font-bold text-white text-[13px] sm:text-sm leading-tight">
            <span className="truncate">{p.displayName}</span>
            {hasPremiumBadge(p.profileTags) && <StatusBadgeIcon type="premium" size="h-3.5 w-3.5" />}
            {hasVerifiedBadge(p.profileTags) && <StatusBadgeIcon type="verificada" size="h-3.5 w-3.5" />}
            {p.adminQualityScore != null && p.adminQualityScore > 0 && <StatusBadgeIcon type="quality" size="h-3.5 w-3.5" />}
            {p.age ? <span className="text-white/50 font-normal text-[11px] tabular-nums">{p.age}</span> : null}
          </div>

          {/* City / distance with subtle icon */}
          <div className="flex items-center gap-1.5 text-[11px] text-white/45 mt-1">
            {p.city && (
              <span className="flex items-center gap-1 truncate">
                <MapPin className="h-3 w-3 shrink-0 text-fuchsia-400/50" />
                {p.city}
              </span>
            )}
            {p.distance != null && (
              <span className="text-white/35 shrink-0 tabular-nums">
                · {p.distance < 1 ? `${Math.round(p.distance * 1000)}m` : `${p.distance.toFixed(1)}km`}
              </span>
            )}
          </div>

          {/* Tags with premium pill style */}
          {userTags.length > 0 && (
            <div className="flex items-center gap-1 mt-2">
              {userTags.slice(0, maxVisibleTags).map((t) => (
                <span key={t} className="uzeed-tag uzeed-tag-fuchsia truncate max-w-[80px]">
                  {t}
                </span>
              ))}
              {extraTagCount > 0 && (
                <span className="uzeed-tag bg-white/[0.08] border border-white/[0.08] text-white/40">
                  +{extraTagCount}
                </span>
              )}
            </div>
          )}
        </div>
      </div>

    </div>
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
  const [availableNow, setAvailableNow] = useState(searchParams.get("availableNow") === "true");
  const [sort, setSort] = useState<"featured" | "near" | "new" | "availableNow">(
    searchParams.get("availableNow") === "true" ? "availableNow" : "featured",
  );
  const [genderFilter, setGenderFilter] = useState(searchParams.get("gender") || "");
  const [showFilters, setShowFilters] = useState(false);
  const [search, setSearch] = useState(searchParams.get("q") || "");
  /* Query que pide el server-side search. Se captura UNA VEZ desde la URL
     para no refetchear mientras el usuario tipea dentro de la página. */
  const [urlQuery] = useState(searchParams.get("q") || "");

  /* ── data state ── */
  const [results, setResults] = useState<DirectoryResult[]>([]);
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(0);
  const [rateLimitMsg, setRateLimitMsg] = useState<string | null>(null);

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
      if (urlQuery.trim()) params.set("q", urlQuery.trim().slice(0, 80));

      const data = await apiFetch<{ results: DirectoryResult[]; total: number }>(
        `/directory/search?${params.toString()}`,
      );
      if (myFetch !== fetchRef.current) return;
      setResults(data.results ?? []);
      setTotal(data.total ?? 0);
      setRateLimitMsg(null);
    } catch (err: any) {
      if (myFetch !== fetchRef.current) return;
      if (isRateLimitError(err)) {
        setRateLimitMsg("Demasiadas solicitudes, intenta en unos segundos.");
      } else {
        setResults([]);
      }
    } finally {
      if (myFetch === fetchRef.current) setLoading(false);
    }
  }, [entityType, categorySlug, effectiveLoc, profileTagsFilter, serviceTagsFilter, maduras, availableNow, sort, genderFilter, urlQuery]);

  useEffect(() => { fetchResults(); }, [fetchResults]);

  /* ── client-side name search (filter on rendered results) ── */
  const displayed = useMemo(() => {
    if (!search.trim()) return results;
    const q = search.toLowerCase();
    return results.filter(
      (r) =>
        (r.displayName || "").toLowerCase().includes(q) ||
        (r.city || "").toLowerCase().includes(q) ||
        (r.serviceCategory || "").toLowerCase().includes(q) ||
        r.profileTags.some((t) => t.toLowerCase().includes(q)) ||
        r.serviceTags.some((t) => t.toLowerCase().includes(q)),
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

  const [showMap, setShowMap] = useState(true);
  const [previewProfile, setPreviewProfile] = useState<DirectoryResult | null>(null);

  /* ── Map markers: only from current category's results ── */
  const mapMarkers = useMemo(
    () =>
      displayed
        .filter((p) => Number.isFinite(Number(p.latitude)) && Number.isFinite(Number(p.longitude)))
        .map((p) => ({
          id: p.id,
          name: p.displayName,
          lat: Number(p.latitude),
          lng: Number(p.longitude),
          subtitle: p.serviceCategory || p.city || title,
          username: p.username,
          href: p.externalOnly && p.websiteUrl
            ? p.websiteUrl
            : entityType === "establishment"
              ? (categorySlug === "motel" ? `/hospedaje/${p.id}` : `/establecimiento/${p.id}`)
              : entityType === "shop"
                ? `/sexshop/${p.username || p.id}`
                : `/profesional/${p.id}`,
          avatarUrl: p.avatarUrl,
          coverUrl: p.coverUrl,
          age: p.age,
          level: p.userLevel,
          lastSeen: p.lastSeen,
          tier: p.availableNow ? "online" as const : "offline" as const,
          areaRadiusM: 500,
        })),
    [displayed, title],
  );

  const mapCenter: [number, number] | null = effectiveLoc;

  const activeFilterCount = profileTagsFilter.length + serviceTagsFilter.length +
    (maduras ? 1 : 0) + (availableNow ? 1 : 0) + (genderFilter ? 1 : 0);

  return (
    <div className="-mx-4 -mt-4 min-h-screen text-white">
      {/* ── Sticky header ── */}
      <div className="sticky top-[60px] md:top-[68px] z-20 bg-[#0d0e1a]/95 backdrop-blur-xl border-b border-white/[0.06]">
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center gap-3">
          {/* Title + count */}
          <div className="flex-1 min-w-0">
            <h1 className="text-lg font-bold truncate flex items-center gap-2">
              <Flame className="h-4 w-4 text-fuchsia-400" />
              {title}
            </h1>
            <div className="flex items-center gap-2 mt-0.5">
              {locationLabel && (
                <span className="text-[11px] text-fuchsia-300/70 flex items-center gap-1 font-medium">
                  <MapPin className="h-3 w-3" />
                  {locationLabel}
                </span>
              )}
              {!loading && (
                <span className="text-[11px] text-white/30">· {total} resultado{total !== 1 ? "s" : ""}</span>
              )}
            </div>
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

          {/* Map toggle */}
          <button
            onClick={() => setShowMap((v) => !v)}
            className={`h-9 px-3 rounded-xl border text-sm flex items-center gap-1.5 transition ${
              showMap
                ? "border-fuchsia-500/30 bg-fuchsia-500/10 text-fuchsia-300"
                : "border-white/10 bg-white/5 text-white/50"
            }`}
          >
            <MapIcon className="h-4 w-4" />
            <span className="hidden sm:inline">Mapa</span>
          </button>

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

      {/* ── Stories ── */}
      <div className="max-w-7xl mx-auto px-4 pt-4">
        <Stories />
      </div>

      {/* ── Map (filtered by current category only) ── */}
      {showMap && !loading && mapMarkers.length > 0 && (
        <div className="max-w-7xl mx-auto px-4 pt-4">
          <div className="overflow-hidden rounded-2xl border border-white/[0.08]">
            <MapboxMap
              userLocation={mapCenter}
              markers={mapMarkers}
              height={260}
              autoCenterOnDataChange
              showMarkersForArea
              renderHtmlMarkers
              onMarkerSelect={(marker: MapMarker) => {
                const match = displayed.find((p) => p.id === marker.id);
                if (match) setPreviewProfile(match);
              }}
            />
          </div>
        </div>
      )}

      {/* ── Rate-limit banner ── */}
      {rateLimitMsg && (
        <div className="max-w-7xl mx-auto px-4 pt-4">
          <div className="rounded-lg bg-amber-500/10 border border-amber-500/30 px-4 py-2 text-sm text-amber-300 text-center">
            {rateLimitMsg}
          </div>
        </div>
      )}

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
              <ProfileCard key={p.id} p={p} entityType={entityType} categorySlug={categorySlug} onOpenModal={setPreviewProfile} />
            ))}
          </div>
        )}
      </div>

      {/* Profile Preview Modal (from map marker click) */}
      {previewProfile && (
        <ProfilePreviewModal
          profile={{
            id: previewProfile.id,
            displayName: previewProfile.displayName,
            username: previewProfile.username,
            avatarUrl: previewProfile.avatarUrl,
            coverUrl: previewProfile.coverUrl,
            age: previewProfile.age,
            distance: previewProfile.distance,
            availableNow: previewProfile.availableNow,
            userLevel: previewProfile.userLevel,
            serviceCategory: previewProfile.serviceCategory,
            profileTags: previewProfile.profileTags,
            serviceTags: previewProfile.serviceTags,
            profileType: previewProfile.profileType,
          }}
          onClose={() => setPreviewProfile(null)}
        />
      )}

    </div>
  );
}
