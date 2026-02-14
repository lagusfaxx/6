"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { motion } from "framer-motion";
import { MapPin, Phone, Clock } from "lucide-react";
import { apiFetch, resolveMediaUrl } from "../../../lib/api";
import Avatar from "../../../components/Avatar";
import StarRating from "../../../components/StarRating";
import GalleryCounter from "../../../components/GalleryCounter";
import SkeletonCard from "../../../components/SkeletonCard";

const fallbackGallery = ["/brand/isotipo.png", "/brand/isotipo.png", "/brand/isotipo.png"];

const fadeUp = {
  hidden: { opacity: 0, y: 14 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: { delay: i * 0.08, duration: 0.35, ease: [0.16, 1, 0.3, 1] },
  }),
};

type Establishment = {
  id: string;
  name: string;
  city: string;
  address: string;
  phone: string;
  description: string | null;
  rating: number | null;
  gallery: string[];
  category: string | null;
  avatarUrl?: string | null;
  coverUrl?: string | null;
  features?: string[];
  isOpen?: boolean;
  fromPrice?: number;
};

export default function EstablishmentDetailPage() {
  const params = useParams();
  const id = String(params.id);
  const [data, setData] = useState<Establishment | null>(null);
  const [loading, setLoading] = useState(true);
  const [lightbox, setLightbox] = useState<string | null>(null);

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
    return <div className="text-white/60">No encontramos este establecimiento.</div>;
  }

  const gallery = data.gallery.length ? data.gallery : fallbackGallery;

  return (
    <motion.div initial="hidden" animate="visible" className="grid gap-6">
      {/* Hero Section with Cover */}
      <motion.div custom={0} variants={fadeUp} className="card overflow-hidden p-0">
        {/* Cover Image */}
        <div className="relative h-56 w-full bg-white/5 md:h-64">
          {data.coverUrl ? (
            <img
              src={resolveMediaUrl(data.coverUrl) ?? undefined}
              alt="Portada"
              className="h-full w-full object-cover"
            />
          ) : (
            <div className="h-full w-full bg-gradient-to-br from-fuchsia-600/20 via-violet-600/15 to-transparent">
              <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_20%,rgba(168,85,247,0.2),transparent_60%)]" />
            </div>
          )}

          {/* Gradient overlay */}
          <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent" />

          {/* Avatar overlapping cover */}
          <div className="absolute -bottom-12 left-6">
            <div className="rounded-2xl border-4 border-[#120b2a] bg-white/5 p-1 shadow-2xl">
              <Avatar
                src={data.avatarUrl}
                alt={data.name}
                size={96}
                className="rounded-xl border-white/20"
              />
            </div>
          </div>

          {/* Status badge */}
          {data.isOpen !== undefined && (
            <div className="absolute right-6 top-6">
              <span
                className={`rounded-full px-4 py-2 text-xs font-medium backdrop-blur-md ${
                  data.isOpen
                    ? "bg-emerald-500/20 text-emerald-100 border border-emerald-400/30"
                    : "bg-white/10 text-white/60 border border-white/20"
                }`}
              >
                {data.isOpen ? "Abierto ahora" : "Cerrado"}
              </span>
            </div>
          )}
        </div>

        {/* Content */}
        <div className="px-6 pb-6 pt-16">
          <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
            <div className="flex-1">
              <div className="flex items-start gap-3">
                <div>
                  <h1 className="text-3xl font-bold">{data.name}</h1>
                  <div className="mt-2 flex items-center gap-2">
                    <StarRating rating={data.rating} animated />
                  </div>
                </div>
              </div>

              {/* Metadata */}
              <div className="mt-4 grid gap-2 text-sm text-white/70">
                <div className="flex items-center gap-2">
                  <MapPin size={16} className="text-fuchsia-400" />
                  <span>{data.address}, {data.city}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Phone size={16} className="text-fuchsia-400" />
                  <a href={`tel:${data.phone}`} className="hover:text-white transition">
                    {data.phone}
                  </a>
                </div>
                {data.fromPrice && (
                  <div className="flex items-center gap-2">
                    <Clock size={16} className="text-fuchsia-400" />
                    <span>Desde ${data.fromPrice.toLocaleString("es-CL")}</span>
                  </div>
                )}
              </div>

              {/* Features/Tags */}
              {data.features && data.features.length > 0 && (
                <div className="mt-4 flex flex-wrap gap-2">
                  {data.features.map((feature, idx) => (
                    <span
                      key={idx}
                      className="rounded-full border border-white/20 bg-white/5 px-3 py-1 text-xs text-white/80"
                    >
                      {feature}
                    </span>
                  ))}
                </div>
              )}
            </div>

            {/* CTA Buttons */}
            <div className="flex flex-wrap items-center gap-3">
              <Link href={`/calificar/establecimiento/${data.id}`} className="btn-primary">
                Calificar experiencia
              </Link>
              <button className="btn-secondary">
                Contactar
              </button>
            </div>
          </div>
        </div>
      </motion.div>

      {/* Gallery Section */}
      <motion.div custom={1} variants={fadeUp} className="card p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold">Galería</h2>
          <GalleryCounter count={gallery.length} />
        </div>
        <div className="mt-4 grid gap-3 grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {gallery.map((url, idx) => (
            <motion.button
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
      </motion.div>

      {/* Description Section */}
      <motion.div custom={2} variants={fadeUp} className="card p-6">
        <h2 className="text-xl font-semibold">Acerca del lugar</h2>
        <p className="mt-3 text-base leading-relaxed text-white/80">
          {data.description || "Espacio diseñado para tu comodidad y privacidad."}
        </p>
      </motion.div>

      {/* Lightbox */}
      {lightbox && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 grid place-items-center bg-black/90 p-4 backdrop-blur-sm"
          onClick={() => setLightbox(null)}
        >
          <div className="max-w-4xl w-full">
            <img
              src={lightbox}
              alt="Vista ampliada"
              className="w-full rounded-2xl border border-white/20 object-cover shadow-2xl"
            />
          </div>
        </motion.div>
      )}
    </motion.div>
  );
}
