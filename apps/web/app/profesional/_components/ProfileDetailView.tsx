"use client";

import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { ApiHttpError, apiFetch, resolveMediaUrl } from "../../../lib/api";
import { buildChatHref, buildCurrentPathWithSearch, buildLoginHref } from "../../../lib/chat";
import useMe from "../../../hooks/useMe";
import StarRating from "../../../components/StarRating";
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
  styleChips: string[];
  availabilityChips: string[];
  gallery: { id: string; url: string; type: string }[];
  baseRate?: number | null;
  minDurationMinutes?: number | null;
};

function splitCsv(value?: string | null) {
  return (value || "")
    .split(",")
    .map((v) => v.trim())
    .filter(Boolean);
}

export default function ProfileDetailView({ id, username }: { id?: string; username?: string }) {
  const [professional, setProfessional] = useState<Professional | null>(null);
  const { me } = useMe();
  const [galleryIndex, setGalleryIndex] = useState(0);
  const [lightbox, setLightbox] = useState<string | null>(null);

  useEffect(() => {
    if (!id && !username) return;
    apiFetch(`/professionals/${id ? "id/" + id : "username/" + username}`)
      .then((res) => setProfessional((res as { professional?: Professional }).professional || null))
      .catch((err) => {
        if (err instanceof ApiHttpError && err.status === 404) setProfessional(null);
      });
  }, [id, username]);

  useEffect(() => {
    if (!professional?.gallery) return;
    // Ajustar índice cuando cambia número de fotos
    setGalleryIndex((prev) => Math.min(prev, (professional.gallery?.length || 0) - 1));
  }, [professional?.gallery]);

  // Resolver URLs de imágenes
  const coverSrc = useMemo(() => resolveMediaUrl(professional?.coverUrl) || resolveMediaUrl(professional?.avatarUrl), [professional]);
  const gallery = useMemo(
    () =>
      (professional?.gallery || [])
        .map((g) => resolveMediaUrl(g.url))
        .filter((url): url is string => Boolean(url)),
    [professional?.gallery]
  );

  const selectedGalleryImage = gallery[galleryIndex] || gallery[0] || null;
  useEffect(() => {
    if (!gallery.length) {
      setGalleryIndex(0);
      return;
    }
    setGalleryIndex((prev) => Math.min(prev, gallery.length - 1));
  }, [gallery.length]);

  const styleChips = useMemo(() => splitCsv(professional?.serviceSummary), [professional]);
  const availabilityChips = useMemo(() => splitCsv(professional?.availabilityNote), [professional]);
  const infoBadges = useMemo(() => {
    const badges: string[] = [];
    if (professional?.gender) badges.push(`Género: ${professional.gender}`);
    if (professional?.heightCm) badges.push(`Altura: ${professional.heightCm} cm`);
    if (professional?.weightKg) badges.push(`Peso: ${professional.weightKg} kg`);
    if (professional?.measurements) badges.push(`Medidas: ${professional.measurements}`);
    if (professional?.hairColor) badges.push(`Cabello: ${professional.hairColor}`);
    if (professional?.skinTone) badges.push(`Piel: ${professional.skinTone}`);
    return badges;
  }, [professional]);

  const availabilityState = useMemo(() => {
    if (!professional?.isActive) return { label: "No disponible", className: "border-white/20 bg-white/10 text-white/70" };
    if (professional.isOnline) return { label: "En línea", className: "border-green-400/50 bg-green-700/20 text-green-200" };
    return { label: "Activo", className: "border-white/20 bg-white/10 text-white/70" };
  }, [professional]);

  const hasDetailsSection = infoBadges.length > 0;
  const hasStyleSection = styleChips.length > 0;
  const hasAvailabilitySection = Boolean(professional?.availabilityNote || availabilityChips.length);
  const hasRatesSection = typeof professional?.baseRate === "number";
  const hasLocationSection = Boolean(professional?.city);

  if (professional === null) {
    return (
      <div className="mx-auto mt-16 max-w-md p-4 text-center">
        <h1 className="text-xl font-semibold">Perfil no disponible</h1>
      </div>
    );
  }
  if (!professional) {
    return <SkeletonCard />;
  }

  return (
    <div className="w-full overflow-x-hidden pb-36 md:pb-6">
      <section className={`relative w-full overflow-hidden ${professional.isActive ? "" : "opacity-70 grayscale"}`}>
        {/* Imagen de portada (hero) */}
        <div className="relative aspect-[3/4] w-full overflow-hidden sm:aspect-[4/5] md:aspect-[16/8]">
          {coverSrc ? (
            <img src={coverSrc} alt="Portada" className="h-full w-full object-cover object-center" />
          ) : (
            <div className="grid h-full w-full place-items-center bg-gradient-to-br from-fuchsia-700/35 via-violet-700/30 to-slate-900">
              <ImageIcon className="h-10 w-10 text-white/50" />
            </div>
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-[#13061f]/90 via-[#13061f]/35 to-transparent" />
        </div>
        {/* Contenido en la parte inferior de la portada (nombre, edad, ciudad, etiquetas) */}
        <div className="absolute inset-x-0 bottom-0">
          <div className="bg-[#13061f]/55 backdrop-blur-md">
            <div className="mx-auto w-full max-w-full md:max-w-5xl px-4 py-4 md:px-6 md:py-6">
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
              <div className="mt-2 flex flex-wrap gap-2 md:mt-3 md:gap-2.5">
                {styleChips.slice(0, 4).map((chip) => (
                  <span
                    key={chip}
                    className="rounded-full border border-white/20 bg-white/10 px-3.5 py-1.5 text-xs font-medium tracking-wide text-white/90 md:px-3 md:py-1.5 md:text-xs"
                  >
                    {chip}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Contenedor principal (hero + subsecciones) */}
      <div className="mx-auto grid w-full max-w-full md:max-w-5xl gap-4 md:gap-6">
        {/* Galería de fotos */}
        {gallery.length > 0 && (
          <section className="overflow-hidden">
            <div className="min-w-0 space-y-3 md:space-y-4">
              {selectedGalleryImage && (
                <motion.button
                  type="button"
                  onClick={() => setLightbox(selectedGalleryImage)}
                  className="relative block w-full overflow-hidden border-y border-white/10 bg-white/5 md:rounded-3xl md:border"
                >
                  {/* Imagen principal de galería; aspecto más bajo en móvil para no competir con el hero */}
                  <div className="aspect-[4/5] w-full sm:aspect-[4/5] md:aspect-[16/8]">
                    <img src={selectedGalleryImage} alt="Imagen destacada" className="h-full w-full object-cover" />
                  </div>
                  <span className="absolute bottom-3 right-3 rounded-full bg-black/50 px-2.5 py-1 text-xs text-white/90 backdrop-blur-md">
                    {galleryIndex + 1} / {gallery.length}
                  </span>
                </motion.button>
              )}
              {/* Carrusel de miniaturas */}
              {gallery.length > 1 && (
                <div className="mt-2 flex gap-2 overflow-x-auto py-1 touch-pan-x">
                  {gallery.map((url, idx) => (
                    <button
                      key={url}
                      type="button"
                      onClick={() => setGalleryIndex(idx)}
                      className={`flex-none overflow-hidden rounded-xl ${galleryIndex === idx ? "ring-2 ring-fuchsia-500" : ""}`}
                      style={{ width: "60px", height: "60px" }}
                    >
                      <img src={url} alt={`Galería ${idx + 1}`} className="h-full w-full object-cover" />
                    </button>
                  ))}
                </div>
              )}
            </div>
          </section>
        )}

        {/* Sección de información (badges) */}
        {hasDetailsSection && (
          <section>
            <h2 className="mb-4 text-lg font-semibold">Información</h2>
            <div className="flex flex-wrap gap-2.5">
              {infoBadges.map((badge) => (
                <span key={badge} className="rounded-full border border-white/10 px-3.5 py-2 text-xs font-medium text-white/85 md:text-sm">
                  {badge}
                </span>
              ))}
            </div>
          </section>
        )}

        {/* Disponibilidad */}
        {hasAvailabilitySection && (
          <div>
            <h2 className="mb-3 text-lg font-semibold">Disponibilidad</h2>
            {professional.availabilityNote && (
              <p className="text-sm text-white/70">{professional.availabilityNote}</p>
            )}
            {availabilityChips.length > 0 && (
              <div className="mt-3 flex flex-wrap gap-2">
                {availabilityChips.map((chip) => (
                  <span
                    key={chip}
                    className="rounded-full border border-white/20 bg-white/5 px-3 py-1.5 text-xs text-white/80"
                  >
                    {chip}
                  </span>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Tarifa */}
        {hasRatesSection && (
          <section>
            <h2 className="text-lg font-semibold text-white/90">Tarifa</h2>
            <p className="mt-2 text-3xl font-semibold tracking-tight text-white md:text-4xl">
              ${professional.baseRate?.toLocaleString("es-CL")}
            </p>
            <p className="mt-1 text-sm text-white/70">
              {professional.minDurationMinutes
                ? `${professional.minDurationMinutes} minutos`
                : "Tarifa base"}
            </p>
          </section>
        )}

        {/* Etiquetas de estilo */}
        {hasStyleSection && (
          <div>
            <h2 className="mb-3 text-lg font-semibold">Etiquetas</h2>
            <div className="flex flex-wrap gap-2.5">
              {styleChips.map((chip) => (
                <span
                  key={chip}
                  className="inline-block rounded-full border border-fuchsia-100 px-3.5 py-1.5 text-xs font-medium tracking-wide text-fuchsia-100"
                >
                  {chip}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Ubicación */}
        {hasLocationSection && (
          <div>
            <h2 className="mb-2 text-lg font-semibold">Ubicación</h2>
            <p className="text-sm text-white/70">
              {professional.city
                ? `Zona aproximada: ${professional.city}`
                : "Zona referencial"}
            </p>
          </div>
        )}

        {/* Lightbox para imagen en grande */}
        {lightbox && (
          <div
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
              <img src={lightbox} alt="Vista ampliada" className="h-auto w-full rounded-xl" />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
