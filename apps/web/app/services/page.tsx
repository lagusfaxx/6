"use client";

import { useEffect, useState } from "react";
import useMe from "../../hooks/useMe";
import Link from "next/link";
import MapboxMap from "../../components/MapboxMap";
import { apiFetch } from "../../lib/api";
import Avatar from "../../components/Avatar";
import { useMapLocation } from "../../hooks/useMapLocation";

type CardItem = {
  id: string;
  name: string;
  subtitle: string;
  href: string;
  image?: string | null;
  lat?: number | null;
  lng?: number | null;
  tier?: string | null;
  areaRadiusM?: number | null;
  distance?: number | null;
  category?: string | null;
};

const DEFAULT_LOCATION: [number, number] = [-33.45, -70.66];

export default function ServicesPage() {
  const { location } = useMapLocation(DEFAULT_LOCATION);

  const { me, loading: meLoading } = useMe();
  const role = String(me?.user?.role || "").toUpperCase();
  const ptype = String(me?.user?.profileType || "").toUpperCase();
  const isMotel = ptype === "ESTABLISHMENT" || role === "MOTEL" || role === "MOTEL_OWNER";

  useEffect(() => {
    if (meLoading) return;
    if (isMotel) {
      window.location.href = "/dashboard/motel";
    }
  }, [isMotel, meLoading]);
  const [cards, setCards] = useState<CardItem[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setLoading(true);
    (async () => {
      try {
        const params = new URLSearchParams();
        if (location) {
          params.set("lat", String(location[0]));
          params.set("lng", String(location[1]));
        }

        const query = params.toString();
        const res = await apiFetch<{ services: any[] }>(`/services/global${query ? `?${query}` : ""}`);
        const items = (res?.services || []).map((svc) => {
          const owner = svc.owner || {};
          const href =
            owner.profileType === "ESTABLISHMENT"
              ? `/establecimiento/${owner.id}`
              : owner.profileType === "SHOP"
                ? `/sexshop/${owner.username}`
                : `/profesional/${owner.id}`;

          const subtitleParts: string[] = [];
          if (svc.category) subtitleParts.push(String(svc.category));
          if (svc.price != null) subtitleParts.push(`$${Number(svc.price).toLocaleString("es-CL")}`);
          if (svc.distance != null) subtitleParts.push(`~${Number(svc.distance).toFixed(1)} km`);

          return {
            id: svc.id,
            name: svc.title || owner.displayName || owner.username || "Servicio",
            subtitle: subtitleParts.filter(Boolean).join(" • ") || "Disponible",
            href,
            image: owner.avatarUrl,
            lat: svc.latitude,
            lng: svc.longitude,
            areaRadiusM: svc.approxAreaM ?? 600,
            distance: svc.distance ?? null,
            category: svc.category ?? null
          } as CardItem;
        });

        setCards(items.sort((a, b) => (a.distance ?? 1e9) - (b.distance ?? 1e9)));
      } catch (error) {
        console.error("Error fetching services:", error);
      } finally {
        setLoading(false);
      }
    })();
  }, [location]);

  return (
    <main className="min-h-[calc(100vh-64px)] px-4 py-8">
      <div className="mx-auto w-full max-w-6xl">
        <h1 className="text-2xl font-semibold tracking-tight">Explorar servicios</h1>
        <p className="mt-2 text-sm text-white/70">Aquí se muestran todos los servicios activos de la app.</p>

        <section className="mt-6 rounded-2xl border border-white/10 bg-white/5 p-4">
          <div>
            <h2 className="text-base font-semibold">Mapa global de servicios</h2>
            <p className="text-xs text-white/60 mt-1">Listado general sin filtros ni categoría.</p>
          </div>

          <div className="mt-4">
            <MapboxMap
              userLocation={location}
              markers={cards
                .filter((c) => c.lat != null && c.lng != null)
                .map((c) => ({
                  id: c.id,
                  name: c.name,
                  lat: Number(c.lat),
                  lng: Number(c.lng),
                  subtitle: c.category || "Servicio",
                  href: c.href,
                  avatarUrl: c.image,
                  tier: c.tier,
                  areaRadiusM: c.areaRadiusM ?? undefined
                }))}
              height={380}
            />
          </div>

          <div className="mt-5">
            <h3 className="text-sm font-semibold text-white/80">Todos los servicios</h3>
            {loading ? (
              <div className="mt-3 text-white/60">Cargando resultados...</div>
            ) : cards.length ? (
              <div className="mt-3 grid gap-3 md:grid-cols-2">
                {cards.map((item) => (
                  <Link
                    key={item.id}
                    href={item.href}
                    className="rounded-2xl border border-white/10 bg-white/5 p-4 transition hover:border-white/30"
                  >
                    <div className="flex items-center gap-3">
                      <Avatar src={item.image} alt={item.name} size={48} />
                      <div>
                        <div className="text-sm font-medium">{item.name}</div>
                        <div className="text-xs text-white/70">{item.subtitle}</div>
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            ) : (
              <div className="mt-3 text-sm text-white/60">No hay servicios activos disponibles por ahora.</div>
            )}
          </div>
        </section>
      </div>
    </main>
  );
}
