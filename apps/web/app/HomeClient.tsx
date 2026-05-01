"use client";

import { startTransition, useContext, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import dynamic from "next/dynamic";
import { apiFetch, isRateLimitError, resolveMediaUrl } from "../lib/api";
import { CHILEAN_CITIES, LocationFilterContext } from "../hooks/useLocationFilter";
import { PROFILE_TAGS_CATALOG, SERVICE_TAGS_CATALOG } from "../components/DirectoryPage";
import useMe from "../hooks/useMe";
import { hasPremiumBadge, hasVerifiedBadge } from "../lib/systemBadges";
import StatusBadgeIcon from "../components/StatusBadgeIcon";

const Stories = dynamic(() => import("../components/Stories"), { ssr: false });
const ProfilePreviewModal = dynamic(() => import("../components/ProfilePreviewModal"), { ssr: false });
const HomeFeed = dynamic(() => import("../components/home/HomeFeed"), { ssr: false });

import {
  buildChatHref,
  buildCurrentPathWithSearch,
  buildLoginHref,
} from "../lib/chat";
import {
  ArrowRight,
  BadgeCheck,
  ChevronRight,
  Crown,
  Download,
  Hand,
  Hotel,
  MapPin,
  Navigation,
  PartyPopper,
  Search as SearchIcon,
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

/* ── Hero search: smart routing (categorías / tags / comunas) ── */
const CATEGORY_ALIASES: Array<{ keywords: string[]; href: string }> = [
  { keywords: ["escort", "escorts", "puta", "putas", "acompañante", "acompañantes", "acompanante", "acompanantes"], href: "/escorts" },
  { keywords: ["masajista", "masajistas", "masaje", "masajes"], href: "/masajistas" },
  { keywords: ["motel", "moteles"], href: "/moteles" },
  { keywords: ["sexshop", "sex shop", "sexo shop", "juguete", "juguetes"], href: "/sexshop" },
  { keywords: ["videollamada", "videollamadas", "video llamada", "videocall", "cam"], href: "/videocall" },
  { keywords: ["premium", "gold", "platino", "diamante", "diamond"], href: "/premium" },
  { keywords: ["live", "lives", "en vivo"], href: "https://live.uzeed.cl/south-american-cams/female/" },
  { keywords: ["foro", "comunidad"], href: "/foro" },
];

function normalizeQuery(s: string): string {
  return s.toLowerCase().trim().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

type ResolvedSearch = { href: string; cityToSet?: (typeof CHILEAN_CITIES)[number] };
function resolveSearch(raw: string): ResolvedSearch {
  const q = normalizeQuery(raw);
  if (!q) return { href: "/escorts" };

  // 1. Alias de categoría (exacto o substring)
  for (const cat of CATEGORY_ALIASES) {
    if (cat.keywords.some((k) => {
      const nk = normalizeQuery(k);
      return nk === q || nk.startsWith(q) || q.startsWith(nk);
    })) {
      return { href: cat.href };
    }
  }

  // 2. Service tag del catálogo (anal, sexo oral, masaje erotico, trios, etc.)
  const serviceMatch = SERVICE_TAGS_CATALOG.find((t) => {
    const nt = normalizeQuery(t);
    return nt === q || nt.includes(q) || q.includes(nt);
  });
  if (serviceMatch) {
    return { href: `/escorts?serviceTags=${encodeURIComponent(serviceMatch)}` };
  }

  // 3. Profile tag del catálogo (tetona, rubia, tatuada, etc.)
  const profileMatch = PROFILE_TAGS_CATALOG.find((t) => {
    const nt = normalizeQuery(t);
    return nt === q || nt.includes(q) || q.includes(nt);
  });
  if (profileMatch) {
    return { href: `/escorts?profileTags=${encodeURIComponent(profileMatch)}` };
  }

  // 4. Comuna / ciudad chilena: setear la location y llevar a /escorts
  const cityMatch = CHILEAN_CITIES.find((c) => {
    const nc = normalizeQuery(c.name);
    return nc === q || nc.includes(q) || q.includes(nc);
  });
  if (cityMatch) {
    return { href: "/escorts", cityToSet: cityMatch };
  }

  // 5. Fallback: búsqueda por nombre. DirectoryPage filtra client-side por
  // displayName / city / profileTags / serviceTags / serviceCategory.
  return { href: `/escorts?q=${encodeURIComponent(raw.trim())}` };
}

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

type UmateCreatorCard = {
  id: string;
  displayName: string;
  avatarUrl: string | null;
  coverUrl: string | null;
  subscriberCount: number;
  totalPosts: number;
  monthlyPriceCLP: number;
  user: { username: string; isVerified: boolean };
};

/* ── Badge helpers (mirrors /servicios logic) ── */

function hasExamsBadge(p: { profileTags?: string[] }) {
  return (p.profileTags || []).some((t) => {
    const n = String(t || "").trim().toLowerCase();
    return n === "profesional con examenes" || n === "profesional con exámenes";
  });
}

/* ── Install App Button ── */
function InstallAppButton({ compact = false }: { compact?: boolean }) {
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
        className={
          compact
            ? "inline-flex items-center gap-1 text-[11px] font-medium text-white/40 underline-offset-4 transition hover:text-white/70 hover:underline"
            : "inline-flex w-full items-center justify-center gap-2 rounded-2xl border border-white/15 bg-white/[0.04] px-8 py-4 text-sm font-medium text-white/80 backdrop-blur-xl transition-all duration-200 hover:border-white/25 hover:bg-white/[0.08] sm:w-auto"
        }
      >
        <Download className={compact ? "h-3 w-3" : "h-4 w-4"} />
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
    _platformStatsPromise = apiFetch<{ professionals: number; services: number; videocallProfessionals: number; whatsappClicks: number }>("/stats/platform")
      .catch((err) => {
        _platformStatsPromise = null;
        throw err;
      });
  }
  return _platformStatsPromise;
}

function HeroCounters() {
  const [stats, setStats] = useState<{ professionals: number; whatsappClicks: number } | null>(null);
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
  const contactsTarget = stats ? Math.ceil((stats.whatsappClicks * 1.5) / 10) * 10 : 0;
  const comunasFixed = 300;

  const prosCount = useAnimatedCounter(prosTarget, 2000, animate && prosTarget > 0);
  const contactsCount = useAnimatedCounter(contactsTarget, 2000, animate && contactsTarget > 0);
  const comunasCount = useAnimatedCounter(comunasFixed, 2000, animate);

  const counters = [
    { value: prosCount, suffix: "+", label: "profesionales", icon: Users },
    { value: contactsCount, suffix: "+", label: "contactos exitosos", icon: Sparkles },
    { value: comunasCount, suffix: "+", label: "comunas", icon: MapPin },
  ];

  return (
    <div
      className={`flex flex-wrap items-center justify-center gap-x-3 gap-y-1.5 sm:gap-x-5 ${animate ? "animate-float-up" : "opacity-0"}`}
      style={{ animationDelay: "320ms", animationFillMode: "both" }}
    >
      {counters.map((c, i) => (
        <div key={i} className="group/stat flex cursor-default items-center gap-1.5">
          <c.icon className="h-3.5 w-3.5 text-fuchsia-400/70 transition-colors duration-150 group-hover/stat:text-fuchsia-400" />
          <span className="text-sm font-bold tabular-nums tracking-tight text-white/90">
            {c.value}{c.suffix}
          </span>
          <span className="text-[11px] text-white/40">{c.label}</span>
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

/* ── Page ── */

const SANTIAGO_FALLBACK: [number, number] = [-33.45, -70.66];

export default function HomeClient() {
  const router = useRouter();
  const [heroQuery, setHeroQuery] = useState("");
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
  const isAuthed = Boolean(me?.user?.id);

  /* ── U-Mate creators (home showcase) ── */
  const [umateCreators, setUmateCreators] = useState<UmateCreatorCard[]>([]);

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
    params.set("gender", "FEMALE");
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
          qp.set("gender", "FEMALE");
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

  // ── Fetch U-Mate creators & live streams (deferred — below the fold) ──
  useEffect(() => {
    const controller = new AbortController();

    // Defer 2s so above-the-fold images load first
    const timer = setTimeout(() => {
      if (controller.signal.aborted) return;
      apiFetch<{ creators: UmateCreatorCard[] }>("/umate/creators?limit=12&gender=FEMALE", { signal: controller.signal })
        .then((r) => setUmateCreators(r?.creators ?? []))
        .catch(() => {});
      apiFetch<{ streams: any[] }>("/live/active?gender=FEMALE", { signal: controller.signal })
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

  // Destacadas: DIAMOND + GOLD profiles, fallback to top recent pros so section is never empty
  const featuredCarouselProfiles = useMemo(() => {
    const premium = recentPros.filter((p) => p.userLevel === "DIAMOND" || p.userLevel === "GOLD");
    if (premium.length >= 3) return premium.slice(0, 12);
    const sorted = [...recentPros].sort((a, b) => b.profileViews - a.profileViews);
    return sorted.slice(0, 6);
  }, [recentPros]);

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
  // Prefetch first visible profile images using idle time
  useEffect(() => {
    if (typeof requestIdleCallback !== "function") return;
    const id = requestIdleCallback(() => {
      const first4 = availableProfiles.slice(0, 4);
      for (const p of first4) {
        const src = resolveProfileImage(p);
        if (src && src !== "/brand/isotipo-new.png") {
          const img = new Image();
          img.src = src;
        }
      }
    }, { timeout: 4000 });
    return () => cancelIdleCallback(id);
  }, [availableProfiles]);

  const newProfiles = discoverSections["new"] || [];

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
      {/* ═══ HERO — Premium immersive (compacto en mobile y desktop) ═══ */}
      <section className="relative flex items-center justify-center overflow-hidden px-4 pt-4 pb-4 md:pt-8 md:pb-6">
        <div className="pointer-events-none absolute inset-0 -z-10 bg-[#050510]" />
        <div className="pointer-events-none absolute inset-0 -z-10 bg-gradient-to-b from-transparent via-[#050510]/60 to-[#0a0a12]" />
        {/* Static ambient orbs — no animation to reduce rendering cost */}
        <div className="pointer-events-none absolute left-1/2 top-1/3 -z-10 h-[500px] w-[500px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-violet-600/[0.10] blur-[120px]" />
        <div className="pointer-events-none absolute right-[8%] top-[18%] -z-10 h-[300px] w-[300px] rounded-full bg-fuchsia-500/[0.06] blur-[100px]" />
        <div className="pointer-events-none absolute left-[12%] bottom-[8%] -z-10 h-[250px] w-[250px] rounded-full bg-indigo-500/[0.05] blur-[80px]" />
        {/* Noise texture overlay for premium texture */}
        <div className="pointer-events-none absolute inset-0 -z-[5] opacity-[0.012]" style={{ backgroundImage: "url(\"data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='1'/%3E%3C/svg%3E\")", backgroundRepeat: "repeat", backgroundSize: "128px" }} />

        <div className="relative mx-auto w-full max-w-3xl text-center">
          <h1 className="text-[1.25rem] font-extrabold leading-[1.1] tracking-tight sm:text-[1.75rem] md:text-[2rem] animate-float-up" style={{ animationFillMode: "both" }}>
            <span className="bg-gradient-to-b from-white via-white/95 to-white/60 bg-clip-text text-transparent">Escorts, masajes y experiencias reales cerca de ti</span>
          </h1>

          <h2 className="mx-auto mt-1.5 max-w-xl text-[11px] font-medium leading-snug text-white/45 sm:mt-2 sm:text-[13px] animate-float-up" style={{ animationDelay: "160ms", animationFillMode: "both" }}>
            Las mejores Escorts y Acompañantes en Santiago, Las Condes y regiones. Discreto, verificado y premium.
          </h2>

          {/* CTA primario + contadores en la misma fila (mobile y desktop) */}
          <div className="mt-3 flex flex-wrap items-center justify-center gap-x-4 gap-y-2 animate-float-up sm:mt-4 sm:gap-x-6" style={{ animationDelay: "240ms", animationFillMode: "both" }}>
            <Link
              href="/servicios"
              className="uzeed-hero-cta group relative inline-flex items-center justify-center gap-2 overflow-hidden rounded-2xl bg-gradient-to-r from-fuchsia-600 to-violet-600 px-5 py-2.5 text-sm font-bold transition-all duration-300 hover:scale-[1.03] hover:shadow-[0_16px_48px_rgba(168,85,247,0.35)]"
            >
              Explorar ahora
              <ArrowRight className="h-4 w-4 transition-transform duration-300 group-hover:translate-x-1" />
            </Link>
            <HeroCounters />
          </div>

          {/* Buscador dentro del hero */}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              const resolved = resolveSearch(heroQuery);
              if (resolved.cityToSet) locationCtx?.setCity(resolved.cityToSet);
              if (resolved.href.startsWith("http")) {
                window.location.href = resolved.href;
              } else {
                router.push(resolved.href);
              }
            }}
            className="relative mx-auto mt-3 flex w-full max-w-xl items-center gap-2 rounded-2xl border border-white/[0.08] bg-white/[0.04] px-3 py-1.5 backdrop-blur-md focus-within:border-fuchsia-500/40 focus-within:bg-white/[0.06] focus-within:shadow-[0_0_24px_rgba(217,70,239,0.12)] transition animate-float-up sm:mt-4"
            style={{ animationDelay: "300ms", animationFillMode: "both" }}
          >
            <SearchIcon className="h-4 w-4 shrink-0 text-white/40" aria-hidden />
            <input
              type="search"
              value={heroQuery}
              onChange={(e) => setHeroQuery(e.target.value)}
              placeholder="Buscar por nombre, zona o servicio"
              aria-label="Buscar"
              className="w-full bg-transparent text-sm text-white placeholder:text-white/35 outline-none"
            />
            <button
              type="submit"
              className="shrink-0 rounded-xl bg-gradient-to-r from-fuchsia-600 to-violet-600 px-3 py-1.5 text-xs font-semibold text-white transition hover:brightness-110"
            >
              Buscar
            </button>
          </form>

          {/* Chips de filtros rápidos */}
          <div className="scrollbar-none mt-2.5 -mx-4 flex gap-2 overflow-x-auto px-4 pb-0.5 sm:mx-0 sm:flex-wrap sm:justify-center sm:overflow-visible sm:px-0">
            {[
              { label: "Cerca (2km)", href: "/servicios", icon: Navigation, iconColor: "text-emerald-400" },
              { label: "Disponible ahora", href: "/escorts?availableNow=true", icon: Zap, iconColor: "text-amber-400" },
              { label: "Videollamada", href: "/videocall", icon: Video, iconColor: "text-blue-400" },
              { label: "Verificadas", href: "/escorts", icon: ShieldCheck, iconColor: "text-fuchsia-400" },
              { label: "Premium", href: "/premium", icon: Crown, iconColor: "text-amber-300" },
            ].map((c) => (
              <Link
                key={c.label}
                href={c.href}
                className="group inline-flex shrink-0 items-center gap-1.5 rounded-full border border-white/[0.08] bg-white/[0.03] px-3 py-1 text-[11px] font-medium text-white/70 backdrop-blur-sm transition hover:border-fuchsia-500/25 hover:bg-white/[0.06] hover:text-white"
              >
                <c.icon className={`h-3 w-3 ${c.iconColor}`} aria-hidden />
                {c.label}
              </Link>
            ))}
          </div>

          {/* Link compacto para descargar app */}
          <div className="mt-3">
            <InstallAppButton compact />
          </div>
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
            href="/empezar"
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
        <div className="mb-6 h-px bg-gradient-to-r from-transparent via-fuchsia-500/[0.08] to-transparent" />

        {/* ═══ HOME FEED — secciones inmediatas + scroll infinito ═══ */}
        <HomeFeed
          newProfiles={newProfiles}
          availableProfiles={availableProfiles}
          examProfiles={recentPros.filter(hasExamsBadge)}
          centroProfiles={recentPros}
          destacadasProfiles={featuredCarouselProfiles}
        />

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

        {/* ═══ CREADORAS U-MATE ═══ */}
        {umateCreators.length > 0 && (
          <section key={`umate-${locationKey}`} className="mb-10 uzeed-below-fold">
            <div className="mb-4 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <h2 className="text-xl font-bold tracking-tight">Creadoras U-Mate</h2>
                <span className="rounded-full border border-[#00aff0]/20 bg-[#00aff0]/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-[#00aff0]">
                  Exclusivo
                </span>
              </div>
              <Link
                href="/umate/creators"
                className="group flex items-center gap-1 text-xs font-medium text-white/40 hover:text-[#00aff0] transition-colors duration-200"
              >
                Ver todas <ChevronRight className="h-3.5 w-3.5 transition-transform duration-200 group-hover:translate-x-0.5" />
              </Link>
            </div>
            <div className="scrollbar-none -mx-4 flex gap-3 overflow-x-auto px-4 pb-2 snap-x snap-mandatory sm:mx-0 sm:grid sm:grid-cols-2 sm:overflow-visible sm:px-0 md:grid-cols-3 lg:grid-cols-4">
              {umateCreators.map((c) => (
                <article
                  key={c.id}
                  className="uzeed-premium-card group w-[68vw] shrink-0 snap-start sm:w-auto"
                  style={{ borderColor: "rgba(0,175,240,0.12)" }}
                >
                  <Link href={`/umate/profile/${c.user.username}`} className="block">
                    <div className="uzeed-card-shimmer relative aspect-[3/4] overflow-hidden rounded-[inherit] bg-[#0a0a10]">
                      {(c.coverUrl || c.avatarUrl) ? (
                        <img
                          src={resolveMediaUrl(c.coverUrl || c.avatarUrl) ?? undefined}
                          alt={c.displayName}
                          className="uzeed-card-img h-full w-full object-cover"
                          loading="lazy"
                          decoding="async"
                          onError={(e) => { (e.currentTarget as HTMLImageElement).src = "/brand/isotipo-new.png"; }}
                        />
                      ) : (
                        <div className="flex h-full items-center justify-center">
                          <Users className="h-10 w-10 text-white/[0.06]" />
                        </div>
                      )}
                      {/* Badge tarifa mensual */}
                      <div className="absolute right-2 top-2 z-[3] flex items-center gap-1 rounded-lg border border-[#00aff0]/25 bg-black/50 px-2 py-0.5 text-[10px] font-bold text-[#00aff0] backdrop-blur-xl tabular-nums">
                        ${c.monthlyPriceCLP.toLocaleString("es-CL")}/mes
                      </div>
                      <div className="uzeed-card-gradient-subtle absolute inset-0" />
                      {/* Nombre + suscriptores */}
                      <div className="absolute bottom-0 left-0 right-0 p-3 z-[3]">
                        <h3 className="truncate text-sm font-bold flex items-center gap-1">
                          <span className="truncate">{c.displayName}</span>
                          {c.user.isVerified && <BadgeCheck className="h-3.5 w-3.5 shrink-0 text-[#00aff0]" />}
                        </h3>
                        <p className="mt-0.5 text-[10px] text-white/40 flex items-center gap-1">
                          <Users className="h-2.5 w-2.5 text-[#00aff0]/60" />
                          {c.subscriberCount} suscriptores
                        </p>
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
