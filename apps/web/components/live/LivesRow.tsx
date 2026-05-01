"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ChevronRight } from "lucide-react";

import LiveCard from "./LiveCard";
import { useLiveCamLauncher } from "./useLiveCamLauncher";
import {
  adaptExternalCam,
  adaptUzeedStream,
  mergeLives,
  type UzeedLiveStreamLike,
} from "./adapt";
import type { ExternalLiveCam, LivesFeedResponse } from "../../lib/chaturbate/types";
import type { UnifiedLiveCard } from "./types";

type FetchStreams = () => Promise<UzeedLiveStreamLike[]>;

export interface LivesRowProps {
  /** Función que obtiene los streams webrtc propios. Inyectada para no acoplar al hook útil. */
  fetchUzeedStreams: FetchStreams;
  /** Cantidad total de cards a mostrar mezclando ambas fuentes. */
  limit?: number;
  /** Texto del título — por defecto "En vivo ahora". */
  title?: string;
  /** Habilitar/deshabilitar la fila desde el padre. */
  enabled?: boolean;
}

/**
 * Fila horizontal de cards "en vivo" en home.
 * - Prioriza webrtc propios; rellena con cams externas hasta `limit` (default 12).
 * - Click en mobile → /live/cam/<username>; en desktop → modal embebido.
 * - Scroll horizontal con momentum nativo, sin scrollbars visibles.
 */
export default function LivesRow({
  fetchUzeedStreams,
  limit = 12,
  title = "En vivo ahora",
  enabled = true,
}: LivesRowProps) {
  const [uzeed, setUzeed] = useState<UzeedLiveStreamLike[]>([]);
  const [externalCams, setExternalCams] = useState<ExternalLiveCam[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (!enabled) return;
    let aborted = false;
    const controller = new AbortController();

    (async () => {
      // Defer 1s para no competir con above-the-fold
      await new Promise((r) => setTimeout(r, 1000));
      if (aborted) return;
      try {
        const [streams, feed] = await Promise.all([
          fetchUzeedStreams().catch(() => [] as UzeedLiveStreamLike[]),
          fetch(`/lives/feed?limit=${limit + 6}`, {
            signal: controller.signal,
            headers: { Accept: "application/json" },
          })
            .then(async (r) => (r.ok ? ((await r.json()) as LivesFeedResponse) : null))
            .catch(() => null),
        ]);
        if (aborted) return;
        setUzeed(streams);
        setExternalCams(feed?.cams ?? []);
      } finally {
        if (!aborted) setLoaded(true);
      }
    })();

    return () => {
      aborted = true;
      controller.abort();
    };
  }, [enabled, fetchUzeedStreams, limit]);

  const { handleCardClick, modal } = useLiveCamLauncher({
    externalCams,
    source: "home_row",
  });

  const cards: UnifiedLiveCard[] = mergeLives(
    uzeed.map(adaptUzeedStream),
    externalCams.map(adaptExternalCam),
    limit,
  );

  if (!enabled) return null;
  if (loaded && cards.length === 0) return null;

  return (
    <section className="mb-10">
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <span className="relative flex h-3 w-3">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-400 opacity-75" />
            <span className="relative inline-flex h-3 w-3 rounded-full bg-red-500" />
          </span>
          <h2 className="text-xl font-bold tracking-tight">{title}</h2>
          {cards.length > 0 && (
            <span className="rounded-full border border-fuchsia-500/20 bg-fuchsia-500/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-fuchsia-300">
              {cards.length}+
            </span>
          )}
        </div>
        <Link
          href="/live"
          className="group flex items-center gap-1 text-xs font-medium text-white/50 transition-colors hover:text-fuchsia-300"
        >
          Ver todas{" "}
          <ChevronRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
        </Link>
      </div>

      {!loaded ? (
        <div className="-mx-4 flex gap-3 overflow-x-auto px-4 pb-2 sm:mx-0 sm:px-0 scrollbar-none">
          {Array.from({ length: 6 }).map((_, i) => (
            <div
              key={i}
              className="aspect-[3/4] w-40 shrink-0 animate-pulse rounded-xl bg-white/[0.04] sm:w-44"
            />
          ))}
        </div>
      ) : (
        <div
          className="-mx-4 flex snap-x gap-3 overflow-x-auto px-4 pb-2 [-webkit-overflow-scrolling:touch] scrollbar-none sm:mx-0 sm:px-0"
          style={{ scrollbarWidth: "none" }}
        >
          {cards.map((card) => (
            <div key={`${card.source}-${card.id}`} className="snap-start">
              <LiveCard data={card} variant="row" onClick={handleCardClick} />
            </div>
          ))}
        </div>
      )}

      {modal}
    </section>
  );
}
