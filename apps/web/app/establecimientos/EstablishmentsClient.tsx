"use client";

import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { apiFetch } from "../../lib/api";
import MapboxMap from "../../components/MapboxMap";

type Establishment = {
  id: string;
  name: string;
  city: string;
  address: string;
  phone: string;
  description: string | null;
  rating: number | null;
  distance: number | null;
  latitude?: number | null;
  longitude?: number | null;
  gallery: string[];
  category: { id: string; name: string; displayName?: string | null } | null;
};

export default function EstablishmentsClient() {
  const searchParams = useSearchParams();
  const category = searchParams.get("category") || "";

  const [rangeKm, setRangeKm] = useState("20");
  const [minRating, setMinRating] = useState("4");
  const [location, setLocation] = useState<[number, number] | null>(null);
  const [items, setItems] = useState<Establishment[]>([]);
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
    if (minRating) params.set("minRating", minRating);
    if (location) {
      params.set("lat", String(location[0]));
      params.set("lng", String(location[1]));
    }
    return params.toString();
  }, [category, rangeKm, minRating, location]);

  useEffect(() => {
    setLoading(true);
    apiFetch<{ establishments: Establishment[] }>(`/establishments?${queryString}`)
      .then((res) => setItems(res.establishments))
      .finally(() => setLoading(false));
  }, [queryString]);

  return (
    <div className="grid gap-6">
      <div className="card p-6">
        <h1 className="text-2xl font-semibold">Búsqueda de lugares</h1>
        <p className="mt-2 text-sm text-white/70">Filtra por rango y calificación mínima.</p>
        <div className="mt-6 grid gap-3 md:grid-cols-2">
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
            Calificación mínima
            <input
              value={minRating}
              onChange={(e) => setMinRating(e.target.value)}
              className="input"
              type="number"
              min="1"
              max="5"
            />
          </label>
        </div>
      </div>
      <div className="card p-0 overflow-hidden">
        <div className="p-6 border-b border-white/10">
          <h2 className="text-lg font-semibold">Mapa</h2>
          <p className="mt-1 text-sm text-white/70">
            Vista por ubicación. Si autorizas GPS, ordenamos por distancia y centramos el mapa.
          </p>
        </div>
        <div className="p-3">
          <MapboxMap
            userLocation={location}
            markers={items
              .filter((e) => e.latitude != null && e.longitude != null)
              .map((e) => ({
                id: e.id,
                name: e.name,
                lat: Number(e.latitude),
                lng: Number(e.longitude),
                subtitle: e.category?.displayName || e.category?.name || null,
                href: `/establecimiento/${e.id}`
              }))}
          />
        </div>
      </div>


      {loading ? (
        <div className="text-white/60">Cargando lugares...</div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {items.map((e) => (
            <Link
              key={e.id}
              href={`/establecimiento/${e.id}`}
              className="rounded-2xl border border-white/10 bg-white/5 p-5 hover:border-white/30"
            >
              <div className="flex items-center justify-between">
                <div>
                  <div className="font-semibold">{e.name}</div>
                  <div className="text-xs text-white/60">{e.city}</div>
                </div>
                <div className="text-xs text-white/60">⭐ {e.rating ?? "N/A"}</div>
              </div>
              <p className="mt-3 text-sm text-white/60 line-clamp-2">
                {e.description || "Lugar recomendado para clientes."}
              </p>
              <div className="mt-3 text-xs text-white/50">
                {e.distance ? `${e.distance.toFixed(1)} km` : "Sin distancia"} • {e.address}
              </div>
            </Link>
          ))}
          {!items.length ? (
            <div className="card p-6 text-white/60">No hay lugares con estos filtros.</div>
          ) : null}
        </div>
      )}
    </div>
  );
}
