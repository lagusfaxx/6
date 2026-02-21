"use client";

import { memo, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { apiFetch, resolveMediaUrl } from "../../lib/api";
import { useMapLocation } from "../../hooks/useMapLocation";
import MapboxMap from "../../components/MapboxMap";
import UserLevelBadge from "../../components/UserLevelBadge";
import ProfilePreviewModal from "../../components/ProfilePreviewModal";
import { MapPin, Search, SlidersHorizontal, User, X } from "lucide-react";

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
};

const DEFAULT_LOCATION: [number, number] = [-33.45, -70.66];
const INITIAL_RADIUS_KM = 10;

const FILTER_OPTIONS = {
  gender: [
    { key: "mujer", label: "Mujeres" },
    { key: "hombre", label: "Hombres" },
    { key: "trans", label: "Trans" },
  ],
  categories: [
    { key: "masajes", label: "Masajes" },
    { key: "despedidas", label: "Despedidas de solteros" },
    { key: "packs", label: "Packs" },
    { key: "videollamadas", label: "Videollamadas" },
    { key: "escort", label: "Escort" },
  ],
  special: [
    { key: "maduras", label: "Maduras (40+)" },
    { key: "destacada", label: "Destacadas" },
    { key: "disponible", label: "Disponible ahora" },
  ],
} as const;

function ownerHref(profile: ProfileResult) {
  if (profile.profileType === "ESTABLISHMENT") return `/hospedaje/${profile.id}`;
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
  if (minutes < 60) return `Activa hace ${minutes} min`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `Activa hace ${hours} hora${hours === 1 ? "" : "s"}`;
  const days = Math.floor(hours / 24);
  return `Activa hace ${days} día${days === 1 ? "" : "s"}`;
}

const ProfileCard = memo(function ProfileCard({
  profile,
  onPreview,
}: {
  profile: ProfileResult;
  onPreview: (p: ProfileResult) => void;
}) {
  const img = resolveCardImage(profile);
  return (
    <div className="group overflow-hidden rounded-2xl border border-white/[0.08] bg-white/[0.03] transition hover:border-fuchsia-500/20">
      <button
        type="button"
        onClick={() => onPreview(profile)}
        className="block w-full text-left"
      >
        <div className="relative aspect-[3/4] overflow-hidden bg-white/[0.04]">
          {img ? (
            <img
              src={img}
              alt={profile.displayName || profile.username}
              className="h-full w-full object-cover transition group-hover:scale-105"
            />
          ) : (
            <div className="flex h-full items-center justify-center text-white/30">
              Sin imagen
            </div>
          )}
          {profile.distance != null && (
            <div className="absolute right-2 top-2 rounded-full border border-white/10 bg-black/50 px-2 py-0.5 text-[10px]">
              <MapPin className="mr-0.5 inline h-3 w-3" />
              {profile.distance.toFixed(1)} km
            </div>
          )}
          {profile.availableNow ? (
            <div className="absolute left-2 top-2 flex items-center gap-1 rounded-full border border-emerald-300/20 bg-emerald-500/20 px-1.5 py-0.5 text-[9px] text-emerald-200">
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-400" />{" "}
              Online
            </div>
          ) : (
            <div className="absolute left-2 top-2 rounded-full border border-white/15 bg-black/40 px-1.5 py-0.5 text-[10px] text-white/75">
              Offline
            </div>
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
          <div className="absolute bottom-0 left-0 right-0 p-2">
            <div className="flex items-center gap-1.5">
              <div className="truncate text-xs font-semibold">
                {profile.displayName || profile.username}
                {profile.age ? `, ${profile.age}` : ""}
              </div>
              <UserLevelBadge
                level={profile.userLevel}
                className="shrink-0 px-1.5 py-0.5 text-[9px]"
              />
            </div>
            <p className="mt-0.5 text-[10px] text-white/45">
              {formatLastSeen(profile.lastSeen)}
            </p>
          </div>
        </div>
      </button>
      <div className="p-2">
        <Link
          href={ownerHref(profile)}
          className="block w-full rounded-lg bg-gradient-to-r from-fuchsia-600/80 to-violet-600/80 py-2 text-center text-xs font-semibold transition hover:brightness-110"
        >
          Ver perfil
        </Link>
      </div>
    </div>
  );
});

export default function ServicesPage() {
  const { location } = useMapLocation(DEFAULT_LOCATION);

  const [profiles, setProfiles] = useState<ProfileResult[]>([]);
  const [loading, setLoading] = useState(true);
  const [hasLoadedOnce, setHasLoadedOnce] = useState(false);
  const [type, setType] = useState<"experience" | "space">("experience");
  const [search, setSearch] = useState("");
  const [radiusKm, setRadiusKm] = useState(INITIAL_RADIUS_KM);
  const [showFilters, setShowFilters] = useState(false);
  const [searchTick, setSearchTick] = useState(0);
  const [previewProfile, setPreviewProfile] = useState<ProfileResult | null>(
    null,
  );
  const userGpsRef = useRef<{ lat: number; lng: number } | null>(null);

  // Filter states
  const [activeFilters, setActiveFilters] = useState<Set<string>>(new Set());

  const toggleFilter = (key: string) => {
    setActiveFilters((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  useEffect(() => {
    if (!location) return;
    userGpsRef.current = { lat: location[0], lng: location[1] };
  }, [location]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const query = new URLSearchParams(window.location.search);
    const nextType = query.get("type");
    if (nextType === "experience" || nextType === "space") setType(nextType);
    if (query.get("q")) setSearch(query.get("q") || "");
    if (query.get("radiusKm"))
      setRadiusKm(Number(query.get("radiusKm")) || INITIAL_RADIUS_KM);
    if (query.get("category")) {
      setActiveFilters(new Set([query.get("category")!]));
    }
  }, []);

  useEffect(() => {
    const center =
      userGpsRef.current ||
      (location ? { lat: location[0], lng: location[1] } : null);
    if (!center && hasLoadedOnce) return;
    if (!hasLoadedOnce) setLoading(true);

    const qp = new URLSearchParams();
    qp.set("types", type === "experience" ? "PROFESSIONAL" : "ESTABLISHMENT");
    if (center) {
      qp.set("lat", String(center.lat));
      qp.set("lng", String(center.lng));
    }

    apiFetch<{ profiles: ProfileResult[] }>(`/services?${qp.toString()}`)
      .then((res) => setProfiles(res?.profiles || []))
      .catch(() => setProfiles((current) => (current.length ? current : [])))
      .finally(() => {
        setLoading(false);
        setHasLoadedOnce(true);
      });
  }, [location, type, searchTick]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return [...profiles]
      .filter((profile) => {
        if (q) {
          const text =
            `${profile.displayName || ""} ${profile.username || ""} ${profile.serviceCategory || ""} ${profile.city || ""}`.toLowerCase();
          if (!text.includes(q)) return false;
        }
        if (profile.distance != null && profile.distance > radiusKm)
          return false;

        // Apply active filters
        if (activeFilters.has("disponible") && !profile.availableNow)
          return false;
        if (
          activeFilters.has("maduras") &&
          (profile.age == null || profile.age < 40)
        )
          return false;
        if (
          activeFilters.has("destacada") &&
          profile.userLevel !== "GOLD" &&
          profile.userLevel !== "DIAMOND"
        )
          return false;

        return true;
      })
      .sort((a, b) => {
        if (Boolean(a.availableNow) !== Boolean(b.availableNow))
          return (
            Number(Boolean(b.availableNow)) - Number(Boolean(a.availableNow))
          );
        const lastSeenDiff =
          (Date.parse(b.lastSeen || "") || 0) -
          (Date.parse(a.lastSeen || "") || 0);
        if (lastSeenDiff !== 0) return lastSeenDiff;
        return (a.distance ?? 1e9) - (b.distance ?? 1e9);
      });
  }, [profiles, radiusKm, search, activeFilters]);

  const safeProfiles = useMemo(() => {
    if (filtered.length > 0) return filtered;
    return [...profiles].sort((a, b) => {
      if (Boolean(a.availableNow) !== Boolean(b.availableNow))
        return (
          Number(Boolean(b.availableNow)) - Number(Boolean(a.availableNow))
        );
      return (a.distance ?? 1e9) - (b.distance ?? 1e9);
    });
  }, [filtered, profiles]);

  const markers = useMemo(
    () =>
      safeProfiles
        .filter(
          (p) =>
            Number.isFinite(Number(p.latitude)) &&
            Number.isFinite(Number(p.longitude)),
        )
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
    [safeProfiles],
  );

  return (
    <div className="pb-24">
      <section className="border-b border-white/[0.06] bg-gradient-to-b from-[#0d1024] to-transparent">
        <div className="mx-auto max-w-6xl px-4 py-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h1 className="text-xl font-bold">Cerca tuyo</h1>
              <p className="mt-0.5 text-xs text-white/55">
                Perfiles ordenados por actividad reciente
              </p>
            </div>
            <div className="inline-flex overflow-hidden rounded-xl border border-white/[0.08] bg-white/[0.03] p-1">
              <button
                onClick={() => setType("experience")}
                className={`rounded-lg px-3 py-1.5 text-sm ${type === "experience" ? "bg-fuchsia-500/20 text-fuchsia-200" : "text-white/60"}`}
              >
                Experiencias
              </button>
              <button
                onClick={() => setType("space")}
                className={`rounded-lg px-3 py-1.5 text-sm ${type === "space" ? "bg-fuchsia-500/20 text-fuchsia-200" : "text-white/60"}`}
              >
                Motel / Hotel
              </button>
            </div>
          </div>

          {/* Search bar */}
          <div className="mt-3 flex gap-2">
            <label className="flex flex-1 items-center gap-2 rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2 text-sm">
              <Search className="h-4 w-4 text-white/40" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Nombre, categoría o ciudad"
                className="w-full bg-transparent outline-none placeholder:text-white/35"
              />
            </label>
            <button
              onClick={() => setShowFilters((s) => !s)}
              className={`rounded-xl border px-3 py-2 text-sm inline-flex items-center gap-2 transition ${showFilters ? "border-fuchsia-400/30 bg-fuchsia-500/10 text-fuchsia-200" : "border-white/10 bg-white/[0.04] text-white/70"}`}
            >
              <SlidersHorizontal className="h-4 w-4" />
              Filtros
              {activeFilters.size > 0 && (
                <span className="ml-1 rounded-full bg-fuchsia-500 px-1.5 py-0.5 text-[10px] font-bold">
                  {activeFilters.size}
                </span>
              )}
            </button>
          </div>

          {/* Filters panel */}
          {showFilters && (
            <div className="mt-3 space-y-4 rounded-2xl border border-white/[0.08] bg-white/[0.03] p-4">
              {/* Radius slider */}
              <div>
                <label className="mb-1 block text-xs text-white/50">
                  Radio: {radiusKm} km
                </label>
                <input
                  type="range"
                  min={1}
                  max={100}
                  value={radiusKm}
                  onChange={(e) => setRadiusKm(Number(e.target.value))}
                  className="w-full accent-fuchsia-500"
                />
              </div>

              {/* Gender */}
              <div>
                <div className="mb-2 text-xs font-semibold uppercase tracking-wider text-white/40">
                  Género
                </div>
                <div className="flex flex-wrap gap-2">
                  {FILTER_OPTIONS.gender.map((f) => (
                    <button
                      key={f.key}
                      type="button"
                      onClick={() => toggleFilter(f.key)}
                      className={`rounded-full px-3 py-1.5 text-xs font-medium transition ${activeFilters.has(f.key) ? "border border-fuchsia-400/30 bg-fuchsia-500/20 text-fuchsia-200" : "border border-white/10 bg-white/5 text-white/60 hover:bg-white/10"}`}
                    >
                      {f.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Categories */}
              <div>
                <div className="mb-2 text-xs font-semibold uppercase tracking-wider text-white/40">
                  Categorías
                </div>
                <div className="flex flex-wrap gap-2">
                  {FILTER_OPTIONS.categories.map((f) => (
                    <button
                      key={f.key}
                      type="button"
                      onClick={() => toggleFilter(f.key)}
                      className={`rounded-full px-3 py-1.5 text-xs font-medium transition ${activeFilters.has(f.key) ? "border border-fuchsia-400/30 bg-fuchsia-500/20 text-fuchsia-200" : "border border-white/10 bg-white/5 text-white/60 hover:bg-white/10"}`}
                    >
                      {f.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Special */}
              <div>
                <div className="mb-2 text-xs font-semibold uppercase tracking-wider text-white/40">
                  Especial
                </div>
                <div className="flex flex-wrap gap-2">
                  {FILTER_OPTIONS.special.map((f) => (
                    <button
                      key={f.key}
                      type="button"
                      onClick={() => toggleFilter(f.key)}
                      className={`rounded-full px-3 py-1.5 text-xs font-medium transition ${activeFilters.has(f.key) ? "border border-fuchsia-400/30 bg-fuchsia-500/20 text-fuchsia-200" : "border border-white/10 bg-white/5 text-white/60 hover:bg-white/10"}`}
                    >
                      {f.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Clear filters */}
              {activeFilters.size > 0 && (
                <button
                  type="button"
                  onClick={() => setActiveFilters(new Set())}
                  className="flex items-center gap-1.5 text-xs text-white/50 hover:text-white/80"
                >
                  <X className="h-3 w-3" /> Limpiar filtros
                </button>
              )}
            </div>
          )}
        </div>
      </section>

      <div className="mx-auto max-w-6xl px-4 py-4">
        {/* Map always visible */}
        <div className="mb-6 overflow-hidden rounded-2xl border border-white/[0.08]">
          <MapboxMap
            userLocation={location}
            markers={markers}
            height={350}
            autoCenterOnDataChange={false}
            showMarkersForArea
            renderHtmlMarkers
          />
        </div>

        <div className="mb-4 text-sm text-white/45">
          {loading && !hasLoadedOnce
            ? "Cargando resultados..."
            : `${safeProfiles.length} resultado${safeProfiles.length !== 1 ? "s" : ""}`}
        </div>

        {loading && !hasLoadedOnce && (
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
              <div
                key={i}
                className="aspect-[3/4] animate-pulse rounded-2xl border border-white/[0.06] bg-white/[0.03]"
              />
            ))}
          </div>
        )}

        {!loading && safeProfiles.length === 0 && (
          <div className="mb-6 rounded-3xl border border-white/[0.08] bg-white/[0.03] p-8 text-center">
            <h3 className="text-lg font-semibold">Ajustemos tu búsqueda</h3>
            <p className="mt-1 text-sm text-white/50">
              No encontramos perfiles ahora. Intenta ampliar el rango.
            </p>
            <button
              onClick={() => {
                setRadiusKm((r) => r + 10);
                setSearchTick((v) => v + 1);
              }}
              className="mt-4 rounded-xl border border-white/10 bg-white/[0.04] px-4 py-2 text-sm"
            >
              Amplía tu rango (+10 km)
            </button>
          </div>
        )}

        {safeProfiles.length > 0 && (
          <section>
            {filtered.length === 0 && (
              <p className="mb-3 text-xs text-white/55">
                Sin coincidencias exactas. Mostrando todos los perfiles.
              </p>
            )}
            <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-4">
              {safeProfiles.map((profile) => (
                <ProfileCard
                  key={profile.id}
                  profile={profile}
                  onPreview={setPreviewProfile}
                />
              ))}
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
