"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { apiFetch, resolveMediaUrl } from "../lib/api";
import {
  BedDouble,
  Building2,
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
  slug: string;
  displayName: string;
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
  age: number | null;
};

function kindLabel(kind: Category["kind"]) {
  if (kind === "PROFESSIONAL") return "Experiencias";
  if (kind === "ESTABLISHMENT") return "Lugares";
  return "Tiendas";
}

function displayCategoryName(category: Category) {
  return category.displayName || category.name;
}

function kindHref(kind: Category["kind"], categorySlug: string) {
  if (kind === "PROFESSIONAL") return `/profesionales?category=${encodeURIComponent(categorySlug)}`;
  if (kind === "ESTABLISHMENT") return `/establecimientos?category=${encodeURIComponent(categorySlug)}`;
  return `/sexshops?category=${encodeURIComponent(categorySlug)}`;
}

function categoryIcon(kind: Category["kind"], slug: string) {
  const n = slug.toLowerCase();
  if (kind === "PROFESSIONAL") {
    if (n.includes("masajes")) return Heart;
    if (n.includes("vip")) return Sparkles;
    if (n.includes("acompan")) return Users;
    return WandSparkles;
  }
  if (kind === "ESTABLISHMENT") {
    if (n.includes("hotel")) return Hotel;
    if (n.includes("privad")) return Stethoscope;
    if (n.includes("motel")) return BedDouble;
    return Building2;
  }
  if (n.includes("lenceria")) return Sparkles;
  if (n.includes("juguetes")) return Heart;
  if (n.includes("premium")) return GlassWater;
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
    if (location) {
      params.set("lat", String(location[0]));
      params.set("lng", String(location[1]));
    }
    params.set("limit", "6");
    apiFetch<{ professionals: any[] }>(`/professionals/recent?${params.toString()}`)
      .then((res) => {
        const mapped: RecentProfessional[] = (res?.professionals || []).map((p) => ({
          id: p.id,
          name: p.name || "Experiencia",
          avatarUrl: p.avatarUrl || null,
          distance: typeof p.distance === "number" ? p.distance : null,
          age: typeof p.age === "number" ? p.age : null
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
      <div className="mx-auto max-w-4xl px-4 py-5 md:py-6">
        <section className="rounded-3xl border border-white/10 bg-white/5 p-4 md:p-6">
          <div className="flex items-center gap-3">
            <img src="/brand/isotipo.png" alt="Uzeed" className="h-12 w-12 rounded-2xl border border-white/20 bg-white/10 object-cover" />
            <div>
              <div className="text-xs uppercase tracking-[0.2em] text-white/80">Uzeed</div>
              <h1 className="mt-1 text-xl md:text-2xl font-semibold">¿Qué estás buscando?</h1>
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

        <main className="mt-5 grid gap-6">
          {(["PROFESSIONAL", "ESTABLISHMENT", "SHOP"] as const).map((kind) => {
            const limits = { PROFESSIONAL: 3, ESTABLISHMENT: 2, SHOP: 2 };
            const items = grouped[kind].slice(0, limits[kind]);
            return (
              <section key={kind}>
                <div className="mb-3 flex items-center justify-between">
                  <h2 className="text-lg md:text-xl font-semibold">{kindLabel(kind)}</h2>
                  <Link className="text-xs md:text-sm text-white/80 hover:text-white" href={kind === "PROFESSIONAL" ? "/profesionales" : kind === "ESTABLISHMENT" ? "/establecimientos" : "/sexshops"}>
                    Ver todas
                  </Link>
                </div>

                <div className="flex flex-col gap-3">
                  {items.length ? items.map((c) => {
                    const Icon = categoryIcon(c.kind, c.slug || c.name);
                    return (
                      <Link
                        key={c.id}
                        href={kindHref(c.kind, c.slug || c.id)}
                        className="group relative overflow-hidden rounded-2xl border border-white/10 bg-white/5 p-3.5 hover:bg-white/10 transition"
                      >
                        <div className="relative flex items-center justify-between gap-3">
                          <div className="flex items-center gap-3">
                            <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-white/30 bg-white/15">
                              <Icon className="h-4 w-4 text-white" />
                            </div>
                            <div>
                              <div className="text-lg font-semibold leading-tight">{displayCategoryName(c)}</div>
                              <div className="text-xs text-white/75">Explorar categoría</div>
                            </div>
                          </div>
                          <Sparkles className="h-5 w-5 shrink-0 text-white/80 group-hover:text-white transition" />
                        </div>
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
              <h2 className="text-lg md:text-xl font-semibold">Experiencias recién agregadas</h2>
              <Link href="/profesionales" className="text-xs md:text-sm text-white/80 hover:text-white">Ver todas</Link>
            </div>

            <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
              {recentPros.length ? recentPros.slice(0, 3).map((p) => {
                return (
                  <Link key={p.id} href={`/profesional/${p.id}`} className="rounded-2xl border border-white/15 bg-white/5 p-3 hover:bg-white/10 transition">
                    <div className="h-40 overflow-hidden rounded-xl border border-white/10 bg-black/20">
                      {p.avatarUrl ? (
                        <img src={resolveMediaUrl(p.avatarUrl) || ""} alt={p.name} className="h-full w-full object-cover" />
                      ) : (
                        <div className="h-full w-full grid place-items-center text-white/50">Sin foto</div>
                      )}
                    </div>
                    <div className="mt-3 text-base font-semibold line-clamp-1">{p.name}</div>
                    <div className="mt-1 text-xs text-white/70">
                      {p.age ? `${p.age} años` : "Edad no indicada"}
                    </div>
                    <div className="mt-1 flex items-center gap-1 text-xs text-white/70">
                      <MapPin className="h-3.5 w-3.5" />
                      {p.distance != null ? `~${p.distance.toFixed(1)} km` : "Distancia no disponible"}
                    </div>
                  </Link>
                );
              }) : (
                <div className="rounded-2xl border border-white/10 bg-white/5 p-4 text-white/70 xl:col-span-3">
                  Aún no hay experiencias recién agregadas. Vuelve más tarde para descubrir nuevas opciones.
                </div>
              )}
            </div>
          </section>
        </main>
      </div>
    </div>
  );
}
