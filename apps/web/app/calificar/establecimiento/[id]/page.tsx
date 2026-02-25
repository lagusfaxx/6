"use client";

import { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { Star, MessageSquare, Send } from "lucide-react";
import { apiFetch } from "../../../../lib/api";

const STAR_VALUES = [1, 2, 3, 4, 5];

export default function RateEstablishmentPage() {
  const params = useParams();
  const router = useRouter();
  const id = String(params.id);
  const [rating, setRating] = useState(0);
  const [hoveredRating, setHoveredRating] = useState(0);
  const [comment, setComment] = useState("");
  const [saving, setSaving] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (rating === 0) return;
    setSaving(true);
    try {
      await apiFetch(`/establishments/${id}/reviews`, {
        method: "POST",
        body: JSON.stringify({ stars: rating, comment }),
      });
      setSubmitted(true);
      setTimeout(() => router.push(`/establecimiento/${id}`), 1500);
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
          <div className="mx-auto mb-4 flex h-20 w-20 items-center justify-center rounded-full bg-gradient-to-br from-amber-500/30 to-orange-500/30 text-4xl">
            <Star className="h-10 w-10 fill-amber-400 text-amber-400" />
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
        <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-amber-500/25 to-orange-500/25">
          <Star className="h-7 w-7 text-amber-400" />
        </div>
        <h1 className="text-2xl font-semibold">Calificar establecimiento</h1>
        <p className="mt-2 text-sm text-white/60">
          Tu reseña ayuda a otros usuarios a elegir mejor.
        </p>
      </motion.div>

      <motion.form
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        onSubmit={handleSubmit}
        className="space-y-5"
      >
        {/* Stars */}
        <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-6 text-center">
          <p className="mb-4 text-sm font-medium text-white/70">¿Cómo fue tu visita?</p>
          <div className="flex justify-center gap-3">
            {STAR_VALUES.map((value) => (
              <button
                key={value}
                type="button"
                onClick={() => setRating(value)}
                onMouseEnter={() => setHoveredRating(value)}
                onMouseLeave={() => setHoveredRating(0)}
                className="group transition-transform hover:scale-110"
              >
                <Star
                  className={`h-10 w-10 transition-all ${
                    value <= displayRating
                      ? "fill-amber-400 text-amber-400 drop-shadow-[0_0_8px_rgba(251,191,36,0.5)]"
                      : "text-white/20 group-hover:text-white/40"
                  }`}
                />
              </button>
            ))}
          </div>
          {displayRating > 0 && (
            <p className="mt-3 text-sm text-white/50">
              {displayRating === 1
                ? "Malo"
                : displayRating === 2
                  ? "Regular"
                  : displayRating === 3
                    ? "Bueno"
                    : displayRating === 4
                      ? "Muy bueno"
                      : "Excelente"}
            </p>
          )}
        </div>

        {/* Comment */}
        <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
          <div className="mb-3 flex items-center gap-2">
            <MessageSquare className="h-4 w-4 text-white/50" />
            <p className="text-sm font-medium text-white/70">Comentario (opcional)</p>
          </div>
          <textarea
            className="w-full resize-none rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white/90 placeholder-white/30 outline-none transition focus:border-amber-500/40"
            rows={4}
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            placeholder="Describe tu visita, el ambiente, la limpieza..."
          />
        </div>

        {/* Submit */}
        <button
          type="submit"
          disabled={saving || rating === 0}
          className="flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-amber-600 to-orange-600 px-5 py-3.5 text-sm font-medium text-white transition-all hover:shadow-[0_0_24px_rgba(251,191,36,0.3)] disabled:cursor-not-allowed disabled:opacity-50"
        >
          <Send className="h-4 w-4" />
          {saving ? "Enviando..." : "Enviar calificación"}
        </button>
      </motion.form>
    </div>
  );
}
