"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import { Crown, ShieldCheck, Star } from "lucide-react";

type BadgeType = "premium" | "verificada" | "quality";

const CONFIG: Record<
  BadgeType,
  {
    label: string;
    /** Texto de la píldora cuando se muestra con etiqueta. */
    pillLabel: string;
    tooltip: string;
    icon: typeof Crown;
    color: string;
    glow: string;
    idle: string;
    /** Estilo de la píldora: borde y fondo del color de la insignia. */
    pillClass: string;
  }
> = {
  premium: {
    label: "Premium",
    pillLabel: "Premium",
    tooltip: "Profesional Premium — acceso a beneficios exclusivos",
    icon: Crown,
    color: "text-amber-300",
    glow: "shadow-amber-400/40",
    idle: "uzeed-badge-shimmer-gold",
    pillClass: "border-amber-400/40 bg-amber-500/15 text-amber-200",
  },
  verificada: {
    label: "Verificada",
    pillLabel: "Verificada por UZEED",
    tooltip: "Perfil verificado por UZEED",
    icon: ShieldCheck,
    color: "text-emerald-300",
    glow: "shadow-emerald-400/40",
    idle: "uzeed-badge-shimmer-emerald",
    pillClass: "border-emerald-400/40 bg-emerald-500/15 text-emerald-200",
  },
  quality: {
    label: "Calidad",
    pillLabel: "Calidad",
    tooltip: "Perfil evaluado por calidad",
    icon: Star,
    color: "text-fuchsia-300",
    glow: "shadow-fuchsia-400/40",
    idle: "uzeed-badge-shimmer-fuchsia",
    pillClass: "border-fuchsia-400/40 bg-fuchsia-500/15 text-fuchsia-200",
  },
};

interface StatusBadgeIconProps {
  type: BadgeType;
  /** Icon size class, e.g. "h-3.5 w-3.5". Defaults to "h-3.5 w-3.5" */
  size?: string;
  /**
   * Muestra la insignia como píldora con texto en vez de sólo el icono. La
   * verificación es el plus del perfil: donde hay espacio (ficha, vista
   * previa) tiene que leerse sin depender de que alguien toque el icono.
   */
  showLabel?: boolean;
  /** Clase extra para la píldora (tamaño de texto, márgenes). */
  className?: string;
}

export default function StatusBadgeIcon({
  type,
  size = "h-3.5 w-3.5",
  showLabel = false,
  className = "",
}: StatusBadgeIconProps) {
  const { tooltip, icon: Icon, color, glow, idle, pillLabel, pillClass } = CONFIG[type];
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

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  if (showLabel) {
    return (
      <span
        title={tooltip}
        className={[
          "inline-flex shrink-0 items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-bold uppercase tracking-wide",
          pillClass,
          className,
        ].join(" ")}
      >
        <Icon className={[size, color].join(" ")} aria-hidden />
        {pillLabel}
      </span>
    );
  }

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
