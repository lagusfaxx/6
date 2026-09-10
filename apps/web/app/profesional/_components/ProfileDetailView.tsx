"use client";

import { useEffect, useMemo, useRef, useState } from "react";
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
  MapPin,
  Star,
  X,
  Heart,
  Shield,
  ChevronLeft,
  ChevronRight,
  MessageSquare,
  Award,
  Sparkles,
  ShoppingBag,
  Zap,
  Gem,
  Phone,
  Play,
  Share2,
  Check,
  BadgeCheck,
  Camera,
  Stethoscope,
  Banknote,
  CalendarClock,
} from "lucide-react";
import { filterUserTags, hasPremiumBadge, hasVerifiedBadge } from "../../../lib/systemBadges";
import VerifiedBand from "../../../components/VerifiedBand";
import StatusBadgeIcon from "../../../components/StatusBadgeIcon";

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

/** La insignia de exámenes viene con y sin tilde según cuándo se guardó. */
function hasExamsBadge(tags: string[] | null | undefined): boolean {
  return (tags || []).some((t) => {
    const n = t.toLowerCase().trim();
    return n === "profesional con examenes" || n === "profesional con exámenes";
  });
}

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
  const [lightbox, setLightbox] = useState<GalleryItem | null>(null);
  const [galleryIndex, setGalleryIndex] = useState(0);
  const thumbVideoRefs = useRef(new Map<string, HTMLVideoElement>());
  /* La presentación recorta la biografía: en el escritorio va en una columna
     angosta y sin recortar empujaba la ficha entera hacia abajo. */
  const [aboutOpen, setAboutOpen] = useState(false);
  const [showAllReviews, setShowAllReviews] = useState(false);
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

  const availabilityChips = useMemo(() => {
    if (!professional) return [] as string[];
    const chips: string[] = [];
    if (professional.acceptsIncalls) chips.push("Recibe");
    if (professional.acceptsOutcalls) chips.push("Se desplaza");
    return chips;
  }, [professional]);

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
  const hasExams = hasExamsBadge(professional?.profileTags);

  /* Línea bajo el nombre: el nivel es lo que la distingue de un aviso
     cualquiera, y si no tiene, la categoría dice al menos qué ofrece. */
  const levelLabel = professional.userLevel
    ? `Escort ${professional.userLevel}`
    : professional.category || "Escort";

  /* Dos filas de datos: arriba lo que se compara de un vistazo (edad, medidas)
     y abajo lo descriptivo, que se lee sólo si la primera fila convenció. */
  const primaryChips = [
    professional.age ? `${professional.age} años` : null,
    professional.heightCm ? `${professional.heightCm} cm` : null,
    professional.weightKg ? `${professional.weightKg} kg` : null,
    professional.measurements || null,
  ].filter(Boolean) as string[];

  const secondaryChips = [
    professional.hairColor ? `Cabello ${professional.hairColor}` : null,
    professional.skinTone ? `Piel ${professional.skinTone}` : null,
    ...splitCsv(professional.languages),
    ...filterUserTags(professional.profileTags).slice(0, 6),
  ].filter(Boolean) as string[];

  const photoCount = gallery.filter((g) => g.type === "IMAGE").length;
  const videoCount = gallery.length - photoCount;
  const mainPhoto = gallery[0] ?? null;

  const aboutText = cleanProfileText(professional.description);

  /* "Responde al instante" sólo si el dato existe y es bueno: prometer
     rapidez sin respaldo es lo que hace que el cliente escriba y se queme. */
  const fastResponse =
    professional.avgResponseMinutes != null && professional.avgResponseMinutes <= 30
      ? professional.avgResponseMinutes <= 5
        ? "Responde al instante"
        : `Responde en ${professional.avgResponseMinutes} min`
      : null;

  const serviceCount =
    (professional.serviceTags?.length ?? 0) + extraSubcategories.length;

  const ratingValue = surveySummary?.avgOverall ?? professional.rating ?? null;
  const ratingCount = surveySummary?.count ?? professional.reviewCount ?? 0;

  return (
    <div className="-mx-4 w-[calc(100%+2rem)] overflow-x-hidden pb-40 md:pb-10">
      {/* ══════════ Ficha ══════════
          La presentación entra completa en una pantalla: foto, quién es, los
          datos duros y por qué creerle. Debajo van las fotos y las opiniones,
          que es lo que se mira después de decidir que interesa. */}
      <div className="mx-auto w-full max-w-6xl min-w-0 md:px-8 md:pt-5">
        <section className="overflow-hidden border-b border-white/[0.07] bg-[#0e0f1e]/70 md:rounded-3xl md:border">
          <div className="md:grid md:grid-cols-[280px_minmax(0,1fr)] md:gap-6 md:p-6 lg:grid-cols-[320px_minmax(0,1fr)_290px]">

            {/* ── Foto principal ── */}
            {/* self-stretch + h-full: la foto acompaña el alto de la ficha en
                el escritorio. Con una relación de aspecto fija quedaba un
                hueco muerto debajo cuando la columna de datos era más alta. */}
            <div className="relative w-full overflow-hidden md:self-stretch md:rounded-2xl md:border md:border-white/[0.08]">
              <button
                type="button"
                onClick={() => mainPhoto && setLightbox(mainPhoto)}
                className="relative block aspect-[4/5] w-full md:aspect-auto md:h-full md:min-h-[440px]"
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
                  <div className="grid h-full w-full place-items-center bg-gradient-to-br from-fuchsia-700/35 via-violet-700/30 to-slate-900">
                    <ImageIcon className="h-10 w-10 text-white/50" />
                  </div>
                )}

                {/* Nombre sobre la foto: sólo en el teléfono, donde no hay
                    columna al lado que lo sostenga. */}
                <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/20 to-black/25 md:hidden" />
                {/* Copia visual del nombre para el teléfono. El título real es
                    el <h1> de la columna de al lado, que en móvil queda oculto
                    a la vista pero sigue en el documento. */}
                <div aria-hidden="true" className="absolute inset-x-0 bottom-0 px-4 pb-9 text-center md:hidden">
                  <p className="text-3xl font-extrabold uppercase leading-none tracking-tight drop-shadow-[0_2px_10px_rgba(0,0,0,0.6)]">
                    {professional.name}
                    {professional.age ? (
                      <span className="ml-1.5 text-xl font-semibold text-white/70">
                        {professional.age}
                      </span>
                    ) : null}
                  </p>
                  <p className="mt-1 text-[11px] font-bold uppercase tracking-[0.32em] text-amber-300/90">
                    {levelLabel}
                  </p>
                </div>

                {isVerifiedProfile && <VerifiedBand size="md" />}

                {gallery.length > 1 && (
                  <span className="absolute bottom-10 right-2.5 z-[4] hidden items-center gap-1 rounded-full border border-white/20 bg-black/55 px-2.5 py-1 text-[11px] font-medium text-white/85 backdrop-blur-md md:inline-flex">
                    <Camera className="h-3 w-3" />
                    {gallery.length}
                  </span>
                )}
              </button>

              {/* Nivel + estado, arriba a la izquierda */}
              <div className="pointer-events-none absolute left-2.5 top-2.5 z-[4] flex flex-col items-start gap-1.5">
                <span
                  className={`flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-semibold backdrop-blur-md ${availabilityState.className}`}
                >
                  <span className={`h-1.5 w-1.5 rounded-full ${availabilityState.dot}`} />
                  {availabilityState.label}
                </span>
                {professional.userLevel && (
                  <span className="inline-flex items-center gap-1 rounded-full border border-amber-300/35 bg-amber-500/20 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-amber-100 backdrop-blur-md">
                    <Gem className="h-3 w-3" />
                    {professional.userLevel}
                  </span>
                )}
              </div>

              {/* Guardar / compartir */}
              <div className="absolute right-2.5 top-2.5 z-[4] flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={toggleFavorite}
                  aria-label={favorite ? "Quitar de favoritos" : "Guardar en favoritos"}
                  className={`flex h-9 w-9 items-center justify-center rounded-full border backdrop-blur-md transition ${
                    favorite
                      ? "border-rose-400/50 bg-rose-500/25 text-rose-100"
                      : "border-white/20 bg-black/45 text-white/75 hover:bg-black/65"
                  }`}
                >
                  <Heart className={`h-4 w-4 ${favorite ? "fill-rose-400" : ""}`} />
                </button>
                <button
                  type="button"
                  onClick={() => handleShare("profile_detail_hero")}
                  aria-label="Compartir perfil"
                  className="flex h-9 w-9 items-center justify-center rounded-full border border-white/20 bg-black/45 text-white/75 backdrop-blur-md transition hover:bg-black/65"
                >
                  <Share2 className="h-4 w-4" />
                </button>
              </div>
            </div>

            {/* ── Quién es ── */}
            <div className="min-w-0 px-4 pt-4 md:p-0">
              <div className="sr-only md:not-sr-only md:block">
                <h1 className="flex flex-wrap items-center gap-2.5 text-3xl font-extrabold uppercase leading-none tracking-tight lg:text-4xl">
                  {professional.name}
                  {professional.age ? (
                    <span className="text-2xl font-semibold text-white/50">
                      {professional.age}
                    </span>
                  ) : null}
                  {hasPremiumBadge(professional?.profileTags) && (
                    <StatusBadgeIcon type="premium" size="h-5 w-5" />
                  )}
                </h1>
                <p className="mt-1.5 text-[11px] font-bold uppercase tracking-[0.34em] text-amber-300/90">
                  {levelLabel}
                </p>
              </div>

              {/* Señales rápidas: responder rápido y tener servicios hechos es
                  lo que separa un perfil activo de uno abandonado. */}
              {(fastResponse || (professional.completedServices ?? 0) > 0 ||
                professional.umateActive) && (
                <div className="mt-3 flex flex-wrap items-center gap-2 md:mt-4">
                  {fastResponse && (
                    <span className="inline-flex items-center gap-1.5 rounded-full border border-violet-300/25 bg-violet-500/12 px-2.5 py-1 text-[11px] font-semibold text-violet-100">
                      <Zap className="h-3 w-3 text-violet-300" />
                      {fastResponse}
                    </span>
                  )}
                  {(professional.completedServices ?? 0) > 0 && (
                    <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-300/25 bg-emerald-500/12 px-2.5 py-1 text-[11px] font-semibold text-emerald-100">
                      <Shield className="h-3 w-3 text-emerald-300" />
                      {professional.completedServices} servicios
                    </span>
                  )}
                  {professional.umateActive && (
                    <Link
                      href={`/umate/profile/${professional.id}`}
                      className="inline-flex items-center gap-1.5 rounded-full border border-fuchsia-400/30 bg-gradient-to-r from-fuchsia-600/30 to-violet-600/30 px-2.5 py-1 text-[11px] font-bold text-fuchsia-100 transition hover:from-fuchsia-600/50 hover:to-violet-600/50"
                      title="Contenido exclusivo en UMate"
                    >
                      <Sparkles className="h-3 w-3" />
                      UMate
                    </Link>
                  )}
                </div>
              )}

              {/* Datos físicos: lo primero que se mira, así que van sólidos */}
              {primaryChips.length > 0 && (
                <div className="mt-3 flex flex-wrap gap-1.5 md:mt-4">
                  {primaryChips.map((chip) => (
                    <span
                      key={chip}
                      className="rounded-lg border border-white/10 bg-white/[0.09] px-3 py-1.5 text-[13px] font-semibold text-white/90"
                    >
                      {chip}
                    </span>
                  ))}
                </div>
              )}

              {secondaryChips.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {secondaryChips.map((chip) => (
                    <span
                      key={chip}
                      className="rounded-lg border border-white/[0.09] bg-white/[0.03] px-2.5 py-1.5 text-[12px] capitalize text-white/60"
                    >
                      {chip}
                    </span>
                  ))}
                </div>
              )}

              {/* Confianza: por qué creerle a este perfil */}
              <div className="mt-4 space-y-2.5 rounded-2xl border border-white/[0.07] bg-white/[0.025] p-3.5">
                <div className="flex gap-2.5">
                  <BadgeCheck
                    className={`mt-0.5 h-4 w-4 shrink-0 ${isVerifiedProfile ? "text-emerald-400" : "text-white/30"}`}
                  />
                  <p className="text-[13px] leading-snug text-white/65">
                    <span className="font-semibold text-white/90">Verificación de perfil: </span>
                    {isVerifiedProfile
                      ? `${professional.name} pasó la verificación del equipo y las fotos publicadas corresponden a este perfil.`
                      : "Este perfil todavía no está verificado por el equipo."}
                  </p>
                </div>
                <div className="flex gap-2.5">
                  <Camera className="mt-0.5 h-4 w-4 shrink-0 text-sky-400/80" />
                  <p className="text-[13px] leading-snug text-white/65">
                    <span className="font-semibold text-white/90">Fotos y videos: </span>
                    {photoCount} foto{photoCount === 1 ? "" : "s"}
                    {videoCount > 0
                      ? ` y ${videoCount} video${videoCount === 1 ? "" : "s"}`
                      : ""}{" "}
                    en el perfil.
                  </p>
                </div>
                <div className="flex gap-2.5">
                  <Stethoscope
                    className={`mt-0.5 h-4 w-4 shrink-0 ${hasExams ? "text-emerald-400" : "text-white/30"}`}
                  />
                  <p className="text-[13px] leading-snug text-white/65">
                    <span className="font-semibold text-white/90">Exámenes médicos: </span>
                    {hasExams
                      ? "al día, comprobados por el equipo."
                      : "sin comprobante vigente en el perfil."}
                  </p>
                </div>
              </div>

              {/* Acciones en escritorio (en el teléfono van en la barra fija) */}
              <div className="mt-4 hidden flex-wrap gap-2 md:flex">
                <button
                  onClick={() => handleChatClick("message")}
                  className="btn-primary flex-1 whitespace-nowrap rounded-xl px-5 py-3 text-sm font-bold shadow-[0_8px_24px_rgba(168,85,247,0.28)] transition hover:brightness-110"
                >
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
                      className="flex items-center justify-center gap-2 whitespace-nowrap rounded-xl border border-emerald-400/30 bg-emerald-500/15 px-5 py-3 text-sm font-bold text-emerald-200 transition hover:bg-emerald-500/25"
                    >
                      <Phone className="h-4 w-4" />
                      WhatsApp
                    </a>
                    <a
                      href={`tel:${professional.phone.replace(/[^\d+]/g, "")}`}
                      className="flex items-center justify-center gap-2 whitespace-nowrap rounded-xl border border-white/12 bg-white/[0.05] px-5 py-3 text-sm font-semibold text-white/75 transition hover:bg-white/[0.09]"
                    >
                      Llamar
                    </a>
                  </>
                )}
                {hasStore && (
                  <Link
                    href={`/marketplace/tienda/${professional.username ?? ""}`}
                    className="flex items-center justify-center gap-2 rounded-xl border border-fuchsia-400/25 bg-fuchsia-500/12 px-5 py-3 text-sm font-semibold text-fuchsia-100 transition hover:bg-fuchsia-500/20"
                  >
                    <ShoppingBag className="h-4 w-4" />
                    Tienda
                  </Link>
                )}
              </div>
            </div>

            {/* ── Sobre mí ── */}
            {aboutText && (
              <div className="px-4 pb-4 pt-4 md:col-span-2 md:mt-2 md:border-t md:border-white/[0.06] md:px-0 md:pb-0 md:pt-5 lg:col-span-1 lg:mt-0 lg:border-0 lg:pl-6 lg:pt-0">
                <h2 className="text-base font-bold text-white/90">Sobre mí</h2>
                <div className="relative mt-2">
                  <p
                    className={`whitespace-pre-line text-[14px] leading-[1.65] text-white/70 ${
                      aboutOpen ? "" : "line-clamp-[8]"
                    }`}
                  >
                    {aboutText}
                  </p>
                  {!aboutOpen && (
                    <div
                      aria-hidden="true"
                      className="pointer-events-none absolute inset-x-0 bottom-0 h-12 bg-gradient-to-t from-[#0e0f1e] to-transparent"
                    />
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => setAboutOpen((v) => !v)}
                  className="mt-2 rounded-lg border border-white/12 bg-white/[0.05] px-3.5 py-1.5 text-xs font-semibold text-white/70 transition hover:bg-white/[0.1]"
                >
                  {aboutOpen ? "Leer menos" : "Leer más"}
                </button>
              </div>
            )}
          </div>
        </section>

        {/* ══════════ Datos duros ══════════
            Teléfono, tarifa, dónde y cuándo: lo que decide el contacto. Una
            celda por dato, con separadores de 1px en vez de tarjetas sueltas. */}
        <section className="mt-3 grid gap-px overflow-hidden border-y border-white/[0.07] bg-white/[0.07] sm:grid-cols-2 md:mt-4 md:grid-cols-3 md:rounded-2xl md:border">
          {professional.phone && (
            <a
              href={`tel:${professional.phone.replace(/[^\d+]/g, "")}`}
              onClick={() =>
                trackAction("phone_click", professional.id, {
                  source: "profile_detail_facts",
                  displayName: professional.name,
                })
              }
              className="flex items-start gap-3 bg-[#0e0f1e] p-4 transition hover:bg-[#14152a]"
            >
              <Phone className="mt-0.5 h-5 w-5 shrink-0 text-fuchsia-400" />
              <div className="min-w-0">
                <p className="truncate text-[17px] font-bold tracking-tight">
                  {professional.phone}
                </p>
                <p className="text-[12px] text-white/45">Toca para llamar</p>
              </div>
            </a>
          )}

          <div className="flex items-start gap-3 bg-[#0e0f1e] p-4">
            <Banknote className="mt-0.5 h-5 w-5 shrink-0 text-emerald-400" />
            <div className="min-w-0">
              <p className="text-[17px] font-bold tracking-tight">{priceLabel}</p>
              <p className="text-[12px] text-white/45">{durationLabel}</p>
            </div>
          </div>

          <div className="flex items-start gap-3 bg-[#0e0f1e] p-4">
            <MapPin className="mt-0.5 h-5 w-5 shrink-0 text-rose-400" />
            <div className="min-w-0">
              <p className="truncate text-[15px] font-bold tracking-tight">
                {professional.city || "Zona referencial"}
              </p>
              <p className="text-[12px] text-white/45">
                {availabilityChips.length > 0
                  ? availabilityChips.join(" · ")
                  : "Consulta el lugar de encuentro"}
              </p>
            </div>
          </div>

          <div className="flex items-start gap-3 bg-[#0e0f1e] p-4">
            <CalendarClock className="mt-0.5 h-5 w-5 shrink-0 text-amber-400" />
            <div className="min-w-0">
              <p className="text-[15px] font-bold tracking-tight">
                {availabilityState.label}
              </p>
              <p className="text-[12px] text-white/45">
                {professional.availabilityNote || "Escríbele para coordinar"}
              </p>
            </div>
          </div>

          <a
            href="#servicios"
            className="flex items-start gap-3 bg-[#0e0f1e] p-4 transition hover:bg-[#14152a]"
          >
            <Sparkles className="mt-0.5 h-5 w-5 shrink-0 text-violet-400" />
            <div className="min-w-0">
              <p className="text-[15px] font-bold tracking-tight">
                {serviceCount > 0 ? `${serviceCount} servicios` : "Servicios"}
              </p>
              <p className="text-[12px] text-white/45">Ver el detalle</p>
            </div>
          </a>

          <div className="flex items-start gap-3 bg-[#0e0f1e] p-4">
            <Star className="mt-0.5 h-5 w-5 shrink-0 text-amber-300" />
            <div className="min-w-0">
              <p className="text-[15px] font-bold tracking-tight">
                {ratingValue != null ? ratingValue.toFixed(1) : "Sin calificar"}
              </p>
              <p className="text-[12px] text-white/45">
                {ratingCount > 0
                  ? `${ratingCount} opinión${ratingCount === 1 ? "" : "es"}`
                  : "Aún no tiene opiniones"}
              </p>
            </div>
          </div>
        </section>

        {/* ══════════ Fotos ══════════ */}
        {gallery.length > 0 && (
          <section id="fotos" className="mt-5 px-4 md:px-0">
            <div className="flex items-end justify-between gap-3">
              <h2 className="rounded-xl bg-gradient-to-r from-fuchsia-600 to-violet-600 px-4 py-2 text-sm font-bold text-white shadow-[0_6px_20px_rgba(168,85,247,0.28)]">
                Fotos
              </h2>
              <p className="text-right text-[12px] text-white/40">
                {photoCount} foto{photoCount === 1 ? "" : "s"}
                {videoCount > 0
                  ? ` · ${videoCount} video${videoCount === 1 ? "" : "s"}`
                  : ""}
                {professional.lastSeen && (
                  <span className="block text-white/30">
                    Última conexión: {timeAgo(professional.lastSeen)}
                  </span>
                )}
              </p>
            </div>
            <div className="mt-3 grid grid-cols-3 gap-2 sm:grid-cols-4 lg:grid-cols-5">
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
                    className="group relative aspect-[3/4] overflow-hidden rounded-xl border border-white/[0.08] bg-white/[0.03] transition hover:border-fuchsia-400/40"
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

      <div className="mx-auto mt-4 grid w-full max-w-6xl min-w-0 gap-4 px-4 md:gap-5 md:px-8">
        <div className="min-w-0 space-y-4">
          {/* Servicios + Estilo */}
          {((professional?.serviceTags?.length ?? 0) > 0 ||
            matchedSubcategories.length > 0 ||
            hasStyleSection) && (
            <section
              id="servicios"
              className="min-w-0 scroll-mt-24 rounded-2xl border border-white/[0.08] bg-gradient-to-b from-white/[0.05] to-transparent p-5 md:p-6"
            >
              {((professional?.serviceTags?.length ?? 0) > 0 ||
                matchedSubcategories.length > 0) && (
                <>
                  <h2 className="mb-4 flex items-center gap-2 text-base font-semibold text-white">
                    <Sparkles className="h-4 w-4 text-violet-300" />
                    Servicios que ofrece
                  </h2>
                  <div className="flex flex-wrap gap-2">
                    {(professional?.serviceTags ?? []).map((tag) => (
                      <span
                        key={tag}
                        className="inline-flex items-center rounded-full border border-violet-300/30 bg-gradient-to-b from-violet-500/40 to-violet-600/30 px-3 py-1.5 text-xs font-semibold capitalize text-violet-50 shadow-[0_1px_4px_rgba(139,92,246,0.25)]"
                      >
                        {tag}
                      </span>
                    ))}
                    {extraSubcategories.map((sub) => (
                      <span
                        key={sub}
                        className="inline-flex items-center rounded-full border border-violet-300/30 bg-gradient-to-b from-violet-500/40 to-violet-600/30 px-3 py-1.5 text-xs font-semibold text-violet-50 shadow-[0_1px_4px_rgba(139,92,246,0.25)]"
                      >
                        {sub}
                      </span>
                    ))}
                  </div>
                </>
              )}

              {hasStyleSection && (
                <div
                  className={
                    (professional?.serviceTags?.length ?? 0) > 0 ||
                    matchedSubcategories.length > 0
                      ? "mt-5 border-t border-white/[0.06] pt-4"
                      : ""
                  }
                >
                  <h3 className="mb-3 text-[11px] font-bold uppercase tracking-[0.18em] text-fuchsia-300/70">
                    Estilo
                  </h3>
                  <div className="flex flex-wrap gap-1.5">
                    {styleChips.map((chip) => (
                      <span
                        key={chip}
                        className="inline-flex rounded-full border border-fuchsia-300/20 bg-fuchsia-500/10 px-2.5 py-1 text-[11px] font-medium text-fuchsia-100"
                      >
                        {chip}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </section>
          )}

          {/* Review tags summary */}
          {reviewTags.length > 0 && (
            <section className="min-w-0 rounded-2xl border border-white/[0.08] bg-gradient-to-b from-white/[0.06] to-transparent p-4 md:p-5">
              <h2 className="mb-3 flex items-center gap-2 text-base font-semibold text-white/95">
                <Award className="h-4 w-4 text-amber-400" />
                Lo que dicen los clientes
              </h2>
              <div className="flex flex-wrap gap-2">
                {reviewTags.map(({ tag, count }) => (
                  <span
                    key={tag}
                    className="inline-flex items-center gap-1.5 rounded-full border border-emerald-300/20 bg-emerald-500/10 px-3 py-1.5 text-xs font-medium text-emerald-100"
                  >
                    {tag}
                    <span className="rounded-full bg-emerald-500/20 px-1.5 text-[10px] text-emerald-300">
                      {count}
                    </span>
                  </span>
                ))}
              </div>
            </section>
          )}

          {/* Reviews / Comments */}
          {reviews.length > 0 && (
            <section className="min-w-0 rounded-2xl border border-white/[0.08] bg-gradient-to-b from-white/[0.06] to-transparent p-4 md:p-5">
              <div className="mb-4 flex items-center justify-between">
                <h2 className="flex items-center gap-2 text-base font-semibold text-white/95">
                  <MessageSquare className="h-4 w-4 text-fuchsia-400" />
                  Reseñas ({professional.reviewCount || reviews.length})
                </h2>
                <div className="flex items-center gap-1 text-sm text-amber-300">
                  <Star className="h-4 w-4 fill-amber-300" />
                  <span className="font-semibold">
                    {professional.rating?.toFixed(1)}
                  </span>
                </div>
              </div>

              <div className="space-y-3">
                {displayedReviews.map((review) => (
                  <div
                    key={review.id}
                    className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-4"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-violet-500/20 to-fuchsia-500/20 text-xs font-semibold text-white/70">
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
                  className="mt-3 w-full rounded-xl border border-white/10 bg-white/5 py-2.5 text-xs font-medium text-white/60 transition hover:bg-white/10"
                >
                  {showAllReviews
                    ? "Ver menos"
                    : `Ver todas las reseñas (${reviews.length})`}
                </button>
              )}
            </section>
          )}

          {/* Survey Rating Summary + Button */}
          <section className="min-w-0 rounded-2xl border border-white/[0.08] bg-gradient-to-b from-white/[0.06] to-transparent p-4 md:p-5">
            <div className="flex items-center justify-between mb-4">
              <h2 className="flex items-center gap-2 text-base font-semibold text-white/95">
                <Star className="h-4 w-4 text-amber-400" />
                Calificaciones detalladas
                {surveySummary && surveySummary.count > 0 && (
                  <span className="text-sm font-normal text-white/40">
                    ({surveySummary.count})
                  </span>
                )}
              </h2>
              <button
                type="button"
                onClick={() => {
                  if (redirectToLoginIfNeeded()) return;
                  setShowSurveyModal(true);
                }}
                className="flex items-center gap-1.5 rounded-xl border border-fuchsia-400/30 bg-fuchsia-500/15 px-3 py-2 text-xs font-medium text-fuchsia-200 transition hover:bg-fuchsia-500/25"
              >
                <Star className="h-3.5 w-3.5" />
                Calificar
              </button>
            </div>

            {surveySummary && surveySummary.count > 0 ? (
              <div className="space-y-3">
                {/* Rating bars */}
                <div className="space-y-2">
                  {[
                    { label: "Cuerpo", value: surveySummary.avgBody },
                    { label: "Rostro", value: surveySummary.avgFace },
                    {
                      label: "Parecida a fotos",
                      value: surveySummary.avgPhotos,
                    },
                    { label: "Servicio", value: surveySummary.avgService },
                    { label: "Trato y ambiente", value: surveySummary.avgVibe },
                  ].map((item) => (
                    <div key={item.label} className="flex items-center gap-3">
                      <span className="w-28 text-xs text-white/50 shrink-0">
                        {item.label}
                      </span>
                      <div className="flex-1 h-3 rounded-full bg-white/10 overflow-hidden">
                        <div
                          className="h-full rounded-full bg-gradient-to-r from-fuchsia-500 to-amber-400"
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
                  <div className="space-y-2 pt-3 border-t border-white/[0.06]">
                    {surveyReviews
                      .filter((r) => r.comment)
                      .slice(0, showAllReviews ? 50 : 3)
                      .map((review) => (
                        <div
                          key={review.id}
                          className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-3"
                        >
                          <div className="flex items-center justify-between mb-1.5">
                            <div className="flex items-center gap-2">
                              <div className="flex h-6 w-6 items-center justify-center rounded-full bg-gradient-to-br from-violet-500/20 to-fuchsia-500/20 text-[10px] font-semibold text-white/70">
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

          {/* Comentarios del foro */}
          {professional.forumThread && forumComments.length > 0 && (
            <section className="min-w-0 rounded-3xl border border-fuchsia-400/20 bg-gradient-to-b from-fuchsia-500/10 via-violet-500/5 to-transparent p-4 md:p-5">
              <div className="mb-4 flex items-center justify-between gap-3">
                <h2 className="flex items-center gap-2 text-base font-semibold text-white/95">
                  <MessageSquare className="h-4 w-4 text-fuchsia-300" />
                  Comentarios recientes del foro
                </h2>
                <Link
                  href={professional.forumThread.url}
                  className="inline-flex items-center gap-1.5 rounded-xl border border-fuchsia-400/30 bg-fuchsia-500/15 px-3 py-2 text-xs font-medium text-fuchsia-200 transition hover:bg-fuchsia-500/25"
                >
                  Ver hilo completo
                </Link>
              </div>

              <div className="overflow-hidden rounded-2xl border border-white/10 bg-white/[0.03]">
                {forumComments.map((comment) => (
                  <article
                    key={comment.id}
                    className="px-4 py-3 md:px-4.5"
                  >
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
            </section>
          )}

          {/* La descripción del servicio venía en la barra lateral, que ya no
              existe: ahora va con el resto del contenido. */}
          {cleanProfileText(professional.serviceSummary) && (
            <section className="min-w-0 rounded-2xl border border-white/[0.08] bg-gradient-to-b from-white/[0.05] to-transparent p-5 md:p-6">
              <h2 className="mb-2 text-base font-semibold text-white">
                Descripción del servicio
              </h2>
              <p className="whitespace-pre-line text-[15px] leading-[1.7] text-white/70">
                {cleanProfileText(professional.serviceSummary)}
              </p>
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
                  {isVerifiedProfile && <VerifiedBand size="lg" />}
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
      <div className="fixed inset-x-0 bottom-0 z-40 border-t border-white/[0.08] bg-[#0c0614]/95 px-4 pb-[calc(0.5rem+env(safe-area-inset-bottom))] pt-2.5 backdrop-blur-2xl md:hidden">
        {/* Price row */}
        <div className="mb-2 flex items-center justify-between">
          <div className="text-sm font-semibold text-white">
            {priceLabel}
            <span className="ml-1.5 text-xs font-normal text-white/40">{durationLabel}</span>
          </div>
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => handleShare("profile_detail_sticky")}
              aria-label="Compartir perfil"
              className="flex h-8 w-8 items-center justify-center rounded-full border border-white/10 bg-white/[0.04] text-white/60 transition hover:bg-violet-500/15 hover:text-violet-200"
            >
              <Share2 className="h-4 w-4" />
            </button>
            <button
              onClick={toggleFavorite}
              aria-label={favorite ? "Quitar de favoritos" : "Guardar favorito"}
              className="flex h-8 w-8 items-center justify-center rounded-full border border-white/10 bg-white/[0.04] transition hover:bg-white/[0.08]"
            >
              <Heart
                className={`h-4 w-4 ${favorite ? "fill-red-500 text-red-500" : "text-white/50"}`}
              />
            </button>
          </div>
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
                className="flex flex-1 items-center justify-center gap-1.5 rounded-xl border border-emerald-500/25 bg-emerald-500/15 py-2 text-xs font-bold text-emerald-200 transition hover:bg-emerald-500/25"
              >
                <MessageSquare className="h-3.5 w-3.5" />
                WhatsApp
              </a>
            </>
          )}
        </div>
      </div>

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
