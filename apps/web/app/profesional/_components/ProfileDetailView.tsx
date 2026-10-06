"use client";

import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import { ApiHttpError, apiFetch, resolveMediaUrl } from "../../../lib/api";
import {
  buildChatHref,
  buildCurrentPathWithSearch,
  buildLoginHref,
} from "../../../lib/chat";
import useMe from "../../../hooks/useMe";
import { trackAction } from "../../../hooks/useAnalytics";
import SkeletonCard from "../../../components/SkeletonCard";
import Link from "next/link";
import {
  ImageIcon,
  Star,
  Banknote,
  Clock,
  MapPin,
  CalendarClock,
  TrainFront,
  MessageSquare,
  ListChecks,
  Camera,
  User,
  Smile,
  Sparkles,
  HeartHandshake,
  X,
  Heart,
  ChevronLeft,
  ChevronRight,
  ShoppingBag,
  Phone,
  Play,
  Share2,
  Check,
  Gem,
  Crown,
  Medal,
  Cake,
  Ruler,
  Weight,
  Palette,
  Languages,
  Sun,
  Zap,
  BadgeCheck,
  ShieldCheck,
  House,
  Car,
  type LucideIcon,
} from "lucide-react";
import { hasVerifiedBadge } from "../../../lib/systemBadges";
import VerifiedBand from "../../../components/VerifiedBand";
import WhatsAppIcon from "../../../components/icons/WhatsAppIcon";

type GalleryItem = { url: string; type: "IMAGE" | "VIDEO" };

type ForumComment = {
  id: string;
  content: string;
  createdAt: string;
  author?: { displayName?: string | null; username: string } | null;
};

type Professional = {
  id: string;
  /** Se usa para las URLs limpias y para enlazar su tienda del marketplace. */
  username?: string | null;
  name: string;
  avatarUrl: string | null;
  coverUrl?: string | null;
  coverPositionX?: number | null;
  coverPositionY?: number | null;
  category: string | null;
  isActive: boolean;
  rating: number | null;
  reviewCount?: number;
  recentReviews?: ReviewComment[];
  description: string | null;
  age?: number | null;
  gender?: string | null;
  city?: string | null;
  /** Estación de metro más cercana, calculada en el servidor. */
  nearestMetro?: { name: string; lines: string[] } | null;
  serviceSummary?: string | null;
  isOnline: boolean;
  lastSeen: string | null;
  heightCm?: number | null;
  weightKg?: number | null;
  measurements?: string | null;
  hairColor?: string | null;
  skinTone?: string | null;
  languages?: string | null;
  serviceStyleTags?: string | null;
  normalizedTags?: string[];
  availabilityNote?: string | null;
  baseRate?: number | null;
  minDurationMinutes?: number | null;
  acceptsIncalls?: boolean | null;
  acceptsOutcalls?: boolean | null;
  profileTags?: string[];
  serviceTags?: string[];
  phone?: string | null;
  gallery: { id: string; url: string; type: string }[];
  stories?: { id: string; url: string; type: string }[];
  completedServices?: number;
  profileViews?: number;
  userLevel?: string | null;
  reviewTagsSummary?: Record<string, number> | null;
  umateActive?: boolean;
  umateName?: string | null;
  avgResponseMinutes?: number | null;
  forumThread?: {
    id: string;
    categorySlug: string;
    categoryName: string;
    url: string;
    comments: ForumComment[];
  } | null;
};

type ReviewComment = {
  id: string;
  rating: number;
  comment: string | null;
  createdAt: string;
  author?: { displayName?: string | null; username: string } | null;
};

type SurveyReview = {
  id: string;
  ratingBody: number;
  ratingFace: number;
  ratingPhotos: number;
  ratingService: number;
  ratingVibe: number;
  comment: string | null;
  overallScore: number;
  createdAt: string;
  author?: { displayName?: string | null; username: string } | null;
};

type SurveySummary = {
  count: number;
  avgBody: number;
  avgFace: number;
  avgPhotos: number;
  avgService: number;
  avgVibe: number;
  avgOverall: number;
};

/* Cuántos servicios se ven antes de "ver los restantes". Nueve llena tres
   columnas justas en el escritorio y deja la sección corta en el teléfono. */
const VISIBLE_SERVICES = 9;

/* Insignia del plan. Cada nivel con su color e icono: en texto plano
   ("Escort GOLD") el rango —que es lo que la profesional paga— no se notaba. */
const LEVEL_BADGES: Record<string, { label: string; Icon: LucideIcon; className: string }> = {
  DIAMOND: {
    label: "Diamond",
    Icon: Gem,
    className:
      "border-cyan-300/40 bg-gradient-to-r from-cyan-500/30 to-sky-500/10 text-cyan-100 shadow-[0_0_18px_rgba(34,211,238,0.18)]",
  },
  GOLD: {
    label: "Gold",
    Icon: Crown,
    className:
      "border-amber-300/40 bg-gradient-to-r from-amber-500/30 to-yellow-500/10 text-amber-100 shadow-[0_0_18px_rgba(251,191,36,0.15)]",
  },
  SILVER: {
    label: "Silver",
    Icon: Medal,
    className: "border-white/20 bg-gradient-to-r from-white/[0.12] to-white/[0.03] text-white/85",
  },
};

/* Icono y tono de cada dato de la ficha técnica. */
const SPEC_ICONS: Record<string, { Icon: LucideIcon; tint: string }> = {
  Edad: { Icon: Cake, tint: "bg-fuchsia-500/15 text-fuchsia-300" },
  Estatura: { Icon: Ruler, tint: "bg-violet-500/15 text-violet-300" },
  Peso: { Icon: Weight, tint: "bg-sky-500/15 text-sky-300" },
  Medidas: { Icon: Sparkles, tint: "bg-rose-500/15 text-rose-300" },
  Cabello: { Icon: Palette, tint: "bg-amber-500/15 text-amber-300" },
  Piel: { Icon: Sun, tint: "bg-orange-500/15 text-orange-300" },
  Idiomas: { Icon: Languages, tint: "bg-emerald-500/15 text-emerald-300" },
};

/** Título de sección con el icono dentro de un cuadrito de color. */
function SectionTitle({
  Icon,
  tint,
  children,
}: {
  Icon: LucideIcon;
  tint: string;
  children: ReactNode;
}) {
  return (
    <h2 className="flex items-center gap-2.5 text-lg font-semibold tracking-tight">
      <span className={`grid h-8 w-8 shrink-0 place-items-center rounded-lg ${tint}`}>
        <Icon className="h-4 w-4" />
      </span>
      {children}
    </h2>
  );
}

const SERVICE_SUBCATEGORIES = [
  "Anal",
  "Oral",
  "Vaginal",
  "Masaje erótico",
  "Masaje relajante",
  "Tríos",
  "Packs",
  "Videollamada",
  "Despedida de solteros",
  "Discapacitados",
  "Duo",
  "Dominación",
  "Sumisión",
  "Roleplay",
  "Fantasías",
  "Striptease",
  "Beso negro",
  "Lluvia dorada",
  "Fetichismo",
  "Novia experience",
] as const;

function splitCsv(value?: string | null) {
  return (value || "")
    .split(",")
    .map((v) => v.trim())
    .filter(Boolean);
}

/** Strip emoji and AI-generated filler text from bio/descriptions */
function cleanProfileText(text: string | null | undefined): string | null {
  if (!text) return null;
  const cleaned = text
    // Remove emoji characters
    .replace(
      /[\u{1F300}-\u{1F9FF}\u{2600}-\u{27BF}\u{FE00}-\u{FE0F}\u{200D}\u{20E3}\u{E0020}-\u{E007F}]/gu,
      "",
    )
    // Remove common AI filler phrases
    .replace(
      /(\b(hola|hey|bienvenido|bienvenidos)\b[!.,]*\s*(soy|me llamo|mi nombre es)?)/gi,
      "",
    )
    .replace(
      /\b(escríbeme|contáctame|no te arrepentirás|te espero|llámame)\s*(ya|ahora|hoy|pronto|para más info)?[!.]*$/gim,
      "",
    )
    // Remove consecutive special chars
    .replace(/[*_~`]{2,}/g, "")
    // Collapse whitespace
    .replace(/\n{3,}/g, "\n\n")
    .replace(/[ \t]{2,}/g, " ")
    .trim();
  return cleaned || null;
}

function isRecentlySeen(lastSeen?: string | null) {
  if (!lastSeen) return false;
  const parsed = Date.parse(lastSeen);
  if (Number.isNaN(parsed)) return false;
  return Date.now() - parsed <= 10 * 60 * 1000;
}

function timeAgo(dateStr: string) {
  const diff = Date.now() - Date.parse(dateStr);
  const minutes = Math.floor(diff / 60000);
  if (minutes < 60) return `hace ${minutes}m`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `hace ${hours}h`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `hace ${days}d`;
  const months = Math.floor(days / 30);
  return `hace ${months} mes${months > 1 ? "es" : ""}`;
}

export default function ProfileDetailView({
  id,
  username,
}: {
  id?: string;
  username?: string;
}) {
  const [professional, setProfessional] = useState<Professional | null>(null);
  const [favorite, setFavorite] = useState(false);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  /* La barra de contacto se monta en <body>: dentro del contenedor con
     overflow-x-hidden, iOS la arrastraba con el scroll y quedaba flotando a
     media pantalla. */
  const [portalReady, setPortalReady] = useState(false);
  useEffect(() => setPortalReady(true), []);
  const [lightbox, setLightbox] = useState<GalleryItem | null>(null);
  const [galleryIndex, setGalleryIndex] = useState(0);
  const thumbVideoRefs = useRef(new Map<string, HTMLVideoElement>());
  /* La presentación recorta la biografía: en el escritorio va en una columna
     angosta y sin recortar empujaba la ficha entera hacia abajo. */
  const [aboutOpen, setAboutOpen] = useState(false);
  const aboutRef = useRef<HTMLParagraphElement | null>(null);
  const [aboutOverflows, setAboutOverflows] = useState(false);
  const [showAllReviews, setShowAllReviews] = useState(false);
  /* La lista de servicios se muestra recortada: hay perfiles con veinte o más
     y en el teléfono eso son veinte renglones que empujan las fotos y las
     opiniones fuera de la pantalla. */
  const [showAllServices, setShowAllServices] = useState(false);
  const [showSurveyModal, setShowSurveyModal] = useState(false);
  const [surveyReviews, setSurveyReviews] = useState<SurveyReview[]>([]);
  const [surveySummary, setSurveySummary] = useState<SurveySummary | null>(
    null,
  );
  const [surveyForm, setSurveyForm] = useState({
    ratingBody: 5,
    ratingFace: 5,
    ratingPhotos: 5,
    ratingService: 5,
    ratingVibe: 5,
    comment: "",
  });
  const [surveySubmitting, setSurveySubmitting] = useState(false);
  const [surveyError, setSurveyError] = useState<string | null>(null);
  const [surveySuccess, setSurveySuccess] = useState(false);
  const [hasStore, setHasStore] = useState(false);
  const [shareFeedback, setShareFeedback] = useState<string | null>(null);
  const { me } = useMe();

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setNotFound(false);

    const load = async () => {
      try {
        let professionalId = id;
        if (!professionalId && username) {
          try {
            const profileRes = await apiFetch<{ profile: { id: string } }>(
              `/profiles/${encodeURIComponent(username)}`,
            );
            professionalId = profileRes.profile?.id;
          } catch {
            // Profile endpoint may fail for expired plans — try directory search as fallback
            try {
              const searchRes = await apiFetch<{
                results: Array<{ id: string; username: string }>;
              }>(
                `/directory/search?entityType=professional&categorySlug=escort&limit=1&q=${encodeURIComponent(username)}`,
              );
              const match = searchRes?.results?.find(
                (r) => r.username === username,
              );
              if (match) professionalId = match.id;
            } catch {
              // ignore fallback failure
            }
          }
        }
        if (!professionalId) {
          if (!cancelled) setNotFound(true);
          return;
        }
        const res = await apiFetch<
          { professional?: Professional } | Professional
        >(`/professionals/${professionalId}`);
        const payload =
          (res as { professional?: Professional }).professional ??
          (res as Professional);
        if (!payload) throw new Error("NO_PROFILE");
        if (!cancelled) setProfessional(payload);
      } catch (err) {
        if (
          !cancelled &&
          err instanceof ApiHttpError &&
          [403, 404].includes(err.status)
        ) {
          setNotFound(true);
        }
        if (!cancelled) setProfessional(null);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    load();
    return () => {
      cancelled = true;
    };
  }, [id, username]);

  useEffect(() => {
    if (!professional || me?.user?.profileType !== "VIEWER") {
      setFavorite(false);
      return;
    }
    apiFetch<{ isFavorite: boolean }>(`/favorites/check/${professional.id}`)
      .then((res) => setFavorite(res.isFavorite))
      .catch(() => setFavorite(false));
  }, [me?.user?.profileType, professional]);

  // ¿Tiene tienda con artículos publicados en el marketplace?
  useEffect(() => {
    if (!professional?.username) {
      setHasStore(false);
      return;
    }
    apiFetch<{ products: unknown[] }>(`/market/sellers/${encodeURIComponent(professional.username)}`)
      .then((res) => setHasStore((res.products?.length || 0) > 0))
      .catch(() => setHasStore(false));
  }, [professional?.username]);

  // Lock body scroll while survey modal is open
  useEffect(() => {
    if (!showSurveyModal) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [showSurveyModal]);

  useEffect(() => {
    setGalleryIndex(0);
    if (!professional?.id) return;
    apiFetch<{ reviews: SurveyReview[]; summary: SurveySummary }>(
      `/professionals/${professional.id}/review-surveys`,
    )
      .then((res) => {
        setSurveyReviews(res.reviews || []);
        setSurveySummary(res.summary || null);
      })
      .catch(() => {});
  }, [professional?.id]);

  const styleChips = useMemo(
    () => splitCsv(professional?.serviceStyleTags),
    [professional?.serviceStyleTags],
  );

  // Match service subcategories from tags
  const matchedSubcategories = useMemo(() => {
    const tags = (professional?.normalizedTags || []).map((t) =>
      t.toLowerCase(),
    );
    const fromStyle = styleChips.map((c) => c.toLowerCase());
    const all = [...tags, ...fromStyle];
    return SERVICE_SUBCATEGORIES.filter((sub) =>
      all.some(
        (t) => t.includes(sub.toLowerCase()) || sub.toLowerCase().includes(t),
      ),
    );
  }, [professional?.normalizedTags, styleChips]);

  // Extra subcategories not already in serviceTags
  const extraSubcategories = useMemo(
    () =>
      matchedSubcategories.filter(
        (sub) =>
          !(professional?.serviceTags ?? []).some(
            (t) => t.toLowerCase() === sub.toLowerCase(),
          ),
      ),
    [matchedSubcategories, professional?.serviceTags],
  );

  const availableNow = useMemo(
    () => isRecentlySeen(professional?.lastSeen),
    [professional?.lastSeen],
  );
  const coverSrc =
    resolveMediaUrl(professional?.coverUrl) ??
    resolveMediaUrl(professional?.avatarUrl);
  const gallery = useMemo<GalleryItem[]>(() => {
    const seen = new Set<string>();
    const baseItems: GalleryItem[] = [];
    const storyItems: GalleryItem[] = [];
    const tryAdd = (
      raw: string | null | undefined,
      rawType: string | null | undefined,
      target: GalleryItem[],
    ) => {
      if (!raw) return;
      const resolved = resolveMediaUrl(raw) ?? raw;
      if (!resolved || seen.has(resolved)) return;
      const type =
        String(rawType || "").toUpperCase() === "VIDEO" ? "VIDEO" : "IMAGE";
      seen.add(resolved);
      target.push({ url: resolved, type });
    };
    tryAdd(professional?.coverUrl, "IMAGE", baseItems);
    tryAdd(professional?.avatarUrl, "IMAGE", baseItems);
    for (const g of professional?.gallery ?? []) tryAdd(g.url, g.type, baseItems);
    for (const s of professional?.stories ?? [])
      tryAdd(s.url, s.type, storyItems);
    const latestVideoIdx = storyItems.findIndex((s) => s.type === "VIDEO");
    let latestVideo: GalleryItem | null = null;
    if (latestVideoIdx >= 0) {
      [latestVideo] = storyItems.splice(latestVideoIdx, 1);
    }
    const merged = [...baseItems];
    if (latestVideo) {
      const insertAt = Math.min(4, merged.length);
      merged.splice(insertAt, 0, latestVideo);
    }
    merged.push(...storyItems);
    return merged;
  }, [
    professional?.gallery,
    professional?.stories,
    professional?.coverUrl,
    professional?.avatarUrl,
  ]);
  const latestStoryVideoUrl = useMemo(() => {
    const first = (professional?.stories ?? []).find(
      (s) => String(s.type || "").toUpperCase() === "VIDEO",
    );
    if (!first) return null;
    return resolveMediaUrl(first.url) ?? first.url;
  }, [professional?.stories]);
  const lightboxIndex = lightbox
    ? gallery.findIndex((g) => g.url === lightbox.url)
    : -1;

  useEffect(() => {
    if (!gallery.length) {
      setGalleryIndex(0);
      return;
    }
    setGalleryIndex((prev) => Math.min(prev, gallery.length - 1));
  }, [gallery.length]);

  /* ¿La biografía quedó recortada? Se mide el párrafo real: el recorte lo hace
     el navegador según el ancho de la columna, así que contar caracteres no
     sirve — a un ancho entra y a otro no. Se vuelve a medir al cambiar el
     tamaño de la ventana. */
  useEffect(() => {
    const el = aboutRef.current;
    if (!el) {
      setAboutOverflows(false);
      return;
    }
    const measure = () => {
      if (aboutOpen) return; // desplegado siempre cabe: el botón dice "Leer menos"
      setAboutOverflows(el.scrollHeight - el.clientHeight > 2);
    };
    measure();
    if (typeof ResizeObserver !== "function") {
      window.addEventListener("resize", measure);
      return () => window.removeEventListener("resize", measure);
    }
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => observer.disconnect();
  }, [aboutOpen, professional?.description]);

  function goToGallery(nextIndex: number) {
    if (!gallery.length) return;
    setGalleryIndex((nextIndex + gallery.length) % gallery.length);
  }

  const hasStyleSection =
    styleChips.length > 0 || matchedSubcategories.length > 0;
  const hasRatesSection = typeof professional?.baseRate === "number";

  // Review tags as sorted array
  const reviewTags = useMemo(() => {
    if (!professional?.reviewTagsSummary) return [];
    return Object.entries(professional.reviewTagsSummary)
      .filter(([, v]) => typeof v === "number" && v > 0)
      .sort(([, a], [, b]) => (b as number) - (a as number))
      .slice(0, 8)
      .map(([tag, count]) => ({ tag, count: count as number }));
  }, [professional?.reviewTagsSummary]);

  const reviews = professional?.recentReviews || [];
  const displayedReviews = showAllReviews ? reviews : reviews.slice(0, 3);

  const forumComments = (professional?.forumThread?.comments || []).slice(0, 5);

  function redirectToLoginIfNeeded() {
    if (me?.user) return false;
    window.location.href = buildLoginHref(buildCurrentPathWithSearch());
    return true;
  }

  function handleChatClick(mode: "message" | "request") {
    if (!professional) return;
    if (redirectToLoginIfNeeded()) return;
    window.location.href = buildChatHref(professional.id, { mode });
  }

  function formatWhatsAppUrl(phone: string) {
    const cleaned = phone.replace(/[^0-9+]/g, "");
    const num = cleaned.startsWith("+") ? cleaned.slice(1) : cleaned;
    const message = professional?.name
      ? `Hola ${professional.name}, te vi en Uzeed.cl`
      : "Hola, te vi en Uzeed.cl";
    return `https://wa.me/${num}?text=${encodeURIComponent(message)}`;
  }

  async function toggleFavorite() {
    if (!professional) return;
    if (!me?.user) {
      window.location.href = buildLoginHref(buildCurrentPathWithSearch());
      return;
    }
    setFavorite((prev) => !prev);
    try {
      if (!favorite) {
        await apiFetch(`/favorites/${professional.id}`, { method: "POST" });
      } else {
        await apiFetch(`/favorites/${professional.id}`, { method: "DELETE" });
      }
    } catch {
      setFavorite((prev) => !prev);
    }
  }

  async function handleShare(source: string) {
    if (!professional) return;
    const url = typeof window !== "undefined" ? window.location.href : "";
    const title = `Perfil de ${professional.name} en Uzeed`;
    const text = `Mira el perfil de ${professional.name} en Uzeed.cl`;
    trackAction("profile_share", professional.id, {
      source,
      displayName: professional.name,
    });
    try {
      if (typeof navigator !== "undefined" && (navigator as any).share) {
        await (navigator as any).share({ title, text, url });
        return;
      }
      if (
        typeof navigator !== "undefined" &&
        navigator.clipboard?.writeText
      ) {
        await navigator.clipboard.writeText(url);
        setShareFeedback("Enlace copiado");
        setTimeout(() => setShareFeedback(null), 2200);
        return;
      }
    } catch (err: any) {
      if (err?.name === "AbortError") return;
      try {
        await navigator.clipboard.writeText(url);
        setShareFeedback("Enlace copiado");
        setTimeout(() => setShareFeedback(null), 2200);
      } catch {
        setShareFeedback("No se pudo compartir");
        setTimeout(() => setShareFeedback(null), 2200);
      }
    }
  }

  async function submitSurvey() {
    if (!professional) return;
    if (redirectToLoginIfNeeded()) return;
    setSurveySubmitting(true);
    setSurveyError(null);
    try {
      await apiFetch(`/professionals/${professional.id}/review-survey`, {
        method: "POST",
        body: JSON.stringify(surveyForm),
      });
      setSurveySuccess(true);
      // Reload reviews
      const res = await apiFetch<{
        reviews: SurveyReview[];
        summary: SurveySummary;
      }>(`/professionals/${professional.id}/review-surveys`);
      setSurveyReviews(res.reviews || []);
      setSurveySummary(res.summary || null);
      setTimeout(() => {
        setShowSurveyModal(false);
        setSurveySuccess(false);
      }, 1500);
    } catch (err: any) {
      setSurveyError(
        err?.body?.message || "No se pudo enviar la calificacion.",
      );
    } finally {
      setSurveySubmitting(false);
    }
  }

  if (loading) {
    return (
      <div className="grid gap-6">
        <SkeletonCard className="h-80 rounded-3xl" />
        <SkeletonCard className="h-64 rounded-3xl" />
      </div>
    );
  }
  if (notFound || !professional) {
    return (
      <div className="card p-8 text-center">
        <h1 className="text-xl font-semibold">Perfil no disponible</h1>
        <p className="mt-2 text-sm text-white/60">
          Este perfil no está público o no existe.
        </p>
      </div>
    );
  }

  const availabilityState = availableNow
    ? {
        label: "Disponible ahora",
        className:
          "border-emerald-300/50 bg-emerald-500/20 text-emerald-100 shadow-[0_0_24px_rgba(16,185,129,0.2)]",
        dot: "bg-emerald-400",
      }
    : professional.availabilityNote
      ? {
          label: "Disponible hoy",
          className: "border-amber-300/40 bg-amber-500/20 text-amber-100",
          dot: "bg-amber-400",
        }
      : {
          label: "No disponible",
          className: "border-white/20 bg-white/10 text-white/70",
          dot: "bg-white/40",
        };

  const priceLabel = hasRatesSection
    ? `$${professional.baseRate?.toLocaleString("es-CL")}`
    : "Tarifa a consultar";
  const durationLabel = professional.minDurationMinutes
    ? `${professional.minDurationMinutes} min`
    : "Sin duración mínima";

  // Las fotos de los perfiles verificados por admin llevan una banda azul
  // cruzada abajo: se ve de una y dice qué es sin que nadie tenga que tocar
  // un escudo diminuto.
  const isVerifiedProfile = hasVerifiedBadge(professional?.profileTags);

  /* "Responde al instante" sólo si el dato existe y es bueno: prometer
     rapidez sin respaldo es lo que hace que el cliente escriba y se queme. */
  const fastResponse =
    professional.avgResponseMinutes != null && professional.avgResponseMinutes <= 30
      ? professional.avgResponseMinutes <= 5
        ? "Responde al instante"
        : `Responde en ${professional.avgResponseMinutes} min`
      : null;

  /* Línea bajo el nombre: el nivel es lo que la distingue de un aviso
     cualquiera, y si no tiene, la categoría dice al menos qué ofrece. */
  const levelLabel = professional.userLevel
    ? `Escort ${professional.userLevel}`
    : professional.category || "Escort";
  const levelBadge = professional.userLevel
    ? LEVEL_BADGES[professional.userLevel.toUpperCase()] ?? null
    : null;
  const levelPill = levelBadge ? (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[12px] font-semibold uppercase tracking-wide ${levelBadge.className}`}
    >
      <levelBadge.Icon className="h-3.5 w-3.5" />
      {levelBadge.label}
    </span>
  ) : (
    <span className="text-white/55">{levelLabel}</span>
  );

  /* Atributos en pastillas con icono: verificación, rapidez de respuesta,
     servicios y modalidad. "Disponible ahora" ya va sobre la foto. Se leen de un vistazo sin armar un párrafo. */
  const highlights: { key: string; Icon: LucideIcon; label: string; className: string }[] = [
    isVerifiedProfile && {
      key: "verified",
      Icon: ShieldCheck,
      label: "Verificada",
      className: "border-sky-400/35 bg-sky-500/15 text-sky-100",
    },
    fastResponse && {
      key: "fast",
      Icon: Zap,
      label: fastResponse,
      className: "border-amber-400/30 bg-amber-500/12 text-amber-100",
    },
    (professional.completedServices ?? 0) > 0 && {
      key: "done",
      Icon: BadgeCheck,
      label: `${professional.completedServices} servicios completados`,
      className: "border-fuchsia-400/30 bg-fuchsia-500/12 text-fuchsia-100",
    },
    professional.acceptsIncalls && {
      key: "in",
      Icon: House,
      label: "Recibe",
      className: "border-white/15 bg-white/[0.05] text-white/80",
    },
    professional.acceptsOutcalls && {
      key: "out",
      Icon: Car,
      label: "Se desplaza",
      className: "border-white/15 bg-white/[0.05] text-white/80",
    },
  ].filter(Boolean) as { key: string; Icon: LucideIcon; label: string; className: string }[];

  /* Ficha técnica en pares dato/valor. Antes esto eran dos filas de etiquetas
     de colores; en una página de verdad los datos van en una lista y las
     etiquetas se guardan para lo que de verdad es una categoría. */
  const specs = [
    { label: "Edad", value: professional.age ? `${professional.age} años` : null },
    { label: "Estatura", value: professional.heightCm ? `${professional.heightCm} cm` : null },
    { label: "Peso", value: professional.weightKg ? `${professional.weightKg} kg` : null },
    { label: "Medidas", value: professional.measurements || null },
    { label: "Cabello", value: professional.hairColor || null },
    { label: "Piel", value: professional.skinTone || null },
    { label: "Idiomas", value: splitCsv(professional.languages).join(", ") || null },
  ].filter((item) => Boolean(item.value)) as { label: string; value: string }[];

  const photoCount = gallery.filter((g) => g.type === "IMAGE").length;
  const videoCount = gallery.length - photoCount;
  const mainPhoto = gallery[0] ?? null;

  const aboutText = cleanProfileText(professional.description);


  /* Lo que ofrece, en una sola lista: las etiquetas que marcó más las
     subcategorías deducidas de ellas, sin repetir y en orden. Sin useMemo a
     propósito: este bloque corre después de los `return` tempranos de carga,
     así que un hook acá cambiaría la cantidad de hooks entre renders. */
  const serviceList = (() => {
    const seen = new Set<string>();
    const out: string[] = [];
    for (const raw of [...(professional.serviceTags ?? []), ...extraSubcategories]) {
      const label = String(raw).trim();
      const key = label.toLowerCase();
      if (!label || seen.has(key)) continue;
      seen.add(key);
      out.push(label);
    }
    return out.sort((a, b) => a.localeCompare(b, "es"));
  })();

  const serviceCount = serviceList.length;

  const ratingValue = surveySummary?.avgOverall ?? professional.rating ?? null;
  const ratingCount = surveySummary?.count ?? professional.reviewCount ?? 0;

  return (
    <div className="-mx-4 w-[calc(100%+2rem)] overflow-x-clip pb-40 md:pb-10">
      {/* Ficha.
          Sin tarjetas dentro de tarjetas: la foto es la única superficie y
          todo lo demás se ordena con tipografía y líneas de 1px. Los recuadros
          apilados y las filas de etiquetas de colores es lo primero que delata
          una página armada a la rápida. */}
      <div className="mx-auto w-full max-w-6xl min-w-0 md:px-8 md:pt-6">
        <div className="md:grid md:grid-cols-[320px_minmax(0,1fr)] md:gap-8 lg:grid-cols-[360px_minmax(0,1fr)]">

          {/* ── Foto ── */}
          <div className="relative w-full overflow-hidden md:sticky md:top-[88px] md:self-start md:rounded-lg">
            <button
              type="button"
              onClick={() => mainPhoto && setLightbox(mainPhoto)}
              className="relative block aspect-[4/5] w-full"
              aria-label="Ver foto en grande"
            >
              {coverSrc ? (
                <img
                  src={coverSrc}
                  alt={professional.name}
                  className="absolute inset-0 h-full w-full object-cover"
                  style={{
                    objectPosition: `${professional.coverPositionX ?? 50}% ${professional.coverPositionY ?? 50}%`,
                  }}
                />
              ) : (
                <div className="grid h-full w-full place-items-center bg-white/[0.04]">
                  <ImageIcon className="h-10 w-10 text-white/25" />
                </div>
              )}

              {/* Copia visual del nombre para el teléfono. El título real es el
                  <h1> de la columna de al lado, que en móvil no se ve pero
                  sigue en el documento. */}
              <div aria-hidden="true" className="absolute inset-0 bg-gradient-to-t from-black/85 via-transparent to-transparent md:hidden" />
              <div aria-hidden="true" className="absolute inset-x-0 bottom-0 px-4 pb-9 md:hidden">
                <p className="text-[26px] font-semibold leading-none tracking-tight">
                  {professional.name}
                  {professional.age ? (
                    <span className="ml-1.5 text-lg font-normal text-white/60">
                      {professional.age}
                    </span>
                  ) : null}
                </p>
                <p className="mt-2 flex text-[13px]">{levelPill}</p>
              </div>

              {isVerifiedProfile && <VerifiedBand size="md" corner text="Verificada" />}
            </button>

            {availableNow && (
              <span className="pointer-events-none absolute left-3 top-3 flex items-center gap-1.5 rounded-full bg-black/60 px-2.5 py-1 text-[11px] font-medium text-emerald-200 backdrop-blur-md">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                Disponible ahora
              </span>
            )}

            {/* z-[5]: la cinta de verificación ocupa toda la foto con z-[3];
                sin esto, guardar y compartir quedaban debajo de esa capa. */}
            <div className="absolute right-3 top-3 z-[5] flex items-center gap-1.5">
              <button
                type="button"
                onClick={toggleFavorite}
                aria-label={favorite ? "Quitar de favoritos" : "Guardar en favoritos"}
                className="flex h-9 w-9 items-center justify-center rounded-full bg-black/55 text-white/80 backdrop-blur-md transition hover:bg-black/75"
              >
                <Heart className={`h-4 w-4 ${favorite ? "fill-rose-400 text-rose-400" : ""}`} />
              </button>
              <button
                type="button"
                onClick={() => handleShare("profile_detail_hero")}
                aria-label="Compartir perfil"
                className="flex h-9 w-9 items-center justify-center rounded-full bg-black/55 text-white/80 backdrop-blur-md transition hover:bg-black/75"
              >
                <Share2 className="h-4 w-4" />
              </button>
            </div>
          </div>

          {/* ── Quién es ── */}
          <div className="min-w-0 px-4 pt-5 md:px-0 md:pt-0">
            <div className="sr-only md:not-sr-only md:block">
              <h1 className="text-4xl font-semibold leading-none tracking-tight">
                {professional.name}
                {professional.age ? (
                  <span className="ml-2 text-2xl font-normal text-white/45">
                    {professional.age}
                  </span>
                ) : null}
              </h1>
              <p className="mt-3 flex flex-wrap items-center gap-2 text-sm text-white/55">
                {levelPill}
                {professional.city && (
                  <span className="inline-flex items-center gap-1 text-white/70">
                    <MapPin className="h-3.5 w-3.5 text-fuchsia-400/80" />
                    {professional.city}
                  </span>
                )}
                {professional.nearestMetro && (
                  /* La referencia con la que se ubica media Santiago. Va junto
                     al nombre porque es de las primeras cosas que se buscan. */
                  <span className="inline-flex items-center gap-1.5 rounded-full border border-white/12 px-2 py-0.5 text-[12px] text-white/70">
                    <TrainFront className="h-3.5 w-3.5 text-sky-300/80" />
                    Metro {professional.nearestMetro.name}
                  </span>
                )}
              </p>
            </div>

            {/* Ficha técnica: cada dato en su recuadro con icono, para que la
                vista encuentre edad o estatura sin leer la lista entera. */}
            {specs.length > 0 && (
              <dl className="mt-5 grid grid-cols-2 gap-2 sm:grid-cols-3">
                {specs.map(({ label, value }) => {
                  const spec = SPEC_ICONS[label] ?? {
                    Icon: Sparkles,
                    tint: "bg-white/10 text-white/70",
                  };
                  return (
                    <div
                      key={label}
                      className="flex min-w-0 items-center gap-2.5 rounded-xl border border-white/[0.07] bg-white/[0.03] px-3 py-2.5"
                    >
                      <span
                        className={`grid h-8 w-8 shrink-0 place-items-center rounded-lg ${spec.tint}`}
                      >
                        <spec.Icon className="h-4 w-4" />
                      </span>
                      <div className="min-w-0">
                        <dt className="text-[11px] uppercase tracking-wide text-white/40">
                          {label}
                        </dt>
                        <dd className="truncate text-[14px] font-semibold text-white/90">
                          {value}
                        </dd>
                      </div>
                    </div>
                  );
                })}
              </dl>
            )}

            {highlights.length > 0 && (
              <ul className="mt-4 flex flex-wrap gap-2">
                {highlights.map(({ key, Icon, label, className }) => (
                  <li
                    key={key}
                    className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-[12.5px] font-medium ${className}`}
                  >
                    <Icon className="h-3.5 w-3.5" />
                    {label}
                  </li>
                ))}
              </ul>
            )}

            {/* Sobre mí */}
            {aboutText && (
              <div className="mt-6">
                <p
                  ref={aboutRef}
                  className={`whitespace-pre-line text-[15px] leading-[1.7] text-white/75 ${
                    aboutOpen ? "" : "line-clamp-4"
                  }`}
                >
                  {aboutText}
                </p>
                {/* El botón sale sólo si de verdad quedó texto sin mostrar: una
                    biografía de dos líneas con un "Leer más" que no hace nada
                    es de las cosas que hacen desconfiar de una página. */}
                {aboutOverflows && (
                  <button
                    type="button"
                    onClick={() => setAboutOpen((v) => !v)}
                    className="mt-1.5 text-[13px] font-medium text-white/45 underline underline-offset-4 transition hover:text-white/75"
                  >
                    {aboutOpen ? "Leer menos" : "Leer más"}
                  </button>
                )}
              </div>
            )}

            {/* Contacto y precio en un recuadro con degradado: es lo que el
                cliente busca para decidir, así que es lo que más resalta. */}
            <div className="mt-6 rounded-2xl border border-fuchsia-400/20 bg-gradient-to-br from-fuchsia-500/[0.12] via-violet-500/[0.06] to-transparent p-4 md:p-5">
              <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
                <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-emerald-500/15 text-emerald-300">
                  <Banknote className="h-5 w-5" />
                </span>
                <span className="text-2xl font-semibold tracking-tight">{priceLabel}</span>
                <span className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-black/20 px-2.5 py-1 text-[12.5px] text-white/60">
                  <Clock className="h-3.5 w-3.5" />
                  {durationLabel}
                </span>
              </div>

              <div className="mt-4 hidden flex-wrap gap-2.5 md:flex">
                <button
                  onClick={() => handleChatClick("message")}
                  className="inline-flex items-center gap-2 rounded-lg bg-gradient-to-r from-fuchsia-600 to-violet-600 px-6 py-3 text-sm font-semibold text-white shadow-[0_6px_20px_rgba(192,38,211,0.35)] transition hover:from-fuchsia-500 hover:to-violet-500"
                >
                  <MessageSquare className="h-4 w-4" />
                  Enviar mensaje
                </button>
                {professional.phone && (
                  <>
                    <a
                      href={formatWhatsAppUrl(professional.phone)}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={() =>
                        trackAction("whatsapp_click", professional.id, {
                          source: "profile_detail_hero",
                          displayName: professional.name,
                        })
                      }
                      /* El glifo de WhatsApp alcanza para reconocerlo: pintar
                         el botón entero de verde lo sacaba de la fila y hacía
                         que compitiera con el de mensaje. */
                      className="inline-flex items-center gap-2 rounded-lg border border-white/15 px-6 py-3 text-sm font-semibold text-white/85 transition hover:border-white/35 hover:bg-white/[0.04]"
                    >
                      <WhatsAppIcon className="h-4 w-4" />
                      WhatsApp
                    </a>
                    <a
                      href={`tel:${professional.phone.replace(/[^\d+]/g, "")}`}
                      onClick={() =>
                        trackAction("phone_click", professional.id, {
                          source: "profile_detail_hero",
                          displayName: professional.name,
                        })
                      }
                      className="inline-flex items-center gap-2 rounded-lg border border-white/15 px-6 py-3 text-sm font-semibold text-white/85 transition hover:border-white/35 hover:bg-white/[0.04]"
                    >
                      <Phone className="h-4 w-4" />
                      {professional.phone}
                    </a>
                  </>
                )}
                {hasStore && (
                  <Link
                    href={`/marketplace/tienda/${professional.username ?? ""}`}
                    className="inline-flex items-center gap-2 rounded-lg border border-white/15 px-6 py-3 text-sm font-semibold text-white/85 transition hover:border-white/35 hover:bg-white/[0.04]"
                  >
                    <ShoppingBag className="h-4 w-4" />
                    Su tienda
                  </Link>
                )}
              </div>

              {/* Dónde, cuándo y opiniones. Cada fila con su icono: la etiqueta
                  sola a la izquierda dejaba tres renglones de texto plano y no
                  se distinguía un dato de otro al pasar la vista. */}
              <dl className="mt-5 space-y-2.5 text-[14px]">
                <div className="flex gap-3">
                  <dt className="flex w-24 shrink-0 items-center gap-2 text-white/40">
                    <MapPin className="h-4 w-4 text-fuchsia-400/70" />
                    Dónde
                  </dt>
                  <dd className="text-white/80">
                    {professional.city || "Zona referencial"}
                    {professional.nearestMetro && (
                      <span className="text-white/45">
                        {" · "}Metro {professional.nearestMetro.name}
                      </span>
                    )}
                  </dd>
                </div>
                <div className="flex gap-3">
                  <dt className="flex w-24 shrink-0 items-center gap-2 text-white/40">
                    <CalendarClock className="h-4 w-4 text-amber-400/70" />
                    Cuándo
                  </dt>
                  <dd className="text-white/80">
                    {professional.availabilityNote ||
                      (availableNow ? "Disponible ahora" : "A coordinar")}
                  </dd>
                </div>
                {ratingCount > 0 && ratingValue != null && (
                  <div className="flex gap-3">
                    <dt className="flex w-24 shrink-0 items-center gap-2 text-white/40">
                      <Star className="h-4 w-4 fill-amber-300/80 text-amber-300/80" />
                      Opiniones
                    </dt>
                    <dd className="text-white/80">
                      {ratingValue.toFixed(1)} de 5
                      <span className="text-white/45"> · {ratingCount} calificaciones</span>
                    </dd>
                  </div>
                )}
              </dl>
            </div>
          </div>
        </div>

        {/* Fotos */}
        {gallery.length > 0 && (
          <section id="fotos" className="mt-10 px-4 md:px-0">
            <div className="flex items-baseline justify-between gap-3 border-b border-white/[0.08] pb-2.5">
              <SectionTitle Icon={Camera} tint="bg-sky-500/15 text-sky-300">
                Fotos
              </SectionTitle>
              <p className="text-[13px] text-white/40">
                {photoCount} foto{photoCount === 1 ? "" : "s"}
                {videoCount > 0
                  ? ` · ${videoCount} video${videoCount === 1 ? "" : "s"}`
                  : ""}

              </p>
            </div>
            <div className="mt-4 grid grid-cols-3 gap-1.5 sm:grid-cols-4 lg:grid-cols-5">
              {gallery.map((item, idx) => {
                const isLatestVideo =
                  item.type === "VIDEO" && item.url === latestStoryVideoUrl;
                return (
                  <button
                    type="button"
                    key={`${item.url}-${idx}`}
                    onClick={() => {
                      goToGallery(idx);
                      setLightbox(item);
                    }}
                    className="group relative aspect-[3/4] overflow-hidden rounded-md bg-white/[0.04] transition hover:opacity-90"
                  >
                    {item.type === "VIDEO" ? (
                      <>
                        <video
                          ref={(el) => {
                            if (el) thumbVideoRefs.current.set(item.url, el);
                            else thumbVideoRefs.current.delete(item.url);
                          }}
                          src={isLatestVideo ? item.url : `${item.url}#t=0.1`}
                          muted
                          loop={isLatestVideo}
                          autoPlay={isLatestVideo}
                          playsInline
                          preload="metadata"
                          className="absolute inset-0 h-full w-full object-cover"
                        />
                        <span className="pointer-events-none absolute right-1.5 top-1.5 rounded-full bg-black/60 p-1 ring-1 ring-white/25">
                          <Play className="h-2.5 w-2.5 fill-white text-white" />
                        </span>
                      </>
                    ) : (
                      <img
                        src={item.url}
                        alt={`${professional.name} ${idx + 1}`}
                        loading="lazy"
                        decoding="async"
                        className="absolute inset-0 h-full w-full object-cover transition duration-300 group-hover:scale-[1.04]"
                      />
                    )}
                  </button>
                );
              })}
            </div>
          </section>
        )}
      </div>

      {/* Todo lo que sigue va en la misma columna, separado por líneas y no por
          tarjetas: apilar recuadros con degradado es lo que hace que una página
          se lea como una plantilla. */}
      <div className="mx-auto mt-10 w-full max-w-6xl min-w-0 px-4 md:px-8">
        <div className="min-w-0 divide-y divide-white/[0.08]">
          {/* Servicios: una lista de verdad, en columnas y con un visto por
              ítem. En texto corrido separado por comas se leía como un párrafo
              cualquiera y no como lo que la profesional ofrece — que es
              justamente lo que el cliente viene a revisar. Sin volver a las
              veinte pastillas de colores, que era el otro extremo. */}
          {(serviceList.length > 0 || styleChips.length > 0) && (
            <section id="servicios" className="min-w-0 scroll-mt-24 py-8 first:pt-0">
              <SectionTitle Icon={ListChecks} tint="bg-emerald-500/15 text-emerald-300">
                Servicios
              </SectionTitle>

              {serviceList.length > 0 && (
                <>
                  <ul className="mt-4 flex flex-wrap gap-2">
                    {(showAllServices
                      ? serviceList
                      : serviceList.slice(0, VISIBLE_SERVICES)
                    ).map((item) => (
                      <li
                        key={item}
                        className="inline-flex items-center gap-2 rounded-full border border-emerald-400/20 bg-emerald-500/[0.08] py-1.5 pl-1.5 pr-3.5 text-[14px] text-white/90"
                      >
                        <span className="grid h-5 w-5 shrink-0 place-items-center rounded-full bg-emerald-500/25">
                          <Check className="h-3 w-3 text-emerald-300" strokeWidth={3} />
                        </span>
                        <span className="first-letter:uppercase">{item}</span>
                      </li>
                    ))}
                  </ul>
                  {serviceList.length > VISIBLE_SERVICES && (
                    <button
                      type="button"
                      onClick={() => setShowAllServices((v) => !v)}
                      className="mt-3 text-[13px] font-medium text-white/45 underline underline-offset-4 transition hover:text-white/75"
                    >
                      {showAllServices
                        ? "Ver menos"
                        : `Ver los ${serviceList.length - VISIBLE_SERVICES} restantes`}
                    </button>
                  )}
                </>
              )}

              {styleChips.length > 0 && (
                <div className="mt-5">
                  <h3 className="text-[13px] font-medium text-white/40">Estilo</h3>
                  <ul className="mt-2 flex flex-wrap gap-2">
                    {styleChips.map((item) => (
                      <li
                        key={item}
                        className="inline-flex items-center gap-1.5 rounded-full border border-white/12 bg-white/[0.04] px-3 py-1.5 text-[13.5px] text-white/75"
                      >
                        <Sparkles className="h-3 w-3 text-fuchsia-300/80" />
                        <span className="first-letter:uppercase">{item}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </section>
          )}

          {/* Lo que repiten los clientes: el dato es cuántas veces se dijo,
              no la pastilla verde alrededor. */}
          {reviewTags.length > 0 && (
            <section className="min-w-0 py-8">
              <SectionTitle Icon={Sparkles} tint="bg-violet-500/15 text-violet-300">
                Lo que repiten los clientes
              </SectionTitle>
              <ul className="mt-4 flex flex-wrap gap-2">
                {reviewTags.map(({ tag, count }) => (
                  <li
                    key={tag}
                    className="inline-flex items-center gap-2 rounded-full border border-violet-400/25 bg-violet-500/10 py-1 pl-3 pr-1 text-[13.5px] text-white/85"
                  >
                    <span className="first-letter:uppercase">{tag}</span>
                    <span className="grid min-w-[22px] place-items-center rounded-full bg-violet-500/30 px-1.5 text-[11px] font-semibold text-violet-100">
                      {count}
                    </span>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {/* Reviews / Comments */}
          {reviews.length > 0 && (
            <section className="min-w-0 py-8">
              <div className="flex items-baseline justify-between gap-3">
                <SectionTitle Icon={MessageSquare} tint="bg-rose-500/15 text-rose-300">
                  Reseñas ({professional.reviewCount || reviews.length})
                </SectionTitle>
                {professional.rating != null && (
                  <span className="text-[13px] text-white/45">
                    {professional.rating.toFixed(1)} de 5
                  </span>
                )}
              </div>

              <div className="mt-4 divide-y divide-white/[0.06]">
                {displayedReviews.map((review) => (
                  <div key={review.id} className="py-4 first:pt-0">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-white/[0.08] text-xs font-semibold text-white/70">
                          {review.author?.displayName?.[0]?.toUpperCase() ||
                            review.author?.username?.[0]?.toUpperCase() ||
                            "?"}
                        </div>
                        <div>
                          <p className="text-sm font-medium text-white/80">
                            {review.author?.displayName ||
                              review.author?.username ||
                              "Anónimo"}
                          </p>
                          <p className="text-[11px] text-white/40">
                            {timeAgo(review.createdAt)}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-0.5">
                        {Array.from({ length: 5 }).map((_, i) => (
                          <Heart
                            key={i}
                            className={`h-3.5 w-3.5 ${
                              i < review.rating
                                ? "fill-rose-500 text-rose-500"
                                : "text-white/15"
                            }`}
                          />
                        ))}
                      </div>
                    </div>
                    {review.comment && (
                      <p className="mt-2.5 text-sm leading-relaxed text-white/65">
                        {review.comment}
                      </p>
                    )}
                  </div>
                ))}
              </div>

              {reviews.length > 3 && (
                <button
                  type="button"
                  onClick={() => setShowAllReviews((p) => !p)}
                  className="mt-4 text-[13px] font-medium text-white/45 underline underline-offset-4 transition hover:text-white/75"
                >
                  {showAllReviews
                    ? "Ver menos"
                    : `Ver todas las reseñas (${reviews.length})`}
                </button>
              )}
            </section>
          )}

          {/* Survey Rating Summary + Button */}
          <section className="min-w-0 py-8">
            <div className="flex items-center justify-between gap-3">
              <SectionTitle Icon={Star} tint="bg-amber-500/15 text-amber-300">
                Calificaciones
                {surveySummary && surveySummary.count > 0 && (
                  <span className="ml-1 text-[13px] font-normal text-white/40">
                    ({surveySummary.count})
                  </span>
                )}
              </SectionTitle>
              <button
                type="button"
                onClick={() => {
                  if (redirectToLoginIfNeeded()) return;
                  setShowSurveyModal(true);
                }}
                className="rounded-lg border border-white/15 px-3.5 py-2 text-[13px] font-medium text-white/75 transition hover:border-white/35 hover:bg-white/[0.04]"
              >
                Calificar
              </button>
            </div>

            {surveySummary && surveySummary.count > 0 ? (
              <div className="mt-4 space-y-3">
                {/* Rating bars */}
                <div className="space-y-2">
                  {[
                    { label: "Cuerpo", value: surveySummary.avgBody, Icon: User },
                    { label: "Rostro", value: surveySummary.avgFace, Icon: Smile },
                    {
                      label: "Parecida a fotos",
                      value: surveySummary.avgPhotos,
                      Icon: Camera,
                    },
                    { label: "Servicio", value: surveySummary.avgService, Icon: Sparkles },
                    {
                      label: "Trato y ambiente",
                      value: surveySummary.avgVibe,
                      Icon: HeartHandshake,
                    },
                  ].map((item) => (
                    <div key={item.label} className="flex items-center gap-3">
                      <span className="flex w-32 shrink-0 items-center gap-2 text-xs text-white/50">
                        <item.Icon className="h-3.5 w-3.5 text-fuchsia-300/70" />
                        {item.label}
                      </span>
                      <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-white/10">
                        <div
                          className="h-full rounded-full bg-gradient-to-r from-fuchsia-500 to-amber-300"
                          style={{ width: `${item.value * 10}%` }}
                        />
                      </div>
                      <span className="w-8 text-right text-xs font-semibold text-white/80">
                        {item.value}
                      </span>
                    </div>
                  ))}
                </div>
                <div className="flex items-center justify-center gap-2 pt-2 border-t border-white/[0.06]">
                  <Star className="h-5 w-5 fill-amber-300 text-amber-300" />
                  <span className="text-2xl font-bold text-amber-300">
                    {surveySummary.avgOverall}
                  </span>
                  <span className="text-xs text-white/40">
                    / 10 promedio general
                  </span>
                  <span className="text-xs text-white/55">
                    • {surveySummary.count} reseñas
                  </span>
                </div>

                {/* Survey text reviews */}
                {surveyReviews.filter((r) => r.comment).length > 0 && (
                  <div className="divide-y divide-white/[0.06] pt-3">
                    {surveyReviews
                      .filter((r) => r.comment)
                      .slice(0, showAllReviews ? 50 : 3)
                      .map((review) => (
                        <div key={review.id} className="py-3">
                          <div className="flex items-center justify-between mb-1.5">
                            <div className="flex items-center gap-2">
                              <div className="flex h-6 w-6 items-center justify-center rounded-full bg-white/[0.08] text-[10px] font-semibold text-white/70">
                                {review.author?.displayName?.[0]?.toUpperCase() ||
                                  review.author?.username?.[0]?.toUpperCase() ||
                                  "?"}
                              </div>
                              <span className="text-xs font-medium text-white/70">
                                {review.author?.displayName ||
                                  review.author?.username ||
                                  "Anonimo"}
                              </span>
                            </div>
                            <span className="flex items-center gap-1 text-xs text-amber-300 font-semibold">
                              <Star className="h-3 w-3 fill-amber-300" />
                              {review.overallScore.toFixed(1)}
                            </span>
                          </div>
                          <p className="text-sm text-white/60">
                            {review.comment}
                          </p>
                        </div>
                      ))}
                  </div>
                )}
              </div>
            ) : (
              <p className="text-sm text-white/40 text-center py-4">
                Aun no hay calificaciones. Se el primero en calificar.
              </p>
            )}
          </section>

          {/* Comentarios del foro: siempre visible si hay hilo, para que haya
              por dónde empezar a opinar aunque todavía no haya comentarios. */}
          {professional.forumThread && (
            <section className="min-w-0 py-8">
              <div className="flex items-baseline justify-between gap-3">
                <SectionTitle Icon={MessageSquare} tint="bg-fuchsia-500/15 text-fuchsia-300">
                  Opiniones en el foro
                </SectionTitle>
                {forumComments.length > 0 && (
                  <Link
                    href={professional.forumThread.url}
                    className="text-[13px] font-medium text-white/45 underline underline-offset-4 transition hover:text-white/75"
                  >
                    Ver todas
                  </Link>
                )}
              </div>

              {forumComments.length > 0 ? (
                <div className="mt-3 divide-y divide-white/[0.06]">
                  {forumComments.map((comment) => (
                    <article key={comment.id} className="py-3.5">
                      <div className="mb-1.5 flex items-center justify-between gap-3">
                        <p className="text-xs font-medium text-white/75">
                          {comment.author?.displayName || comment.author?.username || "Usuario"}
                        </p>
                        <p className="text-[11px] text-white/45">{timeAgo(comment.createdAt)}</p>
                      </div>
                      <p className="line-clamp-3 text-sm leading-relaxed text-white/68">
                        {comment.content}
                      </p>
                    </article>
                  ))}
                </div>
              ) : (
                <p className="mt-2 text-sm text-white/45">
                  Aún nadie ha opinado. ¿La conoces? Cuéntale a la comunidad.
                </p>
              )}

              <Link
                href={professional.forumThread.url}
                className="mt-4 inline-flex items-center gap-2 rounded-xl border border-white/15 px-4 py-2.5 text-sm font-medium text-white/85 transition hover:bg-white/[0.06]"
              >
                Dejar mi opinión
              </Link>
            </section>
          )}

        </div>
      </div>

      {/* Lightbox */}
      <AnimatePresence>
        {lightbox && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 grid place-items-center bg-black/95 p-4 backdrop-blur-md"
            onClick={() => setLightbox(null)}
          >
            <div className="relative h-[90vh] w-[90vw]">
              <button
                type="button"
                className="absolute right-3 top-3 z-20 flex rounded-2xl border border-white/20 bg-black/50 p-3 text-white/90"
                onClick={() => setLightbox(null)}
              >
                <X className="h-4 w-4" />
              </button>
              {lightbox.type === "VIDEO" ? (
                <video
                  key={lightbox.url}
                  src={lightbox.url}
                  controls
                  autoPlay
                  playsInline
                  className="h-full w-full rounded-3xl border border-white/10 bg-black object-contain"
                  onClick={(e) => e.stopPropagation()}
                />
              ) : (
                <div className="relative h-full w-full overflow-hidden rounded-3xl">
                  <img
                    src={lightbox.url}
                    alt="Vista ampliada"
                    className="h-full w-full rounded-3xl border border-white/10 object-contain"
                  />
                  {isVerifiedProfile && <VerifiedBand size="lg" corner text="Verificada" />}
                </div>
              )}
              {gallery.length > 1 && (
                <>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      const prev =
                        (lightboxIndex - 1 + gallery.length) % gallery.length;
                      setLightbox(gallery[prev]);
                      goToGallery(prev);
                    }}
                    className="absolute left-4 top-1/2 -translate-y-1/2 rounded-2xl border border-white/20 bg-black/55 p-4 text-white/90 backdrop-blur-md"
                  >
                    <ChevronLeft className="h-6 w-6" />
                  </button>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      const next = (lightboxIndex + 1) % gallery.length;
                      setLightbox(gallery[next]);
                      goToGallery(next);
                    }}
                    className="absolute right-4 top-1/2 -translate-y-1/2 rounded-2xl border border-white/20 bg-black/55 p-4 text-white/90 backdrop-blur-md"
                  >
                    <ChevronRight className="h-6 w-6" />
                  </button>
                </>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Mobile bottom bar */}
      {portalReady && createPortal(
      <div className="fixed inset-x-0 bottom-0 z-40 border-t border-white/[0.08] bg-[#0c0614]/95 px-4 pb-[calc(0.5rem+env(safe-area-inset-bottom))] pt-2.5 backdrop-blur-2xl md:hidden">
        {/* Guardar y compartir viven sobre la foto: acá abajo repetidos
            quedaban debajo de la cinta de verificación y encima competían con
            los botones que sí cierran el contacto. */}
        <div className="mb-2 flex items-baseline gap-2">
          <span className="text-sm font-semibold text-white">{priceLabel}</span>
          <span className="text-xs font-normal text-white/40">{durationLabel}</span>
        </div>
        {/* Main CTA */}
        <button
          onClick={() => handleChatClick("message")}
          className="btn-primary mb-2 w-full rounded-2xl py-3 text-sm font-bold shadow-[0_8px_24px_rgba(168,85,247,0.3)]"
        >
          Enviar mensaje
        </button>
        {/* Secondary actions */}
        <div className="flex gap-2">
          {hasStore && (
            <Link
              href={`/marketplace/tienda/${professional.username ?? ""}`}
              className="flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-gradient-to-r from-fuchsia-600/90 to-violet-600/90 py-2 text-xs font-bold text-white"
            >
              <ShoppingBag className="h-3.5 w-3.5" />
              Tienda
            </Link>
          )}
          {professional.phone && (
            <>
              <a
                href={`tel:${professional.phone.replace(/[^\d+]/g, "")}`}
                onClick={() => trackAction("phone_click", professional.id, { source: "profile_detail_sticky", displayName: professional.name })}
                className="flex flex-1 items-center justify-center gap-1.5 rounded-xl border border-white/12 bg-white/[0.06] py-2 text-xs font-semibold text-white/75 transition hover:bg-white/[0.1]"
              >
                <Phone className="h-3.5 w-3.5" />
                Llamar
              </a>
              <a
                href={formatWhatsAppUrl(professional.phone)}
                target="_blank"
                rel="noopener noreferrer"
                onClick={() => trackAction("whatsapp_click", professional.id, { source: "profile_detail_sticky", displayName: professional.name })}
                className="flex flex-1 items-center justify-center gap-1.5 rounded-xl border border-white/12 bg-white/[0.06] py-2 text-xs font-semibold text-white/75 transition hover:bg-white/[0.1]"
              >
                <WhatsAppIcon className="h-3.5 w-3.5" />
                WhatsApp
              </a>
            </>
          )}
        </div>
      </div>,
      document.body,
      )}

      {/* Survey Rating Modal */}
      <AnimatePresence>
        {showSurveyModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 grid place-items-center bg-black/85 p-4 backdrop-blur-md"
            onClick={() => setShowSurveyModal(false)}
          >
            <motion.div
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 20, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-md max-h-[calc(100dvh-2rem)] overflow-y-auto overscroll-contain rounded-3xl border border-white/10 bg-gradient-to-b from-white/10 to-[#1a0e28]/95 p-6 shadow-2xl"
            >
              {surveySuccess ? (
                <div className="text-center py-6">
                  <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-emerald-500/20">
                    <Star className="h-7 w-7 text-emerald-400" />
                  </div>
                  <h3 className="text-lg font-semibold text-white">
                    Calificacion enviada
                  </h3>
                  <p className="mt-1 text-sm text-white/60">
                    Gracias por tu opinion.
                  </p>
                </div>
              ) : (
                <>
                  <div className="flex items-center justify-between mb-5">
                    <h3 className="text-lg font-semibold text-white">
                      Calificar a {professional.name}
                    </h3>
                    <button
                      onClick={() => setShowSurveyModal(false)}
                      className="text-white/40 hover:text-white/70"
                    >
                      <X className="h-5 w-5" />
                    </button>
                  </div>

                  <div className="space-y-4">
                    {[
                      {
                        key: "ratingBody",
                        label: "Cuerpo",
                        desc: "Como calificarias su fisico",
                      },
                      {
                        key: "ratingFace",
                        label: "Rostro",
                        desc: "Atractivo facial",
                      },
                      {
                        key: "ratingPhotos",
                        label: "Parecida a las fotos",
                        desc: "Que tan fiel a sus fotos era en persona",
                      },
                      {
                        key: "ratingService",
                        label: "Calidad del servicio",
                        desc: "Nivel de satisfaccion con el servicio",
                      },
                      {
                        key: "ratingVibe",
                        label: "Trato y ambiente",
                        desc: "Amabilidad, higiene y comodidad",
                      },
                    ].map((item) => (
                      <div key={item.key}>
                        <div className="flex items-center justify-between mb-1.5">
                          <div>
                            <span className="text-sm font-medium text-white/90">
                              {item.label}
                            </span>
                            <p className="text-[11px] text-white/40">
                              {item.desc}
                            </p>
                          </div>
                          <span className="text-lg font-bold text-amber-300 w-8 text-right">
                            {(surveyForm as any)[item.key]}
                          </span>
                        </div>
                        <input
                          type="range"
                          min={1}
                          max={10}
                          value={(surveyForm as any)[item.key]}
                          onChange={(e) =>
                            setSurveyForm((prev) => ({
                              ...prev,
                              [item.key]: Number(e.target.value),
                            }))
                          }
                          className="w-full h-2 rounded-full appearance-none bg-white/10 accent-fuchsia-500 cursor-pointer [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-fuchsia-400 [&::-webkit-slider-thumb]:appearance-none"
                        />
                        <div className="flex justify-between text-[10px] text-white/25 mt-0.5">
                          <span>1</span>
                          <span>5</span>
                          <span>10</span>
                        </div>
                      </div>
                    ))}

                    <div>
                      <label className="text-sm font-medium text-white/90 block mb-1.5">
                        Comentario (opcional)
                      </label>
                      <textarea
                        rows={3}
                        maxLength={500}
                        placeholder="Cuenta tu experiencia..."
                        value={surveyForm.comment}
                        onChange={(e) =>
                          setSurveyForm((prev) => ({
                            ...prev,
                            comment: e.target.value,
                          }))
                        }
                        className="w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2.5 text-sm outline-none resize-none focus:border-fuchsia-500/30 transition placeholder:text-white/25"
                      />
                    </div>

                    {surveyError && (
                      <p className="text-xs text-red-300 bg-red-500/10 rounded-lg px-3 py-2 border border-red-500/20">
                        {surveyError}
                      </p>
                    )}

                    <button
                      type="button"
                      disabled={surveySubmitting}
                      onClick={submitSurvey}
                      className="w-full rounded-xl bg-gradient-to-r from-fuchsia-600 to-violet-600 py-3 text-sm font-bold text-white shadow-lg transition hover:from-fuchsia-500 hover:to-violet-500 disabled:opacity-50"
                    >
                      {surveySubmitting ? "Enviando..." : "Enviar calificacion"}
                    </button>
                  </div>
                </>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Share feedback toast */}
      <AnimatePresence>
        {shareFeedback && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            className="fixed bottom-28 left-1/2 z-[60] -translate-x-1/2 md:bottom-8"
            role="status"
            aria-live="polite"
          >
            <div className="flex items-center gap-2 rounded-full border border-violet-400/30 bg-[#1a0d2b]/95 px-4 py-2.5 text-sm font-medium text-violet-100 shadow-[0_8px_24px_rgba(168,85,247,0.35)] backdrop-blur-xl">
              <Check className="h-4 w-4 text-emerald-300" />
              {shareFeedback}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
