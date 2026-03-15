"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import { apiFetch, resolveMediaUrl } from "../../lib/api";
import useMe from "../../hooks/useMe";
import {
  Radio,
  Users,
  Play,
  Plus,
  User,
  Loader2,
  VideoOff,
} from "lucide-react";

type LiveStream = {
  id: string;
  title: string | null;
  isActive: boolean;
  viewerCount: number;
  maxViewers: number;
  startedAt: string;
  host: {
    id: string;
    displayName: string;
    username: string;
    avatarUrl: string | null;
  };
};

export default function LivePage() {
  const router = useRouter();
  const { me } = useMe();
  const [streams, setStreams] = useState<LiveStream[]>([]);
  const [loading, setLoading] = useState(true);
  const [startingLive, setStartingLive] = useState(false);
  const [liveTitle, setLiveTitle] = useState("");
  const [showStartModal, setShowStartModal] = useState(false);
  const [error, setError] = useState("");

  const isProfessional = me?.user?.profileType === "PROFESSIONAL";
  const myId = me?.user?.id;

  const loadStreams = useCallback(async () => {
    try {
      const res = await apiFetch<{ streams: LiveStream[] }>("/live/active");
      setStreams(res.streams || []);
    } catch {}
    setLoading(false);
  }, []);

  useEffect(() => {
    loadStreams();
    const interval = setInterval(loadStreams, 15000);
    return () => clearInterval(interval);
  }, [loadStreams]);

  const handleStartLive = async () => {
    setStartingLive(true);
    setError("");
    try {
      const res = await apiFetch<{ stream: { id: string } }>("/live/start", {
        method: "POST",
        body: JSON.stringify({ title: liveTitle.trim() || null }),
      });
      router.push(`/live/${res.stream.id}`);
    } catch (e: unknown) {
      if (e && typeof e === "object" && "body" in e) {
        const apiErr = e as { body?: { streamId?: string; error?: string } };
        if (apiErr.body?.streamId) {
          router.push(`/live/${apiErr.body.streamId}`);
          return;
        }
        setError(apiErr.body?.error || "Error al iniciar live");
      } else {
        setError(e instanceof Error ? e.message : "Error al iniciar live");
      }
    } finally {
      setStartingLive(false);
    }
  };

  // Check if I'm already live
  const myStream = streams.find((s) => s.host.id === myId);

  return (
    <div className="min-h-screen bg-[#0a0b14] text-white">
      <div className="mx-auto max-w-5xl px-4 py-6 pb-28">
        {/* Hero */}
        <div className="mb-8 overflow-hidden rounded-3xl border border-fuchsia-500/20 bg-gradient-to-br from-fuchsia-600/10 via-rose-600/5 to-transparent p-6 sm:p-8">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-start gap-4">
              <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-fuchsia-500/30 to-rose-500/30 backdrop-blur">
                <Radio className="h-7 w-7 text-fuchsia-200" />
              </div>
              <div>
                <h1 className="text-2xl font-bold sm:text-3xl">Live Streams</h1>
                <p className="mt-1 text-sm text-white/50">
                  Transmisiones en vivo de profesionales. Contenido exclusivo en tiempo real.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Professional: Go Live button */}
        {isProfessional && (
          <div className="mb-6">
            {myStream ? (
              <div className="grid gap-3 sm:grid-cols-2">
                <Link
                  href={`/live/${myStream.id}`}
                  className="flex items-center justify-center gap-2 rounded-2xl border border-red-500/30 bg-gradient-to-r from-red-600/20 to-fuchsia-600/20 px-6 py-4 text-sm font-semibold transition hover:opacity-90"
                >
                  <span className="h-2.5 w-2.5 animate-pulse rounded-full bg-red-400" />
                  Estás en vivo — Volver al stream
                </Link>
                <Link
                  href="/live/studio"
                  className="flex items-center justify-center gap-2 rounded-2xl border border-white/10 bg-white/[0.03] px-6 py-4 text-sm font-semibold transition hover:bg-white/[0.05]"
                >
                  Abrir Live Studio
                </Link>
              </div>
            ) : (
              <div className="grid gap-3 sm:grid-cols-2">
                <button
                  onClick={() => setShowStartModal(true)}
                  className="flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-fuchsia-600 to-rose-600 px-6 py-4 text-sm font-semibold shadow-lg shadow-fuchsia-500/20 transition hover:opacity-90"
                >
                  <Plus className="h-4 w-4" />
                  Iniciar Live
                </button>
                <Link
                  href="/live/studio"
                  className="flex items-center justify-center gap-2 rounded-2xl border border-white/10 bg-white/[0.03] px-6 py-4 text-sm font-semibold transition hover:bg-white/[0.05]"
                >
                  Configurar en Live Studio
                </Link>
              </div>
            )}
          </div>
        )}

        {/* Active Streams List */}
        {loading ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-48 animate-pulse rounded-2xl bg-white/[0.04]" />
            ))}
          </div>
        ) : streams.length === 0 ? (
          <div className="py-20 text-center">
            <VideoOff className="mx-auto mb-4 h-12 w-12 text-white/15" />
            <p className="text-sm text-white/40">No hay transmisiones en vivo en este momento.</p>
            <p className="mt-1 text-xs text-white/25">Vuelve más tarde o sigue a tus profesionales favoritos.</p>
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {streams.map((s) => (
              <Link
                key={s.id}
                href={`/live/${s.id}`}
                className="group relative overflow-hidden rounded-2xl border border-white/[0.08] bg-white/[0.03] transition hover:border-fuchsia-500/20 hover:bg-white/[0.05]"
              >
                {/* Live badge */}
                <div className="relative flex h-36 items-center justify-center bg-gradient-to-br from-fuchsia-500/10 to-violet-500/10">
                  <Radio className="h-12 w-12 animate-pulse text-fuchsia-400/40" />
                  <div className="absolute left-3 top-3 flex items-center gap-1.5 rounded-full border border-red-500/30 bg-[#0a0b14]/80 px-2.5 py-1 backdrop-blur">
                    <span className="h-2 w-2 animate-pulse rounded-full bg-red-400" />
                    <span className="text-[10px] font-bold text-red-300">LIVE</span>
                  </div>
                  <div className="absolute right-3 top-3 flex items-center gap-1 rounded-full border border-white/10 bg-[#0a0b14]/80 px-2 py-1 backdrop-blur">
                    <Users className="h-3 w-3 text-white/50" />
                    <span className="text-[10px] text-white/50">{s.viewerCount}/{s.maxViewers}</span>
                  </div>
                </div>

                {/* Info */}
                <div className="p-4">
                  <div className="flex items-center gap-3">
                    {s.host.avatarUrl ? (
                      <img
                        src={resolveMediaUrl(s.host.avatarUrl) ?? undefined}
                        alt=""
                        className="h-10 w-10 rounded-xl object-cover"
                      />
                    ) : (
                      <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/10">
                        <User className="h-5 w-5 text-white/30" />
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold truncate">{s.host.displayName || s.host.username}</p>
                      {s.title && <p className="text-[11px] text-white/40 truncate">{s.title}</p>}
                    </div>
                    <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-fuchsia-500/20 text-fuchsia-300 transition group-hover:bg-fuchsia-500/30">
                      <Play className="h-4 w-4" />
                    </div>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>

      {/* Start Live Modal */}
      <AnimatePresence>
        {showStartModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 backdrop-blur-sm sm:items-center"
            onClick={(e) => { if (e.target === e.currentTarget) setShowStartModal(false); }}
          >
            <motion.div
              initial={{ y: 40, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 40, opacity: 0 }}
              className="relative w-full max-w-sm rounded-t-3xl border border-white/10 bg-[#12131f] p-6 shadow-2xl sm:rounded-3xl"
            >
              <div className="mb-5 flex items-center gap-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-fuchsia-500/30 to-rose-500/30">
                  <Radio className="h-6 w-6 text-fuchsia-300" />
                </div>
                <div>
                  <h3 className="text-base font-bold">Iniciar Transmisión</h3>
                  <p className="text-xs text-white/40">Tu cámara y micrófono se activarán</p>
                </div>
              </div>

              <div className="mb-4">
                <label className="mb-1.5 block text-xs text-white/50">Título (opcional)</label>
                <input
                  type="text"
                  value={liveTitle}
                  onChange={(e) => setLiveTitle(e.target.value)}
                  placeholder="Ej: Show privado nocturno..."
                  maxLength={100}
                  className="w-full rounded-xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm outline-none placeholder:text-white/25 focus:border-fuchsia-500/30"
                />
              </div>

              <div className="mb-4 rounded-xl border border-white/[0.06] bg-white/[0.02] p-3 text-[11px] text-white/40">
                <p>Se activarán tu cámara y micrófono. Te recomendamos configurar primero en Live Studio el precio del show privado y tus propinas para evitar bloqueos al iniciar.</p>
              </div>

              {error && (
                <p className="mb-3 text-center text-xs text-red-300">{error}</p>
              )}

              <button
                onClick={handleStartLive}
                disabled={startingLive}
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-fuchsia-600 to-rose-600 py-3.5 text-sm font-semibold transition hover:opacity-90 disabled:opacity-40"
              >
                {startingLive ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Radio className="h-4 w-4" />
                )}
                {startingLive ? "Iniciando..." : "Iniciar Live"}
              </button>

              <button
                onClick={() => setShowStartModal(false)}
                className="mt-3 w-full py-2 text-center text-xs text-white/40 hover:text-white/60"
              >
                Cancelar
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
