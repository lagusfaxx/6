"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { apiFetch, resolveMediaUrl } from "../../lib/api";
import { useMapLocation } from "../../hooks/useMapLocation";
import MapboxMap from "../../components/MapboxMap";
import { Compass, MapPin, Search, SlidersHorizontal, User } from "lucide-react";

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
  distance: number | null;
  locality?: string | null;
  profileType: "PROFESSIONAL" | "ESTABLISHMENT" | "SHOP";
  serviceCategory: string | null;
  serviceDescription: string | null;
  isActive: boolean;
  userLevel?: "SILVER" | "GOLD" | "DIAMOND";
  completedServices?: number | null;
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

function levelBadge(level?: "SILVER" | "GOLD" | "DIAMOND") {
  if (level === "DIAMOND") {
    return {
      label: "💎 Diamond",
      className:
        "border-cyan-200/40 bg-cyan-400/20 text-cyan-50",
    };
  }
  if (level === "GOLD") {
    return {
      label: "🥇 Gold",
      className:
        "border-amber-200/40 bg-amber-400/20 text-amber-50",
    };
  }
  return {
    label: "🥈 Silver",
    className: "border-slate-200/30 bg-slate-300/15 text-slate-100",
  };
}

export default function ServicesPage() {
  const { location } = useMapLocation(DEFAULT_LOCATION);

  const [profiles, setProfiles] = useState<ProfileResult[]>([]);
  const [loading, setLoading] = useState(true);
  const [type, setType] = useState<"experience" | "space">("experience");
  const [view, setView] = useState<"list" | "map">("list");
  const [search, setSearch] = useState("");
  const [radiusKm, setRadiusKm] = useState(INITIAL_RADIUS_KM);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [mapCenter, setMapCenter] = useState<{
    lat: number;
    lng: number;
  } | null>(null);
  const [searchTick, setSearchTick] = useState(0);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const query = new URLSearchParams(window.location.search);
    const nextType = query.get("type");
    if (nextType === "experience" || nextType === "space") setType(nextType);
    if (query.get("view") === "map") setView("map");
    if (query.get("q")) setSearch(query.get("q") || "");
    if (query.get("radiusKm"))
      setRadiusKm(Number(query.get("radiusKm")) || INITIAL_RADIUS_KM);
  }, []);

  useEffect(() => {
    setLoading(true);
    const center =
      mapCenter || (location ? { lat: location[0], lng: location[1] } : null);
    const qp = new URLSearchParams();
    qp.set("types", type === "experience" ? "PROFESSIONAL" : "ESTABLISHMENT");
    if (center) {
      qp.set("lat", String(center.lat));
      qp.set("lng", String(center.lng));
    }

    apiFetch<{ profiles: ProfileResult[] }>(`/services?${qp.toString()}`)
      .then((res) => setProfiles(res?.profiles || []))
      .catch(() => setProfiles([]))
      .finally(() => setLoading(false));
  }, [location, mapCenter, type, searchTick]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return profiles
      .filter((profile) => {
        if (q) {
          const text =
            `${profile.displayName || ""} ${profile.username || ""} ${profile.serviceCategory || ""} ${profile.city || ""}`.toLowerCase();
          if (!text.includes(q)) return false;
        }
        if (profile.distance != null && profile.distance > radiusKm)
          return false;
        return true;
      })
      .sort((a, b) => (a.distance ?? 1e9) - (b.distance ?? 1e9));
  }, [profiles, radiusKm, search]);

  const markers = useMemo(
    () =>
      filtered
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
          subtitle: profile.serviceCategory || profile.city || "Perfil",
          href: ownerHref(profile),
          avatarUrl: profile.avatarUrl,
          areaRadiusM: 500,
        })),
    [filtered],
  );

  return (
    <div className="pb-24">
      <section className="border-b border-white/[0.06] bg-gradient-to-b from-[#0d1024] to-transparent">
        <div className="mx-auto max-w-6xl px-4 py-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h1 className="text-2xl font-bold">Buscar perfiles</h1>
              <p className="mt-1 text-sm text-white/55">
                Profesionales disponibles cerca de ti
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

          <div className="mt-4 grid gap-3 rounded-2xl border border-white/[0.08] bg-white/[0.03] p-4 md:grid-cols-[1fr_auto_auto]">
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
              onClick={() => setView((v) => (v === "list" ? "map" : "list"))}
              className="rounded-xl border border-white/10 bg-white/[0.04] px-4 py-2 text-sm inline-flex items-center gap-2"
            >
              <Compass className="h-4 w-4" />
              {view === "map" ? "Ver lista" : "Ver mapa"}
            </button>
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
                Si no encuentras resultados exactos, usa “Amplía tu rango (+10
                km)” para relanzar la consulta desde el centro del mapa.
              </p>
            </div>
          )}
        </div>
      </section>

      <div className="mx-auto max-w-6xl px-4 py-4">
        <div className="mb-5 text-sm text-white/45">
          {loading
            ? "Cargando resultados..."
            : `${filtered.length} resultado${filtered.length !== 1 ? "s" : ""}`}
        </div>

        {view === "map" && (
          <div className="mb-6 overflow-hidden rounded-2xl border border-white/[0.08]">
            <MapboxMap
              userLocation={location}
              markers={markers}
              height={420}
              autoCenterOnDataChange={false}
              showMarkersForArea={false}
              onCenterChange={(center) => setMapCenter(center)}
            />
          </div>
        )}

        {loading && (
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
              <div
                key={i}
                className="aspect-[4/5] animate-pulse rounded-2xl border border-white/[0.06] bg-white/[0.03]"
              />
            ))}
          </div>
        )}

        {!loading && filtered.length === 0 && (
          <div className="mb-6 rounded-3xl border border-white/[0.08] bg-white/[0.03] p-8 text-center">
            <h3 className="text-lg font-semibold">Ajustemos tu búsqueda</h3>
            <p className="mt-1 text-sm text-white/50">
              No encontramos perfiles con los filtros actuales.
            </p>
            <div className="mt-4 flex flex-wrap justify-center gap-2">
              <button
                onClick={() => {
                  setRadiusKm((r) => r + 10);
                  const center =
                    mapCenter ||
                    (location ? { lat: location[0], lng: location[1] } : null);
                  if (center) setMapCenter({ ...center });
                  setSearchTick((v) => v + 1);
                }}
                className="rounded-xl border border-white/10 bg-white/[0.04] px-4 py-2 text-sm"
              >
                Amplía tu rango (+10 km)
              </button>
              <button
                onClick={() => setView("map")}
                className="rounded-xl border border-fuchsia-500/30 bg-fuchsia-500/10 px-4 py-2 text-sm text-fuchsia-200"
              >
                Ver mapa
              </button>
            </div>
          </div>
        )}

        {!loading && filtered.length > 0 && (
          <section>
            <h2 className="mb-4 text-xl font-semibold">Resultados</h2>
            <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-4">
              {filtered.map((profile) => {
                const img = resolveCardImage(profile);
                const badge = levelBadge(profile.userLevel);
                return (
                  <Link
                    key={profile.id}
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
                      {profile.isActive && (
                        <div className="absolute left-2 top-2">
                          <span className="relative flex h-3.5 w-3.5">
                            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-300 opacity-75" />
                            <span className="relative inline-flex h-3.5 w-3.5 rounded-full border border-emerald-200/90 bg-emerald-400" />
                          </span>
                        </div>
                      )}
                    </div>
                    <div className="p-3">
                      <div className="flex items-center gap-2">
                        <div className="truncate text-sm font-semibold">
                          {profile.displayName || profile.username}
                        </div>
                        <span
                          className={`shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-semibold ${badge.className}`}
                        >
                          {badge.label}
                        </span>
                      </div>
                      <div className="mt-1 flex items-center gap-2 text-xs text-white/50">
                        <div className="h-6 w-6 overflow-hidden rounded-full bg-white/[0.06]">
                          {profile.avatarUrl ? (
                            <img
                              src={
                                resolveMediaUrl(profile.avatarUrl) ?? undefined
                              }
                              alt=""
                              className="h-full w-full object-cover"
                            />
                          ) : (
                            <User className="m-1 h-4 w-4 text-white/35" />
                          )}
                        </div>
                        <span className="truncate">
                          {profile.serviceCategory ||
                            profile.city ||
                            profile.profileType}
                        </span>
                      </div>
                      {profile.serviceDescription && (
                        <p className="mt-2 line-clamp-2 text-xs text-white/55">
                          {profile.serviceDescription}
                        </p>
                      )}
                    </div>
                  </Link>
                );
              })}
            </div>
          </section>
        )}
      </div>
    </div>
  );
}
