"use client";

import Link from "next/link";
import { resolveMediaUrl } from "../lib/api";
import { X, MapPin, ChevronLeft, ChevronRight, MessageCircle, Eye } from "lucide-react";
import { useState } from "react";
import UserLevelBadge from "./UserLevelBadge";
import useMe from "../hooks/useMe";

type Props = {
  profile: {
    id: string;
    displayName: string | null;
    username: string;
    avatarUrl: string | null;
    coverUrl: string | null;
    age?: number | null;
    distance?: number | null;
    distanceKm?: number | null;
    availableNow?: boolean;
    userLevel?: string;
    galleryUrls?: string[] | null;
    serviceCategory?: string | null;
    bio?: string | null;
    userId?: string | null;
  };
  onClose: () => void;
};

export default function ProfilePreviewModal({ profile, onClose }: Props) {
  const { me } = useMe();
  const isAuthed = Boolean(me?.user?.id);

  const images = [
    resolveMediaUrl(profile.coverUrl),
    resolveMediaUrl(profile.avatarUrl),
    ...(profile.galleryUrls || []).map((u) => resolveMediaUrl(u)),
  ].filter(Boolean) as string[];

  const [currentImage, setCurrentImage] = useState(0);
  const dist = profile.distance ?? profile.distanceKm;

  const chatHref = isAuthed
    ? `/chats?user=${profile.userId || profile.id}`
    : `/login?next=${encodeURIComponent(`/chats?user=${profile.userId || profile.id}`)}`;

  const profileHref = `/profesional/${profile.id}`;

  const tierGlow =
    profile.userLevel === "DIAMOND"
      ? "shadow-[0_0_30px_rgba(34,211,238,0.15)]"
      : profile.userLevel === "GOLD"
      ? "shadow-[0_0_30px_rgba(251,191,36,0.15)]"
      : "";

  return (
    <div className="fixed inset-0 z-[70] flex items-end sm:items-center justify-center bg-black/80 p-0 sm:p-4 backdrop-blur-sm" onClick={onClose}>
      <div
        className={`relative w-full max-w-sm overflow-hidden rounded-t-3xl sm:rounded-3xl border border-white/[0.1] bg-[#0e0e12] ${tierGlow}`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Close */}
        <button
          type="button"
          onClick={onClose}
          className="absolute right-3 top-3 z-10 flex h-8 w-8 items-center justify-center rounded-full bg-black/50 text-white/80 backdrop-blur-xl hover:bg-black/70 transition"
        >
          <X className="h-4 w-4" />
        </button>

        {/* Image gallery */}
        <div className="relative aspect-[3/4] max-h-[55vh] bg-white/5">
          {images.length > 0 ? (
            <>
              <img
                src={images[currentImage]}
                alt={profile.displayName || profile.username}
                className="h-full w-full object-cover"
              />
              {images.length > 1 && (
                <>
                  <button
                    type="button"
                    onClick={() => setCurrentImage((i) => (i > 0 ? i - 1 : images.length - 1))}
                    className="absolute left-2 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full bg-black/40 text-white/80 hover:bg-black/60 transition"
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => setCurrentImage((i) => (i < images.length - 1 ? i + 1 : 0))}
                    className="absolute right-2 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full bg-black/40 text-white/80 hover:bg-black/60 transition"
                  >
                    <ChevronRight className="h-4 w-4" />
                  </button>
                  {/* Progress dots */}
                  <div className="absolute bottom-3 left-1/2 flex -translate-x-1/2 gap-1.5">
                    {images.slice(0, 8).map((_, i) => (
                      <button
                        key={i}
                        type="button"
                        onClick={() => setCurrentImage(i)}
                        className={`h-1.5 rounded-full transition-all ${i === currentImage ? "w-4 bg-white/80" : "w-1.5 bg-white/30"}`}
                      />
                    ))}
                  </div>
                </>
              )}
            </>
          ) : (
            <div className="flex h-full items-center justify-center">
              <img src="/brand/isotipo-new.png" alt="" className="h-20 w-20 opacity-30" />
            </div>
          )}

          {/* Overlay gradient */}
          <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent" />

          {/* Info overlay */}
          <div className="absolute bottom-0 left-0 right-0 p-4">
            <div className="flex items-center gap-2">
              <h3 className="text-xl font-bold">
                {profile.displayName || profile.username}
                {profile.age ? `, ${profile.age}` : ""}
              </h3>
              <UserLevelBadge level={profile.userLevel as any} className="px-2 py-0.5 text-[10px]" />
            </div>
            {profile.serviceCategory && (
              <div className="mt-1 text-xs text-white/60">{profile.serviceCategory}</div>
            )}
            <div className="mt-1 flex items-center gap-3 text-xs text-white/50">
              {dist != null && (
                <span className="flex items-center gap-1">
                  <MapPin className="h-3 w-3" />
                  {dist < 1 ? `${Math.round(dist * 1000)}m` : `${dist.toFixed(1)} km`}
                </span>
              )}
              {profile.availableNow && (
                <span className="flex items-center gap-1 text-emerald-400">
                  <span className="h-2 w-2 animate-pulse rounded-full bg-emerald-400" />
                  Disponible ahora
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Bio */}
        {profile.bio && (
          <div className="px-4 py-3 text-xs text-white/55 line-clamp-3">{profile.bio}</div>
        )}

        {/* CTAs - Conversion focused */}
        <div className="flex gap-2 p-4 pt-2">
          {/* Primary CTA: Send message */}
          <Link
            href={chatHref}
            onClick={onClose}
            className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-fuchsia-600 to-violet-600 py-3 text-sm font-semibold transition hover:brightness-110 shadow-[0_8px_24px_rgba(168,85,247,0.3)]"
          >
            <MessageCircle className="h-4 w-4" />
            Enviar mensaje
          </Link>
          {/* Secondary CTA: View profile */}
          <Link
            href={profileHref}
            onClick={onClose}
            className="flex items-center justify-center gap-1.5 rounded-xl border border-white/15 bg-white/[0.06] px-4 py-3 text-sm font-medium text-white/80 transition hover:bg-white/[0.1]"
          >
            <Eye className="h-4 w-4" />
            Perfil
          </Link>
        </div>
      </div>
    </div>
  );
}
