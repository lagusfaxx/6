"use client";

import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { apiFetch, resolveMediaUrl } from "../../lib/api";
import ClientMap from "../../components/ClientMap";

const tiers = ["PREMIUM", "GOLD", "SILVER"] as const;
const genders = ["FEMALE", "MALE", "OTHER"] as const;

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
  category: { id: string; name: string; displayName?: string | null; kind: string } | null;
};

export default function ProfessionalsClient() {
  const searchParams = useSearchParams();
  const category = searchParams.get("category") || "";

  const [rangeKm, setRangeKm] = useState("15");
  const [gender, setGender] = useState("");
  const [tier, setTier] = useState("");
  const [location, setLocation] = useState<[number, number] | null>(null);
  const [items, setItems] = useState<Professional[]>([]);
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
    if (gender) params.set("gender", gender);
    if (tier) params.set("tier", tier);
    if (location) {
      params.set("lat", String(location[0]));
      params.set("lng", String(location[1]));
    }
    return params.toString();
  }, [category, rangeKm, gender, tier, location]);

  useEffect(() => {
    setLoading(true);
    apiFetch<{ professionals: Professional[] }>(`/professionals?${queryString}`)
      .then((res) => setItems(res.professionals))
      .finally(() => setLoading(false));
  }, [queryString]);

  return (
    <div className="grid gap-6">
      <div className="card p-6">
        <h1 className="text-2xl font-semibold">Búsqueda de experiencias</h1>
        <p className="mt-2 text-sm text-white/70">
          Filtra por distancia, género y tier. Los perfiles inactivos se muestran atenuados.
        </p>
        <div className="mt-6 grid gap-3 md:grid-cols-3">
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
            Género
            <select value={gender} onChange={(e) => setGender(e.target.value)} className="input">
              <option value="">Todos</option>
              {genders.map((g) => (
                <option key={g} value={g}>
                  {g}
                </option>
              ))}
            </select>
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
      </div>
      <div className="card p-0 overflow-hidden">
        <div className="p-6 border-b border-white/10">
          <h2 className="text-lg font-semibold">Mapa</h2>
          <p className="mt-1 text-sm text-white/70">
            Vista por ubicación. Si autorizas GPS, ordenamos por distancia y centramos el mapa.
          </p>
        </div>
        <div className="p-3">
          <ClientMap
            userLocation={location}
            markers={items
              .filter((p) => p.latitude != null && p.longitude != null)
              .map((p) => ({
                id: p.id,
                name: p.name,
                lat: Number(p.latitude),
                lng: Number(p.longitude),
                subtitle: p.category?.displayName || p.category?.name || null,
              }))}
          />
        </div>
      </div>


      {loading ? (
        <div className="text-white/60">Cargando experiencias...</div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {items.map((p) => (
            <Link
              key={p.id}
              href={`/profesional/${p.id}`}
              className={`rounded-2xl border border-white/10 bg-white/5 p-5 transition hover:border-white/30 ${
                p.isActive ? "" : "opacity-60 grayscale"
              }`}
            >
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
              <div className="mt-3 flex flex-wrap gap-3 text-xs text-white/60">
                <span>⭐ {p.rating ?? "N/A"}</span>
                <span>{p.distance ? `${p.distance.toFixed(1)} km` : "Sin distancia"}</span>
                {p.tier ? <span>{p.tier}</span> : null}
              </div>
            </Link>
          ))}
          {!items.length ? (
            <div className="card p-6 text-white/60">No encontramos experiencias con estos filtros.</div>
          ) : null}
        </div>
      )}
    </div>
  );
}
