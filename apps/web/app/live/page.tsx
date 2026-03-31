"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { motion } from "framer-motion";
import { apiFetch, resolveMediaUrl } from "../../lib/api";
import useMe from "../../hooks/useMe";
import {
  Radio,
  Users,
  Play,
  User,
  VideoOff,
  Eye,
  Clock,
  ChevronRight,
  Monitor,
  Flame,
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
    bio?: string | null;
    thumbnailUrl?: string | null;
  };
};

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "ahora";
  if (mins < 60) return `${mins} min`;
  const hours = Math.floor(mins / 60);
  return `${hours}h`;
}

export default function LivePage() {
  const router = useRouter();
  const { me } = useMe();
  const [streams, setStreams] = useState<LiveStream[]>([]);
  const [loading, setLoading] = useState(true);

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

  const myStream = streams.find((s) => s.host.id === myId);
  const totalViewers = streams.reduce((s, st) => s + st.viewerCount, 0);

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
                {streams.length > 0 && (
                  <>
                    <span className="text-white/15">·</span>
                    <span className="flex items-center gap-1 text-fuchsia-400/70">
                      <span className="h-1.5 w-1.5 rounded-full bg-red-400 animate-pulse" />
                      {streams.length} en vivo
                    </span>
                    {totalViewers > 0 && (
                      <>
                        <span className="text-white/15">·</span>
                        <span className="flex items-center gap-1">
                          <Eye className="h-3 w-3" />
                          {totalViewers} viendo
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
                  <div className="absolute -left-full top-0 h-full w-1/2 bg-gradient-to-r from-transparent via-white/10 to-transparent" style={{ animation: "shimmer 3s ease-in-out infinite" }} />
                </div>
              </Link>
            )}
          </div>
        )}

        {/* Gradient divider */}
        <div className="mb-5 h-px bg-gradient-to-r from-transparent via-fuchsia-500/15 to-transparent" />

        {/* Active Streams List */}
        {loading ? (
          <div className="grid gap-4 grid-cols-2 lg:grid-cols-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="animate-pulse rounded-2xl bg-white/[0.03] border border-white/[0.04]">
                <div className="aspect-[3/4] rounded-t-2xl bg-white/[0.03]" />
                <div className="p-3 space-y-2">
                  <div className="h-3 w-2/3 rounded bg-white/[0.06]" />
                  <div className="h-2 w-1/2 rounded bg-white/[0.04]" />
                </div>
              </div>
            ))}
          </div>
        ) : streams.length === 0 ? (
          <div className="flex flex-col items-center py-20 text-center">
            <div className="relative mb-5">
              <div className="absolute inset-0 rounded-full bg-gradient-to-br from-fuchsia-500/15 to-violet-500/15 blur-3xl scale-[2]" />
              <div className="relative flex h-20 w-20 items-center justify-center rounded-3xl border border-white/[0.08] bg-gradient-to-br from-fuchsia-500/[0.06] to-violet-500/[0.04]">
                <VideoOff className="h-8 w-8 text-white/15" />
              </div>
            </div>
            <p className="text-sm font-semibold text-white/50">No hay transmisiones en vivo</p>
            <p className="mt-1.5 max-w-xs text-xs text-white/30 leading-relaxed">
              Vuelve mas tarde o sigue a tus profesionales favoritas para no perderte nada
            </p>
          </div>
        ) : (
          <>
            {/* Section label */}
            <div className="mb-3 flex items-center gap-2">
              <Flame className="h-3.5 w-3.5 text-red-400" />
              <span className="text-xs font-semibold text-white/50">
                {streams.length} transmisi{streams.length === 1 ? "on" : "ones"} en vivo
              </span>
            </div>

            <div className="grid gap-3 grid-cols-2 lg:grid-cols-3">
              {streams.map((s) => {
                const thumbnail = s.host.thumbnailUrl || s.host.avatarUrl;
                return (
                  <Link
                    key={s.id}
                    href={`/live/${s.id}`}
                    className="group relative overflow-hidden rounded-2xl border border-white/[0.08] bg-white/[0.02] transition-all duration-200 hover:border-fuchsia-500/20 hover:shadow-[0_0_30px_rgba(168,85,247,0.08)]"
                  >
                    {/* Thumbnail — tall card style */}
                    <div className="relative aspect-[3/4] overflow-hidden bg-gradient-to-br from-fuchsia-500/[0.06] to-violet-500/[0.04]">
                      {thumbnail ? (
                        <img
                          src={resolveMediaUrl(thumbnail) ?? undefined}
                          alt=""
                          className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                        />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center">
                          <User className="h-16 w-16 text-white/[0.06]" />
                        </div>
                      )}

                      {/* Dark gradient overlay bottom */}
                      <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/20 to-transparent" />

                      {/* LIVE badge — top left */}
                      <div className="absolute left-2 top-2 flex items-center gap-1.5 rounded-full bg-red-600/90 px-2 py-0.5 shadow-lg shadow-red-500/30">
                        <span className="relative flex h-1.5 w-1.5">
                          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-white opacity-75" />
                          <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-white" />
                        </span>
                        <span className="text-[9px] font-bold text-white tracking-wider">LIVE</span>
                      </div>

                      {/* Viewers — top right */}
                      <div className="absolute right-2 top-2 flex items-center gap-1 rounded-full bg-black/60 px-2 py-0.5 backdrop-blur-sm">
                        <Users className="h-2.5 w-2.5 text-white/70" />
                        <span className="text-[9px] font-semibold text-white/70">{s.viewerCount}</span>
                      </div>

                      {/* Duration — top right, below viewers */}
                      <div className="absolute right-2 top-8 flex items-center gap-1 rounded-full bg-black/50 px-1.5 py-0.5 backdrop-blur-sm">
                        <Clock className="h-2 w-2 text-white/50" />
                        <span className="text-[8px] text-white/50">{timeAgo(s.startedAt)}</span>
                      </div>

                      {/* Play button hover */}
                      <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                        <div className="flex h-14 w-14 items-center justify-center rounded-full bg-fuchsia-500/25 backdrop-blur-xl border border-fuchsia-400/30 shadow-[0_0_32px_rgba(168,85,247,0.4)]">
                          <Play className="h-6 w-6 text-white ml-0.5" />
                        </div>
                      </div>

                      {/* Host info overlay — bottom */}
                      <div className="absolute inset-x-0 bottom-0 p-3">
                        <div className="flex items-center gap-2.5">
                          {/* Avatar */}
                          {s.host.avatarUrl ? (
                            <img
                              src={resolveMediaUrl(s.host.avatarUrl) ?? undefined}
                              alt=""
                              className="h-9 w-9 shrink-0 rounded-full object-cover border-2 border-white/20 shadow-lg"
                            />
                          ) : (
                            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white/10 border-2 border-white/20">
                              <User className="h-4 w-4 text-white/40" />
                            </div>
                          )}
                          <div className="flex-1 min-w-0">
                            <p className="text-[13px] font-bold text-white truncate drop-shadow-lg">
                              {s.host.displayName || s.host.username}
                            </p>
                            {s.title ? (
                              <p className="text-[10px] text-white/60 truncate drop-shadow">{s.title}</p>
                            ) : s.host.bio ? (
                              <p className="text-[10px] text-white/50 truncate drop-shadow">{s.host.bio}</p>
                            ) : null}
                          </div>
                        </div>
                      </div>
                    </div>
                  </Link>
                );
              })}
            </div>
          </>
        )}
      </div>

      <style jsx>{`
        @keyframes shimmer {
          0% { transform: translateX(-100%); }
          100% { transform: translateX(300%); }
        }
      `}</style>
    </div>
  );
}
