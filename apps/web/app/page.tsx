"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { apiFetch, resolveMediaUrl } from "../lib/api";
import { useMapLocation } from "../hooks/useMapLocation";
import useMe from "../hooks/useMe";
import { buildChatHref, buildCurrentPathWithSearch, buildLoginHref } from "../lib/chat";
import {
  ArrowRight,
  ChevronRight,
  Flame,
  Clock3,
  MapPin,
  Navigation,
  Sparkles,
  TrendingUp,
  Zap,
} from "lucide-react";

/* ── Types ── */

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

type DiscoverProfile = {
  id: string;
  username: string;
  displayName: string;
  age: number | null;
  avatarUrl: string | null;
  coverUrl: string | null;
  lat: number | null;
  lng: number | null;
  distanceKm: number | null;
  availableNow: boolean;
  lastSeen?: string | null;
};

/* ── Helpers ── */

const DISCOVERY_SECTIONS = [
  { key: "available", title: "Disponibles ahora", subtitle: "Perfiles activos en los últimos minutos.", icon: Clock3, href: "/servicios?sort=availableNow", cta: "Ver todas", query: { sort: "availableNow", limit: "4" } },
  { key: "near", title: "Cerca de ti", subtitle: "Perfiles ordenados por cercanía.", icon: Navigation, href: "/servicios?sort=near", cta: "Ver mapa", query: { sort: "near", limit: "4" } },
  { key: "new", title: "Nuevas", subtitle: "Perfiles recientes para descubrir.", icon: Sparkles, href: "/servicios?sort=new", cta: "Ver todas", query: { sort: "new", limit: "4" } },
] as const;

function resolveProfileImage(profile: DiscoverProfile) {
  return resolveMediaUrl(profile.coverUrl) ?? resolveMediaUrl(profile.avatarUrl) ?? "/brand/isotipo-new.png";
}

function isAvailableNowFromLastSeen(lastSeen?: string | null) {
  if (!lastSeen) return false;
  const timestamp = Date.parse(lastSeen);
  if (Number.isNaN(timestamp)) return false;
  return Date.now() - timestamp <= 10 * 60 * 1000;
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
  const [banners, setBanners] = useState<Banner[]>([]);
  const [recentPros, setRecentPros] = useState<RecentProfessional[]>([]);
  const [discoverSections, setDiscoverSections] = useState<Record<string, DiscoverProfile[]>>({});
  const { location } = useMapLocation(SANTIAGO_FALLBACK);
  const [error, setError] = useState<string | null>(null);
  const [recentError, setRecentError] = useState<string | null>(null);
  const [recentLoading, setRecentLoading] = useState(true);
  const { me } = useMe();

  useEffect(() => {
    (async () => {
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
    params.set("limit", "20");
    const query = params.toString();

    const controller = new AbortController();

    setRecentLoading(true);
    setRecentError(null);

    apiFetch<{ professionals: any[] }>(`/professionals/recent?${query}`, {
      signal: controller.signal,
    })
      .then((res) => {
        const mapped: RecentProfessional[] = (res?.professionals || []).map((p) => ({
          id: p.id,
          name: p.name || "Experiencia",
          avatarUrl: p.avatarUrl,
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
        setRecentError("No se pudieron cargar las experiencias.");
      })
      .finally(() => setRecentLoading(false));

    return () => {
      controller.abort();
    };
  }, [location]);

  useEffect(() => {
    const loadSections = async () => {
      const next: Record<string, DiscoverProfile[]> = {};
      setError(null);
      await Promise.all(DISCOVERY_SECTIONS.map(async (section) => {
        const qp = new URLSearchParams(section.query as Record<string, string>);
        if (location) {
          qp.set("lat", String(location[0]));
          qp.set("lng", String(location[1]));
        }
        const res = await apiFetch<{ profiles: DiscoverProfile[] }>(`/profiles/discover?${qp.toString()}`).catch(() => ({ profiles: [] }));
        next[section.key] = res.profiles || [];
      }));
      setDiscoverSections(next);
    };
    loadSections().catch(() => setError("No se pudieron cargar las secciones destacadas."));
  }, [location]);

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
      <div className="mx-auto max-w-6xl overflow-hidden px-4 pb-16">

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
        {(recentPros.length > 0 || recentLoading) && (
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
                <p className="mt-1 text-sm text-white/45">Descubre profesionales disponibles en tu zona</p>
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

            <div className="scrollbar-none -mx-4 flex gap-3 overflow-x-auto px-4 pb-2 snap-x snap-mandatory sm:mx-0 sm:grid sm:grid-cols-2 sm:gap-4 sm:overflow-visible sm:px-0 md:grid-cols-3">
              {recentPros.length > 0
                ? recentPros.slice(0, 3).map((p, i) => (
                    <motion.div key={p.id} variants={cardFade} className="w-[75vw] shrink-0 snap-start sm:w-auto">
                      <Link
                        href={`/profesional/${p.id}`}
                        className="group relative block overflow-hidden rounded-2xl border border-white/[0.08] bg-white/[0.03] transition-all duration-200 hover:-translate-y-1 hover:border-white/15 hover:shadow-[0_20px_60px_rgba(0,0,0,0.4)]"
                      >
                        {/* Image */}
                        <div className="relative aspect-[4/5] overflow-hidden bg-gradient-to-br from-white/5 to-transparent">
                          {p.avatarUrl ? (
                            <img
                              src={resolveMediaUrl(p.avatarUrl) ?? undefined}
                              alt={p.name}
                              className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.06]"
                              onError={(e) => {
                                const img = e.currentTarget as HTMLImageElement;
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
                : [1, 2, 3].map((i) => (
                    <motion.div key={i} variants={cardFade} className="w-[75vw] shrink-0 snap-start sm:w-auto">
                      <div className="animate-pulse overflow-hidden rounded-2xl border border-white/[0.06] bg-white/[0.03]">
                        <div className="aspect-[4/5] bg-white/[0.04]" />
                        <div className="space-y-2 p-4">
                          <div className="h-4 w-2/3 rounded bg-white/[0.06]" />
                          <div className="h-3 w-1/3 rounded bg-white/[0.04]" />
                        </div>
                      </div>
                    </motion.div>
                  ))}
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
        )}

        {/* ═══════════════════════════════════════════════
            3. DESCUBRIR — Dynamic sections
           ═══════════════════════════════════════════════ */}
        <motion.section
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-60px" }}
          variants={stagger}
          className="mb-16"
        >
          {DISCOVERY_SECTIONS.map((section) => {
            const items = discoverSections[section.key] || [];
            const Icon = section.icon;

            return (
              <motion.div key={section.key} variants={cardFade} className="mb-10 last:mb-0">
                <div className="mb-4 flex items-end justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      <Icon className="h-4 w-4 text-fuchsia-300" />
                      <h2 className="text-xl font-bold tracking-tight md:text-2xl">{section.title}</h2>
                    </div>
                    <p className="mt-0.5 text-xs text-white/40">{section.subtitle}</p>
                  </div>
                  <Link
                    href={section.href}
                    className="group flex items-center gap-1 text-xs text-white/50 transition hover:text-fuchsia-400"
                  >
                    {section.cta}
                    <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
                  </Link>
                </div>

                <div className="scrollbar-none -mx-4 flex gap-3 overflow-x-auto px-4 pb-2 snap-x snap-mandatory sm:mx-0 sm:grid sm:grid-cols-2 sm:overflow-visible sm:px-0 lg:grid-cols-4">
                  {items.length > 0
                    ? items.map((profile) => {
                        const href = `/perfil/${profile.username}`;
                        const cover = resolveProfileImage(profile);
                        const availableNow = isAvailableNowFromLastSeen(profile.lastSeen);
                        const messageHref = me?.user
                          ? buildChatHref(profile.id, { mode: "message" })
                          : buildLoginHref(buildCurrentPathWithSearch());
                        const requestHref = me?.user
                          ? buildChatHref(profile.id, { mode: "request" })
                          : buildLoginHref(buildCurrentPathWithSearch());

                        return (
                          <article
                            key={profile.id}
                            className="group w-[70vw] shrink-0 snap-start overflow-hidden rounded-2xl border border-white/[0.08] bg-white/[0.03] transition-all duration-200 hover:-translate-y-1 hover:border-fuchsia-500/20 sm:w-auto"
                          >
                            <Link href={href} className="block">
                              <div className="relative aspect-[4/5] bg-white/[0.04]">
                                <img src={cover ?? undefined} alt={profile.displayName} className="h-full w-full object-cover transition group-hover:scale-105" />
                                {profile.distanceKm != null && (
                                  <div className="absolute right-2 top-2 rounded-full border border-white/10 bg-black/50 px-2 py-1 text-[11px] text-white/80">
                                    {profile.distanceKm.toFixed(1)} km
                                  </div>
                                )}
                                {availableNow && (
                                  <div className="absolute left-2 top-2 rounded-full border border-emerald-300/30 bg-emerald-500/20 px-2 py-1 text-[11px] text-emerald-100">
                                    Disponible
                                  </div>
                                )}
                              </div>
                            </Link>
                            <div className="space-y-2 p-3">
                              <div className="truncate text-sm font-semibold">
                                {profile.displayName}{profile.age != null ? `, ${profile.age}` : ""}
                              </div>
                              <div className="grid grid-cols-2 gap-2">
                                <Link href={messageHref} className="rounded-lg bg-white/[0.07] px-2 py-2 text-center text-xs font-medium text-white/85 hover:bg-white/[0.12]">
                                  Enviar mensaje
                                </Link>
                                <Link href={requestHref} className="rounded-lg border border-fuchsia-400/30 bg-fuchsia-500/10 px-2 py-2 text-center text-xs font-medium text-fuchsia-100 hover:bg-fuchsia-500/20">
                                  Solicitar / Reservar
                                </Link>
                              </div>
                            </div>
                          </article>
                        );
                      })
                    : [1, 2, 3, 4].map((i) => (
                      <div key={i} className="w-[70vw] shrink-0 snap-start aspect-[4/5] animate-pulse rounded-2xl border border-white/[0.06] bg-white/[0.03] sm:w-auto" />
                    ))}
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
              {recentPros.slice(0, 3).map((p) => (
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
