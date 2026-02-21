"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import { MapPin, Phone, Clock, Star, X, MessageSquare, Bed, Tag, Gift } from "lucide-react";
import { apiFetch, resolveMediaUrl } from "../../../lib/api";
import Avatar from "../../../components/Avatar";
import SkeletonCard from "../../../components/SkeletonCard";

type EstReview = {
  id: string;
  rating: number;
  comment: string | null;
  createdAt: string;
};

type Establishment = {
  id: string;
  name: string;
  city: string;
  address: string;
  phone: string;
  description: string | null;
  rating: number | null;
  reviewCount?: number;
  recentReviews?: EstReview[];
  gallery: string[];
  category: string | null;
  avatarUrl?: string | null;
  coverUrl?: string | null;
  features?: string[];
  isOpen?: boolean;
  fromPrice?: number;
  rooms?: { id: string; name: string; description?: string | null; price: number }[];
  packs?: { id: string; name: string; description?: string | null; price: number }[];
  promotions?: { id: string; title: string; description?: string | null; discountPercent?: number | null }[];
};

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

const fadeUp = {
  hidden: { opacity: 0, y: 14 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: { delay: i * 0.08, duration: 0.35, ease: [0.16, 1, 0.3, 1] },
  }),
};

export default function EstablishmentDetailPage() {
  const params = useParams();
  const id = String(params.id);
  const [data, setData] = useState<Establishment | null>(null);
  const [loading, setLoading] = useState(true);
  const [lightbox, setLightbox] = useState<string | null>(null);
  const [showAllReviews, setShowAllReviews] = useState(false);

  useEffect(() => {
    apiFetch<{ establishment: Establishment }>(`/establishments/${id}`)
      .then((res) => setData(res.establishment))
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) {
    return (
      <div className="grid gap-6">
        <SkeletonCard className="h-80" />
        <SkeletonCard className="h-64" />
        <SkeletonCard className="h-40" />
      </div>
    );
  }

  if (!data) {
    return (
      <div className="card p-8 text-center">
        <h1 className="text-xl font-semibold">Establecimiento no encontrado</h1>
        <p className="mt-2 text-sm text-white/60">Este lugar no está disponible o no existe.</p>
      </div>
    );
  }

  const gallery = data.gallery.length
    ? data.gallery.map((url) => resolveMediaUrl(url)).filter((u): u is string => !!u)
    : [];
  const reviews = data.recentReviews || [];
  const displayedReviews = showAllReviews ? reviews : reviews.slice(0, 3);

  return (
    <motion.div initial="hidden" animate="visible" className="grid gap-5">
      {/* Hero */}
      <motion.div custom={0} variants={fadeUp} className="overflow-hidden rounded-2xl border border-white/10 bg-white/[0.03]">
        <div className="relative h-56 w-full bg-white/5 md:h-72">
          {data.coverUrl ? (
            <img src={resolveMediaUrl(data.coverUrl) ?? undefined} alt="Portada" className="h-full w-full object-cover" />
          ) : (
            <div className="h-full w-full bg-gradient-to-br from-fuchsia-600/20 via-violet-600/15 to-transparent">
              <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_20%,rgba(168,85,247,0.2),transparent_60%)]" />
            </div>
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent" />

          <div className="absolute -bottom-12 left-6">
            <div className="rounded-2xl border-4 border-[#120b2a] bg-white/5 p-1 shadow-2xl">
              <Avatar src={data.avatarUrl} alt={data.name} size={96} className="rounded-xl border-white/20" />
            </div>
          </div>

          {data.isOpen !== undefined && (
            <div className="absolute right-6 top-6">
              <span className={`flex items-center gap-1.5 rounded-full px-4 py-2 text-xs font-medium backdrop-blur-md ${
                data.isOpen
                  ? "border border-emerald-400/30 bg-emerald-500/20 text-emerald-100"
                  : "border border-white/20 bg-white/10 text-white/60"
              }`}>
                <span className={`h-2 w-2 rounded-full ${data.isOpen ? "bg-emerald-400 animate-pulse" : "bg-white/40"}`} />
                {data.isOpen ? "Abierto ahora" : "Cerrado"}
              </span>
            </div>
          )}

          {data.rating != null && (
            <div className="absolute right-6 bottom-6 flex items-center gap-1.5 rounded-full border border-white/20 bg-black/50 px-3 py-1.5 text-sm backdrop-blur-md">
              <Star className="h-4 w-4 fill-amber-300 text-amber-300" />
              <span className="font-semibold text-white">{data.rating.toFixed(1)}</span>
              {(data.reviewCount ?? 0) > 0 && (
                <span className="text-white/50">({data.reviewCount})</span>
              )}
            </div>
          )}
        </div>

        <div className="px-6 pb-6 pt-16">
          <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
            <div className="flex-1">
              <h1 className="text-3xl font-bold">{data.name}</h1>

              <div className="mt-3 space-y-2 text-sm text-white/70">
                <div className="flex items-center gap-2">
                  <MapPin size={16} className="text-fuchsia-400" />
                  <span>{data.address}, {data.city}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Phone size={16} className="text-fuchsia-400" />
                  <a href={`tel:${data.phone}`} className="transition hover:text-white">{data.phone}</a>
                </div>
                {data.fromPrice != null && data.fromPrice > 0 && (
                  <div className="flex items-center gap-2">
                    <Clock size={16} className="text-fuchsia-400" />
                    <span>Desde ${data.fromPrice.toLocaleString("es-CL")}</span>
                  </div>
                )}
              </div>

              {data.features && data.features.length > 0 && (
                <div className="mt-4 flex flex-wrap gap-2">
                  {data.features.map((feature, idx) => (
                    <span key={idx} className="rounded-full border border-white/20 bg-white/5 px-3 py-1 text-xs text-white/80">
                      {feature}
                    </span>
                  ))}
                </div>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <Link href={`/calificar/establecimiento/${data.id}`} className="btn-primary">
                Calificar experiencia
              </Link>
            </div>
          </div>
        </div>
      </motion.div>

      {/* Rooms */}
      {data.rooms && data.rooms.length > 0 && (
        <motion.div custom={1} variants={fadeUp} className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
          <h2 className="mb-4 flex items-center gap-2 text-lg font-semibold">
            <Bed className="h-5 w-5 text-fuchsia-400" />
            Habitaciones
          </h2>
          <div className="grid gap-3 sm:grid-cols-2">
            {data.rooms.map((room) => (
              <div key={room.id} className="rounded-xl border border-white/10 bg-white/[0.02] p-4">
                <h3 className="font-medium text-white/90">{room.name}</h3>
                {room.description && <p className="mt-1 text-xs text-white/50">{room.description}</p>}
                <p className="mt-2 text-sm font-semibold text-fuchsia-300">${room.price.toLocaleString("es-CL")}</p>
              </div>
            ))}
          </div>
        </motion.div>
      )}

      {/* Promotions */}
      {data.promotions && data.promotions.length > 0 && (
        <motion.div custom={2} variants={fadeUp} className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
          <h2 className="mb-4 flex items-center gap-2 text-lg font-semibold">
            <Gift className="h-5 w-5 text-amber-400" />
            Promociones
          </h2>
          <div className="space-y-3">
            {data.promotions.map((promo) => (
              <div key={promo.id} className="rounded-xl border border-amber-500/15 bg-amber-500/5 p-4">
                <div className="flex items-center gap-2">
                  <Tag className="h-4 w-4 text-amber-400" />
                  <h3 className="font-medium text-amber-100">{promo.title}</h3>
                  {promo.discountPercent && (
                    <span className="rounded-full bg-amber-500/20 px-2 py-0.5 text-[10px] font-semibold text-amber-300">
                      -{promo.discountPercent}%
                    </span>
                  )}
                </div>
                {promo.description && <p className="mt-1 text-xs text-amber-200/60">{promo.description}</p>}
              </div>
            ))}
          </div>
        </motion.div>
      )}

      {/* Gallery */}
      {gallery.length > 0 && (
        <motion.div custom={3} variants={fadeUp} className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
          <h2 className="mb-4 text-lg font-semibold">Galería</h2>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-3 xl:grid-cols-4">
            {gallery.map((url, idx) => (
              <motion.button
                key={`${url}-${idx}`}
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: idx * 0.05, duration: 0.3 }}
                whileHover={{ scale: 1.03 }}
                onClick={() => setLightbox(url)}
                className="group relative h-40 overflow-hidden rounded-xl border border-white/10 bg-white/5"
              >
                <img src={url} alt={`Galería ${idx + 1}`} loading="lazy" className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-110" />
                <div className="absolute inset-0 bg-black/0 transition-colors group-hover:bg-black/20" />
              </motion.button>
            ))}
          </div>
        </motion.div>
      )}

      {/* Description */}
      {data.description && (
        <motion.div custom={4} variants={fadeUp} className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
          <h2 className="text-lg font-semibold">Acerca del lugar</h2>
          <p className="mt-3 whitespace-pre-line text-sm leading-relaxed text-white/75">{data.description}</p>
        </motion.div>
      )}

      {/* Reviews */}
      {reviews.length > 0 && (
        <motion.div custom={5} variants={fadeUp} className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="flex items-center gap-2 text-lg font-semibold">
              <MessageSquare className="h-5 w-5 text-amber-400" />
              Reseñas ({data.reviewCount || reviews.length})
            </h2>
            <div className="flex items-center gap-1 text-sm text-amber-300">
              <Star className="h-4 w-4 fill-amber-300" />
              <span className="font-semibold">{data.rating?.toFixed(1)}</span>
            </div>
          </div>

          <div className="space-y-3">
            {displayedReviews.map((review) => (
              <div key={review.id} className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4">
                <div className="flex items-center justify-between">
                  <p className="text-[11px] text-white/40">{timeAgo(review.createdAt)}</p>
                  <div className="flex items-center gap-0.5">
                    {Array.from({ length: 5 }).map((_, i) => (
                      <Star key={i} className={`h-3.5 w-3.5 ${i < review.rating ? "fill-amber-400 text-amber-400" : "text-white/15"}`} />
                    ))}
                  </div>
                </div>
                {review.comment && (
                  <p className="mt-2 text-sm leading-relaxed text-white/65">{review.comment}</p>
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
        </motion.div>
      )}

      {/* Lightbox */}
      <AnimatePresence>
        {lightbox && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 grid place-items-center bg-black/90 p-4 backdrop-blur-sm"
            onClick={() => setLightbox(null)}
          >
            <div className="w-full max-w-4xl">
              <button
                type="button"
                className="mb-3 ml-auto flex rounded-full border border-white/25 bg-black/40 p-2 text-white/80"
                onClick={() => setLightbox(null)}
              >
                <X className="h-4 w-4" />
              </button>
              <img src={lightbox} alt="Vista ampliada" className="w-full rounded-2xl border border-white/20 object-cover shadow-2xl" />
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
