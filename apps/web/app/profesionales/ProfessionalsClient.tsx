"use client";

import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { apiFetch } from "../../lib/api";
import MapboxMap from "../../components/MapboxMap";
import Avatar from "../../components/Avatar";
import StarRating from "../../components/StarRating";
import SkeletonCard from "../../components/SkeletonCard";
import { useMapLocation } from "../../hooks/useMapLocation";
import useMe from "../../hooks/useMe";

const tiers = ["PREMIUM", "GOLD", "SILVER"] as const;
const DEFAULT_LOCATION: [number, number] = [-33.45, -70.66];

type Professional = {
  id: string;
  name: string;
  avatarUrl: string | null;
  rating: number | null;
  distance: number | null;
  latitude?: number | null;
  longitude?: number | null;
  locality?: string | null;
  approxAreaM?: number | null;
  isActive: boolean;
  tier: string | null;
  gender: string | null;
  age?: number | null;
  serviceSummary?: string | null;
  category: { id: string; name: string; displayName?: string | null; kind: string } | null;
};

type CategoryRef = {
  id: string;
  name: string;
  displayName?: string | null;
  slug?: string | null;
};

export default function ProfessionalsClient() {
  const searchParams = useSearchParams();
  const category = searchParams.get("category") || "";

  const [rangeKm, setRangeKm] = useState("15");
  const [tier, setTier] = useState("");
  const { location, resolved } = useMapLocation(DEFAULT_LOCATION);
  const [items, setItems] = useState<Professional[]>([]);
  const [categoryInfo, setCategoryInfo] = useState<CategoryRef | null>(null);
  const [categoryMessage, setCategoryMessage] = useState<string | null>(null);
  const [categoryWarning, setCategoryWarning] = useState<string | null>(null);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [focusedId, setFocusedId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const { me } = useMe();

  const queryString = useMemo(() => {
    const params = new URLSearchParams();
    if (category) params.set("category", category);
    if (rangeKm) params.set("rangeKm", rangeKm);
    if (tier) params.set("tier", tier);
    if (location) {
      params.set("lat", String(location[0]));
      params.set("lng", String(location[1]));
    }
    return params.toString();
  }, [category, rangeKm, tier, location]);

  useEffect(() => {
    if (!resolved) return;
    setLoading(true);
    apiFetch<{ professionals: Professional[]; category: CategoryRef | null; message?: string; warning?: string }>(`/professionals?${queryString}`)
      .then((res) => {
        setItems(res.professionals);
        setCategoryInfo(res.category || null);
        setCategoryMessage(res.message || null);
        setCategoryWarning(res.warning || null);
      })
      .finally(() => setLoading(false));
  }, [queryString, resolved]);

  const displayCategory =
    categoryInfo?.displayName ||
    categoryInfo?.name ||
    (category ? category.replace(/-/g, " ") : "");

  const breadcrumbCategory = displayCategory || "Experiencias";
  const filtersContent = (
    <div className="grid gap-3 md:grid-cols-2">
      <label className="grid gap-2 text-xs text-white/60">
        Rango (km)
        <input
          value={rangeKm}
          onChange={(e) => setRangeKm(e.target.value)}
          className="input"
          type="number"
          min="1"
        />
      </label>
      <label className="grid gap-2 text-xs text-white/60">
        Tier
        <select value={tier} onChange={(e) => setTier(e.target.value)} className="input">
          <option value="">Todos</option>
          {tiers.map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </select>
      </label>
    </div>
  );

  return (
    <div className="grid gap-6">
      <div className="card p-6">
        <div className="flex flex-col gap-2">
          <nav className="text-xs text-white/50">
            <Link href="/" className="hover:text-white">Home</Link> /{" "}
            <Link href="/profesionales" className="hover:text-white">Experiencias</Link> /{" "}
            <span className="text-white/80">{breadcrumbCategory || "Explorar"}</span>
          </nav>
          <h1 className="text-2xl font-semibold">{displayCategory || "Experiencias"}</h1>
          <p className="text-sm text-white/70">Experiencias disponibles cerca de ti.</p>
        </div>

        <div className="mt-4 hidden md:block">{filtersContent}</div>
        <div className="mt-4 flex items-center gap-3 md:hidden">
          <button
            type="button"
            onClick={() => setFiltersOpen(true)}
            className="rounded-full border border-white/15 bg-white/5 px-4 py-2 text-xs text-white/80 hover:bg-white/10"
          >
            Filtrar
          </button>
        </div>
        {categoryMessage ? (
          <div className="mt-3 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs text-white/70">
            {categoryMessage}
          </div>
        ) : null}
      </div>

      <div className="card p-0 overflow-hidden">
        <div className="border-b border-white/10 p-5">
          <h2 className="text-lg font-semibold">Mapa principal</h2>
          <p className="mt-1 text-xs text-white/60">Ubicaciones aproximadas y perfiles activos disponibles.</p>
        </div>
        <div className="p-3">
          <MapboxMap
            userLocation={location}
            focusMarkerId={focusedId}
            onMarkerFocus={(id) => setFocusedId(id)}
            markers={items
              .filter((p) => p.latitude != null && p.longitude != null)
              .map((p) => ({
                id: p.id,
                name: p.name,
                lat: Number(p.latitude),
                lng: Number(p.longitude),
                subtitle: p.category?.displayName || p.category?.name || null,
                locality: p.locality || null,
                age: p.age ?? null,
                gender: p.gender ?? null,
                description: p.serviceSummary || null,
                href: `/profesional/${p.id}`,
                messageHref: me?.user ? `/chat/${p.id}` : null,
                avatarUrl: p.avatarUrl,
                tier: p.tier,
                areaRadiusM: p.approxAreaM ?? 600
              }))}
            rangeKm={Number(rangeKm) || 15}
          />
        </div>
      </div>

      {filtersOpen ? (
        <div className="fixed inset-0 z-50 flex items-end bg-black/60 md:hidden">
          <div className="w-full rounded-t-2xl border border-white/10 bg-[#120b2a] p-5">
            <div className="mb-4 flex items-center justify-between">
              <div className="text-sm font-semibold">Filtros</div>
              <button
                type="button"
                onClick={() => setFiltersOpen(false)}
                className="text-xs text-white/60 hover:text-white"
              >
                Cerrar
              </button>
            </div>
            {filtersContent}
            <button
              type="button"
              onClick={() => setFiltersOpen(false)}
              className="mt-4 w-full rounded-xl bg-white text-black py-2 text-sm font-semibold"
            >
              Aplicar filtros
            </button>
          </div>
        </div>
      ) : null}


      {loading ? (
        <div className="grid gap-4 md:grid-cols-2">
          {[1, 2, 3, 4].map((i) => (
            <SkeletonCard key={i} />
          ))}
        </div>
      ) : categoryWarning === "category_not_found" ? (
        <div className="card p-6 text-white/70">
          <div className="text-lg font-semibold">Categoría no disponible</div>
          <p className="mt-2 text-sm text-white/60">Prueba con otra categoría o vuelve al listado general.</p>
          <Link href="/profesionales" className="mt-4 inline-flex rounded-full border border-white/15 bg-white/5 px-4 py-2 text-xs text-white/80 hover:bg-white/10">
            Volver a experiencias
          </Link>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {items.map((p) => (
            <div
              key={p.id}
              onClick={() => setFocusedId(p.id)}
              className={`rounded-2xl border border-white/10 bg-white/5 p-5 transition-all duration-200 hover:border-fuchsia-400/30 hover:shadow-lg hover:shadow-fuchsia-500/5 ${
                p.isActive ? "" : "opacity-60 grayscale"
              }`}
            >
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-4">
                  <Avatar src={p.avatarUrl} alt={p.name} size={48} />
                  <div>
                    <div className="font-semibold">{p.name}</div>
                    <div className="text-xs text-white/60">{p.category?.displayName || p.category?.name || "Experiencia"}</div>
                  </div>
                </div>
                <Link
                  href={`/profesional/${p.id}`}
                  className="rounded-full border border-white/15 bg-gradient-to-br from-fuchsia-600/20 to-violet-600/20 px-3 py-1 text-xs text-white/80 hover:from-fuchsia-600/30 hover:to-violet-600/30 transition-all"
                >
                  Ver perfil
                </Link>
              </div>
              <div className="mt-3 flex flex-wrap items-center gap-3 text-xs text-white/60">
                <StarRating rating={p.rating} size={12} />
                <span>{p.distance ? `${p.distance.toFixed(1)} km` : "Sin distancia"}</span>
                {p.locality ? <span>{p.locality}</span> : null}
                {p.age ? <span>{p.age} años</span> : null}
                {p.gender ? <span>{p.gender === "FEMALE" ? "Mujer" : p.gender === "MALE" ? "Hombre" : "Otro"}</span> : null}
                {p.tier ? <span className="rounded-full border border-yellow-400/30 bg-yellow-500/10 px-2 py-0.5 text-yellow-200">{p.tier}</span> : null}
              </div>
              {p.serviceSummary ? (
                <p className="mt-3 text-xs text-white/70 line-clamp-2">{p.serviceSummary}</p>
              ) : null}
            </div>
          ))}
          {!items.length ? (
            <div className="card p-6 text-white/60">No encontramos experiencias con estos filtros.</div>
          ) : null}
        </div>
      )}
    </div>
  );
}
