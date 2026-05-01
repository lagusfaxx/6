"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { apiFetch } from "../../lib/api";
import useMe from "../../hooks/useMe";
import {
  Radio,
  Eye,
  ChevronRight,
  Monitor,
  Flame,
  VideoOff,
} from "lucide-react";

import LiveCard from "../../components/live/LiveCard";
import { useLiveCamLauncher } from "../../components/live/useLiveCamLauncher";
import {
  adaptExternalCam,
  adaptUzeedStream,
  type UzeedLiveStreamLike,
} from "../../components/live/adapt";
import type {
  ExternalLiveCam,
  LivesFeedResponse,
} from "../../lib/chaturbate/types";

type LiveStream = UzeedLiveStreamLike & {
  isActive: boolean;
  maxViewers?: number;
  host: UzeedLiveStreamLike["host"] & { bio?: string | null };
};

export default function LivePage() {
  const { me } = useMe();
  const [streams, setStreams] = useState<LiveStream[]>([]);
  const [externalCams, setExternalCams] = useState<ExternalLiveCam[]>([]);
  const [loading, setLoading] = useState(true);

  const isProfessional = me?.user?.profileType === "PROFESSIONAL";
  const myId = me?.user?.id;

  const loadStreams = useCallback(async () => {
    try {
      const res = await apiFetch<{ streams: LiveStream[] }>("/live/active");
      setStreams(res.streams || []);
    } catch {
      // mantenemos el último estado conocido si falla la API propia
    }
  }, []);

  const loadExternal = useCallback(async (signal?: AbortSignal) => {
    try {
      const res = await fetch("/lives/feed?limit=60", {
        signal,
        headers: { Accept: "application/json" },
      });
      if (!res.ok) return;
      const json = (await res.json()) as LivesFeedResponse;
      setExternalCams(json.cams ?? []);
    } catch {
      // ídem — soft-fail; la sección sigue funcionando con webrtc
    }
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    Promise.allSettled([loadStreams(), loadExternal(controller.signal)]).finally(() =>
      setLoading(false),
    );
    const interval = setInterval(() => {
      loadStreams();
      loadExternal();
    }, 60_000);
    return () => {
      controller.abort();
      clearInterval(interval);
    };
  }, [loadStreams, loadExternal]);

  const myStream = streams.find((s) => s.host.id === myId);
  const totalViewers = streams.reduce((acc, s) => acc + s.viewerCount, 0);
  const totalLive = streams.length + externalCams.length;

  const { handleCardClick, modal } = useLiveCamLauncher({
    externalCams,
    source: "live_grid",
  });

  const uzeedCards = streams.map(adaptUzeedStream);
  const externalCards = externalCams.map(adaptExternalCam);

  const isEmpty = !loading && uzeedCards.length === 0 && externalCards.length === 0;

  return (
    <div className="min-h-screen bg-[#070816] text-white">
      <div className="mx-auto max-w-5xl px-4 py-6 pb-28">
        {/* Hero */}
        <div className="mb-6 overflow-hidden rounded-2xl border border-fuchsia-500/15 bg-gradient-to-br from-fuchsia-600/[0.08] via-rose-600/[0.04] to-transparent relative">
          <div className="pointer-events-none absolute -top-20 -right-20 h-60 w-60 rounded-full bg-fuchsia-500/[0.08] blur-[80px]" />
          <div className="relative flex items-center gap-4 p-5 sm:p-6">
            <div className="relative">
              <div className="absolute inset-0 rounded-2xl bg-gradient-to-br from-fuchsia-500/30 to-rose-500/30 blur-xl scale-150" />
              <div className="relative flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-fuchsia-600/30 to-rose-600/30 border border-fuchsia-500/20 shadow-[0_0_20px_rgba(168,85,247,0.15)]">
                <Radio className="h-6 w-6 text-fuchsia-300" />
              </div>
            </div>
            <div className="flex-1 min-w-0">
              <h1 className="text-xl font-bold tracking-tight sm:text-2xl">En Vivo</h1>
              <div className="mt-1 flex items-center gap-3 text-xs text-white/40">
                <span>Transmisiones en tiempo real</span>
                {totalLive > 0 && (
                  <>
                    <span className="text-white/15">·</span>
                    <span className="flex items-center gap-1 text-fuchsia-400/70">
                      <span className="h-1.5 w-1.5 rounded-full bg-red-400 animate-pulse" />
                      {totalLive}+ en vivo ahora
                    </span>
                    {totalViewers > 0 && (
                      <>
                        <span className="text-white/15">·</span>
                        <span className="flex items-center gap-1">
                          <Eye className="h-3 w-3" />
                          {totalViewers.toLocaleString("es-CL")} viendo
                        </span>
                      </>
                    )}
                  </>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Professional: always route through studio */}
        {isProfessional && (
          <div className="mb-6">
            {myStream ? (
              <div className="grid gap-3 sm:grid-cols-2">
                <Link
                  href={`/live/${myStream.id}`}
                  className="group flex items-center justify-center gap-3 rounded-2xl border border-red-500/20 bg-gradient-to-r from-red-500/[0.08] to-fuchsia-500/[0.05] px-6 py-4 transition-all hover:border-red-500/30 hover:shadow-[0_0_24px_rgba(239,68,68,0.1)]"
                >
                  <span className="relative flex h-2.5 w-2.5">
                    <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-400 opacity-75" />
                    <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-red-500" />
                  </span>
                  <span className="text-sm font-semibold">Estas en vivo — Volver al stream</span>
                  <ChevronRight className="h-4 w-4 text-white/30 group-hover:text-white/60 transition-colors" />
                </Link>
                <Link
                  href="/live/studio"
                  className="flex items-center justify-center gap-2 rounded-2xl border border-white/[0.08] bg-white/[0.03] px-6 py-4 text-sm font-semibold transition-all hover:bg-white/[0.06] hover:border-white/[0.12]"
                >
                  <Monitor className="h-4 w-4 text-fuchsia-400/70" />
                  Live Studio
                </Link>
              </div>
            ) : (
              <Link
                href="/live/studio"
                className="group relative flex items-center justify-center gap-3 overflow-hidden rounded-2xl bg-gradient-to-r from-fuchsia-600 to-rose-600 px-6 py-5 text-base font-bold shadow-lg shadow-fuchsia-500/20 transition-all hover:scale-[1.01] hover:shadow-[0_12px_40px_rgba(219,39,119,0.3)]"
              >
                <Radio className="h-5 w-5" />
                Abrir Live Studio
                <div className="pointer-events-none absolute inset-0 overflow-hidden rounded-2xl">
                  <div
                    className="absolute -left-full top-0 h-full w-1/2 bg-gradient-to-r from-transparent via-white/10 to-transparent"
                    style={{ animation: "shimmer 3s ease-in-out infinite" }}
                  />
                </div>
              </Link>
            )}
          </div>
        )}

        {/* Gradient divider */}
        <div className="mb-5 h-px bg-gradient-to-r from-transparent via-fuchsia-500/15 to-transparent" />

        {/* Skeleton loader */}
        {loading ? (
          <div className="grid gap-3 sm:gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <div key={i} className="animate-pulse">
                <div className="aspect-video rounded-xl bg-white/[0.04]" />
                <div className="mt-2.5 flex gap-2.5">
                  <div className="h-9 w-9 shrink-0 rounded-full bg-white/[0.04]" />
                  <div className="flex-1 space-y-1.5 pt-0.5">
                    <div className="h-3 w-3/4 rounded bg-white/[0.06]" />
                    <div className="h-2.5 w-1/2 rounded bg-white/[0.04]" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : isEmpty ? (
          <div className="flex flex-col items-center py-20 text-center">
            <div className="relative mb-5">
              <div className="absolute inset-0 rounded-full bg-gradient-to-br from-fuchsia-500/15 to-violet-500/15 blur-3xl scale-[2]" />
              <div className="relative flex h-20 w-20 items-center justify-center rounded-3xl border border-white/[0.08] bg-gradient-to-br from-fuchsia-500/[0.06] to-violet-500/[0.04]">
                <VideoOff className="h-8 w-8 text-white/15" />
              </div>
            </div>
            <p className="text-sm font-semibold text-white/50">No hay transmisiones en vivo</p>
            <p className="mt-1.5 max-w-xs text-xs text-white/30 leading-relaxed">
              Vuelve más tarde o sigue a tus profesionales favoritas para no perderte nada.
            </p>
          </div>
        ) : (
          <>
            {/* Webrtc propias — priorizadas */}
            {uzeedCards.length > 0 && (
              <section className="mb-8">
                <div className="mb-3 flex items-center gap-2">
                  <Flame className="h-3.5 w-3.5 text-fuchsia-300" />
                  <span className="text-xs font-semibold text-white/55">
                    Exclusivas Uzeed · {uzeedCards.length}{" "}
                    transmisi{uzeedCards.length === 1 ? "ón" : "ones"}
                  </span>
                </div>
                <div className="grid gap-3 sm:gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
                  {uzeedCards.map((card) => (
                    <LiveCard
                      key={`uzeed-${card.id}`}
                      data={card}
                      variant="grid"
                    />
                  ))}
                </div>
              </section>
            )}

            {/* Cams externas */}
            {externalCards.length > 0 && (
              <section>
                <div className="mb-3 flex items-center gap-2">
                  <span className="relative flex h-2 w-2">
                    <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-400 opacity-75" />
                    <span className="relative inline-flex h-2 w-2 rounded-full bg-red-500" />
                  </span>
                  <span className="text-xs font-semibold text-white/55">
                    {externalCards.length}+ cams en vivo ahora
                  </span>
                </div>
                <div className="grid gap-3 sm:gap-4 grid-cols-2 sm:grid-cols-3 lg:grid-cols-4">
                  {externalCards.map((card) => (
                    <LiveCard
                      key={`ext-${card.id}`}
                      data={card}
                      variant="grid"
                      onClick={handleCardClick}
                    />
                  ))}
                </div>
              </section>
            )}
          </>
        )}
      </div>

      {modal}

      <style jsx>{`
        @keyframes shimmer {
          0% { transform: translateX(-100%); }
          100% { transform: translateX(300%); }
        }
      `}</style>
    </div>
  );
}
