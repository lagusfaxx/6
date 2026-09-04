"use client";

import { useEffect, useMemo, useState } from "react";
import { Crown, Gem } from "lucide-react";
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
  Icon: typeof Crown;
  iconClass: string;
};

/* Sin píldoras, subtítulos ni halos de color: el nombre del rango y su icono
   ya dicen todo, y los bloques de fondo dorado/azul ensuciaban el inicio. */
const TIER_THEMES: Record<ProfileTier, TierTheme> = {
  DIAMOND: { title: "Diamond", Icon: Gem, iconClass: "text-cyan-300" },
  GOLD: { title: "Gold", Icon: Crown, iconClass: "text-amber-300" },
};

type Props = {
  profiles: DestacadaProfile[];
  /** Rango que representa la sección. Define título e icono. */
  tier?: ProfileTier;
  /** Título manual, para usos que no son de rango. */
  title?: string;
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

  if (compact) {
    return (
      <section className="mb-4">
        <div className="mb-2 flex items-center gap-1.5">
          <Icon className={`h-4 w-4 ${headingIconClass}`} />
          <h2 className="text-sm font-bold tracking-tight">{heading}</h2>
        </div>
        <div className="scrollbar-none -mx-4 flex gap-2 overflow-x-auto px-4 pb-1 sm:mx-0 sm:px-0">
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
    <section className="mb-8">
      <div className="mb-3 flex items-center gap-2">
        <Icon className={`h-5 w-5 ${headingIconClass}`} />
        <h2 className="text-2xl font-extrabold tracking-tight">{heading}</h2>
      </div>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
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
