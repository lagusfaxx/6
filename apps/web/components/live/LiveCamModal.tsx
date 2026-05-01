"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronRight, Heart, MapPin, Users, X } from "lucide-react";

import {
  trackParamFor,
  withTrack,
  type TrackSource,
} from "../../lib/chaturbate/transform";
import type { ExternalLiveCam } from "../../lib/chaturbate/types";
import LiveCard from "./LiveCard";
import { adaptExternalCam } from "./adapt";

export interface LiveCamModalProps {
  /** Cam que se está reproduciendo. Cuando es null el modal está cerrado. */
  cam: ExternalLiveCam | null;
  /** Fuente del click — define el track param del iframe */
  source: TrackSource;
  /** Cams para el sidebar de recomendaciones */
  related: ExternalLiveCam[];
  /** Llamado cuando el modal se cierra (botón X / esc / click backdrop) */
  onClose: () => void;
  /** Llamado cuando el usuario clickea otra cam en el sidebar */
  onSwitchCam: (next: ExternalLiveCam) => void;
}

/**
 * Modal de reproducción para desktop.
 * - Fija history.pushState a `/live/cam/<username>` al abrir y vuelve a la
 *   URL anterior al cerrar (compartible + popstate-friendly).
 * - El iframe usa chat_room_url_revshare con ?track=uzeed_live_<source>.
 * - Bloquea scroll del body mientras está abierto.
 */
export default function LiveCamModal({
  cam,
  source,
  related,
  onClose,
  onSwitchCam,
}: LiveCamModalProps) {
  const router = useRouter();
  const [previousUrl, setPreviousUrl] = useState<string | null>(null);

  const open = Boolean(cam);

  // Push URL al abrir, popstate cierra el modal naturalmente.
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!cam) return;
    const target = `/live/cam/${encodeURIComponent(cam.username)}`;
    if (window.location.pathname !== target) {
      setPreviousUrl(window.location.pathname + window.location.search);
      window.history.pushState({ uzeedLiveCamModal: cam.username }, "", target);
    }
    const onPopState = () => onClose();
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, [cam, onClose]);

  // Cuando el modal se cierra, restauramos la URL si el push fue nuestro.
  useEffect(() => {
    if (open) return;
    if (typeof window === "undefined") return;
    if (!previousUrl) return;
    const state = window.history.state as { uzeedLiveCamModal?: string } | null;
    if (state?.uzeedLiveCamModal) {
      window.history.replaceState(null, "", previousUrl);
    }
    setPreviousUrl(null);
  }, [open, previousUrl]);

  // Esc cierra
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [open, onClose]);

  // Bloqueo scroll del body
  useEffect(() => {
    if (!open) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, [open]);

  const iframeSrc = useMemo(() => {
    if (!cam) return null;
    return withTrack(cam.embedUrl, source);
  }, [cam, source]);

  const sidebarCams = useMemo(
    () => related.filter((c) => !cam || c.username !== cam.username).slice(0, 6),
    [related, cam],
  );

  return (
    <AnimatePresence>
      {open && cam && (
        <motion.div
          key={cam.username}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.15 }}
          className="fixed inset-0 z-[60] hidden bg-black/80 backdrop-blur-md md:block"
          onClick={onClose}
          data-testid="live-cam-modal"
        >
          <motion.div
            initial={{ scale: 0.96, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.96, opacity: 0 }}
            transition={{ duration: 0.18, ease: "easeOut" }}
            className="relative mx-auto flex h-[100dvh] max-h-screen w-[min(1280px,96vw)] flex-col p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between pb-4">
              <div className="min-w-0">
                <h2 className="truncate text-lg font-bold text-white">
                  {cam.displayName}
                </h2>
                <p className="mt-0.5 flex items-center gap-2 text-xs text-white/55">
                  {typeof cam.age === "number" && <span>{cam.age} años</span>}
                  {cam.countryName && (
                    <>
                      <span className="text-white/20">·</span>
                      <span className="inline-flex items-center gap-1">
                        <MapPin className="h-3 w-3 text-fuchsia-300/70" />
                        {cam.countryName}
                      </span>
                    </>
                  )}
                  <span className="text-white/20">·</span>
                  <span className="inline-flex items-center gap-1">
                    <Users className="h-3 w-3 text-fuchsia-300/70" />
                    {cam.viewerCount.toLocaleString("es-CL")}
                  </span>
                </p>
              </div>
              <button
                type="button"
                aria-label="Cerrar"
                onClick={onClose}
                className="ml-4 flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-white/10 bg-white/[0.04] text-white/70 transition hover:border-fuchsia-500/30 hover:bg-white/[0.08] hover:text-white"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="flex flex-1 gap-4 overflow-hidden">
              {/* Iframe principal */}
              <div className="relative flex-1 overflow-hidden rounded-2xl border border-fuchsia-500/15 bg-black">
                {iframeSrc ? (
                  <iframe
                    src={iframeSrc}
                    title={`En vivo — ${cam.displayName}`}
                    allow="autoplay; fullscreen"
                    allowFullScreen
                    sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-popups-to-escape-sandbox"
                    referrerPolicy="no-referrer-when-downgrade"
                    className="h-full w-full border-0"
                  />
                ) : (
                  <div className="flex h-full w-full items-center justify-center text-sm text-white/40">
                    No disponible
                  </div>
                )}
              </div>

              {/* Sidebar recomendaciones */}
              {sidebarCams.length > 0 && (
                <aside className="hidden w-[260px] shrink-0 flex-col overflow-y-auto pr-1 lg:flex">
                  <div className="mb-2 flex items-center justify-between">
                    <h3 className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-white/55">
                      <Heart className="h-3 w-3 text-fuchsia-300" /> Más cams en vivo
                    </h3>
                  </div>
                  <div className="flex flex-col gap-3">
                    {sidebarCams.map((rc) => {
                      const adapted = adaptExternalCam(rc);
                      return (
                        <LiveCard
                          key={rc.username}
                          data={adapted}
                          variant="grid"
                          onClick={(e) => {
                            e.preventDefault();
                            onSwitchCam(rc);
                          }}
                        />
                      );
                    })}
                  </div>
                  <div className="mt-2 text-[10px] uppercase tracking-wider text-white/25">
                    track: {trackParamFor("sidebar_reco")}
                  </div>
                </aside>
              )}
            </div>

            {/* Footer mobile-ish (solo si no hay sidebar visible) */}
            <div className="mt-3 flex items-center justify-between text-xs text-white/40 lg:hidden">
              <span>Más cams en vivo abajo</span>
              <button
                type="button"
                onClick={() => {
                  router.push("/live");
                  onClose();
                }}
                className="inline-flex items-center gap-1 text-white/60 hover:text-white"
              >
                Ver todas <ChevronRight className="h-3.5 w-3.5" />
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
