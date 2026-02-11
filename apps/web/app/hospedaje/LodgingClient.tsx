"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { MapPin, Sparkles, Star } from "lucide-react";
import MapboxMap from "../../components/MapboxMap";
import { apiFetch, resolveMediaUrl } from "../../lib/api";
import { useMapLocation } from "../../hooks/useMapLocation";

type Item = {
  id: string;
  name: string;
  address: string;
  city: string;
  distance: number | null;
  rating: number | null;
  reviewsCount: number;
  fromPrice: number;
  tags: string[];
  coverUrl: string | null;
  latitude?: number | null;
  longitude?: number | null;
};

const roomTypeTags = ["", "Normal", "Jacuzzi", "Premium", "Temática"];

export default function LodgingClient() {
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);
  const { location } = useMapLocation([-33.45, -70.66]);

  const [filters, setFilters] = useState({
    duration: "3H",
    roomType: "",
    onlyPromos: false,
  });

  const query = useMemo(() => {
    const p = new URLSearchParams();
    p.set("duration", filters.duration);
    if (filters.onlyPromos) p.set("onlyPromos", "true");
    if (location) {
      p.set("lat", String(location[0]));
      p.set("lng", String(location[1]));
    }
    return p.toString();
  }, [filters.duration, filters.onlyPromos, location]);

  useEffect(() => {
    setLoading(true);
    apiFetch<{ establishments: Item[] }>(`/motels?${query}`)
      .then((r) => setItems(r.establishments || []))
      .finally(() => setLoading(false));
  }, [query]);

  const filteredItems = useMemo(() => {
    if (!filters.roomType) return items;
    const token = filters.roomType.toLowerCase();
    return items.filter((i) => i.tags.some((t) => t.toLowerCase().includes(token)));
  }, [items, filters.roomType]);

  return (
    <div className="space-y-4">
      <section className="rounded-3xl border border-fuchsia-200/20 bg-gradient-to-br from-[#2f0b4b]/95 via-[#25083f]/95 to-[#170327]/95 p-4 md:p-5 shadow-[0_0_0_1px_rgba(255,255,255,0.05),0_30px_80px_rgba(145,39,255,0.25)]">
        <h1 className="text-3xl font-semibold text-white">Encuentra una habitación cerca de ti</h1>
        <p className="mt-1 text-white/75">Reserva por horas o noche completa.</p>

        <div className="mt-4 grid gap-3 md:grid-cols-3">
          <label className="text-xs text-white/75">
            Duración
            <select className="input mt-1" value={filters.duration} onChange={(e) => setFilters((f) => ({ ...f, duration: e.target.value }))}>
              <option value="3H">3 horas</option>
              <option value="6H">6 horas</option>
              <option value="NIGHT">Noche</option>
            </select>
          </label>

          <label className="text-xs text-white/75">
            Tipo de habitación
            <select className="input mt-1" value={filters.roomType} onChange={(e) => setFilters((f) => ({ ...f, roomType: e.target.value }))}>
              {roomTypeTags.map((t) => <option key={t || "all"} value={t}>{t || "Todas"}</option>)}
            </select>
          </label>

          <label className="flex items-end pb-2 text-sm text-white/90 gap-2">
            <input type="checkbox" checked={filters.onlyPromos} onChange={(e) => setFilters((f) => ({ ...f, onlyPromos: e.target.checked }))} />
            Solo promociones
          </label>
        </div>
      </section>

      <section className="grid gap-4 lg:grid-cols-[1.08fr_1fr]">
        <div className="order-1 rounded-3xl border border-white/10 bg-white/5 p-3 backdrop-blur">
          <div className="px-1 pb-2 text-2xl font-semibold">Mapa</div>
          <MapboxMap
            userLocation={location}
            markers={filteredItems
              .filter((i) => i.latitude != null && i.longitude != null)
              .map((i) => ({
                id: i.id,
                name: `${i.name} · $${Math.round(i.fromPrice / 1000)}k`,
                lat: Number(i.latitude),
                lng: Number(i.longitude),
                subtitle: i.address,
                href: `/hospedaje/${i.id}`,
              }))}
          />
        </div>

        <div className="order-2 rounded-3xl border border-white/10 bg-white/5 p-3 backdrop-blur">
          <div className="space-y-3 max-h-[70vh] overflow-auto pr-1">
            {loading ? <div className="rounded-2xl border border-white/10 bg-white/5 p-4 text-white/70">Buscando habitaciones disponibles...</div> : filteredItems.map((e) => (
              <Link key={e.id} href={`/hospedaje/${e.id}?duration=${filters.duration}`} className="group block rounded-2xl border border-white/15 bg-gradient-to-b from-white/10 to-white/5 p-3 hover:border-fuchsia-300/40">
                <div className="flex gap-3">
                  <img src={resolveMediaUrl(e.coverUrl) || "/brand/isotipo-new.png"} alt={e.name} className="h-24 w-28 rounded-xl border border-white/10 object-cover" />
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-3xl font-semibold leading-tight">{e.name}</div>
                    <div className="mt-1 text-sm text-white/85">${e.fromPrice.toLocaleString("es-CL")} · {filters.duration === "NIGHT" ? "noche" : filters.duration.toLowerCase()}</div>
                    <div className="mt-1 flex items-center gap-2 text-xs text-white/70"><MapPin className="h-3.5 w-3.5" />{e.distance != null ? `${e.distance.toFixed(1)} km` : "Sin distancia"}</div>
                    <div className="text-xs text-white/70 inline-flex items-center gap-1"><Star className="h-3.5 w-3.5 fill-yellow-400 text-yellow-400" /> {e.rating ?? "N/A"} ({e.reviewsCount})</div>
                    <div className="mt-2 flex items-center justify-between">
                      <div className="flex flex-wrap gap-1">{e.tags.slice(0, 3).map((tag) => <span key={tag} className="rounded-full border border-white/15 bg-white/5 px-2 py-0.5 text-[11px]">{tag}</span>)}</div>
                      <span className="btn-primary text-sm">Ver habitaciones</span>
                    </div>
                  </div>
                </div>
              </Link>
            ))}
            {!loading && !filteredItems.length ? <div className="rounded-2xl border border-fuchsia-300/20 bg-fuchsia-500/10 p-4 text-sm text-fuchsia-100">Sin resultados por ahora. Prueba otra duración o tipo de habitación.</div> : null}
          </div>
        </div>
      </section>
    </div>
  );
}
