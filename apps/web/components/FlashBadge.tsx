"use client";

import { useEffect, useState } from "react";
import { Timer, Zap } from "lucide-react";

/*
 * Sello "Destacada" con contador, al estilo de las ofertas relámpago: lo lleva
 * el perfil con el boost Destacada vigente (comprado o regalado desde el
 * admin). Se ve en las tarjetas y en la ficha, y cuenta hacia atrás hasta que
 * termina; al llegar a cero desaparece solo.
 */

function remaining(endsAt: string): number {
  return Math.max(0, Date.parse(endsAt) - Date.now());
}

function format(ms: number): string {
  const total = Math.floor(ms / 1000);
  const d = Math.floor(total / 86400);
  const h = Math.floor((total % 86400) / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const pad = (n: number) => String(n).padStart(2, "0");
  return d > 0 ? `${d}d ${pad(h)}:${pad(m)}` : `${pad(h)}:${pad(m)}:${pad(s)}`;
}

export default function FlashBadge({
  endsAt,
  size = "sm",
  className = "",
}: {
  endsAt: string | null | undefined;
  /** band: franja de lado a lado para el borde superior de una tarjeta. */
  size?: "sm" | "md" | "band";
  className?: string;
}) {
  const [left, setLeft] = useState(() => (endsAt ? remaining(endsAt) : 0));

  useEffect(() => {
    if (!endsAt) return;
    setLeft(remaining(endsAt));
    const id = window.setInterval(() => setLeft(remaining(endsAt)), 1000);
    return () => window.clearInterval(id);
  }, [endsAt]);

  if (!endsAt || left <= 0) return null;

  if (size === "band") {
    return (
      <span
        className={`uzeed-flash relative flex w-full items-center justify-between gap-2 overflow-hidden bg-gradient-to-r from-yellow-300 via-amber-400 to-orange-500 px-2.5 py-[5px] text-[10px] font-extrabold uppercase leading-none text-black ${className}`}
        aria-label={`Destacada, termina en ${format(left)}`}
      >
        <span className="flex items-center gap-1 whitespace-nowrap">
          <Zap className="h-3 w-3 fill-black" />
          Destacada
        </span>
        <span className="flex items-center gap-1 whitespace-nowrap tabular-nums normal-case tracking-wide">
          <Timer className="h-3 w-3" />
          {format(left)}
        </span>
      </span>
    );
  }

  const md = size === "md";
  return (
    <span
      className={`uzeed-flash relative inline-flex items-stretch overflow-hidden rounded-md font-extrabold uppercase leading-none shadow-[0_4px_14px_-2px_rgba(251,146,60,0.65)] ${
        md ? "text-xs" : "text-[10px]"
      } ${className}`}
      aria-label={`Destacada, termina en ${format(left)}`}
    >
      <span
        className={`flex items-center gap-1 bg-gradient-to-r from-yellow-300 via-amber-400 to-orange-500 text-black ${
          md ? "px-2.5 py-1.5" : "px-1.5 py-1"
        }`}
      >
        <Zap className={md ? "h-3.5 w-3.5 fill-black" : "h-3 w-3 fill-black"} />
        Destacada
      </span>
      <span
        className={`flex items-center bg-black/80 tabular-nums tracking-wide text-amber-300 ${md ? "px-2.5" : "px-1.5"}`}
      >
        {format(left)}
      </span>
    </span>
  );
}
