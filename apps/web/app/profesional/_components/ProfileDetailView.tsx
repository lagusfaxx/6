"use client";

import { useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ApiHttpError, apiFetch, resolveMediaUrl } from "../../../lib/api";
import { buildChatHref, buildCurrentPathWithSearch, buildLoginHref } from "../../../lib/chat";
import useMe from "../../../hooks/useMe";
import StarRating from "../../../components/StarRating";
import SkeletonCard from "../../../components/SkeletonCard";
import {
  ImageIcon, MapPin, Star, X, Heart, Shield, Clock, Eye,
  ChevronLeft, ChevronRight, MessageSquare, Award, Sparkles,
} from "lucide-react";

type Professional = {
  id: string;
  name: string;
  avatarUrl: string | null;
  coverUrl?: string | null;
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
  gallery: { id: string; url: string; type: string }[];
  completedServices?: number;
  profileViews?: number;
  userLevel?: string | null;
  reviewTagsSummary?: Record<string, number> | null;
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
  "Anal", "Oral", "Vaginal", "Masaje erótico", "Masaje relajante",
  "Tríos", "Packs", "Videollamada", "Despedida de solteros",
  "Discapacitados", "Duo", "Dominación", "Sumisión", "Roleplay",
  "Fantasías", "Striptease", "Beso negro", "Lluvia dorada",
  "Fetichismo", "Novia experience",
] as const;

function splitCsv(value?: string | null) {
  return (value || "").split(",").map((v) => v.trim()).filter(Boolean);
}

/** Strip emoji and AI-generated filler text from bio/descriptions */
function cleanProfileText(text: string | null | undefined): string | null {
  if (!text) return null;
  let cleaned = text
    // Remove emoji characters
    .replace(/[\u{1F300}-\u{1F9FF}\u{2600}-\u{27BF}\u{FE00}-\u{FE0F}\u{200D}\u{20E3}\u{E0020}-\u{E007F}]/gu, "")
    // Remove common AI filler phrases
    .replace(/(\b(hola|hey|bienvenido|bienvenidos)\b[!.,]*\s*(soy|me llamo|mi nombre es)?)/gi, "")
    .replace(/\b(escríbeme|contáctame|no te arrepentirás|te espero|llámame)\s*(ya|ahora|hoy|pronto|para más info)?[!.]*$/gim, "")
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

export default function ProfileDetailView({ id, username }: { id?: string; username?: string }) {
  const [professional, setProfessional] = useState<Professional | null>(null);
  const [favorite, setFavorite] = useState(false);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [lightbox, setLightbox] = useState<string | null>(null);
  const [galleryIndex, setGalleryIndex] = useState(0);
  const [showAllReviews, setShowAllReviews] = useState(false);
  const [showSurveyModal, setShowSurveyModal] = useState(false);
  const [surveyReviews, setSurveyReviews] = useState<SurveyReview[]>([]);
  const [surveySummary, setSurveySummary] = useState<SurveySummary | null>(null);
  const [surveyForm, setSurveyForm] = useState({ ratingBody: 5, ratingFace: 5, ratingPhotos: 5, ratingService: 5, ratingVibe: 5, comment: "" });
  const [surveySubmitting, setSurveySubmitting] = useState(false);
  const [surveyError, setSurveyError] = useState<string | null>(null);
  const [surveySuccess, setSurveySuccess] = useState(false);
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
            const profileRes = await apiFetch<{ profile: { id: string } }>(`/profiles/${encodeURIComponent(username)}`);
            professionalId = profileRes.profile?.id;
          } catch {
            // Profile endpoint may fail for expired plans — try directory search as fallback
            try {
              const searchRes = await apiFetch<{ results: Array<{ id: string; username: string }> }>(`/directory/search?entityType=professional&categorySlug=escort&limit=1&q=${encodeURIComponent(username)}`);
              const match = searchRes?.results?.find((r) => r.username === username);
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
        const res = await apiFetch<{ professional?: Professional } | Professional>(`/professionals/${professionalId}`);
        const payload = (res as { professional?: Professional }).professional ?? (res as Professional);
        if (!payload) throw new Error("NO_PROFILE");
        if (!cancelled) setProfessional(payload);
      } catch (err) {
        if (!cancelled && err instanceof ApiHttpError && [403, 404].includes(err.status)) {
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

  useEffect(() => {
    setGalleryIndex(0);
    if (!professional?.id) return;
    apiFetch<{ reviews: SurveyReview[]; summary: SurveySummary }>(`/professionals/${professional.id}/review-surveys`)
      .then((res) => {
        setSurveyReviews(res.reviews || []);
        setSurveySummary(res.summary || null);
      })
      .catch(() => {});
  }, [professional?.id]);

  const infoItems = useMemo(() => {
    if (!professional) return [] as { label: string; value: string }[];

    const baseItems: { label: string; value: string | null | undefined }[] = [
      { label: "Estatura", value: professional.heightCm ? `${professional.heightCm} cm` : null },
      { label: "Peso", value: professional.weightKg ? `${professional.weightKg} kg` : null },
      { label: "Medidas", value: professional.measurements || null },
      { label: "Cabello", value: professional.hairColor || null },
      { label: "Piel", value: professional.skinTone || null },
    ];

    const languageItems = splitCsv(professional.languages).map((language, index) => ({
      label: index === 0 ? "Idiomas" : "Idioma",
      value: language,
    }));

    return [...baseItems, ...languageItems]
      .filter((item) => Boolean(item.value))
      .map((item) => ({ label: item.label, value: String(item.value) }));
  }, [professional]);

  const styleChips = useMemo(() => splitCsv(professional?.serviceStyleTags), [professional?.serviceStyleTags]);

  // Match service subcategories from tags
  const matchedSubcategories = useMemo(() => {
    const tags = (professional?.normalizedTags || []).map((t) => t.toLowerCase());
    const fromStyle = styleChips.map((c) => c.toLowerCase());
    const all = [...tags, ...fromStyle];
    return SERVICE_SUBCATEGORIES.filter((sub) =>
      all.some((t) => t.includes(sub.toLowerCase()) || sub.toLowerCase().includes(t)),
    );
  }, [professional?.normalizedTags, styleChips]);

  const availabilityChips = useMemo(() => {
    if (!professional) return [] as string[];
    const chips: string[] = [];
    if (professional.acceptsIncalls) chips.push("Recibe");
    if (professional.acceptsOutcalls) chips.push("Se desplaza");
    return chips;
  }, [professional]);

  const availableNow = useMemo(() => isRecentlySeen(professional?.lastSeen), [professional?.lastSeen]);
  const coverSrc = resolveMediaUrl(professional?.coverUrl) ?? resolveMediaUrl(professional?.avatarUrl);
  const gallery = useMemo(
    () =>
      (professional?.gallery || [])
        .map((g) => resolveMediaUrl(g.url))
        .filter((url): url is string => typeof url === "string" && url.trim().length > 0),
    [professional?.gallery],
  );
  const selectedGalleryImage = gallery[galleryIndex] ?? gallery[0] ?? null;

  useEffect(() => {
    if (!gallery.length) {
      setGalleryIndex(0);
      return;
    }
    setGalleryIndex((prev) => Math.min(prev, gallery.length - 1));
  }, [gallery.length]);

  const hasDetailsSection = infoItems.length > 0;
  const hasStyleSection = styleChips.length > 0 || matchedSubcategories.length > 0;
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
      const res = await apiFetch<{ reviews: SurveyReview[]; summary: SurveySummary }>(`/professionals/${professional.id}/review-surveys`);
      setSurveyReviews(res.reviews || []);
      setSurveySummary(res.summary || null);
      setTimeout(() => {
        setShowSurveyModal(false);
        setSurveySuccess(false);
      }, 1500);
    } catch (err: any) {
      setSurveyError(err?.body?.message || "No se pudo enviar la calificacion.");
    } finally {
      setSurveySubmitting(false);
    }
  }

  if (loading) {
    return (
      <div className="grid gap-6">
        <SkeletonCard className="h-80" />
        <SkeletonCard className="h-64" />
      </div>
    );
  }
  if (notFound || !professional) {
    return (
      <div className="card p-8 text-center">
        <h1 className="text-xl font-semibold">Perfil no disponible</h1>
        <p className="mt-2 text-sm text-white/60">Este perfil no está público o no existe.</p>
      </div>
    );
  }

  const availabilityState = availableNow
    ? { label: "Disponible ahora", className: "border-emerald-300/40 bg-emerald-500/20 text-emerald-100", dot: "bg-emerald-400" }
    : professional.availabilityNote
      ? { label: "Disponible hoy", className: "border-amber-300/40 bg-amber-500/20 text-amber-100", dot: "bg-amber-400" }
      : { label: "No disponible", className: "border-white/20 bg-white/10 text-white/70", dot: "bg-white/40" };

  const priceLabel = hasRatesSection ? `$${professional.baseRate?.toLocaleString("es-CL")}` : "Tarifa a consultar";
  const durationLabel = professional.minDurationMinutes ? `${professional.minDurationMinutes} min` : "Sin duración mínima";

  return (
    <div className="-mx-4 w-[calc(100%+2rem)] overflow-x-hidden pb-40 md:pb-10">
      {/* Hero cover */}
      <section className="relative w-full overflow-hidden">
        <div className="relative aspect-[5/4] w-full overflow-hidden md:aspect-[16/6]">
          {coverSrc ? (
            <img src={coverSrc} alt="Portada" className="absolute inset-0 h-full w-full object-cover object-center" />
          ) : (
            <div className="grid h-full w-full place-items-center bg-gradient-to-br from-fuchsia-700/35 via-violet-700/30 to-slate-900">
              <ImageIcon className="h-10 w-10 text-white/50" />
            </div>
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-[#13061f]/90 via-[#13061f]/35 to-transparent" />

          <div className="absolute inset-x-0 top-0 flex items-center justify-between p-4 md:p-6">
            <span className={`flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium backdrop-blur-md ${availabilityState.className}`}>
              <span className={`h-2 w-2 rounded-full ${availabilityState.dot} ${availableNow ? "animate-pulse" : ""}`} />
              {availabilityState.label}
            </span>
            <div className="flex items-center gap-1 rounded-full border border-white/25 bg-white/10 px-3 py-1 text-xs font-medium text-white backdrop-blur-md">
              <Star className="h-3.5 w-3.5 fill-amber-300 text-amber-300" />
              <span>{professional.rating ? professional.rating.toFixed(1) : "–"}</span>
              {(professional.reviewCount ?? 0) > 0 && (
                <span className="text-white/50">({professional.reviewCount})</span>
              )}
            </div>
          </div>

          <div className="absolute inset-x-0 bottom-0 bg-[#13061f]/55 backdrop-blur-md">
            <div className="w-full px-4 py-4 md:px-8 md:py-7">
              <div className="space-y-1.5 md:space-y-2">
                <h1 className="text-2xl font-semibold leading-none tracking-tight sm:text-3xl md:text-4xl">
                  {professional.name}
                  {professional.age ? `, ${professional.age}` : ""}
                </h1>
                <div className="flex flex-wrap items-center gap-2 text-sm tracking-wide text-white/80 md:text-base">
                  <span className="flex items-center gap-1">
                    <MapPin className="h-3.5 w-3.5 text-fuchsia-400" />
                    {professional.city || "Ubicación no especificada"}
                  </span>
                  {professional.category && (
                    <>
                      <span className="text-white/30">·</span>
                      <span>{professional.category}</span>
                    </>
                  )}
                </div>
              </div>

              {/* Stats row */}
              <div className="mt-3 flex items-center gap-4 text-xs text-white/50">
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
                {professional.userLevel && (
                  <span className="flex items-center gap-1">
                    <Award className="h-3.5 w-3.5 text-amber-400" />
                    {professional.userLevel}
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>
      </section>

      <div className="mx-auto mt-4 grid w-full max-w-6xl min-w-0 gap-4 px-4 md:mt-6 md:grid-cols-[minmax(0,1fr)_340px] md:items-start md:gap-6 md:px-8">
        <div className="min-w-0 space-y-4 md:space-y-5">
          {/* Gallery */}
          <section className="min-w-0 overflow-hidden rounded-2xl border border-white/10 bg-white/[0.03] md:rounded-3xl">
            {selectedGalleryImage ? (
              <motion.button
                type="button"
                onClick={() => setLightbox(selectedGalleryImage)}
                className="relative block w-full overflow-hidden border-b border-white/10"
              >
                <div className="relative aspect-[4/5] w-full md:aspect-[16/9]">
                  <img src={selectedGalleryImage} alt="Imagen destacada" className="absolute inset-0 h-full w-full object-cover" />
                </div>
                <span className="absolute bottom-3 right-3 rounded-full border border-white/20 bg-black/50 px-2.5 py-1 text-xs text-white/90 backdrop-blur-md">
                  {galleryIndex + 1} / {gallery.length}
                </span>
                {gallery.length > 1 && (
                  <>
                    <button
                      type="button"
                      onClick={(e) => { e.stopPropagation(); setGalleryIndex((p) => (p - 1 + gallery.length) % gallery.length); }}
                      className="absolute left-3 top-1/2 -translate-y-1/2 rounded-full border border-white/20 bg-black/50 p-2 text-white/80 backdrop-blur-md transition hover:bg-black/70"
                    >
                      <ChevronLeft className="h-4 w-4" />
                    </button>
                    <button
                      type="button"
                      onClick={(e) => { e.stopPropagation(); setGalleryIndex((p) => (p + 1) % gallery.length); }}
                      className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full border border-white/20 bg-black/50 p-2 text-white/80 backdrop-blur-md transition hover:bg-black/70"
                    >
                      <ChevronRight className="h-4 w-4" />
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
              <div className="min-w-0 overflow-hidden px-3 py-3 md:px-4">
                <div className="flex min-w-0 flex-nowrap gap-2.5 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                  {gallery.map((url, idx) => (
                    <button
                      type="button"
                      key={`${url}-${idx}`}
                      onClick={() => setGalleryIndex(idx)}
                      className={`relative h-20 w-20 shrink-0 overflow-hidden rounded-xl border transition md:h-24 md:w-24 ${
                        idx === galleryIndex
                          ? "border-fuchsia-300 shadow-[0_0_0_1px_rgba(232,121,249,0.5)]"
                          : "border-white/10 opacity-80 hover:opacity-100"
                      }`}
                    >
                      <img src={url} alt={`Galería ${idx + 1}`} className="absolute inset-0 h-full w-full object-cover" />
                    </button>
                  ))}
                </div>
              </div>
            )}
          </section>

          {/* About */}
          {cleanProfileText(professional.description) && (
            <section className="min-w-0 rounded-2xl bg-white/[0.03] p-4 md:rounded-3xl md:p-6">
              <h2 className="mb-2 text-base font-semibold text-white/95">Sobre mi</h2>
              <p className="whitespace-pre-line text-sm leading-relaxed text-white/75">{cleanProfileText(professional.description)}</p>
            </section>
          )}

          {/* Service subcategories */}
          {matchedSubcategories.length > 0 && (
            <section className="min-w-0 rounded-2xl bg-white/[0.03] p-4 md:rounded-3xl md:p-6">
              <h2 className="mb-3 flex items-center gap-2 text-base font-semibold text-white/95">
                <Sparkles className="h-4 w-4 text-fuchsia-400" />
                Servicios que ofrece
              </h2>
              <div className="flex flex-wrap gap-2">
                {matchedSubcategories.map((sub) => (
                  <span
                    key={sub}
                    className="inline-flex rounded-full border border-violet-300/20 bg-violet-500/10 px-3 py-1.5 text-xs font-medium text-violet-100"
                  >
                    {sub}
                  </span>
                ))}
              </div>
            </section>
          )}

          {/* Physical info */}
          {hasDetailsSection && (
            <section className="min-w-0 rounded-2xl bg-white/[0.03] p-4 md:rounded-3xl md:p-6">
              <h2 className="mb-4 text-base font-semibold text-white/95">Información</h2>
              <dl className="grid grid-cols-2 gap-x-6 gap-y-3 md:grid-cols-3">
                {infoItems.map((item) => (
                  <div key={`${item.label}-${item.value}`} className="min-w-0 border-b border-white/10 pb-2">
                    <dt className="text-[11px] uppercase tracking-wide text-white/45">{item.label}</dt>
                    <dd className="truncate text-sm text-white/85">{item.value}</dd>
                  </div>
                ))}
              </dl>
            </section>
          )}

          {/* Tags */}
          {hasStyleSection && (
            <section className="min-w-0 rounded-2xl bg-white/[0.03] p-4 md:rounded-3xl md:p-6">
              <h2 className="mb-3 text-base font-semibold text-white/95">Etiquetas</h2>
              <div className="flex flex-wrap gap-2">
                {styleChips.map((chip) => (
                  <span
                    key={chip}
                    className="inline-flex rounded-full border border-fuchsia-300/20 bg-fuchsia-500/10 px-2.5 py-1 text-[11px] font-medium text-fuchsia-100"
                  >
                    {chip}
                  </span>
                ))}
              </div>
            </section>
          )}

          {/* Review tags summary */}
          {reviewTags.length > 0 && (
            <section className="min-w-0 rounded-2xl bg-white/[0.03] p-4 md:rounded-3xl md:p-6">
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
                    <span className="rounded-full bg-emerald-500/20 px-1.5 text-[10px] text-emerald-300">{count}</span>
                  </span>
                ))}
              </div>
            </section>
          )}

          {/* Reviews / Comments */}
          {reviews.length > 0 && (
            <section className="min-w-0 rounded-2xl bg-white/[0.03] p-4 md:rounded-3xl md:p-6">
              <div className="mb-4 flex items-center justify-between">
                <h2 className="flex items-center gap-2 text-base font-semibold text-white/95">
                  <MessageSquare className="h-4 w-4 text-fuchsia-400" />
                  Reseñas ({professional.reviewCount || reviews.length})
                </h2>
                <div className="flex items-center gap-1 text-sm text-amber-300">
                  <Star className="h-4 w-4 fill-amber-300" />
                  <span className="font-semibold">{professional.rating?.toFixed(1)}</span>
                </div>
              </div>

              <div className="space-y-3">
                {displayedReviews.map((review) => (
                  <div
                    key={review.id}
                    className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-violet-500/20 to-fuchsia-500/20 text-xs font-semibold text-white/70">
                          {review.author?.displayName?.[0]?.toUpperCase() || review.author?.username?.[0]?.toUpperCase() || "?"}
                        </div>
                        <div>
                          <p className="text-sm font-medium text-white/80">
                            {review.author?.displayName || review.author?.username || "Anónimo"}
                          </p>
                          <p className="text-[11px] text-white/40">{timeAgo(review.createdAt)}</p>
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
                      <p className="mt-2.5 text-sm leading-relaxed text-white/65">{review.comment}</p>
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
                  {showAllReviews ? "Ver menos" : `Ver todas las reseñas (${reviews.length})`}
                </button>
              )}
            </section>
          )}

          {/* Survey Rating Summary + Button */}
          <section className="min-w-0 rounded-2xl bg-white/[0.03] p-4 md:rounded-3xl md:p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="flex items-center gap-2 text-base font-semibold text-white/95">
                <Star className="h-4 w-4 text-amber-400" />
                Calificaciones detalladas
                {surveySummary && surveySummary.count > 0 && (
                  <span className="text-sm font-normal text-white/40">({surveySummary.count})</span>
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
                    { label: "Parecida a fotos", value: surveySummary.avgPhotos },
                    { label: "Servicio", value: surveySummary.avgService },
                    { label: "Trato y ambiente", value: surveySummary.avgVibe },
                  ].map((item) => (
                    <div key={item.label} className="flex items-center gap-3">
                      <span className="w-28 text-xs text-white/50 shrink-0">{item.label}</span>
                      <div className="flex-1 h-2 rounded-full bg-white/10 overflow-hidden">
                        <div className="h-full rounded-full bg-gradient-to-r from-fuchsia-500 to-amber-400" style={{ width: `${item.value * 10}%` }} />
                      </div>
                      <span className="w-8 text-right text-xs font-semibold text-white/80">{item.value}</span>
                    </div>
                  ))}
                </div>
                <div className="flex items-center justify-center gap-2 pt-2 border-t border-white/[0.06]">
                  <span className="text-2xl font-bold text-amber-300">{surveySummary.avgOverall}</span>
                  <span className="text-xs text-white/40">/ 10 promedio general</span>
                </div>

                {/* Survey text reviews */}
                {surveyReviews.filter((r) => r.comment).length > 0 && (
                  <div className="space-y-2 pt-3 border-t border-white/[0.06]">
                    {surveyReviews.filter((r) => r.comment).slice(0, showAllReviews ? 50 : 3).map((review) => (
                      <div key={review.id} className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-3">
                        <div className="flex items-center justify-between mb-1.5">
                          <div className="flex items-center gap-2">
                            <div className="flex h-6 w-6 items-center justify-center rounded-full bg-gradient-to-br from-violet-500/20 to-fuchsia-500/20 text-[10px] font-semibold text-white/70">
                              {review.author?.displayName?.[0]?.toUpperCase() || review.author?.username?.[0]?.toUpperCase() || "?"}
                            </div>
                            <span className="text-xs font-medium text-white/70">{review.author?.displayName || review.author?.username || "Anonimo"}</span>
                          </div>
                          <span className="flex items-center gap-1 text-xs text-amber-300 font-semibold">
                            <Star className="h-3 w-3 fill-amber-300" />
                            {review.overallScore.toFixed(1)}
                          </span>
                        </div>
                        <p className="text-sm text-white/60">{review.comment}</p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ) : (
              <p className="text-sm text-white/40 text-center py-4">Aun no hay calificaciones. Se el primero en calificar.</p>
            )}
          </section>
        </div>

        {/* Sidebar */}
        <aside className="hidden min-w-0 md:block">
          <div className="sticky top-[88px] min-w-0 space-y-4">
            {/* Price card */}
            <div className="rounded-3xl border border-white/10 bg-[linear-gradient(180deg,rgba(36,18,49,0.92)_0%,rgba(20,11,34,0.96)_100%)] p-5">
              <div className="border-b border-white/10 pb-4">
                <p className="text-3xl font-semibold leading-none text-white">{priceLabel}</p>
                <p className="mt-1 flex items-center gap-1.5 text-sm text-white/65">
                  <Clock className="h-3.5 w-3.5" />
                  {durationLabel}
                </p>
              </div>

              <div className="mt-4 flex flex-wrap gap-2">
                <span className={`flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-medium ${availabilityState.className}`}>
                  <span className={`h-1.5 w-1.5 rounded-full ${availabilityState.dot}`} />
                  {availabilityState.label}
                </span>
                {availabilityChips.map((chip) => (
                  <span key={chip} className="rounded-full border border-white/15 bg-white/5 px-2.5 py-1 text-[11px] text-white/80">
                    {chip}
                  </span>
                ))}
              </div>

              <div className="mt-4 rounded-xl border border-white/10 bg-white/[0.03] p-3 text-sm text-white/75">
                <p className="flex items-start gap-2">
                  <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-fuchsia-400" />
                  <span>{professional.city ? `Zona aproximada: ${professional.city}` : "Zona referencial"}</span>
                </p>
              </div>

              {professional.availabilityNote && (
                <p className="mt-3 rounded-lg bg-amber-500/10 px-3 py-2 text-xs text-amber-200/80 border border-amber-500/15">
                  {professional.availabilityNote}
                </p>
              )}

              <div className="mt-4 space-y-2.5">
                <button onClick={() => handleChatClick("request")} className="btn-primary w-full rounded-2xl py-3.5 text-sm font-bold shadow-[0_8px_24px_rgba(168,85,247,0.3)]">
                  Solicitar servicio
                </button>
                <button onClick={() => handleChatClick("message")} className="btn-secondary w-full rounded-2xl py-3 text-sm">
                  Enviar mensaje
                </button>
                <button
                  onClick={toggleFavorite}
                  className={`flex w-full items-center justify-center gap-2 rounded-2xl border px-4 py-2.5 text-sm font-medium transition-colors ${
                    favorite
                      ? "border-rose-400/60 bg-rose-500/20 text-rose-100"
                      : "border-white/15 bg-white/5 text-white/80 hover:bg-white/10"
                  }`}
                >
                  <Heart className={`h-4 w-4 ${favorite ? "fill-rose-400" : ""}`} />
                  {favorite ? "Guardado en favoritos" : "Agregar a favoritos"}
                </button>
              </div>
            </div>

            {/* Service summary */}
            {cleanProfileText(professional.serviceSummary) && (
              <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
                <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-white/45">Descripcion del servicio</h3>
                <p className="text-sm leading-relaxed text-white/70">{cleanProfileText(professional.serviceSummary)}</p>
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
            className="fixed inset-0 z-50 grid place-items-center bg-black/85 p-4 backdrop-blur-md"
            onClick={() => setLightbox(null)}
          >
            <div className="w-full max-w-3xl">
              <button
                type="button"
                className="mb-3 ml-auto flex rounded-full border border-white/25 bg-black/40 p-2 text-white/80"
                onClick={() => setLightbox(null)}
              >
                <X className="h-4 w-4" />
              </button>
              <img src={lightbox} alt="Vista ampliada" className="w-full rounded-3xl border border-white/10 object-cover" />
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Mobile bottom bar */}
      <div className="fixed inset-x-0 bottom-0 z-40 border-t border-white/10 bg-[linear-gradient(180deg,rgba(14,7,22,0.75)_0%,rgba(12,6,20,0.96)_40%,rgba(12,6,20,0.98)_100%)] px-4 pb-[calc(0.75rem+env(safe-area-inset-bottom))] pt-3 backdrop-blur-xl md:hidden">
        <div className="mb-2 text-center text-sm font-medium text-white/90">
          <span>{priceLabel}</span>
          <span className="mx-2 text-white/40">·</span>
          <span>{durationLabel}</span>
        </div>
        <button onClick={() => handleChatClick("request")} className="btn-primary w-full rounded-2xl py-3 text-sm font-bold shadow-[0_8px_24px_rgba(168,85,247,0.3)] mb-2">
          Solicitar servicio
        </button>
        <div className="grid grid-cols-2 gap-2.5">
          <button onClick={() => handleChatClick("message")} className="btn-secondary w-full rounded-2xl py-2.5 text-sm">
            Mensaje
          </button>
        <button
          onClick={toggleFavorite}
          className={`mt-2.5 flex w-full items-center justify-center gap-2 rounded-2xl border px-4 py-2.5 text-sm font-medium transition-colors ${
            favorite ? "border-rose-400/60 bg-rose-500/20 text-rose-100" : "border-white/15 bg-white/5 text-white/80 hover:bg-white/10"
          }`}
        >
          <Heart className={`h-4 w-4 ${favorite ? "fill-rose-400" : ""}`} />
          {favorite ? "Guardado en favoritos" : "Agregar a favoritos"}
        </button>
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
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-md rounded-2xl border border-white/10 bg-[#1a0e28] p-6 shadow-2xl"
            >
              {surveySuccess ? (
                <div className="text-center py-6">
                  <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-emerald-500/20">
                    <Star className="h-7 w-7 text-emerald-400" />
                  </div>
                  <h3 className="text-lg font-semibold text-white">Calificacion enviada</h3>
                  <p className="mt-1 text-sm text-white/60">Gracias por tu opinion.</p>
                </div>
              ) : (
                <>
                  <div className="flex items-center justify-between mb-5">
                    <h3 className="text-lg font-semibold text-white">Calificar a {professional.name}</h3>
                    <button onClick={() => setShowSurveyModal(false)} className="text-white/40 hover:text-white/70">
                      <X className="h-5 w-5" />
                    </button>
                  </div>

                  <div className="space-y-4">
                    {[
                      { key: "ratingBody", label: "Cuerpo", desc: "Como calificarias su fisico" },
                      { key: "ratingFace", label: "Rostro", desc: "Atractivo facial" },
                      { key: "ratingPhotos", label: "Parecida a las fotos", desc: "Que tan fiel a sus fotos era en persona" },
                      { key: "ratingService", label: "Calidad del servicio", desc: "Nivel de satisfaccion con el servicio" },
                      { key: "ratingVibe", label: "Trato y ambiente", desc: "Amabilidad, higiene y comodidad" },
                    ].map((item) => (
                      <div key={item.key}>
                        <div className="flex items-center justify-between mb-1.5">
                          <div>
                            <span className="text-sm font-medium text-white/90">{item.label}</span>
                            <p className="text-[11px] text-white/40">{item.desc}</p>
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
                          onChange={(e) => setSurveyForm((prev) => ({ ...prev, [item.key]: Number(e.target.value) }))}
                          className="w-full h-2 rounded-full appearance-none bg-white/10 accent-fuchsia-500 cursor-pointer [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-fuchsia-400 [&::-webkit-slider-thumb]:appearance-none"
                        />
                        <div className="flex justify-between text-[10px] text-white/25 mt-0.5">
                          <span>1</span><span>5</span><span>10</span>
                        </div>
                      </div>
                    ))}

                    <div>
                      <label className="text-sm font-medium text-white/90 block mb-1.5">Comentario (opcional)</label>
                      <textarea
                        rows={3}
                        maxLength={500}
                        placeholder="Cuenta tu experiencia..."
                        value={surveyForm.comment}
                        onChange={(e) => setSurveyForm((prev) => ({ ...prev, comment: e.target.value }))}
                        className="w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2.5 text-sm outline-none resize-none focus:border-fuchsia-500/30 transition placeholder:text-white/25"
                      />
                    </div>

                    {surveyError && (
                      <p className="text-xs text-red-300 bg-red-500/10 rounded-lg px-3 py-2 border border-red-500/20">{surveyError}</p>
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
