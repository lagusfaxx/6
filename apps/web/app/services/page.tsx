"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import ClientMap from "../../components/ClientMap";
import { apiFetch, resolveMediaUrl } from "../../lib/api";

type Category = { id: string; name: string; kind: "PROFESSIONAL" | "ESTABLISHMENT" | "SHOP" };
function displayCategoryName(name: string) {
  return name.trim().toLowerCase() === "spas" ? "Cafes" : name;
}

type CardItem = {
  id: string;
  name: string;
  subtitle: string;
  href: string;
  image?: string | null;
  lat?: number | null;
  lng?: number | null;
};

export default function ServicesPage() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [location, setLocation] = useState<[number, number] | null>(null);
  const [cardsByCategory, setCardsByCategory] = useState<Record<string, CardItem[]>>({});
  const [markers, setMarkers] = useState<Array<{ id: string; name: string; lat: number; lng: number; subtitle?: string | null }>>([]);

  useEffect(() => {
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      (pos) => setLocation([pos.coords.latitude, pos.coords.longitude]),
      () => null,
      { enableHighAccuracy: true, timeout: 6000 }
    );
  }, []);

  useEffect(() => {
    apiFetch<Category[]>("/categories").then((res) => setCategories(Array.isArray(res) ? res : [])).catch(() => setCategories([]));
  }, []);

  useEffect(() => {
    if (!categories.length) return;
    (async () => {
      const next: Record<string, CardItem[]> = {};
      const nextMarkers: Array<{ id: string; name: string; lat: number; lng: number; subtitle?: string | null }> = [];

      for (const c of categories) {
        try {
          const params = new URLSearchParams({ categoryId: c.id });
          if (location) {
            params.set("lat", String(location[0]));
            params.set("lng", String(location[1]));
          }

          if (c.kind === "PROFESSIONAL") {
            const res = await apiFetch<{ professionals: any[] }>(`/professionals?${params.toString()}`);
            const items = (res?.professionals || []).slice(0, 10).map((p) => ({
              id: p.id,
              name: p.name,
              subtitle: p.distance != null ? `~${p.distance.toFixed(1)} km` : "Disponible",
              href: `/profesional/${p.id}`,
              image: p.avatarUrl,
              lat: p.latitude,
              lng: p.longitude
            }));
            next[c.id] = items;
            items.forEach((i) => {
              if (i.lat != null && i.lng != null) nextMarkers.push({ id: `${c.id}-${i.id}`, name: i.name, lat: Number(i.lat), lng: Number(i.lng), subtitle: displayCategoryName(c.name) });
            });
          } else if (c.kind === "ESTABLISHMENT") {
            const res = await apiFetch<{ establishments: any[] }>(`/establishments?${params.toString()}`);
            const items = (res?.establishments || []).slice(0, 10).map((e) => ({
              id: e.id,
              name: e.name,
              subtitle: e.distance != null ? `~${e.distance.toFixed(1)} km` : e.city || "Establecimiento",
              href: `/establecimiento/${e.id}`,
              image: e.gallery?.[0] || null,
              lat: e.latitude,
              lng: e.longitude
            }));
            next[c.id] = items;
            items.forEach((i) => {
              if (i.lat != null && i.lng != null) nextMarkers.push({ id: `${c.id}-${i.id}`, name: i.name, lat: Number(i.lat), lng: Number(i.lng), subtitle: displayCategoryName(c.name) });
            });
          } else {
            const res = await apiFetch<{ shops: any[] }>(`/shop/sexshops?${params.toString()}`);
            const items = (res?.shops || []).slice(0, 10).map((s) => ({
              id: s.id,
              name: s.name,
              subtitle: s.distance != null ? `~${s.distance.toFixed(1)} km` : s.city || "Tienda",
              href: `/sexshop/${s.username}`,
              image: s.avatarUrl,
              lat: s.latitude,
              lng: s.longitude
            }));
            next[c.id] = items;
            items.forEach((i) => {
              if (i.lat != null && i.lng != null) nextMarkers.push({ id: `${c.id}-${i.id}`, name: i.name, lat: Number(i.lat), lng: Number(i.lng), subtitle: displayCategoryName(c.name) });
            });
          }
        } catch {
          next[c.id] = [];
        }
      }

      setCardsByCategory(next);
      setMarkers(nextMarkers);
    })();
  }, [categories, location]);

  const grouped = useMemo(() => {
    const map = { PROFESSIONAL: [] as Category[], ESTABLISHMENT: [] as Category[], SHOP: [] as Category[] };
    categories.forEach((c) => map[c.kind].push(c));
    return map;
  }, [categories]);

  return (
    <main className="min-h-[calc(100vh-64px)] px-4 py-8">
      <div className="mx-auto w-full max-w-6xl">
        <h1 className="text-3xl font-semibold tracking-tight">Servicios</h1>
        <p className="mt-2 text-sm text-white/80">Acceso directo global por categorías y mapa con ubicaciones aproximadas.</p>

        {(["PROFESSIONAL", "ESTABLISHMENT", "SHOP"] as const).map((kind) => (
          <section key={kind} className="mt-8">
            <h2 className="text-2xl font-semibold mb-3">{kind === "PROFESSIONAL" ? "Profesionales" : kind === "ESTABLISHMENT" ? "Establecimientos" : "Tiendas"}</h2>
            <div className="grid gap-6">
              {grouped[kind].map((cat) => (
                <div key={cat.id} className="rounded-2xl border border-white/10 bg-white/5 p-4">
                  <div className="mb-3 flex items-center justify-between">
                    <h3 className="font-semibold">{displayCategoryName(cat.name)}</h3>
                    <Link href={kind === "PROFESSIONAL" ? `/profesionales?categoryId=${cat.id}` : kind === "ESTABLISHMENT" ? `/establecimientos?categoryId=${cat.id}` : `/sexshops?categoryId=${cat.id}`} className="text-xs text-white/70 underline">
                      Ver todo
                    </Link>
                  </div>
                  <div className="flex gap-3 overflow-x-auto pb-2">
                    {(cardsByCategory[cat.id] || []).map((item) => (
                      <Link key={item.id} href={item.href} className="min-w-[220px] max-w-[220px] rounded-xl border border-white/15 bg-black/20 p-3 hover:bg-black/30 transition">
                        <div className="h-28 overflow-hidden rounded-lg border border-white/10 bg-white/5">
                          {item.image ? <img src={resolveMediaUrl(item.image) || ""} alt={item.name} className="h-full w-full object-cover" /> : <div className="grid h-full place-items-center text-xs text-white/50">Sin imagen</div>}
                        </div>
                        <div className="mt-2 font-medium line-clamp-1">{item.name}</div>
                        <div className="text-xs text-white/70">{item.subtitle}</div>
                      </Link>
                    ))}
                    {!cardsByCategory[cat.id]?.length ? <div className="text-sm text-white/60">Sin resultados para esta categoría por ahora.</div> : null}
                  </div>
                </div>
              ))}
            </div>
          </section>
        ))}

        <section className="mt-10 rounded-2xl border border-white/10 bg-white/5 p-4">
          <h2 className="text-xl font-semibold">Mapa global de servicios</h2>
          <p className="text-xs text-white/60 mt-1">Incluye profesionales, establecimientos y tiendas con ubicación aproximada.</p>
          <div className="mt-3">
            <ClientMap userLocation={location} markers={markers} height={420} />
          </div>
        </section>
      </div>
    </main>
  );
}