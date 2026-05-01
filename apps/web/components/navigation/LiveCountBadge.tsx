"use client";

import { useLiveCount } from "../../hooks/useLiveCount";

interface LiveCountBadgeProps {
  variant?: "inline" | "dot";
}

export function LiveCountBadge({ variant = "inline" }: LiveCountBadgeProps) {
  const count = useLiveCount();

  if (count === null || count === 0) return null;

  const aria = `${count} transmisiones en vivo`;

  if (variant === "dot") {
    const display = count >= 100 ? "99+" : String(count);
    return (
      <span
        aria-label={aria}
        className="absolute -right-1 -top-1 flex h-4 min-w-[16px] items-center justify-center"
      >
        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-400 opacity-60" />
        <span className="relative inline-flex h-4 min-w-[16px] items-center justify-center rounded-full bg-red-500 px-1 text-[9px] font-bold leading-none text-white shadow-[0_0_8px_rgba(239,68,68,0.6)]">
          {display}
        </span>
      </span>
    );
  }

  const display = count >= 100 ? "99+" : `+${count}`;
  return (
    <span aria-label={aria} className="ml-auto flex items-center gap-1.5 text-xs">
      <span className="relative flex h-2 w-2">
        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-400 opacity-75" />
        <span className="relative inline-flex h-2 w-2 rounded-full bg-red-500" />
      </span>
      <span className="font-medium text-red-400">{display}</span>
    </span>
  );
}
