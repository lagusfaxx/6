"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import MapboxMap from "../../components/MapboxMap";
import { apiFetch } from "../../lib/api";
import Avatar from "../../components/Avatar";
import { useMapLocation } from "../../hooks/useMapLocation";

type Category = { id: string; name: string; slug: string; displayName: string; kind: "PROFESSIONAL" | "ESTABLISHMENT" | "SHOP" };
function displayCategoryName(category: Category) {
  return category.displayName || category.name;
}

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
};

const DEFAULT_LOCATION: [number, number] = [-33.45, -70.66];

export default function ServicesPage() {
  const [categories, setCategories] = useState<Category[]>([]);
  const { location } = useMapLocation(DEFAULT_LOCATION);
  const [selectedKind, setSelectedKind] = useState<Category["kind"]>("PROFESSIONAL");
  const [selectedCategory, setSelectedCategory] = useState<string>("");
  const [cards, setCards] = useState<CardItem[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    apiFetch<Category[]>("/categories").then((res) => setCategories(Array.isArray(res) ? res : [])).catch(() => setCategories([]));
  }, []);

  useEffect(() => {
    if (!categories.length) return;
    const first = categories.find((c) => c.kind === selectedKind);
    if (first) setSelectedCategory(first.slug || first.id);
  }, [categories, selectedKind]);

  useEffect(() => {
    if (!selectedCategory) return;
    setLoading(true);
    (async () => {
      try {
        const params = new URLSearchParams({ category: selectedCategory });
        if (location) {
          params.set("lat", String(location[0]));
          params.set("lng", String(location[1]));
        }

        if (selectedKind === "PROFESSIONAL") {
          const res = await apiFetch<{ professionals: any[] }>(`/professionals?${params.toString()}`);
          const items = (res?.professionals || []).map((p) => ({
            id: p.id,
            name: p.name,
            subtitle: p.distance != null ? `~${p.distance.toFixed(1)} km` : "Disponible",
            href: `/profesional/${p.id}`,
            image: p.avatarUrl,
            lat: p.latitude,
            lng: p.longitude,
            tier: p.tier,
            areaRadiusM: p.approxAreaM ?? 600,
            distance: p.distance ?? null
          }));
          setCards(items.sort((a, b) => (a.distance ?? 1e9) - (b.distance ?? 1e9)));
        } else if (selectedKind === "ESTABLISHMENT") {
          const res = await apiFetch<{ establishments: any[] }>(`/establishments?${params.toString()}`);
          const items = (res?.establishments || []).map((e) => ({
            id: e.id,
            name: e.name,
            subtitle: e.distance != null ? `~${e.distance.toFixed(1)} km` : e.city || "Lugar",
            href: `/establecimiento/${e.id}`,
            image: e.gallery?.[0] || null,
            lat: e.latitude,
            lng: e.longitude,
            distance: e.distance ?? null
          }));
          setCards(items.sort((a, b) => (a.distance ?? 1e9) - (b.distance ?? 1e9)));
        } else {
          const res = await apiFetch<{ shops: any[] }>(`/shop/sexshops?${params.toString()}`);
          const items = (res?.shops || []).map((s) => ({
            id: s.id,
            name: s.name,
            subtitle: s.distance != null ? `~${s.distance.toFixed(1)} km` : s.city || "Tienda",
            href: `/sexshop/${s.username}`,
            image: s.avatarUrl,
            lat: s.latitude,
            lng: s.longitude,
            distance: s.distance ?? null
          }));
          setCards(items.sort((a, b) => (a.distance ?? 1e9) - (b.distance ?? 1e9)));
        }
      } catch {
        setCards([]);
      } finally {
        setLoading(false);
      }
    })();
  }, [selectedKind, selectedCategory, location]);

  const grouped = useMemo(() => {
    const map = { PROFESSIONAL: [] as Category[], ESTABLISHMENT: [] as Category[], SHOP: [] as Category[] };
    categories.forEach((c) => map[c.kind].push(c));
    return map;
  }, [categories]);

  const selectedCategoryLabel = useMemo(() => {
    const match = categories.find((c) => (c.slug || c.id) === selectedCategory);
    return match ? displayCategoryName(match) : "Categoría";
  }, [categories, selectedCategory]);

  return (
    <main className="min-h-[calc(100vh-64px)] px-4 py-8">
      <div className="mx-auto w-full max-w-6xl">
        <h1 className="text-2xl font-semibold tracking-tight">Explorar servicios</h1>
        <p className="mt-2 text-sm text-white/70">Acceso directo a categorías y perfiles activos para búsquedas más específicas.</p>

        <section className="mt-6 rounded-2xl border border-white/10 bg-white/5 p-4">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <h2 className="text-base font-semibold">Mapa global de servicios</h2>
              <p className="text-xs text-white/60 mt-1">Filtra por tipo y categoría para explorar en el mapa.</p>
            </div>
            <div className="flex flex-wrap gap-3">
              <label className="grid gap-2 text-xs text-white/60">
                Tipo
                <select
                  value={selectedKind}
                  onChange={(e) => setSelectedKind(e.target.value as Category["kind"])}
                  className="input"
                >
                  <option value="PROFESSIONAL">Experiencias</option>
                  <option value="ESTABLISHMENT">Lugares</option>
                  <option value="SHOP">Tiendas</option>
                </select>
              </label>
              <label className="grid gap-2 text-xs text-white/60">
                Categoría
                <select
                  value={selectedCategory}
                  onChange={(e) => setSelectedCategory(e.target.value)}
                  className="input"
                >
                  {grouped[selectedKind].length ? (
                    grouped[selectedKind].map((cat) => (
                      <option key={cat.id} value={cat.slug || cat.id}>
                        {displayCategoryName(cat)}
                      </option>
                    ))
                  ) : (
                    <option value="">Sin categorías disponibles</option>
                  )}
                </select>
              </label>
            </div>
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
                subtitle: selectedCategoryLabel,
                href: c.href,
                avatarUrl: c.image,
                tier: c.tier,
                areaRadiusM: c.areaRadiusM ?? undefined
              }))}
              height={380}
            />
          </div>

          <div className="mt-5">
            <h3 className="text-sm font-semibold text-white/80">
              Resultados para {selectedCategoryLabel}
            </h3>
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
              <div className="mt-3 text-sm text-white/60">No encontramos resultados para esta categoría por ahora.</div>
            )}
          </div>
        </section>
      </div>
    </main>
  );
}
