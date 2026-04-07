"use client";

import { startTransition, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import dynamic from "next/dynamic";
import { AnimatePresence, motion } from "framer-motion";
import { apiFetch, isRateLimitError, resolveMediaUrl } from "../lib/api";
import { LocationFilterContext } from "../hooks/useLocationFilter";
import useMe from "../hooks/useMe";
import UserLevelBadge from "../components/UserLevelBadge";
import { filterUserTags, hasPremiumBadge, hasVerifiedBadge } from "../lib/systemBadges";
import StatusBadgeIcon from "../components/StatusBadgeIcon";

const Stories = dynamic(() => import("../components/Stories"), { ssr: false });
const ProfilePreviewModal = dynamic(() => import("../components/ProfilePreviewModal"), { ssr: false });

import {
  buildChatHref,
  buildCurrentPathWithSearch,
  buildLoginHref,
} from "../lib/chat";
import {
  ArrowRight,
  ChevronRight,
  Crown,
  Download,
  Hand,
  Hotel,
  MapPin,
  Navigation,
  PartyPopper,
  ShieldCheck,
  ShoppingBag,
  Sparkles,
  Users,
  Video,
  X,
  Zap,
} from "lucide-react";

/* ── Trial label ── */
function trialLabel(days: number): string {
  if (days >= 365) return `${Math.floor(days / 365)} año${Math.floor(days / 365) > 1 ? "s" : ""}`;
  if (days >= 30) return `${Math.floor(days / 30)} mes${Math.floor(days / 30) > 1 ? "es" : ""}`;
  return `${days} días`;
}
const FREE_TRIAL_DAYS = Number(process.env.NEXT_PUBLIC_FREE_TRIAL_DAYS || 90);
const TRIAL_TEXT = `${trialLabel(FREE_TRIAL_DAYS)} gratis`;

/* ── Types ── */

type Banner = {
  id: string;
  title: string;
  imageUrl: string;
  linkUrl?: string | null;
  position: string;
  imageFocusX?: number;
  imageFocusY?: number;
  imageZoom?: number;
};

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

/* ── Shared platform stats cache — avoids duplicate /stats/platform fetches ── */
let _platformStatsPromise: Promise<any> | null = null;
function getPlatformStats() {
  if (!_platformStatsPromise) {
    _platformStatsPromise = apiFetch<{ professionals: number; services: number; videocallProfessionals: number }>("/stats/platform")
      .catch((err) => {
        _platformStatsPromise = null;
        throw err;
      });
  }
  return _platformStatsPromise;
}

function HeroCounters() {
  const [stats, setStats] = useState<{ professionals: number; services: number } | null>(null);
  const [animate, setAnimate] = useState(false);

  useEffect(() => {
    getPlatformStats()
      .then((res) => setStats(res))
      .catch((err) => console.warn("[HeroCounters] failed to load platform stats", err));
  }, []);

  useEffect(() => {
    // Small delay so the counter animation is visible after page paint
    const timer = setTimeout(() => setAnimate(true), 300);
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
    <div
      className={`mt-8 flex items-center justify-center gap-6 sm:gap-10 ${animate ? "animate-float-up" : "opacity-0"}`}
      style={{ animationDelay: "320ms", animationFillMode: "both" }}
    >
      {counters.map((c, i) => (
        <div key={i} className="group/stat flex cursor-default flex-col items-center gap-1">
          <c.icon className="mb-1 h-4 w-4 text-fuchsia-400/70 transition-colors duration-150 group-hover/stat:text-fuchsia-400" />
          <span className="text-xl font-bold tabular-nums tracking-tight text-white/90 sm:text-2xl">
            {c.value}{c.suffix}
          </span>
          <span className="text-[11px] text-white/40 sm:text-xs">{c.label}</span>
        </div>
      ))}
    </div>
  );
}

/* ── Videollamadas CTA Banner ── */

function VideollamadasBanner() {
  const [count, setCount] = useState(0);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    getPlatformStats()
      .then((res: any) => {
        setCount(res.videocallProfessionals ?? 0);
        setLoaded(true);
      })
      .catch((err: any) => {
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

/** Generates a believable "active X min ago" label seeded by profile id so it's
 *  stable across re-renders but varies per card (range: 1-15 min). */
function fakeRecentLabel(profileId: string): string {
  let hash = 0;
  for (let i = 0; i < profileId.length; i++) hash = ((hash << 5) - hash + profileId.charCodeAt(i)) | 0;
  const mins = (Math.abs(hash) % 15) + 1;
  return `Activa hace ${mins} min`;
}

/* ── Tier config ── */
const TIERS = [
  { key: "SILVER", label: "Silver", icon: Sparkles, gradient: "from-slate-300 to-slate-400", border: "border-slate-400/30", bg: "bg-slate-500/10" },
] as const;

/* ── Page ── */

const SANTIAGO_FALLBACK: [number, number] = [-33.45, -70.66];

export default function HomeClient() {
  const [banners, setBanners] = useState<Banner[]>([]);
  const [bannersLoaded, setBannersLoaded] = useState(false);
  const [recentPros, setRecentPros] = useState<RecentProfessional[]>([]);
  const [bannerProfiles, setBannerProfiles] = useState<Record<string, FeaturedBannerProfile>>({});
  const [discoverSections, setDiscoverSections] = useState<
    Record<string, DiscoverProfile[]>
  >({});
  const locationCtx = useContext(LocationFilterContext);
  const location = locationCtx?.effectiveLocation ?? SANTIAGO_FALLBACK;
  const locationKey = `${location[0]}-${location[1]}`;
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
      } finally {
        setBannersLoaded(true);
      }
    })();
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

  // ── Fetch moteles, sexshops & lives (deferred — below the fold) ──
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

    // Defer 2s so above-the-fold images load first
    const timer = setTimeout(() => {
      if (controller.signal.aborted) return;
      fetchDirectory("establishment", "motel").then(setMoteles).catch(() => {});
      fetchDirectory("shop", "sexshop").then(setSexshops).catch(() => {});
      apiFetch<{ streams: any[] }>("/live/active", { signal: controller.signal })
        .then((r) => setLiveStreams(r?.streams ?? []))
        .catch(() => {});
    }, 2000);

    return () => { clearTimeout(timer); controller.abort(); };
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
      SILVER: recentPros.filter((p) => p.userLevel === "SILVER").slice(0, 6),
    };
  }, [recentPros]);

  // Destacadas carousel: DIAMOND + GOLD profiles, fallback to top recent pros so section is never empty
  const featuredCarouselProfiles = useMemo(() => {
    const premium = recentPros.filter((p) => p.userLevel === "DIAMOND" || p.userLevel === "GOLD");
    if (premium.length >= 3) return premium.slice(0, 12);
    // Fallback: fill with top recent pros (by views) so the section always shows
    const sorted = [...recentPros].sort((a, b) => b.profileViews - a.profileViews);
    return sorted.slice(0, 6);
  }, [recentPros]);
  const FEATURED_PAGE_SIZE = 3;

  const featuredPageCount = Math.max(1, Math.ceil(featuredCarouselProfiles.length / FEATURED_PAGE_SIZE));
  const [featuredPage, setFeaturedPage] = useState(0);

  useEffect(() => {
    if (featuredPageCount <= 1) return;
    const interval = window.setInterval(() => {
      setFeaturedPage((prev) => (prev + 1) % featuredPageCount);
    }, 5000);
    return () => window.clearInterval(interval);
  }, [featuredPageCount]);

  const rawAvailableProfiles = discoverSections["available"] || [];
  // Fallback: when no profiles have availableNow=true, show recent pros so the section never feels empty
  const availableProfiles = useMemo(() => {
    if (rawAvailableProfiles.length > 0) return rawAvailableProfiles;
    return recentPros.slice(0, 6).map((p): DiscoverProfile => ({
      id: p.id,
      username: p.name,
      displayName: p.name,
      age: p.age,
      avatarUrl: p.avatarUrl,
      coverUrl: p.coverUrl ?? null,
      lat: null,
      lng: null,
      distanceKm: p.distance,
      availableNow: true,
      isActive: true,
      userLevel: p.userLevel,
      completedServices: p.completedServices,
      profileViews: p.profileViews,
      lastSeen: p.lastSeen ?? null,
      bio: p.bio ?? null,
      serviceCategory: p.serviceCategory ?? null,
      profileTags: p.profileTags,
      serviceTags: p.serviceTags,
      galleryUrls: p.galleryUrls,
    }));
  }, [rawAvailableProfiles, recentPros]);
  const availableCarouselProfiles = useMemo(
    () => (availableProfiles.length > 0 ? [...availableProfiles, ...availableProfiles] : []),
    [availableProfiles],
  );
  // Prefetch first visible profile images using idle time
  useEffect(() => {
    if (typeof requestIdleCallback !== "function") return;
    const id = requestIdleCallback(() => {
      const first4 = availableCarouselProfiles.slice(0, 4);
      for (const p of first4) {
        const src = resolveProfileImage(p);
        if (src && src !== "/brand/isotipo-new.png") {
          const img = new Image();
          img.src = src;
        }
      }
    }, { timeout: 4000 });
    return () => cancelIdleCallback(id);
  }, [availableCarouselProfiles]);

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
    if (!didDragRef.current) startTransition(() => setPreviewProfile(p));
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
    const focusX = banner.imageFocusX ?? 50;
    const focusY = banner.imageFocusY ?? 20;
    const zoom = banner.imageZoom ?? 1;
    const imgStyle: React.CSSProperties = {
      objectPosition: `${focusX}% ${focusY}%`,
      ...(zoom > 1 ? { transform: `scale(${zoom})` } : {}),
    };
    return (
      <div className="group/ad relative h-full w-full overflow-hidden">
        {isVideo ? (
          <video src={mediaSrc} className="h-full w-full object-cover transition-transform duration-500 group-hover/ad:scale-105" autoPlay muted loop playsInline />
        ) : (
          <img src={fallbackImage || mediaSrc} alt={profile?.name || "Banner publicitario"} className="h-full w-full object-cover transition-transform duration-500 group-hover/ad:scale-105" style={imgStyle} decoding="async" />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/30 to-transparent" />
        {/* Ad label */}
        <div className="absolute left-1.5 top-1.5">
          <span className="rounded bg-black/40 px-1 py-0.5 text-[7px] font-semibold uppercase tracking-widest text-white/40 backdrop-blur-sm">Promocionado</span>
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
      {/* ═══ HERO ═══ */}
      <section className="relative flex min-h-[38vh] items-center justify-center overflow-hidden px-4 md:min-h-[46vh]">
        <div className="pointer-events-none absolute inset-0 -z-10 bg-[#050510]" />
        <div className="pointer-events-none absolute inset-0 -z-10 bg-gradient-to-b from-transparent via-[#050510]/60 to-[#0a0a12]" />
        <div className="pointer-events-none absolute left-1/2 top-1/2 -z-10 h-[600px] w-[600px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-violet-700/[0.12] blur-[160px]" />

        <div className="relative mx-auto max-w-2xl text-center">
          <p className="mb-4 text-[11px] font-semibold uppercase tracking-[0.18em] text-fuchsia-400/70 animate-float-up">
            Chile · Verificado · Discreto
          </p>

          <h1 className="text-[2.1rem] font-bold leading-[1.1] tracking-tight text-white sm:text-4xl md:text-[3.2rem] animate-float-up" style={{ animationDelay: "80ms", animationFillMode: "both" }}>
            Encuentra lo que buscas,<br />
            <span className="text-white/50">sin vueltas.</span>
          </h1>

          <p className="mx-auto mt-5 max-w-lg text-[13px] leading-relaxed text-white/40 sm:text-sm animate-float-up" style={{ animationDelay: "160ms", animationFillMode: "both" }}>
            Escorts y acompañantes verificadas en Santiago y todo Chile. Perfiles reales, sin intermediarios.
          </p>

          <div className="mt-8 flex flex-col items-center gap-3 sm:flex-row sm:justify-center animate-float-up" style={{ animationDelay: "240ms", animationFillMode: "both" }}>
            <Link
              href="/servicios"
              className="uzeed-hero-cta group relative inline-flex w-full items-center justify-center gap-2 overflow-hidden rounded-xl bg-fuchsia-600 px-7 py-3.5 text-sm font-semibold text-white transition-all duration-200 hover:bg-fuchsia-500 sm:w-auto"
            >
              Ver perfiles
              <ArrowRight className="h-4 w-4 transition-transform duration-200 group-hover:translate-x-0.5" />
            </Link>
            <InstallAppButton />
          </div>

          <HeroCounters />
        </div>
      </section>

      {/* Section divider - premium gradient */}
      <div className="relative mx-auto max-w-5xl px-4">
        <div className="h-px bg-gradient-to-r from-transparent via-fuchsia-500/20 to-transparent" />
      </div>

      {/* Main content */}
      <div className="relative mx-auto max-w-6xl overflow-visible px-4 pb-16 mt-6">
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

        {/* ═══ BANNERS PUBLICITARIOS ═══ */}
        {/* Stable wrapper prevents CLS: reserves space until we know if banners exist */}
        {!bannersLoaded ? (
          <div className="mb-8 2xl:hidden min-h-[60px]" />
        ) : horizontalBanners.length > 0 && (
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
                  className="relative block h-[240px] w-[150px] shrink-0 snap-start overflow-hidden rounded-xl border border-white/[0.08] bg-[#0c0a14] shadow-md transition-all duration-300 hover:-translate-y-0.5 hover:border-fuchsia-500/20 hover:shadow-lg"
                >
                  {renderProfileBanner(b)}
                </a>
              ))}
            </div>
          </section>
        )}

        {/* ═══ CATEGORÍAS — Premium quick navigation ═══ */}
        <section className="mb-8">
          {/* Mobile: premium grid with glassmorphism */}
          <div className="grid grid-cols-4 gap-2.5 sm:hidden">
            {[
              { label: "Escorts", href: "/escorts", icon: Sparkles, gradient: "from-fuchsia-600/15 to-pink-600/10", borderColor: "border-fuchsia-500/20", iconColor: "text-fuchsia-400" },
              { label: "Masajistas", href: "/masajistas", icon: Hand, gradient: "from-violet-600/15 to-purple-600/10", borderColor: "border-violet-500/20", iconColor: "text-violet-400" },
              { label: "Moteles", href: "/moteles", icon: Hotel, gradient: "from-amber-600/15 to-orange-600/10", borderColor: "border-amber-500/20", iconColor: "text-amber-400" },
              { label: "Sex Shop", href: "/sexshop", icon: ShoppingBag, gradient: "from-rose-600/15 to-red-600/10", borderColor: "border-rose-500/20", iconColor: "text-rose-400" },
              { label: "Despedidas", href: "/escorts?serviceTags=despedidas", icon: PartyPopper, gradient: "from-cyan-600/15 to-teal-600/10", borderColor: "border-cyan-500/20", iconColor: "text-cyan-400" },
              { label: "Videollamadas", href: "/videocall", icon: Video, gradient: "from-blue-600/15 to-indigo-600/10", borderColor: "border-blue-500/20", iconColor: "text-blue-400" },
              { label: "Cerca tuyo", href: "/servicios", icon: Navigation, gradient: "from-emerald-600/15 to-green-600/10", borderColor: "border-emerald-500/20", iconColor: "text-emerald-400" },
              { label: "Premium", href: "/premium", icon: Crown, gradient: "from-amber-600/15 to-yellow-600/10", borderColor: "border-amber-500/20", iconColor: "text-amber-400" },
            ].map((cat) => (
              <Link
                key={cat.href}
                href={cat.href}
                className={`uzeed-category-card group flex flex-col items-center gap-2 rounded-2xl border ${cat.borderColor} bg-gradient-to-br ${cat.gradient} px-2 py-3.5 backdrop-blur-sm`}
              >
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/[0.06]">
                  <cat.icon className={`h-[18px] w-[18px] ${cat.iconColor} transition-transform duration-300 group-hover:scale-110`} />
                </div>
                <span className="text-[10px] font-semibold text-white/70 text-center leading-tight">{cat.label}</span>
              </Link>
            ))}
          </div>
          {/* Desktop: premium horizontal pills */}
          <div className="hidden sm:flex gap-2.5 overflow-x-auto pb-1 scrollbar-none">
            {[
              { label: "Escorts", href: "/escorts", icon: Sparkles, iconColor: "text-fuchsia-400" },
              { label: "Masajistas", href: "/masajistas", icon: Hand, iconColor: "text-violet-400" },
              { label: "Moteles", href: "/moteles", icon: Hotel, iconColor: "text-amber-400" },
              { label: "Sex Shop", href: "/sexshop", icon: ShoppingBag, iconColor: "text-rose-400" },
              { label: "Despedidas", href: "/escorts?serviceTags=despedidas", icon: PartyPopper, iconColor: "text-cyan-400" },
              { label: "Videollamadas", href: "/videocall", icon: Video, iconColor: "text-blue-400" },
              { label: "Cerca tuyo", href: "/servicios", icon: Navigation, iconColor: "text-emerald-400" },
            ].map((cat) => (
              <Link
                key={cat.href}
                href={cat.href}
                className="uzeed-category-card group flex shrink-0 items-center gap-2.5 rounded-2xl border border-white/[0.06] bg-white/[0.03] px-5 py-3 backdrop-blur-sm"
              >
                <cat.icon className={`h-4 w-4 ${cat.iconColor} transition-transform duration-300 group-hover:scale-110`} />
                <span className="text-sm font-medium text-white/65 group-hover:text-white/85 transition-colors duration-200">{cat.label}</span>
              </Link>
            ))}
          </div>
        </section>

        {/* ═══ CTA PUBLÍCATE ═══ */}
        {!isAuthed && (
          <Link
            href="/publicate"
            className="group mb-6 flex items-center justify-between rounded-xl border border-fuchsia-500/20 bg-fuchsia-500/[0.06] px-5 py-4 transition-all hover:bg-fuchsia-500/[0.10] hover:border-fuchsia-500/30"
          >
            <div>
              <span className="text-sm font-semibold text-white">
                ¿Ofreces servicios? <span className="text-fuchsia-400">Publícate aquí</span>
              </span>
              <p className="mt-0.5 text-[11px] text-white/40">Crea tu perfil en minutos, sin registro</p>
            </div>
            <span className="shrink-0 rounded-lg bg-fuchsia-500/20 px-3 py-1.5 text-xs font-semibold text-fuchsia-300 transition-colors group-hover:bg-fuchsia-500/30">
              Empezar
            </span>
          </Link>
        )}

        {/* Section gradient divider */}
        <div className="mb-6 h-px bg-gradient-to-r from-transparent via-white/[0.04] to-transparent" />

        {/* ═══ DISPONIBLE AHORA — Compact horizontal scroll ═══ */}
        <section ref={availableSectionRef} className="mb-8">
            <div className="mb-4 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="relative flex h-7 w-7 items-center justify-center rounded-lg bg-emerald-500/[0.12]">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-lg bg-emerald-400/30" />
                  <span className="relative h-2.5 w-2.5 rounded-full bg-emerald-400" />
                </div>
                <h2 className="text-base font-bold tracking-tight">Disponibles ahora</h2>
              </div>
              <Link href="/servicios?sort=availableNow" className="group flex items-center gap-1 text-xs font-medium text-white/40 hover:text-emerald-400 transition-colors duration-200">
                Ver todas <ChevronRight className="h-3.5 w-3.5 transition-transform duration-200 group-hover:translate-x-0.5" />
              </Link>
            </div>
            {availableProfiles.length > 0 ? (
              <div
                ref={availableCarouselRef}
                className="scrollbar-none -mx-4 flex gap-3 overflow-x-auto px-4 pb-2 cursor-grab active:cursor-grabbing select-none"
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
                    className="uzeed-available-ring group w-[140px] shrink-0 overflow-hidden rounded-2xl border border-emerald-500/15 bg-gradient-to-b from-white/[0.06] to-white/[0.02] text-left transition-all duration-400 hover:-translate-y-1.5 hover:border-emerald-400/30 hover:shadow-[0_16px_48px_rgba(16,185,129,0.12)]"
                  >
                    <div className="relative aspect-[3/4] overflow-hidden">
                      <img src={resolveProfileImage(p)} alt={p.displayName} className="uzeed-card-img h-full w-full object-cover" decoding="async" />
                      <div className="absolute left-2 top-2 uzeed-badge-pill uzeed-badge-online text-[9px] z-[2]">
                        <span className="uzeed-badge-dot" />
                        {fakeRecentLabel(p.id)}
                      </div>
                      <div className="uzeed-card-gradient absolute inset-0" />
                      <div className="absolute bottom-2 left-2 right-2 z-[2]">
                        <div className="truncate text-xs font-bold text-white">{p.displayName}{p.age ? `, ${p.age}` : ""}</div>
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

        {/* Section gradient divider */}
        <div className="mb-6 h-px bg-gradient-to-r from-transparent via-fuchsia-500/[0.08] to-transparent" />

        {/* ═══ TIER SECTIONS: Platino / Gold / Silver ═══ */}
        {TIERS.map((tier) => {
          const profiles = tierProfiles[tier.key] || [];
          if (!profiles.length) return null;
          const Icon = tier.icon;
          return (
            <section key={`${tier.key}-${locationKey}`} className="mb-10 uzeed-below-fold">
              <div className="mb-4 flex items-end justify-between">
                <div className="flex items-center gap-2.5">
                  <Icon className={`h-5 w-5 bg-gradient-to-r ${tier.gradient} bg-clip-text text-transparent`} />
                  <h2 className="text-xl font-bold tracking-tight">{tier.label}</h2>
                </div>
                <Link href="/profesionales" className="group flex items-center gap-1 text-xs font-medium text-white/40 hover:text-fuchsia-400 transition-colors duration-200">
                  Ver todas <ChevronRight className="h-3.5 w-3.5 transition-transform duration-200 group-hover:translate-x-0.5" />
                </Link>
              </div>
              <div className="scrollbar-none -mx-4 flex gap-3 overflow-x-auto px-4 pb-2 snap-x snap-mandatory sm:mx-0 sm:grid sm:grid-cols-2 sm:overflow-visible sm:px-0 md:grid-cols-3">
                {profiles.map((p) => (
                  <div key={p.id} className="w-[72vw] shrink-0 snap-start sm:w-auto">
                    <button
                      type="button"
                      onClick={() => setPreviewProfile({ ...p, displayName: p.name, username: p.name, distanceKm: p.distance })}
                      className={`uzeed-premium-card group relative block w-full text-left ${tier.border}`}
                    >
                      <div className="uzeed-card-shimmer relative aspect-[4/5] overflow-hidden bg-gradient-to-br from-white/[0.04] to-transparent rounded-[inherit]">
                        {p.avatarUrl || p.coverUrl ? (
                          <img
                            src={resolveProfileImage(p)}
                            alt={p.name}
                            className="uzeed-card-img h-full w-full object-cover"
                            loading="lazy"
                            decoding="async"
                            onError={(e) => { (e.currentTarget as HTMLImageElement).src = "/brand/isotipo-new.png"; }}
                          />
                        ) : (
                          <div className="flex h-full items-center justify-center">
                            <img src="/brand/isotipo-new.png" alt="" className="h-20 w-20 opacity-20" />
                          </div>
                        )}
                        <div className="uzeed-card-gradient absolute inset-0" />
                        {p.distance != null && (
                          <div className="absolute right-3 top-3 z-[3] flex items-center gap-1 rounded-xl border border-white/[0.08] bg-black/40 px-2.5 py-1 text-[11px] text-white/70 backdrop-blur-xl tabular-nums">
                            <MapPin className="h-3 w-3 text-fuchsia-400/60" />
                            {p.distance.toFixed(1)} km
                          </div>
                        )}
                        <div className="absolute left-3 top-3 z-[3] flex flex-col gap-1.5">
                          <UserLevelBadge level={p.userLevel} className="px-2.5 py-1 text-[11px]" />
                          {hasExamsBadge(p) && (
                            <div className="uzeed-badge-pill border-sky-300/30 bg-sky-500/15 text-sky-200 text-[9px]">
                              <ShieldCheck className="h-2.5 w-2.5" /> Exámenes
                            </div>
                          )}
                          {hasVideoCallBadge(p) && (
                            <div className="uzeed-badge-pill border-violet-300/30 bg-violet-500/15 text-violet-200 text-[9px]">
                              <Video className="h-2.5 w-2.5" /> Videollamadas
                            </div>
                          )}
                        </div>
                        {p.availableNow && (
                          <div className="absolute left-3 bottom-14 z-[3] uzeed-badge-pill uzeed-badge-online text-[9px]">
                            <span className="uzeed-badge-dot" />
                            Disponible
                          </div>
                        )}
                        <div className="absolute bottom-0 left-0 right-0 p-4 z-[3]">
                          <h3 className="flex items-center gap-1.5 text-lg font-bold leading-tight tracking-tight">
                            {p.name}
                            {hasPremiumBadge(p.profileTags) && <StatusBadgeIcon type="premium" size="h-4 w-4" />}
                            {hasVerifiedBadge(p.profileTags) && <StatusBadgeIcon type="verificada" size="h-4 w-4" />}
                          </h3>
                          <div className="mt-1.5 flex items-center gap-3 text-xs text-white/45">
                            {p.age && <span className="tabular-nums">{p.age} años</span>}
                            <span>{fakeRecentLabel(p.id)}</span>
                          </div>
                          {(p.serviceCategory || (filterUserTags(p.profileTags).length > 0) || (p.serviceTags && p.serviceTags.length > 0)) && (
                            <div className="flex flex-wrap gap-1 mt-2">
                              {filterUserTags(p.profileTags).map((tag) => (
                                <span key={`pt-${tag}`} className="uzeed-tag uzeed-tag-fuchsia">{tag}</span>
                              ))}
                              {p.serviceCategory && (
                                <span className="uzeed-tag uzeed-tag-violet">{p.serviceCategory}</span>
                              )}
                              {p.serviceTags?.slice(0, 8).map((tag) => (
                                <span key={`st-${tag}`} className="uzeed-tag uzeed-tag-violet">{tag}</span>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                    </button>
                  </div>
                ))}
              </div>
            </section>
          );
        })}

        {/* ═══ DESTACADAS — Carousel con perfiles Gold y Diamond ═══ */}
        {featuredCarouselProfiles.length > 0 && (
          <section key={`featured-${locationKey}`} className="mb-10">
            <div className="mb-4 flex items-end justify-between">
              <div className="flex items-center gap-2.5">
                <h2 className="text-xl font-bold tracking-tight">Destacadas</h2>
                {recentPros.some((p) => p.userLevel === "DIAMOND" || p.userLevel === "GOLD") && (
                  <span className="rounded-lg border border-amber-400/15 bg-amber-500/[0.08] px-2.5 py-0.5 text-[10px] text-amber-300/80 font-bold uppercase tracking-wider">Premium</span>
                )}
              </div>
              <Link href="/profesionales" className="group flex items-center gap-1 text-xs font-medium text-white/40 hover:text-amber-400 transition-colors duration-200">
                Ver todas <ChevronRight className="h-3.5 w-3.5 transition-transform duration-200 group-hover:translate-x-0.5" />
              </Link>
            </div>
            <div className="relative overflow-hidden rounded-2xl">
              <AnimatePresence mode="wait">
                <motion.div
                  key={`featured-page-${featuredPage}`}
                  initial={{ opacity: 0, x: 40 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -40 }}
                  transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
                  className="scrollbar-none flex gap-3 overflow-x-auto snap-x snap-mandatory pb-2 sm:grid sm:grid-cols-2 sm:overflow-visible sm:pb-0 md:grid-cols-3"
                >
                  {featuredCarouselProfiles
                    .slice(featuredPage * FEATURED_PAGE_SIZE, featuredPage * FEATURED_PAGE_SIZE + FEATURED_PAGE_SIZE)
                    .map((p) => (
                      <button
                        key={p.id}
                        type="button"
                        onClick={() => setPreviewProfile({ ...p, displayName: p.name, username: p.name, distanceKm: p.distance })}
                        className={`uzeed-premium-card group relative block w-[75vw] shrink-0 snap-start sm:w-auto sm:shrink text-left ${p.userLevel === "DIAMOND" ? "uzeed-tier-diamond" : "uzeed-tier-gold"}`}
                      >
                        <div className="uzeed-card-shimmer relative aspect-[3/4] overflow-hidden bg-gradient-to-br from-white/[0.04] to-transparent rounded-[inherit]">
                          {p.avatarUrl || p.coverUrl ? (
                            <img
                              src={resolveProfileImage(p)}
                              alt={p.name}
                              className="uzeed-card-img h-full w-full object-cover"
                              loading="lazy"
                              decoding="async"
                              onError={(e) => { (e.currentTarget as HTMLImageElement).src = "/brand/isotipo-new.png"; }}
                            />
                          ) : (
                            <div className="flex h-full items-center justify-center">
                              <img src="/brand/isotipo-new.png" alt="" className="h-20 w-20 opacity-20" />
                            </div>
                          )}
                          <div className="uzeed-card-gradient absolute inset-0" />
                          {p.distance != null && (
                            <div className="absolute right-3 top-3 z-[3] flex items-center gap-1 rounded-xl border border-white/[0.08] bg-black/40 px-2.5 py-1 text-[11px] text-white/70 backdrop-blur-xl tabular-nums">
                              <MapPin className="h-3 w-3 text-amber-400/60" />
                              {p.distance.toFixed(1)} km
                            </div>
                          )}
                          <div className="absolute left-3 top-3 z-[3] flex flex-col gap-1.5">
                            <UserLevelBadge level={p.userLevel} className="px-2.5 py-1 text-[11px]" />
                            {hasExamsBadge(p) && (
                              <div className="uzeed-badge-pill border-sky-300/30 bg-sky-500/15 text-sky-200 text-[9px]">
                                <ShieldCheck className="h-2.5 w-2.5" /> Exámenes
                              </div>
                            )}
                            {hasVideoCallBadge(p) && (
                              <div className="uzeed-badge-pill border-violet-300/30 bg-violet-500/15 text-violet-200 text-[9px]">
                                <Video className="h-2.5 w-2.5" /> Videollamadas
                              </div>
                            )}
                          </div>
                          {p.availableNow && (
                            <div className="absolute left-3 bottom-20 z-[3] uzeed-badge-pill uzeed-badge-online text-[9px]">
                              <span className="uzeed-badge-dot" />
                              Disponible
                            </div>
                          )}
                          <div className="absolute bottom-0 left-0 right-0 p-4 z-[3]">
                            <h3 className="flex items-center gap-1.5 text-lg font-bold leading-tight tracking-tight">
                              {p.name}{p.age ? `, ${p.age}` : ""}
                              {hasPremiumBadge(p.profileTags) && <StatusBadgeIcon type="premium" size="h-4 w-4" />}
                              {hasVerifiedBadge(p.profileTags) && <StatusBadgeIcon type="verificada" size="h-4 w-4" />}
                            </h3>
                            <div className="mt-1.5 flex items-center gap-3 text-xs text-white/45">
                              {p.serviceCategory && <span>{p.serviceCategory}</span>}
                              <span>{fakeRecentLabel(p.id)}</span>
                            </div>
                            {(filterUserTags(p.profileTags).length > 0 || (p.serviceTags && p.serviceTags.length > 0)) && (
                              <div className="flex flex-wrap gap-1 mt-2">
                                {filterUserTags(p.profileTags).map((tag) => (
                                  <span key={`pt-${tag}`} className="uzeed-tag uzeed-tag-fuchsia">{tag}</span>
                                ))}
                                {p.serviceTags?.slice(0, 6).map((tag) => (
                                  <span key={`st-${tag}`} className="uzeed-tag uzeed-tag-violet">{tag}</span>
                                ))}
                              </div>
                            )}
                          </div>
                        </div>
                      </button>
                    ))}
                </motion.div>
              </AnimatePresence>
              {/* Dot indicators — premium style */}
              {featuredPageCount > 1 && (
                <div className="mt-4 flex justify-center gap-2">
                  {Array.from({ length: featuredPageCount }, (_, i) => (
                    <button
                      key={i}
                      type="button"
                      aria-label={`Ver página ${i + 1}`}
                      onClick={() => setFeaturedPage(i)}
                      className={`rounded-full transition-all duration-400 ${i === featuredPage ? "h-2 w-5 bg-amber-400 shadow-[0_0_8px_rgba(251,191,36,0.4)]" : "h-2 w-2 bg-white/15 hover:bg-white/30"}`}
                    />
                  ))}
                </div>
              )}
            </div>
          </section>
        )}

        {/* ═══ CERCA DE TI — Grid for abundance ═══ */}
        {nearProfiles.length > 0 && (
          <section key={`near-${locationKey}`} className="mb-10 uzeed-below-fold">
            <div className="mb-4 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <h2 className="text-xl font-bold tracking-tight">Cerca de ti</h2>
              </div>
              <Link href="/servicios?sort=near" className="group flex items-center gap-1 text-xs font-medium text-white/40 hover:text-fuchsia-400 transition-colors duration-200">
                Ver mapa <ArrowRight className="h-3.5 w-3.5 transition-transform duration-200 group-hover:translate-x-0.5" />
              </Link>
            </div>
            <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-4">
              {nearProfiles.map((profile) => (
                <article key={profile.id} className="uzeed-premium-card group">
                  <button type="button" onClick={() => startTransition(() => setPreviewProfile(profile))} className="block w-full text-left">
                    <div className="uzeed-card-shimmer relative aspect-[3/4] overflow-hidden rounded-[inherit] bg-[#0a0a10]">
                      <img src={resolveProfileImage(profile)} alt={profile.displayName} className="uzeed-card-img h-full w-full object-cover" loading="lazy" decoding="async" />
                      {profile.distanceKm != null && (
                        <div className="absolute right-2 top-2 z-[3] rounded-lg border border-white/[0.08] bg-black/40 px-2 py-0.5 text-[10px] text-white/70 backdrop-blur-xl tabular-nums">
                          {profile.distanceKm.toFixed(1)} km
                        </div>
                      )}
                      <div className="absolute left-2 top-2 z-[3] flex flex-col gap-1">
                        {profile.availableNow && (
                          <div className="uzeed-badge-pill uzeed-badge-online text-[8px]">
                            <span className="uzeed-badge-dot" /> Online
                          </div>
                        )}
                        {hasExamsBadge(profile as any) && (
                          <div className="uzeed-badge-pill border-sky-300/30 bg-sky-500/15 text-sky-200 text-[8px]">
                            <ShieldCheck className="h-2.5 w-2.5" /> Exámenes
                          </div>
                        )}
                        {hasVideoCallBadge(profile as any) && (
                          <div className="uzeed-badge-pill border-violet-300/30 bg-violet-500/15 text-violet-200 text-[8px]">
                            <Video className="h-2.5 w-2.5" /> Videollamadas
                          </div>
                        )}
                      </div>
                      <div className="uzeed-card-gradient absolute inset-0" />
                      <div className="absolute bottom-0 left-0 right-0 p-2.5 z-[3]">
                        <div className="flex items-center gap-1 truncate text-[13px] font-bold">
                          {profile.displayName}{profile.age ? `, ${profile.age}` : ""}
                          {hasPremiumBadge((profile as any).profileTags) && <StatusBadgeIcon type="premium" size="h-3 w-3" />}
                          {hasVerifiedBadge((profile as any).profileTags) && <StatusBadgeIcon type="verificada" size="h-3 w-3" />}
                        </div>
                        {(filterUserTags((profile as any).profileTags).length > 0 || (profile as any).serviceTags?.length > 0 || profile.serviceCategory) && (
                          <div className="flex flex-wrap gap-1 mt-1">
                            {filterUserTags((profile as any).profileTags).slice(0, 2).map((tag: string) => (
                              <span key={`pt-${tag}`} className="uzeed-tag uzeed-tag-fuchsia text-[8px]">{tag}</span>
                            ))}
                            {(profile as any).serviceTags?.slice(0, 2).map((tag: string) => (
                              <span key={`st-${tag}`} className="uzeed-tag uzeed-tag-violet text-[8px]">{tag}</span>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  </button>
                </article>
              ))}
            </div>
          </section>
        )}

        {/* ═══ NUEVAS ═══ */}
        {newProfiles.length > 0 && (
          <section key={`new-${locationKey}`} className="mb-10 uzeed-below-fold">
            <div className="mb-4 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <h2 className="text-xl font-bold tracking-tight">Nuevas</h2>
              </div>
              <Link href="/servicios?sort=new" className="group flex items-center gap-1 text-xs font-medium text-white/40 hover:text-violet-400 transition-colors duration-200">
                Ver todas <ChevronRight className="h-3.5 w-3.5 transition-transform duration-200 group-hover:translate-x-0.5" />
              </Link>
            </div>
            <div className="scrollbar-none -mx-4 flex gap-3 overflow-x-auto px-4 pb-2 snap-x snap-mandatory sm:mx-0 sm:grid sm:grid-cols-2 sm:overflow-visible sm:px-0 lg:grid-cols-4">
              {newProfiles.map((profile) => (
                <article key={profile.id} className="uzeed-premium-card group w-[68vw] shrink-0 snap-start sm:w-auto">
                  <button type="button" onClick={() => startTransition(() => setPreviewProfile(profile))} className="block w-full text-left">
                    <div className="uzeed-card-shimmer relative aspect-[3/4] overflow-hidden rounded-[inherit] bg-[#0a0a10]">
                      <img src={resolveProfileImage(profile)} alt={profile.displayName} className="uzeed-card-img h-full w-full object-cover" loading="lazy" decoding="async" />
                      <UserLevelBadge level={profile.userLevel} className="absolute right-2 top-2 z-[3] px-2 py-0.5 text-[10px]" />
                      <div className="absolute left-2 top-2 z-[3] flex flex-col gap-1">
                        {hasExamsBadge(profile as any) && (
                          <div className="uzeed-badge-pill border-sky-300/30 bg-sky-500/15 text-sky-200 text-[9px]">
                            <ShieldCheck className="h-2.5 w-2.5" /> Exámenes
                          </div>
                        )}
                        {hasVideoCallBadge(profile as any) && (
                          <div className="uzeed-badge-pill border-violet-300/30 bg-violet-500/15 text-violet-200 text-[9px]">
                            <Video className="h-2.5 w-2.5" /> Videollamadas
                          </div>
                        )}
                      </div>
                      <div className="uzeed-card-gradient absolute inset-0" />
                      <div className="absolute bottom-0 left-0 right-0 p-2.5 z-[3]">
                        <div className="flex items-center gap-1 truncate text-[13px] font-bold">
                          {profile.displayName}{profile.age ? `, ${profile.age}` : ""}
                          {hasPremiumBadge((profile as any).profileTags) && <StatusBadgeIcon type="premium" size="h-3 w-3" />}
                          {hasVerifiedBadge((profile as any).profileTags) && <StatusBadgeIcon type="verificada" size="h-3 w-3" />}
                        </div>
                        <div className="mt-0.5 text-[10px] text-white/35">{fakeRecentLabel(profile.id)}</div>
                        {(filterUserTags((profile as any).profileTags).length > 0 || (profile as any).serviceTags?.length > 0) && (
                          <div className="flex flex-wrap gap-1 mt-1">
                            {filterUserTags((profile as any).profileTags).slice(0, 2).map((tag: string) => (
                              <span key={`pt-${tag}`} className="uzeed-tag uzeed-tag-fuchsia text-[8px]">{tag}</span>
                            ))}
                            {(profile as any).serviceTags?.slice(0, 2).map((tag: string) => (
                              <span key={`st-${tag}`} className="uzeed-tag uzeed-tag-violet text-[8px]">{tag}</span>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  </button>
                </article>
              ))}
            </div>
          </section>
        )}

        {/* ═══ VIDEOLLAMADAS CTA BANNER ═══ */}
        <VideollamadasBanner />

        {/* ═══ TENDENCIAS ═══ */}
        {recentPros.length > 0 && (
          <section key={`trending-${locationKey}`} className="mb-10 uzeed-below-fold">
            <div className="mb-4">
              <div className="flex items-center gap-2.5">
                <h2 className="text-xl font-bold tracking-tight">Las más buscadas</h2>
              </div>
            </div>
            <div className="grid gap-2.5 md:grid-cols-2 lg:grid-cols-3">
              {[...recentPros].sort((a, b) => b.profileViews - a.profileViews).slice(0, 6).map((p) => (
                <Link key={`trend-${p.id}`} href={`/profesional/${p.id}`} className="group flex items-center gap-3.5 rounded-2xl border border-white/[0.06] bg-white/[0.02] p-3.5 transition-all duration-300 hover:-translate-y-1 hover:border-fuchsia-500/20 hover:bg-white/[0.05] hover:shadow-[0_12px_32px_rgba(168,85,247,0.08)]">
                  <div className="relative h-14 w-14 shrink-0 overflow-hidden rounded-xl bg-gradient-to-br from-white/[0.04] to-transparent">
                    {p.avatarUrl ? (
                      <img src={resolveMediaUrl(p.avatarUrl) ?? undefined} alt={p.name} className="h-full w-full object-cover transition-transform duration-400 group-hover:scale-110" loading="lazy" decoding="async" />
                    ) : (
                      <div className="flex h-full items-center justify-center"><img src="/brand/isotipo-new.png" alt="" className="h-7 w-7 opacity-20" /></div>
                    )}
                    {p.availableNow && (
                      <div className="absolute -bottom-0.5 -right-0.5 h-3.5 w-3.5 rounded-full bg-emerald-400 border-2 border-[#0e0e12]" />
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1 truncate text-sm font-bold">
                      {p.name}
                      {hasPremiumBadge(p.profileTags) && <StatusBadgeIcon type="premium" size="h-3.5 w-3.5" />}
                      {hasVerifiedBadge(p.profileTags) && <StatusBadgeIcon type="verificada" size="h-3.5 w-3.5" />}
                    </div>
                    <div className="mt-0.5 flex items-center gap-2 text-xs text-white/35">
                      {p.age && <span className="tabular-nums">{p.age} años</span>}
                      {p.distance != null && <span className="flex items-center gap-0.5 tabular-nums"><MapPin className="h-3 w-3 text-fuchsia-400/50" />{p.distance.toFixed(1)} km</span>}
                    </div>
                  </div>
                  <ChevronRight className="h-4 w-4 shrink-0 text-white/15 transition-all duration-200 group-hover:text-fuchsia-400 group-hover:translate-x-0.5" />
                </Link>
              ))}
            </div>
          </section>
        )}

        {/* ═══ EN VIVO AHORA ═══ */}
        {liveStreams.length > 0 && <div className="mb-6 h-px bg-gradient-to-r from-transparent via-red-500/[0.1] to-transparent" />}
        {liveStreams.length > 0 && (
          <section key={`live-${locationKey}`} className="mb-10">
            <div className="mb-4 flex items-center gap-2">
              <span className="relative flex h-3 w-3">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-400 opacity-75" />
                <span className="relative inline-flex h-3 w-3 rounded-full bg-red-500" />
              </span>
              <h2 className="text-xl font-bold">En Vivo Ahora</h2>
            </div>
            <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-none">
              {liveStreams.map((s: any) => (
                <Link key={s.id} href={`/live/${s.id}`} className="group relative flex-shrink-0 w-40">
                  <div className="relative aspect-[3/4] overflow-hidden rounded-2xl border border-red-500/25 bg-gradient-to-br from-fuchsia-900/40 to-violet-900/40 shadow-[0_0_24px_rgba(239,68,68,0.1)] group-hover:shadow-[0_0_32px_rgba(239,68,68,0.2)] transition-shadow duration-300">
                    {s.host?.avatarUrl ? (
                      <img src={resolveMediaUrl(s.host.avatarUrl) ?? undefined} alt="" className="h-full w-full object-cover opacity-80 group-hover:opacity-100 transition" loading="lazy" decoding="async" />
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
            </div>
          </section>
        )}

        {/* ═══ HOTELES / MOTELES ═══ */}
        {moteles.length > 0 && (
          <section key={`moteles-${locationKey}`} className="mb-10 uzeed-below-fold">
            <div className="mb-4 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <h2 className="text-xl font-bold tracking-tight">Hoteles y Moteles</h2>
              </div>
              <Link href="/moteles" className="group flex items-center gap-1 text-xs font-medium text-white/40 hover:text-amber-400 transition-colors duration-200">
                Ver todos <ChevronRight className="h-3.5 w-3.5 transition-transform duration-200 group-hover:translate-x-0.5" />
              </Link>
            </div>
            <div className="scrollbar-none -mx-4 flex gap-3 overflow-x-auto px-4 pb-2 snap-x snap-mandatory sm:mx-0 sm:grid sm:grid-cols-2 sm:overflow-visible sm:px-0 md:grid-cols-3 lg:grid-cols-4">
              {moteles.map((item) => (
                <article key={item.id} className="uzeed-premium-card uzeed-tier-gold group w-[68vw] shrink-0 snap-start sm:w-auto">
                  <Link href={`/hospedaje/${item.id}`} className="block">
                    <div className="uzeed-card-shimmer relative aspect-[4/3] overflow-hidden rounded-[inherit] bg-[#0a0a10]">
                      {(item.coverUrl || item.avatarUrl) ? (
                        <img
                          src={resolveMediaUrl(item.coverUrl || item.avatarUrl) ?? undefined}
                          alt={item.displayName}
                          className="uzeed-card-img h-full w-full object-cover"
                          loading="lazy"
                          decoding="async"
                          onError={(e) => { (e.currentTarget as HTMLImageElement).src = "/brand/isotipo-new.png"; }}
                        />
                      ) : (
                        <div className="flex h-full items-center justify-center"><Hotel className="h-10 w-10 text-white/[0.06]" /></div>
                      )}
                      {item.distance != null && (
                        <div className="absolute right-2 top-2 z-[3] flex items-center gap-1 rounded-lg border border-white/[0.08] bg-black/40 px-2 py-0.5 text-[10px] text-white/70 backdrop-blur-xl tabular-nums">
                          <MapPin className="h-3 w-3 text-amber-400/60" /> {item.distance.toFixed(1)} km
                        </div>
                      )}
                      <div className="uzeed-card-gradient-subtle absolute inset-0" />
                      <div className="absolute bottom-0 left-0 right-0 p-3 z-[3]">
                        <h3 className="truncate text-sm font-bold">{item.displayName || item.username}</h3>
                        {item.city && <p className="mt-0.5 text-[10px] text-white/40 flex items-center gap-1"><MapPin className="h-2.5 w-2.5 text-amber-400/50" />{item.city}</p>}
                      </div>
                    </div>
                  </Link>
                </article>
              ))}
            </div>
          </section>
        )}

        {/* ═══ SEXSHOP ═══ */}
        {sexshops.length > 0 && (
          <section key={`sexshop-${locationKey}`} className="mb-10 uzeed-below-fold">
            <div className="mb-4 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <h2 className="text-xl font-bold tracking-tight">Sex Shop</h2>
              </div>
              <Link href="/sexshop" className="group flex items-center gap-1 text-xs font-medium text-white/40 hover:text-pink-400 transition-colors duration-200">
                Ver todos <ChevronRight className="h-3.5 w-3.5 transition-transform duration-200 group-hover:translate-x-0.5" />
              </Link>
            </div>
            <div className="scrollbar-none -mx-4 flex gap-3 overflow-x-auto px-4 pb-2 snap-x snap-mandatory sm:mx-0 sm:grid sm:grid-cols-2 sm:overflow-visible sm:px-0 md:grid-cols-3 lg:grid-cols-4">
              {sexshops.map((item) => (
                <article key={item.id} className="uzeed-premium-card group w-[68vw] shrink-0 snap-start sm:w-auto" style={{ borderColor: "rgba(236,72,153,0.1)" }}>
                  <Link href={`/sexshop/${item.username || item.id}`} className="block">
                    <div className="uzeed-card-shimmer relative aspect-[4/3] overflow-hidden rounded-[inherit] bg-[#0a0a10]">
                      {(item.coverUrl || item.avatarUrl) ? (
                        <img
                          src={resolveMediaUrl(item.coverUrl || item.avatarUrl) ?? undefined}
                          alt={item.displayName}
                          className="uzeed-card-img h-full w-full object-cover"
                          loading="lazy"
                          decoding="async"
                          onError={(e) => { (e.currentTarget as HTMLImageElement).src = "/brand/isotipo-new.png"; }}
                        />
                      ) : (
                        <div className="flex h-full items-center justify-center"><ShoppingBag className="h-10 w-10 text-white/[0.06]" /></div>
                      )}
                      {item.distance != null && (
                        <div className="absolute right-2 top-2 z-[3] flex items-center gap-1 rounded-lg border border-white/[0.08] bg-black/40 px-2 py-0.5 text-[10px] text-white/70 backdrop-blur-xl tabular-nums">
                          <MapPin className="h-3 w-3 text-pink-400/60" /> {item.distance.toFixed(1)} km
                        </div>
                      )}
                      <div className="uzeed-card-gradient-subtle absolute inset-0" />
                      <div className="absolute bottom-0 left-0 right-0 p-3 z-[3]">
                        <h3 className="truncate text-sm font-bold">{item.displayName || item.username}</h3>
                        {item.city && <p className="mt-0.5 text-[10px] text-white/40 flex items-center gap-1"><MapPin className="h-2.5 w-2.5 text-pink-400/50" />{item.city}</p>}
                      </div>
                    </div>
                  </Link>
                </article>
              ))}
            </div>
          </section>
        )}

        {/* ═══ CTA — Registration (guests only) ═══ */}
        {!isAuthed && <div className="mb-6 h-px bg-gradient-to-r from-transparent via-fuchsia-500/10 to-transparent" />}
        {!isAuthed && (
          <section className="relative overflow-hidden rounded-3xl border border-fuchsia-500/10 bg-gradient-to-br from-fuchsia-600/[0.06] via-violet-600/[0.03] to-transparent p-8 text-center md:p-12 shadow-[0_0_80px_rgba(168,85,247,0.04)] uzeed-below-fold">
            <div className="pointer-events-none absolute left-1/2 top-1/2 -z-10 h-[400px] w-[400px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-fuchsia-600/[0.08] blur-[100px]" />
            <div className="pointer-events-none absolute right-0 top-0 -z-10 h-[250px] w-[250px] rounded-full bg-violet-600/[0.06] blur-[80px]" />
            <h2 className="text-xl font-extrabold tracking-tight md:text-2xl">¿Listo para explorar?</h2>
            <p className="mx-auto mt-3 max-w-md text-sm text-white/40 leading-relaxed">Crea tu cuenta gratis y descubre lo mejor cerca de ti.</p>
            <div className="mt-7 flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
              <Link href="/register?type=CLIENT" className="uzeed-cta-btn uzeed-hero-cta group inline-flex w-full items-center justify-center gap-2.5 rounded-2xl bg-gradient-to-r from-fuchsia-600 to-violet-600 px-7 py-3.5 text-sm font-bold shadow-[0_12px_40px_rgba(168,85,247,0.2)] sm:w-auto">
                Registro Cliente <ArrowRight className="h-4 w-4 transition-transform duration-200 group-hover:translate-x-0.5" />
              </Link>
              <Link href="/register?type=PROFESSIONAL" className="uzeed-cta-btn group inline-flex w-full items-center justify-center gap-2.5 rounded-2xl bg-gradient-to-r from-pink-600 to-fuchsia-600 px-7 py-3.5 text-sm font-bold shadow-[0_12px_40px_rgba(236,72,153,0.2)] sm:w-auto">
                Registro Profesional — {TRIAL_TEXT} <ArrowRight className="h-4 w-4 transition-transform duration-200 group-hover:translate-x-0.5" />
              </Link>
              <Link href="/register?type=ESTABLISHMENT" className="inline-flex w-full items-center justify-center gap-2 rounded-2xl border border-white/[0.08] bg-white/[0.03] px-7 py-3.5 text-sm font-semibold text-white/60 transition-all duration-200 hover:bg-white/[0.08] hover:text-white/80 sm:w-auto">
                Registro Comercio
              </Link>
            </div>
          </section>
        )}
      </div>

      {/* Profile Preview Modal */}
      {previewProfile && (
        <ProfilePreviewModal profile={previewProfile} onClose={() => startTransition(() => setPreviewProfile(null))} />
      )}
    </div>
  );
}
