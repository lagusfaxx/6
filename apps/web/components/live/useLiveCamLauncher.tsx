"use client";

import { type MouseEvent, type ReactNode, useCallback, useState } from "react";
import LiveCamModal from "./LiveCamModal";
import type { ExternalLiveCam } from "../../lib/chaturbate/types";
import type { TrackSource } from "../../lib/chaturbate/transform";
import type { UnifiedLiveCard } from "./types";

const DESKTOP_QUERY = "(min-width: 768px)";

function isDesktop(): boolean {
  if (typeof window === "undefined") return false;
  return window.matchMedia(DESKTOP_QUERY).matches;
}

interface LauncherInput {
  /** Pool de cams externas disponibles para abrir en modal y para el sidebar. */
  externalCams: ExternalLiveCam[];
  /** Track source para el iframe (uzeed_live_<source>). */
  source: TrackSource;
}

interface LauncherResult {
  /**
   * Handler para `LiveCard.onClick`. En desktop intercepta y abre modal;
   * en mobile deja que el link navegue a /live/cam/<username>.
   * Solo intercepta cards externas — las webrtc propias siguen su flujo.
   */
  handleCardClick: (e: MouseEvent<HTMLAnchorElement>, data: UnifiedLiveCard) => void;
  /** Modal montado en árbol — siempre presente; vacío cuando no hay cam activa. */
  modal: ReactNode;
}

/**
 * Hook que gestiona el modal de reproducción de cams externas en desktop.
 * Ver LiveCamModal para los detalles del comportamiento (pushState, esc, etc.).
 */
export function useLiveCamLauncher({
  externalCams,
  source,
}: LauncherInput): LauncherResult {
  const [activeCam, setActiveCam] = useState<ExternalLiveCam | null>(null);

  const handleCardClick = useCallback(
    (e: MouseEvent<HTMLAnchorElement>, data: UnifiedLiveCard) => {
      if (data.source !== "external") return;
      if (e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return;
      if (!isDesktop()) return;

      const cam = externalCams.find((c) => c.username === data.id);
      if (!cam) return;

      e.preventDefault();
      setActiveCam(cam);
    },
    [externalCams],
  );

  const modal = (
    <LiveCamModal
      cam={activeCam}
      source={source}
      related={externalCams}
      onClose={() => setActiveCam(null)}
      onSwitchCam={(next) => setActiveCam(next)}
    />
  );

  return { handleCardClick, modal };
}
