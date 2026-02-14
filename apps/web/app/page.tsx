"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { apiFetch, resolveMediaUrl } from "../lib/api";
import { useMapLocation } from "../hooks/useMapLocation";
import SkeletonCard from "../components/SkeletonCard";
import {
  BedDouble,
  Building2,
  GlassWater,
  Heart,
  Hotel,
  MapPin,
  Sparkles,
  Store,
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
  if (kind === "ESTABLISHMENT") return "Hospedaje";
  return "Tiendas";
}

function displayCategoryName(category: Category) {
  return category.displayName || category.name;
}

const categoryPriority: Record<Category["kind"], string[]> = {
  PROFESSIONAL: ["acompan", "masaj", "vip", "premium"],
  ESTABLISHMENT: ["motel", "hotel"],
  SHOP: ["sex", "juguet", "shop"]
};

const categoryLimits: Record<Category["kind"], number> = {
  PROFESSIONAL: 4,
  ESTABLISHMENT: 2,
  SHOP: 1
};

function pickTopCategories(kind: Category["kind"], categories: Category[]) {
  const filtered = categories.filter((c) => c.kind === kind && !/lenceria/i.test(c.slug || c.name));
  const prioritized: Category[] = [];
  const priorities = categoryPriority[kind];

  priorities.forEach((token) => {
    filtered.forEach((c) => {
      const haystack = `${c.slug} ${c.name} ${c.displayName}`.toLowerCase();
      if (haystack.includes(token) && !prioritized.find((p) => p.id === c.id)) {
        prioritized.push(c);
      }
    });
  });

  filtered.forEach((c) => {
    if (!prioritized.find((p) => p.id === c.id)) {
      prioritized.push(c);
    }
  });

  return prioritized.slice(0, categoryLimits[kind]);
}

function kindHref(kind: Category["kind"], categorySlug: string) {
  if (kind === "PROFESSIONAL") return `/profesionales?category=${encodeURIComponent(categorySlug)}`;
  if (kind === "ESTABLISHMENT") return `/hospedaje?category=${encodeURIComponent(categorySlug)}`;
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
        if (n.includes("motel")) return BedDouble;
    return Building2;
  }
  if (n.includes("lenceria")) return Sparkles;
  if (n.includes("juguetes")) return Heart;
  if (n.includes("premium")) return GlassWater;
  return Store;
}

const fadeUp = {
  hidden: { opacity: 0, y: 14 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: { delay: i * 0.08, duration: 0.35, ease: [0.16, 1, 0.3, 1] },
  }),
};

export default function HomePage() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [banners, setBanners] = useState<Banner[]>([]);
  const [recentPros, setRecentPros] = useState<RecentProfessional[]>([]);
  const { location, resolved } = useMapLocation([-33.45, -70.66]);
  const [error, setError] = useState<string | null>(null);
  const [recentError, setRecentError] = useState<string | null>(null);
  const [recentLoading, setRecentLoading] = useState(false);
  const lastRecentQueryRef = useRef<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

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
    if (!resolved) return;

    const params = new URLSearchParams();
    if (location) {
      params.set("lat", String(location[0]));
      params.set("lng", String(location[1]));
    }
    params.set("limit", "6");
    const query = params.toString();

    if (lastRecentQueryRef.current === query) return;
    lastRecentQueryRef.current = query;

    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setRecentLoading(true);
    setRecentError(null);

    const timer = setTimeout(() => {
      apiFetch<{ professionals: any[] }>(`/professionals/recent?${query}`, {
        signal: controller.signal,
      })
        .then((res) => {
          const mapped: RecentProfessional[] = (res?.professionals || []).map((p) => ({
            id: p.id,
            name: p.name || "Experiencia",
            avatarUrl: p.avatarUrl || null,
            distance: typeof p.distance === "number" ? p.distance : null,
            age: typeof p.age === "number" ? p.age : null,
          }));
          setRecentPros(mapped);
        })
        .catch((err: any) => {
          if (err?.name === "AbortError") return;
          if (err?.status === 429) {
            setRecentError("Estamos recibiendo muchas solicitudes. Reintenta en unos segundos.");
            return;
          }
          setRecentError("No se pudieron cargar experiencias recientes.");
        })
        .finally(() => setRecentLoading(false));
    }, 250);

    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [location, resolved]);

  const grouped = useMemo(() => {
    const by = { PROFESSIONAL: [] as Category[], ESTABLISHMENT: [] as Category[], SHOP: [] as Category[] };
    for (const c of categories) by[c.kind].push(c);
    return by;
  }, [categories]);

  const inlineBanners = useMemo(() => banners.filter((b) => (b.position || "").toUpperCase() === "INLINE"), [banners]);

  return (
    // Use dvh to avoid iOS Safari 100vh issues + prevent accidental horizontal overflow.
    <div className="min-h-[100dvh] overflow-x-hidden text-white antialiased">
      <div className="mx-auto max-w-4xl px-4 py-5 md:py-6">
        <motion.section
          initial="hidden"
          animate="visible"
          custom={0}
          variants={fadeUp}
          className="relative overflow-hidden rounded-3xl border border-white/10 bg-white/5 p-6 md:p-8"
        >
          {/* Animated gradient background */}
          <div className="absolute inset-0 -z-10 bg-gradient-to-br from-fuchsia-500/10 via-violet-500/5 to-transparent opacity-50 animate-pulse" />

          <div className="flex flex-col gap-5 md:flex-row md:items-center md:justify-between text-center md:text-left">
            <div>
              <h1 className="text-2xl md:text-3xl font-semibold bg-gradient-to-r from-white via-fuchsia-100 to-white bg-clip-text text-transparent">
                ¿Qué estás buscando?
              </h1>
              <p className="mt-2 text-sm text-white/70">Explora experiencias, lugares y tiendas cerca de ti.</p>
            </div>
            <div className="flex flex-wrap gap-3 justify-center md:justify-start">
              {/* Keep buttons tap-friendly but not oversized on mobile */}
              <Link href="/servicios" className="btn-primary text-sm md:text-base">Explorar servicios</Link>
              <Link href="/profesionales" className="btn-secondary text-sm md:text-base">Ver experiencias</Link>
            </div>
          </div>
        </motion.section>

        {error ? <div className="mt-4 rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-red-100">{error}</div> : null}

        {inlineBanners.length ? (
          <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {inlineBanners.slice(0, 4).map((b) => (
              <a key={b.id} href={b.linkUrl ?? "#"} className="block overflow-hidden rounded-2xl border border-white/10 bg-white/5 hover:bg-white/10 transition">
                <img src={b.imageUrl} alt={b.title} className="h-28 w-full object-contain" />
                <div className="p-3 text-sm text-white/80">{b.title}</div>
              </a>
            ))}
          </div>
        ) : null}

        <main className="mt-5 grid gap-6">
          {(["PROFESSIONAL", "ESTABLISHMENT", "SHOP"] as const).map((kind) => {
            const items = pickTopCategories(kind, grouped[kind]);
            return (
              <section key={kind}>
                <div className="mb-3 flex items-center justify-between">
                  <h2 className="text-lg md:text-xl font-semibold">{kindLabel(kind)}</h2>
                  <Link className="text-xs md:text-sm text-white/80 hover:text-white" href={kind === "PROFESSIONAL" ? "/profesionales" : kind === "ESTABLISHMENT" ? "/hospedaje" : "/sexshops"}>
                    Ver todas
                  </Link>
                </div>

                <div className="flex flex-col gap-3">
                  {kind === "ESTABLISHMENT" ? ([{ id: "motel", displayName: "Moteles", slug: "motel", kind: "ESTABLISHMENT" }, { id: "hotel", displayName: "Hoteles", slug: "hotel", kind: "ESTABLISHMENT" }] as any[]).map((c) => {
                    const Icon = categoryIcon(c.kind, c.slug || c.name);
                    return (
                      <motion.div key={c.id} whileHover={{ scale: 1.02, y: -2 }} transition={{ duration: 0.2 }}>
                        <Link
                          href="/hospedaje"
                          className="group relative overflow-hidden rounded-2xl border border-white/10 bg-white/5 p-3.5 hover:bg-white/10 hover:border-fuchsia-400/30 transition block"
                        >
                          {/* Gradient on hover */}
                          <div className="absolute inset-0 bg-gradient-to-br from-fuchsia-500/0 to-violet-500/0 group-hover:from-fuchsia-500/5 group-hover:to-violet-500/5 transition-all duration-300" />

                          <div className="relative flex items-center justify-between gap-3">
                            <div className="flex items-center gap-3">
                              <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-white/30 bg-gradient-to-br from-white/20 to-white/10 shadow-lg group-hover:shadow-fuchsia-500/20">
                                <Icon className="h-4 w-4 text-white" />
                              </div>
                              <div>
                                <div className="text-lg font-semibold leading-tight">{displayCategoryName(c)}</div>
                                <div className="text-xs text-white/75">Explorar categoría</div>
                              </div>
                            </div>
                            <Sparkles className="h-5 w-5 shrink-0 text-white/60 group-hover:text-fuchsia-400 transition" />
                          </div>
                        </Link>
                      </motion.div>
                    );
                  }) : items.length ? items.map((c) => {
                    const Icon = categoryIcon(c.kind, c.slug || c.name);
                    return (
                      <motion.div key={c.id} whileHover={{ scale: 1.02, y: -2 }} transition={{ duration: 0.2 }}>
                        <Link
                          href={kindHref(c.kind, c.slug || c.id)}
                          className="group relative overflow-hidden rounded-2xl border border-white/10 bg-white/5 p-3.5 hover:bg-white/10 hover:border-fuchsia-400/30 transition block"
                        >
                          {/* Gradient on hover */}
                          <div className="absolute inset-0 bg-gradient-to-br from-fuchsia-500/0 to-violet-500/0 group-hover:from-fuchsia-500/5 group-hover:to-violet-500/5 transition-all duration-300" />

                          <div className="relative flex items-center justify-between gap-3">
                            <div className="flex items-center gap-3">
                              <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-white/30 bg-gradient-to-br from-white/20 to-white/10 shadow-lg group-hover:shadow-fuchsia-500/20">
                                <Icon className="h-4 w-4 text-white" />
                              </div>
                              <div>
                                <div className="text-lg font-semibold leading-tight">{displayCategoryName(c)}</div>
                                <div className="text-xs text-white/75">Explorar categoría</div>
                              </div>
                            </div>
                            <Sparkles className="h-5 w-5 shrink-0 text-white/60 group-hover:text-fuchsia-400 transition" />
                          </div>
                        </Link>
                      </motion.div>
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

            {recentError ? (
              <div className="rounded-2xl border border-amber-400/40 bg-amber-500/10 p-4 text-white/80 xl:col-span-3">
                {recentError}
              </div>
            ) : null}

            {/*
              Important: avoid horizontal scrollers on Home.
              On iOS Safari they often create layout overflow that looks like the app "se corta".
            */}
            <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-3">
              {recentPros.length ? recentPros.slice(0, 3).map((p) => {
                const href = `/profesional/${p.id}`;
                return (
                  <motion.div key={p.id} whileHover={{ y: -4 }} transition={{ duration: 0.2 }}>
                    <Link
                      href={href}
                      className="block min-w-0 rounded-2xl border border-white/15 bg-white/5 p-3 hover:bg-white/10 hover:border-fuchsia-400/30 transition group"
                    >
                      <div className="h-40 overflow-hidden rounded-xl border border-white/10 bg-black/20 flex items-center justify-center">
                        {p.avatarUrl ? (
                          <img
                            src={resolveMediaUrl(p.avatarUrl) ?? undefined}
                            alt={p.name}
                            className="h-full w-full object-contain transition-transform duration-300 group-hover:scale-105"
                            onError={(e) => {
                              const img = e.currentTarget as HTMLImageElement;
                              img.onerror = null;
                              img.src = "/brand/isotipo-new.png";
                              img.className = "h-20 w-20 opacity-60";
                            }}
                          />
                        ) : (
                          <img src="/brand/isotipo-new.png" alt="" className="h-20 w-20 opacity-60" />
                        )}
                        <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
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
                  </motion.div>
                );
              }) : recentLoading ? (
                <div className="xl:col-span-3 grid grid-cols-2 md:grid-cols-3 gap-3">
                  {[1, 2, 3].map((i) => (
                    <SkeletonCard key={i} />
                  ))}
                </div>
              ) : (
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
