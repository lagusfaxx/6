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
const ROTATION_MS = 5000;
const APPEAR_DELAY_MS = 5000;

export default function PromoSidebarPopup({ promotions }: { promotions: PopupPromotion[] }) {
  const [index, setIndex] = useState(0);
  const [dismissed, setDismissed] = useState(false);
  const [isVisible, setIsVisible] = useState(false);
  const [isHovered, setIsHovered] = useState(false);
  const [isInteracting, setIsInteracting] = useState(false);
  const validPromotions = useMemo(
    () => promotions.filter((p) => Boolean((resolveMediaUrl(p.promoImageUrl) || p.promoImageUrl || "").trim())),
    [promotions],
  );

  useEffect(() => {
    const raw = window.sessionStorage.getItem(DISMISS_KEY);
    if (raw === "1") {
      setDismissed(true);
      return;
    }

    const timeout = window.setTimeout(() => setIsVisible(true), APPEAR_DELAY_MS);
    return () => window.clearTimeout(timeout);
  }, []);

  useEffect(() => {
    if (dismissed || !isVisible || isHovered || isInteracting || validPromotions.length <= 1) return;
    const id = window.setInterval(() => {
      setIndex((prev) => (prev + 1) % validPromotions.length);
    }, ROTATION_MS);
    return () => window.clearInterval(id);
  }, [dismissed, isVisible, isHovered, isInteracting, validPromotions.length]);

  useEffect(() => {
    setIndex(0);
  }, [validPromotions.length]);

  const current = useMemo(() => validPromotions[index] ?? null, [validPromotions, index]);

  if (!current || dismissed || !isVisible) return null;

  const imageSrc = resolveMediaUrl(current.promoImageUrl) || current.promoImageUrl;
  if (!imageSrc) return null;

  return (
    <AnimatePresence mode="wait">
      <motion.aside
        key={current.id}
        initial={{ opacity: 0, x: 24, y: 12 }}
        animate={{ opacity: 1, x: 0, y: 0 }}
        exit={{ opacity: 0, x: 20, y: 8 }}
        transition={{ duration: 0.32, ease: "easeOut" }}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        onPointerDown={() => setIsInteracting(true)}
        onFocusCapture={() => setIsInteracting(true)}
        className="fixed left-1/2 top-[85px] z-40 w-[90vw] max-w-[320px] -translate-x-1/2 overflow-hidden rounded-2xl border border-white/10 bg-[rgba(25,20,45,0.65)] shadow-[0_8px_30px_rgba(0,0,0,0.35)] backdrop-blur-[12px] md:left-auto md:right-5 md:top-[110px] md:w-[250px] md:max-w-[260px] md:translate-x-0"
      >
        <button
          type="button"
          aria-label="Cerrar promoción"
          onClick={() => {
            setDismissed(true);
            window.sessionStorage.setItem(DISMISS_KEY, "1");
          }}
          className="absolute right-1.5 top-1.5 z-20 inline-flex h-7 w-7 items-center justify-center rounded-full border border-white/15 bg-black/45 text-white shadow-sm transition hover:bg-black/70 active:scale-95"
        >
          <X className="h-3.5 w-3.5" />
        </button>

        <div className="flex h-[98px] items-center gap-2.5 p-2.5 md:h-auto md:items-start md:gap-3 md:p-3">
          <img src={imageSrc} alt={current.professional.name} className="h-[76px] w-[58px] shrink-0 rounded-[10px] object-cover md:h-[80px] md:w-[60px]" />

          <div className="min-w-0 flex-1 space-y-1">
            <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-fuchsia-200/80">Destacada</p>
            <div className="truncate text-sm font-bold text-white">{current.professional.name}</div>
            <div className="flex items-center gap-1.5 text-[11px] text-white/80">
              <Circle className={`h-2.5 w-2.5 ${current.professional.isOnline ? "fill-emerald-400 text-emerald-400" : "fill-white/30 text-white/30"}`} />
              <span>{current.professional.isOnline ? "Disponible" : "Consultar disponibilidad"}</span>
            </div>
            <div className="flex items-center gap-1 text-[11px] text-white/80">
              <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-400" />
              {current.professional.rating != null && current.professional.reviewsCount > 0 ? (
              <span>
                {current.professional.rating.toFixed(1)}
                {` (${current.professional.reviewsCount})`}
              </span>
            ) : (
              <span>Sin reseñas todavía</span>
            )}
            </div>

            <Link
              href={current.professional.profileUrl}
              onClick={() => setIsInteracting(true)}
              className="mt-1 inline-flex h-[30px] items-center justify-center rounded-full bg-gradient-to-r from-fuchsia-600 to-violet-600 px-3 text-[13px] font-semibold text-white transition hover:brightness-110"
            >
              Ver perfil
            </Link>
          </div>
        </div>
      </motion.aside>
    </AnimatePresence>
  );
}
