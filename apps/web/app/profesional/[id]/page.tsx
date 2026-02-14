"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { motion } from "framer-motion";
import { ApiHttpError, apiFetch, resolveMediaUrl } from "../../../lib/api";
import useMe from "../../../hooks/useMe";
import Avatar from "../../../components/Avatar";
import StarRating from "../../../components/StarRating";
import GalleryCounter from "../../../components/GalleryCounter";
import SkeletonCard from "../../../components/SkeletonCard";

const placeholderGallery = ["/brand/isotipo.png", "/brand/isotipo.png", "/brand/isotipo.png"];

const fadeUp = {
  hidden: { opacity: 0, y: 14 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: { delay: i * 0.08, duration: 0.35, ease: [0.16, 1, 0.3, 1] },
  }),
};

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
  serviceSummary?: string | null;
  isOnline: boolean;
  lastSeen: string | null;
  gallery: { id: string; url: string; type: string }[];
};

export default function ProfessionalDetailPage() {
  const params = useParams();
  const id = String(params.id);
  const [professional, setProfessional] = useState<Professional | null>(null);
  const [favorite, setFavorite] = useState(false);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [activeRequest, setActiveRequest] = useState<{ id: string; status: string } | null>(null);
  const [lightbox, setLightbox] = useState<string | null>(null);
  const { me } = useMe();

  useEffect(() => {
    setLoading(true);
    setNotFound(false);
    apiFetch<{ professional?: Professional } | Professional>(`/professionals/${id}`)
      .then((res) => {
        const payload = (res as { professional?: Professional }).professional ?? (res as Professional);
        setProfessional(payload ?? null);
      })
      .catch((err) => {
        if (err instanceof ApiHttpError && err.status === 404) {
          setNotFound(true);
        }
        setProfessional(null);
      })
      .finally(() => setLoading(false));
  }, [id]);

  async function toggleFavorite() {
    if (!professional) return;
    if (!me?.user) {
      window.location.href = `/login?next=${encodeURIComponent(`/profesional/${professional.id}`)}`;
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

  useEffect(() => {
    if (!me?.user || me.user.profileType !== "CLIENT" || !professional) return;
    apiFetch<{ services: { id: string; status: string; professional: { id: string } }[] }>("/services/active")
      .then((res) => {
        const match = res.services.find((s) => s.professional.id === professional.id);
        setActiveRequest(match ? { id: match.id, status: match.status } : null);
      })
      .catch(() => setActiveRequest(null));
  }, [me?.user, professional]);

  if (loading) {
    return (
      <div className="grid gap-6">
        <SkeletonCard className="h-80" />
        <SkeletonCard className="h-64" />
        <SkeletonCard className="h-40" />
      </div>
    );
  }
  if (notFound || !professional) return <div className="text-white/60">No encontramos este profesional.</div>;

  const gallery = professional.gallery.length
    ? professional.gallery.map((g) => resolveMediaUrl(g.url)).filter(Boolean) as string[]
    : placeholderGallery;

  const genderLabel =
    professional.gender === "FEMALE"
      ? "Mujer"
      : professional.gender === "MALE"
        ? "Hombre"
        : professional.gender
          ? "Otro"
          : null;

  const canRequest = me?.user?.profileType === "CLIENT";

  return (
    <div className="grid gap-6">
      <div className={`card overflow-hidden p-0 ${professional.isActive ? "" : "opacity-70 grayscale"}`}>
        <div className="relative h-44 w-full bg-white/5 md:h-56">
          {professional.coverUrl ? (
            <img src={resolveMediaUrl(professional.coverUrl) ?? undefined} alt="Portada" className="h-full w-full object-cover" />
          ) : (
            <div className="h-full w-full bg-gradient-to-r from-white/5 via-white/10 to-transparent" />
          )}
          <div className="absolute -bottom-8 left-6">
            <div className="rounded-full border border-white/20 bg-[#120b2a] p-1 shadow-lg">
              <div className="rounded-full border border-white/10 bg-white/5 p-1">
                <div className="rounded-full">
                  <Avatar src={professional.avatarUrl} alt={professional.name} size={96} className="border-white/20" />
                </div>
              </div>
            </div>
          </div>
          <div className="absolute right-6 top-6">
            <span className={`rounded-full px-3 py-1 text-xs ${professional.isOnline ? "bg-emerald-500/20 text-emerald-100" : "bg-white/10 text-white/60"}`}>
              {professional.isOnline ? "Online" : "Offline"}
            </span>
          </div>
        </div>
        <div className="px-6 pb-6 pt-12">
          <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
            <div>
              <h1 className="text-2xl font-semibold">{professional.name}</h1>
              <div className="mt-1 flex items-center gap-2 text-sm text-white/60">
                <span>{professional.category || "Experiencia"}</span>
                <span>•</span>
                <StarRating rating={professional.rating} size={14} />
              </div>
              <div className="mt-2 text-xs text-white/50">
                {professional.isOnline ? "Disponible ahora" : professional.lastSeen ? `Última vez: ${new Date(professional.lastSeen).toLocaleString("es-CL")}` : "Sin actividad reciente"}
              </div>
              <motion.div
                initial="hidden"
                animate="visible"
                className="mt-3 flex flex-wrap gap-2"
              >
                {professional.age && (
                  <motion.span
                    custom={0}
                    variants={fadeUp}
                    className="rounded-full border border-white/20 bg-white/5 px-3 py-1 text-xs text-white/80"
                  >
                    {professional.age} años
                  </motion.span>
                )}
                {genderLabel && (
                  <motion.span
                    custom={1}
                    variants={fadeUp}
                    className="rounded-full border border-white/20 bg-white/5 px-3 py-1 text-xs text-white/80"
                  >
                    {genderLabel}
                  </motion.span>
                )}
                {professional.serviceSummary && (
                  <motion.span
                    custom={2}
                    variants={fadeUp}
                    className="rounded-full border border-white/20 bg-white/5 px-3 py-1 text-xs text-white/80"
                  >
                    {professional.serviceSummary}
                  </motion.span>
                )}
              </motion.div>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <button
                onClick={toggleFavorite}
                className={`rounded-full border px-4 py-2 text-sm ${
                  favorite ? "border-rose-400 bg-rose-500/20" : "border-white/20 bg-white/5"
                }`}
              >
                {favorite ? "♥ Favorito" : "♡ Favorito"}
              </button>
              {canRequest && !activeRequest ? (
                <button
                  className="btn-primary"
                  onClick={() => {
                    window.location.href = `/chat/${professional.id}`;
                  }}
                >
                  Solicitar / reservar en chat
                </button>
              ) : null}
              {canRequest && activeRequest ? (
                <span className="rounded-full border border-white/15 bg-white/5 px-4 py-2 text-xs text-white/70">
                  Solicitud {activeRequest.status === "ACTIVO" ? "activa" : "pendiente"}
                </span>
              ) : null}
              <button
                className="btn-secondary"
                onClick={() => {
                  if (!me?.user) {
                    window.location.href = `/login?next=${encodeURIComponent(`/profesional/${professional.id}`)}`;
                    return;
                  }
                  window.location.href = `/chat/${professional.id}`;
                }}
              >
                Enviar mensaje
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="card p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold">Galería</h2>
          <GalleryCounter count={gallery.length} />
        </div>
        <div className="mt-4 grid gap-3 grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {gallery.map((url, idx) => (
            <motion.button
              type="button"
              key={`${url}-${idx}`}
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: idx * 0.05, duration: 0.3 }}
              whileHover={{ scale: 1.05 }}
              onClick={() => setLightbox(url)}
              className="group relative h-40 overflow-hidden rounded-2xl border border-white/10 bg-white/5"
            >
              <img
                src={url}
                alt={`Galería ${idx + 1}`}
                loading="lazy"
                className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-110"
              />
              <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors" />
            </motion.button>
          ))}
        </div>
      </div>

      <div className="card p-6">
        <h2 className="text-lg font-semibold">Descripción</h2>
        <p className="mt-3 text-sm text-white/70">
          {professional.description || "Perfil profesional listo para ayudarte. Envía un mensaje para coordinar."}
        </p>
      </div>

      {lightbox ? (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/70 p-4" onClick={() => setLightbox(null)}>
          <div className="max-w-3xl w-full">
            <img src={lightbox} alt="Vista ampliada" className="w-full rounded-2xl border border-white/10 object-cover" />
          </div>
        </div>
      ) : null}
    </div>
  );
}
