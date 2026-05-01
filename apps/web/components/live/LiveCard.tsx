"use client";

import { type MouseEvent, type ReactNode } from "react";
import Link from "next/link";
import { Clock, Radio, Sparkles, User, Users } from "lucide-react";

import { resolveMediaUrl } from "../../lib/api";
import type { UnifiedLiveCard } from "./types";

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "ahora";
  if (mins < 60) return `${mins} min`;
  const hours = Math.floor(mins / 60);
  return `${hours}h`;
}

type Variant =
  | "grid" // 16:9 thumb, info debajo (live grid + recomendaciones desktop)
  | "row" // 3:4 vertical para fila horizontal en home / mobile
  | "compact"; // tarjeta angosta con thumb cuadrado (sidebar reco)

export interface LiveCardProps {
  data: UnifiedLiveCard;
  variant?: Variant;
  /** Cuando el caller quiere interceptar el click (modal en desktop, etc.) */
  onClick?: (e: MouseEvent<HTMLAnchorElement>, data: UnifiedLiveCard) => void;
  /** Mostrar leyenda "Exclusivo Uzeed" sobre cards propias */
  showUzeedBadge?: boolean;
  /** Texto auxiliar opcional debajo del nombre (sustituye al subtitle) */
  trailing?: ReactNode;
}

/**
 * Card unificada de "en vivo".
 * - Webrtc propio: muestra avatar + nombre + duración del stream.
 * - Externo: muestra HD/NEW/edad+país, sin avatar.
 * Ambas comparten dimensiones, paleta violeta y badges para que el
 * visitante no las distinga a primera vista (excepto por "Exclusivo Uzeed").
 */
export default function LiveCard({
  data,
  variant = "grid",
  onClick,
  showUzeedBadge = true,
  trailing,
}: LiveCardProps) {
  const thumb = data.thumbnailUrl
    ? resolveMediaUrl(data.thumbnailUrl) ?? data.thumbnailUrl
    : null;

  const thumbAspect = variant === "row" ? "aspect-[3/4]" : "aspect-video";
  const wrapperWidth =
    variant === "row"
      ? "w-40 sm:w-44"
      : variant === "compact"
      ? "w-full"
      : "w-full";

  const isUzeed = data.source === "uzeed";

  return (
    <Link
      href={data.href}
      onClick={(e) => onClick?.(e, data)}
      className={`group block transition-all duration-200 ${wrapperWidth}`}
      data-source={data.source}
      data-username={data.id}
    >
      <div
        className={`relative ${thumbAspect} overflow-hidden rounded-xl border border-fuchsia-500/10 bg-gradient-to-br from-fuchsia-500/[0.06] to-violet-500/[0.04]`}
      >
        {thumb ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={thumb}
            alt=""
            loading="lazy"
            decoding="async"
            referrerPolicy="no-referrer"
            className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.03]"
            onError={(e) => {
              const el = e.currentTarget as HTMLImageElement;
              el.style.visibility = "hidden";
            }}
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center">
            <Radio className="h-10 w-10 text-fuchsia-400/15" />
          </div>
        )}

        <div className="absolute inset-0 bg-black/0 transition-colors duration-200 group-hover:bg-black/10" />

        {/* LIVE — top left */}
        <div className="absolute left-2 top-2 flex items-center gap-1 rounded bg-red-600 px-1.5 py-0.5">
          <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-white" />
          <span className="text-[10px] font-bold tracking-wide text-white">
            EN VIVO
          </span>
        </div>

        {/* Top-right badges */}
        <div className="absolute right-2 top-2 flex items-center gap-1">
          {isUzeed && showUzeedBadge && (
            <span className="flex items-center gap-1 rounded bg-black/55 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wider text-fuchsia-200 backdrop-blur-sm">
              <Sparkles className="h-2.5 w-2.5 text-fuchsia-300" /> Exclusivo Uzeed
            </span>
          )}
          {data.isHd && (
            <span className="rounded bg-black/55 px-1.5 py-0.5 text-[9px] font-bold tracking-wider text-white/90 backdrop-blur-sm">
              HD
            </span>
          )}
          {data.isNew && !isUzeed && (
            <span className="rounded bg-fuchsia-500/85 px-1.5 py-0.5 text-[9px] font-bold tracking-wider text-white">
              NUEVA
            </span>
          )}
        </div>

        {/* Viewers — bottom left */}
        <div className="absolute bottom-2 left-2 flex items-center gap-1 rounded bg-black/70 px-1.5 py-0.5">
          <Users className="h-2.5 w-2.5 text-white/80" />
          <span className="text-[10px] font-medium tabular-nums text-white/90">
            {data.viewerCount.toLocaleString("es-CL")}
          </span>
        </div>

        {/* Duración (uzeed) — bottom right */}
        {isUzeed && data.startedAt && (
          <div className="absolute bottom-2 right-2 flex items-center gap-1 rounded bg-black/70 px-1.5 py-0.5">
            <Clock className="h-2.5 w-2.5 text-white/60" />
            <span className="text-[10px] text-white/70">{timeAgo(data.startedAt)}</span>
          </div>
        )}

        {/* Para variant=row, ponemos el nombre superpuesto al thumb */}
        {variant === "row" && (
          <div className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/85 via-black/40 to-transparent p-2.5 pt-8">
            <p className="truncate text-[12px] font-bold text-white">
              {data.displayName}
            </p>
            {data.subtitle && (
              <p className="truncate text-[10px] text-white/55">
                {data.subtitle}
              </p>
            )}
          </div>
        )}
      </div>

      {/* Info debajo del thumb (variant grid/compact) */}
      {variant !== "row" && (
        <div className="mt-2.5 flex gap-2.5">
          {isUzeed && data.avatarUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={resolveMediaUrl(data.avatarUrl) ?? data.avatarUrl}
              alt=""
              className="h-9 w-9 shrink-0 rounded-full border border-white/10 object-cover"
              loading="lazy"
              decoding="async"
            />
          ) : (
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-fuchsia-500/15 bg-fuchsia-500/[0.06]">
              <User className="h-4 w-4 text-fuchsia-300/60" />
            </div>
          )}
          <div className="min-w-0 flex-1">
            <p className="truncate text-[13px] font-semibold text-white/90 transition-colors group-hover:text-fuchsia-300">
              {data.displayName}
            </p>
            {trailing ? (
              <div className="mt-0.5 truncate text-[11px] text-white/45">{trailing}</div>
            ) : data.subtitle ? (
              <p className="truncate text-[11px] text-white/45">{data.subtitle}</p>
            ) : null}
          </div>
        </div>
      )}
    </Link>
  );
}
