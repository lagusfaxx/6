"use client";

import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { apiFetch, resolveMediaUrl } from "../../lib/api";
import MapboxMap from "../../components/MapboxMap";

const tiers = ["PREMIUM", "GOLD", "SILVER"] as const;

type Professional = {
  id: string;
  name: string;
  avatarUrl: string | null;
  rating: number | null;
  distance: number | null;
  latitude?: number | null;
  longitude?: number | null;
  isActive: boolean;
  tier: string | null;
  gender: string | null;
  age?: number | null;
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
  const [location, setLocation] = useState<[number, number] | null>(null);
  const [items, setItems] = useState<Professional[]>([]);
  const [categoryInfo, setCategoryInfo] = useState<CategoryRef | null>(null);
  const [categoryMessage, setCategoryMessage] = useState<string | null>(null);
  const [categoryWarning, setCategoryWarning] = useState<string | null>(null);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [focusedId, setFocusedId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      (pos) => setLocation([pos.coords.latitude, pos.coords.longitude]),
      () => null
    );
  }, []);

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
    setLoading(true);
    apiFetch<{ professionals: Professional[]; category: CategoryRef | null; message?: string; warning?: string }>(`/professionals?${queryString}`)
      .then((res) => {
        setItems(res.professionals);
        setCategoryInfo(res.category || null);
        setCategoryMessage(res.message || null);
        setCategoryWarning(res.warning || null);
      })
      .finally(() => setLoading(false));
  }, [queryString]);

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
                href: `/profesional/${p.id}`,
                messageHref: `/chat/${p.id}`,
                avatarUrl: p.avatarUrl,
                tier: p.tier
              }))}
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
        <div className="text-white/60">Cargando experiencias...</div>
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
              className={`rounded-2xl border border-white/10 bg-white/5 p-5 transition hover:border-white/30 ${
                p.isActive ? "" : "opacity-60 grayscale"
              }`}
            >
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-4">
                  <div className="h-12 w-12 overflow-hidden rounded-full border border-white/10 bg-white/10">
                    {p.avatarUrl ? (
                      <img
                        src={resolveMediaUrl(p.avatarUrl) || ""}
                        alt={p.name}
                        className="h-full w-full object-cover"
                      />
                    ) : null}
                  </div>
                  <div>
                    <div className="font-semibold">{p.name}</div>
                    <div className="text-xs text-white/60">{p.category?.displayName || p.category?.name || "Experiencia"}</div>
                  </div>
                </div>
                <Link
                  href={`/profesional/${p.id}`}
                  className="rounded-full border border-white/15 bg-white/5 px-3 py-1 text-xs text-white/80 hover:bg-white/10"
                >
                  Ver perfil
                </Link>
              </div>
              <div className="mt-3 flex flex-wrap gap-3 text-xs text-white/60">
                <span>⭐ {p.rating ?? "N/A"}</span>
                <span>{p.distance ? `${p.distance.toFixed(1)} km` : "Sin distancia"}</span>
                {p.tier ? <span>{p.tier}</span> : null}
              </div>
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
