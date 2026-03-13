"use client";

import { useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { AnimatePresence, motion } from "framer-motion";
import { apiFetch, isRateLimitError, resolveMediaUrl } from "../lib/api";
import { LocationFilterContext } from "../hooks/useLocationFilter";
import useMe from "../hooks/useMe";
import UserLevelBadge from "../components/UserLevelBadge";
import { filterUserTags, hasPremiumBadge, hasVerifiedBadge } from "../lib/systemBadges";
import StatusBadgeIcon from "../components/StatusBadgeIcon";
import Stories from "../components/Stories";
import ProfilePreviewModal from "../components/ProfilePreviewModal";
import HomeCreAccordion from "../components/HomeCreAccordion";
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
  ShieldCheck,
  ShoppingBag,
  Sparkles,
  Star,
  TrendingUp,
  Users,
  Video,
  X,
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

type PopupPromotion = {
  id: string;
  sortOrder: number;
  promoImageUrl: string;
  adTier?: "STANDARD" | "GOLD";
  professional: {
    id: string;
    name: string;
    username?: string | null;
    isOnline?: boolean;
    rating: number | null;
    reviewsCount: number;
    profileUrl: string;
  };
};

function PromoShowcaseSection({ promotions }: { promotions: PopupPromotion[] }) {
  const showcasePromotions = promotions;
  const [activeIndex, setActiveIndex] = useState(0);
  const [isPaused, setIsPaused] = useState(false);

  useEffect(() => {
    if (!showcasePromotions.length) return;
    setActiveIndex((prev) => prev % showcasePromotions.length);
  }, [showcasePromotions.length]);

  // Dynamic duration: GOLD = 10s, STANDARD = 5s
  useEffect(() => {
    if (showcasePromotions.length <= 1 || isPaused) return;
    const currentPromo = showcasePromotions[activeIndex];
    const duration = currentPromo?.adTier === "GOLD" ? 10000 : 5000;
    const timeout = window.setTimeout(() => {
      setActiveIndex((prev) => (prev + 1) % showcasePromotions.length);
    }, duration);
    return () => window.clearTimeout(timeout);
  }, [isPaused, showcasePromotions.length, activeIndex, showcasePromotions]);

  if (!showcasePromotions.length) return null;

  const activePromo = showcasePromotions[activeIndex];
  const imageSrc = resolveMediaUrl(activePromo.promoImageUrl) || activePromo.promoImageUrl;
  const isGold = activePromo.adTier === "GOLD";
  const rating = Math.max(0, Math.min(5, Math.round(Number(activePromo.professional.rating || 0))));

  return (
    <section className="mb-6">
      {/* Label */}
      <div className="mb-1.5 flex items-center gap-2">
        <span className="text-[9px] font-semibold uppercase tracking-wider text-white/30">
          Promocionado
        </span>
      </div>
      <div
        className="relative mx-auto w-full max-w-3xl"
        onMouseEnter={() => setIsPaused(true)}
        onMouseLeave={() => setIsPaused(false)}
        onPointerDown={() => setIsPaused(true)}
        onPointerUp={() => setIsPaused(false)}
      >
        <Link
          href={activePromo.professional.profileUrl}
          className={`group promo-showcase-card relative block h-[140px] sm:h-[160px] w-full overflow-hidden rounded-xl border bg-[#0c0a14] shadow-lg ${isGold ? "promo-showcase-card--gold border-transparent" : "border-white/10"}`}
        >
          <AnimatePresence mode="wait">
            <motion.div
              key={activePromo.id}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.4, ease: "easeOut" }}
              className="absolute inset-0"
            >
              <img src={imageSrc} alt={activePromo.professional.name} className="h-full w-full object-cover" />
              <div className="absolute inset-0 bg-gradient-to-r from-black/80 via-black/40 to-black/20" />

              {/* Content — horizontal layout */}
              <div className="absolute inset-0 flex items-center p-4 sm:p-5">
                <div className="min-w-0 flex-1">
                  <span className={`inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[8px] font-bold uppercase tracking-widest ${isGold ? "bg-[#FFD700]/20 text-[#FFE8A3]" : "bg-white/10 text-white/50"}`}>
                    <Zap className="h-2.5 w-2.5" /> Promocionado
                  </span>
                  <h3 className="mt-1 truncate text-sm font-bold text-white sm:text-base">{activePromo.professional.name}</h3>
                  <div className="mt-0.5 flex items-center gap-1.5 text-[10px]">
                    <div className="flex items-center gap-0.5 text-amber-300">
                      {Array.from({ length: 5 }).map((_, idx) => (
                        <Star key={`promo-star-${idx}`} className={`h-3 w-3 ${idx < rating ? "fill-current" : "text-white/20"}`} />
                      ))}
                    </div>
                    <span className="text-white/50">({activePromo.professional.reviewsCount})</span>
                    {activePromo.professional.isOnline && (
                      <span className="flex items-center gap-1 text-emerald-300">
                        <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-400" /> Online
                      </span>
                    )}
                  </div>
                  <div className={`mt-2 inline-flex items-center gap-1 rounded-lg px-3 py-1.5 text-[10px] font-bold transition-all group-hover:scale-105 ${isGold ? "bg-gradient-to-r from-[#FFD700] to-[#FDB931] text-[#2b1a00]" : "bg-gradient-to-r from-fuchsia-600 to-violet-600 text-white"}`}>
                    Ver perfil <ArrowRight className="h-3 w-3" />
                  </div>
                </div>
              </div>
            </motion.div>
          </AnimatePresence>

          {isGold ? (
            <>
              <div className="promo-showcase-gold-border pointer-events-none absolute inset-0 rounded-xl" />
              <div className="promo-showcase-gold-shimmer pointer-events-none absolute inset-0 rounded-xl" />
              <div className="promo-showcase-gold-glow pointer-events-none absolute -inset-1 -z-10 rounded-xl" />
            </>
          ) : null}
        </Link>

        {/* Progress bars */}
        {showcasePromotions.length > 1 ? (
          <div className="mt-2 flex items-center justify-center gap-1">
            {showcasePromotions.map((promo, idx) => {
              const isCurrent = idx === activeIndex;
              const dotIsGold = promo.adTier === "GOLD";
              const duration = dotIsGold ? 10 : 5;
              return (
                <button
                  key={`promo-bar-${promo.id}`}
                  type="button"
                  aria-label={`Ir al banner ${idx + 1}`}
                  onClick={() => {
                    setIsPaused(true);
                    setActiveIndex(idx);
                  }}
                  className={`relative overflow-hidden rounded-full transition-all duration-300 ${dotIsGold ? "h-1.5 flex-[2]" : "h-1 flex-1"} ${isCurrent ? "" : "opacity-40 hover:opacity-70"}`}
                  style={{ maxWidth: dotIsGold ? 60 : 40 }}
                >
                  <div className={`absolute inset-0 ${dotIsGold ? "bg-amber-400/30" : "bg-white/15"}`} />
                  {isCurrent && !isPaused && (
                    <div
                      className={`absolute inset-y-0 left-0 rounded-full ${dotIsGold ? "bg-amber-400" : "bg-fuchsia-400"}`}
                      style={{ animation: `promo-progress ${duration}s linear forwards` }}
                    />
                  )}
                  {isCurrent && isPaused && (
                    <div className={`absolute inset-y-0 left-0 rounded-full ${dotIsGold ? "bg-amber-400" : "bg-fuchsia-400"}`} style={{ width: "50%" }} />
                  )}
                  {!isCurrent && idx < activeIndex && (
                    <div className={`absolute inset-0 rounded-full ${dotIsGold ? "bg-amber-400/60" : "bg-white/30"}`} />
                  )}
                </button>
              );
            })}
          </div>
        ) : null}
      </div>
    </section>
  );
}

type UserLevel = "SILVER" | "GOLD" | "DIAMOND";

type FeaturedBannerProfile = {
  id: string;
  name: string;
  city?: string | null;
  avatarUrl?: string | null;
  coverUrl?: string | null;
  category?: string | null;
  age?: number | null;
};

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
  profileType?: "PROFESSIONAL" | "ESTABLISHMENT" | "SHOP" | "CREATOR";
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

/* ── Badge helpers (mirrors /servicios logic) ── */

function hasExamsBadge(p: { profileTags?: string[] }) {
  return (p.profileTags || []).some((t) => {
    const n = String(t || "").trim().toLowerCase();
    return n === "profesional con examenes" || n === "profesional con exámenes";
  });
}

function hasVideoCallBadge(p: { serviceTags?: string[]; profileTags?: string[] }) {
  const all = [...(p.serviceTags || []), ...(p.profileTags || [])];
  return all.some((t) => {
    const n = String(t || "").trim().toLowerCase();
    return n === "videollamada" || n === "videollamadas";
  });
}

/* ── Install App Button ── */
function InstallAppButton() {
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [showInstructions, setShowInstructions] = useState(false);
  const [isIOS, setIsIOS] = useState(false);
  const [isStandalone, setIsStandalone] = useState(false);

  useEffect(() => {
    const ios = /iPad|iPhone|iPod/.test(navigator.userAgent);
    setIsIOS(ios);
    setIsStandalone(window.matchMedia("(display-mode: standalone)").matches || (navigator as any).standalone === true);
    const handler = (e: Event) => { e.preventDefault(); setDeferredPrompt(e); };
    window.addEventListener("beforeinstallprompt", handler);
    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

  if (isStandalone) return null;

  async function handleClick() {
    if (deferredPrompt) {
      deferredPrompt.prompt();
      await deferredPrompt.userChoice;
      setDeferredPrompt(null);
    } else {
      setShowInstructions(true);
    }
  }

  return (
    <>
      <button
        onClick={handleClick}
        className="inline-flex w-full items-center justify-center gap-2 rounded-2xl border border-white/15 bg-white/[0.04] px-8 py-4 text-sm font-medium text-white/80 backdrop-blur-xl transition-all duration-200 hover:border-white/25 hover:bg-white/[0.08] sm:w-auto"
      >
        <Download className="h-4 w-4" />
        Descargar App
      </button>

      {showInstructions && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/70 backdrop-blur-md" onClick={() => setShowInstructions(false)}>
          <div className="w-full sm:max-w-md rounded-t-3xl sm:rounded-3xl border border-white/10 bg-[#0e0e12] p-6 space-y-5" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-bold">Instalar Uzeed</h3>
              <button onClick={() => setShowInstructions(false)} className="rounded-full border border-white/10 bg-white/5 p-2 text-white/50 hover:text-white">
                <X className="h-4 w-4" />
              </button>
            </div>

            {isIOS ? (
              <div className="space-y-4">
                <p className="text-sm text-white/60">Para instalar la app en tu iPhone o iPad:</p>
                <div className="space-y-3">
                  <div className="flex items-start gap-3">
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-fuchsia-500/15 text-fuchsia-300 text-sm font-bold">1</div>
                    <p className="text-sm text-white/70 pt-1">Toca el botón <strong className="text-white">Compartir</strong> <span className="inline-block align-middle text-blue-400">(cuadrado con flecha)</span> en Safari</p>
                  </div>
                  <div className="flex items-start gap-3">
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-fuchsia-500/15 text-fuchsia-300 text-sm font-bold">2</div>
                    <p className="text-sm text-white/70 pt-1">Desliza y toca <strong className="text-white">&ldquo;Agregar a pantalla de inicio&rdquo;</strong></p>
                  </div>
                  <div className="flex items-start gap-3">
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-fuchsia-500/15 text-fuchsia-300 text-sm font-bold">3</div>
                    <p className="text-sm text-white/70 pt-1">Confirma tocando <strong className="text-white">&ldquo;Agregar&rdquo;</strong></p>
                  </div>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                <p className="text-sm text-white/60">Para instalar la app en tu dispositivo:</p>
                <div className="space-y-3">
                  <div className="flex items-start gap-3">
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-fuchsia-500/15 text-fuchsia-300 text-sm font-bold">1</div>
                    <p className="text-sm text-white/70 pt-1">Toca el menú <strong className="text-white">&#8942;</strong> (tres puntos) en tu navegador</p>
                  </div>
                  <div className="flex items-start gap-3">
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-fuchsia-500/15 text-fuchsia-300 text-sm font-bold">2</div>
                    <p className="text-sm text-white/70 pt-1">Selecciona <strong className="text-white">&ldquo;Instalar aplicación&rdquo;</strong> o <strong className="text-white">&ldquo;Agregar a pantalla de inicio&rdquo;</strong></p>
                  </div>
                  <div className="flex items-start gap-3">
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-fuchsia-500/15 text-fuchsia-300 text-sm font-bold">3</div>
                    <p className="text-sm text-white/70 pt-1">Confirma la instalación</p>
                  </div>
                </div>
              </div>
            )}

            <div className="rounded-xl border border-fuchsia-500/20 bg-fuchsia-500/5 p-3 text-center text-xs text-fuchsia-200/80">
              La app se abrirá como una aplicación nativa sin barra del navegador
            </div>
          </div>
        </div>
      )}
    </>
  );
}

/* ── Animated Hero Counters ── */

function useAnimatedCounter(target: number, duration: number, start: boolean) {
  const [value, setValue] = useState(0);
  useEffect(() => {
    if (!start || target <= 0) return;
    let raf: number;
    const startTime = performance.now();
    const tick = (now: number) => {
      const elapsed = now - startTime;
      const progress = Math.min(elapsed / duration, 1);
      // ease-out cubic
      const eased = 1 - Math.pow(1 - progress, 3);
      setValue(Math.round(eased * target));
      if (progress < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, duration, start]);
  return value;
}

function HeroCounters() {
  const [stats, setStats] = useState<{ professionals: number; services: number } | null>(null);
  const [animate, setAnimate] = useState(false);

  useEffect(() => {
    apiFetch<{ professionals: number; services: number }>("/stats/platform")
      .then((res) => setStats(res))
      .catch((err) => console.warn("[HeroCounters] failed to load platform stats", err));
  }, []);

  useEffect(() => {
    // If splash was already shown (user navigated back to home), animate immediately;
    // otherwise wait ~3s for the splash screen to finish before starting counters.
    const splashAlreadyShown =
      sessionStorage.getItem("uzeed_splash_shown") === "true";
    const delay = splashAlreadyShown ? 200 : 3000;
    const timer = setTimeout(() => setAnimate(true), delay);
    return () => clearTimeout(timer);
  }, []);

  // Apply 50% margin above real values, rounded to nearest 10
  const prosTarget = stats ? Math.ceil((stats.professionals * 1.5) / 10) * 10 : 0;
  const servicesTarget = stats ? Math.ceil((stats.services * 1.5) / 10) * 10 : 0;
  const comunasFixed = 300;

  const prosCount = useAnimatedCounter(prosTarget, 2000, animate && prosTarget > 0);
  const servicesCount = useAnimatedCounter(servicesTarget, 2000, animate && servicesTarget > 0);
  const comunasCount = useAnimatedCounter(comunasFixed, 2000, animate);

  const counters = [
    { value: prosCount, suffix: "+", label: "profesionales", icon: Users },
    { value: servicesCount, suffix: "+", label: "servicios completados", icon: Sparkles },
    { value: comunasCount, suffix: "+", label: "comunas", icon: MapPin },
  ];

  return (
    <motion.div
      initial="hidden"
      animate={animate ? "visible" : "hidden"}
      variants={{
        hidden: { opacity: 0, y: 16 },
        visible: {
          opacity: 1,
          y: 0,
          transition: { duration: 0.6, ease: [0.16, 1, 0.3, 1] },
        },
      }}
      className="mt-8 flex items-center justify-center gap-6 sm:gap-10"
    >
      {counters.map((c, i) => (
        <div key={i} className="group/stat flex cursor-default flex-col items-center gap-1">
          <c.icon className="mb-1 h-4 w-4 text-fuchsia-400/70 transition-all duration-150 group-hover/stat:text-fuchsia-400 group-hover/stat:drop-shadow-[0_0_6px_rgba(192,132,252,0.5)]" />
          <span className="text-xl font-bold tabular-nums tracking-tight text-white/90 transition-transform duration-150 group-hover/stat:scale-110 sm:text-2xl">
            {c.value}{c.suffix}
          </span>
          <span className="text-[11px] text-white/40 sm:text-xs">{c.label}</span>
        </div>
      ))}
    </motion.div>
  );
}

/* ── Videollamadas CTA Banner ── */

function VideollamadasBanner() {
  const [count, setCount] = useState(0);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    apiFetch<{ videocallProfessionals: number }>("/stats/platform")
      .then((res) => {
        setCount(res.videocallProfessionals ?? 0);
        setLoaded(true);
      })
      .catch((err) => {
        console.warn("[VideollamadasBanner] failed to load stats", err);
        setLoaded(true);
      });
  }, []);

  const animatedCount = useAnimatedCounter(count, 1500, loaded && count > 0);

  return (
    <section className="mb-8">
      <Link
        href="/videocall"
        className="group relative flex items-center gap-4 overflow-hidden rounded-2xl border border-indigo-400/25 bg-gradient-to-r from-indigo-600/20 via-blue-600/15 to-violet-600/10 px-5 py-4 backdrop-blur-sm transition-all hover:border-indigo-400/40 hover:shadow-[0_8px_32px_rgba(99,102,241,0.18)]"
      >
        {/* subtle inner glow */}
        <div className="pointer-events-none absolute inset-0 rounded-2xl bg-gradient-to-br from-indigo-500/[0.07] to-transparent" />

        <div className="relative flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-500 to-violet-600 shadow-lg shadow-indigo-500/30">
          <Video className="h-6 w-6 text-white" />
        </div>
        <div className="relative flex-1 min-w-0">
          <h3 className="text-sm font-bold text-white">Videollamadas privadas</h3>
          {loaded && count > 0 && (
            <p className="mt-0.5 text-xs font-medium text-indigo-300/90">
              +{animatedCount} profesionales disponibles
            </p>
          )}
          <p className="mt-0.5 text-xs text-white/45">Conecta al instante por videollamada. Inmediata, privada y segura.</p>
        </div>
        <ChevronRight className="relative h-5 w-5 shrink-0 text-white/30 transition-transform group-hover:translate-x-1 group-hover:text-white/60" />
      </Link>
    </section>
  );
}

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
  const [promoShowcase, setPromoShowcase] = useState<PopupPromotion[]>([]);
  const [bannerProfiles, setBannerProfiles] = useState<Record<string, FeaturedBannerProfile>>({});
  const [discoverSections, setDiscoverSections] = useState<
    Record<string, DiscoverProfile[]>
  >({});
  const locationCtx = useContext(LocationFilterContext);
  const location = locationCtx?.effectiveLocation ?? SANTIAGO_FALLBACK;
  const [error, setError] = useState<string | null>(null);
  const [recentLoading, setRecentLoading] = useState(true);
  const { me } = useMe();
  const [previewProfile, setPreviewProfile] = useState<any>(null);
  const availableSectionRef = useRef<HTMLElement | null>(null);
  const availableCarouselRef = useRef<HTMLDivElement | null>(null);
  const [isAvailableInView, setIsAvailableInView] = useState(true);
  const [isAvailableInteracting, setIsAvailableInteracting] = useState(false);
  const isDraggingRef = useRef(false);
  const didDragRef = useRef(false);
  const dragStartXRef = useRef(0);
  const dragScrollLeftRef = useRef(0);
  const isAuthed = Boolean(me?.user?.id);

  /* ── Hoteles & Sexshop ── */
  const [moteles, setMoteles] = useState<any[]>([]);
  const [sexshops, setSexshops] = useState<any[]>([]);

  /* ── Live Streams ── */
  const [liveStreams, setLiveStreams] = useState<any[]>([]);

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
    let mounted = true;

    const loadPromotions = async () => {
      try {
        const res = await apiFetch<{ promotions: PopupPromotion[] }>("/popup-promotions");
        if (mounted) setPromoShowcase(res?.promotions ?? []);
      } catch {
        if (mounted) setPromoShowcase([]);
      }

    };

    loadPromotions();
    const id = window.setInterval(loadPromotions, 30_000);

    return () => {
      mounted = false;
      window.clearInterval(id);
    };
  }, []);

  useEffect(() => {
    const profileBannerIds = banners
      .map((b) => (b.linkUrl || "").startsWith("profile:") ? (b.linkUrl || "").slice("profile:".length) : "")
      .filter(Boolean);

    if (!profileBannerIds.length) {
      setBannerProfiles({});
      return;
    }

    Promise.all(
      Array.from(new Set(profileBannerIds)).map(async (id) => {
        try {
          const res = await apiFetch<{ professional: any }>(`/professionals/${id}`);
          const p = res?.professional;
          if (!p) return null;
          return [id, {
            id,
            name: p.name || "Perfil",
            city: p.city ?? null,
            avatarUrl: p.avatarUrl ?? null,
            coverUrl: p.coverUrl ?? null,
            category: p.category ?? null,
            age: typeof p.age === "number" ? p.age : null,
          } satisfies FeaturedBannerProfile] as const;
        } catch {
          return null;
        }
      }),
    ).then((entries) => {
      const map: Record<string, FeaturedBannerProfile> = {};
      for (const entry of entries) {
        if (!entry) continue;
        map[entry[0]] = entry[1];
      }
      setBannerProfiles(map);
    });
  }, [banners]);

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

        // Sort by distance first — closest profiles always on top
        mapped.sort((a, b) => (a.distance ?? 1e9) - (b.distance ?? 1e9));

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
    const controller = new AbortController();
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
            { signal: controller.signal },
          ).catch((err) => {
            // On any error, preserve existing data (return null to skip update)
            if (err?.name === "AbortError") return null;
            if (isRateLimitError(err)) return null;
            return null;
          });
          if (res) next[section.key] = res.profiles || [];
        }),
      );
      if (!controller.signal.aborted) {
        setDiscoverSections((prev) => ({ ...prev, ...next }));
      }
    };
    loadSections().catch(() => {
      if (!controller.signal.aborted) {
        setError("No se pudieron cargar las secciones destacadas.");
      }
    });
    return () => { controller.abort(); };
  }, [location]);

  // ── Fetch moteles & sexshops ──
  useEffect(() => {
    const controller = new AbortController();
    const fetchDirectory = async (entityType: string, categorySlug: string) => {
      const params = new URLSearchParams({ entityType, categorySlug, sort: "near", limit: "8" });
      if (location) {
        params.set("lat", String(location[0]));
        params.set("lng", String(location[1]));
        params.set("radiusKm", "100");
      }
      const res = await apiFetch<{ results: any[]; total: number }>(
        `/directory/search?${params.toString()}`,
        { signal: controller.signal },
      );
      return res?.results ?? [];
    };

    fetchDirectory("establishment", "motel").then(setMoteles).catch(() => {});
    fetchDirectory("shop", "sexshop").then(setSexshops).catch(() => {});

    // Fetch active live streams
    apiFetch<{ streams: any[] }>("/live/active", { signal: controller.signal })
      .then((r) => setLiveStreams(r?.streams ?? []))
      .catch(() => {});

    return () => { controller.abort(); };
  }, [location]);

  const horizontalBanners = useMemo(
    () => banners.filter((b) => (b.position || "").toUpperCase() === "INLINE" || (b.position || "").toUpperCase() === "HORIZONTAL"),
    [banners],
  );
  const verticalBanners = useMemo(
    () => banners.filter((b) => (b.position || "").toUpperCase() === "VERTICAL" || (b.position || "").toUpperCase() === "SIDEBAR"),
    [banners],
  );
  const sideBanners = useMemo(() => [...verticalBanners, ...horizontalBanners], [verticalBanners, horizontalBanners]);
  const leftSideBanners = useMemo(() => sideBanners.filter((_, i) => i % 2 === 0).slice(0, 3), [sideBanners]);
  const rightSideBanners = useMemo(() => sideBanners.filter((_, i) => i % 2 === 1).slice(0, 3), [sideBanners]);

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

  // Tier-based sections — already sorted by distance from API
  const tierProfiles = useMemo(() => {
    return {
      DIAMOND: recentPros.filter((p) => p.userLevel === "DIAMOND").slice(0, 6),
      GOLD: recentPros.filter((p) => p.userLevel === "GOLD").slice(0, 6),
      SILVER: recentPros.filter((p) => p.userLevel === "SILVER").slice(0, 6),
    };
  }, [recentPros]);

  const availableProfiles = discoverSections["available"] || [];
  const availableCarouselProfiles = useMemo(
    () => (availableProfiles.length > 0 ? [...availableProfiles, ...availableProfiles] : []),
    [availableProfiles],
  );
  const shouldAutoScrollAvailable = availableProfiles.length > 1 && isAvailableInView && !isAvailableInteracting;
  const nearProfiles = discoverSections["near"] || [];
  const newProfiles = discoverSections["new"] || [];

  useEffect(() => {
    if (!availableSectionRef.current || typeof IntersectionObserver === "undefined") return;
    const observer = new IntersectionObserver(
      ([entry]) => setIsAvailableInView(entry.isIntersecting),
      { threshold: 0.35 },
    );
    observer.observe(availableSectionRef.current);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!availableCarouselRef.current) return;
    availableCarouselRef.current.scrollTo({ left: 0, behavior: "auto" });
  }, [availableProfiles]);

  useEffect(() => {
    if (!shouldAutoScrollAvailable || !availableCarouselRef.current) return;
    const carousel = availableCarouselRef.current;

    let rafId = 0;
    let lastTs = 0;
    let position = carousel.scrollLeft;
    let loopWidth = 0;
    const speedPxPerSecond = 24;

    const tick = (ts: number) => {
      if (!loopWidth) {
        loopWidth = carousel.scrollWidth / 2;
        if (!loopWidth) {
          rafId = window.requestAnimationFrame(tick);
          return;
        }
      }

      if (!lastTs) {
        lastTs = ts;
        rafId = window.requestAnimationFrame(tick);
        return;
      }

      const delta = ts - lastTs;
      lastTs = ts;

      position += (speedPxPerSecond * delta) / 1000;
      if (position >= loopWidth) position -= loopWidth;
      carousel.scrollLeft = position;

      rafId = window.requestAnimationFrame(tick);
    };

    rafId = window.requestAnimationFrame(tick);
    return () => window.cancelAnimationFrame(rafId);
  }, [shouldAutoScrollAvailable, availableCarouselProfiles.length]);

  const handleAvailablePointerDown = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    const carousel = availableCarouselRef.current;
    if (!carousel) return;
    isDraggingRef.current = true;
    didDragRef.current = false;
    dragStartXRef.current = e.clientX;
    dragScrollLeftRef.current = carousel.scrollLeft;
    setIsAvailableInteracting(true);
  }, []);

  const handleAvailablePointerMove = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    if (!isDraggingRef.current) return;
    const carousel = availableCarouselRef.current;
    if (!carousel) return;
    const dx = e.clientX - dragStartXRef.current;
    if (Math.abs(dx) > 3) {
      if (!didDragRef.current) {
        didDragRef.current = true;
        carousel.setPointerCapture(e.pointerId);
      }
      e.preventDefault();
      carousel.scrollLeft = dragScrollLeftRef.current - dx;
    }
  }, []);

  const handleAvailablePointerUp = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    if (!isDraggingRef.current) return;
    isDraggingRef.current = false;
    setIsAvailableInteracting(false);
    const carousel = availableCarouselRef.current;
    if (carousel && didDragRef.current) carousel.releasePointerCapture(e.pointerId);
  }, []);

  const handleAvailableCardClick = useCallback((p: DiscoverProfile) => {
    if (!didDragRef.current) setPreviewProfile(p);
  }, []);

  const bannerHref = (banner: Banner) => {
    const profileId = (banner.linkUrl || "").startsWith("profile:") ? (banner.linkUrl || "").slice("profile:".length) : "";
    return profileId ? `/profesional/${profileId}` : (banner.linkUrl || "#");
  };

  const renderProfileBanner = (banner: Banner) => {
    const profileId = (banner.linkUrl || "").startsWith("profile:") ? (banner.linkUrl || "").slice("profile:".length) : "";
    const profile = profileId ? bannerProfiles[profileId] : null;
    const mediaSrc = resolveMediaUrl(banner.imageUrl) || banner.imageUrl;
    const fallbackImage = resolveMediaUrl(profile?.coverUrl || profile?.avatarUrl || "") || profile?.coverUrl || profile?.avatarUrl || "";
    const isVideo = /\.(mp4|mov|webm)(\?|$)/i.test(mediaSrc || "") || (banner.title || "").toLowerCase().includes("video");
    return (
      <div className="group/ad relative h-full w-full overflow-hidden">
        {isVideo ? (
          <video src={mediaSrc} className="h-full w-full object-cover transition-transform duration-500 group-hover/ad:scale-105" autoPlay muted loop playsInline />
        ) : (
          <img src={fallbackImage || mediaSrc} alt={profile?.name || "Banner publicitario"} className="h-full w-full object-cover transition-transform duration-500 group-hover/ad:scale-105" />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/30 to-transparent" />
        {/* Ad label */}
        <div className="absolute left-1.5 top-1.5">
          <span className="rounded bg-black/40 px-1 py-0.5 text-[7px] font-semibold uppercase tracking-widest text-white/40 backdrop-blur-sm">Ad</span>
        </div>
        {/* Content */}
        <div className="absolute inset-x-0 bottom-0 p-2">
          <div className="truncate text-xs font-bold text-white">{profile?.name || banner.title}</div>
          {(profile?.city || profile?.category) && (
            <div className="mt-0.5 flex items-center gap-0.5 text-[9px] text-white/60">
              {profile?.city && <MapPin className="h-2.5 w-2.5" />}
              <span className="truncate">{profile?.city || profile?.category}</span>
            </div>
          )}
          <div className="mt-1.5 flex items-center justify-center gap-0.5 rounded-md bg-gradient-to-r from-fuchsia-600 to-violet-600 px-2 py-1 text-[9px] font-bold text-white">
            Ver perfil <ArrowRight className="h-2.5 w-2.5" />
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-[100dvh] overflow-x-hidden text-white antialiased">
      {/* ═══ HERO — Compact, immersive ═══ */}
      <section className="relative flex min-h-[50vh] items-center justify-center overflow-hidden px-4 md:min-h-[55vh]">
        <div className="pointer-events-none absolute inset-0 -z-10 bg-[#070816]" />
        <div className="pointer-events-none absolute inset-0 -z-10 bg-[url('/brand/bg.jpg')] bg-cover bg-center opacity-20" />
        <div className="pointer-events-none absolute inset-0 -z-10 bg-gradient-to-b from-transparent via-[#070816]/50 to-[#0e0e12]" />
        <div className="pointer-events-none absolute left-1/2 top-1/3 -z-10 h-[600px] w-[600px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-violet-600/[0.12] blur-[120px] animate-hero-drift" />

        <div className="relative mx-auto max-w-3xl text-center">
          <motion.div initial="hidden" animate="visible" custom={0} variants={fadeUp} className="mb-4 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-4 py-1.5 text-xs text-white/60 backdrop-blur-xl">
            <Zap className="h-3.5 w-3.5 text-fuchsia-400" />
            Plataforma #1 de experiencias en Chile
          </motion.div>

          <motion.h1 initial="hidden" animate="visible" custom={1} variants={fadeUp} className="text-3xl font-bold leading-[1.1] tracking-tight md:text-5xl">
            <span className="bg-gradient-to-r from-white via-white to-white/70 bg-clip-text text-transparent">Escorts, masajes y experiencias reales cerca de ti</span>
          </motion.h1>

          <motion.h2 initial="hidden" animate="visible" custom={2} variants={fadeUp} className="mx-auto mt-4 max-w-2xl text-sm font-medium text-white/70 md:text-base">
            Las mejores Escorts y Putas en Santiago, Las Condes y regiones. Todo lo que buscas en un entorno discreto, verificado y premium.
          </motion.h2>

          <motion.div initial="hidden" animate="visible" custom={3} variants={fadeUp} className="mt-6 flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
            <Link
              href="/servicios"
              className="group relative inline-flex w-full items-center justify-center gap-2 overflow-hidden rounded-2xl bg-gradient-to-r from-fuchsia-600 to-violet-600 px-8 py-4 text-sm font-semibold transition-all duration-200 hover:scale-[1.03] animate-btn-glow sm:w-auto"
            >
              Explorar ahora
              <ArrowRight className="h-4 w-4 transition-transform duration-200 group-hover:translate-x-0.5" />
            </Link>
            <InstallAppButton />
          </motion.div>

          <HeroCounters />
        </div>
      </section>

      {/* Main content */}
      <div className="relative mx-auto max-w-6xl overflow-visible px-4 pb-16">
        {/* Side ad banners (desktop) */}
        {leftSideBanners.length > 0 && (
          <div className="absolute left-0 top-0 hidden w-[160px] space-y-3 2xl:block" style={{ marginLeft: "-180px" }}>
            {leftSideBanners.map((b) => (
              <a key={`left-${b.id}`} href={bannerHref(b)} className="group block h-[260px] overflow-hidden rounded-xl border border-white/[0.08] bg-[#0c0a14] shadow-md transition-all duration-300 hover:border-fuchsia-500/20 hover:shadow-lg hover:-translate-y-0.5">
                {renderProfileBanner(b)}
              </a>
            ))}
          </div>
        )}
        {rightSideBanners.length > 0 && (
          <div className="absolute right-0 top-0 hidden w-[160px] space-y-3 2xl:block" style={{ marginRight: "-180px" }}>
            {rightSideBanners.map((b) => (
              <a key={`right-${b.id}`} href={bannerHref(b)} className="group block h-[260px] overflow-hidden rounded-xl border border-white/[0.08] bg-[#0c0a14] shadow-md transition-all duration-300 hover:border-fuchsia-500/20 hover:shadow-lg hover:-translate-y-0.5">
                {renderProfileBanner(b)}
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
        <section className="mb-8">
          {/* Mobile: prominent grid with icons */}
          <div className="grid grid-cols-4 gap-2 sm:hidden">
            {[
              { label: "Escorts", href: "/escorts", icon: Sparkles, gradient: "from-fuchsia-600/20 to-pink-600/20", borderColor: "border-fuchsia-500/25" },
              { label: "Masajistas", href: "/masajistas", icon: Hand, gradient: "from-violet-600/20 to-purple-600/20", borderColor: "border-violet-500/25" },
              { label: "Moteles", href: "/moteles", icon: Hotel, gradient: "from-amber-600/20 to-orange-600/20", borderColor: "border-amber-500/25" },
              { label: "Sex Shop", href: "/sexshop", icon: ShoppingBag, gradient: "from-rose-600/20 to-red-600/20", borderColor: "border-rose-500/25" },
              { label: "Despedidas", href: "/escorts?serviceTags=despedidas", icon: PartyPopper, gradient: "from-cyan-600/20 to-teal-600/20", borderColor: "border-cyan-500/25" },
              { label: "Videollamadas", href: "/videocall", icon: Video, gradient: "from-blue-600/20 to-indigo-600/20", borderColor: "border-blue-500/25" },
              { label: "Cerca tuyo", href: "/servicios", icon: Navigation, gradient: "from-emerald-600/20 to-green-600/20", borderColor: "border-emerald-500/25" },
              { label: "Premium", href: "/premium", icon: Crown, gradient: "from-amber-600/20 to-yellow-600/20", borderColor: "border-amber-500/25" },
            ].map((cat) => (
              <Link
                key={cat.href}
                href={cat.href}
                className={`group flex flex-col items-center gap-1.5 rounded-2xl border ${cat.borderColor} bg-gradient-to-br ${cat.gradient} px-2 py-3 transition-all active:scale-[0.95] hover:brightness-125`}
              >
                <cat.icon className="h-5 w-5 text-white/80" />
                <span className="text-[10px] font-semibold text-white/80 text-center leading-tight">{cat.label}</span>
              </Link>
            ))}
          </div>
          {/* Desktop: horizontal pills */}
          <div className="hidden sm:flex gap-2 overflow-x-auto pb-1 scrollbar-none">
            {[
              { label: "Escorts", href: "/escorts", icon: Sparkles },
              { label: "Masajistas", href: "/masajistas", icon: Hand },
              { label: "Moteles", href: "/moteles", icon: Hotel },
              { label: "Sex Shop", href: "/sexshop", icon: ShoppingBag },
              { label: "Despedidas", href: "/escorts?serviceTags=despedidas", icon: PartyPopper },
              { label: "Videollamadas", href: "/videocall", icon: Video },
              { label: "Cerca tuyo", href: "/servicios", icon: Navigation },
            ].map((cat) => (
              <Link
                key={cat.href}
                href={cat.href}
                className="group flex shrink-0 items-center gap-2 rounded-full border border-white/[0.08] bg-white/[0.04] px-5 py-2.5 transition-all hover:border-fuchsia-500/25 hover:bg-fuchsia-500/[0.06] active:scale-[0.97]"
              >
                <cat.icon className="h-4 w-4 text-fuchsia-400/80" />
                <span className="text-sm font-medium text-white/75">{cat.label}</span>
              </Link>
            ))}
          </div>
        </section>

        {/* ═══ VIDEOLLAMADAS CTA BANNER ═══ */}
        <VideollamadasBanner />

        {/* ═══ DISPONIBLE AHORA — Compact horizontal scroll ═══ */}
        <section ref={availableSectionRef} className="mb-8">
            <div className="mb-3 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Clock3 className="h-4 w-4 text-emerald-400" />
                <h2 className="text-base font-bold">Disponibles ahora</h2>
              </div>
              <Link href="/servicios?sort=availableNow" className="group flex items-center gap-1 text-xs text-white/50 hover:text-fuchsia-400">
                Ver todas <ChevronRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
              </Link>
            </div>
            {availableProfiles.length > 0 ? (
              <div
                ref={availableCarouselRef}
                className="scrollbar-none -mx-4 flex gap-2.5 overflow-x-auto px-4 pb-2 cursor-grab active:cursor-grabbing select-none"
                style={{ touchAction: "pan-x" }}
                onPointerDown={handleAvailablePointerDown}
                onPointerMove={handleAvailablePointerMove}
                onPointerUp={handleAvailablePointerUp}
                onPointerCancel={handleAvailablePointerUp}
              >
                {availableCarouselProfiles.map((p, index) => (
                  <button
                    key={`${p.id}-${index}`}
                    data-available-card="true"
                    type="button"
                    onClick={() => handleAvailableCardClick(p)}
                    className="group w-[130px] shrink-0 overflow-hidden rounded-2xl border border-white/10 bg-gradient-to-b from-white/[0.08] to-white/[0.03] text-left transition-all duration-300 hover:-translate-y-0.5 hover:border-fuchsia-500/30"
                  >
                    <div className="relative aspect-[3/4] overflow-hidden">
                      <img src={resolveProfileImage(p)} alt={p.displayName} className="h-full w-full object-cover transition duration-500 group-hover:scale-105" />
                      <div className="absolute left-2 top-2 flex items-center gap-1 rounded-full border border-emerald-300/20 bg-emerald-500/20 px-2 py-0.5 text-[9px] text-emerald-100">
                        <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-300" />
                        Disponible
                      </div>
                      <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/10 to-transparent" />
                      <div className="absolute bottom-2 left-2 right-2">
                        <div className="truncate text-xs font-semibold text-white">{p.displayName}{p.age ? `, ${p.age}` : ""}</div>
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            ) : (
              <div className="rounded-2xl border border-white/10 bg-gradient-to-b from-white/[0.06] to-white/[0.02] p-5">
                <p className="text-sm text-white/80">No hay perfiles disponibles en este momento.</p>
                <p className="mt-1 text-xs text-white/50">Explora perfiles verificados y vuelve a intentar en unos minutos.</p>
                <Link
                  href="/servicios"
                  className="mt-4 inline-flex items-center gap-1.5 rounded-xl border border-fuchsia-400/30 bg-fuchsia-500/10 px-3 py-2 text-xs font-medium text-fuchsia-200 transition hover:border-fuchsia-300/50 hover:bg-fuchsia-500/20"
                >
                  Ver perfiles <ChevronRight className="h-3.5 w-3.5" />
                </Link>
              </div>
            )}
          </section>

        {/* ═══ BANNERS PUBLICITARIOS ═══ */}
        {horizontalBanners.length > 0 && (
          <section className="mb-8 2xl:hidden">
            <div className="mb-2 flex items-center gap-2">
              <span className="inline-flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wider text-white/30">
                <Zap className="h-3 w-3" /> Promocionado
              </span>
            </div>
            <div className="scrollbar-none -mx-4 flex gap-2.5 overflow-x-auto px-4 pb-2 snap-x">
              {horizontalBanners.map((b) => (
                <a
                  key={b.id}
                  href={bannerHref(b)}
                  className="relative block h-[32vh] max-h-[260px] min-h-[180px] w-[150px] shrink-0 snap-start overflow-hidden rounded-xl border border-white/[0.08] bg-[#0c0a14] shadow-md transition-all duration-300 hover:-translate-y-0.5 hover:border-fuchsia-500/20 hover:shadow-lg sm:h-[240px] sm:max-h-[240px]"
                >
                  {renderProfileBanner(b)}
                </a>
              ))}
            </div>
          </section>
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
                      <div className="absolute left-2 top-2 flex flex-col gap-1">
                        {profile.availableNow && (
                          <div className="flex items-center gap-1 rounded-full border border-emerald-300/20 bg-emerald-500/20 px-1.5 py-0.5 text-[9px] text-emerald-200">
                            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-400" /> Online
                          </div>
                        )}
                        {hasExamsBadge(profile as any) && (
                          <div className="inline-flex items-center gap-1 rounded-full border border-sky-300/40 bg-sky-500/20 px-1.5 py-0.5 text-[9px] font-medium text-sky-100 backdrop-blur shadow">
                            <ShieldCheck className="h-2.5 w-2.5" /> Exámenes
                          </div>
                        )}
                        {hasVideoCallBadge(profile as any) && (
                          <div className="inline-flex items-center gap-1 rounded-full border border-violet-300/40 bg-violet-500/25 px-1.5 py-0.5 text-[9px] font-medium text-violet-100 backdrop-blur shadow">
                            <Video className="h-2.5 w-2.5" /> Videollamadas
                          </div>
                        )}
                      </div>
                      <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
                      <div className="absolute bottom-0 left-0 right-0 p-2">
                        <div className="flex items-center gap-1 truncate text-xs font-semibold">
                          {profile.displayName}{profile.age ? `, ${profile.age}` : ""}
                          {hasPremiumBadge((profile as any).profileTags) && <StatusBadgeIcon type="premium" size="h-3 w-3" />}
                          {hasVerifiedBadge((profile as any).profileTags) && <StatusBadgeIcon type="verificada" size="h-3 w-3" />}
                        </div>
                        {(filterUserTags((profile as any).profileTags).length > 0 || (profile as any).serviceTags?.length > 0 || profile.serviceCategory) && (
                          <div className="flex flex-wrap gap-0.5 mt-0.5">
                            {filterUserTags((profile as any).profileTags).slice(0, 2).map((tag: string) => (
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
                        <div className="absolute left-3 top-3 flex flex-col gap-1">
                          <UserLevelBadge level={p.userLevel} className="px-2.5 py-1 text-[11px]" />
                          {hasExamsBadge(p) && (
                            <div className="inline-flex items-center gap-1 rounded-full border border-sky-300/40 bg-sky-500/20 px-1.5 py-0.5 text-[9px] font-medium text-sky-100 backdrop-blur shadow">
                              <ShieldCheck className="h-2.5 w-2.5" /> Exámenes
                            </div>
                          )}
                          {hasVideoCallBadge(p) && (
                            <div className="inline-flex items-center gap-1 rounded-full border border-violet-300/40 bg-violet-500/25 px-1.5 py-0.5 text-[9px] font-medium text-violet-100 backdrop-blur shadow">
                              <Video className="h-2.5 w-2.5" /> Videollamadas
                            </div>
                          )}
                        </div>
                        {p.availableNow && (
                          <div className="absolute left-3 bottom-12 flex items-center gap-1 rounded-full bg-emerald-500/20 border border-emerald-300/20 px-2 py-0.5 text-[10px] text-emerald-200">
                            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-400" />
                            Disponible
                          </div>
                        )}
                        <div className="absolute bottom-0 left-0 right-0 p-4">
                          <h3 className="flex items-center gap-1 text-lg font-semibold leading-tight">
                            {p.name}
                            {hasPremiumBadge(p.profileTags) && <StatusBadgeIcon type="premium" size="h-4 w-4" />}
                            {hasVerifiedBadge(p.profileTags) && <StatusBadgeIcon type="verificada" size="h-4 w-4" />}
                          </h3>
                          <div className="mt-1 flex items-center gap-3 text-xs text-white/60">
                            {p.age && <span>{p.age} años</span>}
                            <span>{formatLastSeenLabel(p.lastSeen)}</span>
                          </div>
                          {(p.serviceCategory || (filterUserTags(p.profileTags).length > 0) || (p.serviceTags && p.serviceTags.length > 0)) && (
                            <div className="flex flex-wrap gap-1 mt-1">
                              {filterUserTags(p.profileTags).map((tag) => (
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
                      <div className="absolute left-2 top-2 flex flex-col gap-1">
                        <UserLevelBadge level={p.userLevel} className="px-2 py-0.5 text-[10px]" />
                        {hasExamsBadge(p) && (
                          <div className="inline-flex items-center gap-1 rounded-full border border-sky-300/40 bg-sky-500/20 px-1.5 py-0.5 text-[9px] font-medium text-sky-100 backdrop-blur shadow">
                            <ShieldCheck className="h-2.5 w-2.5" /> Exámenes
                          </div>
                        )}
                        {hasVideoCallBadge(p) && (
                          <div className="inline-flex items-center gap-1 rounded-full border border-violet-300/40 bg-violet-500/25 px-1.5 py-0.5 text-[9px] font-medium text-violet-100 backdrop-blur shadow">
                            <Video className="h-2.5 w-2.5" /> Videollamadas
                          </div>
                        )}
                      </div>
                      <div className="absolute bottom-0 left-0 right-0 p-3">
                        <h3 className="flex items-center gap-1 text-sm font-semibold leading-tight">
                          {p.name}{p.age ? `, ${p.age}` : ""}
                          {hasPremiumBadge(p.profileTags) && <StatusBadgeIcon type="premium" size="h-3 w-3" />}
                          {hasVerifiedBadge(p.profileTags) && <StatusBadgeIcon type="verificada" size="h-3 w-3" />}
                        </h3>
                        <div className="mt-0.5 text-[10px] text-white/50">{formatLastSeenLabel(p.lastSeen)}</div>
                        {(p.serviceCategory || (filterUserTags(p.profileTags).length > 0) || (p.serviceTags && p.serviceTags.length > 0)) && (
                          <div className="flex flex-wrap gap-1 mt-1">
                            {filterUserTags(p.profileTags).map((tag) => (
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
                      <div className="absolute left-2 top-2 flex flex-col gap-1">
                        {hasExamsBadge(profile as any) && (
                          <div className="inline-flex items-center gap-1 rounded-full border border-sky-300/40 bg-sky-500/20 px-1.5 py-0.5 text-[9px] font-medium text-sky-100 backdrop-blur shadow">
                            <ShieldCheck className="h-2.5 w-2.5" /> Exámenes
                          </div>
                        )}
                        {hasVideoCallBadge(profile as any) && (
                          <div className="inline-flex items-center gap-1 rounded-full border border-violet-300/40 bg-violet-500/25 px-1.5 py-0.5 text-[9px] font-medium text-violet-100 backdrop-blur shadow">
                            <Video className="h-2.5 w-2.5" /> Videollamadas
                          </div>
                        )}
                      </div>
                      <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
                      <div className="absolute bottom-0 left-0 right-0 p-2">
                        <div className="flex items-center gap-1 truncate text-xs font-semibold">
                          {profile.displayName}{profile.age ? `, ${profile.age}` : ""}
                          {hasPremiumBadge((profile as any).profileTags) && <StatusBadgeIcon type="premium" size="h-3 w-3" />}
                          {hasVerifiedBadge((profile as any).profileTags) && <StatusBadgeIcon type="verificada" size="h-3 w-3" />}
                        </div>
                        <div className="mt-0.5 text-[10px] text-white/45">{formatLastSeenLabel(profile.lastActiveAt || profile.lastSeen)}</div>
                        {(filterUserTags((profile as any).profileTags).length > 0 || (profile as any).serviceTags?.length > 0) && (
                          <div className="flex flex-wrap gap-0.5 mt-0.5">
                            {filterUserTags((profile as any).profileTags).slice(0, 2).map((tag: string) => (
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
                    <div className="flex items-center gap-1 truncate text-sm font-semibold">
                      {p.name}
                      {hasPremiumBadge(p.profileTags) && <StatusBadgeIcon type="premium" size="h-3.5 w-3.5" />}
                      {hasVerifiedBadge(p.profileTags) && <StatusBadgeIcon type="verificada" size="h-3.5 w-3.5" />}
                    </div>
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

        {/* ═══ EN VIVO AHORA ═══ */}
        {liveStreams.length > 0 && (
          <motion.section initial="hidden" whileInView="visible" viewport={{ once: true, margin: "-60px" }} variants={stagger} className="mb-10">
            <motion.div variants={cardFade} className="mb-4 flex items-center gap-2">
              <span className="relative flex h-3 w-3">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-400 opacity-75" />
                <span className="relative inline-flex h-3 w-3 rounded-full bg-red-500" />
              </span>
              <h2 className="text-xl font-bold">En Vivo Ahora</h2>
            </motion.div>
            <motion.div variants={cardFade} className="flex gap-3 overflow-x-auto pb-2 scrollbar-none">
              {liveStreams.map((s: any) => (
                <Link key={s.id} href={`/live/${s.id}`} className="group relative flex-shrink-0 w-40">
                  <div className="relative aspect-[3/4] overflow-hidden rounded-2xl border border-red-500/20 bg-gradient-to-br from-fuchsia-900/40 to-violet-900/40">
                    {s.host?.avatarUrl ? (
                      <img src={resolveMediaUrl(s.host.avatarUrl) ?? undefined} alt="" className="h-full w-full object-cover opacity-80 group-hover:opacity-100 transition" />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center text-3xl font-bold text-white/20">
                        {(s.host?.displayName || "?")[0]}
                      </div>
                    )}
                    <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent" />
                    <div className="absolute top-2 left-2 flex items-center gap-1 rounded-full bg-red-600/90 px-2 py-0.5 text-[10px] font-bold text-white">
                      <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-white" /> LIVE
                    </div>
                    <div className="absolute bottom-2 left-2 right-2">
                      <p className="text-xs font-semibold truncate">{s.host?.displayName || s.host?.username}</p>
                      {s.title && <p className="text-[10px] text-white/50 truncate">{s.title}</p>}
                      <p className="text-[10px] text-white/40 mt-0.5">{s.viewerCount} viendo</p>
                    </div>
                  </div>
                </Link>
              ))}
            </motion.div>
          </motion.section>
        )}

        {/* ═══ HOTELES / MOTELES ═══ */}
        {moteles.length > 0 && (
          <motion.section initial="hidden" whileInView="visible" viewport={{ once: true, margin: "-60px" }} variants={stagger} className="mb-10">
            <motion.div variants={cardFade} className="mb-4 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Hotel className="h-4 w-4 text-amber-400" />
                <h2 className="text-xl font-bold">Hoteles y Moteles</h2>
              </div>
              <Link href="/moteles" className="group flex items-center gap-1 text-xs text-white/50 hover:text-amber-400">
                Ver todos <ChevronRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
              </Link>
            </motion.div>
            <div className="scrollbar-none -mx-4 flex gap-3 overflow-x-auto px-4 pb-2 snap-x snap-mandatory sm:mx-0 sm:grid sm:grid-cols-2 sm:overflow-visible sm:px-0 md:grid-cols-3 lg:grid-cols-4">
              {moteles.map((item) => (
                <motion.article key={item.id} variants={cardFade} className="group w-[65vw] shrink-0 snap-start overflow-hidden rounded-2xl border border-amber-500/10 bg-white/[0.03] transition-all duration-200 hover:-translate-y-1 hover:border-amber-500/25 sm:w-auto">
                  <Link href={`/hospedaje/${item.id}`} className="block">
                    <div className="relative aspect-[4/3] bg-white/[0.04]">
                      {(item.coverUrl || item.avatarUrl) ? (
                        <img
                          src={resolveMediaUrl(item.coverUrl || item.avatarUrl) ?? undefined}
                          alt={item.displayName}
                          className="h-full w-full object-cover transition group-hover:scale-105"
                          onError={(e) => { (e.currentTarget as HTMLImageElement).src = "/brand/isotipo-new.png"; }}
                        />
                      ) : (
                        <div className="flex h-full items-center justify-center"><Hotel className="h-10 w-10 text-white/10" /></div>
                      )}
                      {item.distance != null && (
                        <div className="absolute right-2 top-2 flex items-center gap-1 rounded-full border border-white/10 bg-black/50 px-2 py-0.5 text-[10px] text-white/80">
                          <MapPin className="h-3 w-3" /> {item.distance.toFixed(1)} km
                        </div>
                      )}
                      <div className="absolute inset-0 bg-gradient-to-t from-black/70 to-transparent" />
                      <div className="absolute bottom-0 left-0 right-0 p-3">
                        <h3 className="truncate text-sm font-semibold">{item.displayName || item.username}</h3>
                        {item.city && <p className="mt-0.5 text-[10px] text-white/50">{item.city}</p>}
                      </div>
                    </div>
                  </Link>
                </motion.article>
              ))}
            </div>
          </motion.section>
        )}

        {/* ═══ SEXSHOP ═══ */}
        {sexshops.length > 0 && (
          <motion.section initial="hidden" whileInView="visible" viewport={{ once: true, margin: "-60px" }} variants={stagger} className="mb-10">
            <motion.div variants={cardFade} className="mb-4 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <ShoppingBag className="h-4 w-4 text-pink-400" />
                <h2 className="text-xl font-bold">Sex Shop</h2>
              </div>
              <Link href="/sexshop" className="group flex items-center gap-1 text-xs text-white/50 hover:text-pink-400">
                Ver todos <ChevronRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
              </Link>
            </motion.div>
            <div className="scrollbar-none -mx-4 flex gap-3 overflow-x-auto px-4 pb-2 snap-x snap-mandatory sm:mx-0 sm:grid sm:grid-cols-2 sm:overflow-visible sm:px-0 md:grid-cols-3 lg:grid-cols-4">
              {sexshops.map((item) => (
                <motion.article key={item.id} variants={cardFade} className="group w-[65vw] shrink-0 snap-start overflow-hidden rounded-2xl border border-pink-500/10 bg-white/[0.03] transition-all duration-200 hover:-translate-y-1 hover:border-pink-500/25 sm:w-auto">
                  <Link href={`/sexshop/${item.username || item.id}`} className="block">
                    <div className="relative aspect-[4/3] bg-white/[0.04]">
                      {(item.coverUrl || item.avatarUrl) ? (
                        <img
                          src={resolveMediaUrl(item.coverUrl || item.avatarUrl) ?? undefined}
                          alt={item.displayName}
                          className="h-full w-full object-cover transition group-hover:scale-105"
                          onError={(e) => { (e.currentTarget as HTMLImageElement).src = "/brand/isotipo-new.png"; }}
                        />
                      ) : (
                        <div className="flex h-full items-center justify-center"><ShoppingBag className="h-10 w-10 text-white/10" /></div>
                      )}
                      {item.distance != null && (
                        <div className="absolute right-2 top-2 flex items-center gap-1 rounded-full border border-white/10 bg-black/50 px-2 py-0.5 text-[10px] text-white/80">
                          <MapPin className="h-3 w-3" /> {item.distance.toFixed(1)} km
                        </div>
                      )}
                      <div className="absolute inset-0 bg-gradient-to-t from-black/70 to-transparent" />
                      <div className="absolute bottom-0 left-0 right-0 p-3">
                        <h3 className="truncate text-sm font-semibold">{item.displayName || item.username}</h3>
                        {item.city && <p className="mt-0.5 text-[10px] text-white/50">{item.city}</p>}
                      </div>
                    </div>
                  </Link>
                </motion.article>
              ))}
            </div>
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

        <HomeCreAccordion />
      </div>

      {/* Profile Preview Modal */}
      {previewProfile && (
        <ProfilePreviewModal profile={previewProfile} onClose={() => setPreviewProfile(null)} />
      )}
    </div>
  );
}
