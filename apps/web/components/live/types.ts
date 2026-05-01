/**
 * Modelo unificado para mostrar cards "en vivo" en uzeed.
 * Las dos fuentes (webrtc propio + cams externas) se proyectan a este shape
 * para que LiveCard, LivesRow, /live grid y RelatedCams las consuman igual.
 */

import type { ExternalLiveCam } from "../../lib/chaturbate/types";
import type { TrackSource } from "../../lib/chaturbate/transform";

export type LiveCardSource = "uzeed" | "external";

export interface UnifiedLiveCard {
  source: LiveCardSource;
  /** id estable: streamId para webrtc, username para externos */
  id: string;
  /** nombre humanizado para mostrar en la card */
  displayName: string;
  /** URL del thumbnail principal (16:9 si es posible) */
  thumbnailUrl: string | null;
  /** URL secundaria (avatar pequeño para webrtc) — opcional */
  avatarUrl: string | null;
  /** datos cortos opcionales que aparecen como subtítulo */
  subtitle: string | null;
  /** edad — solo se muestra para externos */
  age: number | null;
  /** país en español — solo se muestra para externos */
  countryName: string | null;
  /** contador de viewers / espectadores */
  viewerCount: number;
  /** marca HD (visible solo si está disponible) */
  isHd: boolean;
  /** marca "Nueva" (solo aplica a externos por ahora) */
  isNew: boolean;
  /** ISO timestamp de inicio del stream — solo webrtc */
  startedAt: string | null;
  /** href de navegación cuando se hace click */
  href: string;
  /** URL del iframe cuando aplica (externos) */
  embedUrl: string | null;
}

export type { TrackSource };
export type { ExternalLiveCam };
