"use client";

import Link from "next/link";
import { apiFetch, resolveMediaUrl } from "../lib/api";
import { X, MapPin, ChevronLeft, ChevronRight, MessageCircle, Eye, Tag, Loader2, Sparkles, ShoppingBag, CalendarCheck, ShieldCheck, Phone, Ruler, DollarSign } from "lucide-react";
import { useEffect, useState } from "react";
import UserLevelBadge from "./UserLevelBadge";
import { filterUserTags, hasPremiumBadge, hasVerifiedBadge } from "../lib/systemBadges";
import StatusBadgeIcon from "./StatusBadgeIcon";
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
    profileType?: "PROFESSIONAL" | "ESTABLISHMENT" | "SHOP" | "CREATOR" | string | null;
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
  phone: string | null;
  availableNow?: boolean;
};

function formatWhatsAppUrl(phone: string, displayName?: string | null) {
  const cleaned = phone.replace(/[^0-9+]/g, "");
  const num = cleaned.startsWith("+") ? cleaned.slice(1) : cleaned;
  const message = displayName
    ? `Hola ${displayName}, te vi en Uzeed.cl`
    : "Hola, te vi en Uzeed.cl";
  return `https://wa.me/${num}?text=${encodeURIComponent(message)}`;
}

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
          phone: p.phone || null,
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
    ? `/chat/${profile.userId || profile.id}`
    : `/login?next=${encodeURIComponent(`/chat/${profile.userId || profile.id}`)}`;

  const pType = profile.profileType || "PROFESSIONAL";
  const isEstablishment = pType === "ESTABLISHMENT";
  const isShop = pType === "SHOP";
  const isProfessional = !isEstablishment && !isShop;

  const profileHref = isEstablishment
    ? `/hospedaje/${profile.id}`
    : isShop
      ? `/sexshop/${profile.username}`
      : `/profesional/${profile.id}`;

  const userLevel = fullProfile?.userLevel || profile.userLevel;
  const tierGlow =
    userLevel === "DIAMOND"
      ? "shadow-[0_0_60px_rgba(34,211,238,0.12),0_0_120px_rgba(34,211,238,0.06)]"
      : userLevel === "GOLD"
      ? "shadow-[0_0_60px_rgba(251,191,36,0.12),0_0_120px_rgba(251,191,36,0.06)]"
      : "shadow-[0_0_60px_rgba(168,85,247,0.08)]";
  const tierBorderAccent =
    userLevel === "DIAMOND"
      ? "border-cyan-400/20"
      : userLevel === "GOLD"
      ? "border-amber-400/20"
      : "border-white/[0.08]";

  const rawDisplayTags = fullProfile?.profileTags?.length
    ? fullProfile.profileTags
    : (fullProfile?.normalizedTags?.length ? fullProfile.normalizedTags : (profile.profileTags || []));

  const displayTags = filterUserTags(rawDisplayTags);

  // System badges only live in profileTags, not in normalizedTags
  const allProfileTags = fullProfile?.profileTags?.length
    ? fullProfile.profileTags
    : (profile.profileTags || []);

  const displayServiceTags = fullProfile?.serviceTags?.length
    ? fullProfile.serviceTags
    : (profile.serviceTags || []);

  // Parse serviceStyleTags if tags arrays are empty
  const parsedStyleTags = (!displayServiceTags.length && fullProfile?.serviceStyleTags)
    ? fullProfile.serviceStyleTags.split(",").map(t => t.trim()).filter(Boolean)
    : [];

  const allServiceTags = displayServiceTags.length > 0 ? displayServiceTags : parsedStyleTags;

  return (
    <div className="fixed inset-0 z-[70] flex items-end sm:items-center justify-center bg-black/70 p-0 sm:p-5 backdrop-blur-xl" onClick={onClose}>
      <div
        className={`relative w-full sm:max-w-[440px] overflow-hidden rounded-t-[28px] sm:rounded-[24px] border ${tierBorderAccent} bg-[#0a0a12]/95 backdrop-blur-2xl ${tierGlow} max-h-[92vh] sm:max-h-[88vh] flex flex-col`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Ambient glow effect at top */}
        <div className="pointer-events-none absolute inset-x-0 top-0 h-40 bg-gradient-to-b from-fuchsia-500/[0.04] to-transparent" />

        {/* Close button */}
        <button
          type="button"
          onClick={onClose}
          className="absolute right-3 top-3 z-20 flex h-9 w-9 items-center justify-center rounded-full border border-white/10 bg-black/40 text-white/70 backdrop-blur-2xl transition-all hover:bg-white/10 hover:text-white hover:border-white/20 hover:scale-105"
        >
          <X className="h-4 w-4" />
        </button>

        {/* ─── Hero Image Section ─── */}
        <div className="relative w-full h-[38vh] sm:h-[42vh] shrink-0 overflow-hidden">
          {uniqueImages.length > 0 ? (
            <>
              <img
                src={uniqueImages[currentImage % uniqueImages.length]}
                alt={profile.displayName || profile.username}
                fetchPriority={currentImage === 0 ? "high" : "low"}
                decoding="async"
                className="h-full w-full object-cover transition-all duration-500"
              />
              {/* Blurred backdrop layer */}
              <div className="absolute inset-0 bg-gradient-to-t from-[#0a0a12] via-[#0a0a12]/40 to-black/20" />

              {uniqueImages.length > 1 && (
                <>
                  <button
                    type="button"
                    onClick={() => setCurrentImage((i) => (i > 0 ? i - 1 : uniqueImages.length - 1))}
                    className="absolute left-3 top-1/2 z-10 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full border border-white/10 bg-black/30 text-white/80 backdrop-blur-xl transition-all hover:bg-white/15 hover:scale-105"
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => setCurrentImage((i) => (i < uniqueImages.length - 1 ? i + 1 : 0))}
                    className="absolute right-3 top-1/2 z-10 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full border border-white/10 bg-black/30 text-white/80 backdrop-blur-xl transition-all hover:bg-white/15 hover:scale-105"
                  >
                    <ChevronRight className="h-4 w-4" />
                  </button>
                  {/* Progress bar segments */}
                  <div className="absolute top-3 left-14 right-14 z-10 flex gap-1">
                    {uniqueImages.slice(0, 10).map((_, i) => (
                      <button
                        key={i}
                        type="button"
                        onClick={() => setCurrentImage(i)}
                        className={`h-[3px] flex-1 rounded-full transition-all duration-300 ${i === currentImage ? "bg-white/90 shadow-[0_0_6px_rgba(255,255,255,0.3)]" : "bg-white/20"}`}
                      />
                    ))}
                  </div>
                  {uniqueImages.length > 10 && (
                    <span className="absolute top-3 right-14 z-10 text-[9px] text-white/40">+{uniqueImages.length - 10}</span>
                  )}
                </>
              )}
            </>
          ) : (
            <div className="flex h-full items-center justify-center bg-gradient-to-br from-fuchsia-900/20 to-violet-900/20">
              <img src="/brand/isotipo-new.png" alt="" className="h-20 w-20 opacity-20" />
            </div>
          )}

          {/* ─── Profile Info Overlay ─── */}
          <div className="absolute bottom-0 left-0 right-0 p-5 z-[5]">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <h3 className="text-xl font-bold tracking-tight sm:text-2xl leading-tight">
                    {fullProfile?.displayName || profile.displayName || profile.username}
                    {(fullProfile?.age || profile.age) ? <span className="font-normal text-white/60">, {fullProfile?.age || profile.age}</span> : ""}
                  </h3>
                  {hasPremiumBadge(allProfileTags) && <StatusBadgeIcon type="premium" size="h-5 w-5" />}
                  {hasVerifiedBadge(allProfileTags) && <StatusBadgeIcon type="verificada" size="h-5 w-5" />}
                </div>
                {(fullProfile?.serviceCategory || profile.serviceCategory) && (
                  <p className="mt-0.5 text-sm text-white/50 font-medium">{fullProfile?.serviceCategory || profile.serviceCategory}</p>
                )}
              </div>
              <UserLevelBadge level={userLevel as any} className="shrink-0 px-2.5 py-1 text-[10px] shadow-lg" />
            </div>
            {/* Status pills row */}
            <div className="mt-2.5 flex flex-wrap items-center gap-2">
              {(fullProfile?.availableNow || profile.availableNow) && (
                <span className="flex items-center gap-1.5 rounded-full border border-emerald-400/30 bg-emerald-500/15 px-2.5 py-1 text-[11px] font-semibold text-emerald-300 backdrop-blur-sm">
                  <span className="relative flex h-2 w-2"><span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-60" /><span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-400" /></span>
                  Disponible
                </span>
              )}
              {dist != null && (
                <span className="flex items-center gap-1 rounded-full border border-white/10 bg-white/[0.06] px-2.5 py-1 text-[11px] text-white/60 backdrop-blur-sm">
                  <MapPin className="h-3 w-3 text-fuchsia-400/70" />
                  {dist < 1 ? `${Math.round(dist * 1000)}m` : `${dist.toFixed(1)} km`}
                </span>
              )}
              {fullProfile?.city && (
                <span className="flex items-center gap-1 rounded-full border border-white/10 bg-white/[0.06] px-2.5 py-1 text-[11px] text-white/60 backdrop-blur-sm">
                  {fullProfile.city}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* ─── Scrollable Content ─── */}
        <div className="flex-1 overflow-y-auto min-h-0">
          {loadingFull && (
            <div className="flex items-center justify-center py-8">
              <div className="flex flex-col items-center gap-2">
                <Loader2 className="h-5 w-5 animate-spin text-fuchsia-400" />
                <span className="text-[10px] text-white/30 tracking-wider uppercase">Cargando perfil</span>
              </div>
            </div>
          )}

          <div className="p-5 space-y-5">
            {/* ─── Quick Stats Bar ─── */}
            {(fullProfile?.baseRate || fullProfile?.heightCm) && (
              <div className="grid grid-cols-2 gap-2.5">
                {fullProfile.baseRate && (
                  <div className="relative overflow-hidden rounded-2xl border border-fuchsia-500/15 bg-gradient-to-br from-fuchsia-500/[0.08] to-violet-500/[0.04] p-3.5">
                    <div className="absolute top-0 right-0 h-16 w-16 rounded-full bg-fuchsia-500/[0.06] blur-2xl" />
                    <div className="flex items-center gap-2">
                      <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-fuchsia-500/15">
                        <DollarSign className="h-4 w-4 text-fuchsia-400" />
                      </div>
                      <div>
                        <div className="text-base font-bold tracking-tight">${fullProfile.baseRate.toLocaleString()}</div>
                        <div className="text-[10px] text-white/35 font-medium uppercase tracking-wider">Desde</div>
                      </div>
                    </div>
                  </div>
                )}
                {fullProfile.heightCm && (
                  <div className="relative overflow-hidden rounded-2xl border border-violet-500/15 bg-gradient-to-br from-violet-500/[0.08] to-indigo-500/[0.04] p-3.5">
                    <div className="absolute top-0 right-0 h-16 w-16 rounded-full bg-violet-500/[0.06] blur-2xl" />
                    <div className="flex items-center gap-2">
                      <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-violet-500/15">
                        <Ruler className="h-4 w-4 text-violet-400" />
                      </div>
                      <div>
                        <div className="text-base font-bold tracking-tight">{fullProfile.heightCm} cm</div>
                        <div className="text-[10px] text-white/35 font-medium uppercase tracking-wider">Estatura</div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* ─── Bio ─── */}
            {(fullProfile?.description || profile.bio) && (
              <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-4">
                <p className="text-[13px] text-white/55 leading-relaxed line-clamp-4">{fullProfile?.description || profile.bio}</p>
              </div>
            )}

            {/* ─── Profile Tags ─── */}
            {displayTags.length > 0 && (
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <div className="flex h-6 w-6 items-center justify-center rounded-lg bg-fuchsia-500/10">
                    <Tag className="h-3 w-3 text-fuchsia-400" />
                  </div>
                  <span className="text-[11px] font-bold text-white/70 uppercase tracking-wider">Perfil</span>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {displayTags.map((tag) => (
                    <span
                      key={tag}
                      className="rounded-xl border border-fuchsia-500/20 bg-fuchsia-500/[0.08] px-3 py-1.5 text-[11px] font-medium text-fuchsia-300/90 transition-colors hover:bg-fuchsia-500/15"
                    >
                      {tag}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* ─── Service Tags ─── */}
            {allServiceTags.length > 0 && (
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <div className="flex h-6 w-6 items-center justify-center rounded-lg bg-violet-500/10">
                    <Sparkles className="h-3 w-3 text-violet-400" />
                  </div>
                  <span className="text-[11px] font-bold text-white/70 uppercase tracking-wider">Servicios</span>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {allServiceTags.map((tag) => (
                    <span
                      key={tag}
                      className="rounded-xl border border-violet-500/20 bg-violet-500/[0.08] px-3 py-1.5 text-[11px] font-medium text-violet-300/90 transition-colors hover:bg-violet-500/15"
                    >
                      {tag}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* ─── Gallery Grid ─── */}
            {uniqueImages.length > 1 && (
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <div className="flex h-6 w-6 items-center justify-center rounded-lg bg-white/[0.06]">
                    <Eye className="h-3 w-3 text-white/50" />
                  </div>
                  <span className="text-[11px] font-bold text-white/70 uppercase tracking-wider">Galería</span>
                  <span className="rounded-full bg-white/[0.06] px-2 py-0.5 text-[9px] font-medium text-white/35">{uniqueImages.length}</span>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  {uniqueImages.map((src, i) => (
                    <button
                      key={i}
                      type="button"
                      onClick={() => setCurrentImage(i)}
                      className={`group relative aspect-square overflow-hidden rounded-xl bg-white/[0.03] transition-all duration-200 ${
                        i === currentImage ? "ring-2 ring-fuchsia-500/60 ring-offset-1 ring-offset-[#0a0a12]" : "hover:ring-1 hover:ring-white/15"
                      }`}
                    >
                      <img
                        src={src}
                        alt=""
                        loading="lazy"
                        decoding="async"
                        className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-110"
                      />
                      <div className="absolute inset-0 bg-black/0 transition group-hover:bg-black/15" />
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* No content fallback */}
            {!loadingFull && displayTags.length === 0 && allServiceTags.length === 0 && !fullProfile?.description && !profile.bio && uniqueImages.length <= 1 && (
              <div className="py-6 text-center">
                <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-white/[0.04] border border-white/[0.06]">
                  <Eye className="h-5 w-5 text-white/25" />
                </div>
                <p className="text-xs text-white/30">Visita el perfil completo para más información</p>
              </div>
            )}
          </div>
        </div>

        {/* ─── Action Bar ─── */}
        <div className="relative shrink-0 border-t border-white/[0.06] bg-[#0a0a12]/80 backdrop-blur-xl">
          {/* Subtle top glow */}
          <div className="absolute inset-x-0 -top-px h-px bg-gradient-to-r from-transparent via-fuchsia-500/20 to-transparent" />
          <div className="p-4 space-y-2.5">
            {isProfessional && (
              <>
                <Link
                  href={isAuthed ? `${chatHref}?mode=request` : `/login?next=${encodeURIComponent(`${chatHref}?mode=request`)}`}
                  onClick={onClose}
                  className="group relative flex w-full items-center justify-center gap-2 overflow-hidden rounded-2xl bg-gradient-to-r from-fuchsia-600 via-violet-600 to-fuchsia-600 bg-[length:200%_100%] py-3.5 text-sm font-bold transition-all duration-300 hover:bg-[position:100%_0] shadow-[0_8px_32px_rgba(168,85,247,0.3),inset_0_1px_0_rgba(255,255,255,0.1)]"
                >
                  <Sparkles className="h-4 w-4" />
                  Solicitar encuentro
                </Link>
                <div className="flex gap-2">
                  <Link
                    href={chatHref}
                    onClick={onClose}
                    className="flex flex-1 items-center justify-center gap-1.5 rounded-xl border border-fuchsia-500/25 bg-fuchsia-500/[0.08] py-2.5 text-xs font-semibold text-fuchsia-200 transition-all hover:bg-fuchsia-500/15 hover:border-fuchsia-500/40"
                  >
                    <MessageCircle className="h-3.5 w-3.5" />
                    Mensaje
                  </Link>
                  {fullProfile?.phone && (
                    <a
                      href={formatWhatsAppUrl(fullProfile.phone, fullProfile.displayName || profile.displayName)}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={onClose}
                      className="flex flex-1 items-center justify-center gap-1.5 rounded-xl border border-emerald-500/25 bg-emerald-500/[0.08] py-2.5 text-xs font-semibold text-emerald-200 transition-all hover:bg-emerald-500/15 hover:border-emerald-500/40"
                    >
                      <Phone className="h-3.5 w-3.5" />
                      WhatsApp
                    </a>
                  )}
                  <Link
                    href={profileHref}
                    onClick={onClose}
                    className="flex flex-1 items-center justify-center gap-1.5 rounded-xl border border-white/10 bg-white/[0.04] py-2.5 text-xs font-medium text-white/70 transition-all hover:bg-white/[0.08] hover:border-white/20"
                  >
                    <Eye className="h-3.5 w-3.5" />
                    Ver perfil
                  </Link>
                </div>
              </>
            )}
            {isEstablishment && (
              <>
                <Link
                  href={profileHref}
                  onClick={onClose}
                  className="group relative flex w-full items-center justify-center gap-2 overflow-hidden rounded-2xl bg-gradient-to-r from-amber-500 via-orange-500 to-amber-500 bg-[length:200%_100%] py-3.5 text-sm font-bold transition-all duration-300 hover:bg-[position:100%_0] shadow-[0_8px_32px_rgba(245,158,11,0.3),inset_0_1px_0_rgba(255,255,255,0.15)]"
                >
                  <CalendarCheck className="h-4 w-4" />
                  Reservar
                </Link>
                <Link
                  href={profileHref}
                  onClick={onClose}
                  className="flex w-full items-center justify-center gap-1.5 rounded-xl border border-white/10 bg-white/[0.04] py-2.5 text-sm font-medium text-white/70 transition-all hover:bg-white/[0.08] hover:border-white/20"
                >
                  <Eye className="h-4 w-4" />
                  Ver detalles del establecimiento
                </Link>
              </>
            )}
            {isShop && (
              <>
                <Link
                  href={profileHref}
                  onClick={onClose}
                  className="group relative flex w-full items-center justify-center gap-2 overflow-hidden rounded-2xl bg-gradient-to-r from-rose-500 via-pink-500 to-rose-500 bg-[length:200%_100%] py-3.5 text-sm font-bold transition-all duration-300 hover:bg-[position:100%_0] shadow-[0_8px_32px_rgba(244,63,94,0.3),inset_0_1px_0_rgba(255,255,255,0.15)]"
                >
                  <ShoppingBag className="h-4 w-4" />
                  Visitar Tienda
                </Link>
                <Link
                  href={profileHref}
                  onClick={onClose}
                  className="flex w-full items-center justify-center gap-1.5 rounded-xl border border-white/10 bg-white/[0.04] py-2.5 text-sm font-medium text-white/70 transition-all hover:bg-white/[0.08] hover:border-white/20"
                >
                  <Eye className="h-4 w-4" />
                  Ver productos
                </Link>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
