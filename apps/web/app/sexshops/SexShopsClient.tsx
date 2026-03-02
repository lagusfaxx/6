"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { apiFetch } from "../../lib/api";
import MapboxMap from "../../components/MapboxMap";
import Avatar from "../../components/Avatar";

type Shop = {
  id: string;
  username: string;
  name: string;
  avatarUrl: string | null;
  city: string | null;
  address: string | null;
  latitude?: number | null;
  longitude?: number | null;
  distance: number | null;
};

export default function SexShopsClient() {
  const searchParams = useSearchParams();
  const category = searchParams.get("category") || "shop"; // Default to 'shop' category
  const [rangeKm, setRangeKm] = useState("15");
  const [location, setLocation] = useState<[number, number] | null>([-33.45, -70.66]);
  const [items, setItems] = useState<Shop[]>([]);
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
    if (location) {
      params.set("lat", String(location[0]));
      params.set("lng", String(location[1]));
    }
    return params.toString();
  }, [category, rangeKm, location]);

  useEffect(() => {
    setLoading(true);
    apiFetch<{ shops: Shop[] }>(`/shop/sexshops?${queryString}`)
      .then((res) => setItems(res.shops))
      .finally(() => setLoading(false));
  }, [queryString]);

  return (
    <div className="grid gap-6">
      <div className="card p-6">
        <h1 className="text-2xl font-semibold">Tiendas</h1>
        <p className="mt-2 text-sm text-white/70">Encuentra tiendas cerca de ti y revisa sus productos.</p>
        <div className="mt-6 grid gap-3 md:grid-cols-3">
          <label className="grid gap-2 text-xs text-white/60">
            Rango (km)
            <input value={rangeKm} onChange={(e) => setRangeKm(e.target.value)} className="input" type="number" min="1" />
          </label>
        </div>
      </div>

      <div className="card p-0 overflow-hidden">
        <div className="p-6 border-b border-white/10">
          <h2 className="text-lg font-semibold">Mapa</h2>
          <p className="mt-1 text-sm text-white/70">Pins reales desde la base de datos.</p>
        </div>
        <div className="p-3">
          <MapboxMap
            userLocation={location}
            markers={items
              .filter((s) => s.latitude != null && s.longitude != null)
              .map((s) => ({
                id: s.id,
                name: s.name,
                lat: Number(s.latitude),
                lng: Number(s.longitude),
                subtitle: s.city || null,
                href: `/sexshop/${s.username}`,
                avatarUrl: s.avatarUrl
              }))}
          />
        </div>
      </div>

      {loading ? (
        <div className="text-white/60">Cargando tiendas...</div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {items.map((s) => (
            <Link
              key={s.id}
              href={`/sexshop/${s.username}`}
              className="rounded-2xl border border-white/10 bg-white/5 p-5 transition hover:border-white/30"
            >
              <div className="flex items-center gap-4">
                <Avatar src={s.avatarUrl} alt={s.name} size={48} />
                <div>
                  <div className="font-semibold">{s.name}</div>
                  <div className="text-xs text-white/60">{s.city || s.address || "Tienda"}</div>
                </div>
              </div>
              <div className="mt-3 text-xs text-white/60">{s.distance ? `${s.distance.toFixed(1)} km` : "Sin distancia"}</div>
            </Link>
          ))}
          {!items.length ? <div className="card p-6 text-white/60">No encontramos tiendas con estos filtros.</div> : null}
        </div>
      )}
    </div>
  );
}
