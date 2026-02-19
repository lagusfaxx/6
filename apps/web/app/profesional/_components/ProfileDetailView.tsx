"use client";

import { useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ApiHttpError, apiFetch, resolveMediaUrl } from "../../../lib/api";
import { buildChatHref, buildCurrentPathWithSearch, buildLoginHref } from "../../../lib/chat";
import useMe from "../../../hooks/useMe";
import StarRating from "../../../components/StarRating";
import SkeletonCard from "../../../components/SkeletonCard";
import { ImageIcon, MapPin, Star, X, Heart, MessageCircle, Calendar, Clock, ChevronLeft, ChevronRight } from "lucide-react";

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
  const [lightboxIndex, setLightboxIndex] = useState(0);
  const [galleryIndex, setGalleryIndex] = useState(0);
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
      label: index === 0 ? "Idiomas" : "",
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

  function openLightbox(url: string, index: number) {
    setLightbox(url);
    setLightboxIndex(index);
  }

  function navigateLightbox(direction: "prev" | "next") {
    const newIndex = direction === "prev" 
      ? (lightboxIndex === 0 ? gallery.length - 1 : lightboxIndex - 1)
      : (lightboxIndex === gallery.length - 1 ? 0 : lightboxIndex + 1);
    setLightboxIndex(newIndex);
    setLightbox(gallery[newIndex]);
  }

  if (loading) {
    return (
      <div className="grid gap-6">
        <SkeletonCard className="h-64 md:h-80" />
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
      {/* Header con portada - TAMAÑO AJUSTADO */}
      <section className="relative w-full overflow-hidden">
        <div className="relative aspect-[16/9] w-full overflow-hidden md:aspect-[21/9] max-h-[45vh]">
          {coverSrc ? (
            <img src={coverSrc} alt="Portada" className="absolute inset-0 h-full w-full object-cover object-center" />
          ) : (
            <div className="grid h-full w-full place-items-center bg-gradient-to-br from-fuchsia-700/35 via-violet-700/30 to-slate-900">
              <ImageIcon className="h-10 w-10 text-white/50" />
            </div>
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-[#13061f]/95 via-[#13061f]/40 to-transparent" />

          {/* Top bar */}
          <div className="absolute inset-x-0 top-0 flex items-center justify-between p-3 md:p-5">
            <span className={`rounded-full border px-2.5 py-1 text-[11px] font-medium backdrop-blur-md flex items-center gap-1.5 ${availabilityState.className}`}>
              <span className={`h-1.5 w-1.5 rounded-full ${availableNow ? 'animate-pulse bg-emerald-400' : 'bg-amber-400'}`} />
              {availabilityState.label}
            </span>
            <div className="flex items-center gap-1 rounded-full border border-white/25 bg-white/10 px-2.5 py-1 text-xs font-medium text-white backdrop-blur-md">
              <Star className="h-3 w-3 text-amber-300" />
              <StarRating rating={professional.rating} size={11} />
            </div>
          </div>

          {/* Bottom info */}
          <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-[#13061f]/80 to-transparent backdrop-blur-sm">
            <div className="w-full px-4 py-4 md:px-8 md:py-6">
              <div className="space-y-1">
                <h1 className="text-2xl font-bold leading-none tracking-tight sm:text-3xl md:text-4xl">
                  {professional.name}
                  {professional.age ? <span className="text-white/60 font-normal">, {professional.age}</span> : ""}
                </h1>
                <div className="flex items-center gap-1.5 text-sm text-white/70 md:text-base">
                  <MapPin className="h-3.5 w-3.5" />
                  <span>{professional.city || "Ubicación no especificada"}</span>
                  {professional.category && (
                    <>
                      <span className="text-white/40 mx-1">•</span>
                      <span>{professional.category}</span>
                    </>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Main content */}
      <div className="mx-auto mt-4 grid w-full max-w-6xl min-w-0 gap-4 px-4 md:mt-6 md:grid-cols-[minmax(0,1fr)_320px] md:items-start md:gap-5 lg:grid-cols-[minmax(0,1fr)_360px] md:px-6 lg:px-8">
        {/* Left column */}
        <div className="min-w-0 space-y-4 md:space-y-5">
          {/* Galería */}
          <section className="min-w-0 overflow-hidden rounded-2xl border border-white/10 bg-white/[0.03] md:rounded-3xl">
            {selectedGalleryImage ? (
              <>
                <motion.button
                  type="button"
                  onClick={() => openLightbox(selectedGalleryImage, galleryIndex)}
                  className="relative block w-full overflow-hidden border-b border-white/10 group"
                  whileHover={{ scale: 1.005 }}
                  transition={{ duration: 0.2 }}
                >
                  <div className="relative aspect-[4/5] w-full md:aspect-[16/10]">
                    <img 
                      src={selectedGalleryImage} 
                      alt="Imagen destacada" 
                      className="absolute inset-0 h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.02]" 
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent" />
                  </div>
                  <span className="absolute bottom-3 right-3 rounded-full border border-white/20 bg-black/60 px-2.5 py-1 text-xs text-white/90 backdrop-blur-md">
                    {galleryIndex + 1} / {gallery.length}
                  </span>
                </motion.button>

                {gallery.length > 1 && (
                  <div className="min-w-0 overflow-hidden px-3 py-3 md:px-4">
                    <div className="flex min-w-0 flex-nowrap gap-2 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                      {gallery.map((url, idx) => (
                        <button
                          type="button"
                          key={`${url}-${idx}`}
                          onClick={() => setGalleryIndex(idx)}
                          className={`relative h-16 w-16 shrink-0 overflow-hidden rounded-xl border-2 transition-all duration-200 md:h-20 md:w-20 ${
                            idx === galleryIndex
                              ? "border-fuchsia-400 shadow-[0_0_10px_rgba(232,121,249,0.4)]"
                              : "border-transparent opacity-70 hover:opacity-100"
                          }`}
                        >
                          <img src={url} alt={`Galería ${idx + 1}`} className="absolute inset-0 h-full w-full object-cover" />
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </>
            ) : (
              <div className="grid aspect-[4/5] w-full place-items-center bg-white/[0.03] text-white/60 md:aspect-[16/10]">
                <div className="text-center text-sm">
                  <ImageIcon className="mx-auto mb-2 h-6 w-6 opacity-50" />
                  Sin fotos disponibles
                </div>
              </div>
            )}
          </section>

          {/* Sobre mí */}
          {professional.description && (
            <section className="min-w-0 rounded-2xl bg-white/[0.03] p-4 md:rounded-3xl md:p-5">
              <h2 className="mb-2 text-base font-semibold text-white/95">Sobre mí</h2>
              <p className="text-sm leading-relaxed text-white/75">{professional.description}</p>
            </section>
          )}

          {/* Información */}
          {hasDetailsSection && (
            <section className="min-w-0 rounded-2xl bg-white/[0.03] p-4 md:rounded-3xl md:p-5">
              <h2 className="mb-3 text-base font-semibold text-white/95">Información</h2>
              <dl className="grid grid-cols-2 gap-x-4 gap-y-3 md:grid-cols-3">
                {infoItems.map((item, index) => (
                  <div key={`${item.label}-${item.value}-${index}`} className="min-w-0">
                    <dt className="text-[10px] uppercase tracking-wide text-white/40">{item.label}</dt>
                    <dd className="truncate text-sm text-white/85">{item.value}</dd>
                  </div>
                ))}
              </dl>
            </section>
          )}

          {/* Etiquetas */}
          {hasStyleSection && (
            <section className="min-w-0 rounded-2xl bg-white/[0.03] p-4 md:rounded-3xl md:p-5">
              <h2 className="mb-3 text-base font-semibold text-white/95">Etiquetas</h2>
              <div className="flex flex-wrap gap-2">
                {styleChips.map((chip) => (
                  <span
                    key={chip}
                    className="inline-flex rounded-full border border-fuchsia-300/25 bg-fuchsia-500/15 px-3 py-1 text-xs font-medium text-fuchsia-100"
                  >
                    {chip}
                  </span>
                ))}
              </div>
            </section>
          )}
        </div>

        {/* Sidebar (desktop) */}
        <aside className="hidden min-w-0 md:block">
          <div className="sticky top-20 min-w-0 rounded-3xl border border-white/10 bg-[linear-gradient(180deg,rgba(36,18,49,0.92)_0%,rgba(20,11,34,0.96)_100%)] p-4 lg:p-5">
            <div className="border-b border-white/10 pb-4">
              <p className="text-3xl font-bold leading-none text-white">{priceLabel}</p>
              <p className="mt-1.5 flex items-center gap-1.5 text-sm text-white/60">
                <Clock className="h-3.5 w-3.5" />
                {durationLabel}
              </p>
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
                <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-fuchsia-400" />
                <span>{professional.city ? `Zona: ${professional.city}` : "Zona referencial"}</span>
              </p>
            </div>

            <div className="mt-4 space-y-2.5">
              <button 
                onClick={() => handleChatClick("message")} 
                className="w-full rounded-2xl bg-gradient-to-r from-fuchsia-600 to-violet-600 py-3 text-sm font-medium text-white transition-all hover:from-fuchsia-500 hover:to-violet-500 hover:shadow-lg hover:shadow-fuchsia-500/25 active:scale-[0.98] flex items-center justify-center gap-2"
              >
                <MessageCircle className="h-4 w-4" />
                Enviar mensaje
              </button>
              <button 
                onClick={() => handleChatClick("request")} 
                className="w-full rounded-2xl border border-white/20 bg-white/5 py-3 text-sm font-medium text-white transition-all hover:bg-white/10 hover:border-white/30 active:scale-[0.98] flex items-center justify-center gap-2"
              >
                <Calendar className="h-4 w-4" />
                Solicitar servicio
              </button>
              <button
                onClick={toggleFavorite}
                className={`w-full rounded-2xl border px-4 py-2.5 text-sm font-medium transition-all active:scale-[0.98] flex items-center justify-center gap-2 ${
                  favorite
                    ? "border-rose-400/60 bg-rose-500/20 text-rose-100 hover:bg-rose-500/30"
                    : "border-white/15 bg-white/5 text-white/80 hover:bg-white/10"
                }`}
              >
                <Heart className={`h-4 w-4 ${favorite ? "fill-rose-400 text-rose-400" : ""}`} />
                {favorite ? "Guardado" : "Favoritos"}
              </button>
            </div>
          </div>
        </aside>
      </div>

      {/* Lightbox mejorado con navegación */}
      <AnimatePresence>
        {lightbox && (
          <motion.div 
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/95 p-4 backdrop-blur-xl"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setLightbox(null)}
          >
            <div className="relative w-full max-w-4xl">
              <button
                type="button"
                className="absolute -top-12 right-0 flex items-center gap-2 rounded-full border border-white/20 bg-black/50 px-4 py-2 text-sm text-white/80 backdrop-blur-md transition hover:bg-white/10"
                onClick={() => setLightbox(null)}
              >
                <X className="h-4 w-4" />
                Cerrar
              </button>
              
              <div className="relative" onClick={(e) => e.stopPropagation()}>
                <img 
                  src={lightbox} 
                  alt="Vista ampliada" 
                  className="max-h-[75vh] w-full rounded-2xl border border-white/10 object-contain" 
                />
                
                {gallery.length > 1 && (
                  <>
                    <button
                      onClick={() => navigateLightbox("prev")}
                      className="absolute left-3 top-1/2 -translate-y-1/2 flex h-10 w-10 items-center justify-center rounded-full bg-black/60 text-white/80 backdrop-blur-md transition hover:bg-black/80"
                    >
                      <ChevronLeft className="h-5 w-5" />
                    </button>
                    <button
                      onClick={() => navigateLightbox("next")}
                      className="absolute right-3 top-1/2 -translate-y-1/2 flex h-10 w-10 items-center justify-center rounded-full bg-black/60 text-white/80 backdrop-blur-md transition hover:bg-black/80"
                    >
                      <ChevronRight className="h-5 w-5" />
                    </button>
                  </>
                )}
              </div>
              
              <p className="mt-3 text-center text-sm text-white/50">
                {lightboxIndex + 1} / {gallery.length}
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Bottom bar (mobile) */}
      <div className="fixed inset-x-0 bottom-0 z-40 border-t border-white/10 bg-[linear-gradient(180deg,rgba(14,7,22,0.95)_0%,rgba(12,6,20,0.98)_100%)] px-4 pb-[calc(0.75rem+env(safe-area-inset-bottom))] pt-3 backdrop-blur-xl md:hidden">
        <div className="mb-2 flex items-center justify-between">
          <span className="text-lg font-bold text-white">{priceLabel}</span>
          <span className="flex items-center gap-1.5 text-sm text-white/60">
            <Clock className="h-3.5 w-3.5" />
            {durationLabel}
          </span>
        </div>
        <div className="grid grid-cols-2 gap-2.5">
          <button 
            onClick={() => handleChatClick("message")} 
            className="rounded-2xl bg-gradient-to-r from-fuchsia-600 to-violet-600 py-3 text-sm font-medium text-white flex items-center justify-center gap-2 active:scale-[0.98] transition-all"
          >
            <MessageCircle className="h-4 w-4" />
            Mensaje
          </button>
          <button 
            onClick={() => handleChatClick("request")} 
            className="rounded-2xl border border-white/20 bg-white/5 py-3 text-sm font-medium text-white flex items-center justify-center gap-2 active:scale-[0.98] transition-all"
          >
            <Calendar className="h-4 w-4" />
            Solicitar
          </button>
        </div>
        <button
          onClick={toggleFavorite}
          className={`mt-2.5 w-full rounded-2xl border px-4 py-2.5 text-sm font-medium transition-all active:scale-[0.98] flex items-center justify-center gap-2 ${
            favorite ? "border-rose-400/60 bg-rose-500/20 text-rose-100" : "border-white/15 bg-white/5 text-white/80 hover:bg-white/10"
          }`}
        >
          <Heart className={`h-4 w-4 ${favorite ? "fill-rose-400 text-rose-400" : ""}`} />
          {favorite ? "Guardado en favoritos" : "Agregar a favoritos"}
        </button>
      </div>
    </div>
  );
}
