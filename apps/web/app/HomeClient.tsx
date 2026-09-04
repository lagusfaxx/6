"use client";

import { startTransition, useContext, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import dynamic from "next/dynamic";
import { apiFetch, resolveMediaUrl } from "../lib/api";
import { CHILEAN_CITIES, LocationFilterContext } from "../hooks/useLocationFilter";
import { CITY_LANDINGS } from "../lib/cities";
import { PROFILE_TAGS_CATALOG, SERVICE_TAGS_CATALOG } from "../components/DirectoryPage";
import useMe from "../hooks/useMe";
import { useDiscreet } from "../components/DiscreetProvider";
import { DISCREET_BRAND, discreetLabel } from "../lib/discreet";

const Stories = dynamic(() => import("../components/Stories"), { ssr: false });
const ProfilePreviewModal = dynamic(() => import("../components/ProfilePreviewModal"), { ssr: false });
const HomeFeed = dynamic(() => import("../components/home/HomeFeed"), { ssr: false });
const LiveCamsSection = dynamic(() => import("../components/home/LiveCamsSection"), { ssr: false });
const HomeMapSection = dynamic(() => import("../components/home/HomeMapSection"), { ssr: false });
const NovedadesCarousel = dynamic(() => import("../components/home/NovedadesCarousel"), { ssr: false });
const DestacadasGrid = dynamic(() => import("../components/home/DestacadasGrid"), { ssr: false });

import {
  buildChatHref,
  buildCurrentPathWithSearch,
  buildLoginHref,
} from "../lib/chat";
import {
  ArrowRight,
  BadgeCheck,
  ChevronRight,
  CircleUser,
  Download,
  Hand,
  Hotel,
  MapPin,
  Navigation,
  Search as SearchIcon,
  ShoppingBag,
  Sparkles,
  Users,
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
  { keywords: ["marketplace", "market", "tienda", "packs", "pack de fotos", "comprar"], href: "/marketplace" },
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

/* La ciudad del perfil es texto libre ("Las Condes", "Las Condes, Santiago"),
   así que se compara sin tildes y por contención en ambos sentidos. */
function sameCityName(
  profileCity: string | null | undefined,
  selectedCity: string | null,
): boolean {
  if (!selectedCity) return false;
  const a = normalizeQuery(String(profileCity ?? ""));
  const b = normalizeQuery(selectedCity);
  if (!a || !b) return false;
  return a === b || a.includes(b) || b.includes(a);
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
  city?: string | null;
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

/* Solo lo que la tarjeta de novedades necesita. */
type NewProfile = {
  id: string;
  displayName: string;
  city?: string | null;
  avatarUrl?: string | null;
  coverUrl?: string | null;
  availableNow?: boolean;
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

/* ── Page ── */

const SANTIAGO_FALLBACK: [number, number] = [-33.45, -70.66];

export default function HomeClient() {
  const router = useRouter();
  const [heroQuery, setHeroQuery] = useState("");
  const [banners, setBanners] = useState<Banner[]>([]);
  const [bannersLoaded, setBannersLoaded] = useState(false);
  const [recentPros, setRecentPros] = useState<RecentProfessional[]>([]);
  const [newProfiles, setNewProfiles] = useState<NewProfile[]>([]);
  const [bannerProfiles, setBannerProfiles] = useState<Record<string, FeaturedBannerProfile>>({});
  const locationCtx = useContext(LocationFilterContext);
  const location = locationCtx?.effectiveLocation ?? SANTIAGO_FALLBACK;
  /* Comuna elegida en el chip. Va aparte de las coordenadas: la distancia se
     mide contra el centro de la comuna, así que sin el nombre la API no puede
     poner los perfiles de la comuna por delante de los de la vecina. */
  const selectedCityName =
    locationCtx?.state.mode === "city"
      ? locationCtx.state.selectedCity?.name ?? null
      : null;
  const locationKey = `${location[0]}-${location[1]}-${selectedCityName ?? ""}`;
  const [recentLoading, setRecentLoading] = useState(true);
  const { me } = useMe();
  const { discreet } = useDiscreet();
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
    // Con comuna elegida en el chip, sus perfiles van primero: la distancia se
    // mide contra el centro de la comuna y una vecina puede quedar más cerca.
    if (selectedCityName) params.set("city", selectedCityName);
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
            city: p.city ?? null,
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

        /* Los de la comuna elegida arriba y, dentro de ella, por cercanía;
           después el resto por distancia real. Ordenar solo por distancia
           metía perfiles de la comuna vecina por delante de los de la comuna
           que la persona acababa de elegir en el chip. */
        mapped.sort((a, b) => {
          if (selectedCityName) {
            const cityCmp =
              Number(!sameCityName(a.city, selectedCityName)) -
              Number(!sameCityName(b.city, selectedCityName));
            if (cityCmp !== 0) return cityCmp;
          }
          return (a.distance ?? 1e9) - (b.distance ?? 1e9);
        });

        setRecentPros(mapped);
      })
      .catch((err: any) => {
        if (err?.name === "AbortError") return;
      })
      .finally(() => setRecentLoading(false));

    return () => {
      controller.abort();
    };
  }, [locationKey]); // eslint-disable-line react-hooks/exhaustive-deps

  /* Perfiles recién publicados para la sección bajo el mapa. Es una sola
     consulta: al quitar la sección se habían eliminado las tres de
     /profiles/discover, y solo hace falta esta. */
  useEffect(() => {
    const controller = new AbortController();
    const qp = new URLSearchParams({ sort: "new", limit: "12", gender: "FEMALE" });
    qp.set("lat", String(location[0]));
    qp.set("lng", String(location[1]));

    apiFetch<{ profiles: NewProfile[] }>(`/profiles/discover?${qp.toString()}`, {
      signal: controller.signal,
    })
      .then((res) => setNewProfiles(res?.profiles ?? []))
      .catch(() => {
        /* silenciado: sin datos la sección simplemente no se muestra */
      });

    return () => controller.abort();
  }, [locationKey]); // eslint-disable-line react-hooks/exhaustive-deps

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
  }, [locationKey]); // eslint-disable-line react-hooks/exhaustive-deps

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

  /* Rangos: Diamond y Gold van separados y en ese orden.
     Antes era una única sección "Destacadas" que los mezclaba, y con eso el
     rango — que es el plan que la profesional paga — no se veía por ninguna
     parte del inicio. Cada nivel tiene ahora su propia sección. */
  const diamondProfiles = useMemo(
    () => recentPros.filter((p) => p.userLevel === "DIAMOND").slice(0, 12),
    [recentPros],
  );
  const goldProfiles = useMemo(
    () => recentPros.filter((p) => p.userLevel === "GOLD").slice(0, 12),
    [recentPros],
  );
  const hasTieredProfiles = diamondProfiles.length > 0 || goldProfiles.length > 0;

  const toCardProfile = (p: RecentProfessional) => ({
    id: p.id,
    displayName: p.name,
    avatarUrl: p.avatarUrl ?? null,
    coverUrl: p.coverUrl ?? null,
    availableNow: !!p.availableNow,
  });

  /* Cuatro por rango en la fila compacta sobre el mapa: son dos filas ahora,
     así que cada una tiene que ocupar menos que la única de antes para que el
     mapa siga entrando en la primera pantalla. */
  const diamondCompact = useMemo(
    () => diamondProfiles.slice(0, 4).map(toCardProfile),
    [diamondProfiles],
  );
  const goldCompact = useMemo(
    () => goldProfiles.slice(0, 4).map(toCardProfile),
    [goldProfiles],
  );

  const novedades = useMemo(
    () =>
      newProfiles.slice(0, 12).map((p) => ({
        id: p.id,
        displayName: p.displayName,
        city: p.city ?? null,
        avatarUrl: p.avatarUrl ?? null,
        coverUrl: p.coverUrl ?? null,
        availableNow: !!p.availableNow,
      })),
    [newProfiles],
  );

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
          <div className="mt-1.5 flex items-center justify-center gap-0.5 rounded-md bg-fuchsia-600 px-2 py-1 text-[9px] font-bold text-white">
            Ver perfil <ArrowRight className="h-2.5 w-2.5" />
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-[100dvh] overflow-x-hidden text-white antialiased">
      {/* ═══ HERO ═══ */}
      <section className="relative flex items-center justify-center px-4 pt-5 pb-4 md:pt-9 md:pb-6">
        <div className="pointer-events-none absolute inset-0 -z-10 bg-[#050510]" />

        <div className="relative mx-auto w-full max-w-3xl text-center">
          {/* En modo discreto el titular es lo primero que delata a un metro de
              distancia, así que cambia junto con el resto del disfraz. */}
          <h1 className="text-[1.35rem] font-extrabold leading-[1.15] tracking-tight text-white sm:text-[1.9rem] md:text-[2.15rem]">
            {discreet ? DISCREET_BRAND.tagline : "Escorts y masajistas cerca tuyo"}
          </h1>

          <p className="mx-auto mt-2 max-w-lg text-[12.5px] leading-snug text-white/50 sm:text-sm">
            {discreet ? (
              <>Mira en el mapa qué hay disponible cerca de ti, en {CITY_LANDINGS.length} comunas.</>
            ) : (
              <>
                Mira en el mapa quién está a pocos kilómetros y conectada ahora mismo.
                Perfiles verificados en Santiago, Viña del Mar y otras {CITY_LANDINGS.length - 2} comunas.
              </>
            )}
          </p>

          {/* CTA primario: el mapa, que es la ruta más corta al contacto */}
          <div className="mt-4 flex flex-wrap items-center justify-center gap-2.5">
            <Link
              href="/cerca"
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-fuchsia-600 px-5 py-2.5 text-sm font-bold text-white transition hover:bg-fuchsia-500"
            >
              <Navigation className="h-4 w-4" />
              Ver quién está cerca
            </Link>
            <Link
              href="/services"
              className="group inline-flex items-center justify-center gap-2 rounded-xl border border-white/10 px-5 py-2.5 text-sm font-semibold text-white/70 transition hover:border-white/30 hover:text-white"
            >
              Ver todos los perfiles
              <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
            </Link>
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
            className="relative mx-auto mt-4 flex w-full max-w-xl items-center gap-2 rounded-xl border border-white/[0.10] bg-white/[0.04] px-3 py-1.5 transition focus-within:border-fuchsia-500/50 focus-within:bg-white/[0.06]"
            role="search"
          >
            <SearchIcon className="h-4 w-4 shrink-0 text-white/40" aria-hidden />
            <input
              type="search"
              value={heroQuery}
              onChange={(e) => setHeroQuery(e.target.value)}
              placeholder="Nombre, comuna o servicio"
              aria-label="Buscar"
              className="w-full bg-transparent text-sm text-white placeholder:text-white/35 outline-none"
            />
            <button
              type="submit"
              className="shrink-0 rounded-lg bg-fuchsia-600 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-fuchsia-500"
            >
              Buscar
            </button>
          </form>

          {/* Acceso directo a los perfiles masculinos. El inicio muestra
              mujeres por defecto (incluidos los perfiles sin género), así que
              sin este botón el público que busca hombres no tenía por dónde
              entrar. Va en azul para que se distinga del fucsia de la marca. */}
          <div className="mt-3 flex justify-center">
            <Link
              href="/services?gender=hombres"
              className="group inline-flex items-center gap-2 rounded-xl border border-blue-400/30 bg-gradient-to-r from-blue-600/25 to-sky-500/15 px-5 py-2 text-sm font-bold text-blue-200 transition hover:border-blue-400/60 hover:from-blue-600/40 hover:to-sky-500/25 hover:text-white"
            >
              <CircleUser className="h-4 w-4" aria-hidden />
              Ellos
              {!discreet && (
                <span className="text-[11px] font-medium text-blue-200/60 group-hover:text-white/70">
                  escorts hombres
                </span>
              )}
              <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
            </Link>
          </div>

          {/* Categorías — qué busca el cliente. Antes esto convivía con una
              segunda fila casi idéntica más abajo y con un chip "Verificadas"
              que apuntaba a /escorts sin filtro, porque la verificación no es
              filtrable: se muestra como insignia en cada tarjeta. Los filtros
              por estado (disponible, nuevas, exámenes) viven ahora sobre el
              grid, que es donde se usan. */}
          <nav
            aria-label="Categorías"
            className="scrollbar-none -mx-4 mt-3 flex gap-2 overflow-x-auto px-4 pb-0.5 sm:mx-0 sm:flex-wrap sm:justify-center sm:overflow-visible sm:px-0"
          >
            {[
              { label: "Escorts", href: "/escorts", icon: Sparkles },
              { label: "Masajistas", href: "/masajistas", icon: Hand },
              { label: "Moteles", href: "/moteles", icon: Hotel },
              { label: "Sex Shop", href: "/sexshop", icon: ShoppingBag },
              { label: "Marketplace", href: "/marketplace", icon: ShoppingBag },
            ].map((c) => (
              <Link
                key={c.href}
                href={c.href}
                className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-white/[0.10] px-3.5 py-1.5 text-xs font-medium text-white/70 transition hover:border-fuchsia-500/35 hover:text-white"
              >
                <c.icon className="h-3.5 w-3.5 text-white/40" aria-hidden />
                {discreetLabel(c.href, c.label, discreet)}
              </Link>
            ))}
          </nav>

          {/* Link compacto para descargar app */}
          <div className="mt-3">
            <InstallAppButton compact />
          </div>
        </div>
      </section>

      <div className="relative mx-auto max-w-5xl px-4">
        <div className="h-px bg-white/[0.07]" />
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

        {/* ═══ RANGOS (compactos) — van sobre el mapa, en fila y pequeños,
             para que el mapa siga entrando en pantalla al abrir el home.
             Diamond primero: es el plan más alto. ═══ */}
        {diamondCompact.length > 0 && (
          <DestacadasGrid profiles={diamondCompact} tier="DIAMOND" compact />
        )}
        {goldCompact.length > 0 && (
          <DestacadasGrid profiles={goldCompact} tier="GOLD" compact />
        )}
        {!hasTieredProfiles && !recentLoading && (
          /* Sin perfiles de rango la zona quedaría vacía, así que se usa para
             mostrar de qué van los planes — que es justo lo que estas
             secciones tienen que hacer visible. */
          <Link
            href="/ayuda/tiers"
            className="group mb-4 flex items-center justify-between gap-3 rounded-2xl border border-white/[0.08] bg-gradient-to-r from-cyan-500/[0.08] via-amber-500/[0.06] to-transparent px-4 py-3 transition hover:border-white/20"
          >
            <div className="min-w-0">
              <span className="text-sm font-bold text-white">
                Planes <span className="text-cyan-300">Diamond</span> y{" "}
                <span className="text-amber-300">Gold</span>
              </span>
              <p className="mt-0.5 truncate text-[11px] text-white/45">
                Los perfiles con plan aparecen primero en el inicio
              </p>
            </div>
            <ChevronRight className="h-4 w-4 shrink-0 text-white/40 transition-transform group-hover:translate-x-0.5" />
          </Link>
        )}

        {/* ═══ MAPA DE CERCANÍA — el atajo al contacto ═══
             A sangre completa: se sale del max-w y del padding del contenedor
             para ocupar todo el ancho de la pantalla. */}
        {/* Ancho completo anulando el padding de los DOS ancestros que lo
            aportan: el <main> de AppShell y este contenedor, 16px cada uno.
            No se usa w-screen porque en escritorio hay una barra lateral de
            240px: centrar contra el viewport metía la sección debajo de ella
            y cortaba el título y los chips de radio. Así el mapa llega al
            borde en móvil y ocupa todo el área de contenido en escritorio. */}
        <div className="-mx-8 mb-6">
          <HomeMapSection fullBleed />
        </div>

        {/* ═══ NUEVAS — justo bajo el mapa ═══ */}
        {novedades.length > 0 && (
          <NovedadesCarousel
            profiles={novedades}
            ctaHref="/escorts?sort=new"
            ctaLabel="Ver todas las nuevas"
          />
        )}

        {/* ═══ CTA PUBLÍCATE ═══ */}
        {!isAuthed && (
          <Link
            href="/empezar"
            className="group mb-6 flex items-center justify-between rounded-xl border border-fuchsia-500/20 bg-fuchsia-500/[0.06] px-5 py-4 transition-colors hover:border-fuchsia-500/35 hover:bg-fuchsia-500/[0.10]"
          >
            <div>
              <span className="text-sm font-semibold text-white">
                ¿Ofreces servicios? <span className="text-fuchsia-400">Publícate aquí</span>
              </span>
              <p className="mt-0.5 text-[11px] text-white/40">Perfil listo en minutos, sin registro previo</p>
            </div>
            <span className="shrink-0 rounded-lg bg-fuchsia-500/20 px-3 py-1.5 text-xs font-semibold text-fuchsia-300 transition-colors group-hover:bg-fuchsia-500/30">
              Empezar
            </span>
          </Link>
        )}

        <div className="mb-6 h-px bg-white/[0.06]" />

        {/* ═══ FEED — filtros + destacadas + grid infinito ═══ */}
        <HomeFeed diamondProfiles={diamondProfiles} goldProfiles={goldProfiles} />

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

        {/* ═══ CAMS EN VIVO ═══ */}
        <LiveCamsSection />

        {/* ═══ VIDEOLLAMADAS CTA BANNER ═══ */}

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
        {!isAuthed && <div className="mb-6 h-px bg-white/[0.06]" />}
        {!isAuthed && (
          <section className="rounded-2xl border border-white/[0.08] bg-white/[0.02] p-6 md:p-8 uzeed-below-fold">
            <h2 className="text-lg font-bold tracking-tight md:text-xl">Crea tu cuenta gratis</h2>
            <p className="mt-1.5 max-w-lg text-sm leading-relaxed text-white/45">
              Guarda tus favoritas, escribe por chat interno sin dar tu número y
              recupera tus búsquedas cuando vuelvas.
            </p>
            <div className="mt-5 flex flex-col gap-2.5 sm:flex-row sm:flex-wrap">
              <Link
                href="/register?type=CLIENT"
                className="group inline-flex items-center justify-center gap-2 rounded-xl bg-fuchsia-600 px-6 py-3 text-sm font-bold text-white transition hover:bg-fuchsia-500"
              >
                Soy cliente <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
              </Link>
              <Link
                href="/register?type=PROFESSIONAL"
                className="inline-flex items-center justify-center gap-2 rounded-xl border border-fuchsia-500/35 px-6 py-3 text-sm font-semibold text-fuchsia-200 transition hover:border-fuchsia-400/60 hover:text-white"
              >
                Quiero publicarme — {TRIAL_TEXT}
              </Link>
              <Link
                href="/register?type=ESTABLISHMENT"
                className="inline-flex items-center justify-center gap-2 rounded-xl border border-white/[0.10] px-6 py-3 text-sm font-semibold text-white/55 transition hover:border-white/25 hover:text-white/85"
              >
                Tengo un local
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
