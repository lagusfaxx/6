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
  Sparkles,
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
          {/* Ambient glow */}
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
                  <span className="text-sm font-semibold">Estás en vivo — Volver al stream</span>
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
                {/* Shimmer */}
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
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-56 animate-pulse rounded-2xl bg-white/[0.03] border border-white/[0.04]" />
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
              Vuelve más tarde o sigue a tus profesionales favoritas para no perderte nada
            </p>
          </div>
        ) : (
          <>
            {/* Section label */}
            <div className="mb-3 flex items-center gap-2">
              <Flame className="h-3.5 w-3.5 text-red-400" />
              <span className="text-xs font-semibold text-white/50">
                {streams.length} transmisi{streams.length === 1 ? "ón" : "ones"} en vivo
              </span>
            </div>

            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {streams.map((s) => (
                <Link
                  key={s.id}
                  href={`/live/${s.id}`}
                  className="group relative overflow-hidden rounded-2xl border border-white/[0.08] bg-white/[0.02] transition-all duration-200 hover:border-fuchsia-500/20 hover:bg-white/[0.04] hover:shadow-[0_0_30px_rgba(168,85,247,0.06)]"
                >
                  {/* Hover glow */}
                  <div className="pointer-events-none absolute inset-0 rounded-2xl bg-gradient-to-b from-fuchsia-500/[0.02] to-transparent opacity-0 transition-opacity group-hover:opacity-100" />

                  {/* Thumbnail area */}
                  <div className="relative flex h-40 items-center justify-center bg-gradient-to-br from-fuchsia-500/[0.06] to-violet-500/[0.04]">
                    {s.host.avatarUrl ? (
                      <img
                        src={resolveMediaUrl(s.host.avatarUrl) ?? undefined}
                        alt=""
                        className="h-full w-full object-cover opacity-60 group-hover:opacity-75 transition-opacity duration-300"
                      />
                    ) : (
                      <Radio className="h-12 w-12 text-fuchsia-400/20" />
                    )}

                    {/* Overlay gradient */}
                    <div className="absolute inset-0 bg-gradient-to-t from-[#070816] via-[#070816]/30 to-transparent" />

                    {/* LIVE badge */}
                    <div className="absolute left-3 top-3 flex items-center gap-1.5 rounded-full border border-red-500/30 bg-[#070816]/80 px-2.5 py-1 backdrop-blur-xl">
                      <span className="relative flex h-2 w-2">
                        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-400 opacity-75" />
                        <span className="relative inline-flex h-2 w-2 rounded-full bg-red-500" />
                      </span>
                      <span className="text-[10px] font-bold text-red-300">LIVE</span>
                    </div>

                    {/* Viewers */}
                    <div className="absolute right-3 top-3 flex items-center gap-1 rounded-full border border-white/10 bg-[#070816]/80 px-2.5 py-1 backdrop-blur-xl">
                      <Users className="h-3 w-3 text-white/50" />
                      <span className="text-[10px] font-medium text-white/50">{s.viewerCount}</span>
                    </div>

                    {/* Duration */}
                    <div className="absolute left-3 bottom-3 flex items-center gap-1 text-[10px] text-white/40">
                      <Clock className="h-3 w-3" />
                      {timeAgo(s.startedAt)}
                    </div>

                    {/* Play overlay */}
                    <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-fuchsia-500/20 backdrop-blur-xl border border-fuchsia-500/30 shadow-[0_0_24px_rgba(168,85,247,0.3)]">
                        <Play className="h-5 w-5 text-white ml-0.5" />
                      </div>
                    </div>
                  </div>

                  {/* Info */}
                  <div className="relative p-4">
                    <div className="flex items-center gap-3">
                      {s.host.avatarUrl ? (
                        <img
                          src={resolveMediaUrl(s.host.avatarUrl) ?? undefined}
                          alt=""
                          className="h-10 w-10 rounded-xl object-cover border border-white/10"
                        />
                      ) : (
                        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/[0.06] border border-white/10">
                          <User className="h-5 w-5 text-white/30" />
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold truncate group-hover:text-fuchsia-300 transition-colors">
                          {s.host.displayName || s.host.username}
                        </p>
                        {s.title && (
                          <p className="text-[11px] text-white/35 truncate">{s.title}</p>
                        )}
                      </div>
                    </div>
                  </div>
                </Link>
              ))}
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
