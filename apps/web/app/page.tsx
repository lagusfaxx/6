"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { apiFetch, resolveMediaUrl } from "../lib/api";
import {
  BedDouble,
  Building2,
  Dumbbell,
  GlassWater,
  Heart,
  Hotel,
  MapPin,
  Sparkles,
  Store,
  Stethoscope,
  Users,
  WandSparkles
} from "lucide-react";

type Category = {
  id: string;
  name: string;
  kind: "PROFESSIONAL" | "ESTABLISHMENT" | "SHOP";
};

type Banner = {
  id: string;
  title: string;
  imageUrl: string;
  linkUrl?: string | null;
  position: string;
};

type RecentProfessional = {
  id: string;
  name: string;
  avatarUrl: string | null;
  distance: number | null;
  description: string | null;
};

function kindLabel(kind: Category["kind"]) {
  if (kind === "PROFESSIONAL") return "Profesionales";
  if (kind === "ESTABLISHMENT") return "Establecimientos";
  return "Tiendas";
}

function kindHref(kind: Category["kind"], categoryId: string) {
  if (kind === "PROFESSIONAL") return `/profesionales?categoryId=${encodeURIComponent(categoryId)}`;
  if (kind === "ESTABLISHMENT") return `/establecimientos?categoryId=${encodeURIComponent(categoryId)}`;
  return `/sexshops?categoryId=${encodeURIComponent(categoryId)}`;
}

function ageFromDescription(desc?: string | null): string | null {
  const m = (desc || "").match(/^\[edad:(\d{1,2})\]/i);
  return m?.[1] || null;
}

function categoryIcon(kind: Category["kind"], name: string) {
  const n = name.toLowerCase();
  if (kind === "PROFESSIONAL") {
    if (n.includes("masaj")) return Heart;
    if (n.includes("bienestar")) return Dumbbell;
    if (n.includes("acompa")) return Users;
    return WandSparkles;
  }
  if (kind === "ESTABLISHMENT") {
    if (n.includes("hotel")) return Hotel;
    if (n.includes("spa")) return Stethoscope;
    if (n.includes("privad") || n.includes("motel")) return BedDouble;
    return Building2;
  }
  if (n.includes("shop") || n.includes("tienda")) return Store;
  if (n.includes("club")) return GlassWater;
  return Store;
}

export default function HomePage() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [banners, setBanners] = useState<Banner[]>([]);
  const [recentPros, setRecentPros] = useState<RecentProfessional[]>([]);
  const [location, setLocation] = useState<[number, number] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      (pos) => setLocation([pos.coords.latitude, pos.coords.longitude]),
      () => null,
      { enableHighAccuracy: true, timeout: 6000 }
    );
  }, []);

  useEffect(() => {
    (async () => {
      try {
        const cats = await apiFetch<Category[]>("/categories");
        setCategories(Array.isArray(cats) ? cats : []);
      } catch {
        setError("No se pudieron cargar las categorías.");
      }
      try {
        const res = await apiFetch<{ banners: Banner[] }>("/banners");
        setBanners(res?.banners ?? []);
      } catch {
        // banners opcionales
      }
    })();
  }, []);

  useEffect(() => {
    const params = new URLSearchParams();
    params.set("types", "PROFESSIONAL");
    if (location) {
      params.set("lat", String(location[0]));
      params.set("lng", String(location[1]));
    }
    apiFetch<{ profiles: any[] }>(`/services?${params.toString()}`)
      .then((res) => {
        const mapped: RecentProfessional[] = (res?.profiles || []).slice(0, 20).map((p) => ({
          id: p.id,
          name: p.displayName || p.username || "Profesional",
          avatarUrl: p.avatarUrl || null,
          distance: typeof p.distance === "number" ? p.distance : null,
          description: p.bio || p.serviceDescription || null
        }));
        setRecentPros(mapped);
      })
      .catch(() => null);
  }, [location]);

  const grouped = useMemo(() => {
    const by = { PROFESSIONAL: [] as Category[], ESTABLISHMENT: [] as Category[], SHOP: [] as Category[] };
    for (const c of categories) by[c.kind].push(c);
    return by;
  }, [categories]);

  const inlineBanners = useMemo(() => banners.filter((b) => (b.position || "").toUpperCase() === "INLINE"), [banners]);

  return (
    <div className="min-h-screen text-white antialiased">
      <div className="mx-auto max-w-[1250px] px-4 py-6">
        <section className="rounded-3xl border border-white/10 bg-gradient-to-b from-[#5a56a9]/70 via-[#6e5cc0]/50 to-[#ef3f97]/40 p-5 md:p-8">
          <div className="flex items-center gap-3">
            <img src="/brand/isotipo.png" alt="Uzeed" className="h-12 w-12 rounded-2xl border border-white/20 bg-white/10 object-cover" />
            <div>
              <div className="text-xs uppercase tracking-[0.2em] text-white/80">Uzeed</div>
              <h1 className="mt-1 text-2xl md:text-4xl font-semibold">¿Qué estás buscando?</h1>
            </div>
          </div>
        </section>

        {error ? <div className="mt-4 rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-red-100">{error}</div> : null}

        {inlineBanners.length ? (
          <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {inlineBanners.slice(0, 4).map((b) => (
              <a key={b.id} href={b.linkUrl ?? "#"} className="block overflow-hidden rounded-2xl border border-white/10 bg-white/5 hover:bg-white/10 transition">
                <img src={b.imageUrl} alt={b.title} className="h-28 w-full object-cover" />
                <div className="p-3 text-sm text-white/80">{b.title}</div>
              </a>
            ))}
          </div>
        ) : null}

        <main className="mt-6 grid gap-8">
          {(["PROFESSIONAL", "ESTABLISHMENT", "SHOP"] as const).map((kind) => {
            const items = grouped[kind];
            return (
              <section key={kind}>
                <div className="mb-3 flex items-center justify-between">
                  <h2 className="text-lg md:text-3xl font-semibold">{kindLabel(kind)}</h2>
                  <Link className="text-sm md:text-xl text-white/80 hover:text-white" href={kind === "PROFESSIONAL" ? "/profesionales" : kind === "ESTABLISHMENT" ? "/establecimientos" : "/sexshops"}>
                    Ver todas
                  </Link>
                </div>

                <div className="grid gap-3">
                  {items.length ? items.map((c) => {
                    const Icon = categoryIcon(c.kind, c.name);
                    return (
                      <Link
                        key={c.id}
                        href={kindHref(c.kind, c.id)}
                        className="group flex items-center justify-between rounded-2xl border border-fuchsia-300/30 bg-gradient-to-r from-[#2c3a8f]/90 to-[#ec3f97]/85 p-4 shadow-[0_4px_20px_rgba(0,0,0,0.25)] hover:brightness-110 transition"
                      >
                        <div className="flex items-center gap-3">
                          <div className="flex h-12 w-12 items-center justify-center rounded-xl border border-white/30 bg-white/15">
                            <Icon className="h-5 w-5 text-white" />
                          </div>
                          <div>
                            <div className="text-base md:text-3xl font-semibold">{c.name}</div>
                          </div>
                        </div>
                        <Sparkles className="h-5 w-5 text-white/80 group-hover:text-white transition" />
                      </Link>
                    );
                  }) : kind === "SHOP" ? (
                    <Link href="/sexshops" className="rounded-2xl border border-white/15 bg-white/5 p-4 text-white/80 hover:bg-white/10 transition">
                      Aún no hay categorías de tiendas cargadas. Toca aquí para explorar tiendas activas.
                    </Link>
                  ) : (
                    <div className="rounded-2xl border border-white/10 bg-white/5 p-4 text-white/70">No hay categorías disponibles.</div>
                  )}
                </div>
              </section>
            );
          })}

          <section>
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-lg md:text-3xl font-semibold">Profesionales recién agregadas</h2>
              <Link href="/profesionales" className="text-sm md:text-xl text-white/80 hover:text-white">Ver todas</Link>
            </div>

            <div className="flex gap-3 overflow-x-auto pb-2 [scrollbar-width:thin]">
              {recentPros.length ? recentPros.map((p) => {
                const age = ageFromDescription(p.description);
                return (
                  <Link key={p.id} href={`/profesional/${p.id}`} className="min-w-[240px] max-w-[240px] rounded-2xl border border-white/15 bg-white/5 p-3 hover:bg-white/10 transition">
                    <div className="h-40 overflow-hidden rounded-xl border border-white/10 bg-black/20">
                      {p.avatarUrl ? (
                        <img src={resolveMediaUrl(p.avatarUrl) || ""} alt={p.name} className="h-full w-full object-cover" />
                      ) : (
                        <div className="h-full w-full grid place-items-center text-white/50">Sin foto</div>
                      )}
                    </div>
                    <div className="mt-3 text-base font-semibold line-clamp-1">{p.name}</div>
                    <div className="mt-1 text-xs text-white/70">
                      {age ? `${age} años` : "Edad no indicada"}
                    </div>
                    <div className="mt-1 flex items-center gap-1 text-xs text-white/70">
                      <MapPin className="h-3.5 w-3.5" />
                      {p.distance != null ? `~${p.distance.toFixed(1)} km` : "Distancia no disponible"}
                    </div>
                  </Link>
                );
              }) : (
                <div className="rounded-2xl border border-white/10 bg-white/5 p-4 text-white/70">Aún no hay perfiles recientes para mostrar.</div>
              )}
            </div>
          </section>
        </main>
      </div>
    </div>
  );
}
