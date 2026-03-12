"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Star, X, Circle } from "lucide-react";
import { resolveMediaUrl } from "../lib/api";

type PopupPromotion = {
  id: string;
  sortOrder: number;
  promoImageUrl: string;
  professional: {
    id: string;
    name: string;
    username?: string | null;
    isOnline?: boolean;
    rating: number | null;
    reviewsCount: number;
    profileUrl: string;
  };
};

const DISMISS_KEY = "uzeed_popup_promos_dismissed";
const DISMISS_COOLDOWN_MS = 1000 * 60 * 30;
const ROTATION_MS = 5000;

export default function PromoSidebarPopup({ promotions }: { promotions: PopupPromotion[] }) {
  const [index, setIndex] = useState(0);
  const [dismissed, setDismissed] = useState(false);
  const signature = useMemo(() => promotions.map((p) => p.id).join("|"), [promotions]);

  useEffect(() => {
    const raw = window.sessionStorage.getItem(DISMISS_KEY);
    if (!raw) return;
    let parsed: { when?: number; signature?: string } | null = null;
    try {
      parsed = JSON.parse(raw);
    } catch {
      parsed = { when: Number(raw) };
    }
    const when = Number(parsed?.when);
    const dismissedSignature = String(parsed?.signature || "");
    if (dismissedSignature && dismissedSignature !== signature) {
      setDismissed(false);
      return;
    }
    if (Number.isFinite(when) && Date.now() - when < DISMISS_COOLDOWN_MS) {
      setDismissed(true);
    }
  }, [signature]);

  useEffect(() => {
    if (dismissed || promotions.length <= 1) return;
    const id = window.setInterval(() => {
      setIndex((prev) => (prev + 1) % promotions.length);
    }, ROTATION_MS);
    return () => window.clearInterval(id);
  }, [dismissed, promotions.length]);

  useEffect(() => {
    setIndex(0);
  }, [promotions.length, signature]);

  const current = useMemo(() => promotions[index] ?? null, [promotions, index]);

  if (!current || dismissed) return null;

  const imageSrc = resolveMediaUrl(current.promoImageUrl) || current.promoImageUrl;
  if (!imageSrc) return null;

  return (
    <AnimatePresence mode="wait">
      <motion.aside
        key={current.id}
        initial={{ opacity: 0, x: 24, y: 12 }}
        animate={{ opacity: 1, x: 0, y: 0 }}
        exit={{ opacity: 0, x: 20, y: 8 }}
        transition={{ duration: 0.28 }}
        className="fixed bottom-4 right-4 z-40 w-[min(92vw,340px)] overflow-hidden rounded-3xl border border-fuchsia-300/20 bg-[#140d22]/90 shadow-2xl shadow-fuchsia-900/30 backdrop-blur-xl md:bottom-6 md:right-6"
      >
        <button
          type="button"
          aria-label="Cerrar promoción"
          onClick={() => {
            setDismissed(true);
            window.sessionStorage.setItem(DISMISS_KEY, JSON.stringify({ when: Date.now(), signature }));
          }}
          className="absolute right-3 top-3 z-10 rounded-full border border-white/25 bg-black/35 p-1.5 text-white/80 hover:bg-black/50"
        >
          <X className="h-4 w-4" />
        </button>

        <div className="relative">
          <img src={imageSrc} alt={current.professional.name} className="h-64 w-full object-cover" />
          <div className="absolute inset-0 bg-gradient-to-t from-[#120a1f] via-[#120a1f]/30 to-transparent" />
        </div>

        <div className="space-y-2 p-4">
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-fuchsia-200/80">Destacada</p>
          <div className="text-xl font-bold text-white">{current.professional.name}</div>
          <div className="flex items-center gap-2 text-xs text-white/80">
            <Circle className={`h-2.5 w-2.5 ${current.professional.isOnline ? "fill-emerald-400 text-emerald-400" : "fill-white/30 text-white/30"}`} />
            <span>{current.professional.isOnline ? "Disponible ahora" : "Consultar disponibilidad"}</span>
          </div>
          <div className="flex items-center gap-1 text-sm text-white/80">
            <Star className="h-4 w-4 fill-amber-400 text-amber-400" />
            {current.professional.rating != null ? (
              <span>
                {current.professional.rating.toFixed(1)}
                {current.professional.reviewsCount > 0 ? ` (${current.professional.reviewsCount})` : ""}
              </span>
            ) : (
              <span>Sin reseñas todavía</span>
            )}
          </div>

          <Link
            href={current.professional.profileUrl}
            className="mt-2 inline-flex w-full items-center justify-center rounded-xl bg-gradient-to-r from-fuchsia-600 to-violet-600 px-4 py-2.5 text-sm font-semibold text-white hover:brightness-110"
          >
            Ver perfil
          </Link>
        </div>
      </motion.aside>
    </AnimatePresence>
  );
}
