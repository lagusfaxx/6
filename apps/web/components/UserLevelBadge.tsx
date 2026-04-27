"use client";

import { Crown, Gem, Sparkles } from "lucide-react";
import type { ComponentType, SVGProps } from "react";

type UserLevel = "SILVER" | "GOLD" | "DIAMOND";

type UserLevelBadgeProps = {
  level?: UserLevel | null;
  className?: string;
};

type BadgeStyle = {
  label: string;
  Icon: ComponentType<SVGProps<SVGSVGElement>>;
  iconClass: string;
  pillClass: string;
  textClass: string;
};

function resolveBadge(level?: UserLevel | null): BadgeStyle {
  if (level === "DIAMOND") {
    return {
      label: "Diamond",
      Icon: Gem,
      iconClass: "text-white drop-shadow-[0_0_2px_rgba(255,255,255,0.9)]",
      pillClass:
        "bg-gradient-to-b from-cyan-200 via-sky-400 to-sky-600 ring-1 ring-inset ring-white/40 shadow-[0_2px_8px_rgba(56,189,248,0.45)]",
      textClass: "text-white drop-shadow-[0_1px_1px_rgba(0,0,0,0.45)]",
    };
  }
  if (level === "GOLD") {
    return {
      label: "Gold",
      Icon: Crown,
      iconClass: "text-amber-900",
      pillClass:
        "bg-gradient-to-b from-yellow-200 via-amber-400 to-amber-600 ring-1 ring-inset ring-amber-100/60 shadow-[0_2px_8px_rgba(245,158,11,0.5)]",
      textClass: "text-amber-950",
    };
  }
  return {
    label: "Silver",
    Icon: Sparkles,
    iconClass: "text-slate-700",
    pillClass:
      "bg-gradient-to-b from-white via-zinc-200 to-slate-400 ring-1 ring-inset ring-white/70 shadow-[0_2px_8px_rgba(148,163,184,0.45)]",
    textClass: "text-slate-800",
  };
}

export default function UserLevelBadge({
  level,
  className,
}: UserLevelBadgeProps) {
  const badge = resolveBadge(level);
  const { Icon } = badge;
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-wide ${badge.pillClass} ${badge.textClass} ${className || ""}`}
    >
      <Icon className={`h-3 w-3 ${badge.iconClass}`} aria-hidden="true" />
      {badge.label}
    </span>
  );
}
