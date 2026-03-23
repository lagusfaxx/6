"use client";

import { useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import dynamic from "next/dynamic";
import { useSearchParams } from "next/navigation";
import { MapPin, SlidersHorizontal, X, ChevronDown, Search, Map as MapIcon, MessageCircle, Eye, Sparkles, Flame, Video, Crown, ShieldCheck, Phone, Tag, Briefcase } from "lucide-react";
import { LocationFilterContext } from "../hooks/useLocationFilter";
import { apiFetch, isRateLimitError, resolveMediaUrl } from "../lib/api";
import { filterUserTags, hasPremiumBadge, hasVerifiedBadge } from "../lib/systemBadges";
import StatusBadgeIcon from "./StatusBadgeIcon";
import UserLevelBadge from "./UserLevelBadge";
import type { MapMarker } from "./MapboxMap";
import useMe from "../hooks/useMe";

const MapboxMap = dynamic(() => import("./MapboxMap"), { ssr: false });
const ProfilePreviewModal = dynamic(() => import("./ProfilePreviewModal"), { ssr: false });
const Stories = dynamic(() => import("./Stories"), { ssr: false });
import { buildChatHref, buildLoginHref, buildCurrentPathWithSearch } from "../lib/chat";

/* ─── Types ──────────────────────────────────────────────── */
export type DirectoryResult = {
  id: string;
  username: string;
  displayName: string;
  avatarUrl: string | null;
  coverUrl: string | null;
  age: number | null;
  distance: number | null;
  latitude: number | null;
  longitude: number | null;
  availableNow: boolean;
  isActive: boolean;
  userLevel: string;
  completedServices: number;
  profileViews: number;
  lastSeen: string | null;
  city: string | null;
  serviceCategory: string | null;
  primaryCategory: string | null;
  profileTags: string[];
  serviceTags: string[];
  gender: string | null;
  profileType?: string | null;
  avgResponseMinutes?: number | null;
};

/* Catalog constants (also used by TopHeader chips/mega menu) */
export const PRIMARY_CATEGORIES = [
  { key: "escort",     label: "Escort",        route: "/escorts" },
  { key: "masajes",    label: "Masajes",        route: "/masajistas" },
  { key: "moteles",    label: "Moteles",        route: "/moteles" },
  { key: "sexshop",   label: "Sex Shop",       route: "/sexshop" },
  { key: "trans",     label: "Trans",          route: "/escorts?profileTags=trans" },
  { key: "despedidas",label: "Despedidas",     route: "/escorts?serviceTags=despedidas" },
  { key: "videos",    label: "Videollamadas",  route: "/escorts?serviceTags=videollamada" },
] as const;

export const PROFILE_TAGS_CATALOG = [
  "tetona", "culona", "delgada", "fitness", "gordita",
  "rubia", "morena", "pelirroja", "trigueña",
  "sumisa", "dominante", "caliente", "cariñosa", "natural",
  "tatuada", "piercing",
] as const;

export const SERVICE_TAGS_CATALOG = [
  "anal", "trios", "packs", "videollamada",
  "masaje erotico", "despedidas", "discapacitados", "fetiches",
  "bdsm", "sexo oral", "lluvia dorada", "rol",
] as const;

/* ─── Props ──────────────────────────────────────────────── */
type Props = {
  entityType?: "professional" | "establishment" | "shop";
  categorySlug: string;    // 'escort' | 'masajes' | 'motel' | 'sexshop' | …
  title: string;
  tag?: string;            // tag from [tag] route param → added to profileTags filter
};

/* ─── Quick preview data (fetched on demand) ─── */
type QuickPreviewData = {
  bio: string | null;
  profileTags: string[];
  serviceTags: string[];
  baseRate: number | null;
  phone: string | null;
  availableNow: boolean;
};

function formatWhatsAppUrl(phone: string) {
  const cleaned = phone.replace(/[^0-9+]/g, "");
  const num = cleaned.startsWith("+") ? cleaned.slice(1) : cleaned;
  return `https://wa.me/${num}`;
}

/* ─── ProfileCard ────────────────────────────────────────── */
function ProfileCard({
  p,
  entityType,
  categorySlug,
  onQuickPreviewMobile,
}: {
  p: DirectoryResult;
  entityType: string;
  categorySlug?: string;
  onQuickPreviewMobile: (profile: DirectoryResult, data: QuickPreviewData) => void;
}) {
  const { me } = useMe();
  const isAuthed = Boolean(me?.user?.id);
  let href: string;
  if (entityType === "establishment") {
    href = categorySlug === "motel" ? `/hospedaje/${p.id}` : `/establecimiento/${p.id}`;
  } else if (entityType === "shop") {
    href = `/sexshop/${p.username || p.id}`;
  } else {
    href = `/profesional/${p.id}`;
  }
  const avatarSrc = p.avatarUrl ? resolveMediaUrl(p.avatarUrl) : null;
  const coverSrc  = p.coverUrl  ? resolveMediaUrl(p.coverUrl)  : null;

  const chatHref = isAuthed
    ? buildChatHref(p.id)
    : buildLoginHref(buildCurrentPathWithSearch());

  const userTags = filterUserTags(p.profileTags);
  const maxVisibleTags = 2;
  const extraTagCount = userTags.length - maxVisibleTags;

  /* ── Desktop quick preview state ── */
  const [showPreview, setShowPreview] = useState(false);
  const [previewData, setPreviewData] = useState<QuickPreviewData | null>(null);
  const [loadingPreview, setLoadingPreview] = useState(false);
  const cardRef = useRef<HTMLDivElement>(null);

  const fetchPreviewData = useCallback(async () => {
    if (previewData) return previewData;
    setLoadingPreview(true);
    try {
      const res = await apiFetch<any>(`/professionals/${p.id}`);
      const prof = res?.professional || res;
      const data: QuickPreviewData = {
        bio: prof.description || prof.bio || null,
        profileTags: prof.profileTags || p.profileTags || [],
        serviceTags: prof.serviceTags || p.serviceTags || [],
        baseRate: prof.baseRate || null,
        phone: prof.phone || null,
        availableNow: prof.isOnline || prof.availableNow || p.availableNow,
      };
      setPreviewData(data);
      return data;
    } catch {
      return null;
    } finally {
      setLoadingPreview(false);
    }
  }, [p.id, previewData, p.profileTags, p.serviceTags, p.availableNow]);

  const handleCardClick = useCallback(async (e: React.MouseEvent) => {
    // Don't intercept clicks on links/buttons inside the card
    const target = e.target as HTMLElement;
    if (target.closest("a") || target.closest("button")) return;
    e.preventDefault();
    e.stopPropagation();

    // Mobile: open bottom sheet
    if (window.innerWidth < 768) {
      const data = await fetchPreviewData();
      if (data) onQuickPreviewMobile(p, data);
      return;
    }

    // Desktop: toggle overlay
    if (showPreview) {
      setShowPreview(false);
    } else {
      await fetchPreviewData();
      setShowPreview(true);
    }
  }, [showPreview, fetchPreviewData, onQuickPreviewMobile, p]);

  // Close desktop overlay on outside click
  useEffect(() => {
    if (!showPreview) return;
    const handler = (e: MouseEvent) => {
      if (cardRef.current && !cardRef.current.contains(e.target as Node)) {
        setShowPreview(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [showPreview]);

  const previewTags = previewData ? filterUserTags(previewData.profileTags) : userTags;
  const previewServices = previewData?.serviceTags || p.serviceTags || [];

  const tierClass = p.userLevel === "DIAMOND" ? "uzeed-tier-diamond" : p.userLevel === "GOLD" ? "uzeed-tier-gold" : "";

  return (
    <div
      ref={cardRef}
      onClick={handleCardClick}
      className={`uzeed-premium-card uzeed-card-feed group relative flex flex-col cursor-pointer ${tierClass}`}
    >
      {/* Cover / hero photo with shimmer effect */}
      <div className="uzeed-card-shimmer relative aspect-[3/4] bg-[#0a0a10] overflow-hidden">
        {coverSrc || avatarSrc ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={coverSrc || avatarSrc!}
            alt={p.displayName}
            loading="lazy"
            decoding="async"
            fetchPriority="low"
            className="uzeed-card-img w-full h-full object-cover"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-fuchsia-900/40 via-violet-900/30 to-indigo-900/20">
            <span className="text-5xl font-black text-white/[0.06] select-none tracking-tighter">
              {p.displayName[0]?.toUpperCase()}
            </span>
          </div>
        )}

        {/* Multi-layer gradient overlay for depth */}
        <div className="uzeed-card-gradient absolute inset-0 pointer-events-none" />
        <div className="absolute inset-0 bg-gradient-to-br from-fuchsia-600/[0.04] via-transparent to-violet-600/[0.04] pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity duration-500" />

        {/* Top-left: status badges */}
        <div className="absolute top-2.5 left-2.5 flex flex-col gap-1.5 z-[3]">
          {p.availableNow && (
            <span className="uzeed-badge-pill uzeed-badge-online">
              <span className="uzeed-badge-dot" />
              Online
            </span>
          )}
        </div>

        {/* Top-right: level badge */}
        <div className="absolute top-2.5 right-2.5 z-[3]">
          <UserLevelBadge level={p.userLevel as "SILVER" | "GOLD" | "DIAMOND" | null} />
        </div>

        {/* Bottom info overlay with premium layout */}
        <div className="absolute bottom-0 left-0 right-0 p-3 z-[3]">
          {/* Name + age + verification badges */}
          <div className="flex items-center gap-1.5 font-bold text-white text-[13px] sm:text-sm leading-tight">
            <span className="truncate">{p.displayName}</span>
            {hasPremiumBadge(p.profileTags) && <StatusBadgeIcon type="premium" size="h-3.5 w-3.5" />}
            {hasVerifiedBadge(p.profileTags) && <StatusBadgeIcon type="verificada" size="h-3.5 w-3.5" />}
            {p.age ? <span className="text-white/50 font-normal text-[11px] tabular-nums">{p.age}</span> : null}
          </div>

          {/* City / distance with subtle icon */}
          <div className="flex items-center gap-1.5 text-[11px] text-white/45 mt-1">
            {p.city && (
              <span className="flex items-center gap-1 truncate">
                <MapPin className="h-3 w-3 shrink-0 text-fuchsia-400/50" />
                {p.city}
              </span>
            )}
            {p.distance != null && (
              <span className="text-white/35 shrink-0 tabular-nums">
                · {p.distance < 1 ? `${Math.round(p.distance * 1000)}m` : `${p.distance.toFixed(1)}km`}
              </span>
            )}
          </div>

          {/* Tags with premium pill style */}
          {userTags.length > 0 && (
            <div className="flex items-center gap-1 mt-2">
              {userTags.slice(0, maxVisibleTags).map((t) => (
                <span key={t} className="uzeed-tag uzeed-tag-fuchsia truncate max-w-[80px]">
                  {t}
                </span>
              ))}
              {extraTagCount > 0 && (
                <span className="uzeed-tag bg-white/[0.08] border border-white/[0.08] text-white/40">
                  +{extraTagCount}
                </span>
              )}
            </div>
          )}
        </div>
      </div>

      {/* ── Desktop Quick Preview Overlay ── */}
      {showPreview && (
        <div className="uzeed-quick-preview uzeed-preview-overlay absolute inset-0 z-10 flex flex-col rounded-[inherit] overflow-hidden animate-scale-in">
          {/* Close button */}
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); setShowPreview(false); }}
            className="absolute top-2.5 right-2.5 z-20 flex h-7 w-7 items-center justify-center rounded-full border border-white/10 bg-white/[0.06] text-white/50 hover:bg-white/[0.12] hover:text-white/80 transition-all duration-200"
          >
            <X className="h-3.5 w-3.5" />
          </button>

          {/* Scrollable content */}
          <div className="flex-1 overflow-y-auto p-3.5 pt-3 space-y-3 scrollbar-none">
            {/* Header with avatar */}
            <div className="flex items-center gap-2.5">
              {(coverSrc || avatarSrc) && (
                <div className="relative shrink-0">
                  <img src={avatarSrc || coverSrc!} alt="" className="h-10 w-10 rounded-xl object-cover border border-white/[0.08]" />
                  {p.availableNow && (
                    <div className="absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full bg-emerald-400 border-2 border-[#0e0e12] shadow-glow-emerald" />
                  )}
                </div>
              )}
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1 text-sm font-bold truncate">
                  {p.displayName}
                  {hasPremiumBadge(p.profileTags) && <StatusBadgeIcon type="premium" size="h-3.5 w-3.5" />}
                  {hasVerifiedBadge(p.profileTags) && <StatusBadgeIcon type="verificada" size="h-3.5 w-3.5" />}
                </div>
                <div className="text-[10px] text-white/35 flex items-center gap-1.5 mt-0.5">
                  {p.age && <span>{p.age} años</span>}
                  {p.city && <><span className="text-white/15">·</span><span>{p.city}</span></>}
                </div>
              </div>
            </div>

            {/* Bio */}
            {previewData?.bio && (
              <p className="text-[11px] text-white/50 leading-relaxed line-clamp-2">{previewData.bio}</p>
            )}

            {/* Price with gradient text */}
            {previewData?.baseRate && (
              <div className="text-sm font-extrabold bg-gradient-to-r from-fuchsia-300 to-violet-300 bg-clip-text text-transparent">
                Desde ${previewData.baseRate.toLocaleString()}
              </div>
            )}

            {/* Attributes */}
            {previewTags.length > 0 && (
              <div>
                <div className="flex items-center gap-1.5 mb-1.5">
                  <Tag className="h-2.5 w-2.5 text-fuchsia-400/70" />
                  <span className="text-[8px] font-bold text-white/30 uppercase tracking-[0.08em]">Atributos</span>
                </div>
                <div className="flex flex-wrap gap-1">
                  {previewTags.slice(0, 5).map((t) => (
                    <span key={t} className="uzeed-tag uzeed-tag-fuchsia">
                      {t}
                    </span>
                  ))}
                  {previewTags.length > 5 && (
                    <span className="uzeed-tag bg-white/[0.05] border border-white/[0.06] text-white/25">+{previewTags.length - 5}</span>
                  )}
                </div>
              </div>
            )}

            {/* Services */}
            {previewServices.length > 0 && (
              <div>
                <div className="flex items-center gap-1.5 mb-1.5">
                  <Briefcase className="h-2.5 w-2.5 text-violet-400/70" />
                  <span className="text-[8px] font-bold text-white/30 uppercase tracking-[0.08em]">Servicios</span>
                </div>
                <div className="flex flex-wrap gap-1">
                  {previewServices.slice(0, 5).map((t) => (
                    <span key={t} className="uzeed-tag uzeed-tag-violet">
                      {t}
                    </span>
                  ))}
                  {previewServices.length > 5 && (
                    <span className="uzeed-tag bg-white/[0.05] border border-white/[0.06] text-white/25">+{previewServices.length - 5}</span>
                  )}
                </div>
              </div>
            )}

            {loadingPreview && !previewData && (
              <div className="flex justify-center py-3">
                <span className="h-5 w-5 border-2 border-fuchsia-500/20 border-t-fuchsia-500 rounded-full animate-spin" />
              </div>
            )}
          </div>

          {/* Action buttons - premium styled */}
          <div className="p-2.5 pt-0 space-y-1.5 shrink-0 border-t border-white/[0.05]">
            <Link
              href={chatHref}
              onClick={(e) => e.stopPropagation()}
              className="uzeed-cta-btn flex w-full items-center justify-center gap-1.5 rounded-xl bg-gradient-to-r from-fuchsia-600 to-violet-600 py-2.5 text-[11px] font-bold text-white shadow-[0_4px_16px_rgba(168,85,247,0.25)]"
            >
              <MessageCircle className="h-3.5 w-3.5" />
              Mensaje
            </Link>
            <div className="flex gap-1.5">
              {previewData?.phone && (
                <a
                  href={formatWhatsAppUrl(previewData.phone)}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={(e) => e.stopPropagation()}
                  className="flex flex-1 items-center justify-center gap-1 rounded-xl border border-emerald-500/20 bg-emerald-500/[0.08] py-2 text-[10px] font-semibold text-emerald-300 transition-all duration-200 hover:bg-emerald-500/15 hover:border-emerald-500/30"
                >
                  <Phone className="h-3 w-3" />
                  WhatsApp
                </a>
              )}
              <Link
                href={href}
                onClick={(e) => e.stopPropagation()}
                className="flex flex-1 items-center justify-center gap-1 rounded-xl border border-white/[0.08] bg-white/[0.03] py-2 text-[10px] font-semibold text-white/55 transition-all duration-200 hover:bg-white/[0.08] hover:text-white/75"
              >
                <Eye className="h-3 w-3" />
                Ver perfil
              </Link>
            </div>
            {entityType === "professional" && (
              <Link
                href={isAuthed ? `${chatHref}?mode=request` : `/login?next=${encodeURIComponent(`${chatHref}?mode=request`)}`}
                onClick={(e) => e.stopPropagation()}
                className="flex w-full items-center justify-center gap-1.5 rounded-xl border border-fuchsia-500/15 bg-fuchsia-500/[0.06] py-2 text-[10px] font-semibold text-fuchsia-300/80 transition-all duration-200 hover:bg-fuchsia-500/[0.12] hover:text-fuchsia-300"
              >
                <Sparkles className="h-3 w-3" />
                Solicitar encuentro
              </Link>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

/* ─── Mobile Bottom Sheet Quick Preview ──────────────────── */
function MobileQuickPreview({
  profile,
  data,
  entityType,
  categorySlug,
  onClose,
}: {
  profile: DirectoryResult;
  data: QuickPreviewData;
  entityType: string;
  categorySlug?: string;
  onClose: () => void;
}) {
  const { me } = useMe();
  const isAuthed = Boolean(me?.user?.id);
  const sheetRef = useRef<HTMLDivElement>(null);

  let href: string;
  if (entityType === "establishment") {
    href = categorySlug === "motel" ? `/hospedaje/${profile.id}` : `/establecimiento/${profile.id}`;
  } else if (entityType === "shop") {
    href = `/sexshop/${profile.username || profile.id}`;
  } else {
    href = `/profesional/${profile.id}`;
  }

  const chatHref = isAuthed
    ? buildChatHref(profile.id)
    : buildLoginHref(buildCurrentPathWithSearch());

  const coverSrc = profile.coverUrl ? resolveMediaUrl(profile.coverUrl) : null;
  const avatarSrc = profile.avatarUrl ? resolveMediaUrl(profile.avatarUrl) : null;
  const displayTags = filterUserTags(data.profileTags);

  // Close on backdrop click
  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) onClose();
  };

  // Close on escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [onClose]);

  // Prevent body scroll
  useEffect(() => {
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = ""; };
  }, []);

  return (
    <div
      className="fixed inset-0 z-[60] flex items-end justify-center bg-black/70 backdrop-blur-sm uzeed-animate-fade-in"
      onClick={handleBackdropClick}
    >
      <div
        ref={sheetRef}
        className="uzeed-bottom-sheet w-full max-w-lg uzeed-animate-slide-up max-h-[75vh] flex flex-col"
      >
        {/* Drag indicator */}
        <div className="flex justify-center pt-3 pb-1 shrink-0">
          <div className="h-1 w-12 rounded-full bg-white/15" />
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-5 pb-3 space-y-4 scrollbar-none">
          {/* Header: avatar + name + meta */}
          <div className="flex items-center gap-3">
            {(coverSrc || avatarSrc) && (
              <div className="relative shrink-0">
                <img src={avatarSrc || coverSrc!} alt="" className="h-14 w-14 rounded-2xl object-cover border border-white/[0.08] shadow-lg" />
                {data.availableNow && (
                  <div className="absolute -bottom-1 -right-1 h-4 w-4 rounded-full bg-emerald-400 border-[2.5px] border-[#0e0e12] shadow-glow-emerald" />
                )}
              </div>
            )}
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5 text-[17px] font-bold truncate tracking-tight">
                {profile.displayName}
                {hasPremiumBadge(data.profileTags) && <StatusBadgeIcon type="premium" size="h-4 w-4" />}
                {hasVerifiedBadge(data.profileTags) && <StatusBadgeIcon type="verificada" size="h-4 w-4" />}
                {profile.age && <span className="text-white/40 font-normal text-sm tabular-nums">{profile.age}</span>}
              </div>
              <div className="flex items-center gap-2 text-xs text-white/35 mt-0.5">
                {profile.city && (
                  <span className="flex items-center gap-1">
                    <MapPin className="h-3 w-3 text-fuchsia-400/50" />
                    {profile.city}
                  </span>
                )}
                {profile.distance != null && (
                  <span className="tabular-nums">{profile.distance < 1 ? `${Math.round(profile.distance * 1000)}m` : `${profile.distance.toFixed(1)}km`}</span>
                )}
                {data.availableNow && (
                  <span className="flex items-center gap-1 text-emerald-400 font-medium">
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-breathe" />
                    Online
                  </span>
                )}
              </div>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="flex h-8 w-8 items-center justify-center rounded-xl border border-white/[0.08] bg-white/[0.04] text-white/40 shrink-0 hover:bg-white/[0.08] transition-all duration-200"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          {/* Bio */}
          {data.bio && (
            <p className="text-[13px] text-white/45 leading-relaxed line-clamp-2">{data.bio}</p>
          )}

          {/* Price with gradient */}
          {data.baseRate && (
            <div className="text-base font-extrabold bg-gradient-to-r from-fuchsia-300 via-violet-300 to-fuchsia-300 bg-clip-text text-transparent">
              Desde ${data.baseRate.toLocaleString()}
            </div>
          )}

          {/* Attributes */}
          {displayTags.length > 0 && (
            <div>
              <div className="flex items-center gap-1.5 mb-2">
                <Tag className="h-3 w-3 text-fuchsia-400/60" />
                <span className="text-[9px] font-bold text-white/25 uppercase tracking-[0.08em]">Atributos</span>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {displayTags.slice(0, 6).map((t) => (
                  <span key={t} className="uzeed-tag uzeed-tag-fuchsia text-[10px] px-2.5 py-0.5">
                    {t}
                  </span>
                ))}
                {displayTags.length > 6 && (
                  <span className="uzeed-tag bg-white/[0.05] border border-white/[0.06] text-white/25 text-[10px] px-2.5 py-0.5">+{displayTags.length - 6}</span>
                )}
              </div>
            </div>
          )}

          {/* Services */}
          {data.serviceTags.length > 0 && (
            <div>
              <div className="flex items-center gap-1.5 mb-2">
                <Briefcase className="h-3 w-3 text-violet-400/60" />
                <span className="text-[9px] font-bold text-white/25 uppercase tracking-[0.08em]">Servicios</span>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {data.serviceTags.slice(0, 6).map((t) => (
                  <span key={t} className="uzeed-tag uzeed-tag-violet text-[10px] px-2.5 py-0.5">
                    {t}
                  </span>
                ))}
                {data.serviceTags.length > 6 && (
                  <span className="uzeed-tag bg-white/[0.05] border border-white/[0.06] text-white/25 text-[10px] px-2.5 py-0.5">+{data.serviceTags.length - 6}</span>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Action buttons - premium styled */}
        <div className="px-5 pb-[calc(1rem+env(safe-area-inset-bottom))] pt-3 space-y-2 shrink-0 border-t border-white/[0.05]">
          <div className="flex gap-2">
            <Link
              href={chatHref}
              onClick={onClose}
              className="uzeed-cta-btn flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-gradient-to-r from-fuchsia-600 to-violet-600 py-3 text-[13px] font-bold text-white shadow-[0_6px_20px_rgba(168,85,247,0.25)]"
            >
              <MessageCircle className="h-4 w-4" />
              Mensaje
            </Link>
            {data.phone && (
              <a
                href={formatWhatsAppUrl(data.phone)}
                target="_blank"
                rel="noopener noreferrer"
                onClick={onClose}
                className="flex items-center justify-center gap-1.5 rounded-xl border border-emerald-500/20 bg-emerald-500/[0.08] px-5 py-3 text-[13px] font-bold text-emerald-300 transition-all duration-200 hover:bg-emerald-500/15 hover:border-emerald-500/30"
              >
                <Phone className="h-4 w-4" />
                WhatsApp
              </a>
            )}
          </div>
          <div className="flex gap-2">
            <Link
              href={href}
              onClick={onClose}
              className="flex flex-1 items-center justify-center gap-1.5 rounded-xl border border-white/[0.08] bg-white/[0.03] py-3 text-[13px] font-semibold text-white/60 transition-all duration-200 hover:bg-white/[0.08]"
            >
              <Eye className="h-3.5 w-3.5" />
              Ver perfil
            </Link>
            {entityType === "professional" && (
              <Link
                href={isAuthed ? `${chatHref}?mode=request` : `/login?next=${encodeURIComponent(`${chatHref}?mode=request`)}`}
                onClick={onClose}
                className="flex flex-1 items-center justify-center gap-1.5 rounded-xl border border-fuchsia-500/15 bg-fuchsia-500/[0.06] py-3 text-[13px] font-semibold text-fuchsia-300/80 transition-all duration-200 hover:bg-fuchsia-500/[0.12] hover:text-fuchsia-300"
              >
                <Sparkles className="h-4 w-4" />
                Solicitar encuentro
              </Link>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ─── Main ───────────────────────────────────────────────── */
export default function DirectoryPage({ entityType = "professional", categorySlug, title, tag }: Props) {
  const searchParams = useSearchParams();
  const locationCtx = useContext(LocationFilterContext);

  /* ── local filter state ── */
  const [profileTagsFilter, setProfileTagsFilter] = useState<string[]>(
    tag ? [tag] : searchParams.get("profileTags")?.split(",").filter(Boolean) ?? [],
  );
  const [serviceTagsFilter, setServiceTagsFilter] = useState<string[]>(
    searchParams.get("serviceTags")?.split(",").filter(Boolean) ?? [],
  );
  const [maduras, setMaduras] = useState(searchParams.get("maduras") === "true");
  const [availableNow, setAvailableNow] = useState(false);
  const [sort, setSort] = useState<"featured" | "near" | "new" | "availableNow">("featured");
  const [genderFilter, setGenderFilter] = useState(searchParams.get("gender") || "");
  const [showFilters, setShowFilters] = useState(false);
  const [search, setSearch] = useState("");

  /* ── data state ── */
  const [results, setResults] = useState<DirectoryResult[]>([]);
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(0);
  const [rateLimitMsg, setRateLimitMsg] = useState<string | null>(null);

  /* ── location from context ── */
  const effectiveLoc = locationCtx?.effectiveLocation ?? null;
  const locationLabel = locationCtx?.state.mode === "city"
    ? locationCtx.state.selectedCity?.name ?? null
    : effectiveLoc ? "Mi ubicación" : null;

  /* ── fetch from real API ── */
  const fetchRef = useRef(0);
  const fetchResults = useCallback(async () => {
    const myFetch = ++fetchRef.current;
    setLoading(true);
    try {
      const params = new URLSearchParams({
        entityType,
        categorySlug,
        sort,
        limit: "60",
      });
      if (effectiveLoc) {
        params.set("lat", String(effectiveLoc[0]));
        params.set("lng", String(effectiveLoc[1]));
        params.set("radiusKm", "100");
      }
      if (profileTagsFilter.length) params.set("profileTags", profileTagsFilter.join(","));
      if (serviceTagsFilter.length) params.set("serviceTags", serviceTagsFilter.join(","));
      if (maduras) params.set("maduras", "true");
      if (availableNow) params.set("availableNow", "true");
      if (genderFilter) params.set("gender", genderFilter);

      const data = await apiFetch<{ results: DirectoryResult[]; total: number }>(
        `/directory/search?${params.toString()}`,
      );
      if (myFetch !== fetchRef.current) return;
      setResults(data.results ?? []);
      setTotal(data.total ?? 0);
      setRateLimitMsg(null);
    } catch (err: any) {
      if (myFetch !== fetchRef.current) return;
      if (isRateLimitError(err)) {
        setRateLimitMsg("Demasiadas solicitudes, intenta en unos segundos.");
      } else {
        setResults([]);
      }
    } finally {
      if (myFetch === fetchRef.current) setLoading(false);
    }
  }, [entityType, categorySlug, effectiveLoc, profileTagsFilter, serviceTagsFilter, maduras, availableNow, sort, genderFilter]);

  useEffect(() => { fetchResults(); }, [fetchResults]);

  /* ── client-side name search (filter on rendered results) ── */
  const displayed = useMemo(() => {
    if (!search.trim()) return results;
    const q = search.toLowerCase();
    return results.filter(
      (r) =>
        (r.displayName || "").toLowerCase().includes(q) ||
        (r.city || "").toLowerCase().includes(q) ||
        r.profileTags.some((t) => t.includes(q)),
    );
  }, [results, search]);

  /* ── toggle helpers ── */
  function toggleProfileTag(t: string) {
    setProfileTagsFilter((prev) =>
      prev.includes(t) ? prev.filter((x) => x !== t) : [...prev, t],
    );
  }
  function toggleServiceTag(t: string) {
    setServiceTagsFilter((prev) =>
      prev.includes(t) ? prev.filter((x) => x !== t) : [...prev, t],
    );
  }

  const [showMap, setShowMap] = useState(true);
  const [previewProfile, setPreviewProfile] = useState<DirectoryResult | null>(null);

  /* ── Mobile quick preview state ── */
  const [mobilePreview, setMobilePreview] = useState<{ profile: DirectoryResult; data: QuickPreviewData } | null>(null);
  const handleQuickPreviewMobile = useCallback((profile: DirectoryResult, data: QuickPreviewData) => {
    setMobilePreview({ profile, data });
  }, []);

  /* ── Map markers: only from current category's results ── */
  const mapMarkers = useMemo(
    () =>
      displayed
        .filter((p) => Number.isFinite(Number(p.latitude)) && Number.isFinite(Number(p.longitude)))
        .map((p) => ({
          id: p.id,
          name: p.displayName,
          lat: Number(p.latitude),
          lng: Number(p.longitude),
          subtitle: p.serviceCategory || p.city || title,
          username: p.username,
          href: `/profesional/${p.id}`,
          avatarUrl: p.avatarUrl,
          coverUrl: p.coverUrl,
          age: p.age,
          level: p.userLevel,
          lastSeen: p.lastSeen,
          tier: p.availableNow ? "online" as const : "offline" as const,
          areaRadiusM: 500,
        })),
    [displayed, title],
  );

  const mapCenter: [number, number] | null = effectiveLoc;

  const activeFilterCount = profileTagsFilter.length + serviceTagsFilter.length +
    (maduras ? 1 : 0) + (availableNow ? 1 : 0) + (genderFilter ? 1 : 0);

  return (
    <div className="-mx-4 -mt-4 min-h-screen text-white">
      {/* ── Sticky header ── */}
      <div className="sticky top-[60px] md:top-[68px] z-20 bg-[#0d0e1a]/95 backdrop-blur-xl border-b border-white/[0.06]">
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center gap-3">
          {/* Title + count */}
          <div className="flex-1 min-w-0">
            <h1 className="text-lg font-bold truncate flex items-center gap-2">
              <Flame className="h-4 w-4 text-fuchsia-400" />
              {title}
            </h1>
            <div className="flex items-center gap-2 mt-0.5">
              {locationLabel && (
                <span className="text-[11px] text-fuchsia-300/70 flex items-center gap-1 font-medium">
                  <MapPin className="h-3 w-3" />
                  {locationLabel}
                </span>
              )}
              {!loading && (
                <span className="text-[11px] text-white/30">· {total} resultado{total !== 1 ? "s" : ""}</span>
              )}
            </div>
          </div>

          {/* Search */}
          <div className="relative hidden sm:flex items-center">
            <Search className="absolute left-3 h-4 w-4 text-white/30" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar…"
              className="h-9 rounded-xl bg-white/5 border border-white/10 pl-9 pr-3 text-sm text-white placeholder-white/30 focus:outline-none focus:border-fuchsia-500/50 w-40"
            />
          </div>

          {/* Sort */}
          <div className="relative">
            <select
              value={sort}
              onChange={(e) => setSort(e.target.value as typeof sort)}
              className="h-9 rounded-xl bg-white/5 border border-white/10 px-3 text-sm text-white appearance-none pr-7 focus:outline-none focus:border-fuchsia-500/50 cursor-pointer"
            >
              <option value="featured">Destacadas</option>
              <option value="near">Más cercanas</option>
              <option value="new">Nuevas</option>
              <option value="availableNow">Disponibles</option>
            </select>
            <ChevronDown className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-white/40" />
          </div>

          {/* Map toggle */}
          <button
            onClick={() => setShowMap((v) => !v)}
            className={`h-9 px-3 rounded-xl border text-sm flex items-center gap-1.5 transition ${
              showMap
                ? "border-fuchsia-500/30 bg-fuchsia-500/10 text-fuchsia-300"
                : "border-white/10 bg-white/5 text-white/50"
            }`}
          >
            <MapIcon className="h-4 w-4" />
            <span className="hidden sm:inline">Mapa</span>
          </button>

          {/* Filters button */}
          <button
            onClick={() => setShowFilters((v) => !v)}
            className={`relative h-9 px-3 rounded-xl border text-sm flex items-center gap-1.5 transition ${
              showFilters || activeFilterCount > 0
                ? "border-fuchsia-500/60 bg-fuchsia-500/10 text-fuchsia-300"
                : "border-white/10 bg-white/5 text-white/70 hover:bg-white/10"
            }`}
          >
            <SlidersHorizontal className="h-4 w-4" />
            <span className="hidden sm:inline">Filtros</span>
            {activeFilterCount > 0 && (
              <span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-fuchsia-500 text-[9px] font-bold text-white">
                {activeFilterCount}
              </span>
            )}
          </button>
        </div>

        {/* ── Filter panel ── */}
        {showFilters && (
          <div className="border-t border-white/5 px-4 py-4 max-w-7xl mx-auto space-y-4">
            {/* Quick filters */}
            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => setAvailableNow((v) => !v)}
                className={`rounded-full border px-3 py-1 text-xs font-medium transition ${
                  availableNow ? "border-emerald-500 bg-emerald-500/10 text-emerald-400" : "border-white/10 text-white/50 hover:border-white/20"
                }`}
              >
                🟢 Disponible ahora
              </button>
              <button
                onClick={() => setMaduras((v) => !v)}
                className={`rounded-full border px-3 py-1 text-xs font-medium transition ${
                  maduras ? "border-amber-500 bg-amber-500/10 text-amber-400" : "border-white/10 text-white/50 hover:border-white/20"
                }`}
              >
                Maduras (40+)
              </button>
              {["FEMALE", "MALE", "OTHER"].map((g) => (
                <button
                  key={g}
                  onClick={() => setGenderFilter((v) => (v === g ? "" : g))}
                  className={`rounded-full border px-3 py-1 text-xs font-medium transition ${
                    genderFilter === g ? "border-violet-500 bg-violet-500/10 text-violet-300" : "border-white/10 text-white/50 hover:border-white/20"
                  }`}
                >
                  {g === "FEMALE" ? "Mujeres" : g === "MALE" ? "Hombres" : "Trans"}
                </button>
              ))}
            </div>

            {/* Profile tags */}
            <div>
              <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-white/40">
                Cómo se definen
              </p>
              <div className="flex flex-wrap gap-1.5">
                {PROFILE_TAGS_CATALOG.map((t) => (
                  <button
                    key={t}
                    onClick={() => toggleProfileTag(t)}
                    className={`rounded-full border px-2.5 py-1 text-xs capitalize transition ${
                      profileTagsFilter.includes(t)
                        ? "border-fuchsia-500 bg-fuchsia-500/15 text-fuchsia-300"
                        : "border-white/10 text-white/50 hover:border-white/20"
                    }`}
                  >
                    {t}
                  </button>
                ))}
              </div>
            </div>

            {/* Service tags */}
            <div>
              <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-white/40">
                Servicios
              </p>
              <div className="flex flex-wrap gap-1.5">
                {SERVICE_TAGS_CATALOG.map((t) => (
                  <button
                    key={t}
                    onClick={() => toggleServiceTag(t)}
                    className={`rounded-full border px-2.5 py-1 text-xs capitalize transition ${
                      serviceTagsFilter.includes(t)
                        ? "border-violet-500 bg-violet-500/15 text-violet-300"
                        : "border-white/10 text-white/50 hover:border-white/20"
                    }`}
                  >
                    {t}
                  </button>
                ))}
              </div>
            </div>

            {/* Clear */}
            {activeFilterCount > 0 && (
              <button
                onClick={() => {
                  setProfileTagsFilter([]);
                  setServiceTagsFilter([]);
                  setMaduras(false);
                  setAvailableNow(false);
                  setGenderFilter("");
                }}
                className="flex items-center gap-1 text-xs text-white/40 hover:text-white/70 transition"
              >
                <X className="h-3.5 w-3.5" /> Limpiar filtros
              </button>
            )}
          </div>
        )}
      </div>

      {/* ── Stories ── */}
      <div className="max-w-7xl mx-auto px-4 pt-4">
        <Stories />
      </div>

      {/* ── Map (filtered by current category only) ── */}
      {showMap && !loading && mapMarkers.length > 0 && (
        <div className="max-w-7xl mx-auto px-4 pt-4">
          <div className="overflow-hidden rounded-2xl border border-white/[0.08]">
            <MapboxMap
              userLocation={mapCenter}
              markers={mapMarkers}
              height={260}
              autoCenterOnDataChange
              showMarkersForArea
              renderHtmlMarkers
              onMarkerSelect={(marker: MapMarker) => {
                const match = displayed.find((p) => p.id === marker.id);
                if (match) setPreviewProfile(match);
              }}
            />
          </div>
        </div>
      )}

      {/* ── Rate-limit banner ── */}
      {rateLimitMsg && (
        <div className="max-w-7xl mx-auto px-4 pt-4">
          <div className="rounded-lg bg-amber-500/10 border border-amber-500/30 px-4 py-2 text-sm text-amber-300 text-center">
            {rateLimitMsg}
          </div>
        </div>
      )}

      {/* ── Results grid ── */}
      <div className="max-w-7xl mx-auto px-4 py-6">
        {loading ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
            {Array.from({ length: 20 }).map((_, i) => (
              <div key={i} className="aspect-[3/4] rounded-2xl bg-white/5 animate-pulse" />
            ))}
          </div>
        ) : displayed.length === 0 ? (
          <div className="py-24 text-center">
            <p className="text-4xl mb-3">🔍</p>
            <p className="text-white/50">No encontramos resultados con estos filtros.</p>
            {activeFilterCount > 0 && (
              <button
                onClick={() => { setProfileTagsFilter([]); setServiceTagsFilter([]); setMaduras(false); setAvailableNow(false); setGenderFilter(""); }}
                className="mt-4 text-sm text-fuchsia-400 hover:text-fuchsia-300"
              >
                Limpiar filtros
              </button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
            {displayed.map((p) => (
              <ProfileCard key={p.id} p={p} entityType={entityType} categorySlug={categorySlug} onQuickPreviewMobile={handleQuickPreviewMobile} />
            ))}
          </div>
        )}
      </div>

      {/* Profile Preview Modal (from map marker click) */}
      {previewProfile && (
        <ProfilePreviewModal
          profile={{
            id: previewProfile.id,
            displayName: previewProfile.displayName,
            username: previewProfile.username,
            avatarUrl: previewProfile.avatarUrl,
            coverUrl: previewProfile.coverUrl,
            age: previewProfile.age,
            distance: previewProfile.distance,
            availableNow: previewProfile.availableNow,
            userLevel: previewProfile.userLevel,
            serviceCategory: previewProfile.serviceCategory,
            profileTags: previewProfile.profileTags,
            serviceTags: previewProfile.serviceTags,
            profileType: previewProfile.profileType,
          }}
          onClose={() => setPreviewProfile(null)}
        />
      )}

      {/* Mobile Quick Preview Bottom Sheet */}
      {mobilePreview && (
        <MobileQuickPreview
          profile={mobilePreview.profile}
          data={mobilePreview.data}
          entityType={entityType}
          categorySlug={categorySlug}
          onClose={() => setMobilePreview(null)}
        />
      )}
    </div>
  );
}
