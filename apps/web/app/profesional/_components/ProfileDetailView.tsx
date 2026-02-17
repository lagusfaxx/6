"use client";

import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { ApiHttpError, apiFetch, resolveMediaUrl } from "../../../lib/api";
import { buildChatHref, buildCurrentPathWithSearch, buildLoginHref } from "../../../lib/chat";
import useMe from "../../../hooks/useMe";
import Avatar from "../../../components/Avatar";
import StarRating from "../../../components/StarRating";
import GalleryCounter from "../../../components/GalleryCounter";
import SkeletonCard from "../../../components/SkeletonCard";
import { ImageIcon, Star, X } from "lucide-react";

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

  const infoBadges = useMemo(() => {
    if (!professional) return [];

    return [
      professional.heightCm ? `${professional.heightCm} cm` : null,
      professional.weightKg ? `${professional.weightKg} kg` : null,
      professional.measurements ? `Medidas ${professional.measurements}` : null,
      professional.hairColor ? `Cabello ${professional.hairColor}` : null,
      professional.skinTone ? `Piel ${professional.skinTone}` : null,
      ...splitCsv(professional.languages).map((language) => `Idioma ${language}`),
    ].filter(Boolean) as string[];
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
  const avatarSrc = resolveMediaUrl(professional?.avatarUrl);
  const gallery = useMemo(
    () => (professional?.gallery || []).map((g) => resolveMediaUrl(g.url)).filter((url): url is string => Boolean(url)),
    [professional?.gallery],
  );
  const hasDetailsSection = infoBadges.length > 0;
  const hasStyleSection = styleChips.length > 0;
  const hasAvailabilitySection = Boolean(professional?.availabilityNote || availabilityChips.length);
  const hasRatesSection = typeof professional?.baseRate === "number";
  const hasLocationSection = Boolean(professional?.city);

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
    return <div className="grid gap-6"><SkeletonCard className="h-80" /><SkeletonCard className="h-64" /></div>;
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

  return (
    <div className="mx-auto grid w-full max-w-5xl gap-5 pb-28 md:gap-6 md:pb-6">
      <section className={`relative overflow-hidden rounded-[28px] border border-white/10 bg-gradient-to-b from-white/15 to-white/[0.03] shadow-[0_20px_60px_rgba(0,0,0,0.45)] backdrop-blur-2xl ${professional.isActive ? "" : "opacity-70 grayscale"}`}>
        <div className="relative aspect-[4/5] w-full overflow-hidden md:aspect-[16/7]">
          {coverSrc ? (
            <img src={coverSrc} alt="Portada" className="h-full w-full object-cover object-center" />
          ) : (
            <div className="grid h-full w-full place-items-center bg-gradient-to-br from-fuchsia-700/35 via-violet-700/30 to-slate-900">
              <ImageIcon className="h-10 w-10 text-white/50" />
            </div>
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-[#090312] via-[#090312]/60 to-transparent" />
        </div>

        <div className="relative -mt-14 space-y-4 px-4 pb-5 md:px-6 md:pb-6">
          <div className="rounded-[24px] border border-white/15 bg-black/35 p-4 shadow-[0_10px_40px_rgba(0,0,0,0.35)] backdrop-blur-xl md:p-5">
            <div className="flex items-start gap-3 md:gap-4">
              <Avatar
                src={avatarSrc}
                alt={professional.name}
                size={112}
                className="size-20 shrink-0 rounded-full border-2 border-white/40 ring-4 ring-black/40 md:size-24"
              />
              <div className="min-w-0 flex-1 space-y-2">
                <h1 className="truncate text-2xl font-semibold leading-tight">{professional.name}{professional.age ? `, ${professional.age}` : ""}</h1>
                <div className="flex items-center gap-2 text-sm text-white/80">
                  <div className="flex items-center gap-1 rounded-full border border-white/20 bg-white/10 px-2.5 py-1">
                    <Star className="h-3.5 w-3.5 text-amber-300" />
                    <StarRating rating={professional.rating} size={12} />
                  </div>
                  <span className={`rounded-full border px-2.5 py-1 text-xs font-medium ${availabilityState.className}`}>{availabilityState.label}</span>
                </div>
                <div className="text-sm text-white/65">
                  {professional.city || "Ubicación no especificada"}
                  {professional.category ? ` • ${professional.category}` : ""}
                </div>
              </div>
            </div>

            <div className="mt-4 flex flex-wrap gap-2.5">
              {styleChips.slice(0, 5).map((chip) => (
                <span key={chip} className="rounded-full border border-white/15 bg-white/10 px-3 py-1.5 text-xs font-medium text-white/90">
                  {chip}
                </span>
              ))}
            </div>

            <div className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-2">
              <button onClick={() => handleChatClick("message")} className="btn-primary w-full rounded-2xl py-3 text-sm">
                Enviar mensaje
              </button>
              <button onClick={() => handleChatClick("request")} className="btn-secondary w-full rounded-2xl py-3 text-sm">
                Solicitar servicio
              </button>
            </div>
            <button
              onClick={toggleFavorite}
              className={`mt-2.5 w-full rounded-2xl border px-4 py-2.5 text-sm font-medium transition-colors ${favorite ? "border-rose-400/60 bg-rose-500/20 text-rose-100" : "border-white/15 bg-white/5 text-white/80 hover:bg-white/10"}`}
            >
              {favorite ? "♥ Guardado en favoritos" : "♡ Agregar a favoritos"}
            </button>
          </div>
        </div>
      </section>

      {hasDetailsSection && (
        <section className="rounded-[28px] border border-white/10 bg-white/[0.06] p-5 shadow-[0_12px_40px_rgba(0,0,0,0.35)] backdrop-blur-xl md:p-6">
          <h2 className="mb-4 text-lg font-semibold">Información</h2>
          <div className="flex flex-wrap gap-2.5">
            {infoBadges.map((badge) => (
              <span key={badge} className="rounded-full border border-white/15 bg-white/10 px-3.5 py-2 text-xs font-medium text-white/85 md:text-sm">
                {badge}
              </span>
            ))}
          </div>
        </section>
      )}

      {/* Etiquetas - nice chips */}
      {hasStyleSection && (
        <div className="rounded-[28px] border border-white/10 bg-white/[0.06] p-5 shadow-[0_12px_40px_rgba(0,0,0,0.35)] backdrop-blur-xl md:p-6">
          <h2 className="mb-3 text-lg font-semibold">Etiquetas</h2>
          <div className="flex flex-wrap gap-2.5">
            {styleChips.map((chip) => (
              <span key={chip} className="inline-block rounded-full border border-fuchsia-300/25 bg-fuchsia-500/10 px-3.5 py-1.5 text-xs font-medium tracking-wide text-fuchsia-100">
                {chip}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Availability section */}
      {hasAvailabilitySection && (
        <div className="rounded-[28px] border border-white/10 bg-white/[0.06] p-5 shadow-[0_12px_40px_rgba(0,0,0,0.35)] backdrop-blur-xl md:p-6">
          <h2 className="mb-3 text-lg font-semibold">Disponibilidad</h2>
          <span className={`inline-flex rounded-full border px-3 py-1.5 text-xs font-medium ${availabilityState.className}`}>{availabilityState.label}</span>
          {professional.availabilityNote && (
            <p className="mb-3 mt-3 text-sm text-white/70">{professional.availabilityNote}</p>
          )}
          {availabilityChips.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-2">
              {availabilityChips.map((chip) => (
                <span key={chip} className="rounded-full border border-white/20 bg-white/5 px-3 py-1.5 text-xs text-white/80">
                  {chip}
                </span>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Rates section */}
      {hasRatesSection && (
        <section className="rounded-[28px] border border-fuchsia-300/20 bg-gradient-to-br from-fuchsia-500/15 via-violet-500/10 to-white/[0.03] p-5 shadow-[0_14px_50px_rgba(120,40,200,0.25)] backdrop-blur-xl md:p-6">
          <h2 className="text-lg font-semibold text-white/90">Tarifas</h2>
          <p className="mt-2 text-3xl font-semibold tracking-tight text-white">
            ${professional.baseRate?.toLocaleString("es-CL")}
          </p>
          <p className="mt-1 text-sm text-white/70">
            {professional.minDurationMinutes ? `${professional.minDurationMinutes} minutos` : "Tarifa base"}
          </p>
        </section>
      )}

      {gallery.length > 0 ? (
        <section className="rounded-[28px] border border-white/10 bg-white/[0.06] p-5 shadow-[0_12px_40px_rgba(0,0,0,0.35)] backdrop-blur-xl md:p-6">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-lg font-semibold">Galería</h2>
            <GalleryCounter count={gallery.length} />
          </div>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-3 md:gap-4">
            {gallery.map((url, idx) => (
              <motion.button
                type="button"
                key={`${url}-${idx}`}
                onClick={() => setLightbox(url)}
                className="aspect-[4/5] overflow-hidden rounded-3xl border border-white/10 bg-white/5 shadow-[0_8px_24px_rgba(0,0,0,0.35)] transition hover:scale-[1.01]"
              >
                <img src={url} alt={`Galería ${idx + 1}`} className="h-full w-full object-cover" />
              </motion.button>
            ))}
          </div>
        </section>
      ) : null}

      {/* Location section */}
      {hasLocationSection && (
        <div className="rounded-[28px] border border-white/10 bg-white/[0.06] p-5 shadow-[0_12px_40px_rgba(0,0,0,0.35)] backdrop-blur-xl md:p-6">
          <h2 className="text-lg font-semibold mb-2">Ubicación</h2>
          <p className="text-sm text-white/70">
            {professional.city ? `Zona aproximada: ${professional.city}` : "Zona referencial"}
          </p>
        </div>
      )}

      {/* Lightbox */}
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

      <div className="fixed inset-x-0 bottom-0 z-40 border-t border-white/10 bg-[#08050f]/90 px-4 py-3 backdrop-blur-xl md:hidden">
        <button onClick={() => handleChatClick("message")} className="btn-primary w-full rounded-2xl py-3 text-sm">
          Enviar mensaje
        </button>
      </div>
    </div>
  );
}
