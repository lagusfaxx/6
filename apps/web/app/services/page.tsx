"use client";

import { memo, useContext, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { apiFetch, resolveMediaUrl } from "../../lib/api";
import { LocationFilterContext } from "../../hooks/useLocationFilter";
import useMe from "../../hooks/useMe";
import MapboxMap from "../../components/MapboxMap";
import UserLevelBadge from "../../components/UserLevelBadge";
import ProfilePreviewModal from "../../components/ProfilePreviewModal";
import Stories from "../../components/Stories";
import {
  MapPin,
  Search,
  SlidersHorizontal,
  X,
  Navigation,
  Sparkles,
  Users,
  Building2,
  ShoppingBag,
  ChevronDown,
  ChevronRight,
  MessageCircle,
  Crown,
  Star,
  Flame,
  Clock,
  Eye,
} from "lucide-react";

type ProfileResult = {
  id: string;
  displayName: string | null;
  username: string;
  avatarUrl: string | null;
  coverUrl: string | null;
  bio: string | null;
  city: string | null;
  latitude: number | null;
  longitude: number | null;
  realLatitude?: number | null;
  realLongitude?: number | null;
  distance: number | null;
  locality?: string | null;
  profileType: "PROFESSIONAL" | "ESTABLISHMENT" | "SHOP";
  serviceCategory: string | null;
  serviceDescription: string | null;
  isActive: boolean;
  availableNow?: boolean;
  lastSeen?: string | null;
  userLevel?: "SILVER" | "GOLD" | "DIAMOND";
  completedServices?: number | null;
  age?: number | null;
  heightCm?: number | null;
  hairColor?: string | null;
  weightKg?: number | null;
  baseRate?: number | null;
  galleryUrls?: string[] | null;
  profileTags?: string[];
  serviceTags?: string[];
  userId?: string | null;
};

const INITIAL_RADIUS_KM = 50;

const CATEGORY_TABS = [
  { key: "all", label: "Todas", icon: Users },
  { key: "escort", label: "Escorts", icon: Sparkles },
  { key: "masajes", label: "Masajes", icon: Users },
  { key: "moteles", label: "Moteles", icon: Building2 },
  { key: "sexshop", label: "Sex Shop", icon: ShoppingBag },
] as const;

const QUICK_FILTERS = [
  { key: "disponible", label: "Disponible ahora", icon: Clock, activeColor: "border-emerald-500 bg-emerald-500/10 text-emerald-400" },
  { key: "destacada", label: "Destacadas", icon: Star, activeColor: "border-amber-500 bg-amber-500/10 text-amber-300" },
  { key: "maduras", label: "Maduras (40+)", icon: Flame, activeColor: "border-fuchsia-500 bg-fuchsia-500/10 text-fuchsia-300" },
] as const;

const SORT_OPTIONS = [
  { key: "relevance", label: "Relevancia" },
  { key: "distance", label: "Más cerca" },
  { key: "newest", label: "Nuevas" },
  { key: "available", label: "Disponibles" },
] as const;

function ownerHref(profile: ProfileResult) {
  if (profile.profileType === "ESTABLISHMENT") return `/hospedaje/${profile.id}`;
  if (profile.profileType === "SHOP") return `/sexshop/${profile.username}`;
  return `/profesional/${profile.id}`;
}

function resolveCardImage(profile: ProfileResult) {
  return resolveMediaUrl(profile.coverUrl) ?? resolveMediaUrl(profile.avatarUrl);
}

function formatLastSeen(lastSeen?: string | null) {
  if (!lastSeen) return "Activa recientemente";
  const diff = Date.now() - Date.parse(lastSeen);
  if (!Number.isFinite(diff) || diff < 0) return "Activa recientemente";
  const minutes = Math.floor(diff / 60000);
  if (minutes < 60) return `Hace ${minutes}m`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `Hace ${hours}h`;
  const days = Math.floor(hours / 24);
  return `Hace ${days}d`;
}

function tierOrder(level?: string) {
  if (level === "DIAMOND") return 0;
  if (level === "GOLD") return 1;
  return 2;
}

function tierBorderClass(level?: string) {
  if (level === "DIAMOND") return "border-cyan-400/30 hover:border-cyan-400/50 hover:shadow-[0_8px_32px_rgba(34,211,238,0.12)]";
  if (level === "GOLD") return "border-amber-400/30 hover:border-amber-400/50 hover:shadow-[0_8px_32px_rgba(251,191,36,0.12)]";
  return "border-white/[0.08] hover:border-fuchsia-500/20";
}

/* ── Featured Card (Diamond / Gold) ── */
const FeaturedCard = memo(function FeaturedCard({
  profile,
  onPreview,
  isAuthed,
}: {
  profile: ProfileResult;
  onPreview: (p: ProfileResult) => void;
  isAuthed: boolean;
}) {
  const img = resolveCardImage(profile);
  const chatHref = isAuthed
    ? `/chat/${profile.userId || profile.id}`
    : `/login?next=${encodeURIComponent(`/chat/${profile.userId || profile.id}`)}`;

  const isDiamond = profile.userLevel === "DIAMOND";
  const glowClass = isDiamond
    ? "shadow-[0_4px_24px_rgba(34,211,238,0.15)]"
    : "shadow-[0_4px_24px_rgba(251,191,36,0.12)]";

  return (
    <div className={`group w-[75vw] shrink-0 snap-start overflow-hidden rounded-2xl border-2 ${isDiamond ? "border-cyan-400/30" : "border-amber-400/30"} bg-white/[0.03] transition-all duration-300 hover:-translate-y-1 ${glowClass} sm:w-auto`}>
      <button type="button" onClick={() => onPreview(profile)} className="block w-full text-left">
        <div className="relative aspect-[3/4] overflow-hidden bg-white/[0.04]">
          {img ? (
            <img src={img} alt={profile.displayName || profile.username} className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.06]" />
          ) : (
            <div className="flex h-full items-center justify-center"><Users className="h-12 w-12 text-white/10" /></div>
          )}
          {/* Top badges */}
          <div className="absolute top-2 left-2 right-2 flex justify-between items-start">
            <div className="flex flex-col gap-1">
              {profile.availableNow && (
                <span className="flex items-center gap-1 rounded-full bg-emerald-500/90 px-2 py-0.5 text-[10px] font-bold text-white shadow-lg">
                  <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-white" /> Online
                </span>
              )}
            </div>
            <UserLevelBadge level={profile.userLevel} className="px-2 py-0.5 text-[10px] shadow-lg" />
          </div>
          {/* Distance */}
          {profile.distance != null && (
            <div className="absolute right-2 bottom-14 rounded-full border border-white/10 bg-black/50 px-2 py-0.5 text-[10px] text-white/80 backdrop-blur">
              <MapPin className="mr-0.5 inline h-3 w-3" />
              {profile.distance < 1 ? `${Math.round(profile.distance * 1000)}m` : `${profile.distance.toFixed(1)} km`}
            </div>
          )}
          {/* Gradient */}
          <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/10 to-transparent" />
          {/* Info */}
          <div className="absolute bottom-0 left-0 right-0 p-3">
            <div className="text-base font-bold leading-tight">
              {profile.displayName || profile.username}
              {profile.age ? <span className="text-white/60 font-normal">, {profile.age}</span> : ""}
            </div>
            <div className="mt-0.5 flex items-center gap-2 text-[11px] text-white/50">
              {profile.city && <span>{profile.city}</span>}
              <span>{formatLastSeen(profile.lastSeen)}</span>
            </div>
          </div>
        </div>
      </button>
      {/* CTA */}
      <div className="flex gap-2 p-2">
        <Link
          href={chatHref}
          className="flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-gradient-to-r from-fuchsia-600 to-violet-600 py-2.5 text-xs font-semibold transition hover:brightness-110 shadow-[0_4px_16px_rgba(168,85,247,0.25)]"
        >
          <MessageCircle className="h-3.5 w-3.5" /> Mensaje
        </Link>
        <Link
          href={ownerHref(profile)}
          className="flex items-center justify-center rounded-xl border border-white/15 bg-white/[0.06] px-3 py-2.5 text-xs font-medium text-white/70 hover:bg-white/10 transition"
        >
          <Eye className="h-3.5 w-3.5" />
        </Link>
      </div>
    </div>
  );
});

/* ── Standard Card ── */
const ProfileCard = memo(function ProfileCard({
  profile,
  onPreview,
  isAuthed,
}: {
  profile: ProfileResult;
  onPreview: (p: ProfileResult) => void;
  isAuthed: boolean;
}) {
  const img = resolveCardImage(profile);
  const chatHref = isAuthed
    ? `/chat/${profile.userId || profile.id}`
    : `/login?next=${encodeURIComponent(`/chat/${profile.userId || profile.id}`)}`;

  return (
    <div className={`group overflow-hidden rounded-2xl border ${tierBorderClass(profile.userLevel)} bg-white/[0.03] transition-all duration-200 hover:-translate-y-0.5`}>
      <button type="button" onClick={() => onPreview(profile)} className="block w-full text-left">
        <div className="relative aspect-[3/4] overflow-hidden bg-white/[0.04]">
          {img ? (
            <img src={img} alt={profile.displayName || profile.username} className="h-full w-full object-cover transition group-hover:scale-105" />
          ) : (
            <div className="flex h-full items-center justify-center text-white/20"><Users className="h-10 w-10" /></div>
          )}
          {profile.distance != null && (
            <div className="absolute right-1.5 top-1.5 rounded-full border border-white/10 bg-black/50 px-1.5 py-0.5 text-[9px] backdrop-blur">
              <MapPin className="mr-0.5 inline h-2.5 w-2.5" />
              {profile.distance < 1 ? `${Math.round(profile.distance * 1000)}m` : `${profile.distance.toFixed(1)}km`}
            </div>
          )}
          {profile.availableNow ? (
            <div className="absolute left-1.5 top-1.5 flex items-center gap-1 rounded-full border border-emerald-300/20 bg-emerald-500/80 px-1.5 py-0.5 text-[9px] text-white font-medium backdrop-blur shadow">
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-white" /> Online
            </div>
          ) : null}
          <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent" />
          <div className="absolute bottom-0 left-0 right-0 p-2">
            <div className="flex items-center gap-1">
              <span className="truncate text-xs font-semibold">
                {profile.displayName || profile.username}
                {profile.age ? `, ${profile.age}` : ""}
              </span>
              <UserLevelBadge level={profile.userLevel} className="shrink-0 px-1 py-0 text-[8px]" />
            </div>
            <p className="mt-0.5 text-[9px] text-white/45">{profile.city ? `${profile.city} · ` : ""}{formatLastSeen(profile.lastSeen)}</p>
          </div>
        </div>
      </button>
      <div className="flex gap-1.5 p-1.5">
        <Link
          href={chatHref}
          className="flex flex-1 items-center justify-center gap-1 rounded-lg bg-gradient-to-r from-fuchsia-600/90 to-violet-600/90 py-2 text-[11px] font-semibold transition hover:brightness-110"
        >
          <MessageCircle className="h-3 w-3" /> Mensaje
        </Link>
        <Link
          href={ownerHref(profile)}
          className="flex items-center justify-center rounded-lg border border-white/10 bg-white/[0.04] px-2.5 py-2 text-[11px] text-white/60 hover:bg-white/10 transition"
        >
          <Eye className="h-3 w-3" />
        </Link>
      </div>
    </div>
  );
});

/* ═══ PAGE ═══ */
export default function ServicesPage() {
  const locationCtx = useContext(LocationFilterContext);
  const effectiveLoc = locationCtx?.effectiveLocation ?? null;
  const { me } = useMe();
  const isAuthed = Boolean(me?.user?.id);

  const [profiles, setProfiles] = useState<ProfileResult[]>([]);
  const [loading, setLoading] = useState(true);
  const [hasLoadedOnce, setHasLoadedOnce] = useState(false);
  const [category, setCategory] = useState<string>("all");
  const [search, setSearch] = useState("");
  const [radiusKm, setRadiusKm] = useState(INITIAL_RADIUS_KM);
  const [showFilters, setShowFilters] = useState(false);
  const [sortBy, setSortBy] = useState<string>("relevance");
  const [previewProfile, setPreviewProfile] = useState<ProfileResult | null>(null);
  const [activeQuickFilters, setActiveQuickFilters] = useState<Set<string>>(new Set());
  const [showMap, setShowMap] = useState(true);
  const fetchRef = useRef(0);

  const toggleQuickFilter = (key: string) => {
    setActiveQuickFilters((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const mapCenter: [number, number] | null = effectiveLoc;
  const locationLabel = locationCtx?.state.mode === "city"
    ? locationCtx.state.selectedCity?.name ?? null
    : effectiveLoc ? "Tu ubicación" : null;

  useEffect(() => {
    if (typeof window === "undefined") return;
    const query = new URLSearchParams(window.location.search);
    if (query.get("q")) setSearch(query.get("q") || "");
    if (query.get("radiusKm")) setRadiusKm(Number(query.get("radiusKm")) || INITIAL_RADIUS_KM);
    if (query.get("category")) setCategory(query.get("category") || "all");
    if (query.get("sort")) setSortBy(query.get("sort") || "relevance");
  }, []);

  useEffect(() => {
    const myFetch = ++fetchRef.current;
    if (!hasLoadedOnce) setLoading(true);

    const qp = new URLSearchParams();
    if (category !== "all") {
      if (category === "moteles") {
        qp.set("types", "ESTABLISHMENT");
      } else if (category === "sexshop") {
        qp.set("types", "SHOP");
      } else {
        qp.set("types", "PROFESSIONAL");
        qp.set("categorySlug", category);
      }
    } else {
      qp.set("types", "PROFESSIONAL,ESTABLISHMENT,SHOP");
    }
    if (effectiveLoc) {
      qp.set("lat", String(effectiveLoc[0]));
      qp.set("lng", String(effectiveLoc[1]));
    }

    apiFetch<{ profiles: ProfileResult[] }>(`/services?${qp.toString()}`)
      .then((res) => {
        if (myFetch !== fetchRef.current) return;
        setProfiles(res?.profiles || []);
      })
      .catch(() => {
        if (myFetch !== fetchRef.current) return;
        setProfiles((current) => (current.length ? current : []));
      })
      .finally(() => {
        if (myFetch !== fetchRef.current) return;
        setLoading(false);
        setHasLoadedOnce(true);
      });
  }, [effectiveLoc, category]);

  /* ── Filter + Sort (tier-prioritized) ── */
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return [...profiles]
      .filter((profile) => {
        if (q) {
          const text = `${profile.displayName || ""} ${profile.username || ""} ${profile.serviceCategory || ""} ${profile.city || ""}`.toLowerCase();
          if (!text.includes(q)) return false;
        }
        if (profile.distance != null && profile.distance > radiusKm) return false;
        if (activeQuickFilters.has("disponible") && !profile.availableNow) return false;
        if (activeQuickFilters.has("maduras") && (profile.age == null || profile.age < 40)) return false;
        if (activeQuickFilters.has("destacada") && profile.userLevel !== "GOLD" && profile.userLevel !== "DIAMOND") return false;
        return true;
      })
      .sort((a, b) => {
        // Always prioritize higher tier
        const tierDiff = tierOrder(a.userLevel) - tierOrder(b.userLevel);
        if (tierDiff !== 0) return tierDiff;

        if (sortBy === "distance") return (a.distance ?? 1e9) - (b.distance ?? 1e9);
        if (sortBy === "available") return Number(Boolean(b.availableNow)) - Number(Boolean(a.availableNow));
        if (sortBy === "newest") return (Date.parse(b.lastSeen || "") || 0) - (Date.parse(a.lastSeen || "") || 0);
        // relevance: online first, then by distance
        if (Boolean(a.availableNow) !== Boolean(b.availableNow))
          return Number(Boolean(b.availableNow)) - Number(Boolean(a.availableNow));
        return (a.distance ?? 1e9) - (b.distance ?? 1e9);
      });
  }, [profiles, radiusKm, search, activeQuickFilters, sortBy]);

  const displayProfiles = useMemo(() => {
    if (filtered.length > 0) return filtered;
    return [...profiles].sort((a, b) => {
      const tierDiff = tierOrder(a.userLevel) - tierOrder(b.userLevel);
      if (tierDiff !== 0) return tierDiff;
      if (Boolean(a.availableNow) !== Boolean(b.availableNow))
        return Number(Boolean(b.availableNow)) - Number(Boolean(a.availableNow));
      return (a.distance ?? 1e9) - (b.distance ?? 1e9);
    });
  }, [filtered, profiles]);

  /* ── Separate featured (Diamond/Gold) from standard ── */
  const featuredProfiles = useMemo(
    () => displayProfiles.filter((p) => p.userLevel === "DIAMOND" || p.userLevel === "GOLD"),
    [displayProfiles],
  );
  const standardProfiles = useMemo(
    () => displayProfiles.filter((p) => p.userLevel !== "DIAMOND" && p.userLevel !== "GOLD"),
    [displayProfiles],
  );

  const markers = useMemo(
    () =>
      displayProfiles
        .filter((p) => Number.isFinite(Number(p.latitude)) && Number.isFinite(Number(p.longitude)))
        .map((p) => ({
          id: p.id,
          name: p.displayName || p.username,
          lat: Number(p.latitude),
          lng: Number(p.longitude),
          realLat: Number(p.realLatitude ?? p.latitude),
          realLng: Number(p.realLongitude ?? p.longitude),
          subtitle: p.serviceCategory || p.city || "Perfil",
          username: p.username,
          href: ownerHref(p),
          avatarUrl: p.avatarUrl,
          age: p.age ?? null,
          heightCm: p.heightCm ?? null,
          hairColor: p.hairColor ?? null,
          weightKg: p.weightKg ?? null,
          coverUrl: p.coverUrl,
          serviceValue: p.baseRate ?? null,
          level: p.userLevel ?? null,
          lastSeen: p.lastSeen ?? null,
          tier: p.availableNow ? "online" : "offline",
          galleryUrls: p.galleryUrls ?? [],
          areaRadiusM: 500,
        })),
    [displayProfiles],
  );

  const activeFilterCount = activeQuickFilters.size + (search ? 1 : 0);

  return (
    <div className="pb-24">
      {/* ── Header ── */}
      <section className="border-b border-white/[0.06] bg-gradient-to-b from-[#0d1024] to-transparent">
        <div className="mx-auto max-w-6xl px-4 py-4">
          {/* Title row */}
          <div className="flex items-center justify-between gap-3">
            <div>
              <h1 className="text-xl font-bold flex items-center gap-2">
                <Navigation className="h-5 w-5 text-fuchsia-400" />
                Cerca tuyo
              </h1>
              <p className="mt-0.5 flex items-center gap-1.5 text-xs text-white/50">
                {locationLabel && (
                  <>
                    <MapPin className="h-3 w-3 text-fuchsia-400" />
                    <span className="text-fuchsia-300/70">{locationLabel}</span>
                    <span className="text-white/20">·</span>
                  </>
                )}
                {!loading && <span>{displayProfiles.length} resultado{displayProfiles.length !== 1 ? "s" : ""}</span>}
                {loading && !hasLoadedOnce && <span>Buscando...</span>}
              </p>
            </div>
            {/* Map toggle */}
            <button
              type="button"
              onClick={() => setShowMap((v) => !v)}
              className={`rounded-xl border px-3 py-1.5 text-xs transition ${showMap ? "border-fuchsia-500/30 bg-fuchsia-500/10 text-fuchsia-300" : "border-white/10 bg-white/5 text-white/50"}`}
            >
              <MapPin className="inline h-3.5 w-3.5 mr-1" />
              Mapa
            </button>
          </div>

          {/* Category tabs */}
          <div className="scrollbar-none mt-3 -mx-4 flex gap-1.5 overflow-x-auto px-4 pb-1">
            {CATEGORY_TABS.map((tab) => {
              const Icon = tab.icon;
              const isActive = category === tab.key;
              return (
                <button
                  key={tab.key}
                  type="button"
                  onClick={() => setCategory(tab.key)}
                  className={`flex shrink-0 items-center gap-1.5 rounded-full px-3.5 py-2 text-xs font-medium transition ${
                    isActive
                      ? "border border-fuchsia-500/40 bg-fuchsia-500/15 text-fuchsia-200 shadow-[0_2px_12px_rgba(168,85,247,0.2)]"
                      : "border border-white/10 bg-white/5 text-white/60 hover:bg-white/10 hover:text-white/80"
                  }`}
                >
                  <Icon className="h-3.5 w-3.5" />
                  {tab.label}
                </button>
              );
            })}
          </div>

          {/* Search + Sort + Filters */}
          <div className="mt-3 flex gap-2">
            <label className="flex flex-1 items-center gap-2 rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2 text-sm focus-within:border-fuchsia-500/40 transition">
              <Search className="h-4 w-4 text-white/40" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Buscar nombre, ciudad..."
                className="w-full bg-transparent outline-none placeholder:text-white/30 text-sm"
              />
              {search && (
                <button type="button" onClick={() => setSearch("")} className="text-white/30 hover:text-white/60">
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </label>

            <div className="relative">
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value)}
                className="h-full rounded-xl border border-white/10 bg-white/[0.04] px-3 pr-7 text-xs text-white appearance-none focus:outline-none focus:border-fuchsia-500/40 cursor-pointer"
              >
                {SORT_OPTIONS.map((opt) => (
                  <option key={opt.key} value={opt.key}>{opt.label}</option>
                ))}
              </select>
              <ChevronDown className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-white/40" />
            </div>

            <button
              type="button"
              onClick={() => setShowFilters((s) => !s)}
              className={`rounded-xl border px-3 py-2 text-xs inline-flex items-center gap-1.5 transition ${
                showFilters || activeFilterCount > 0
                  ? "border-fuchsia-400/30 bg-fuchsia-500/10 text-fuchsia-200"
                  : "border-white/10 bg-white/[0.04] text-white/70 hover:bg-white/10"
              }`}
            >
              <SlidersHorizontal className="h-4 w-4" />
              <span className="hidden sm:inline">Filtros</span>
              {activeFilterCount > 0 && (
                <span className="rounded-full bg-fuchsia-500 px-1.5 py-0.5 text-[10px] font-bold">{activeFilterCount}</span>
              )}
            </button>
          </div>

          {/* Quick filter pills */}
          <div className="mt-2 flex gap-1.5 overflow-x-auto scrollbar-none">
            {QUICK_FILTERS.map((f) => {
              const Icon = f.icon;
              const isActive = activeQuickFilters.has(f.key);
              return (
                <button
                  key={f.key}
                  type="button"
                  onClick={() => toggleQuickFilter(f.key)}
                  className={`flex shrink-0 items-center gap-1 rounded-full border px-2.5 py-1 text-[11px] font-medium transition ${
                    isActive ? f.activeColor : "border-white/10 text-white/50 hover:border-white/20 hover:text-white/70"
                  }`}
                >
                  <Icon className="h-3 w-3" />
                  {f.label}
                </button>
              );
            })}
            {activeFilterCount > 0 && (
              <button
                type="button"
                onClick={() => { setActiveQuickFilters(new Set()); setSearch(""); }}
                className="flex shrink-0 items-center gap-1 rounded-full border border-white/10 px-2.5 py-1 text-[11px] text-white/40 hover:text-white/70 transition"
              >
                <X className="h-3 w-3" /> Limpiar
              </button>
            )}
          </div>

          {/* Expanded filters */}
          {showFilters && (
            <div className="mt-3 rounded-2xl border border-white/[0.08] bg-white/[0.03] p-4">
              <div className="flex items-center justify-between mb-1">
                <label className="text-[11px] font-semibold uppercase tracking-wider text-white/40">Radio de búsqueda</label>
                <span className="text-xs text-fuchsia-300 font-medium">{radiusKm} km</span>
              </div>
              <input
                type="range"
                min={1}
                max={100}
                value={radiusKm}
                onChange={(e) => setRadiusKm(Number(e.target.value))}
                className="w-full accent-fuchsia-500"
              />
              <div className="flex justify-between text-[10px] text-white/25 mt-1"><span>1 km</span><span>100 km</span></div>
            </div>
          )}
        </div>
      </section>

      <div className="mx-auto max-w-6xl px-4 py-4">
        {/* ── Stories ── */}
        <div className="mb-4">
          <Stories showUpload />
        </div>

        {/* ── Map ── */}
        {showMap && (
          <div className="mb-6 overflow-hidden rounded-2xl border border-white/[0.08]">
            <MapboxMap
              userLocation={mapCenter}
              markers={markers}
              height={280}
              autoCenterOnDataChange
              showMarkersForArea
              renderHtmlMarkers
            />
          </div>
        )}

        {/* ── Loading ── */}
        {loading && !hasLoadedOnce && (
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="aspect-[3/4] animate-pulse rounded-2xl border border-white/[0.06] bg-white/[0.03]" />
            ))}
          </div>
        )}

        {/* ── No results ── */}
        {!loading && displayProfiles.length === 0 && (
          <div className="mb-6 rounded-3xl border border-white/[0.08] bg-white/[0.03] p-10 text-center">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-fuchsia-500/10">
              <Search className="h-7 w-7 text-fuchsia-400/50" />
            </div>
            <h3 className="text-lg font-semibold">No encontramos resultados</h3>
            <p className="mt-1 text-sm text-white/50">Intenta ampliar el rango o cambiar la ubicación en el chip del header.</p>
            <button
              type="button"
              onClick={() => { setRadiusKm(100); setActiveQuickFilters(new Set()); setCategory("all"); }}
              className="mt-4 rounded-xl bg-gradient-to-r from-fuchsia-600 to-violet-600 px-5 py-2.5 text-sm font-semibold transition hover:brightness-110"
            >
              Ampliar búsqueda
            </button>
          </div>
        )}

        {/* ═══ FEATURED SECTION (Diamond + Gold) ═══ */}
        {featuredProfiles.length > 0 && (
          <section className="mb-8">
            <div className="mb-3 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Crown className="h-5 w-5 text-amber-400" />
                <h2 className="text-base font-bold">Destacadas</h2>
                <span className="rounded-full border border-amber-400/20 bg-amber-500/10 px-2 py-0.5 text-[10px] text-amber-300 font-medium">Premium</span>
              </div>
              <Link href="/profesionales" className="group flex items-center gap-1 text-xs text-white/40 hover:text-fuchsia-400 transition">
                Ver todas <ChevronRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
              </Link>
            </div>
            <div className="scrollbar-none -mx-4 flex gap-3 overflow-x-auto px-4 pb-2 snap-x snap-mandatory sm:mx-0 sm:grid sm:grid-cols-2 sm:overflow-visible sm:px-0 md:grid-cols-3">
              {featuredProfiles.slice(0, 6).map((p) => (
                <FeaturedCard key={p.id} profile={p} onPreview={setPreviewProfile} isAuthed={isAuthed} />
              ))}
            </div>
          </section>
        )}

        {/* ═══ ALL PROFILES GRID ═══ */}
        {standardProfiles.length > 0 && (
          <section>
            <div className="mb-3 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Users className="h-4 w-4 text-white/50" />
                <h2 className="text-base font-bold">Todas las experiencias</h2>
              </div>
              {filtered.length === 0 && displayProfiles.length > 0 && (
                <p className="text-[11px] text-white/35">Mostrando todos</p>
              )}
            </div>
            <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-4">
              {standardProfiles.map((profile) => (
                <ProfileCard key={profile.id} profile={profile} onPreview={setPreviewProfile} isAuthed={isAuthed} />
              ))}
            </div>
          </section>
        )}

        {/* ═══ CTA Registration ═══ */}
        {!isAuthed && displayProfiles.length > 0 && (
          <section className="mt-10 rounded-3xl border border-fuchsia-500/20 bg-gradient-to-br from-fuchsia-600/[0.08] via-violet-600/[0.05] to-transparent p-8 text-center">
            <h2 className="text-lg font-bold">Crea tu cuenta gratis</h2>
            <p className="mx-auto mt-2 max-w-md text-sm text-white/50">
              Regístrate para enviar mensajes, guardar favoritos y descubrir más cerca de ti.
            </p>
            <div className="mt-4 flex flex-col items-center gap-2 sm:flex-row sm:justify-center">
              <Link href="/register?type=CLIENT" className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-fuchsia-600 to-violet-600 px-6 py-3 text-sm font-semibold transition hover:brightness-110 shadow-[0_8px_24px_rgba(168,85,247,0.25)]">
                Registro gratis <ChevronRight className="h-4 w-4" />
              </Link>
              <Link href="/login" className="inline-flex items-center gap-2 rounded-xl border border-white/15 bg-white/[0.04] px-6 py-3 text-sm font-medium text-white/70 transition hover:bg-white/[0.08]">
                Ya tengo cuenta
              </Link>
            </div>
          </section>
        )}
      </div>

      {/* Preview Modal */}
      {previewProfile && (
        <ProfilePreviewModal
          profile={previewProfile}
          onClose={() => setPreviewProfile(null)}
        />
      )}
    </div>
  );
}
