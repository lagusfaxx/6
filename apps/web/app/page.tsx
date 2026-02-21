"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { apiFetchWithRetry, resolveMediaUrl } from "../lib/api";
import { useActiveLocation } from "../hooks/useActiveLocation";
import useMe from "../hooks/useMe";
import UserLevelBadge from "../components/UserLevelBadge";
import {
  ArrowRight,
  ChevronRight,
  MapPin,
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

type VipProfile = {
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
  isActive: boolean;
  userLevel: string;
  tier: string | null;
  completedServices: number;
  profileViews: number;
  lastActiveAt: string | null;
  city: string | null;
  zone: string | null;
  isVerified: boolean;
};

type Zone = { name: string; count: number };

type HomeSections = {
  platinum: VipProfile[];
  trending: VipProfile[];
  availableNow: VipProfile[];
  newArrivals: VipProfile[];
  zones: Zone[];
};

type HomeSummary = {
  availableNowCount: number;
  newThisWeekCount: number;
  platinumCount: number;
  totalInCityCount: number;
};

type StoryItem = {
  id: string;
  mediaUrl: string;
  caption: string | null;
  createdAt: string;
  expiresAt: string;
  professional: {
    id: string;
    username: string;
    displayName: string | null;
    avatarUrl: string | null;
    tier: string | null;
  };
};

/* ── Helpers ── */

function resolveProfileImage(profile: VipProfile) {
  return (
    resolveMediaUrl(profile.coverUrl) ??
    resolveMediaUrl(profile.avatarUrl) ??
    "/brand/isotipo-new.png"
  );
}

function formatLastSeenLabel(lastSeen?: string | null) {
  if (!lastSeen) return "Activa recientemente";
  const diff = Date.now() - Date.parse(lastSeen);
  if (!Number.isFinite(diff) || diff < 0) return "Activa recientemente";
  const minutes = Math.floor(diff / 60000);
  if (minutes < 60) return `Activa hace ${minutes} min`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `Activa hace ${hours} hora${hours === 1 ? "" : "s"}`;
  const days = Math.floor(hours / 24);
  return `Activa hace ${days} día${days === 1 ? "" : "s"}`;
}

function tierBorderClass(tier: string | null, userLevel: string): string {
  const t = (tier ?? userLevel ?? "").toUpperCase();
  if (t === "PLATINUM" || t === "PREMIUM")
    return "shadow-[0_0_0_1px_rgba(34,211,238,0.4),0_0_28px_rgba(34,211,238,0.15)] border-cyan-200/40";
  if (t === "GOLD" || t === "DIAMOND")
    return "shadow-[0_0_0_1px_rgba(251,191,36,0.4),0_0_24px_rgba(251,191,36,0.12)] border-amber-300/40";
  return "border-white/[0.08]";
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

/* ── Shared VIP Card ── */

function VipCard({
  profile,
  aspect = "aspect-[4/5]",
  showDistance = false,
}: {
  profile: VipProfile;
  aspect?: string;
  showDistance?: boolean;
}) {
  const cover = resolveProfileImage(profile);
  const href = `/perfil/${profile.username}`;
  const border = tierBorderClass(profile.tier, profile.userLevel);

  return (
    <Link
      href={href}
      className={`group relative block overflow-hidden rounded-2xl border bg-white/[0.03] transition-all duration-200 hover:-translate-y-1 hover:scale-[1.02] ${border}`}
    >
      <div className={`relative ${aspect} overflow-hidden bg-gradient-to-br from-white/5 to-transparent`}>
        <img
          src={cover ?? undefined}
          alt={profile.displayName}
          className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.06]"
          onError={(e) => {
            const img = e.currentTarget as HTMLImageElement;
            img.onerror = null;
            img.src = "/brand/isotipo-new.png";
            img.className = "h-20 w-20 mx-auto mt-20 opacity-40";
          }}
        />

        {/* Gradient overlay */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />

        {/* Tier badge */}
        <UserLevelBadge
          level={profile.userLevel as any}
          className="absolute left-2 top-2 px-2 py-1 text-[11px]"
        />

        {/* Verification badge */}
        {profile.isVerified && (
          <div className="absolute left-2 top-10 rounded-full border border-emerald-300/20 bg-emerald-500/15 px-2 py-0.5 text-[10px] text-emerald-200">
            ✓ Verificada
          </div>
        )}

        {/* Availability tag */}
        {profile.availableNow ? (
          <div className="absolute right-2 top-2 inline-flex items-center gap-1 rounded-full border border-emerald-300/30 bg-emerald-500/20 px-2 py-1 text-[11px] text-emerald-100">
            <span className="h-2 w-2 rounded-full bg-emerald-300 animate-pulse" />
            Disponible
          </div>
        ) : (
          <div className="absolute right-2 top-2 rounded-full border border-white/15 bg-black/45 px-2 py-1 text-[11px] text-white/80">
            {formatLastSeenLabel(profile.lastActiveAt)}
          </div>
        )}

        {/* Bottom info overlay */}
        <div className="absolute bottom-0 left-0 right-0 p-3">
          <h3 className="truncate text-sm font-semibold leading-tight">
            {profile.displayName}
            {profile.age != null ? `, ${profile.age}` : ""}
          </h3>
          <div className="mt-1 flex items-center gap-2 text-[11px] text-white/55">
            {showDistance && profile.distanceKm != null ? (
              <span className="flex items-center gap-0.5">
                <MapPin className="h-3 w-3" />
                {profile.distanceKm.toFixed(1)} km
              </span>
            ) : (
              (profile.zone || profile.city) && (
                <span>{profile.zone ?? profile.city}</span>
              )
            )}
          </div>
        </div>
      </div>
    </Link>
  );
}

/* ── Skeleton card ── */

function SkeletonCard({ aspect = "aspect-[4/5]" }: { aspect?: string }) {
  return (
    <div className={`${aspect} animate-pulse rounded-2xl border border-white/[0.06] bg-white/[0.03]`} />
  );
}

/* ── Ad Slot Block ── */

type AdItem = {
  id: string;
  position: string;
  imageUrl: string;
  linkUrl: string | null;
};

function AdSlotBlock({ position }: { position: string }) {
  const [ads, setAds] = useState<AdItem[]>([]);

  useEffect(() => {
    const controller = new AbortController();
    apiFetchWithRetry<{ ads: AdItem[] }>(`/ads?position=${position}`, {
      signal: controller.signal,
    })
      .then((res) => {
        if (!controller.signal.aborted) setAds(res?.ads ?? []);
      })
      .catch(() => {});
    return () => { controller.abort(); };
  }, [position]);

  if (ads.length === 0) return null;

  const trackEvent = (adId: string, eventType: "impression" | "click") => {
    apiFetchWithRetry(`/ads/${adId}/event`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ eventType }),
    }).catch(() => {});
  };

  // Track which ads already had impressions to avoid duplicate observers
  const trackedRef = useRef(new Set<string>());

  return (
    <div className="mb-10 grid gap-3 sm:grid-cols-2">
      {ads.slice(0, 2).map((ad) => {
        const Wrapper = ad.linkUrl ? "a" : "div";
        const wrapperProps = ad.linkUrl
          ? { href: ad.linkUrl, target: "_blank" as const, rel: "noopener noreferrer" }
          : {};
        return (
          <Wrapper
            key={ad.id}
            {...wrapperProps}
            className="group block overflow-hidden rounded-2xl border border-white/[0.06] bg-white/[0.02] transition hover:border-white/10"
            onClick={() => trackEvent(ad.id, "click")}
            ref={(el: HTMLElement | null) => {
              if (!el || trackedRef.current.has(ad.id)) return;
              trackedRef.current.add(ad.id);
              const observer = new IntersectionObserver(
                ([entry]) => {
                  if (entry.isIntersecting) {
                    trackEvent(ad.id, "impression");
                    observer.disconnect();
                  }
                },
                { threshold: 0.5 },
              );
              observer.observe(el);
            }}
          >
            <img
              src={ad.imageUrl}
              alt="Patrocinado"
              className="h-32 w-full object-cover transition-transform duration-300 group-hover:scale-[1.03]"
            />
            <div className="px-3 py-1.5 text-[10px] text-white/25">
              Patrocinado
            </div>
          </Wrapper>
        );
      })}
    </div>
  );
}

/* ── Page ── */

export default function HomePage() {
  const [banners, setBanners] = useState<Banner[]>([]);
  const [sections, setSections] = useState<HomeSections | null>(null);
  const [summary, setSummary] = useState<HomeSummary | null>(null);
  const [stories, setStories] = useState<StoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { activeLocation } = useActiveLocation();
  const { me: _me } = useMe();

  const location = useMemo<[number, number] | null>(
    () =>
      activeLocation
        ? [activeLocation.lat, activeLocation.lng]
        : null,
    [activeLocation?.lat, activeLocation?.lng],
  );

  const cityLabel = activeLocation?.label ?? null;
  const locationLabel =
    activeLocation?.source === "manual" && cityLabel
      ? `en ${cityLabel}`
      : "cerca de ti";

  /* ── Banners (keep as-is) ── */
  useEffect(() => {
    (async () => {
      try {
        const res = await apiFetchWithRetry<{ banners: Banner[] }>("/banners");
        setBanners(res?.banners ?? []);
      } catch {
        // banners opcionales
      }
    })();
  }, []);

  /* ── VIP Sections + Summary ── */
  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError(null);

    const params = new URLSearchParams();
    if (cityLabel) params.set("city", cityLabel);
    if (location) {
      params.set("lat", String(location[0]));
      params.set("lng", String(location[1]));
    }
    params.set("limit", "12");

    const fetchSections = apiFetchWithRetry<HomeSections>(
      `/home/sections?${params.toString()}`,
      { signal: controller.signal },
    );

    const summaryParams = new URLSearchParams();
    if (cityLabel) summaryParams.set("city", cityLabel);

    const fetchSummary = apiFetchWithRetry<HomeSummary>(
      `/home/summary?${summaryParams.toString()}`,
      { signal: controller.signal },
    );

    const storiesParams = new URLSearchParams();
    if (cityLabel) storiesParams.set("city", cityLabel);

    const fetchStories = apiFetchWithRetry<{ stories: StoryItem[] }>(
      `/home/stories?${storiesParams.toString()}`,
      { signal: controller.signal },
    );

    Promise.all([fetchSections, fetchSummary, fetchStories])
      .then(([sectionsRes, summaryRes, storiesRes]) => {
        if (!controller.signal.aborted) {
          setSections({
            platinum: sectionsRes?.platinum ?? [],
            trending: sectionsRes?.trending ?? [],
            availableNow: sectionsRes?.availableNow ?? [],
            newArrivals: sectionsRes?.newArrivals ?? [],
            zones: sectionsRes?.zones ?? [],
          });
          setSummary(summaryRes ?? null);
          setStories(storiesRes?.stories ?? []);
        }
      })
      .catch((err: any) => {
        if (err?.name === "AbortError") return;
        if (err?.status === 429) {
          setError("Estamos recibiendo muchas solicitudes. Reintenta en unos segundos.");
        } else {
          setError("No se pudieron cargar las secciones destacadas.");
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });

    return () => {
      controller.abort();
    };
  }, [location, cityLabel]);

  const inlineBanners = useMemo(
    () => banners.filter((b) => (b.position || "").toUpperCase() === "INLINE"),
    [banners],
  );

  const showDistance = activeLocation?.source === "gps";

  return (
    <div className="min-h-[100dvh] overflow-x-hidden text-white antialiased">
      {/* ═══════════════════════════════════════════════
          HERO
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
              reales {locationLabel}
            </span>
          </motion.h1>

          <motion.p
            initial="hidden"
            animate="visible"
            custom={2}
            variants={fadeUp}
            className="mx-auto mt-5 max-w-lg text-base text-white/55 md:text-lg"
          >
            Conecta con profesionales, hospedajes y tiendas en segundos. Todo
            verificado, discreto y a tu medida.
          </motion.p>

          <motion.p
            initial="hidden"
            animate="visible"
            custom={2}
            variants={fadeUp}
            className="mx-auto mt-2 max-w-md text-sm text-white/35"
          >
            Selección verificada, privada y elegante.
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
            Section 0: Pulso VIP — Summary counters
           ═══════════════════════════════════════════════ */}
        {summary && (
          <motion.div
            initial="hidden"
            animate="visible"
            custom={5}
            variants={fadeUp}
            className="mb-10 flex flex-wrap items-center justify-center gap-4 rounded-2xl border border-white/[0.08] bg-[#0c0c14] px-5 py-3 text-sm sm:gap-6"
          >
            <span className="flex items-center gap-1.5 text-white/70">
              🔥
              <span className="font-semibold text-white">{summary.availableNowCount}</span>{" "}
              disponibles hoy
            </span>
            <span className="hidden h-4 w-px bg-white/10 sm:block" />
            <span className="flex items-center gap-1.5 text-white/70">
              ✨ Nuevas esta semana:{" "}
              <span className="font-semibold text-white">{summary.newThisWeekCount}</span>
            </span>
            <span className="hidden h-4 w-px bg-white/10 sm:block" />
            <span className="flex items-center gap-1.5 text-white/70">
              💎 Platino:{" "}
              <span className="font-semibold text-white">{summary.platinumCount}</span>
            </span>
          </motion.div>
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
            Stories carousel (Gold/Platinum only)
           ═══════════════════════════════════════════════ */}
        {stories.length > 0 && (
          <div className="mb-10">
            <h2 className="mb-4 text-lg font-semibold text-white/80">
              Historias
            </h2>
            <div className="scrollbar-none -mx-4 flex gap-3 overflow-x-auto px-4 pb-2 snap-x">
              {stories.map((story) => (
                <Link
                  key={story.id}
                  href={`/perfil/${story.professional.username}`}
                  className="group relative flex shrink-0 snap-start flex-col items-center gap-1.5"
                >
                  <div className="relative h-[72px] w-[72px] rounded-full p-[2px] bg-gradient-to-tr from-fuchsia-500 via-violet-500 to-cyan-400">
                    <div className="h-full w-full overflow-hidden rounded-full border-2 border-[#0e0e12]">
                      <img
                        src={resolveMediaUrl(story.professional.avatarUrl) ?? "/brand/isotipo-new.png"}
                        alt={story.professional.displayName ?? story.professional.username}
                        className="h-full w-full object-cover"
                      />
                    </div>
                  </div>
                  <span className="max-w-[72px] truncate text-[11px] text-white/60">
                    {story.professional.displayName ?? story.professional.username}
                  </span>
                </Link>
              ))}
            </div>
          </div>
        )}

        {/* ═══════════════════════════════════════════════
            Section 1: 💎 Platino — Horizontal scroll, larger cards
           ═══════════════════════════════════════════════ */}
        {(sections?.platinum?.length ?? 0) > 0 && (
          <motion.section
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: "-60px" }}
            variants={stagger}
            className="mb-16"
          >
            <motion.div variants={cardFade} className="mb-6 flex items-end justify-between">
              <div>
                <h2 className="text-2xl font-bold tracking-tight md:text-3xl">
                  💎 Platino {cityLabel ? `en ${cityLabel}` : ""}
                </h2>
                <p className="mt-1 text-sm text-white/45">
                  Selección premium, verificada y exclusiva
                </p>
              </div>
              <Link
                href="/catalog?tier=platinum"
                className="group hidden items-center gap-1.5 text-sm text-white/50 transition hover:text-cyan-300 sm:flex"
              >
                Ver todas
                <ChevronRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
              </Link>
            </motion.div>

            <div className="scrollbar-none -mx-4 flex gap-4 overflow-x-auto px-4 pb-2 snap-x snap-mandatory">
              {sections?.platinum.map((p) => (
                <motion.div
                  key={p.id}
                  variants={cardFade}
                  className="w-[70vw] shrink-0 snap-start sm:w-[280px]"
                >
                  <VipCard profile={p} aspect="aspect-[3/4]" showDistance={showDistance} />
                </motion.div>
              ))}
            </div>
          </motion.section>
        )}

        {/* ═══════════════════════════════════════════════
            Section 2: 🔥 Tendencias VIP — Grid layout
           ═══════════════════════════════════════════════ */}
        {(sections?.trending?.length ?? 0) > 0 && (
          <motion.section
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: "-60px" }}
            variants={stagger}
            className="mb-16"
          >
            <motion.div variants={cardFade} className="mb-6 flex items-end justify-between">
              <div>
                <h2 className="text-2xl font-bold tracking-tight md:text-3xl">
                  🔥 Tendencias VIP
                </h2>
                <p className="mt-1 text-sm text-white/45">
                  Las más buscadas {locationLabel}
                </p>
              </div>
              <Link
                href="/catalog?sort=trending"
                className="group hidden items-center gap-1.5 text-sm text-white/50 transition hover:text-fuchsia-400 sm:flex"
              >
                Ver todas
                <ChevronRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
              </Link>
            </motion.div>

            <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
              {sections?.trending.map((p) => (
                <motion.div key={p.id} variants={cardFade}>
                  <VipCard profile={p} showDistance={showDistance} />
                </motion.div>
              ))}
            </div>
          </motion.section>
        )}

        {/* ═══════════════════════════════════════════════
            Section 3: ⚡ Disponibles ahora
           ═══════════════════════════════════════════════ */}
        {(sections?.availableNow?.length ?? 0) > 0 && (
          <motion.section
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: "-60px" }}
            variants={stagger}
            className="mb-16"
          >
            <motion.div variants={cardFade} className="mb-6 flex items-end justify-between">
              <div>
                <h2 className="text-2xl font-bold tracking-tight md:text-3xl">
                  ⚡ Disponibles ahora
                </h2>
                <p className="mt-1 text-sm text-white/45">
                  Online y listas para conectar
                </p>
              </div>
              <Link
                href="/catalog?sort=availableNow"
                className="group hidden items-center gap-1.5 text-sm text-white/50 transition hover:text-emerald-400 sm:flex"
              >
                Ver todas
                <ChevronRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
              </Link>
            </motion.div>

            <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
              {sections?.availableNow.map((p) => (
                <motion.div key={p.id} variants={cardFade}>
                  <VipCard profile={p} showDistance={showDistance} />
                </motion.div>
              ))}
            </div>
          </motion.section>
        )}

        {/* ═══════════════════════════════════════════════
            Section 4: ✨ Recién llegadas
           ═══════════════════════════════════════════════ */}
        {(sections?.newArrivals?.length ?? 0) > 0 && (
          <motion.section
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: "-60px" }}
            variants={stagger}
            className="mb-16"
          >
            <motion.div variants={cardFade} className="mb-6 flex items-end justify-between">
              <div>
                <h2 className="text-2xl font-bold tracking-tight md:text-3xl">
                  ✨ Recién llegadas
                </h2>
                <p className="mt-1 text-sm text-white/45">
                  Nuevos perfiles para descubrir
                </p>
              </div>
              <Link
                href="/catalog?sort=new"
                className="group hidden items-center gap-1.5 text-sm text-white/50 transition hover:text-fuchsia-400 sm:flex"
              >
                Ver todas
                <ChevronRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
              </Link>
            </motion.div>

            <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
              {sections?.newArrivals.map((p) => (
                <motion.div key={p.id} variants={cardFade}>
                  <VipCard profile={p} showDistance={showDistance} />
                </motion.div>
              ))}
            </div>
          </motion.section>
        )}

        {/* ═══════════════════════════════════════════════
            Section 5: Explorar por zonas — Chip pills
           ═══════════════════════════════════════════════ */}
        {(sections?.zones?.length ?? 0) > 0 && (
          <motion.section
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: "-60px" }}
            variants={stagger}
            className="mb-16"
          >
            <motion.div variants={cardFade} className="mb-5">
              <h2 className="text-2xl font-bold tracking-tight md:text-3xl">
                📍 Explorar por zonas
              </h2>
              <p className="mt-1 text-sm text-white/45">
                Encuentra perfiles en tu zona
              </p>
            </motion.div>

            <motion.div
              variants={cardFade}
              className="scrollbar-none -mx-4 flex gap-2 overflow-x-auto px-4 pb-2 snap-x"
            >
              {sections?.zones.map((z) => (
                <Link
                  key={z.name}
                  href={`/catalog?city=${encodeURIComponent(z.name)}`}
                  className="inline-flex shrink-0 snap-start items-center gap-1.5 rounded-full border border-white/[0.1] bg-white/[0.04] px-4 py-2 text-sm text-white/70 transition-all duration-200 hover:border-fuchsia-400/30 hover:bg-fuchsia-500/10 hover:text-white"
                >
                  {z.name}
                  <span className="rounded-full bg-white/[0.08] px-1.5 py-0.5 text-[11px] text-white/50">
                    {z.count}
                  </span>
                </Link>
              ))}
            </motion.div>
          </motion.section>
        )}

        {/* ═══════════════════════════════════════════════
            Loading skeletons (before data arrives)
           ═══════════════════════════════════════════════ */}
        {loading && !sections && (
          <div className="mb-16 grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
            {[1, 2, 3, 4].map((i) => (
              <SkeletonCard key={i} />
            ))}
          </div>
        )}

        {/* ═══════════════════════════════════════════════
            AD SLOT: HOME_MIDDLE (between sections)
           ═══════════════════════════════════════════════ */}
        <AdSlotBlock position="HOME_MIDDLE" />

        {/* ═══════════════════════════════════════════════
            CTA FINAL — Descargar App
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
            📲 Descarga la app
          </h2>
          <p className="mx-auto mt-3 max-w-md text-sm text-white/50">
            Lleva Uzeed en tu bolsillo. Notificaciones discretas, acceso rápido
            y la mejor experiencia VIP desde tu celular.
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
              href="/catalog"
              className="inline-flex items-center gap-2 rounded-2xl border border-white/15 bg-white/[0.04] px-8 py-4 text-sm font-medium text-white/80 transition-all duration-200 hover:border-white/25 hover:bg-white/[0.08] w-full sm:w-auto justify-center"
            >
              Explorar catálogo
            </Link>
          </div>
        </motion.section>
      </div>
    </div>
  );
}
