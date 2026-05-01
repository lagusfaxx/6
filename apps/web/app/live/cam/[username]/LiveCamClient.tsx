"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, MapPin, Radio, Users } from "lucide-react";

import LiveCard from "../../../../components/live/LiveCard";
import { useLiveCamLauncher } from "../../../../components/live/useLiveCamLauncher";
import { adaptExternalCam } from "../../../../components/live/adapt";
import { withTrack, humanizeUsername } from "../../../../lib/chaturbate/transform";
import type {
  ExternalLiveCam,
  LivesFeedResponse,
} from "../../../../lib/chaturbate/types";

interface Props {
  initialCam: ExternalLiveCam | null;
  initialFeed: ExternalLiveCam[];
  username: string;
}

const TRACK_SOURCE = "live_cam_page" as const;

/**
 * Página de reproducción dedicada (mobile y SSR-fallback).
 * - Header/footer de uzeed se mantienen vía layout global.
 * - El iframe ocupa el área principal.
 * - Abajo / al costado va info del modelo + cams recomendadas.
 */
export default function LiveCamClient({ initialCam, initialFeed, username }: Props) {
  const router = useRouter();
  const [cam, setCam] = useState<ExternalLiveCam | null>(initialCam);
  const [feed, setFeed] = useState<ExternalLiveCam[]>(initialFeed);

  // Refresca el feed cuando el cliente se monta — la cam podría haberse
  // ido offline en el delta entre SSR y la navegación.
  useEffect(() => {
    let aborted = false;
    const controller = new AbortController();
    (async () => {
      try {
        const res = await fetch("/lives/feed?limit=60", {
          signal: controller.signal,
          headers: { Accept: "application/json" },
        });
        if (!res.ok) return;
        const json = (await res.json()) as LivesFeedResponse;
        if (aborted) return;
        setFeed(json.cams ?? []);
        const fresh = (json.cams ?? []).find(
          (c) => c.username.toLowerCase() === username.toLowerCase(),
        );
        if (fresh) setCam(fresh);
      } catch {
        // silencioso — usamos el SSR snapshot
      }
    })();
    return () => {
      aborted = true;
      controller.abort();
    };
  }, [username]);

  const iframeSrc = useMemo(() => {
    if (!cam) return null;
    return withTrack(cam.embedUrl, TRACK_SOURCE);
  }, [cam]);

  const recommendations = useMemo(() => {
    if (!cam) return feed.slice(0, 6);
    return feed.filter((c) => c.username !== cam.username).slice(0, 6);
  }, [feed, cam]);

  const { handleCardClick, modal } = useLiveCamLauncher({
    externalCams: recommendations,
    source: "sidebar_reco",
  });

  const headline = cam?.displayName ?? humanizeUsername(username);

  return (
    <div className="min-h-screen bg-[#070816] text-white">
      <div className="mx-auto max-w-6xl px-4 pb-24 pt-4">
        <button
          type="button"
          onClick={() => router.back()}
          className="mb-3 inline-flex items-center gap-1.5 text-xs text-white/55 transition hover:text-white"
        >
          <ArrowLeft className="h-3.5 w-3.5" /> Volver
        </button>

        <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
          <div className="min-w-0">
            <div className="relative aspect-video overflow-hidden rounded-2xl border border-fuchsia-500/15 bg-black">
              {iframeSrc ? (
                <iframe
                  src={iframeSrc}
                  title={`En vivo — ${headline}`}
                  allow="autoplay; fullscreen"
                  allowFullScreen
                  sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-popups-to-escape-sandbox"
                  referrerPolicy="no-referrer-when-downgrade"
                  className="h-full w-full border-0"
                />
              ) : (
                <div className="flex h-full w-full flex-col items-center justify-center gap-3 p-8 text-center">
                  <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-fuchsia-500/20 bg-fuchsia-500/10">
                    <Radio className="h-6 w-6 text-fuchsia-300" />
                  </div>
                  <p className="text-sm font-semibold text-white/80">
                    {headline} no está en vivo en este momento
                  </p>
                  <p className="max-w-md text-xs text-white/45">
                    Mientras tanto, mira otras transmisiones disponibles abajo.
                  </p>
                  <Link
                    href="/live"
                    className="mt-2 inline-flex items-center gap-1.5 rounded-xl border border-fuchsia-500/30 bg-fuchsia-500/10 px-4 py-2 text-xs font-semibold text-fuchsia-200 transition hover:bg-fuchsia-500/20"
                  >
                    Ver todas las transmisiones
                  </Link>
                </div>
              )}
            </div>

            {/* Info del modelo */}
            <div className="mt-3 flex flex-wrap items-center gap-3 rounded-2xl border border-white/[0.06] bg-white/[0.02] px-4 py-3">
              <div className="flex-1 min-w-0">
                <h1 className="truncate text-base font-bold tracking-tight">
                  {headline}
                </h1>
                <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-white/55">
                  {typeof cam?.age === "number" && <span>{cam.age} años</span>}
                  {(cam?.countryName || cam?.location) && (
                    <>
                      <span className="text-white/20">·</span>
                      <span className="inline-flex items-center gap-1">
                        <MapPin className="h-3 w-3 text-fuchsia-300/70" />
                        {cam.countryName || cam.location}
                      </span>
                    </>
                  )}
                  {cam && (
                    <>
                      <span className="text-white/20">·</span>
                      <span className="inline-flex items-center gap-1">
                        <Users className="h-3 w-3 text-fuchsia-300/70" />
                        {cam.viewerCount.toLocaleString("es-CL")}
                      </span>
                    </>
                  )}
                  <span className="text-white/20">·</span>
                  <span className="inline-flex items-center gap-1 rounded bg-red-600 px-1.5 py-0.5 text-[10px] font-bold text-white">
                    <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-white" />
                    EN VIVO
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Recomendaciones — sidebar en desktop, debajo en mobile */}
          <aside className="min-w-0">
            <h2 className="mb-3 text-sm font-semibold text-white/80">
              Más cams en vivo
            </h2>
            <div className="grid gap-3 grid-cols-2 lg:grid-cols-1">
              {recommendations.map((rc) => (
                <LiveCard
                  key={rc.username}
                  data={adaptExternalCam(rc)}
                  variant="grid"
                  onClick={handleCardClick}
                />
              ))}
            </div>
          </aside>
        </div>
      </div>

      {modal}
    </div>
  );
}
