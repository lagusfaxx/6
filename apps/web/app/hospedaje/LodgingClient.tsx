"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { MapPin } from "lucide-react";
import MapboxMap from "../../components/MapboxMap";
import StarRating from "../../components/StarRating";
import SkeletonCard from "../../components/SkeletonCard";
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
  category?: "MOTEL" | "HOTEL";
  isOpen?: boolean;
};

export default function LodgingClient() {
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);
  const [type, setType] = useState<"ALL" | "MOTEL" | "HOTEL">("ALL");
  const { location } = useMapLocation([-33.45, -70.66]);

  const query = useMemo(() => {
    const p = new URLSearchParams();
    p.set("duration", "3H");
    if (location) {
      p.set("lat", String(location[0]));
      p.set("lng", String(location[1]));
    }
    if (type !== "ALL") p.set("category", type.toLowerCase());
    return p.toString();
  }, [location, type]);

  useEffect(() => {
    setLoading(true);
    apiFetch<{ establishments: Item[] }>(`/motels?${query}`)
      .then((r) => setItems(r.establishments || []))
      .finally(() => setLoading(false));
  }, [query]);

  return (
    <div className="space-y-4">
      <section className="rounded-3xl border border-fuchsia-200/20 bg-gradient-to-br from-[#2f0b4b]/95 via-[#25083f]/95 to-[#170327]/95 p-4 md:p-5">
        <h1 className="text-3xl font-semibold text-white">Hospedajes disponibles</h1>
        <p className="mt-1 text-white/75">Lista y mapa de moteles/hoteles publicados.</p>
        <div className="mt-3 flex gap-2">
          {(["ALL", "MOTEL", "HOTEL"] as const).map((chip) => (
            <button key={chip} className={`rounded-full border px-3 py-1.5 text-sm ${chip === type ? "border-fuchsia-300 bg-fuchsia-500/25" : "border-white/20"}`} onClick={() => setType(chip)}>{chip === "ALL" ? "Todos" : chip}</button>
          ))}
        </div>
      </section>

      <section className="grid gap-4 lg:grid-cols-[1.08fr_1fr]">
        <div className="rounded-3xl border border-white/10 bg-white/5 p-3">
          <div className="px-1 pb-2 text-2xl font-semibold">Mapa</div>
          <MapboxMap
            userLocation={location}
            markers={items
              .filter((i) => i.latitude != null && i.longitude != null)
              .map((i) => ({ id: i.id, name: i.name, lat: Number(i.latitude), lng: Number(i.longitude), subtitle: i.address, href: `/hospedaje/${i.id}` }))}
          />
        </div>

        <div className="rounded-3xl border border-white/10 bg-white/5 p-3">
          <div className="space-y-3 max-h-[70vh] overflow-auto pr-1">
            {loading ? (
              <div className="space-y-3">
                {[1, 2, 3].map((i) => (
                  <SkeletonCard key={i} className="h-32" />
                ))}
              </div>
            ) : items.map((e) => (
              <Link key={e.id} href={`/hospedaje/${e.id}`} className="group block rounded-2xl border border-white/15 bg-gradient-to-b from-white/10 to-white/5 p-3 transition-all duration-200 hover:border-fuchsia-300/40 hover:shadow-lg hover:shadow-fuchsia-500/5">
                <div className="flex gap-3">
                  <div className="relative overflow-hidden rounded-xl">
                    <img src={resolveMediaUrl(e.coverUrl) || "/brand/isotipo-new.png"} alt={e.name} className="h-24 w-28 border border-white/10 object-cover transition-transform duration-300 group-hover:scale-105" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-2xl font-semibold leading-tight group-hover:text-fuchsia-100 transition-colors">{e.name}</div>
                    <div className="mt-1 text-sm font-medium text-fuchsia-200">Desde ${e.fromPrice.toLocaleString("es-CL")}</div>
                    <div className="mt-1 flex items-center gap-2 text-xs text-white/70"><MapPin className="h-3.5 w-3.5" />{e.distance != null ? `${e.distance.toFixed(1)} km` : e.address}</div>
                    <div className="mt-0.5 inline-flex items-center gap-1 text-xs text-white/70">
                      <StarRating rating={e.rating} size={12} />
                      <span className="text-white/50">({e.reviewsCount})</span>
                    </div>
                    <div className="mt-2 flex items-center justify-between">
                      <span className={`rounded-full border px-2 py-0.5 text-[11px] font-medium ${e.isOpen ? "border-emerald-300/40 bg-emerald-500/20 text-emerald-100" : "border-rose-300/40 bg-rose-500/20 text-rose-100"}`}>{e.isOpen ? "Abierto ahora" : "Cerrado"}</span>
                      <span className="btn-primary text-sm">Reservar</span>
                    </div>
                  </div>
                </div>
              </Link>
            ))}
            {!loading && !items.length ? <div className="rounded-2xl border border-fuchsia-300/20 bg-fuchsia-500/10 p-4 text-sm text-fuchsia-100">No hay hospedajes publicados con ubicación válida.</div> : null}
          </div>
        </div>
      </section>
    </div>
  );
}
