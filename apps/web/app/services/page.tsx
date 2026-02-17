"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { apiFetch, resolveMediaUrl } from "../../lib/api";
import Avatar from "../../components/Avatar";
import { useMapLocation } from "../../hooks/useMapLocation";
import MapboxMap from "../../components/MapboxMap";
import { Sparkles, Gem, Hotel, ShoppingBag, MapPin, Search, User } from "lucide-react";

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
  owner: {
    id: string;
    username: string;
    displayName: string | null;
    avatarUrl: string | null;
    profileType: string;
    city: string | null;
  };
  media: { id: string; url: string; type: string }[];
};

const DEFAULT_LOCATION: [number, number] = [-33.45, -70.66];

const KIND_TABS = [
  { key: "", label: "Todos", icon: Sparkles },
  { key: "PROFESSIONAL", label: "Experiencias", icon: Gem },
  { key: "ESTABLISHMENT", label: "Hospedaje", icon: Hotel },
  { key: "SHOP", label: "Tiendas", icon: ShoppingBag },
] as const;

function ownerHref(owner: ServiceItem["owner"]) {
  if (owner.profileType === "ESTABLISHMENT") return `/hospedaje/${owner.id}`;
  if (owner.profileType === "SHOP") return `/sexshop/${owner.username}`;
  return `/profesional/${owner.id}`;
}

export default function ServicesPage() {
  const { location } = useMapLocation(DEFAULT_LOCATION);

  const [services, setServices] = useState<ServiceItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeKind, setActiveKind] = useState("");
  const [search, setSearch] = useState("");
  const [showMap, setShowMap] = useState(false);

  // Fetch services
  useEffect(() => {
    setLoading(true);
    const params = new URLSearchParams();
    if (location) {
      params.set("lat", String(location[0]));
      params.set("lng", String(location[1]));
    }
    if (activeKind) params.set("kind", activeKind);

    apiFetch<{ services: ServiceItem[] }>(`/services/global?${params.toString()}`)
      .then((res) => {
        setServices(res?.services || []);
      })
      .catch(() => setServices([]))
      .finally(() => setLoading(false));
  }, [location, activeKind]);

  // Filter by search
  const filtered = useMemo(() => {
    if (!search.trim()) return services;
    const q = search.toLowerCase();
    return services.filter(
      (s) =>
        (s.title || "").toLowerCase().includes(q) ||
        (s.category || "").toLowerCase().includes(q) ||
        (s.owner?.displayName || "").toLowerCase().includes(q) ||
        (s.owner?.city || "").toLowerCase().includes(q)
    );
  }, [services, search]);

  // Group services by category for display
  const grouped = useMemo(() => {
    const groups: Record<string, ServiceItem[]> = {};
    for (const s of filtered) {
      const key = s.category || "Otros";
      if (!groups[key]) groups[key] = [];
      groups[key].push(s);
    }
    return Object.entries(groups);
  }, [filtered]);

  // Map markers
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

  return (
    <div className="min-h-[100dvh] text-white">
      {/* Hero header */}
      <section className="relative overflow-hidden border-b border-white/[0.06] bg-gradient-to-b from-[#0e0e12] to-transparent px-3 pb-4 pt-6 sm:px-4 sm:pb-6 sm:pt-8">
        <div className="pointer-events-none absolute left-1/2 top-0 -z-10 h-[400px] w-[600px] -translate-x-1/2 rounded-full bg-violet-600/[0.08] blur-[120px]" />
        <div className="mx-auto max-w-6xl">
          <div className="mb-1 flex items-center gap-2 text-xs font-medium uppercase tracking-wider text-fuchsia-400/70">
            <Sparkles className="h-3.5 w-3.5" /> Explorar
          </div>
          <h1 className="text-2xl font-bold tracking-tight sm:text-3xl md:text-4xl">Servicios</h1>
          <p className="mt-1 text-sm text-white/45">Descubre experiencias, hospedajes y tiendas cerca de ti.</p>

          {/* Search */}
          <div className="relative mt-3 sm:mt-5">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/30 sm:left-4" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar por nombre, categoría..."
              className="w-full rounded-xl border border-white/10 bg-white/[0.04] py-2.5 pl-9 pr-3 text-xs text-white placeholder-white/30 outline-none transition-all focus:border-fuchsia-500/40 focus:bg-white/[0.06] focus:ring-1 focus:ring-fuchsia-500/20 sm:rounded-2xl sm:py-3.5 sm:pl-11 sm:pr-4 sm:text-sm"
            />
          </div>

          {/* Kind tabs */}
          <div className="scrollbar-none -mx-3 mt-3 flex gap-1.5 overflow-x-auto px-3 sm:-mx-4 sm:mt-4 sm:gap-2 sm:px-4">
            {KIND_TABS.map((t) => {
              const Icon = t.icon;
              return (
                <button
                  key={t.key}
                  onClick={() => setActiveKind(t.key)}
                  className={`flex shrink-0 items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-medium transition-all sm:gap-1.5 sm:rounded-xl sm:px-4 sm:py-2 sm:text-sm ${
                    activeKind === t.key
                      ? "border border-fuchsia-500/30 bg-fuchsia-500/10 text-fuchsia-300"
                      : "border border-white/[0.06] text-white/50 hover:bg-white/[0.04]"
                  }`}
                >
                  <Icon className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                  {t.label}
                </button>
              );
            })}
          </div>
        </div>
      </section>

      {/* Main content */}
      <div className="mx-auto max-w-6xl px-3 py-4 sm:px-4 sm:py-6">
        {/* View toggle + stats */}
        <div className="mb-5 flex items-center justify-between">
          <div className="text-sm text-white/40">
            {loading ? "Cargando..." : `${filtered.length} servicio${filtered.length !== 1 ? "s" : ""} encontrado${filtered.length !== 1 ? "s" : ""}`}
          </div>
          <button
            onClick={() => setShowMap(!showMap)}
            className={`flex items-center gap-2 rounded-xl border px-4 py-2 text-xs font-medium transition-all ${
              showMap
                ? "border-fuchsia-500/30 bg-fuchsia-500/10 text-fuchsia-300"
                : "border-white/10 bg-white/[0.04] text-white/60 hover:bg-white/[0.08]"
            }`}
          >
            <MapPin className="h-3.5 w-3.5" />
            {showMap ? "Ocultar mapa" : "Ver mapa"}
          </button>
        </div>

        {/* Map section */}
        {showMap && markers.length > 0 && (
          <div className="mb-6 overflow-hidden rounded-2xl border border-white/[0.08]">
            <MapboxMap
              userLocation={location}
              markers={markers}
              height={380}
            />
          </div>
        )}

        {/* Loading skeleton */}
        {loading && (
          <div className="grid grid-cols-2 gap-2 sm:gap-4 lg:grid-cols-3">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <div key={i} className="animate-pulse overflow-hidden rounded-2xl border border-white/[0.06] bg-white/[0.03]">
                <div className="aspect-[4/3] bg-white/[0.04]" />
                <div className="space-y-2 p-2 sm:p-4">
                  <div className="h-4 w-2/3 rounded bg-white/[0.06]" />
                  <div className="h-3 w-1/3 rounded bg-white/[0.04]" />
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Empty state */}
        {!loading && filtered.length === 0 && (
          <div className="flex flex-col items-center justify-center rounded-3xl border border-white/[0.08] bg-white/[0.03] p-12 text-center">
            <div className="mb-4 rounded-full bg-white/[0.06] p-4">
              <Search className="h-8 w-8 text-white/30" />
            </div>
            <h3 className="text-lg font-semibold">Sin resultados</h3>
            <p className="mt-1 max-w-sm text-sm text-white/40">
              {search ? `No encontramos servicios para "${search}". Intenta con otra búsqueda.` : "No hay servicios disponibles en este momento. Vuelve pronto."}
            </p>
            {(search || activeKind) && (
              <button
                onClick={() => { setSearch(""); setActiveKind(""); }}
                className="mt-4 rounded-xl border border-white/10 bg-white/[0.04] px-5 py-2.5 text-sm font-medium transition hover:bg-white/[0.08]"
              >
                Limpiar filtros
              </button>
            )}
          </div>
        )}

        {/* Services grouped by category */}
        {!loading && grouped.map(([categoryName, items]) => (
          <section key={categoryName} className="mb-10 last:mb-0">
            <div className="mb-4 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <h2 className="text-xl font-bold tracking-tight">{categoryName}</h2>
                <span className="rounded-full bg-white/[0.06] px-2.5 py-0.5 text-xs font-medium text-white/40">{items.length}</span>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2 sm:gap-4 lg:grid-cols-3">
              {items.map((s) => {
                const img = s.media?.[0]?.url ? resolveMediaUrl(s.media[0].url) : null;
                const href = ownerHref(s.owner);
                return (
                  <Link
                    key={s.id}
                    href={href}
                    className="group overflow-hidden rounded-2xl border border-white/[0.08] bg-white/[0.03] transition-all duration-200 hover:-translate-y-1 hover:border-white/15 hover:shadow-[0_20px_60px_rgba(0,0,0,0.4)]"
                  >
                    {/* Image or avatar header */}
                    <div className="relative aspect-[4/3] overflow-hidden bg-gradient-to-br from-white/5 to-transparent">
                      {img ? (
                        <img
                          src={img}
                          alt={s.title}
                          className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.06]"
                          onError={(e) => {
                            const el = e.currentTarget;
                            el.onerror = null;
                            el.src = "/brand/isotipo-new.png";
                            el.className = "h-16 w-16 mx-auto mt-8 opacity-30";
                          }}
                        />
                      ) : s.owner?.avatarUrl ? (
                        <img
                          src={resolveMediaUrl(s.owner.avatarUrl) ?? undefined}
                          alt={s.title}
                          className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.06]"
                        />
                      ) : (
                        <div className="flex h-full items-center justify-center">
                          <img src="/brand/isotipo-new.png" alt="" className="h-16 w-16 opacity-20" />
                        </div>
                      )}
                      <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />

                      {/* Distance badge */}
                      {s.distance != null && (
                        <div className="absolute right-2 top-2 sm:right-3 sm:top-3 flex items-center gap-1 rounded-full border border-white/10 bg-black/50 px-2 py-1 sm:px-2.5 sm:py-1 text-[10px] sm:text-[11px] text-white/80 backdrop-blur-xl">
                          <MapPin className="h-3 w-3" /> {s.distance.toFixed(1)} km
                        </div>
                      )}

                      {/* Type badge */}
                      <div className="absolute left-2 top-2 sm:left-3 sm:top-3">
                        <span className={`rounded-full border px-2 py-0.5 sm:px-2.5 sm:py-1 text-[10px] sm:text-[10px] font-medium backdrop-blur-xl ${
                          s.owner?.profileType === "PROFESSIONAL"
                            ? "border-fuchsia-400/30 bg-fuchsia-500/20 text-fuchsia-200"
                            : s.owner?.profileType === "ESTABLISHMENT"
                              ? "border-amber-400/30 bg-amber-500/20 text-amber-200"
                              : "border-pink-400/30 bg-pink-500/20 text-pink-200"
                        }`}>
                          {s.owner?.profileType === "PROFESSIONAL" ? "Experiencia" : s.owner?.profileType === "ESTABLISHMENT" ? "Hospedaje" : "Tienda"}
                        </span>
                      </div>

                      {/* Bottom overlay */}
                      <div className="absolute bottom-0 left-0 right-0 p-2.5 sm:p-4">
                        <h3 className="text-xs sm:text-sm font-semibold leading-tight line-clamp-2">{s.title || "Servicio"}</h3>
                      </div>
                    </div>

                    {/* Card body */}
                    <div className="p-2.5 sm:p-4">
                      <div className="flex items-center gap-2 sm:gap-3">
                        <div className="h-7 w-7 sm:h-8 sm:w-8 shrink-0 overflow-hidden rounded-lg bg-white/[0.06]">
                          {s.owner?.avatarUrl ? (
                            <img src={resolveMediaUrl(s.owner.avatarUrl) ?? undefined} className="h-full w-full object-cover" alt="" />
                          ) : (
                            <div className="flex h-full items-center justify-center text-white/20">
                              <User className="h-4 w-4" />
                            </div>
                          )}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="truncate text-xs sm:text-sm font-medium">{s.owner?.displayName || s.owner?.username || "Profesional"}</div>
                          <div className="flex items-center gap-1.5 sm:gap-2 text-xs sm:text-xs text-white/50">
                            {s.category && <span className="truncate">{s.category}</span>}
                            {s.owner?.city && <span className="truncate">· {s.owner.city}</span>}
                          </div>
                        </div>
                        {s.price != null && s.price > 0 && (
                          <div className="text-right shrink-0">
                            <div className="text-xs sm:text-sm font-bold">${s.price.toLocaleString("es-CL")}</div>
                          </div>
                        )}
                      </div>
                    </div>
                  </Link>
                );
              })}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}
