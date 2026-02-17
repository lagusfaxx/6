"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { apiFetch, resolveMediaUrl } from "../../lib/api";
import { useMapLocation } from "../../hooks/useMapLocation";
import MapboxMap from "../../components/MapboxMap";
import { Compass, MapPin, Search, SlidersHorizontal, User } from "lucide-react";

type ServiceItem = {
  id: string;
  title: string;
  description: string | null;
  price: number | null;
  category: string | null;
  categorySlug: string | null;
  distance: number | null;
  latitude: number | null;
  longitude: number | null;
  approxAreaM: number | null;
  createdAt?: string;
  availableNow?: boolean;
  owner: {
    id: string;
    username: string;
    displayName: string | null;
    avatarUrl: string | null;
    coverUrl?: string | null;
    profileType: string;
    city: string | null;
    isOnline?: boolean;
  };
  media: { id: string; url: string; type: string }[];
};

const DEFAULT_LOCATION: [number, number] = [-33.45, -70.66];
const INITIAL_RADIUS_KM = 10;

function ownerHref(owner: ServiceItem["owner"]) {
  if (owner.profileType === "ESTABLISHMENT") return `/hospedaje/${owner.id}`;
  return `/profesional/${owner.id}`;
}

function resolveServiceImage(service: ServiceItem) {
  const primary = service.media?.[0]?.url || null;
  const fallback = service.owner?.coverUrl || service.owner?.avatarUrl || null;
  return resolveMediaUrl(primary || fallback);
}

export default function ServicesPage() {
  const { location } = useMapLocation(DEFAULT_LOCATION);

  const [services, setServices] = useState<ServiceItem[]>([]);
  const [fallbackServices, setFallbackServices] = useState<ServiceItem[]>([]);
  const [loading, setLoading] = useState(true);

  const [type, setType] = useState<"experience" | "space">("experience");
  const [view, setView] = useState<"list" | "map">("list");
  const [sort, setSort] = useState("near");
  const [search, setSearch] = useState("");
  const [radiusKm, setRadiusKm] = useState(INITIAL_RADIUS_KM);
  const [availableNow, setAvailableNow] = useState(false);
  const [minPrice, setMinPrice] = useState("");
  const [maxPrice, setMaxPrice] = useState("");
  const [duration, setDuration] = useState("");
  const [showAdvanced, setShowAdvanced] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const query = new URLSearchParams(window.location.search);
    const nextType = query.get("type");
    if (nextType === "experience" || nextType === "space") setType(nextType);
    if (query.get("view") === "map") setView("map");
    if (query.get("sort")) setSort(query.get("sort") || "near");
    if (query.get("q")) setSearch(query.get("q") || "");
    if (query.get("radiusKm")) setRadiusKm(Number(query.get("radiusKm")) || INITIAL_RADIUS_KM);
    if (query.get("availableNow") === "1" || query.get("sort") === "availableNow") setAvailableNow(true);
    if (query.get("minPrice")) setMinPrice(query.get("minPrice") || "");
    if (query.get("maxPrice")) setMaxPrice(query.get("maxPrice") || "");
    if (query.get("duration")) setDuration(query.get("duration") || "");
  }, []);

  useEffect(() => {
    if (!availableNow) setSort(type === "space" ? "new" : "near");
  }, [type, availableNow]);

  useEffect(() => {
    setLoading(true);

    const qp = new URLSearchParams();
    if (location) {
      qp.set("lat", String(location[0]));
      qp.set("lng", String(location[1]));
    }
    qp.set("type", type);
    qp.set("sort", availableNow ? "availableNow" : sort);
    qp.set("radiusKm", String(radiusKm));
    qp.set("limit", "120");
    if (availableNow) qp.set("availableNow", "1");
    if (minPrice) qp.set("minPrice", minPrice);
    if (maxPrice) qp.set("maxPrice", maxPrice);

    const withFilters = `/services/global?${qp.toString()}`;
    const fallback = `/services/global?type=${type}&sort=new&limit=24${location ? `&lat=${location[0]}&lng=${location[1]}` : ""}`;

    Promise.all([
      apiFetch<{ services: ServiceItem[] }>(withFilters).catch(() => ({ services: [] })),
      apiFetch<{ services: ServiceItem[] }>(fallback).catch(() => ({ services: [] })),
    ])
      .then(([res, fallbackRes]) => {
        const noShops = (res?.services || []).filter((s) => s.owner.profileType !== "SHOP");
        const fallbackNoShops = (fallbackRes?.services || []).filter((s) => s.owner.profileType !== "SHOP");
        setServices(noShops);
        setFallbackServices(fallbackNoShops);
      })
      .finally(() => setLoading(false));
  }, [location, type, sort, radiusKm, availableNow, minPrice, maxPrice]);

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();
    const min = minPrice ? Number(minPrice) : null;
    const max = maxPrice ? Number(maxPrice) : null;

    return services.filter((s) => {
      if (query) {
        const text = `${s.title || ""} ${s.category || ""} ${s.owner?.displayName || ""} ${s.owner?.city || ""}`.toLowerCase();
        if (!text.includes(query)) return false;
      }
      if (min != null && (s.price ?? 0) < min) return false;
      if (max != null && (s.price ?? 0) > max) return false;
      if (duration && !(`${s.title || ""} ${s.description || ""}`.toLowerCase().includes(duration.toLowerCase()))) return false;
      return true;
    });
  }, [services, search, minPrice, maxPrice, duration]);

  const markers = useMemo(
    () =>
      filtered
        .filter((s) => s.latitude != null && s.longitude != null)
        .map((s) => ({
          id: s.id,
          name: s.title || s.owner?.displayName || "Servicio",
          lat: Number(s.latitude),
          lng: Number(s.longitude),
          subtitle: s.category || "Servicio",
          href: ownerHref(s.owner),
          avatarUrl: s.owner?.avatarUrl,
          areaRadiusM: s.approxAreaM ?? undefined,
        })),
    [filtered]
  );

  const recommended = filtered.length === 0 ? fallbackServices.slice(0, 8) : [];

  return (
    <div className="min-h-[100dvh] text-white">
      <section className="relative overflow-hidden border-b border-white/[0.06] bg-gradient-to-b from-[#0e0e12] to-transparent px-4 py-8">
        <div className="pointer-events-none absolute left-1/2 top-0 -z-10 h-[400px] w-[600px] -translate-x-1/2 rounded-full bg-violet-600/[0.08] blur-[120px]" />
        <div className="mx-auto max-w-6xl">
          <div className="mb-1 flex items-center gap-2 text-xs font-medium uppercase tracking-wider text-fuchsia-400/70">
            <Compass className="h-3.5 w-3.5" /> Explorar
          </div>
          <h1 className="text-3xl font-bold tracking-tight md:text-4xl">Explorar</h1>
          <p className="mt-1 text-sm text-white/45">Resultados cercanos con disponibilidad y ubicación.</p>

          <div className="mt-5 grid gap-3 md:grid-cols-3">
            <div className="relative md:col-span-2">
              <Search className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-white/30" />
              <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar por nombre o ubicación" className="w-full rounded-2xl border border-white/10 bg-white/[0.04] py-3 pl-11 pr-4 text-sm outline-none transition focus:border-fuchsia-500/40" />
            </div>
            <button onClick={() => setShowAdvanced((v) => !v)} className="inline-flex items-center justify-center gap-2 rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm text-white/75">
              <SlidersHorizontal className="h-4 w-4" /> Filtros avanzados
            </button>
          </div>

          <div className="mt-4 flex flex-wrap gap-2">
            {([
              { key: "experience", label: "Experiencias" },
              { key: "space", label: "Espacios" },
            ] as const).map((t) => (
              <button key={t.key} onClick={() => setType(t.key)} className={`rounded-xl border px-4 py-2 text-sm ${type === t.key ? "border-fuchsia-500/40 bg-fuchsia-500/15 text-fuchsia-200" : "border-white/10 bg-white/[0.04] text-white/60"}`}>
                {t.label}
              </button>
            ))}
            <div className="ml-auto inline-flex rounded-xl border border-white/10 bg-white/[0.03] p-1">
              <button onClick={() => setView("list")} className={`rounded-lg px-3 py-1.5 text-sm ${view === "list" ? "bg-fuchsia-500/20 text-fuchsia-200" : "text-white/60"}`}>Lista</button>
              <button onClick={() => setView("map")} className={`rounded-lg px-3 py-1.5 text-sm ${view === "map" ? "bg-fuchsia-500/20 text-fuchsia-200" : "text-white/60"}`}>Mapa</button>
            </div>
          </div>

          {showAdvanced && (
            <div className="mt-3 grid gap-3 rounded-2xl border border-white/[0.08] bg-white/[0.03] p-4 md:grid-cols-5">
              <input value={minPrice} onChange={(e) => setMinPrice(e.target.value)} placeholder="Precio mínimo" className="rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2 text-sm" />
              <input value={maxPrice} onChange={(e) => setMaxPrice(e.target.value)} placeholder="Precio máximo" className="rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2 text-sm" />
              <input value={duration} onChange={(e) => setDuration(e.target.value)} placeholder="Duración (ej: 60)" className="rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2 text-sm" />
              <input value={radiusKm} onChange={(e) => setRadiusKm(Number(e.target.value || INITIAL_RADIUS_KM))} placeholder="Radio km" className="rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2 text-sm" />
              <label className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2 text-sm text-white/75"><input type="checkbox" checked={availableNow} onChange={(e) => setAvailableNow(e.target.checked)} /> Disponible ahora</label>
            </div>
          )}
        </div>
      </section>

      <div className="mx-auto max-w-6xl px-4 py-6">
        <div className="mb-5 text-sm text-white/45">
          {loading ? "Cargando resultados..." : `${filtered.length} resultado${filtered.length !== 1 ? "s" : ""}`}
        </div>

        {view === "map" && (
          <div className="mb-6 overflow-hidden rounded-2xl border border-white/[0.08]">
            <MapboxMap userLocation={location} markers={markers} height={420} />
          </div>
        )}

        {view === "map" && !loading && markers.length === 0 && (
          <div className="mb-6 rounded-2xl border border-white/[0.08] bg-white/[0.03] px-4 py-3 text-sm text-white/55">
            No hay ubicaciones válidas, amplía rango o completa ubicación del perfil.
          </div>
        )}

        {loading && (
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => <div key={i} className="aspect-[4/5] animate-pulse rounded-2xl border border-white/[0.06] bg-white/[0.03]" />)}
          </div>
        )}

        {!loading && filtered.length === 0 && (
          <div className="mb-6 rounded-3xl border border-white/[0.08] bg-white/[0.03] p-8 text-center">
            <h3 className="text-lg font-semibold">Ajustemos tu búsqueda</h3>
            <p className="mt-1 text-sm text-white/50">Amplía el rango o explora en mapa para ver más opciones disponibles.</p>
            <div className="mt-4 flex flex-wrap justify-center gap-2">
              <button onClick={() => setRadiusKm((r) => r + 10)} className="rounded-xl border border-white/10 bg-white/[0.04] px-4 py-2 text-sm">Amplía tu rango (+10 km)</button>
              <button onClick={() => setView("map")} className="rounded-xl border border-fuchsia-500/30 bg-fuchsia-500/10 px-4 py-2 text-sm text-fuchsia-200">Ver mapa</button>
            </div>
          </div>
        )}

        {!loading && filtered.length > 0 && (
          <section>
            <h2 className="mb-4 text-xl font-semibold">Resultados</h2>
            <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-4">
              {filtered.map((s) => {
                const img = resolveServiceImage(s);
                return (
                  <Link key={s.id} href={ownerHref(s.owner)} className="group overflow-hidden rounded-2xl border border-white/[0.08] bg-white/[0.03]">
                    <div className="relative aspect-[4/3] overflow-hidden bg-white/[0.04]">
                      {img ? <img src={img} alt={s.title} className="h-full w-full object-cover transition group-hover:scale-105" /> : <div className="flex h-full items-center justify-center text-white/30">Sin imagen</div>}
                      {s.distance != null && <div className="absolute right-2 top-2 rounded-full border border-white/10 bg-black/50 px-2 py-1 text-[11px]"><MapPin className="mr-1 inline h-3 w-3" />{s.distance.toFixed(1)} km</div>}
                      {s.availableNow && <div className="absolute left-2 top-2 rounded-full border border-emerald-300/30 bg-emerald-500/20 px-2 py-1 text-[11px] text-emerald-100">Online</div>}
                    </div>
                    <div className="p-3">
                      <div className="truncate text-sm font-semibold">{s.title || "Servicio"}</div>
                      <div className="mt-1 flex items-center gap-2 text-xs text-white/50">
                        <div className="h-6 w-6 overflow-hidden rounded-full bg-white/[0.06]">{s.owner.avatarUrl ? <img src={resolveMediaUrl(s.owner.avatarUrl) ?? undefined} alt="" className="h-full w-full object-cover" /> : <User className="m-1 h-4 w-4 text-white/35" />}</div>
                        <span className="truncate">{s.owner.displayName || s.owner.username}</span>
                      </div>
                      {s.price != null && <div className="mt-2 text-sm font-bold">${s.price.toLocaleString("es-CL")}</div>}
                    </div>
                  </Link>
                );
              })}
            </div>
          </section>
        )}

        {!loading && recommended.length > 0 && (
          <section className="mt-8">
            <h2 className="mb-3 text-lg font-semibold">Recomendadas recientes</h2>
            <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
              {recommended.map((s) => (
                <Link key={`rec-${s.id}`} href={ownerHref(s.owner)} className="rounded-xl border border-white/[0.08] bg-white/[0.03] p-3 text-sm hover:bg-white/[0.06]">
                  <div className="truncate font-medium">{s.title || "Servicio"}</div>
                  <div className="truncate text-xs text-white/50">{s.owner.displayName || s.owner.username}</div>
                </Link>
              ))}
            </div>
          </section>
        )}
      </div>
    </div>
  );
}
