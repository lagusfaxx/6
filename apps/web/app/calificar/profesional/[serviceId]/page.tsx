"use client";

import { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { Heart, MessageSquare, Send } from "lucide-react";
import { apiFetch } from "../../../../lib/api";

const HEART_VALUES = [1, 2, 3, 4, 5];

const QUICK_TAGS = [
  "Puntual", "Amable", "Discreta", "Tal cual las fotos",
  "Buena conversación", "Limpia", "Profesional", "Recomendable",
] as const;

export default function RateProfessionalPage() {
  const params = useParams();
  const router = useRouter();
  const serviceId = String(params.serviceId);
  const [rating, setRating] = useState(0);
  const [hoveredRating, setHoveredRating] = useState(0);
  const [comment, setComment] = useState("");
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  function toggleTag(tag: string) {
    setSelectedTags((prev) =>
      prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag],
    );
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (rating === 0) return;
    setSaving(true);
    try {
      await apiFetch(`/services/${serviceId}/review`, {
        method: "POST",
        body: JSON.stringify({ hearts: rating, comment }),
      });
      if (selectedTags.length > 0) {
        await apiFetch(`/services/${serviceId}/review-tags`, {
          method: "POST",
          body: JSON.stringify({ tags: selectedTags }),
        }).catch(() => {});
      }
      setSubmitted(true);
      setTimeout(() => router.push("/servicios"), 1500);
    } finally {
      setSaving(false);
    }
  }

  if (submitted) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="text-center"
        >
          <div className="mx-auto mb-4 flex h-20 w-20 items-center justify-center rounded-full bg-gradient-to-br from-rose-500/30 to-fuchsia-500/30 text-4xl">
            <Heart className="h-10 w-10 text-rose-400" />
          </div>
          <h2 className="text-2xl font-semibold">Gracias por tu calificación</h2>
          <p className="mt-2 text-sm text-white/60">Redirigiendo...</p>
        </motion.div>
      </div>
    );
  }

  const displayRating = hoveredRating || rating;

  return (
    <div className="mx-auto w-full max-w-lg space-y-5 pb-10">
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        className="rounded-2xl border border-white/10 bg-white/[0.03] p-6 text-center backdrop-blur-md"
      >
        <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-rose-500/25 to-fuchsia-500/25">
          <Heart className="h-7 w-7 text-rose-400" />
        </div>
        <h1 className="text-2xl font-semibold">Calificar profesional</h1>
        <p className="mt-2 text-sm text-white/60">
          Tu opinión ayuda a la comunidad a encontrar mejores experiencias.
        </p>
      </motion.div>

      <motion.form
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        onSubmit={handleSubmit}
        className="space-y-5"
      >
        {/* Hearts */}
        <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-6 text-center">
          <p className="mb-4 text-sm font-medium text-white/70">¿Cómo fue tu experiencia?</p>
          <div className="flex justify-center gap-3">
            {HEART_VALUES.map((value) => (
              <button
                key={value}
                type="button"
                onClick={() => setRating(value)}
                onMouseEnter={() => setHoveredRating(value)}
                onMouseLeave={() => setHoveredRating(0)}
                className="group transition-transform hover:scale-110"
              >
                <Heart
                  className={`h-10 w-10 transition-all ${
                    value <= displayRating
                      ? "fill-rose-500 text-rose-500 drop-shadow-[0_0_8px_rgba(244,63,94,0.5)]"
                      : "text-white/20 group-hover:text-white/40"
                  }`}
                />
              </button>
            ))}
          </div>
          {displayRating > 0 && (
            <p className="mt-3 text-sm text-white/50">
              {displayRating === 1
                ? "Mala experiencia"
                : displayRating === 2
                  ? "Regular"
                  : displayRating === 3
                    ? "Buena"
                    : displayRating === 4
                      ? "Muy buena"
                      : "Excelente"}
            </p>
          )}
        </div>

        {/* Quick tags */}
        <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
          <p className="mb-3 text-sm font-medium text-white/70">Etiquetas rápidas (opcional)</p>
          <div className="flex flex-wrap gap-2">
            {QUICK_TAGS.map((tag) => (
              <button
                key={tag}
                type="button"
                onClick={() => toggleTag(tag)}
                className={`rounded-full border px-3 py-1.5 text-xs font-medium transition ${
                  selectedTags.includes(tag)
                    ? "border-fuchsia-400/50 bg-fuchsia-500/20 text-fuchsia-100"
                    : "border-white/15 bg-white/5 text-white/60 hover:bg-white/10"
                }`}
              >
                {tag}
              </button>
            ))}
          </div>
        </div>

        {/* Comment */}
        <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
          <div className="mb-3 flex items-center gap-2">
            <MessageSquare className="h-4 w-4 text-white/50" />
            <p className="text-sm font-medium text-white/70">Comentario (opcional)</p>
          </div>
          <textarea
            className="w-full resize-none rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white/90 placeholder-white/30 outline-none transition focus:border-fuchsia-500/40"
            rows={4}
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            placeholder="Comparte tu experiencia con la comunidad..."
          />
        </div>

        {/* Submit */}
        <button
          type="submit"
          disabled={saving || rating === 0}
          className="flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-rose-600 to-fuchsia-600 px-5 py-3.5 text-sm font-medium text-white transition-all hover:shadow-[0_0_24px_rgba(244,63,94,0.3)] disabled:cursor-not-allowed disabled:opacity-50"
        >
          <Send className="h-4 w-4" />
          {saving ? "Enviando..." : "Enviar calificación"}
        </button>
      </motion.form>
    </div>
  );
}
