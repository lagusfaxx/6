"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Video, ChevronRight, MapPin } from "lucide-react";
import { apiFetch, resolveMediaUrl } from "../../lib/api";
import { filterUserTags } from "../../lib/systemBadges";
import UserLevelBadge from "../../components/UserLevelBadge";

type VideoChatProfile = {
  id: string;
  username: string;
  displayName: string;
  avatarUrl: string | null;
  coverUrl: string | null;
  age: number | null;
  city: string | null;
  bio: string | null;
  isOnline: boolean;
  profileTags: string[];
  serviceTags: string[];
  profileViews: number;
  videocallActive: boolean;
  videocallPrice: number | null;
  isLive: boolean;
  liveStreamId: string | null;
  liveViewers: number;
  userLevel: string;
};

export default function VideoChatPage() {
  const [profiles, setProfiles] = useState<VideoChatProfile[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    apiFetch<{ profiles: VideoChatProfile[] }>("/directory/videochat?limit=48")
      .then((r) => setProfiles(r?.profiles ?? []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="min-h-screen bg-[#0e0e12] text-white">
      {/* Header */}
      <div className="mx-auto max-w-6xl px-4 pt-8 pb-4">
        <div className="flex items-center gap-3 mb-2">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-violet-500/20 to-fuchsia-500/20 border border-violet-500/20">
            <Video className="h-5 w-5 text-violet-400" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Video Chat</h1>
            <p className="text-sm text-white/40">Conecta por videollamada o live — solo contenido virtual, sin encuentros presenciales</p>
          </div>
        </div>
      </div>

      {/* Grid */}
      <div className="mx-auto max-w-6xl px-4 pb-12">
        {loading ? (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="aspect-[3/4] animate-pulse rounded-2xl bg-white/[0.04]" />
            ))}
          </div>
        ) : profiles.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <Video className="h-12 w-12 text-white/10 mb-4" />
            <p className="text-white/40 text-sm">Aún no hay perfiles de Video Chat disponibles</p>
            <p className="text-white/25 text-xs mt-1">Pronto tendremos creadoras conectándose aquí</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
            {profiles.map((p) => (
              <article key={p.id} className="group relative overflow-hidden rounded-2xl border border-white/[0.06] bg-white/[0.02] transition-all duration-300 hover:-translate-y-1 hover:border-violet-500/25 hover:shadow-[0_12px_32px_rgba(139,92,246,0.1)]">
                <Link href={p.isLive ? `/live/${p.liveStreamId}` : `/profesional/${p.id}`} className="block">
                  <div className="relative aspect-[3/4] overflow-hidden bg-[#0a0a10]">
                    {(p.coverUrl || p.avatarUrl) ? (
                      <img
                        src={resolveMediaUrl(p.coverUrl || p.avatarUrl) ?? undefined}
                        alt={p.displayName}
                        className="h-full w-full object-cover transition-transform duration-400 group-hover:scale-105"
                        loading="lazy"
                        decoding="async"
                        onError={(e) => { (e.currentTarget as HTMLImageElement).src = "/brand/isotipo-new.png"; }}
                      />
                    ) : (
                      <div className="flex h-full items-center justify-center">
                        <Video className="h-10 w-10 text-white/[0.06]" />
                      </div>
                    )}

                    {/* Status badges */}
                    {p.isOnline && !p.isLive && (
                      <div className="absolute top-2 left-2 z-[3] flex items-center gap-1 rounded-full bg-emerald-500/90 px-2 py-0.5 text-[10px] font-bold text-white">
                        <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-white" /> Online
                      </div>
                    )}
                    {p.isLive && (
                      <div className="absolute top-2 left-2 z-[3] flex items-center gap-1 rounded-full bg-red-600/90 px-2 py-0.5 text-[10px] font-bold text-white">
                        <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-white" /> LIVE
                        <span className="ml-0.5 text-white/70">{p.liveViewers}</span>
                      </div>
                    )}

                    <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent" />

                    {/* Info overlay */}
                    <div className="absolute bottom-0 left-0 right-0 p-3 z-[3]">
                      <div className="flex items-center gap-1 truncate text-sm font-bold">
                        {p.displayName}{p.age ? `, ${p.age}` : ""}
                      </div>
                      {p.city && (
                        <p className="mt-0.5 text-[10px] text-white/40 flex items-center gap-1">
                          <MapPin className="h-2.5 w-2.5 text-violet-400/50" />{p.city}
                        </p>
                      )}
                      {p.videocallActive && p.videocallPrice && (
                        <div className="mt-1 flex items-center gap-1 text-[10px] text-violet-300/80">
                          <Video className="h-3 w-3" /> {p.videocallPrice} tokens/min
                        </div>
                      )}
                      {(filterUserTags(p.profileTags).length > 0) && (
                        <div className="flex flex-wrap gap-1 mt-1">
                          {filterUserTags(p.profileTags).slice(0, 2).map((tag: string) => (
                            <span key={`pt-${tag}`} className="rounded-full bg-violet-500/15 border border-violet-500/20 px-1.5 py-0.5 text-[8px] text-violet-300">{tag}</span>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                </Link>
              </article>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
