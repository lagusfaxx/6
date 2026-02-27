"use client";

import { useContext, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { apiFetch, resolveMediaUrl } from "../lib/api";
import { LocationFilterContext } from "../hooks/useLocationFilter";
import useMe from "../hooks/useMe";
import UserLevelBadge from "../components/UserLevelBadge";
import Stories from "../components/Stories";
import ProfilePreviewModal from "../components/ProfilePreviewModal";
import {
  buildChatHref,
  buildCurrentPathWithSearch,
  buildLoginHref,
} from "../lib/chat";
import {
  ArrowRight,
  ChevronRight,
  Clock3,
  Crown,
  Download,
  Flame,
  Hand,
  Heart,
  Hotel,
  MapPin,
  Navigation,
  PartyPopper,
  ShoppingBag,
  Sparkles,
  Star,
  TrendingUp,
  Video,
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

type UserLevel = "SILVER" | "GOLD" | "DIAMOND";

type RecentProfessional = {
  id: string;
  name: string;
  avatarUrl: string | null;
  coverUrl?: string | null;
  distance: number | null;
  age: number | null;
  isActive: boolean;
  userLevel: UserLevel;
  completedServices: number;
  profileViews: number;
  lastSeen?: string | null;
  availableNow?: boolean;
  bio?: string | null;
  serviceCategory?: string | null;
  profileTags?: string[];
  serviceTags?: string[];
  galleryUrls?: string[];
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
  isActive: boolean;
  userLevel: UserLevel;
  completedServices: number;
  profileViews: number;
  lastSeen?: string | null;
  lastActiveAt?: string | null;
  bio?: string | null;
  serviceCategory?: string | null;
  profileTags?: string[];
  serviceTags?: string[];
  galleryUrls?: string[];
};

/* ── Helpers ── */

function resolveProfileImage(profile: DiscoverProfile | RecentProfessional) {
  return (
    resolveMediaUrl((profile as any).coverUrl) ??
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

/* ── Tier config ── */
const TIERS = [
  { key: "DIAMOND", label: "Platino", icon: Crown, gradient: "from-cyan-400 to-blue-500", border: "border-cyan-400/30", bg: "bg-cyan-500/10" },
  { key: "GOLD", label: "Gold", icon: Star, gradient: "from-amber-400 to-yellow-500", border: "border-amber-400/30", bg: "bg-amber-500/10" },
  { key: "SILVER", label: "Silver", icon: Sparkles, gradient: "from-slate-300 to-slate-400", border: "border-slate-400/30", bg: "bg-slate-500/10" },
] as const;

/* ── Page ── */

const SANTIAGO_FALLBACK: [number, number] = [-33.45, -70.66];

export default function HomePage() {
  const [banners, setBanners] = useState<Banner[]>([]);
  const [recentPros, setRecentPros] = useState<RecentProfessional[]>([]);
  const [discoverSections, setDiscoverSections] = useState<
    Record<string, DiscoverProfile[]>
  >({});
  const locationCtx = useContext(LocationFilterContext);
  const location = locationCtx?.effectiveLocation ?? SANTIAGO_FALLBACK;
  const [error, setError] = useState<string | null>(null);
  const [recentLoading, setRecentLoading] = useState(true);
  const { me } = useMe();
  const [previewProfile, setPreviewProfile] = useState<any>(null);
  const isAuthed = Boolean(me?.user?.id);

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
    params.set("limit", "30");
    const query = params.toString();

    const controller = new AbortController();

    setRecentLoading(true);

    apiFetch<{ professionals: any[] }>(`/professionals/recent?${query}`, {
      signal: controller.signal,
    })
      .then((res) => {
        const mapped: RecentProfessional[] = (res?.professionals || []).map(
          (p: any) => ({
            id: p.id,
            name: p.name || "Experiencia",
            avatarUrl: p.avatarUrl,
            coverUrl: p.coverUrl ?? null,
            distance: typeof p.distance === "number" ? p.distance : null,
            age: typeof p.age === "number" ? p.age : null,
            isActive: Boolean(p.isActive),
            availableNow: Boolean(p.availableNow),
            userLevel:
              p.userLevel === "DIAMOND" || p.userLevel === "GOLD"
                ? p.userLevel
                : "SILVER",
            completedServices: Number(p.completedServices || 0),
            profileViews: Number(p.profileViews || 0),
            lastSeen: p.lastSeen ?? null,
            bio: p.bio ?? null,
            serviceCategory: p.serviceCategory ?? null,
            profileTags: Array.isArray(p.profileTags) ? p.profileTags : [],
            serviceTags: Array.isArray(p.serviceTags) ? p.serviceTags : [],
            galleryUrls: p.galleryUrls ?? [],
          }),
        );

        setRecentPros(mapped);
      })
      .catch((err: any) => {
        if (err?.name === "AbortError") return;
      })
      .finally(() => setRecentLoading(false));

    return () => {
      controller.abort();
    };
  }, [location]);

  useEffect(() => {
    const loadSections = async () => {
      const sections = [
        { key: "available", query: { sort: "availableNow", limit: "6" } },
        { key: "near", query: { sort: "near", limit: "8" } },
        { key: "new", query: { sort: "new", limit: "8" } },
      ];
      const next: Record<string, DiscoverProfile[]> = {};
      setError(null);
      await Promise.all(
        sections.map(async (section) => {
          const qp = new URLSearchParams(
            section.query as Record<string, string>,
          );
          if (location) {
            qp.set("lat", String(location[0]));
            qp.set("lng", String(location[1]));
          }
          const res = await apiFetch<{ profiles: DiscoverProfile[] }>(
            `/profiles/discover?${qp.toString()}`,
          ).catch(() => ({ profiles: [] }));
          next[section.key] = res.profiles || [];
        }),
      );
      setDiscoverSections(next);
    };
    loadSections().catch(() =>
      setError("No se pudieron cargar las secciones destacadas."),
    );
  }, [location]);

  const horizontalBanners = useMemo(
    () => banners.filter((b) => (b.position || "").toUpperCase() === "INLINE" || (b.position || "").toUpperCase() === "HORIZONTAL"),
    [banners],
  );
  const verticalBanners = useMemo(
    () => banners.filter((b) => (b.position || "").toUpperCase() === "VERTICAL" || (b.position || "").toUpperCase() === "SIDEBAR"),
    [banners],
  );

  // Story profiles: available + recently active
  const storyProfiles = useMemo(() => {
    const available = discoverSections["available"] || [];
    const near = discoverSections["near"] || [];
    const all = [...available, ...near];
    const seen = new Set<string>();
    return all.filter((p) => {
      if (seen.has(p.id)) return false;
      seen.add(p.id);
      return true;
    }).slice(0, 15);
  }, [discoverSections]);

  // Tier-based sections
  const tierProfiles = useMemo(() => {
    const allProfiles = [...recentPros];
    return {
      DIAMOND: allProfiles.filter((p) => p.userLevel === "DIAMOND").slice(0, 6),
      GOLD: allProfiles.filter((p) => p.userLevel === "GOLD").slice(0, 6),
      SILVER: allProfiles.filter((p) => p.userLevel === "SILVER").slice(0, 6),
    };
  }, [recentPros]);

  const availableProfiles = discoverSections["available"] || [];
  const nearProfiles = discoverSections["near"] || [];
  const newProfiles = discoverSections["new"] || [];

  return (
    <div className="min-h-[100dvh] overflow-x-hidden text-white antialiased">
      {/* ═══ HERO — Compact, immersive ═══ */}
      <section className="relative flex min-h-[50vh] items-center justify-center overflow-hidden px-4 md:min-h-[55vh]">
        <div className="pointer-events-none absolute inset-0 -z-10 bg-[#070816]" />
        <div className="pointer-events-none absolute inset-0 -z-10 bg-[url('/brand/bg.jpg')] bg-cover bg-center opacity-20" />
        <div className="pointer-events-none absolute inset-0 -z-10 bg-gradient-to-b from-transparent via-[#070816]/50 to-[#0e0e12]" />
        <div className="pointer-events-none absolute left-1/2 top-1/3 -z-10 h-[600px] w-[600px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-violet-600/[0.12] blur-[120px]" />

        <div className="relative mx-auto max-w-3xl text-center">
          <motion.div initial="hidden" animate="visible" custom={0} variants={fadeUp} className="mb-4 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-4 py-1.5 text-xs text-white/60 backdrop-blur-xl">
            <Zap className="h-3.5 w-3.5 text-fuchsia-400" />
            Plataforma #1 de experiencias en Chile
          </motion.div>

          <motion.h1 initial="hidden" animate="visible" custom={1} variants={fadeUp} className="text-3xl font-bold leading-[1.1] tracking-tight md:text-5xl">
            <span className="bg-gradient-to-r from-white via-white to-white/70 bg-clip-text text-transparent">Descubre experiencias</span>
            <br />
            <span className="bg-gradient-to-r from-fuchsia-400 via-violet-400 to-fuchsia-300 bg-clip-text text-transparent">reales cerca de ti</span>
          </motion.h1>

          <motion.p initial="hidden" animate="visible" custom={2} variants={fadeUp} className="mx-auto mt-4 max-w-lg text-sm text-white/55 md:text-base">
            Conecta con profesionales, hospedajes y tiendas en segundos. Todo verificado, discreto y a tu medida.
          </motion.p>

          <motion.div initial="hidden" animate="visible" custom={3} variants={fadeUp} className="mt-6 flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
            <Link
              href="/servicios"
              className="group relative inline-flex w-full items-center justify-center gap-2 overflow-hidden rounded-2xl bg-gradient-to-r from-fuchsia-600 to-violet-600 px-8 py-4 text-sm font-semibold shadow-[0_12px_40px_rgba(168,85,247,0.25)] transition-all duration-200 hover:scale-[1.03] sm:w-auto"
            >
              Explorar ahora
              <ArrowRight className="h-4 w-4 transition-transform duration-200 group-hover:translate-x-0.5" />
            </Link>
            <a
              href="#"
              className="inline-flex w-full items-center justify-center gap-2 rounded-2xl border border-white/15 bg-white/[0.04] px-8 py-4 text-sm font-medium text-white/80 backdrop-blur-xl transition-all duration-200 hover:border-white/25 hover:bg-white/[0.08] sm:w-auto"
            >
              <Download className="h-4 w-4" />
              Descargar App
            </a>
          </motion.div>
        </div>
      </section>

      {/* Main content */}
      <div className="relative mx-auto max-w-6xl overflow-hidden px-4 pb-16">
        {/* Vertical banner sidebar */}
        {verticalBanners.length > 0 && (
          <div className="absolute right-0 top-0 hidden w-[160px] space-y-3 xl:block" style={{ marginRight: "-180px" }}>
            {verticalBanners.slice(0, 3).map((b) => (
              <a key={b.id} href={b.linkUrl ?? "#"} className="block overflow-hidden rounded-xl border border-white/[0.08]">
                <img src={b.imageUrl} alt={b.title} className="w-full object-cover" />
              </a>
            ))}
          </div>
        )}

        {error && (
          <div className="mb-6 rounded-xl border border-red-500/20 bg-red-500/10 p-4 text-sm text-red-200">{error}</div>
        )}

        {/* ═══ STORIES ═══ */}
        <section className="mb-6">
          <Stories />
        </section>

        {/* ═══ CATEGORÍAS — Quick access for easy navigation ═══ */}
        <section className="mb-8 sm:hidden">
          <div className="grid grid-cols-4 gap-2 sm:grid-cols-7 sm:gap-3">
            {[
              { label: "Escorts", href: "/escorts", icon: Heart, color: "from-pink-600/20 to-fuchsia-600/10" },
              { label: "Masajistas", href: "/masajistas", icon: Hand, color: "from-violet-600/20 to-purple-600/10" },
              { label: "Moteles", href: "/moteles", icon: Hotel, color: "from-rose-600/20 to-red-600/10" },
              { label: "Sex Shop", href: "/sexshop", icon: ShoppingBag, color: "from-fuchsia-600/20 to-pink-600/10" },
              { label: "Despedidas", href: "/escorts?serviceTags=despedidas", icon: PartyPopper, color: "from-amber-600/20 to-orange-600/10" },
              { label: "Videollamadas", href: "/escorts?serviceTags=videollamadas", icon: Video, color: "from-blue-600/20 to-cyan-600/10" },
              { label: "Cerca tuyo", href: "/servicios", icon: MapPin, color: "from-emerald-600/20 to-green-600/10" },
            ].map((cat) => (
              <Link
                key={cat.href}
                href={cat.href}
                className={`group flex flex-col items-center gap-1.5 rounded-2xl border border-white/[0.06] bg-gradient-to-br ${cat.color} px-2 py-3 text-center transition hover:border-fuchsia-500/20 hover:scale-[1.04]`}
              >
                <cat.icon className="h-6 w-6 text-white/80" />
                <span className="text-[10px] font-medium text-white/70 leading-tight sm:text-xs">{cat.label}</span>
              </Link>
            ))}
          </div>
        </section>

        {/* ═══ DISPONIBLE AHORA — Compact horizontal scroll ═══ */}
        {availableProfiles.length > 0 && (
          <section className="mb-8">
            <div className="mb-3 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Clock3 className="h-4 w-4 text-emerald-400" />
                <h2 className="text-base font-bold">Disponibles ahora</h2>
              </div>
              <Link href="/servicios?sort=availableNow" className="group flex items-center gap-1 text-xs text-white/50 hover:text-fuchsia-400">
                Ver todas <ChevronRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
              </Link>
            </div>
            <div className="scrollbar-none -mx-4 flex gap-2.5 overflow-x-auto px-4 pb-2 snap-x">
              {availableProfiles.slice(0, 8).map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => setPreviewProfile(p)}
                  className="group w-[130px] shrink-0 snap-start overflow-hidden rounded-xl border border-white/[0.08] bg-white/[0.03] text-left transition hover:border-fuchsia-500/20"
                >
                  <div className="relative aspect-[3/4] overflow-hidden">
                    <img src={resolveProfileImage(p)} alt={p.displayName} className="h-full w-full object-cover transition group-hover:scale-105" />
                    <div className="absolute left-1.5 top-1.5 flex items-center gap-1 rounded-full bg-emerald-500/20 px-1.5 py-0.5 text-[9px] text-emerald-200 border border-emerald-300/20">
                      <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-400" />
                      Online
                    </div>
                    <div className="absolute inset-0 bg-gradient-to-t from-black/70 to-transparent" />
                    <div className="absolute bottom-1.5 left-1.5 right-1.5">
                      <div className="truncate text-xs font-semibold">{p.displayName}{p.age ? `, ${p.age}` : ""}</div>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </section>
        )}

        {/* ═══ TIER SECTIONS: Platino / Gold / Silver ═══ */}
        {TIERS.map((tier) => {
          const profiles = tierProfiles[tier.key] || [];
          if (!profiles.length) return null;
          const Icon = tier.icon;
          return (
            <motion.section key={tier.key} initial="hidden" whileInView="visible" viewport={{ once: true, margin: "-60px" }} variants={stagger} className="mb-10">
              <motion.div variants={cardFade} className="mb-4 flex items-end justify-between">
                <div className="flex items-center gap-2">
                  <Icon className={`h-5 w-5 bg-gradient-to-r ${tier.gradient} bg-clip-text text-transparent`} />
                  <h2 className="text-xl font-bold">{tier.label}</h2>
                </div>
                <Link href="/profesionales" className="group flex items-center gap-1 text-xs text-white/50 hover:text-fuchsia-400">
                  Ver todas <ChevronRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
                </Link>
              </motion.div>
              <div className="scrollbar-none -mx-4 flex gap-3 overflow-x-auto px-4 pb-2 snap-x snap-mandatory sm:mx-0 sm:grid sm:grid-cols-2 sm:overflow-visible sm:px-0 md:grid-cols-3">
                {profiles.map((p) => (
                  <motion.div key={p.id} variants={cardFade} className="w-[70vw] shrink-0 snap-start sm:w-auto">
                    <button
                      type="button"
                      onClick={() => setPreviewProfile({ ...p, displayName: p.name, username: p.name, distanceKm: p.distance })}
                      className={`group relative block w-full overflow-hidden rounded-2xl border ${tier.border} bg-white/[0.03] text-left transition-all duration-200 hover:-translate-y-1 hover:shadow-[0_20px_60px_rgba(0,0,0,0.4)]`}
                    >
                      <div className="relative aspect-[4/5] overflow-hidden bg-gradient-to-br from-white/5 to-transparent">
                        {p.avatarUrl || p.coverUrl ? (
                          <img
                            src={resolveProfileImage(p)}
                            alt={p.name}
                            className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.06]"
                            onError={(e) => { (e.currentTarget as HTMLImageElement).src = "/brand/isotipo-new.png"; }}
                          />
                        ) : (
                          <div className="flex h-full items-center justify-center">
                            <img src="/brand/isotipo-new.png" alt="" className="h-20 w-20 opacity-30" />
                          </div>
                        )}
                        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />
                        {p.distance != null && (
                          <div className="absolute right-3 top-3 flex items-center gap-1 rounded-full border border-white/10 bg-black/50 px-2 py-1 text-[11px] text-white/80 backdrop-blur-xl">
                            <MapPin className="h-3 w-3" />
                            {p.distance.toFixed(1)} km
                          </div>
                        )}
                        <UserLevelBadge level={p.userLevel} className="absolute left-3 top-3 px-2.5 py-1 text-[11px]" />
                        {p.availableNow && (
                          <div className="absolute left-3 bottom-12 flex items-center gap-1 rounded-full bg-emerald-500/20 border border-emerald-300/20 px-2 py-0.5 text-[10px] text-emerald-200">
                            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-400" />
                            Disponible
                          </div>
                        )}
                        <div className="absolute bottom-0 left-0 right-0 p-4">
                          <h3 className="text-lg font-semibold leading-tight">{p.name}</h3>
                          <div className="mt-1 flex items-center gap-3 text-xs text-white/60">
                            {p.age && <span>{p.age} años</span>}
                            <span>{formatLastSeenLabel(p.lastSeen)}</span>
                          </div>
                          {(p.serviceCategory || (p.profileTags && p.profileTags.length > 0) || (p.serviceTags && p.serviceTags.length > 0)) && (
                            <div className="flex flex-wrap gap-1 mt-1">
                              {p.profileTags?.map((tag) => (
                                <span key={`pt-${tag}`} className="inline-flex items-center rounded-full bg-purple-500/20 border border-purple-400/30 px-2 py-0.5 text-[9px] font-medium text-purple-300">{tag}</span>
                              ))}
                              {p.serviceCategory && (
                                <span className="inline-flex items-center rounded-full bg-purple-500/20 border border-purple-400/30 px-2 py-0.5 text-[9px] font-medium text-purple-300">{p.serviceCategory}</span>
                              )}
                              {p.serviceTags?.slice(0, 10).map((tag) => (
                                <span key={`st-${tag}`} className="inline-flex items-center rounded-full bg-purple-500/20 border border-purple-400/30 px-2 py-0.5 text-[9px] font-medium text-purple-300">{tag}</span>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                    </button>
                  </motion.div>
                ))}
              </div>
            </motion.section>
          );
        })}

        {/* ═══ DESTACADAS ═══ */}
        {recentPros.length > 0 && (
          <motion.section initial="hidden" whileInView="visible" viewport={{ once: true, margin: "-60px" }} variants={stagger} className="mb-10">
            <motion.div variants={cardFade} className="mb-4 flex items-end justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <Flame className="h-4 w-4 text-fuchsia-400" />
                  <span className="text-xs font-medium uppercase tracking-wider text-fuchsia-400/80">Destacadas</span>
                </div>
                <h2 className="text-xl font-bold tracking-tight md:text-2xl">Experiencias cerca de ti</h2>
              </div>
              <Link href="/profesionales" className="group hidden items-center gap-1.5 text-sm text-white/50 transition hover:text-white sm:flex">
                Ver todas <ChevronRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
              </Link>
            </motion.div>
            <div className="scrollbar-none -mx-4 flex gap-3 overflow-x-auto px-4 pb-2 snap-x snap-mandatory sm:mx-0 sm:grid sm:grid-cols-2 sm:gap-4 sm:overflow-visible sm:px-0 md:grid-cols-3 lg:grid-cols-4">
              {recentPros.slice(0, 8).map((p) => (
                <motion.div key={p.id} variants={cardFade} className="w-[65vw] shrink-0 snap-start sm:w-auto">
                  <button
                    type="button"
                    onClick={() => setPreviewProfile({ ...p, displayName: p.name, username: p.name, distanceKm: p.distance })}
                    className="group relative block w-full overflow-hidden rounded-2xl border border-white/[0.08] bg-white/[0.03] text-left transition-all duration-200 hover:-translate-y-1 hover:border-fuchsia-500/20"
                  >
                    <div className="relative aspect-[3/4] overflow-hidden bg-gradient-to-br from-white/5 to-transparent">
                      <img
                        src={resolveProfileImage(p)}
                        alt={p.name}
                        className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.06]"
                        onError={(e) => { (e.currentTarget as HTMLImageElement).src = "/brand/isotipo-new.png"; }}
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/10 to-transparent" />
                      {p.distance != null && (
                        <div className="absolute right-2 top-2 flex items-center gap-1 rounded-full border border-white/10 bg-black/50 px-2 py-0.5 text-[10px] text-white/80">
                          <MapPin className="h-3 w-3" /> {p.distance.toFixed(1)} km
                        </div>
                      )}
                      <UserLevelBadge level={p.userLevel} className="absolute left-2 top-2 px-2 py-0.5 text-[10px]" />
                      <div className="absolute bottom-0 left-0 right-0 p-3">
                        <h3 className="text-sm font-semibold leading-tight">{p.name}{p.age ? `, ${p.age}` : ""}</h3>
                        <div className="mt-0.5 text-[10px] text-white/50">{formatLastSeenLabel(p.lastSeen)}</div>
                        {(p.serviceCategory || (p.profileTags && p.profileTags.length > 0) || (p.serviceTags && p.serviceTags.length > 0)) && (
                          <div className="flex flex-wrap gap-1 mt-1">
                            {p.profileTags?.map((tag) => (
                              <span key={`pt-${tag}`} className="inline-flex items-center rounded-full bg-purple-500/20 border border-purple-400/30 px-2 py-0.5 text-[9px] font-medium text-purple-300">{tag}</span>
                            ))}
                            {p.serviceCategory && (
                              <span className="inline-flex items-center rounded-full bg-purple-500/20 border border-purple-400/30 px-2 py-0.5 text-[9px] font-medium text-purple-300">{p.serviceCategory}</span>
                            )}
                            {p.serviceTags?.slice(0, 10).map((tag) => (
                              <span key={`st-${tag}`} className="inline-flex items-center rounded-full bg-purple-500/20 border border-purple-400/30 px-2 py-0.5 text-[9px] font-medium text-purple-300">{tag}</span>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  </button>
                </motion.div>
              ))}
            </div>
            <Link href="/profesionales" className="mt-3 flex items-center justify-center gap-1.5 rounded-2xl border border-white/10 bg-white/[0.03] py-3 text-sm text-white/60 transition hover:bg-white/[0.06] sm:hidden">
              Ver todas las experiencias <ChevronRight className="h-4 w-4" />
            </Link>
          </motion.section>
        )}

        {/* ═══ Horizontal banners ═══ */}
        {horizontalBanners.length > 0 && (
          <div className="mb-10 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {horizontalBanners.slice(0, 4).map((b) => (
              <a key={b.id} href={b.linkUrl ?? "#"} className="group block overflow-hidden rounded-2xl border border-white/[0.08] bg-white/[0.03] transition-all duration-200 hover:border-white/15 hover:bg-white/[0.06]">
                <div className="overflow-hidden">
                  <img src={resolveMediaUrl(b.imageUrl) ?? b.imageUrl} alt={b.title} className="h-28 w-full object-contain transition-transform duration-300 group-hover:scale-105" />
                </div>
                <div className="p-3 text-sm text-white/70">{b.title}</div>
              </a>
            ))}
          </div>
        )}

        {/* ═══ CERCA DE TI — Grid for abundance ═══ */}
        {nearProfiles.length > 0 && (
          <motion.section initial="hidden" whileInView="visible" viewport={{ once: true, margin: "-60px" }} variants={stagger} className="mb-10">
            <motion.div variants={cardFade} className="mb-4 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Navigation className="h-4 w-4 text-fuchsia-300" />
                <h2 className="text-xl font-bold">Cerca de ti</h2>
              </div>
              <Link href="/servicios?sort=near" className="group flex items-center gap-1 text-xs text-white/50 hover:text-fuchsia-400">
                Ver mapa <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
              </Link>
            </motion.div>
            <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-4">
              {nearProfiles.map((profile) => (
                <motion.article key={profile.id} variants={cardFade} className="group overflow-hidden rounded-2xl border border-white/[0.08] bg-white/[0.03] transition-all duration-200 hover:-translate-y-1 hover:border-fuchsia-500/20">
                  <button type="button" onClick={() => setPreviewProfile(profile)} className="block w-full text-left">
                    <div className="relative aspect-[3/4] bg-white/[0.04]">
                      <img src={resolveProfileImage(profile)} alt={profile.displayName} className="h-full w-full object-cover transition group-hover:scale-105" />
                      {profile.distanceKm != null && (
                        <div className="absolute right-2 top-2 rounded-full border border-white/10 bg-black/50 px-2 py-0.5 text-[10px] text-white/80">
                          {profile.distanceKm.toFixed(1)} km
                        </div>
                      )}
                      {profile.availableNow && (
                        <div className="absolute left-2 top-2 flex items-center gap-1 rounded-full border border-emerald-300/20 bg-emerald-500/20 px-1.5 py-0.5 text-[9px] text-emerald-200">
                          <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-400" /> Online
                        </div>
                      )}
                      <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
                      <div className="absolute bottom-0 left-0 right-0 p-2">
                        <div className="truncate text-xs font-semibold">{profile.displayName}{profile.age ? `, ${profile.age}` : ""}</div>
                        {((profile as any).profileTags?.length > 0 || (profile as any).serviceTags?.length > 0 || profile.serviceCategory) && (
                          <div className="flex flex-wrap gap-0.5 mt-0.5">
                            {(profile as any).profileTags?.slice(0, 2).map((tag: string) => (
                              <span key={`pt-${tag}`} className="inline-flex items-center rounded-full bg-purple-500/20 border border-purple-400/30 px-1.5 py-0 text-[8px] font-medium text-purple-300">{tag}</span>
                            ))}
                            {(profile as any).serviceTags?.slice(0, 3).map((tag: string) => (
                              <span key={`st-${tag}`} className="inline-flex items-center rounded-full bg-purple-500/20 border border-purple-400/30 px-1.5 py-0 text-[8px] font-medium text-purple-300">{tag}</span>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  </button>
                </motion.article>
              ))}
            </div>
          </motion.section>
        )}

        {/* ═══ NUEVAS ═══ */}
        {newProfiles.length > 0 && (
          <motion.section initial="hidden" whileInView="visible" viewport={{ once: true, margin: "-60px" }} variants={stagger} className="mb-10">
            <motion.div variants={cardFade} className="mb-4 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-violet-400" />
                <h2 className="text-xl font-bold">Nuevas</h2>
              </div>
              <Link href="/servicios?sort=new" className="group flex items-center gap-1 text-xs text-white/50 hover:text-fuchsia-400">
                Ver todas <ChevronRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
              </Link>
            </motion.div>
            <div className="scrollbar-none -mx-4 flex gap-3 overflow-x-auto px-4 pb-2 snap-x snap-mandatory sm:mx-0 sm:grid sm:grid-cols-2 sm:overflow-visible sm:px-0 lg:grid-cols-4">
              {newProfiles.map((profile) => (
                <motion.article key={profile.id} variants={cardFade} className="group w-[65vw] shrink-0 snap-start overflow-hidden rounded-2xl border border-white/[0.08] bg-white/[0.03] transition-all duration-200 hover:-translate-y-1 hover:border-fuchsia-500/20 sm:w-auto">
                  <button type="button" onClick={() => setPreviewProfile(profile)} className="block w-full text-left">
                    <div className="relative aspect-[3/4] bg-white/[0.04]">
                      <img src={resolveProfileImage(profile)} alt={profile.displayName} className="h-full w-full object-cover transition group-hover:scale-105" />
                      <UserLevelBadge level={profile.userLevel} className="absolute right-2 top-2 px-2 py-0.5 text-[10px]" />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
                      <div className="absolute bottom-0 left-0 right-0 p-2">
                        <div className="truncate text-xs font-semibold">{profile.displayName}{profile.age ? `, ${profile.age}` : ""}</div>
                        <div className="mt-0.5 text-[10px] text-white/45">{formatLastSeenLabel(profile.lastActiveAt || profile.lastSeen)}</div>
                        {((profile as any).profileTags?.length > 0 || (profile as any).serviceTags?.length > 0) && (
                          <div className="flex flex-wrap gap-0.5 mt-0.5">
                            {(profile as any).profileTags?.slice(0, 2).map((tag: string) => (
                              <span key={`pt-${tag}`} className="inline-flex items-center rounded-full bg-purple-500/20 border border-purple-400/30 px-1.5 py-0 text-[8px] font-medium text-purple-300">{tag}</span>
                            ))}
                            {(profile as any).serviceTags?.slice(0, 3).map((tag: string) => (
                              <span key={`st-${tag}`} className="inline-flex items-center rounded-full bg-purple-500/20 border border-purple-400/30 px-1.5 py-0 text-[8px] font-medium text-purple-300">{tag}</span>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  </button>
                </motion.article>
              ))}
            </div>
          </motion.section>
        )}

        {/* ═══ TENDENCIAS ═══ */}
        {recentPros.length > 6 && (
          <motion.section initial="hidden" whileInView="visible" viewport={{ once: true, margin: "-60px" }} variants={stagger} className="mb-10">
            <motion.div variants={cardFade} className="mb-4">
              <div className="flex items-center gap-2">
                <TrendingUp className="h-4 w-4 text-violet-400" />
                <h2 className="text-xl font-bold">Las más buscadas</h2>
              </div>
            </motion.div>
            <motion.div variants={cardFade} className="grid gap-2 md:grid-cols-2 lg:grid-cols-3">
              {recentPros.slice(6, 12).map((p) => (
                <Link key={`trend-${p.id}`} href={`/profesional/${p.id}`} className="group flex items-center gap-3 rounded-2xl border border-white/[0.08] bg-white/[0.03] p-3 transition-all duration-200 hover:-translate-y-0.5 hover:border-white/15 hover:bg-white/[0.06]">
                  <div className="relative h-14 w-14 shrink-0 overflow-hidden rounded-xl bg-gradient-to-br from-white/5 to-transparent">
                    {p.avatarUrl ? (
                      <img src={resolveMediaUrl(p.avatarUrl) ?? undefined} alt={p.name} className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-110" />
                    ) : (
                      <div className="flex h-full items-center justify-center"><img src="/brand/isotipo-new.png" alt="" className="h-7 w-7 opacity-30" /></div>
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-semibold">{p.name}</div>
                    <div className="mt-0.5 flex items-center gap-2 text-xs text-white/45">
                      {p.age && <span>{p.age} años</span>}
                      {p.distance != null && <span className="flex items-center gap-0.5"><MapPin className="h-3 w-3" />{p.distance.toFixed(1)} km</span>}
                    </div>
                  </div>
                  <ChevronRight className="h-4 w-4 shrink-0 text-white/20 transition group-hover:text-fuchsia-400" />
                </Link>
              ))}
            </motion.div>
          </motion.section>
        )}

        {/* ═══ CTA — Registration (guests only) ═══ */}
        {!isAuthed && (
          <motion.section initial="hidden" whileInView="visible" viewport={{ once: true, margin: "-60px" }} custom={0} variants={fadeUp} className="relative overflow-hidden rounded-3xl border border-white/[0.08] bg-gradient-to-br from-fuchsia-600/[0.08] via-violet-600/[0.05] to-transparent p-8 text-center md:p-10">
            <div className="pointer-events-none absolute left-1/2 top-1/2 -z-10 h-[300px] w-[300px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-fuchsia-600/10 blur-[80px]" />
            <h2 className="text-xl font-bold tracking-tight md:text-2xl">¿Listo para explorar?</h2>
            <p className="mx-auto mt-3 max-w-md text-sm text-white/50">Crea tu cuenta gratis y descubre lo mejor cerca de ti.</p>
            <div className="mt-5 flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
              <Link href="/register?type=CLIENT" className="group inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-fuchsia-600 to-violet-600 px-6 py-3 text-sm font-semibold shadow-[0_12px_40px_rgba(168,85,247,0.25)] transition-all duration-200 hover:scale-[1.03] sm:w-auto">
                Registro Cliente <ArrowRight className="h-4 w-4" />
              </Link>
              <Link href="/register?type=PROFESSIONAL" className="inline-flex w-full items-center justify-center gap-2 rounded-2xl border border-fuchsia-400/30 bg-fuchsia-500/10 px-6 py-3 text-sm font-semibold text-fuchsia-200 transition hover:bg-fuchsia-500/20 sm:w-auto">
                Registro Profesional
              </Link>
              <Link href="/register?type=ESTABLISHMENT" className="inline-flex w-full items-center justify-center gap-2 rounded-2xl border border-white/15 bg-white/[0.04] px-6 py-3 text-sm font-medium text-white/80 transition hover:bg-white/[0.08] sm:w-auto">
                Registro Comercio
              </Link>
            </div>
          </motion.section>
        )}
      </div>

      {/* Profile Preview Modal */}
      {previewProfile && (
        <ProfilePreviewModal profile={previewProfile} onClose={() => setPreviewProfile(null)} />
      )}
    </div>
  );
}
