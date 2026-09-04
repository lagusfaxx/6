"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ChevronRight, Crown, Gem } from "lucide-react";
import { apiFetch } from "../../lib/api";
import DestacadaCard, {
  type DestacadaCardProfile,
  type FeaturedStoryMedia,
} from "./DestacadaCard";

export type DestacadaProfile = DestacadaCardProfile;

/**
 * Rango del perfil. Antes el home mezclaba Diamond y Gold en una sola sección
 * llamada "Destacadas": el nombre no decía nada y, sobre todo, escondía que
 * son dos planes distintos. Ahora cada rango tiene su propia sección, Diamond
 * primero, para que la diferencia entre planes se vea desde el inicio.
 */
export type ProfileTier = "DIAMOND" | "GOLD";

type TierTheme = {
  title: string;
  subtitle: string;
  Icon: typeof Crown;
  iconClass: string;
  /** Píldora con el nombre del plan, junto al título. */
  pillClass: string;
  /** Halo detrás del encabezado, para que la sección se lea como un bloque. */
  glowClass: string;
  ctaClass: string;
};

const TIER_THEMES: Record<ProfileTier, TierTheme> = {
  DIAMOND: {
    title: "Diamond",
    subtitle: "Máximo nivel",
    Icon: Gem,
    iconClass: "text-cyan-300",
    pillClass:
      "border-cyan-400/30 bg-gradient-to-r from-cyan-500/20 to-sky-500/10 text-cyan-200",
    glowClass: "from-cyan-500/[0.10] via-sky-500/[0.05] to-transparent",
    ctaClass: "text-cyan-300 hover:text-cyan-200",
  },
  GOLD: {
    title: "Gold",
    subtitle: "Plan destacado",
    Icon: Crown,
    iconClass: "text-amber-300",
    pillClass:
      "border-amber-400/30 bg-gradient-to-r from-amber-500/20 to-yellow-500/10 text-amber-200",
    glowClass: "from-amber-500/[0.10] via-yellow-500/[0.05] to-transparent",
    ctaClass: "text-amber-300 hover:text-amber-200",
  },
};

type Props = {
  profiles: DestacadaProfile[];
  /** Rango que representa la sección. Define título, color e insignia. */
  tier?: ProfileTier;
  /** Título manual, para usos que no son de rango. */
  title?: string;
  /** Enlace del encabezado. Por rango apunta al detalle de los planes. */
  ctaHref?: string;
  ctaLabel?: string;
  /**
   * Versión reducida para ir sobre el mapa: fila horizontal de tarjetas
   * chicas en vez de grilla. El objetivo de esa posición es que el mapa
   * quede a la vista al entrar, así que esta sección no puede ocupar alto.
   */
  compact?: boolean;
};

type FeaturedResponse = {
  byUser: Record<string, FeaturedStoryMedia[]>;
};

export default function DestacadasGrid({
  profiles,
  tier,
  title,
  ctaHref,
  ctaLabel,
  compact = false,
}: Props) {
  const userIds = useMemo(() => profiles.map((p) => p.id), [profiles]);
  const [byUser, setByUser] = useState<Record<string, FeaturedStoryMedia[]>>({});

  useEffect(() => {
    if (userIds.length === 0) {
      setByUser({});
      return;
    }
    const controller = new AbortController();
    apiFetch<FeaturedResponse>("/stories/home-featured", {
      method: "POST",
      body: JSON.stringify({ userIds }),
      signal: controller.signal,
    })
      .then((res) => {
        if (res && res.byUser) setByUser(res.byUser);
      })
      .catch(() => {
        // Silent: the grid keeps showing plain covers if anything goes wrong
      });
    return () => controller.abort();
  }, [userIds.join(",")]);

  if (!profiles.length) return null;

  const theme = tier ? TIER_THEMES[tier] : null;
  const Icon = theme?.Icon ?? Crown;
  const headingIconClass = theme?.iconClass ?? "text-amber-400";
  const heading = title ?? theme?.title ?? "Destacadas";
  const linkHref = ctaHref ?? (tier ? "/ayuda/tiers" : null);
  const linkLabel = ctaLabel ?? (tier ? "Ver plan" : "Ver todas");

  if (compact) {
    return (
      <section className="relative mb-4">
        {theme && (
          <div
            aria-hidden
            className={`pointer-events-none absolute -inset-x-4 -top-2 h-16 rounded-2xl bg-gradient-to-r ${theme.glowClass}`}
          />
        )}
        <div className="relative mb-2 flex items-center gap-2">
          <Icon className={`h-4 w-4 ${headingIconClass}`} />
          <h2 className="text-sm font-bold tracking-tight">{heading}</h2>
          {theme && (
            <span
              className={`rounded-full border px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider ${theme.pillClass}`}
            >
              Plan {theme.title}
            </span>
          )}
          {linkHref && (
            <Link
              href={linkHref}
              className={`ml-auto inline-flex items-center gap-0.5 text-[11px] font-semibold transition ${
                theme?.ctaClass ?? "text-white/50 hover:text-white"
              }`}
            >
              {linkLabel}
              <ChevronRight className="h-3 w-3" />
            </Link>
          )}
        </div>
        <div className="relative scrollbar-none -mx-4 flex gap-2 overflow-x-auto px-4 pb-1 sm:mx-0 sm:px-0">
          {profiles.map((p) => (
            <div key={p.id} className="w-[104px] shrink-0 sm:w-[120px]">
              <DestacadaCard profile={p} stories={byUser[p.id] || []} />
            </div>
          ))}
        </div>
      </section>
    );
  }

  return (
    <section className="relative mb-8">
      {theme && (
        <div
          aria-hidden
          className={`pointer-events-none absolute -inset-x-4 -top-3 h-24 rounded-3xl bg-gradient-to-r ${theme.glowClass}`}
        />
      )}
      <div className="relative mb-3 flex flex-wrap items-center gap-2">
        <Icon className={`h-5 w-5 ${headingIconClass}`} />
        <h2 className="text-2xl font-extrabold tracking-tight">{heading}</h2>
        {theme && (
          <span
            className={`rounded-full border px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider ${theme.pillClass}`}
          >
            Plan {theme.title}
          </span>
        )}
        {theme && (
          <span className="text-[11px] text-white/40">{theme.subtitle}</span>
        )}
        {linkHref && (
          <Link
            href={linkHref}
            className={`ml-auto inline-flex items-center gap-0.5 text-xs font-semibold transition ${
              theme?.ctaClass ?? "text-white/50 hover:text-white"
            }`}
          >
            {linkLabel}
            <ChevronRight className="h-3.5 w-3.5" />
          </Link>
        )}
      </div>
      <div className="relative grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
        {profiles.map((p) => (
          <DestacadaCard
            key={p.id}
            profile={p}
            stories={byUser[p.id] || []}
          />
        ))}
      </div>
    </section>
  );
}
