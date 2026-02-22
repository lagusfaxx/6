"use client";

import Link from "next/link";
import { apiFetch, resolveMediaUrl } from "../lib/api";
import { X, MapPin, ChevronLeft, ChevronRight, MessageCircle, Eye, Tag, Briefcase, Loader2 } from "lucide-react";
import { useEffect, useState } from "react";
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
    profileTags?: string[] | null;
    serviceTags?: string[] | null;
  };
  onClose: () => void;
};

type FullProfile = {
  id: string;
  username: string;
  displayName: string | null;
  avatarUrl: string | null;
  coverUrl: string | null;
  description: string | null;
  age: number | null;
  city: string | null;
  serviceCategory: string | null;
  userLevel: string;
  profileTags: string[];
  serviceTags: string[];
  serviceStyleTags: string | null;
  normalizedTags: string[];
  gallery: { url: string; type: string }[];
  baseRate: number | null;
  heightCm: number | null;
  gender: string | null;
  availableNow?: boolean;
};

export default function ProfilePreviewModal({ profile, onClose }: Props) {
  const { me } = useMe();
  const isAuthed = Boolean(me?.user?.id);

  const [fullProfile, setFullProfile] = useState<FullProfile | null>(null);
  const [loadingFull, setLoadingFull] = useState(true);

  // Fetch full profile details
  useEffect(() => {
    let cancelled = false;
    setLoadingFull(true);
    apiFetch<any>(`/professionals/${profile.id}`)
      .then((res) => {
        if (cancelled) return;
        const p = res?.professional || res;
        setFullProfile({
          id: p.id,
          username: p.username || profile.username,
          displayName: p.displayName || p.name || profile.displayName,
          avatarUrl: p.avatarUrl,
          coverUrl: p.coverUrl,
          description: p.description || p.bio || null,
          age: p.age || profile.age || null,
          city: p.city || null,
          serviceCategory: p.serviceCategory || p.serviceSummary || profile.serviceCategory || null,
          userLevel: p.userLevel || profile.userLevel || "SILVER",
          profileTags: p.profileTags || p.normalizedTags?.filter((_: any, i: number) => i < 10) || profile.profileTags || [],
          serviceTags: p.serviceTags || profile.serviceTags || [],
          serviceStyleTags: p.serviceStyleTags || null,
          normalizedTags: p.normalizedTags || [],
          gallery: (p.gallery || []).map((g: any) => ({
            url: typeof g === "string" ? g : g.url,
            type: typeof g === "string" ? "IMAGE" : (g.type || "IMAGE"),
          })),
          baseRate: p.baseRate || null,
          heightCm: p.heightCm || null,
          gender: p.gender || null,
          availableNow: p.isOnline || p.availableNow || profile.availableNow,
        });
      })
      .catch(() => {
        if (!cancelled) setFullProfile(null);
      })
      .finally(() => {
        if (!cancelled) setLoadingFull(false);
      });
    return () => { cancelled = true; };
  }, [profile.id]);

  // Images: combine cover, avatar, and gallery
  const galleryImages = fullProfile?.gallery
    ?.map((g) => resolveMediaUrl(g.url))
    .filter(Boolean) as string[] || [];

  const fallbackImages = [
    resolveMediaUrl(profile.coverUrl),
    resolveMediaUrl(profile.avatarUrl),
    ...(profile.galleryUrls || []).map((u) => resolveMediaUrl(u)),
  ].filter(Boolean) as string[];

  const images = galleryImages.length > 0
    ? [resolveMediaUrl(fullProfile?.coverUrl || profile.coverUrl), resolveMediaUrl(fullProfile?.avatarUrl || profile.avatarUrl), ...galleryImages].filter(Boolean) as string[]
    : fallbackImages;

  // Deduplicate
  const uniqueImages = [...new Set(images)];

  const [currentImage, setCurrentImage] = useState(0);
  const dist = profile.distance ?? profile.distanceKm;

  const chatHref = isAuthed
    ? `/chats?user=${profile.userId || profile.id}`
    : `/login?next=${encodeURIComponent(`/chats?user=${profile.userId || profile.id}`)}`;

  const profileHref = `/profesional/${profile.id}`;

  const tierGlow =
    (fullProfile?.userLevel || profile.userLevel) === "DIAMOND"
      ? "shadow-[0_0_30px_rgba(34,211,238,0.15)]"
      : (fullProfile?.userLevel || profile.userLevel) === "GOLD"
      ? "shadow-[0_0_30px_rgba(251,191,36,0.15)]"
      : "";

  const displayTags = fullProfile?.profileTags?.length
    ? fullProfile.profileTags
    : (fullProfile?.normalizedTags?.length ? fullProfile.normalizedTags : (profile.profileTags || []));

  const displayServiceTags = fullProfile?.serviceTags?.length
    ? fullProfile.serviceTags
    : (profile.serviceTags || []);

  // Parse serviceStyleTags if tags arrays are empty
  const parsedStyleTags = (!displayServiceTags.length && fullProfile?.serviceStyleTags)
    ? fullProfile.serviceStyleTags.split(",").map(t => t.trim()).filter(Boolean)
    : [];

  const allServiceTags = displayServiceTags.length > 0 ? displayServiceTags : parsedStyleTags;

  return (
    <div className="fixed inset-0 z-[70] flex items-end sm:items-center justify-center bg-black/80 p-0 sm:p-4 backdrop-blur-sm" onClick={onClose}>
      <div
        className={`relative w-full sm:max-w-md overflow-hidden rounded-t-3xl sm:rounded-3xl border border-white/[0.1] bg-[#0e0e12] ${tierGlow} max-h-[90vh] sm:max-h-[85vh] flex flex-col`}
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

        {/* Main image with navigation */}
        <div className="relative w-full h-[35vh] sm:h-[40vh] bg-white/5 shrink-0">
          {uniqueImages.length > 0 ? (
            <>
              <img
                src={uniqueImages[currentImage % uniqueImages.length]}
                alt={profile.displayName || profile.username}
                className="h-full w-full object-cover"
              />
              {uniqueImages.length > 1 && (
                <>
                  <button
                    type="button"
                    onClick={() => setCurrentImage((i) => (i > 0 ? i - 1 : uniqueImages.length - 1))}
                    className="absolute left-2 top-1/2 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-full bg-black/40 text-white/80 hover:bg-black/60 transition"
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => setCurrentImage((i) => (i < uniqueImages.length - 1 ? i + 1 : 0))}
                    className="absolute right-2 top-1/2 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-full bg-black/40 text-white/80 hover:bg-black/60 transition"
                  >
                    <ChevronRight className="h-4 w-4" />
                  </button>
                  {/* Progress dots */}
                  <div className="absolute bottom-3 left-1/2 flex -translate-x-1/2 gap-1.5">
                    {uniqueImages.slice(0, 8).map((_, i) => (
                      <button
                        key={i}
                        type="button"
                        onClick={() => setCurrentImage(i)}
                        className={`h-1.5 rounded-full transition-all ${i === currentImage ? "w-4 bg-white/80" : "w-1.5 bg-white/30"}`}
                      />
                    ))}
                    {uniqueImages.length > 8 && (
                      <span className="text-[9px] text-white/50 ml-1">+{uniqueImages.length - 8}</span>
                    )}
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
          <div className="absolute inset-0 bg-gradient-to-t from-[#0e0e12] via-transparent to-transparent" />

          {/* Info overlay */}
          <div className="absolute bottom-0 left-0 right-0 p-4">
            <div className="flex items-center gap-2">
              <h3 className="text-lg font-bold sm:text-xl">
                {fullProfile?.displayName || profile.displayName || profile.username}
                {(fullProfile?.age || profile.age) ? `, ${fullProfile?.age || profile.age}` : ""}
              </h3>
              <UserLevelBadge level={(fullProfile?.userLevel || profile.userLevel) as any} className="px-2 py-0.5 text-[10px]" />
            </div>
            {(fullProfile?.serviceCategory || profile.serviceCategory) && (
              <div className="mt-1 text-xs text-white/60">{fullProfile?.serviceCategory || profile.serviceCategory}</div>
            )}
            <div className="mt-1 flex items-center gap-3 text-xs text-white/50">
              {dist != null && (
                <span className="flex items-center gap-1">
                  <MapPin className="h-3 w-3" />
                  {dist < 1 ? `${Math.round(dist * 1000)}m` : `${dist.toFixed(1)} km`}
                </span>
              )}
              {fullProfile?.city && <span>{fullProfile.city}</span>}
              {(fullProfile?.availableNow || profile.availableNow) && (
                <span className="flex items-center gap-1 text-emerald-400">
                  <span className="h-2 w-2 animate-pulse rounded-full bg-emerald-400" />
                  Disponible
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Scrollable content - no tabs, everything in one view */}
        <div className="flex-1 overflow-y-auto min-h-0">
          {loadingFull && (
            <div className="flex items-center justify-center py-6">
              <Loader2 className="h-5 w-5 animate-spin text-fuchsia-400" />
            </div>
          )}

          <div className="p-4 space-y-4">
            {/* Bio */}
            {(fullProfile?.description || profile.bio) && (
              <div>
                <p className="text-xs text-white/60 leading-relaxed line-clamp-4">{fullProfile?.description || profile.bio}</p>
              </div>
            )}

            {/* Profile tags */}
            {displayTags.length > 0 && (
              <div>
                <div className="flex items-center gap-1.5 mb-2">
                  <Tag className="h-3.5 w-3.5 text-fuchsia-400" />
                  <span className="text-xs font-semibold text-white/80">¿Cómo define su perfil?</span>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {displayTags.map((tag) => (
                    <span
                      key={tag}
                      className="rounded-full border border-fuchsia-500/20 bg-fuchsia-500/10 px-2.5 py-1 text-[11px] font-medium text-fuchsia-300"
                    >
                      {tag}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Service tags */}
            {allServiceTags.length > 0 && (
              <div>
                <div className="flex items-center gap-1.5 mb-2">
                  <Briefcase className="h-3.5 w-3.5 text-violet-400" />
                  <span className="text-xs font-semibold text-white/80">Servicios que ofrece</span>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {allServiceTags.map((tag) => (
                    <span
                      key={tag}
                      className="rounded-full border border-violet-500/20 bg-violet-500/10 px-2.5 py-1 text-[11px] font-medium text-violet-300"
                    >
                      {tag}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Quick stats */}
            {(fullProfile?.baseRate || fullProfile?.heightCm) && (
              <div className="flex gap-3">
                {fullProfile.baseRate && (
                  <div className="rounded-xl border border-white/[0.08] bg-white/[0.03] px-3 py-2 text-center">
                    <div className="text-sm font-bold text-white">${fullProfile.baseRate.toLocaleString()}</div>
                    <div className="text-[10px] text-white/40">Desde</div>
                  </div>
                )}
                {fullProfile.heightCm && (
                  <div className="rounded-xl border border-white/[0.08] bg-white/[0.03] px-3 py-2 text-center">
                    <div className="text-sm font-bold text-white">{fullProfile.heightCm} cm</div>
                    <div className="text-[10px] text-white/40">Estatura</div>
                  </div>
                )}
              </div>
            )}

            {/* Gallery grid - always visible, no tab needed */}
            {uniqueImages.length > 1 && (
              <div>
                <div className="grid grid-cols-3 gap-1.5">
                  {uniqueImages.map((src, i) => (
                    <button
                      key={i}
                      type="button"
                      onClick={() => setCurrentImage(i)}
                      className={`group relative aspect-square overflow-hidden rounded-lg bg-white/5 ${
                        i === currentImage ? "ring-2 ring-fuchsia-500/50" : ""
                      }`}
                    >
                      <img
                        src={src}
                        alt=""
                        className="h-full w-full object-cover transition group-hover:scale-105"
                      />
                      <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition" />
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* No content fallback */}
            {!loadingFull && displayTags.length === 0 && allServiceTags.length === 0 && !fullProfile?.description && !profile.bio && uniqueImages.length <= 1 && (
              <div className="py-4 text-center text-xs text-white/30">
                Visita el perfil completo para más información
              </div>
            )}
          </div>
        </div>

        {/* CTAs */}
        <div className="flex gap-2 p-4 pt-2 border-t border-white/[0.06] shrink-0">
          <Link
            href={chatHref}
            onClick={onClose}
            className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-fuchsia-600 to-violet-600 py-3 text-sm font-semibold transition hover:brightness-110 shadow-[0_8px_24px_rgba(168,85,247,0.3)]"
          >
            <MessageCircle className="h-4 w-4" />
            Enviar mensaje
          </Link>
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
