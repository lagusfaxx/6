"use client";

import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { ApiHttpError, apiFetch, resolveMediaUrl } from "../../../lib/api";
import { buildChatHref, buildCurrentPathWithSearch, buildLoginHref } from "../../../lib/chat";
import useMe from "../../../hooks/useMe";
import StarRating from "../../../components/StarRating";
import SkeletonCard from "../../../components/SkeletonCard";
import { ImageIcon, MapPin, Star, X } from "lucide-react";

type Professional = {
  id: string;
  name: string;
  avatarUrl: string | null;
  coverUrl?: string | null;
  category: string | null;
  isActive: boolean;
  rating: number | null;
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
};

function splitCsv(value?: string | null) {
  return (value || "").split(",").map((v) => v.trim()).filter(Boolean);
}

function isRecentlySeen(lastSeen?: string | null) {
  if (!lastSeen) return false;
  const parsed = Date.parse(lastSeen);
  if (Number.isNaN(parsed)) return false;
  return Date.now() - parsed <= 10 * 60 * 1000;
}

export default function ProfileDetailView({ id, username }: { id?: string; username?: string }) {
  const [professional, setProfessional] = useState<Professional | null>(null);
  const [favorite, setFavorite] = useState(false);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [lightbox, setLightbox] = useState<string | null>(null);
  const [galleryIndex, setGalleryIndex] = useState(0);
  const [reviews, setReviews] = useState<Array<{ id: string; rating: number; comment: string | null; createdAt: string }>>([]);
  const [reviewComment, setReviewComment] = useState("");
  const [reviewRating, setReviewRating] = useState(5);
  const [reviewLoading, setReviewLoading] = useState(false);
  const { me } = useMe();

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setNotFound(false);

    const load = async () => {
      try {
        let professionalId = id;
        if (!professionalId && username) {
          const profileRes = await apiFetch<{ profile: { id: string } }>(`/profiles/${encodeURIComponent(username)}`);
          professionalId = profileRes.profile?.id;
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
  }, [professional?.id]);


  useEffect(() => {
    if (!professional?.id) return;
    apiFetch<{ reviews: Array<{ id: string; rating: number; comment: string | null; createdAt: string }> }>(`/services/${professional.id}/reviews`)
      .then((res) => setReviews(res?.reviews || []))
      .catch(() => setReviews([]));
  }, [professional?.id]);

  const submitReview = async () => {
    if (!professional?.id || !me?.user?.id) return;
    setReviewLoading(true);
    try {
      await apiFetch(`/services/${professional.id}/rating`, {
        method: "POST",
        body: JSON.stringify({ rating: reviewRating })
      });
      const refreshed = await apiFetch<{ reviews: Array<{ id: string; rating: number; comment: string | null; createdAt: string }> }>(`/services/${professional.id}/reviews`);
      setReviews(refreshed?.reviews || []);
      setReviewComment("");
      setReviewRating(5);
    } catch {} finally {
      setReviewLoading(false);
    }
  };

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
  const hasStyleSection = styleChips.length > 0;
  const hasRatesSection = typeof professional?.baseRate === "number";

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
    ? { label: "Disponible ahora", className: "border-emerald-300/40 bg-emerald-500/20 text-emerald-100" }
    : professional.availabilityNote
      ? { label: "Disponible hoy", className: "border-amber-300/40 bg-amber-500/20 text-amber-100" }
      : { label: "No disponible", className: "border-white/20 bg-white/10 text-white/70" };

  const priceLabel = hasRatesSection ? `$${professional.baseRate?.toLocaleString("es-CL")}` : "Tarifa a consultar";
  const durationLabel = professional.minDurationMinutes ? `${professional.minDurationMinutes} min` : "Sin duración mínima";

  return (
    <div className="-mx-4 w-[calc(100%+2rem)] overflow-x-hidden pb-40 md:pb-10">
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
            <span className={`rounded-full border px-3 py-1 text-xs font-medium backdrop-blur-md ${availabilityState.className}`}>
              {availabilityState.label}
            </span>
            <div className="flex items-center gap-1 rounded-full border border-white/25 bg-white/10 px-3 py-1 text-xs font-medium text-white backdrop-blur-md">
              <Star className="h-3.5 w-3.5 text-amber-300" />
              <StarRating rating={professional.rating} size={12} />
            </div>
          </div>

          <div className="absolute inset-x-0 bottom-0 bg-[#13061f]/55 backdrop-blur-md">
            <div className="w-full px-4 py-4 md:px-8 md:py-7">
              <div className="space-y-1.5 md:space-y-2">
                <h1 className="text-2xl font-semibold leading-none tracking-tight sm:text-3xl md:text-4xl">
                  {professional.name}
                  {professional.age ? `, ${professional.age}` : ""}
                </h1>
                <div className="text-sm tracking-wide text-white/80 md:text-base">
                  {professional.city || "Ubicación no especificada"}
                  {professional.category ? ` • ${professional.category}` : ""}
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <div className="mx-auto mt-4 grid w-full max-w-6xl min-w-0 gap-4 px-4 md:mt-6 md:grid-cols-[minmax(0,1fr)_340px] md:items-start md:gap-6 md:px-8">
        <div className="min-w-0 space-y-4 md:space-y-5">
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

          {professional.description && (
            <section className="min-w-0 rounded-2xl bg-white/[0.03] p-4 md:rounded-3xl md:p-6">
              <h2 className="mb-2 text-base font-semibold text-white/95">Sobre mí</h2>
              <p className="text-sm leading-relaxed text-white/75">{professional.description}</p>
            </section>
          )}

          {hasDetailsSection && (
            <section className="min-w-0 rounded-2xl bg-white/[0.03] p-4 md:rounded-3xl md:p-6">
              <h2 className="mb-4 text-base font-semibold text-white/95">Información</h2>
              <dl className="grid grid-cols-1 gap-x-6 gap-y-3 md:grid-cols-2">
                {infoItems.map((item) => (
                  <div key={`${item.label}-${item.value}`} className="min-w-0 border-b border-white/10 pb-2">
                    <dt className="text-[11px] uppercase tracking-wide text-white/45">{item.label}</dt>
                    <dd className="truncate text-sm text-white/85">{item.value}</dd>
                  </div>
                ))}
              </dl>
            </section>
          )}


          <section className="min-w-0 rounded-2xl bg-white/[0.03] p-4 md:rounded-3xl md:p-6">
            <h2 className="mb-3 text-base font-semibold text-white/95">Servicios</h2>
            <div className="flex flex-wrap gap-2">
              {(["Anal", "Packs", "Tríos", "Discapacitados", "Videollamadas", "Domicilios", ...splitCsv(professional.serviceStyleTags)]).slice(0, 12).map((chip) => (
                <span key={chip} className="inline-flex rounded-full border border-white/15 bg-white/5 px-2.5 py-1 text-[11px] text-white/90">{chip}</span>
              ))}
            </div>
          </section>

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
        </div>

        <aside className="hidden min-w-0 md:block">
          <div className="sticky top-[88px] min-w-0 rounded-3xl border border-white/10 bg-[linear-gradient(180deg,rgba(36,18,49,0.92)_0%,rgba(20,11,34,0.96)_100%)] p-5">
            <div className="border-b border-white/10 pb-4">
              <p className="text-3xl font-semibold leading-none text-white">{priceLabel}</p>
              <p className="mt-1 text-sm text-white/65">{durationLabel}</p>
            </div>

            <div className="mt-4 flex flex-wrap gap-2">
              <span className={`rounded-full border px-2.5 py-1 text-[11px] font-medium ${availabilityState.className}`}>
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
                <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-white/60" />
                <span>{professional.city ? `Zona aproximada: ${professional.city}` : "Zona referencial"}</span>
              </p>
            </div>

            <div className="mt-4 space-y-2.5">
              <button onClick={() => handleChatClick("message")} className="btn-primary w-full rounded-2xl py-3 text-sm">
                Enviar mensaje
              </button>
              <button onClick={() => handleChatClick("request")} className="btn-secondary w-full rounded-2xl py-3 text-sm">
                Solicitar servicio
              </button>
              <button
                onClick={toggleFavorite}
                className={`w-full rounded-2xl border px-4 py-2.5 text-sm font-medium transition-colors ${
                  favorite
                    ? "border-rose-400/60 bg-rose-500/20 text-rose-100"
                    : "border-white/15 bg-white/5 text-white/80 hover:bg-white/10"
                }`}
              >
                {favorite ? "♥ Guardado en favoritos" : "♡ Agregar a favoritos"}
              </button>
            </div>
          </div>
        </aside>
      </div>


      <div className="mx-auto mt-5 w-full max-w-6xl px-4 md:px-8">
        <section className="rounded-2xl border border-white/10 bg-white/[0.03] p-4 md:rounded-3xl md:p-6">
          <h2 className="text-base font-semibold text-white/95">Comentarios y calificaciones</h2>
          {me?.user?.id ? (
            <div className="mt-3 grid gap-2 md:grid-cols-[140px_1fr_auto]">
              <select value={reviewRating} onChange={(e) => setReviewRating(Number(e.target.value))} className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm">
                <option value={5}>5 estrellas</option><option value={4}>4 estrellas</option><option value={3}>3 estrellas</option><option value={2}>2 estrellas</option><option value={1}>1 estrella</option>
              </select>
              <input value={reviewComment} onChange={(e) => setReviewComment(e.target.value)} className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm" placeholder="Comentario visible próximamente" />
              <button onClick={submitReview} disabled={reviewLoading} className="rounded-xl bg-[#ff4b4b] px-4 py-2 text-sm font-semibold">{reviewLoading ? "Enviando..." : "Publicar"}</button>
            </div>
          ) : (
            <p className="mt-2 text-sm text-white/60">Inicia sesión para comentar y calificar este perfil.</p>
          )}
          <div className="mt-4 space-y-2">
            {reviews.length ? reviews.map((r) => (
              <div key={r.id} className="rounded-xl border border-white/10 bg-white/5 p-3">
                <div className="text-xs text-white/60">{r.rating}★ · {new Date(r.createdAt).toLocaleDateString("es-CL")}</div>
                <p className="mt-1 text-sm text-white/85">{r.comment || "Sin comentario"}</p>
              </div>
            )) : <p className="text-sm text-white/60">Aún no hay comentarios.</p>}
          </div>
        </section>
      </div>

      {lightbox && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/85 p-4 backdrop-blur-md" onClick={() => setLightbox(null)}>
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
        </div>
      )}

      <div className="fixed inset-x-0 bottom-0 z-40 border-t border-white/10 bg-[linear-gradient(180deg,rgba(14,7,22,0.75)_0%,rgba(12,6,20,0.96)_40%,rgba(12,6,20,0.98)_100%)] px-4 pb-[calc(0.75rem+env(safe-area-inset-bottom))] pt-3 backdrop-blur-xl md:hidden">
        <div className="mb-2 text-center text-sm font-medium text-white/90">
          <span>{priceLabel}</span>
          <span className="mx-2 text-white/40">·</span>
          <span>{durationLabel}</span>
        </div>
        <div className="grid grid-cols-2 gap-2.5">
          <button onClick={() => handleChatClick("message")} className="btn-primary w-full rounded-2xl py-3 text-sm">
            Enviar mensaje
          </button>
          <button onClick={() => handleChatClick("request")} className="btn-secondary w-full rounded-2xl py-3 text-sm">
            Solicitar servicio
          </button>
        </div>
        <button
          onClick={toggleFavorite}
          className={`mt-2.5 w-full rounded-2xl border px-4 py-2.5 text-sm font-medium transition-colors ${
            favorite ? "border-rose-400/60 bg-rose-500/20 text-rose-100" : "border-white/15 bg-white/5 text-white/80 hover:bg-white/10"
          }`}
        >
          {favorite ? "♥ Guardado en favoritos" : "♡ Agregar a favoritos"}
        </button>
      </div>
    </div>
  );
}
