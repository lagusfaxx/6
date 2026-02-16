"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { apiFetch, resolveMediaUrl } from "../lib/api";
import { useMapLocation } from "../hooks/useMapLocation";
import {
  ArrowRight,
  BedDouble,
  Building2,
  ChevronRight,
  Flame,
  GlassWater,
  Heart,
  Hotel,
  MapPin,
  Sparkles,
  Store,
  TrendingUp,
  Users,
  WandSparkles,
  Zap,
} from "lucide-react";

/* ── Types ── */

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

/* ── Helpers ── */

function kindLabel(kind: Category["kind"]) {
  if (kind === "PROFESSIONAL") return "Experiencias";
  if (kind === "ESTABLISHMENT") return "Hospedaje";
  return "Tiendas";
}

function kindDescription(kind: Category["kind"]) {
  if (kind === "PROFESSIONAL") return "Servicios exclusivos y profesionales verificados";
  if (kind === "ESTABLISHMENT") return "Moteles, hoteles y lugares privados";
  return "Productos y accesorios premium";
}

function displayCategoryName(category: Category) {
  return category.displayName || category.name;
}

const categoryPriority: Record<Category["kind"], string[]> = {
  PROFESSIONAL: ["acompan", "masaj", "vip", "premium"],
  ESTABLISHMENT: ["motel", "hotel"],
  SHOP: ["sex", "juguet", "shop"],
};

const categoryLimits: Record<Category["kind"], number> = {
  PROFESSIONAL: 4,
  ESTABLISHMENT: 2,
  SHOP: 1,
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

function kindAllHref(kind: Category["kind"]) {
  if (kind === "PROFESSIONAL") return "/profesionales";
  if (kind === "ESTABLISHMENT") return "/hospedaje";
  return "/sexshops";
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

function categoryGradient(kind: Category["kind"], idx: number) {
  const gradients: Record<Category["kind"], string[]> = {
    PROFESSIONAL: [
      "from-fuchsia-600/20 to-pink-600/10",
      "from-violet-600/20 to-indigo-600/10",
      "from-rose-600/20 to-fuchsia-600/10",
      "from-purple-600/20 to-violet-600/10",
    ],
    ESTABLISHMENT: [
      "from-amber-600/20 to-orange-600/10",
      "from-teal-600/20 to-cyan-600/10",
    ],
    SHOP: [
      "from-pink-600/20 to-red-600/10",
    ],
  };
  const list = gradients[kind];
  return list[idx % list.length];
}

/* ── Animation variants ── */

const fadeUp = {
  hidden: { opacity: 0, y: 20 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: { delay: i * 0.08, duration: 0.45, ease: [0.16, 1, 0.3, 1] },
  }),
};

const stagger = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.08 } },
};

const cardFade = {
  hidden: { opacity: 0, y: 16 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.4, ease: [0.16, 1, 0.3, 1] },
  },
};

/* ── Page ── */

const SANTIAGO_FALLBACK: [number, number] = [-33.45, -70.66];

export default function HomePage() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [banners, setBanners] = useState<Banner[]>([]);
  const [recentPros, setRecentPros] = useState<RecentProfessional[]>([]);
  const { location } = useMapLocation(SANTIAGO_FALLBACK);
  const [error, setError] = useState<string | null>(null);
  const [recentError, setRecentError] = useState<string | null>(null);
  const [recentLoading, setRecentLoading] = useState(true);
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
    // Build query — use current location (or fallback) immediately.
    // Don't gate on `resolved` so cards load without waiting for geolocation.
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
          // DEBUG: Log raw API response
          console.log('[HomePage DEBUG] Raw API response:', {
            count: res?.professionals?.length || 0,
            sample: res?.professionals?.[0]
          });

          // Filter out professionals without avatars (defense-in-depth)
          const mapped: RecentProfessional[] = (res?.professionals || [])
            .filter(p => {
              if (!p.avatarUrl || p.avatarUrl.trim() === '') {
                console.warn('[HomePage] Filtering professional without avatar:', p.id);
                return false;
              }
              return true;
            })
            .map((p) => ({
              id: p.id,
              name: p.name || "Experiencia",
              avatarUrl: p.avatarUrl,
              distance: typeof p.distance === "number" ? p.distance : null,
              age: typeof p.age === "number" ? p.age : null,
            }));

          // DEBUG: Log processed data and resolved URLs
          console.log(`[HomePage] Loaded ${mapped.length} professionals`);
          if (mapped.length > 0) {
            const firstPro = mapped[0];
            console.log('[HomePage DEBUG] First professional:', {
              id: firstPro.id,
              name: firstPro.name,
              rawAvatarUrl: firstPro.avatarUrl,
              resolvedUrl: resolveMediaUrl(firstPro.avatarUrl)
            });
          }

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
    }, 150);

    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [location]);

  const grouped = useMemo(() => {
    const by = { PROFESSIONAL: [] as Category[], ESTABLISHMENT: [] as Category[], SHOP: [] as Category[] };
    for (const c of categories) by[c.kind].push(c);
    return by;
  }, [categories]);

  const inlineBanners = useMemo(() => banners.filter((b) => (b.position || "").toUpperCase() === "INLINE"), [banners]);

  return (
    <div className="min-h-[100dvh] overflow-x-hidden text-white antialiased">
      {/* ═══════════════════════════════════════════════
          1. HERO — Full-width, immersive, immediate impact
         ═══════════════════════════════════════════════ */}
      <section className="relative flex min-h-[75vh] items-center justify-center overflow-hidden px-4 md:min-h-[80vh]">
        {/* Background layers */}
        <div className="pointer-events-none absolute inset-0 -z-10 bg-[#070816]" />
        <div className="pointer-events-none absolute inset-0 -z-10 bg-[url('/brand/bg.jpg')] bg-cover bg-center opacity-20" />
        <div className="pointer-events-none absolute inset-0 -z-10 bg-gradient-to-b from-transparent via-[#070816]/50 to-[#0e0e12]" />

        {/* Glow orbs */}
        <div className="pointer-events-none absolute left-1/2 top-1/3 -z-10 h-[600px] w-[600px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-violet-600/[0.12] blur-[120px]" />
        <div className="pointer-events-none absolute right-1/4 top-2/3 -z-10 h-[400px] w-[400px] rounded-full bg-fuchsia-600/[0.08] blur-[100px]" />

        <div className="relative mx-auto max-w-3xl text-center">
          <motion.div
            initial="hidden"
            animate="visible"
            custom={0}
            variants={fadeUp}
            className="mb-5 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-4 py-1.5 text-xs text-white/60 backdrop-blur-xl"
          >
            <Zap className="h-3.5 w-3.5 text-fuchsia-400" />
            Plataforma #1 de experiencias en Chile
          </motion.div>

          <motion.h1
            initial="hidden"
            animate="visible"
            custom={1}
            variants={fadeUp}
            className="text-4xl font-bold leading-[1.1] tracking-tight md:text-6xl"
          >
            <span className="bg-gradient-to-r from-white via-white to-white/70 bg-clip-text text-transparent">
              Descubre experiencias
            </span>
            <br />
            <span className="bg-gradient-to-r from-fuchsia-400 via-violet-400 to-fuchsia-300 bg-clip-text text-transparent">
              reales cerca de ti
            </span>
          </motion.h1>

          <motion.p
            initial="hidden"
            animate="visible"
            custom={2}
            variants={fadeUp}
            className="mx-auto mt-5 max-w-lg text-base text-white/55 md:text-lg"
          >
            Conecta con profesionales, hospedajes y tiendas en segundos.
            Todo verificado, discreto y a tu medida.
          </motion.p>

          <motion.div
            initial="hidden"
            animate="visible"
            custom={3}
            variants={fadeUp}
            className="mt-8 flex flex-col items-center gap-3 sm:flex-row sm:justify-center"
          >
            <Link
              href="/servicios"
              className="group relative inline-flex items-center gap-2 overflow-hidden rounded-2xl bg-gradient-to-r from-fuchsia-600 to-violet-600 px-8 py-4 text-sm font-semibold shadow-[0_12px_40px_rgba(168,85,247,0.25)] transition-all duration-200 hover:scale-[1.03] hover:shadow-[0_16px_50px_rgba(168,85,247,0.35)] sm:w-auto w-full justify-center"
            >
              Explorar ahora
              <ArrowRight className="h-4 w-4 transition-transform duration-200 group-hover:translate-x-0.5" />
            </Link>
            <Link
              href="/profesionales"
              className="inline-flex items-center gap-2 rounded-2xl border border-white/15 bg-white/[0.04] px-8 py-4 text-sm font-medium text-white/80 backdrop-blur-xl transition-all duration-200 hover:border-white/25 hover:bg-white/[0.08] sm:w-auto w-full justify-center"
            >
              Ver experiencias
            </Link>
          </motion.div>

          {/* Trust indicators */}
          <motion.div
            initial="hidden"
            animate="visible"
            custom={4}
            variants={fadeUp}
            className="mt-10 flex flex-wrap items-center justify-center gap-6 text-[11px] text-white/35"
          >
            <span className="flex items-center gap-1.5">
              <div className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
              Perfiles verificados
            </span>
            <span className="flex items-center gap-1.5">
              <div className="h-1.5 w-1.5 rounded-full bg-fuchsia-400" />
              100% discreto
            </span>
            <span className="flex items-center gap-1.5">
              <div className="h-1.5 w-1.5 rounded-full bg-violet-400" />
              Chat en tiempo real
            </span>
          </motion.div>
        </div>
      </section>

      {/* Main content container */}
      <div className="mx-auto max-w-6xl px-4 pb-16">

        {error && (
          <div className="mb-6 rounded-xl border border-red-500/20 bg-red-500/10 p-4 text-sm text-red-200">
            {error}
          </div>
        )}

        {/* ═══════════════════════════════════════════════
            Inline banners (if any)
           ═══════════════════════════════════════════════ */}
        {inlineBanners.length > 0 && (
          <div className="mb-10 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {inlineBanners.slice(0, 4).map((b) => (
              <a
                key={b.id}
                href={b.linkUrl ?? "#"}
                className="group block overflow-hidden rounded-2xl border border-white/[0.08] bg-white/[0.03] transition-all duration-200 hover:border-white/15 hover:bg-white/[0.06]"
              >
                <div className="overflow-hidden">
                  <img
                    src={b.imageUrl}
                    alt={b.title}
                    className="h-28 w-full object-contain transition-transform duration-300 group-hover:scale-105"
                  />
                </div>
                <div className="p-3 text-sm text-white/70">{b.title}</div>
              </a>
            ))}
          </div>
        )}

        {/* ═══════════════════════════════════════════════
            2. EXPERIENCIAS DESTACADAS — Recent profiles
           ═══════════════════════════════════════════════ */}
        <motion.section
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-60px" }}
          variants={stagger}
          className="mb-16"
        >
          <motion.div variants={cardFade} className="mb-6 flex items-end justify-between">
            <div>
              <div className="mb-1 flex items-center gap-2">
                <Flame className="h-4 w-4 text-fuchsia-400" />
                <span className="text-xs font-medium uppercase tracking-wider text-fuchsia-400/80">Destacadas</span>
              </div>
              <h2 className="text-2xl font-bold tracking-tight md:text-3xl">Experiencias cerca de ti</h2>
              <p className="mt-1 text-sm text-white/45">Lo más reciente y popular en tu zona</p>
            </div>
            <Link
              href="/profesionales"
              className="group hidden items-center gap-1.5 text-sm text-white/50 transition hover:text-white sm:flex"
            >
              Ver todas
              <ChevronRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
            </Link>
          </motion.div>

          {recentError && (
            <div className="mb-4 rounded-2xl border border-amber-400/20 bg-amber-500/10 p-4 text-sm text-white/70">
              {recentError}
            </div>
          )}

          <div className="grid gap-3 sm:grid-cols-2 sm:gap-4 md:grid-cols-3">
            {recentPros.length > 0
              ? recentPros.slice(0, 6).map((p, i) => (
                  <motion.div key={p.id} variants={cardFade}>
                    <Link
                      href={`/profesional/${p.id}`}
                      className="group relative block overflow-hidden rounded-2xl border border-white/[0.08] bg-white/[0.03] transition-all duration-200 hover:-translate-y-1 hover:border-white/15 hover:shadow-[0_20px_60px_rgba(0,0,0,0.4)]"
                    >
                      {/* Image */}
                      <div className="relative aspect-[4/5] overflow-hidden bg-gradient-to-br from-white/5 to-transparent">
                        {p.avatarUrl ? (
                          <img
                            src={(() => {
                              const url = resolveMediaUrl(p.avatarUrl);
                              console.log('[RecentPro Card]', {
                                id: p.id,
                                name: p.name,
                                rawUrl: p.avatarUrl,
                                resolvedUrl: url
                              });
                              return url ?? undefined;
                            })()}
                            alt={p.name}
                            className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.06]"
                            onLoad={() => {
                              console.log('[RecentPro Card] ✅ Image loaded successfully for:', p.name);
                            }}
                            onError={(e) => {
                              const img = e.currentTarget as HTMLImageElement;
                              console.error('[RecentPro Card] ❌ Image load failed for:', p.name, 'URL:', img.src);
                              img.onerror = null;
                              img.src = "/brand/isotipo-new.png";
                              img.className = "h-20 w-20 mx-auto mt-20 opacity-40";
                            }}
                          />
                        ) : (
                          <div className="flex h-full items-center justify-center">
                            <img src="/brand/isotipo-new.png" alt="" className="h-20 w-20 opacity-30" />
                          </div>
                        )}

                        {/* Overlay gradient */}
                        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />

                        {/* Distance badge */}
                        {p.distance != null && (
                          <div className="absolute right-3 top-3 flex items-center gap-1 rounded-full border border-white/10 bg-black/50 px-2.5 py-1 text-[11px] text-white/80 backdrop-blur-xl">
                            <MapPin className="h-3 w-3" />
                            {p.distance.toFixed(1)} km
                          </div>
                        )}

                        {/* Bottom info overlay */}
                        <div className="absolute bottom-0 left-0 right-0 p-4">
                          <h3 className="text-lg font-semibold leading-tight">{p.name}</h3>
                          <div className="mt-1 flex items-center gap-3 text-xs text-white/60">
                            {p.age && <span>{p.age} años</span>}
                          </div>
                        </div>
                      </div>
                    </Link>
                  </motion.div>
                ))
              : recentLoading
                ? [1, 2, 3, 4].map((i) => (
                    <motion.div key={i} variants={cardFade}>
                      <div className="animate-pulse overflow-hidden rounded-2xl border border-white/[0.06] bg-white/[0.03]">
                        <div className="aspect-[4/5] bg-white/[0.04]" />
                        <div className="space-y-2 p-4">
                          <div className="h-4 w-2/3 rounded bg-white/[0.06]" />
                          <div className="h-3 w-1/3 rounded bg-white/[0.04]" />
                        </div>
                      </div>
                    </motion.div>
                  ))
                : (
                    <div className="col-span-full rounded-2xl border border-white/[0.08] bg-white/[0.03] p-8 text-center text-sm text-white/50">
                      Aún no hay experiencias recientes. Vuelve pronto para descubrir nuevas opciones.
                    </div>
                  )}
          </div>

          {/* Mobile "ver todas" */}
          <Link
            href="/profesionales"
            className="mt-4 flex items-center justify-center gap-1.5 rounded-2xl border border-white/10 bg-white/[0.03] py-3 text-sm text-white/60 transition hover:bg-white/[0.06] sm:hidden"
          >
            Ver todas las experiencias
            <ChevronRight className="h-4 w-4" />
          </Link>
        </motion.section>

        {/* ═══════════════════════════════════════════════
            3. CATEGORÍAS — Visual tile cards
           ═══════════════════════════════════════════════ */}
        <motion.section
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-60px" }}
          variants={stagger}
          className="mb-16"
        >
          {(["PROFESSIONAL", "ESTABLISHMENT", "SHOP"] as const).map((kind) => {
            const items =
              kind === "ESTABLISHMENT"
                ? ([
                    { id: "motel", displayName: "Moteles", slug: "motel", kind: "ESTABLISHMENT", name: "Moteles" },
                    { id: "hotel", displayName: "Hoteles", slug: "hotel", kind: "ESTABLISHMENT", name: "Hoteles" },
                  ] as Category[])
                : pickTopCategories(kind, grouped[kind]);

            return (
              <motion.div key={kind} variants={cardFade} className="mb-10 last:mb-0">
                <div className="mb-4 flex items-end justify-between">
                  <div>
                    <h2 className="text-xl font-bold tracking-tight md:text-2xl">{kindLabel(kind)}</h2>
                    <p className="mt-0.5 text-xs text-white/40">{kindDescription(kind)}</p>
                  </div>
                  <Link
                    href={kindAllHref(kind)}
                    className="group flex items-center gap-1 text-xs text-white/50 transition hover:text-fuchsia-400"
                  >
                    Ver todas
                    <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
                  </Link>
                </div>

                <div className={`grid gap-3 ${
                  kind === "PROFESSIONAL"
                    ? "grid-cols-2 md:grid-cols-4"
                    : kind === "ESTABLISHMENT"
                      ? "grid-cols-2"
                      : "grid-cols-1 sm:grid-cols-2"
                }`}>
                  {items.length > 0
                    ? items.map((c, idx) => {
                        const Icon = categoryIcon(c.kind, c.slug || c.name);
                        const href = kind === "ESTABLISHMENT" ? "/hospedaje" : kindHref(c.kind, c.slug || c.id);
                        const grad = categoryGradient(c.kind, idx);

                        return (
                          <Link
                            key={c.id}
                            href={href}
                            className="group relative overflow-hidden rounded-2xl border border-white/[0.08] bg-white/[0.03] p-5 transition-all duration-200 hover:-translate-y-1 hover:border-fuchsia-500/20 hover:shadow-[0_16px_50px_rgba(0,0,0,0.3)]"
                          >
                            {/* Background gradient */}
                            <div className={`absolute inset-0 bg-gradient-to-br ${grad} opacity-0 transition-opacity duration-300 group-hover:opacity-100`} />

                            <div className="relative">
                              <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-xl border border-white/10 bg-white/[0.06] transition-all duration-200 group-hover:border-fuchsia-500/20 group-hover:bg-fuchsia-500/10 group-hover:shadow-[0_0_20px_rgba(192,38,211,0.15)]">
                                <Icon className="h-5 w-5 text-white/70 transition-colors group-hover:text-fuchsia-400" />
                              </div>
                              <div className="text-sm font-semibold leading-tight">{displayCategoryName(c)}</div>
                              <div className="mt-1 text-[11px] text-white/40">Explorar</div>
                            </div>

                            <ChevronRight className="absolute right-4 top-1/2 h-4 w-4 -translate-y-1/2 text-white/20 transition-all duration-200 group-hover:text-fuchsia-400/60 group-hover:translate-x-0.5" />
                          </Link>
                        );
                      })
                    : kind === "SHOP"
                      ? (
                          <Link
                            href="/sexshops"
                            className="rounded-2xl border border-white/[0.08] bg-white/[0.03] p-5 text-sm text-white/50 transition hover:bg-white/[0.06]"
                          >
                            Aún no hay categorías de tiendas cargadas. Toca aquí para explorar tiendas activas.
                          </Link>
                        )
                      : (
                          <div className="rounded-2xl border border-white/[0.08] bg-white/[0.03] p-5 text-sm text-white/50">
                            No hay categorías disponibles.
                          </div>
                        )}
                </div>
              </motion.div>
            );
          })}
        </motion.section>

        {/* ═══════════════════════════════════════════════
            4. TENDENCIAS — Horizontal scroll cards
           ═══════════════════════════════════════════════ */}
        {recentPros.length > 3 && (
          <motion.section
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: "-60px" }}
            variants={stagger}
            className="mb-16"
          >
            <motion.div variants={cardFade} className="mb-6">
              <div className="flex items-center gap-2">
                <TrendingUp className="h-4 w-4 text-violet-400" />
                <span className="text-xs font-medium uppercase tracking-wider text-violet-400/80">Tendencias</span>
              </div>
              <h2 className="mt-1 text-2xl font-bold tracking-tight md:text-3xl">Cerca de ti</h2>
              <p className="mt-1 text-sm text-white/45">Las más buscadas en tu zona</p>
            </motion.div>

            <motion.div
              variants={cardFade}
              className="scrollbar-none -mx-4 flex gap-3 overflow-x-auto px-4 pb-2 snap-x snap-mandatory md:mx-0 md:grid md:grid-cols-3 md:overflow-visible md:px-0"
            >
              {recentPros.slice(0, 6).map((p) => (
                <Link
                  key={`trend-${p.id}`}
                  href={`/profesional/${p.id}`}
                  className="group flex w-[260px] shrink-0 snap-start items-center gap-3 rounded-2xl border border-white/[0.08] bg-white/[0.03] p-3 transition-all duration-200 hover:-translate-y-0.5 hover:border-white/15 hover:bg-white/[0.06] md:w-auto"
                >
                  <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-xl bg-gradient-to-br from-white/5 to-transparent">
                    {p.avatarUrl ? (
                      <img
                        src={resolveMediaUrl(p.avatarUrl) ?? undefined}
                        alt={p.name}
                        className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-110"
                        onError={(e) => {
                          const img = e.currentTarget as HTMLImageElement;
                          img.onerror = null;
                          img.src = "/brand/isotipo-new.png";
                          img.className = "h-8 w-8 mx-auto mt-4 opacity-40";
                        }}
                      />
                    ) : (
                      <div className="flex h-full items-center justify-center">
                        <img src="/brand/isotipo-new.png" alt="" className="h-8 w-8 opacity-30" />
                      </div>
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-semibold">{p.name}</div>
                    <div className="mt-0.5 flex items-center gap-2 text-xs text-white/45">
                      {p.age && <span>{p.age} años</span>}
                      {p.distance != null && (
                        <span className="flex items-center gap-0.5">
                          <MapPin className="h-3 w-3" />
                          {p.distance.toFixed(1)} km
                        </span>
                      )}
                    </div>
                  </div>
                  <ChevronRight className="h-4 w-4 shrink-0 text-white/20 transition group-hover:text-fuchsia-400" />
                </Link>
              ))}
            </motion.div>
          </motion.section>
        )}

        {/* ═══════════════════════════════════════════════
            5. CTA FINAL — Conversion push
           ═══════════════════════════════════════════════ */}
        <motion.section
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-60px" }}
          custom={0}
          variants={fadeUp}
          className="relative overflow-hidden rounded-3xl border border-white/[0.08] bg-gradient-to-br from-fuchsia-600/[0.08] via-violet-600/[0.05] to-transparent p-8 text-center md:p-12"
        >
          <div className="pointer-events-none absolute left-1/2 top-1/2 -z-10 h-[300px] w-[300px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-fuchsia-600/10 blur-[80px]" />

          <h2 className="text-2xl font-bold tracking-tight md:text-3xl">
            ¿Listo para explorar?
          </h2>
          <p className="mx-auto mt-3 max-w-md text-sm text-white/50">
            Miles de experiencias, hospedajes y productos esperan por ti.
            Crea tu cuenta gratis y descubre lo mejor cerca de ti.
          </p>
          <div className="mt-6 flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
            <Link
              href="/register"
              className="group inline-flex items-center gap-2 rounded-2xl bg-gradient-to-r from-fuchsia-600 to-violet-600 px-8 py-4 text-sm font-semibold shadow-[0_12px_40px_rgba(168,85,247,0.25)] transition-all duration-200 hover:scale-[1.03] hover:shadow-[0_16px_50px_rgba(168,85,247,0.35)] w-full sm:w-auto justify-center"
            >
              Crear cuenta gratis
              <ArrowRight className="h-4 w-4 transition-transform duration-200 group-hover:translate-x-0.5" />
            </Link>
            <Link
              href="/servicios"
              className="inline-flex items-center gap-2 rounded-2xl border border-white/15 bg-white/[0.04] px-8 py-4 text-sm font-medium text-white/80 transition-all duration-200 hover:border-white/25 hover:bg-white/[0.08] w-full sm:w-auto justify-center"
            >
              Explorar servicios
            </Link>
          </div>
        </motion.section>
      </div>
    </div>
  );
}
