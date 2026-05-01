"use client";

import { useEffect, useState } from "react";
import { Radio } from "lucide-react";

import LiveCard from "./LiveCard";
import { useLiveCamLauncher } from "./useLiveCamLauncher";
import { adaptExternalCam } from "./adapt";
import type { ExternalLiveCam, LivesFeedResponse } from "../../lib/chaturbate/types";
import type { TrackSource } from "../../lib/chaturbate/transform";

export interface RelatedCamsProps {
  /** Cuántas cards renderizar — la API se pide con un buffer extra para de-duplicación. */
  limit?: number;
  /** Track source para el iframe en el modal — distinto por contexto. */
  source: TrackSource;
  /** Heading visible. Por defecto "También disponibles ahora". */
  title?: string;
  /** Descripción opcional bajo el título. */
  subtitle?: string;
  /** Si false, no renderiza nada (placeholder estable para SSR si se desea). */
  enabled?: boolean;
}

/**
 * Sección "También disponibles ahora" para perfiles de profesional.
 * Se inyecta al final del contenido para retener al visitante con
 * cams en vivo del feed externo.
 */
export default function RelatedCams({
  limit = 4,
  source,
  title = "También disponibles ahora",
  subtitle = "Otras cams en vivo seleccionadas para vos.",
  enabled = true,
}: RelatedCamsProps) {
  const [cams, setCams] = useState<ExternalLiveCam[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (!enabled) return;
    let aborted = false;
    const controller = new AbortController();
    (async () => {
      // Pequeño defer — esta sección suele estar al final del perfil.
      await new Promise((r) => setTimeout(r, 800));
      if (aborted) return;
      try {
        const res = await fetch(`/lives/feed?limit=${limit + 4}`, {
          signal: controller.signal,
          headers: { Accept: "application/json" },
        });
        if (!res.ok) return;
        const json = (await res.json()) as LivesFeedResponse;
        if (!aborted) setCams(json.cams ?? []);
      } catch {
        // silencioso — la sección simplemente no aparece si falla
      } finally {
        if (!aborted) setLoaded(true);
      }
    })();
    return () => {
      aborted = true;
      controller.abort();
    };
  }, [enabled, limit]);

  const { handleCardClick, modal } = useLiveCamLauncher({
    externalCams: cams,
    source,
  });

  if (!enabled) return null;
  if (loaded && cams.length === 0) return null;

  const visible = cams.slice(0, limit);

  return (
    <section className="min-w-0 rounded-2xl border border-white/[0.08] bg-gradient-to-b from-fuchsia-500/[0.05] to-transparent p-4 md:p-5">
      <div className="mb-4 flex items-center gap-2">
        <span className="relative flex h-2.5 w-2.5">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-400 opacity-75" />
          <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-red-500" />
        </span>
        <Radio className="h-4 w-4 text-fuchsia-300/80" />
        <h2 className="text-base font-semibold text-white/95">{title}</h2>
      </div>
      {subtitle && (
        <p className="-mt-2 mb-3 text-xs text-white/45">{subtitle}</p>
      )}

      {!loaded ? (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: limit }).map((_, i) => (
            <div
              key={i}
              className="aspect-video animate-pulse rounded-xl bg-white/[0.04]"
            />
          ))}
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {visible.map((cam) => (
            <LiveCard
              key={cam.username}
              data={adaptExternalCam(cam)}
              variant="grid"
              onClick={handleCardClick}
            />
          ))}
        </div>
      )}

      {modal}
    </section>
  );
}
