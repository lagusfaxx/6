"use client";

import Link from "next/link";
import { resolveMediaUrl } from "../lib/api";
import { X, MapPin, ChevronLeft, ChevronRight } from "lucide-react";
import { useState } from "react";
import UserLevelBadge from "./UserLevelBadge";

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
    galleryUrls?: string[];
    serviceCategory?: string | null;
    bio?: string | null;
  };
  onClose: () => void;
};

export default function ProfilePreviewModal({ profile, onClose }: Props) {
  const images = [
    resolveMediaUrl(profile.coverUrl),
    resolveMediaUrl(profile.avatarUrl),
    ...(profile.galleryUrls || []).map((u) => resolveMediaUrl(u)),
  ].filter(Boolean) as string[];

  const [currentImage, setCurrentImage] = useState(0);
  const dist = profile.distance ?? profile.distanceKm;

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm" onClick={onClose}>
      <div
        className="relative w-full max-w-sm overflow-hidden rounded-3xl border border-white/[0.1] bg-[#0e0e12] shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Close */}
        <button
          type="button"
          onClick={onClose}
          className="absolute right-3 top-3 z-10 flex h-8 w-8 items-center justify-center rounded-full bg-black/50 text-white/80 backdrop-blur-xl"
        >
          <X className="h-4 w-4" />
        </button>

        {/* Image gallery */}
        <div className="relative aspect-[3/4] bg-white/5">
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
                    className="absolute left-2 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full bg-black/40 text-white/80"
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => setCurrentImage((i) => (i < images.length - 1 ? i + 1 : 0))}
                    className="absolute right-2 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full bg-black/40 text-white/80"
                  >
                    <ChevronRight className="h-4 w-4" />
                  </button>
                  {/* Dots */}
                  <div className="absolute bottom-3 left-1/2 flex -translate-x-1/2 gap-1.5">
                    {images.map((_, i) => (
                      <div
                        key={i}
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
                  {dist.toFixed(1)} km
                </span>
              )}
              {profile.availableNow && (
                <span className="flex items-center gap-1 text-emerald-400">
                  <span className="h-2 w-2 animate-pulse rounded-full bg-emerald-400" />
                  Disponible
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Bio */}
        {profile.bio && (
          <div className="px-4 py-3 text-xs text-white/55 line-clamp-3">{profile.bio}</div>
        )}

        {/* CTA */}
        <div className="p-4 pt-0">
          <Link
            href={`/profesional/${profile.id}`}
            onClick={onClose}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-fuchsia-600 to-violet-600 py-3 text-sm font-semibold transition hover:brightness-110"
          >
            Ver perfil completo
          </Link>
        </div>
      </div>
    </div>
  );
}
