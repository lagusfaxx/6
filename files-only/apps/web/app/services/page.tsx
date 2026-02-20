"use client";

import { memo, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { apiFetch, resolveMediaUrl } from "../../lib/api";
import { useMapLocation } from "../../hooks/useMapLocation";
import MapboxMap from "../../components/MapboxMap";
import UserLevelBadge from "../../components/UserLevelBadge";
import { MapPin, Search, SlidersHorizontal, User } from "lucide-react";

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
  isAvailableNow?: boolean;
  planTier?: "SILVER" | "GOLD" | "PLATINUM";
  featured?: boolean;
  attributes?: Array<{ id: string; slug: string; label: string; type: string }>;
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

function ownerHref(profile: ProfileResult) {
  if (profile.profileType === "ESTABLISHMENT")
    return `/hospedaje/${profile.id}`;
  return `/profesional/${profile.id}`;
}

function resolveCardImage(profile: ProfileResult) {
  return (
    resolveMediaUrl(profile.coverUrl) ?? resolveMediaUrl(profile.avatarUrl)
  );
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
}: {
  profile: ProfileResult;
}) {
  const img = resolveCardImage(profile);
  return (
    <Link
      href={ownerHref(profile)}
      className="group overflow-hidden rounded-2xl border border-white/[0.08] bg-white/[0.03]"
    >
      <div className="relative aspect-[4/3] overflow-hidden bg-white/[0.04]">
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
          <div className="absolute right-2 top-2 rounded-full border border-white/10 bg-black/50 px-2 py-1 text-[11px]">
            <MapPin className="mr-1 inline h-3 w-3" />
            {profile.distance.toFixed(1)} km
          </div>
        )}
        {profile.availableNow ? (
          <div className="absolute left-2 top-2">
            <span className="relative flex h-3.5 w-3.5">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-300 opacity-75" />
              <span className="relative inline-flex h-3.5 w-3.5 rounded-full border border-emerald-200/90 bg-emerald-400" />
            </span>
          </div>
        ) : (
          <div className="absolute left-2 top-2 rounded-full border border-white/15 bg-black/40 px-2 py-1 text-[11px] text-white/75">
            Offline
          </div>
        )}
      </div>
      <div className="p-3">
        <div className="flex items-center gap-2">
          <div className="truncate text-sm font-semibold">
            {profile.displayName || profile.username}
          </div>
          <UserLevelBadge level={profile.userLevel} className="shrink-0" />
          {profile.planTier ? (
            <span className="rounded-full border border-amber-300/40 bg-amber-500/15 px-2 py-0.5 text-[10px]">
              {profile.planTier}
            </span>
          ) : null}
        </div>
        <div className="mt-1 flex items-center gap-2 text-xs text-white/50">
          <div className="h-6 w-6 overflow-hidden rounded-full bg-white/[0.06]">
            {profile.avatarUrl ? (
              <img
                src={resolveMediaUrl(profile.avatarUrl) ?? undefined}
                alt=""
                className="h-full w-full object-cover"
              />
            ) : (
              <User className="m-1 h-4 w-4 text-white/35" />
            )}
          </div>
          <span className="truncate">
            {profile.serviceCategory || profile.city || profile.profileType}
          </span>
        </div>
        <p className="mt-1 text-[11px] text-white/45">
          {formatLastSeen(profile.lastSeen)}
        </p>
        {profile.serviceDescription && (
          <p className="mt-2 line-clamp-2 text-xs text-white/55">
            {profile.serviceDescription}
          </p>
        )}
      </div>
    </Link>
  );
});

export default function ServicesPage() {
  const { location } = useMapLocation(DEFAULT_LOCATION);

  const [profiles, setProfiles] = useState<ProfileResult[]>([]);
  const [loading, setLoading] = useState(true);
  const [hasLoadedOnce, setHasLoadedOnce] = useState(false);
  const [type, setType] = useState<"experience" | "space">("experience");
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("");
  const [radiusKm, setRadiusKm] = useState(INITIAL_RADIUS_KM);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [searchTick, setSearchTick] = useState(0);
  const [selectedAttributes, setSelectedAttributes] = useState<string[]>([]);
  const [availableOnly, setAvailableOnly] = useState(false);
  const [featuredOnly, setFeaturedOnly] = useState(false);
  const [planTier, setPlanTier] = useState<"" | "SILVER" | "GOLD" | "PLATINUM">(
    "",
  );
  const [attributeOptions, setAttributeOptions] = useState<
    Array<{ id: string; slug: string; label: string; type: string }>
  >([]);
  const [mapCenter, setMapCenter] = useState<{
    lat: number;
    lng: number;
  } | null>(null);
  const mapDebounceRef = useRef<number | null>(null);
  const userGpsRef = useRef<{ lat: number; lng: number } | null>(null);

  useEffect(() => {
    if (!location) return;
    userGpsRef.current = { lat: location[0], lng: location[1] };
  }, [location]);

  useEffect(() => {
    apiFetch<{
      attributes: Array<{
        id: string;
        slug: string;
        label: string;
        type: string;
      }>;
    }>("/attributes")
      .then((res) => setAttributeOptions(res?.attributes || []))
      .catch(() => setAttributeOptions([]));
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const query = new URLSearchParams(window.location.search);
    const nextType = query.get("type");
    if (nextType === "experience" || nextType === "space") setType(nextType);
    if (query.get("q")) setSearch(query.get("q") || "");
    if (query.get("category"))
      setCategoryFilter((query.get("category") || "").toLowerCase());
    if (query.get("radiusKm"))
      setRadiusKm(Number(query.get("radiusKm")) || INITIAL_RADIUS_KM);
    if (query.get("isAvailableNow") === "true") setAvailableOnly(true);
    if (query.get("featured") === "true") setFeaturedOnly(true);
  }, []);

  useEffect(() => {
    const center =
      userGpsRef.current ||
      (location ? { lat: location[0], lng: location[1] } : null);
    if (!center && hasLoadedOnce) return;

    if (!hasLoadedOnce) {
      setLoading(true);
    }

    const qp = new URLSearchParams();
    if (center) {
      qp.set("lat", String(center.lat));
      qp.set("lng", String(center.lng));
    }
    qp.set("radiusKm", String(radiusKm));
    qp.set("category", categoryFilter);
    qp.set("featured", String(featuredOnly));
    qp.set("isAvailableNow", String(availableOnly));
    if (planTier) qp.set("planTier", planTier);
    if (selectedAttributes.length)
      qp.set("attributes", selectedAttributes.join(","));

    apiFetch<{ profiles: ProfileResult[] }>(`/explore/results?${qp.toString()}`)
      .then((res) => setProfiles(res?.profiles || []))
      .catch(() => {
        setProfiles((current) => (current.length ? current : []));
      })
      .finally(() => {
        setLoading(false);
        setHasLoadedOnce(true);
      });
  }, [
    availableOnly,
    categoryFilter,
    featuredOnly,
    location,
    planTier,
    radiusKm,
    searchTick,
    selectedAttributes,
    type,
  ]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return [...profiles]
      .filter((profile) => {
        if (q) {
          const text =
            `${profile.displayName || ""} ${profile.username || ""} ${profile.serviceCategory || ""} ${profile.city || ""}`.toLowerCase();
          if (!text.includes(q)) return false;
        }
        if (categoryFilter) {
          const haystack =
            `${profile.serviceCategory || ""} ${profile.bio || ""}`.toLowerCase();
          if (!haystack.includes(categoryFilter)) return false;
        }
        if (profile.distance != null && profile.distance > radiusKm)
          return false;
        return true;
      })
      .sort((a, b) => {
        if (
          Boolean(a.isAvailableNow || a.availableNow) !==
          Boolean(b.isAvailableNow || b.availableNow)
        )
          return (
            Number(Boolean(b.availableNow)) - Number(Boolean(a.availableNow))
          );
        const lastSeenDiff =
          (Date.parse(b.lastSeen || "") || 0) -
          (Date.parse(a.lastSeen || "") || 0);
        if (lastSeenDiff !== 0) return lastSeenDiff;
        return (a.distance ?? 1e9) - (b.distance ?? 1e9);
      });
  }, [categoryFilter, profiles, radiusKm, search]);

  const safeProfiles = useMemo(() => {
    if (filtered.length > 0) return filtered;
    return [...profiles].sort((a, b) => {
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
  }, [filtered, profiles]);

  const markers = useMemo(
    () =>
      safeProfiles
        .filter(
          (profile) =>
            Number.isFinite(Number(profile.latitude)) &&
            Number.isFinite(Number(profile.longitude)),
        )
        .map((profile) => ({
          id: profile.id,
          name: profile.displayName || profile.username,
          lat: Number(profile.latitude),
          lng: Number(profile.longitude),
          realLat: Number(profile.realLatitude ?? profile.latitude),
          realLng: Number(profile.realLongitude ?? profile.longitude),
          subtitle: profile.serviceCategory || profile.city || "Perfil",
          username: profile.username,
          href: ownerHref(profile),
          avatarUrl: profile.avatarUrl,
          age: profile.age ?? null,
          heightCm: profile.heightCm ?? null,
          hairColor: profile.hairColor ?? null,
          weightKg: profile.weightKg ?? null,
          coverUrl: profile.coverUrl,
          serviceValue: profile.baseRate ?? null,
          level: profile.userLevel ?? null,
          lastSeen: profile.lastSeen ?? null,
          tier: profile.availableNow ? "online" : "offline",
          galleryUrls: profile.galleryUrls ?? [],
          areaRadiusM: 500,
        })),
    [safeProfiles],
  );

  return (
    <div className="pb-24">
      <section className="border-b border-white/[0.06] bg-gradient-to-b from-[#0d1024] to-transparent">
        <div className="mx-auto max-w-6xl px-4 py-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h1 className="text-2xl font-bold">Buscar perfiles</h1>
              <p className="mt-1 text-sm text-white/55">
                Perfiles online y offline ordenados por actividad reciente
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

          <div className="mt-4 grid gap-3 rounded-2xl border border-white/[0.08] bg-white/[0.03] p-4 md:grid-cols-[1fr_auto]">
            <label className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2 text-sm">
              <Search className="h-4 w-4 text-white/40" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Nombre, categoría o ciudad"
                className="w-full bg-transparent outline-none placeholder:text-white/35"
              />
            </label>
            <button
              onClick={() => setShowAdvanced((s) => !s)}
              className="rounded-xl border border-white/10 bg-white/[0.04] px-4 py-2 text-sm inline-flex items-center gap-2"
            >
              <SlidersHorizontal className="h-4 w-4" />
              Filtros
            </button>
          </div>

          {showAdvanced && (
            <div className="mt-3 grid gap-3 rounded-2xl border border-white/[0.08] bg-white/[0.03] p-4 md:grid-cols-2">
              <input
                value={radiusKm}
                onChange={(e) =>
                  setRadiusKm(Number(e.target.value || INITIAL_RADIUS_KM))
                }
                placeholder="Radio km"
                className="rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2 text-sm"
              />
              <p className="text-xs text-white/45">
                Si no encuentras resultados exactos, mostramos también perfiles
                fuera de tu filtro para que la app siempre se vea poblada.
              </p>
            </div>
          )}
        </div>
      </section>

      <div className="mx-auto max-w-6xl px-4 py-4">
        <div className="mb-5 text-sm text-white/45">
          {loading && !hasLoadedOnce
            ? "Cargando resultados..."
            : `${safeProfiles.length} resultado${safeProfiles.length !== 1 ? "s" : ""}`}
        </div>

        <div className="mb-6 overflow-hidden rounded-2xl border border-white/[0.08]">
          <MapboxMap
            userLocation={location}
            markers={markers}
            height={420}
            autoCenterOnDataChange={false}
            showMarkersForArea
            renderHtmlMarkers
          />
        </div>

        {loading && !hasLoadedOnce && (
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
              <div
                key={i}
                className="aspect-[4/5] animate-pulse rounded-2xl border border-white/[0.06] bg-white/[0.03]"
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
            <div className="mt-4 flex flex-wrap justify-center gap-2">
              <button
                onClick={() => {
                  setRadiusKm((r) => r + 10);
                  setSearchTick((v) => v + 1);
                }}
                className="rounded-xl border border-white/10 bg-white/[0.04] px-4 py-2 text-sm"
              >
                Amplía tu rango (+10 km)
              </button>
            </div>
          </div>
        )}

        {safeProfiles.length > 0 && (
          <section>
            {filtered.length === 0 && (
              <p className="mb-3 text-xs text-white/55">
                Sin coincidencias exactas con filtros actuales. Mostramos
                perfiles online y offline para mantener visibilidad.
              </p>
            )}
            <h2 className="mb-4 text-xl font-semibold">Resultados</h2>
            <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-4">
              {safeProfiles.map((profile) => (
                <ProfileCard key={profile.id} profile={profile} />
              ))}
            </div>
          </section>
        )}
      </div>
    </div>
  );
}
