"use client";

type UserLevel = "SILVER" | "GOLD" | "DIAMOND" | "PLATINUM" | "PREMIUM";

type UserLevelBadgeProps = {
  level?: UserLevel | null;
  className?: string;
};

function resolveBadge(level?: UserLevel | null) {
  if (level === "DIAMOND" || level === "PLATINUM" || level === "PREMIUM") {
    return {
      label: "💎 Platino",
      className:
        "border-cyan-200/40 bg-cyan-400/20 text-cyan-50 shadow-[0_0_12px_rgba(34,211,238,0.15)]",
    };
  }
  if (level === "GOLD") {
    return {
      label: "🥇 Gold",
      className:
        "border-amber-200/40 bg-amber-400/20 text-amber-50 shadow-[0_0_8px_rgba(251,191,36,0.12)]",
    };
  }
  return {
    label: "🥈 Silver",
    className: "border-slate-200/30 bg-slate-300/15 text-slate-100",
  };
}

export default function UserLevelBadge({
  level,
  className,
}: UserLevelBadgeProps) {
  const badge = resolveBadge(level);
  return (
    <span
      className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold ${badge.className} ${className || ""}`}
    >
      {badge.label}
    </span>
  );
}
