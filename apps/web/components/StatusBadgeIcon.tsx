"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import { Crown, ShieldCheck } from "lucide-react";

type BadgeType = "premium" | "verificada";

const CONFIG: Record<
  BadgeType,
  { label: string; tooltip: string; icon: typeof Crown; color: string; glow: string; idle: string }
> = {
  premium: {
    label: "Premium",
    tooltip: "Profesional Premium — acceso a beneficios exclusivos",
    icon: Crown,
    color: "text-amber-300",
    glow: "shadow-amber-400/40",
    idle: "uzeed-badge-shimmer-gold",
  },
  verificada: {
    label: "Verificada",
    tooltip: "Identidad verificada por UZEED",
    icon: ShieldCheck,
    color: "text-emerald-300",
    glow: "shadow-emerald-400/40",
    idle: "uzeed-badge-shimmer-emerald",
  },
};

interface StatusBadgeIconProps {
  type: BadgeType;
  /** Icon size class, e.g. "h-3.5 w-3.5". Defaults to "h-3.5 w-3.5" */
  size?: string;
}

export default function StatusBadgeIcon({ type, size = "h-3.5 w-3.5" }: StatusBadgeIconProps) {
  const { tooltip, icon: Icon, color, glow, idle } = CONFIG[type];
  const [showTooltip, setShowTooltip] = useState(false);
  const [tapped, setTapped] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const tooltipRef = useRef<HTMLSpanElement>(null);

  const handleInteraction = useCallback(
    (e: React.MouseEvent | React.TouchEvent) => {
      e.stopPropagation();
      e.preventDefault();
      setTapped(true);
      setShowTooltip(true);
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => {
        setShowTooltip(false);
        setTapped(false);
      }, 2200);
    },
    [],
  );

  /* Dismiss on outside click */
  useEffect(() => {
    if (!showTooltip) return;
    const handler = () => {
      setShowTooltip(false);
      setTapped(false);
      if (timerRef.current) clearTimeout(timerRef.current);
    };
    document.addEventListener("click", handler, { capture: true, once: true });
    return () => document.removeEventListener("click", handler, { capture: true });
  }, [showTooltip]);

  useEffect(() => () => { if (timerRef.current) clearTimeout(timerRef.current); }, []);

  return (
    <span className="relative inline-flex items-center">
      <button
        type="button"
        aria-label={CONFIG[type].label}
        onClick={handleInteraction}
        className={[
          "relative inline-flex cursor-pointer items-center justify-center rounded-full p-0 transition-transform duration-200",
          tapped ? "scale-125" : "hover:scale-110",
          idle,
        ].join(" ")}
      >
        <Icon
          className={[
            size,
            color,
            `drop-shadow-[0_0_4px] ${glow}`,
          ].join(" ")}
        />
      </button>

      {showTooltip && (
        <span
          ref={tooltipRef}
          role="tooltip"
          className="pointer-events-none absolute bottom-full left-1/2 z-[100] mb-1.5 -translate-x-1/2 whitespace-nowrap rounded-lg border border-white/10 bg-[#1a1030]/95 px-2.5 py-1 text-[10px] font-medium text-white/90 shadow-lg backdrop-blur-md animate-in fade-in slide-in-from-bottom-1 duration-150"
        >
          {tooltip}
        </span>
      )}
    </span>
  );
}
