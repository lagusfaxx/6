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
import StarRating from "../../../components/StarRating";
import SkeletonCard from "../../../components/SkeletonCard";
import Link from "next/link";
import {
  ImageIcon,
  MapPin,
  Star,
  X,
  Heart,
  Shield,
  ShieldCheck,
  Crown,
  Clock,
  Eye,
  ChevronLeft,
  ChevronRight,
  MessageSquare,
  Award,
  Sparkles,
  Video,
  Zap,
  Gem,
  Phone,
  Ruler,
  Weight,
  Scissors,
  Palette,
  Languages,
  Play,
} from "lucide-react";
import { filterUserTags, hasPremiumBadge, hasVerifiedBadge } from "../../../lib/systemBadges";
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
  const [pendingVideoSeek, setPendingVideoSeek] = useState<{
    url: string;
    time: number;
  } | null>(null);
  const thumbVideoRefs = useRef(new Map<string, HTMLVideoElement>());
  const mainVideoRef = useRef<HTMLVideoElement | null>(null);
  const [galleryDirection, setGalleryDirection] = useState(1);
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
  const [hasVideocall, setHasVideocall] = useState(false);
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

  // Check if professional has videocall enabled
  useEffect(() => {
    if (!professional?.id) {
      setHasVideocall(false);
      return;
    }
    apiFetch(`/videocall/config/${professional.id}`)
      .then(() => setHasVideocall(true))
      .catch(() => setHasVideocall(false));
  }, [professional?.id]);

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

  const infoItems = useMemo(() => {
    if (!professional)
      return [] as {
        label: string;
        value: string;
        Icon: typeof Ruler;
        accent: string;
      }[];

    const baseItems: {
      label: string;
      value: string | null | undefined;
      Icon: typeof Ruler;
      accent: string;
    }[] = [
      {
        label: "Estatura",
        value: professional.heightCm ? `${professional.heightCm} cm` : null,
        Icon: Ruler,
        accent: "from-fuchsia-500/30 to-fuchsia-500/0 text-fuchsia-200",
      },
      {
        label: "Peso",
        value: professional.weightKg ? `${professional.weightKg} kg` : null,
        Icon: Weight,
        accent: "from-violet-500/30 to-violet-500/0 text-violet-200",
      },
      {
        label: "Medidas",
        value: professional.measurements || null,
        Icon: Sparkles,
        accent: "from-pink-500/30 to-pink-500/0 text-pink-200",
      },
      {
        label: "Cabello",
        value: professional.hairColor || null,
        Icon: Scissors,
        accent: "from-amber-500/30 to-amber-500/0 text-amber-200",
      },
      {
        label: "Piel",
        value: professional.skinTone || null,
        Icon: Palette,
        accent: "from-rose-500/30 to-rose-500/0 text-rose-200",
      },
    ];

    const languageItems = splitCsv(professional.languages).map(
      (language, index) => ({
        label: index === 0 ? "Idiomas" : "Idioma",
        value: language,
        Icon: Languages,
        accent: "from-sky-500/30 to-sky-500/0 text-sky-200",
      }),
    );

    return [...baseItems, ...languageItems]
      .filter((item) => Boolean(item.value))
      .map((item) => ({
        label: item.label,
        value: String(item.value),
        Icon: item.Icon,
        accent: item.accent,
      }));
  }, [professional]);

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
    const items: GalleryItem[] = [];
    const seen = new Set<string>();
    const push = (
      raw: string | null | undefined,
      rawType: string | null | undefined,
    ) => {
      if (!raw) return;
      const resolved = resolveMediaUrl(raw) ?? raw;
      if (!resolved || seen.has(resolved)) return;
      const type =
        String(rawType || "").toUpperCase() === "VIDEO" ? "VIDEO" : "IMAGE";
      seen.add(resolved);
      items.push({ url: resolved, type });
    };
    push(professional?.coverUrl, "IMAGE");
    push(professional?.avatarUrl, "IMAGE");
    for (const g of professional?.gallery ?? []) push(g.url, g.type);
    for (const s of professional?.stories ?? []) push(s.url, s.type);
    return items;
  }, [
    professional?.gallery,
    professional?.stories,
    professional?.coverUrl,
    professional?.avatarUrl,
  ]);
  const selectedGalleryItem = gallery[galleryIndex] ?? gallery[0] ?? null;
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

  useEffect(() => {
    if (!pendingVideoSeek) return;
    if (selectedGalleryItem?.url !== pendingVideoSeek.url) return;
    const video = mainVideoRef.current;
    if (!video) return;
    const apply = () => {
      try {
        video.currentTime = pendingVideoSeek.time;
        void video.play();
      } catch {}
      setPendingVideoSeek(null);
    };
    if (video.readyState >= 1) {
      apply();
    } else {
      const onMeta = () => apply();
      video.addEventListener("loadedmetadata", onMeta, { once: true });
      return () => video.removeEventListener("loadedmetadata", onMeta);
    }
  }, [pendingVideoSeek, selectedGalleryItem?.url]);

  function goToGallery(nextIndex: number) {
    if (!gallery.length) return;
    const normalized = (nextIndex + gallery.length) % gallery.length;
    setGalleryDirection(normalized > galleryIndex ? 1 : -1);
    setGalleryIndex(normalized);
  }

  const hasDetailsSection = infoItems.length > 0;
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

  return (
    <div className="-mx-4 w-[calc(100%+2rem)] overflow-x-hidden pb-40 md:pb-10">
      {/* Hero cover */}
      <section className="relative w-full overflow-hidden">
        <div className="relative aspect-[9/6] w-full overflow-hidden md:aspect-[16/7]">
          {coverSrc ? (
            <img
              src={coverSrc}
              alt="Portada"
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
          <div className="absolute inset-0 bg-gradient-to-t from-[#0c0614] via-[#0c0614]/30 to-black/30" />

          {/* Top floating badges */}
          <div className="absolute inset-x-0 top-0 flex items-start justify-between p-4 md:p-6">
            <div className="flex flex-col gap-1.5">
              <span
                className={`flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium backdrop-blur-xl ${availabilityState.className}`}
              >
                <span className="relative flex h-2 w-2">
                  {availableNow && (
                    <span
                      className="absolute inset-0 rounded-full bg-emerald-300/90 animate-ping opacity-80"
                      style={{ animationDuration: "1.4s" }}
                    />
                  )}
                  <span
                    className={`relative h-2 w-2 rounded-full ${availabilityState.dot} ${availableNow ? "shadow-[0_0_6px_2px_rgba(52,211,153,0.5)]" : ""}`}
                  />
                </span>
                {availabilityState.label}
              </span>
              {professional.avgResponseMinutes != null &&
                professional.avgResponseMinutes <= 30 && (
                  <span className="flex items-center gap-1.5 rounded-full border border-violet-300/30 bg-violet-500/15 px-3 py-1.5 text-xs font-medium text-violet-100 backdrop-blur-xl">
                    <Zap className="h-3 w-3 text-violet-300" />
                    {professional.avgResponseMinutes <= 5
                      ? "Responde al instante"
                      : `Responde en ${professional.avgResponseMinutes} min`}
                  </span>
                )}
            </div>
            <div className="flex items-center gap-1.5 rounded-full border border-white/20 bg-black/30 px-3 py-1.5 text-xs font-medium text-white backdrop-blur-xl">
              <Star className="h-3.5 w-3.5 fill-amber-300 text-amber-300" />
              <span>
                {(surveySummary?.avgOverall ?? professional.rating)?.toFixed(
                  1,
                ) ?? "–"}
              </span>
              {(surveySummary?.count ?? professional.reviewCount ?? 0) > 0 && (
                <>
                  <span className="text-white/30">•</span>
                  <span className="text-white/50">
                    {surveySummary?.count ?? professional.reviewCount} reseña
                    {(surveySummary?.count ?? professional.reviewCount ?? 0) !==
                    1
                      ? "s"
                      : ""}
                  </span>
                </>
              )}
            </div>
          </div>

          {/* Bottom info overlay */}
          <div className="absolute inset-x-0 bottom-0 px-4 pb-4 pt-16 md:px-8 md:pb-6 bg-gradient-to-t from-[#0c0614] via-[#0c0614]/80 to-transparent">
            <div className="space-y-2 md:space-y-2.5">
              <h1 className="flex items-center gap-2 text-2xl font-bold leading-tight tracking-tight sm:text-3xl md:text-4xl">
                {professional.name}
                {professional.age ? <span className="text-white/60 font-normal">, {professional.age}</span> : ""}
                {hasPremiumBadge(professional?.profileTags) && <StatusBadgeIcon type="premium" size="h-5 w-5" />}
                {hasVerifiedBadge(professional?.profileTags) && <StatusBadgeIcon type="verificada" size="h-5 w-5" />}
                {professional.umateActive && (
                  <Link href={`/umate/profile/${professional.id}`} className="inline-flex items-center gap-1 rounded-full bg-gradient-to-r from-fuchsia-600/30 to-violet-600/30 border border-fuchsia-400/30 px-2.5 py-0.5 text-xs font-bold text-fuchsia-200 hover:from-fuchsia-600/50 hover:to-violet-600/50 transition" title="Contenido exclusivo en UMate">
                    <Sparkles className="h-3 w-3" /> UMate
                  </Link>
                )}
              </h1>
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-white/70 md:text-base">
                <span className="flex items-center gap-1.5">
                  <MapPin className="h-3.5 w-3.5 text-fuchsia-400" />
                  {professional.city || "Ubicación no especificada"}
                </span>
                {professional.category && (
                  <>
                    <span className="text-white/20">·</span>
                    <span>{professional.category}</span>
                  </>
                )}
              </div>

              {/* Profile tags + stats in one row */}
              <div className="flex flex-wrap items-center gap-2 pt-1">
                {filterUserTags(professional?.profileTags).slice(0, 5).map((tag) => (
                  <span
                    key={tag}
                    className="inline-flex rounded-full border border-fuchsia-300/30 bg-fuchsia-500/10 px-2.5 py-1 text-[11px] font-medium text-fuchsia-100 capitalize backdrop-blur-sm"
                  >
                    {tag}
                  </span>
                ))}
                {professional.userLevel && (
                  <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-300/30 bg-amber-500/10 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide text-amber-100 backdrop-blur-sm">
                    <Gem className="h-3 w-3 text-amber-300" />
                    {professional.userLevel}
                  </span>
                )}
              </div>

              {/* Stats row */}
              <div className="flex items-center gap-4 text-xs text-white/45">
                {(professional.completedServices ?? 0) > 0 && (
                  <span className="flex items-center gap-1">
                    <Shield className="h-3.5 w-3.5 text-emerald-400" />
                    {professional.completedServices} servicios
                  </span>
                )}
                {(professional.profileViews ?? 0) > 0 && (
                  <span className="flex items-center gap-1">
                    <Eye className="h-3.5 w-3.5" />
                    {professional.profileViews} vistas
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>
      </section>

      <div className="mx-auto mt-3 grid w-full max-w-6xl min-w-0 gap-4 px-4 md:mt-4 md:grid-cols-[minmax(0,1fr)_360px] md:items-start md:gap-5 md:px-8">
        <div className="min-w-0 space-y-4">
          {/* Gallery */}
          <section className="min-w-0 overflow-hidden rounded-2xl border border-white/[0.08] bg-gradient-to-b from-white/[0.06] to-transparent">
            {selectedGalleryItem ? (
              <motion.button
                type="button"
                onClick={() => setLightbox(selectedGalleryItem)}
                className="relative block w-full overflow-hidden border-b border-white/10"
              >
                <div className="relative aspect-[4/5] w-full md:aspect-[16/9]">
                  <AnimatePresence mode="wait">
                    {selectedGalleryItem.type === "VIDEO" ? (
                      <motion.video
                        key={selectedGalleryItem.url}
                        ref={mainVideoRef}
                        src={selectedGalleryItem.url}
                        muted
                        loop
                        playsInline
                        autoPlay
                        preload="metadata"
                        className="absolute inset-0 h-full w-full object-cover"
                        initial={{
                          opacity: 0,
                          x: galleryDirection > 0 ? 40 : -40,
                        }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: galleryDirection > 0 ? -40 : 40 }}
                        transition={{ duration: 0.3, ease: "easeInOut" }}
                      />
                    ) : (
                      <motion.img
                        key={selectedGalleryItem.url}
                        src={selectedGalleryItem.url}
                        alt="Imagen destacada"
                        className="absolute inset-0 h-full w-full object-cover"
                        initial={{
                          opacity: 0,
                          x: galleryDirection > 0 ? 40 : -40,
                        }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: galleryDirection > 0 ? -40 : 40 }}
                        transition={{ duration: 0.3, ease: "easeInOut" }}
                      />
                    )}
                  </AnimatePresence>
                </div>
                <span className="absolute bottom-3 right-3 rounded-2xl border border-white/20 bg-black/50 px-2.5 py-1 text-xs text-white/90 backdrop-blur-md">
                  {galleryIndex + 1} / {gallery.length}
                </span>
                {gallery.length > 1 && (
                  <>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        goToGallery(galleryIndex - 1);
                      }}
                      className="absolute left-3 top-1/2 -translate-y-1/2 rounded-2xl border border-white/20 bg-black/55 p-3 text-white/90 backdrop-blur-md transition hover:bg-black/75"
                    >
                      <ChevronLeft className="h-5 w-5" />
                    </button>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        goToGallery(galleryIndex + 1);
                      }}
                      className="absolute right-3 top-1/2 -translate-y-1/2 rounded-2xl border border-white/20 bg-black/55 p-3 text-white/90 backdrop-blur-md transition hover:bg-black/75"
                    >
                      <ChevronRight className="h-5 w-5" />
                    </button>
                  </>
                )}
              </motion.button>
            ) : (
              <div className="grid aspect-[4/5] w-full place-items-center bg-white/[0.03] text-white/60 md:aspect-[16/9]">
                <div className="text-center text-sm">
                  <ImageIcon className="mx-auto mb-2 h-5 w-5" />
                  Sin fotos disponibles
                </div>
              </div>
            )}

            {gallery.length > 1 && (
              <div className="min-w-0 overflow-hidden px-3 py-2.5 md:px-4">
                <div className="flex min-w-0 flex-nowrap gap-2.5 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                  {gallery.map((item, idx) => {
                    const isLatestVideo =
                      item.type === "VIDEO" && item.url === latestStoryVideoUrl;
                    const isSelected = idx === galleryIndex;
                    const shouldLoopThumb = isLatestVideo && !isSelected;
                    const handleClick = () => {
                      if (isLatestVideo) {
                        const v = thumbVideoRefs.current.get(item.url);
                        if (v && Number.isFinite(v.currentTime)) {
                          setPendingVideoSeek({
                            url: item.url,
                            time: v.currentTime,
                          });
                        }
                      }
                      goToGallery(idx);
                    };
                    return (
                    <button
                      type="button"
                      key={`${item.url}-${idx}`}
                      onClick={handleClick}
                      className={`relative w-20 shrink-0 overflow-hidden rounded-xl border transition-all duration-200 aspect-[3/4] md:w-24 ${
                        isSelected
                          ? "border-fuchsia-300 shadow-[0_0_0_1px_rgba(232,121,249,0.5)] scale-[1.03]"
                          : "border-white/10 opacity-80 hover:opacity-100 hover:scale-105 hover:brightness-110"
                      }`}
                    >
                      {item.type === "VIDEO" ? (
                        <>
                          <video
                            ref={(el) => {
                              if (el) thumbVideoRefs.current.set(item.url, el);
                              else thumbVideoRefs.current.delete(item.url);
                            }}
                            src={shouldLoopThumb ? item.url : `${item.url}#t=0.1`}
                            muted
                            loop={shouldLoopThumb}
                            autoPlay={shouldLoopThumb}
                            playsInline
                            preload="metadata"
                            className="absolute inset-0 h-full w-full object-cover"
                          />
                          <div className="pointer-events-none absolute right-1 top-1">
                            <div className="rounded-full bg-black/55 p-1 ring-1 ring-white/30">
                              <Play className="h-2.5 w-2.5 fill-white text-white" />
                            </div>
                          </div>
                        </>
                      ) : (
                        <img
                          src={item.url}
                          alt={`Galería ${idx + 1}`}
                          className="absolute inset-0 h-full w-full object-cover"
                        />
                      )}
                    </button>
                    );
                  })}
                </div>
              </div>
            )}
          </section>

          {/* Sobre mi */}
          {cleanProfileText(professional.description) && (
            <section className="relative min-w-0 overflow-hidden rounded-2xl border border-white/[0.08] bg-gradient-to-br from-fuchsia-500/[0.06] via-violet-500/[0.04] to-transparent p-5 md:p-6">
              <div
                aria-hidden="true"
                className="pointer-events-none absolute inset-y-5 left-0 w-[3px] rounded-r-full bg-gradient-to-b from-fuchsia-400 via-violet-400 to-transparent"
              />
              <h2 className="mb-3 pl-3 text-xs font-bold uppercase tracking-[0.18em] text-fuchsia-300/80">
                Sobre mi
              </h2>
              <p className="whitespace-pre-line pl-3 text-[15px] leading-[1.7] text-white/85">
                {cleanProfileText(professional.description)}
              </p>
            </section>
          )}

          {/* Servicios + Estilo */}
          {((professional?.serviceTags?.length ?? 0) > 0 ||
            matchedSubcategories.length > 0 ||
            hasStyleSection) && (
            <section className="min-w-0 rounded-2xl border border-white/[0.08] bg-gradient-to-b from-white/[0.05] to-transparent p-5 md:p-6">
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

          {/* Información */}
          {hasDetailsSection && (
            <section className="min-w-0 rounded-2xl border border-white/[0.08] bg-gradient-to-b from-white/[0.05] to-transparent p-5 md:p-6">
              <h2 className="mb-4 text-base font-semibold text-white">
                Información
              </h2>
              <div className="grid grid-cols-2 gap-2.5 md:grid-cols-3">
                {infoItems.map((item) => {
                  const ItemIcon = item.Icon;
                  return (
                    <div
                      key={`${item.label}-${item.value}`}
                      className="group relative min-w-0 overflow-hidden rounded-xl border border-white/[0.06] bg-white/[0.03] p-3 transition hover:border-white/[0.12] hover:bg-white/[0.05]"
                    >
                      <div
                        aria-hidden="true"
                        className={`pointer-events-none absolute inset-0 bg-gradient-to-br opacity-60 ${item.accent}`}
                      />
                      <div className="relative flex items-center gap-2.5">
                        <div
                          className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-white/[0.06] ring-1 ring-inset ring-white/10 ${item.accent.split(" ").pop()}`}
                        >
                          <ItemIcon className="h-4 w-4" />
                        </div>
                        <div className="min-w-0">
                          <div className="text-[10px] font-semibold uppercase tracking-wide text-white/45">
                            {item.label}
                          </div>
                          <div className="truncate text-sm font-semibold text-white">
                            {item.value}
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
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

        </div>

        {/* Sidebar */}
        <aside className="hidden min-w-0 md:block">
          <div className="sticky top-[88px] min-w-0 space-y-4">
            {/* Price card */}
            <div className="overflow-hidden rounded-3xl border border-white/[0.08] bg-gradient-to-b from-white/[0.06] to-white/[0.02] shadow-[0_4px_40px_rgba(0,0,0,0.3)]">
              <div className="p-6">
                <div className="border-b border-white/[0.08] pb-4">
                  <p className="text-3xl font-bold leading-none text-white tracking-tight">
                    {priceLabel}
                  </p>
                  <p className="mt-1.5 flex items-center gap-1.5 text-sm text-white/60">
                    <Clock className="h-3.5 w-3.5" />
                    {durationLabel}
                  </p>
                </div>

                <div className="mt-4 flex flex-wrap gap-2">
                  <span
                    className={`flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-medium ${availabilityState.className}`}
                  >
                    <span
                      className={`h-1.5 w-1.5 rounded-full ${availabilityState.dot}`}
                    />
                    {availabilityState.label}
                  </span>
                  {availabilityChips.map((chip) => (
                    <span
                      key={chip}
                      className="rounded-full border border-white/10 bg-white/[0.04] px-2.5 py-1 text-[11px] text-white/70"
                    >
                      {chip}
                    </span>
                  ))}
                </div>

                <div className="mt-4 rounded-2xl border border-white/[0.06] bg-white/[0.03] p-3 text-sm text-white/70">
                  <p className="flex items-start gap-2">
                    <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-fuchsia-400" />
                    <span>
                      {professional.city
                        ? `Zona aproximada: ${professional.city}`
                        : "Zona referencial"}
                    </span>
                  </p>
                </div>

                {professional.availabilityNote && (
                  <p className="mt-3 rounded-xl bg-amber-500/10 px-3 py-2.5 text-xs text-amber-200/80 border border-amber-500/15">
                    {professional.availabilityNote}
                  </p>
                )}

                <div className="mt-4 space-y-2.5">
                <button
                  onClick={() => handleChatClick("message")}
                  className="btn-primary w-full rounded-2xl py-3.5 text-sm font-bold shadow-[0_8px_24px_rgba(168,85,247,0.3)] transition-transform duration-200 hover:scale-105 hover:shadow-[0_0_24px_rgba(168,85,247,0.45)]"
                >
                  Enviar mensaje
                </button>

                {/* Secondary actions — compact icon row */}
                <div className="flex gap-2 pt-1">
                  {hasVideocall && (
                    <Link
                      href={`/videocall?professional=${professional.id}`}
                      className="flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-gradient-to-r from-blue-600/90 to-violet-600/90 py-2.5 text-xs font-bold text-white transition-all hover:brightness-110"
                    >
                      <Video className="h-3.5 w-3.5" />
                      Video
                    </Link>
                  )}
                  {professional.phone && (
                    <a
                      href={formatWhatsAppUrl(professional.phone)}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={() => trackAction("whatsapp_click", professional.id, { source: "profile_detail", displayName: professional.name })}
                      className="flex flex-1 items-center justify-center gap-1.5 rounded-xl border border-emerald-500/25 bg-emerald-500/10 py-2.5 text-xs font-semibold text-emerald-200 transition hover:bg-emerald-500/20"
                    >
                      <Phone className="h-3.5 w-3.5" />
                      WhatsApp
                    </a>
                  )}
                  <button
                    onClick={toggleFavorite}
                    className={`flex flex-1 items-center justify-center gap-1.5 rounded-xl border py-2.5 text-xs font-medium transition-all ${
                      favorite
                        ? "border-rose-400/50 bg-rose-500/15 text-rose-200"
                        : "border-white/10 bg-white/[0.04] text-white/60 hover:bg-white/[0.08]"
                    }`}
                  >
                    <Heart
                      className={`h-3.5 w-3.5 ${favorite ? "fill-red-500 text-red-500" : ""}`}
                    />
                    {favorite ? "Guardado" : "Favorito"}
                  </button>
                </div>
              </div>
              </div>
            </div>

            {/* Service summary */}
            {cleanProfileText(professional.serviceSummary) && (
              <div className="rounded-2xl border border-white/[0.08] bg-white/[0.03] p-5">
                <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-white/40">
                  Descripcion del servicio
                </h3>
                <p className="text-sm leading-relaxed text-white/65">
                  {cleanProfileText(professional.serviceSummary)}
                </p>
              </div>
            )}
          </div>
        </aside>
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
                <img
                  src={lightbox.url}
                  alt="Vista ampliada"
                  className="h-full w-full rounded-3xl border border-white/10 object-contain"
                />
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
          <button
            onClick={toggleFavorite}
            className="flex h-8 w-8 items-center justify-center rounded-full border border-white/10 bg-white/[0.04] transition hover:bg-white/[0.08]"
          >
            <Heart
              className={`h-4 w-4 ${favorite ? "fill-red-500 text-red-500" : "text-white/50"}`}
            />
          </button>
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
          {hasVideocall && (
            <Link
              href={`/videocall?professional=${professional.id}`}
              className="flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-gradient-to-r from-blue-600/90 to-violet-600/90 py-2 text-xs font-bold text-white"
            >
              <Video className="h-3.5 w-3.5" />
              Video
            </Link>
          )}
          {professional.phone && (
            <a
              href={formatWhatsAppUrl(professional.phone)}
              target="_blank"
              rel="noopener noreferrer"
              onClick={() => trackAction("whatsapp_click", professional.id, { source: "profile_detail_sticky", displayName: professional.name })}
              className="flex flex-1 items-center justify-center gap-1.5 rounded-xl border border-emerald-500/25 bg-emerald-500/10 py-2 text-xs font-semibold text-emerald-200 transition hover:bg-emerald-500/20"
            >
              <Phone className="h-3.5 w-3.5" />
              WhatsApp
            </a>
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
    </div>
  );
}
