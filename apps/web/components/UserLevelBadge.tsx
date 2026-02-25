"use client";

type UserLevel = "SILVER" | "GOLD" | "DIAMOND";

type UserLevelBadgeProps = {
  level?: UserLevel | null;
  className?: string;
};

function resolveBadge(level?: UserLevel | null) {
  if (level === "DIAMOND") {
    return {
      label: "💎 Diamond",
      className: "border-cyan-200/40 bg-cyan-400/20 text-cyan-50",
    };
  }
  if (level === "GOLD") {
    return {
      label: "🥇 Gold",
      className: "border-amber-200/40 bg-amber-400/20 text-amber-50",
    };
  }
  return {
    label: "⭐ Silver",
    className: "border-violet-300/40 bg-violet-500/20 text-violet-100 shadow-[0_0_8px_rgba(139,92,246,0.25)]",
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
