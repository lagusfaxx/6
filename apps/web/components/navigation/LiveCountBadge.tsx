"use client";

import { useLiveCount } from "../../hooks/useLiveCount";

interface LiveCountBadgeProps {
  variant?: "inline" | "stacked";
}

export function LiveCountBadge({ variant = "inline" }: LiveCountBadgeProps) {
  const count = useLiveCount();

  if (count === null || count === 0) return null;

  const formatted = count >= 100 ? `+${Math.floor(count / 10) * 10}` : `+${count}`;

  if (variant === "stacked") {
    return (
      <span className="mt-0.5 flex items-center gap-1 text-[10px] leading-none text-red-400">
        <span className="relative flex h-1.5 w-1.5">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-400 opacity-75" />
          <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-red-500" />
        </span>
        <span className="font-medium">{formatted} en vivo</span>
      </span>
    );
  }

  return (
    <span className="ml-auto flex items-center gap-1.5 text-xs">
      <span className="relative flex h-2 w-2">
        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-400 opacity-75" />
        <span className="relative inline-flex h-2 w-2 rounded-full bg-red-500" />
      </span>
      <span className="font-medium text-red-400">{formatted}</span>
    </span>
  );
}
