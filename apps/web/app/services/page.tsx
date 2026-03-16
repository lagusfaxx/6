"use client";

import { memo, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { apiFetch, resolveMediaUrl } from "../../lib/api";
import { LocationFilterContext } from "../../hooks/useLocationFilter";
import useMe from "../../hooks/useMe";
import MapboxMap from "../../components/MapboxMap";
import type { MapMarker } from "../../components/MapboxMap";
import UserLevelBadge from "../../components/UserLevelBadge";
import ProfilePreviewModal from "../../components/ProfilePreviewModal";
import Stories from "../../components/Stories";
import { filterUserTags, hasPremiumBadge, hasVerifiedBadge } from "../../lib/systemBadges";
import StatusBadgeIcon from "../../components/StatusBadgeIcon";
import {
  MapPin,
  Search,
  SlidersHorizontal,
  X,
  Navigation,
  Sparkles,
  Users,
  Building2,
  ShoppingBag,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  MessageCircle,
  Crown,
  Star,
  Flame,
  Clock,
  Eye,
  Ruler,
  Weight,
  Scissors,
  CheckCircle,
  ShieldCheck,
  Video,
  Phone,
} from "lucide-react";

type ProfileResult = {
  id: string;
  displayName: string | null;
  username: string;
  avatarUrl: string | null;
  coverUrl: string | null;
  bio: string | null;
  city: string | null;
  latitude: number | null;
  longitude: number | null;
  realLatitude?: number | null;
  realLongitude?: number | null;
  distance: number | null;
  locality?: string | null;
  profileType: "PROFESSIONAL" | "ESTABLISHMENT" | "SHOP";
  serviceCategory: string | null;
  serviceDescription: string | null;
  isActive: boolean;
  availableNow?: boolean;
  lastSeen?: string | null;
  userLevel?: "SILVER" | "GOLD" | "DIAMOND";
  completedServices?: number | null;
  age?: number | null;
  heightCm?: number | null;
  hairColor?: string | null;
  weightKg?: number | null;
  baseRate?: number | null;
  galleryUrls?: string[] | null;
  profileTags?: string[];
  serviceTags?: string[];
  phone?: string | null;
  userId?: string | null;
};

const INITIAL_RADIUS_KM = 50;

const CATEGORY_TABS = [
  { key: "all", label: "Todas", icon: Users },
  { key: "escort", label: "Escorts", icon: Sparkles },
  { key: "masajes", label: "Masajes", icon: Users },
  { key: "moteles", label: "Moteles", icon: Building2 },
  { key: "sexshop", label: "Sex Shop", icon: ShoppingBag },
] as const;

const QUICK_FILTERS = [
  { key: "disponible", label: "Disponible ahora", icon: Clock, activeColor: "border-emerald-500 bg-emerald-500/10 text-emerald-400" },
  { key: "destacada", label: "Destacadas", icon: Star, activeColor: "border-amber-500 bg-amber-500/10 text-amber-300" },
  { key: "maduras", label: "Maduras (40+)", icon: Flame, activeColor: "border-fuchsia-500 bg-fuchsia-500/10 text-fuchsia-300" },
] as const;

const SORT_OPTIONS = [
  { key: "relevance", label: "Relevancia" },
  { key: "distance", label: "Más cerca" },
  { key: "newest", label: "Nuevas" },
  { key: "available", label: "Disponibles" },
] as const;

function formatWhatsAppUrl(phone: string) {
  const cleaned = phone.replace(/[^0-9+]/g, "");
  const num = cleaned.startsWith("+") ? cleaned.slice(1) : cleaned;
  return `https://wa.me/${num}`;
}

function ownerHref(profile: ProfileResult) {
  if (profile.profileType === "ESTABLISHMENT") return `/hospedaje/${profile.id}`;
  if (profile.profileType === "SHOP") return `/sexshop/${profile.username}`;
  return `/profesional/${profile.id}`;
}

function resolveCardImage(profile: ProfileResult) {
  return resolveMediaUrl(profile.coverUrl) ?? resolveMediaUrl(profile.avatarUrl);
}

function formatLastSeen(lastSeen?: string | null) {
  if (!lastSeen) return "Activa recientemente";
  const diff = Date.now() - Date.parse(lastSeen);
  if (!Number.isFinite(diff) || diff < 0) return "Activa recientemente";
  const minutes = Math.floor(diff / 60000);
  if (minutes < 60) return `Hace ${minutes}m`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `Hace ${hours}h`;
  const days = Math.floor(hours / 24);
  return `Hace ${days}d`;
}

function tierOrder(level?: string) {
  if (level === "DIAMOND") return 0;
  if (level === "GOLD") return 1;
  return 2;
}

function hasServiceOrProfileTag(profile: ProfileResult, candidates: string[]) {
  const normalize = (value: string) =>
    value
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .trim()
      .toLowerCase();
  const wanted = new Set(candidates.map(normalize));
  const tags = [...(profile.serviceTags || []), ...(profile.profileTags || [])]
    .map((tag) => normalize(String(tag || "")));
  return tags.some((tag) => wanted.has(tag));
}

function isEscortLikeProfile(profile: ProfileResult) {
  if (profile.profileType !== "PROFESSIONAL") return false;
  const normalizedCategory = String(profile.serviceCategory || "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase();
  if (normalizedCategory.includes("escort")) return true;
  return hasServiceOrProfileTag(profile, [
    "videollamada",
    "videollamadas",
    "despedida",
    "despedidas",
    "masajista",
    "masajistas",
    "masajes",
  ]);
}

function matchesProfessionalCategory(profile: ProfileResult, category: string) {
  if (profile.profileType !== "PROFESSIONAL") return false;
  if (category === "escort") return isEscortLikeProfile(profile);
  if (category === "videollamada" || category === "videollamadas") {
    return hasServiceOrProfileTag(profile, ["videollamada", "videollamadas"]);
  }
  if (category === "despedida" || category === "despedidas") {
    return hasServiceOrProfileTag(profile, ["despedida", "despedidas"]);
  }
  if (category === "masajes" || category === "masajistas") {
    return hasServiceOrProfileTag(profile, ["masaje", "masajes", "masajista", "masajistas"])
      || String(profile.serviceCategory || "").toLowerCase().includes("masaj");
  }
  return true;
}

function hasExamsBadge(profile: ProfileResult) {
  const tags = profile.profileTags || [];
  return tags.some((tag) => {
    const normalized = String(tag || "").trim().toLowerCase();
    return normalized === "profesional con examenes" || normalized === "profesional con exámenes";
  });
}

function hasVideoCallBadge(profile: ProfileResult) {
  if (profile.profileType !== "PROFESSIONAL") return false;
  return hasServiceOrProfileTag(profile, ["videollamada", "videollamadas"]);
}

function tierBorderClass(level?: string) {
  if (level === "DIAMOND") return "border-cyan-400/30 hover:border-cyan-400/50 hover:shadow-[0_8px_32px_rgba(34,211,238,0.12)]";
  if (level === "GOLD") return "border-amber-400/30 hover:border-amber-400/50 hover:shadow-[0_8px_32px_rgba(251,191,36,0.12)]";
  return "border-white/[0.08] hover:border-fuchsia-500/20";
}

/* ── Scrollable Row with arrows (desktop) ── */
function ScrollableRow({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const [canLeft, setCanLeft] = useState(false);
  const [canRight, setCanRight] = useState(false);

  const check = useCallback(() => {
    const el = ref.current;
    if (!el) return;
    setCanLeft(el.scrollLeft > 4);
    setCanRight(el.scrollLeft + el.clientWidth < el.scrollWidth - 4);
  }, []);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    check();
    el.addEventListener("scroll", check, { passive: true });
    const ro = new ResizeObserver(check);
    ro.observe(el);
    return () => { el.removeEventListener("scroll", check); ro.disconnect(); };
  }, [check]);

  const scroll = (dir: number) => {
    ref.current?.scrollBy({ left: dir * 300, behavior: "smooth" });
  };

  return (
    <div className="relative group/scroll">
      {canLeft && (
        <button
          type="button"
          onClick={() => scroll(-1)}
          className="absolute left-0 top-1/2 -translate-y-1/2 z-10 hidden sm:flex h-9 w-9 items-center justify-center rounded-full bg-black/70 border border-white/20 text-white shadow-lg hover:bg-black/90 transition"
        >
          <ChevronLeft className="h-5 w-5" />
        </button>
      )}
      <div
        ref={ref}
        className={`scrollbar-none -mx-4 flex gap-3 overflow-x-auto px-4 pb-2 snap-x snap-mandatory sm:[&>*]:w-[260px] lg:[&>*]:w-[280px] ${className}`}
      >
        {children}
      </div>
      {canRight && (
        <button
          type="button"
          onClick={() => scroll(1)}
          className="absolute right-0 top-1/2 -translate-y-1/2 z-10 hidden sm:flex h-9 w-9 items-center justify-center rounded-full bg-black/70 border border-white/20 text-white shadow-lg hover:bg-black/90 transition"
        >
          <ChevronRight className="h-5 w-5" />
        </button>
      )}
    </div>
  );
}

/* ── Featured Card (Diamond / Gold) ── */
const FeaturedCard = memo(function FeaturedCard({
  profile,
  onPreview,
  isAuthed,
}: {
  profile: ProfileResult;
  onPreview: (p: ProfileResult) => void;
  isAuthed: boolean;
}) {
  const img = resolveCardImage(profile);
  const chatHref = isAuthed
    ? `/chat/${profile.userId || profile.id}`
    : `/login?next=${encodeURIComponent(`/chat/${profile.userId || profile.id}`)}`;

  const isDiamond = profile.userLevel === "DIAMOND";
  const glowClass = isDiamond
    ? "shadow-[0_8px_40px_rgba(34,211,238,0.12),0_2px_8px_rgba(0,0,0,0.4)]"
    : "shadow-[0_8px_40px_rgba(251,191,36,0.10),0_2px_8px_rgba(0,0,0,0.4)]";

  return (
    <div className={`group w-[75vw] shrink-0 snap-start overflow-hidden rounded-[20px] border ${isDiamond ? "border-cyan-400/25" : "border-amber-400/25"} bg-[#0c0c14]/80 backdrop-blur-sm transition-all duration-500 hover:-translate-y-1.5 ${glowClass} sm:w-auto`}>
      <button type="button" onClick={() => onPreview(profile)} className="block w-full text-left">
        <div className="relative aspect-[3/4] overflow-hidden bg-[#0a0a10]">
          {img ? (
            <img src={img} alt={profile.displayName || profile.username} className="h-full w-full object-cover transition-transform duration-700 ease-out group-hover:scale-[1.08]" />
          ) : (
            <div className="flex h-full items-center justify-center bg-gradient-to-br from-fuchsia-900/20 to-violet-900/20"><Users className="h-12 w-12 text-white/10" /></div>
          )}
          {/* Top badges */}
          <div className="absolute top-2.5 left-2.5 right-2.5 flex justify-between items-start">
            <div className="flex flex-col gap-1.5">
              {profile.availableNow && (
                <span className="flex items-center gap-1.5 rounded-full border border-emerald-400/30 bg-emerald-500/90 px-2.5 py-1 text-[10px] font-bold text-white shadow-[0_4px_12px_rgba(16,185,129,0.3)]">
                  <span className="relative flex h-1.5 w-1.5"><span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-white opacity-75" /><span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-white" /></span> Online
                </span>
              )}
              {profile.profileType === "PROFESSIONAL" && hasExamsBadge(profile) && (
                <span className="inline-flex items-center gap-1 rounded-full border border-sky-300/30 bg-sky-500/20 px-2.5 py-1 text-[10px] font-semibold text-sky-100 shadow-lg backdrop-blur-xl">
                  <ShieldCheck className="h-3 w-3" /> Con exámenes
                </span>
              )}
              {hasVideoCallBadge(profile) && (
                <span className="inline-flex items-center gap-1 rounded-full border border-violet-300/30 bg-violet-500/20 px-2.5 py-1 text-[10px] font-semibold text-violet-100 shadow-lg backdrop-blur-xl">
                  <Video className="h-3 w-3" /> Videollamadas
                </span>
              )}
            </div>
            <UserLevelBadge level={profile.userLevel} className="px-2.5 py-1 text-[10px] shadow-lg" />
          </div>
          {/* Distance */}
          {profile.distance != null && (
            <div className="absolute right-2.5 bottom-16 rounded-xl border border-white/10 bg-black/40 px-2.5 py-1 text-[10px] text-white/80 backdrop-blur-xl tabular-nums">
              <MapPin className="mr-1 inline h-3 w-3 text-fuchsia-400/70" />
              {profile.distance < 1 ? `${Math.round(profile.distance * 1000)}m` : `${profile.distance.toFixed(1)} km`}
            </div>
          )}
          {/* Gradient overlay */}
          <div className="absolute inset-0 bg-gradient-to-t from-[#0c0c14] via-[#0c0c14]/30 to-transparent" />
          {/* Info */}
          <div className="absolute bottom-0 left-0 right-0 p-3.5">
            <div className="flex items-center gap-1.5 text-base font-bold leading-tight tracking-tight">
              {profile.displayName || profile.username}
              {hasPremiumBadge(profile.profileTags) && <StatusBadgeIcon type="premium" size="h-4 w-4" />}
              {hasVerifiedBadge(profile.profileTags) && <StatusBadgeIcon type="verificada" size="h-4 w-4" />}
              {profile.age ? <span className="text-white/50 font-normal text-sm">, {profile.age}</span> : ""}
            </div>
            <div className="mt-1 flex items-center gap-2 text-[11px] text-white/45">
              {profile.city && <span>{profile.city}</span>}
              {profile.city && <span className="text-white/15">·</span>}
              <span>{formatLastSeen(profile.lastSeen)}</span>
            </div>
          </div>
        </div>
      </button>
      {/* CTA bar */}
      <div className="flex gap-2 p-2.5 bg-[#0c0c14]/60">
        {profile.profileType === "ESTABLISHMENT" ? (
          <Link
            href={ownerHref(profile)}
            className="flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 py-2.5 text-xs font-semibold transition-all hover:brightness-110 shadow-[0_4px_16px_rgba(245,158,11,0.2)]"
          >
            <Building2 className="h-3.5 w-3.5" /> Reservar
          </Link>
        ) : profile.profileType === "SHOP" ? (
          <Link
            href={ownerHref(profile)}
            className="flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-gradient-to-r from-rose-500 to-pink-500 py-2.5 text-xs font-semibold transition-all hover:brightness-110 shadow-[0_4px_16px_rgba(244,63,94,0.2)]"
          >
            <ShoppingBag className="h-3.5 w-3.5" /> Visitar Tienda
          </Link>
        ) : (
          <Link
            href={chatHref}
            className="flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-gradient-to-r from-fuchsia-600 via-violet-600 to-fuchsia-600 bg-[length:200%_100%] py-2.5 text-xs font-semibold transition-all hover:bg-[position:100%_0] shadow-[0_4px_16px_rgba(168,85,247,0.2)]"
          >
            <MessageCircle className="h-3.5 w-3.5" /> Mensaje
          </Link>
        )}
        {profile.profileType === "PROFESSIONAL" && profile.phone && (
          <a
            href={formatWhatsAppUrl(profile.phone)}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-center rounded-xl border border-emerald-500/20 bg-emerald-500/[0.08] px-3 py-2.5 text-xs text-emerald-300 hover:bg-emerald-500/15 transition-all"
            title="WhatsApp"
          >
            <Phone className="h-3.5 w-3.5" />
          </a>
        )}
        <Link
          href={ownerHref(profile)}
          className="flex items-center justify-center rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2.5 text-xs font-medium text-white/60 hover:bg-white/[0.08] hover:text-white/80 transition-all"
        >
          <Eye className="h-3.5 w-3.5" />
        </Link>
      </div>
    </div>
  );
});

/* ── Standard Card ── */
const ProfileCard = memo(function ProfileCard({
  profile,
  onPreview,
  isAuthed,
}: {
  profile: ProfileResult;
  onPreview: (p: ProfileResult) => void;
  isAuthed: boolean;
}) {
  const img = resolveCardImage(profile);
  const chatHref = isAuthed
    ? `/chat/${profile.userId || profile.id}`
    : `/login?next=${encodeURIComponent(`/chat/${profile.userId || profile.id}`)}`;

  return (
    <div className={`group overflow-hidden rounded-[18px] border ${tierBorderClass(profile.userLevel)} bg-[#0c0c14]/70 backdrop-blur-sm transition-all duration-400 hover:-translate-y-1 hover:shadow-[0_12px_40px_rgba(0,0,0,0.4)]`}>
      <button type="button" onClick={() => onPreview(profile)} className="block w-full text-left">
        <div className="relative aspect-[3/4] overflow-hidden bg-[#0a0a10]">
          {img ? (
            <img src={img} alt={profile.displayName || profile.username} className="h-full w-full object-cover transition-transform duration-600 ease-out group-hover:scale-[1.06]" />
          ) : (
            <div className="flex h-full items-center justify-center text-white/20 bg-gradient-to-br from-fuchsia-900/10 to-violet-900/10"><Users className="h-10 w-10" /></div>
          )}
          {profile.distance != null && (
            <div className="absolute right-2 top-2 rounded-xl border border-white/10 bg-black/40 px-2 py-0.5 text-[9px] backdrop-blur-xl tabular-nums">
              <MapPin className="mr-0.5 inline h-2.5 w-2.5 text-fuchsia-400/60" />
              {profile.distance < 1 ? `${Math.round(profile.distance * 1000)}m` : `${profile.distance.toFixed(1)}km`}
            </div>
          )}
          <div className="absolute left-2 top-2 flex flex-col gap-1">
            {profile.availableNow ? (
              <div className="flex items-center gap-1 rounded-full border border-emerald-400/25 bg-emerald-500/80 px-2 py-0.5 text-[9px] text-white font-semibold backdrop-blur-xl shadow-[0_2px_8px_rgba(16,185,129,0.3)]">
                <span className="relative flex h-1.5 w-1.5"><span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-white opacity-75" /><span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-white" /></span> Online
              </div>
            ) : null}
            {profile.profileType === "PROFESSIONAL" && hasExamsBadge(profile) ? (
              <div className="inline-flex items-center gap-1 rounded-full border border-sky-300/30 bg-sky-500/20 px-2 py-0.5 text-[9px] font-medium text-sky-100 backdrop-blur-xl shadow">
                <ShieldCheck className="h-2.5 w-2.5" /> Exámenes
              </div>
            ) : null}
            {hasVideoCallBadge(profile) ? (
              <div className="inline-flex items-center gap-1 rounded-full border border-violet-300/30 bg-violet-500/20 px-2 py-0.5 text-[9px] font-medium text-violet-100 backdrop-blur-xl shadow">
                <Video className="h-2.5 w-2.5" /> Videollamadas
              </div>
            ) : null}
          </div>
          <div className="absolute inset-0 bg-gradient-to-t from-[#0c0c14] via-[#0c0c14]/20 to-transparent" />
          <div className="absolute bottom-0 left-0 right-0 p-2.5">
            <div className="flex items-center gap-1">
              <span className="truncate text-xs font-bold tracking-tight">
                {profile.displayName || profile.username}
                {profile.age ? <span className="font-normal text-white/50">, {profile.age}</span> : ""}
              </span>
              <UserLevelBadge level={profile.userLevel} className="shrink-0 px-1.5 py-0.5 text-[8px]" />
            </div>
            <p className="mt-0.5 text-[9px] text-white/40">{profile.city ? `${profile.city} · ` : ""}{formatLastSeen(profile.lastSeen)}</p>
          </div>
        </div>
      </button>
      <div className="flex gap-1.5 p-2 bg-[#0c0c14]/40">
        {profile.profileType === "ESTABLISHMENT" ? (
          <Link
            href={ownerHref(profile)}
            className="flex flex-1 items-center justify-center gap-1 rounded-xl bg-gradient-to-r from-amber-500/90 to-orange-500/90 py-2 text-[11px] font-semibold transition-all hover:brightness-110"
          >
            <Building2 className="h-3 w-3" /> Reservar
          </Link>
        ) : profile.profileType === "SHOP" ? (
          <Link
            href={ownerHref(profile)}
            className="flex flex-1 items-center justify-center gap-1 rounded-xl bg-gradient-to-r from-rose-500/90 to-pink-500/90 py-2 text-[11px] font-semibold transition-all hover:brightness-110"
          >
            <ShoppingBag className="h-3 w-3" /> Visitar Tienda
          </Link>
        ) : (
          <Link
            href={chatHref}
            className="flex flex-1 items-center justify-center gap-1 rounded-xl bg-gradient-to-r from-fuchsia-600/90 to-violet-600/90 py-2 text-[11px] font-semibold transition-all hover:brightness-110"
          >
            <MessageCircle className="h-3 w-3" /> Mensaje
          </Link>
        )}
        {profile.profileType === "PROFESSIONAL" && profile.phone && (
          <a
            href={formatWhatsAppUrl(profile.phone)}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-center rounded-xl border border-emerald-500/15 bg-emerald-500/[0.08] px-2.5 py-2 text-[11px] text-emerald-300 hover:bg-emerald-500/15 transition-all"
            title="WhatsApp"
          >
            <Phone className="h-3 w-3" />
          </a>
        )}
        <Link
          href={ownerHref(profile)}
          className="flex items-center justify-center rounded-xl border border-white/[0.08] bg-white/[0.03] px-2.5 py-2 text-[11px] text-white/50 hover:bg-white/[0.08] hover:text-white/70 transition-all"
        >
          <Eye className="h-3 w-3" />
        </Link>
      </div>
    </div>
  );
});

/* ── Profile Detail Panel (shown outside the map) ── */
function ProfileDetailPanel({
  profile,
  galleryUrls,
  onClose,
  isAuthed,
}: {
  profile: ProfileResult;
  galleryUrls: string[];
  onClose: () => void;
  isAuthed: boolean;
}) {
  const coverImg = resolveMediaUrl(profile.coverUrl) ?? resolveMediaUrl(profile.avatarUrl);
  const avatarImg = resolveMediaUrl(profile.avatarUrl);
  const chatHref = isAuthed
    ? `/chat/${profile.userId || profile.id}`
    : `/login?next=${encodeURIComponent(`/chat/${profile.userId || profile.id}`)}`;

  const tierAccent =
    profile.userLevel === "DIAMOND"
      ? "from-cyan-500/[0.06] to-transparent"
      : profile.userLevel === "GOLD"
      ? "from-amber-500/[0.06] to-transparent"
      : "from-fuchsia-500/[0.04] to-transparent";

  return (
    <div className="flex h-full flex-col">
      <div className="flex-1 overflow-y-auto">
        {/* Cover photo with premium overlay */}
        <div className="relative aspect-[16/9] overflow-hidden bg-[#0a0a10]">
          {coverImg ? (
            <img src={coverImg} alt="" className="h-full w-full object-cover" />
          ) : (
            <div className="flex h-full items-center justify-center bg-gradient-to-br from-fuchsia-900/25 to-violet-900/25">
              <Users className="h-12 w-12 text-white/10" />
            </div>
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-[#0d0e17] via-[#0d0e17]/30 to-black/20" />
          <button
            type="button"
            onClick={onClose}
            className="absolute top-3 right-3 flex h-8 w-8 items-center justify-center rounded-full border border-white/10 bg-black/40 text-white/70 backdrop-blur-xl transition-all hover:bg-white/10 hover:text-white hover:border-white/20 hover:scale-105"
          >
            <X className="h-4 w-4" />
          </button>
          {/* Level badge on cover */}
          {profile.userLevel && (
            <div className="absolute top-3 left-3">
              <UserLevelBadge level={profile.userLevel} className="px-2.5 py-1 text-[10px] shadow-lg" />
            </div>
          )}
        </div>

        {/* Avatar + Name section with ambient glow */}
        <div className="relative">
          <div className={`absolute inset-x-0 top-0 h-20 bg-gradient-to-b ${tierAccent}`} />
          <div className="relative px-4 -mt-10">
            <div className="flex items-end gap-3">
              <div className="h-20 w-20 shrink-0 overflow-hidden rounded-2xl border-[3px] border-[#0d0e17] bg-[#0d0e17] shadow-[0_8px_24px_rgba(0,0,0,0.4)]">
                {avatarImg ? (
                  <img src={avatarImg} alt={profile.displayName || profile.username} className="h-full w-full object-cover" />
                ) : (
                  <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-fuchsia-900/20 to-violet-900/20">
                    <Users className="h-8 w-8 text-white/20" />
                  </div>
                )}
              </div>
              <div className="min-w-0 pb-1">
                <h3 className="flex items-center gap-1 truncate text-lg font-bold leading-tight tracking-tight">
                  {profile.displayName || profile.username}
                  {hasPremiumBadge(profile.profileTags) && <StatusBadgeIcon type="premium" size="h-4 w-4" />}
                  {hasVerifiedBadge(profile.profileTags) && <StatusBadgeIcon type="verificada" size="h-4 w-4" />}
                  {profile.age ? <span className="font-normal text-white/45 text-base">, {profile.age}</span> : ""}
                </h3>
                {profile.city && (
                  <p className="mt-0.5 flex items-center gap-1 text-xs text-white/35">
                    <MapPin className="h-3 w-3 shrink-0 text-fuchsia-400/50" />
                    <span className="truncate">{profile.city}</span>
                  </p>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Status + quick info pills */}
        <div className="mt-3.5 flex flex-wrap gap-1.5 px-4">
          {profile.availableNow ? (
            <span className="flex items-center gap-1.5 rounded-xl border border-emerald-400/25 bg-emerald-500/10 px-2.5 py-1 text-xs font-medium text-emerald-400">
              <span className="relative flex h-2 w-2"><span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-60" /><span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-400" /></span>
              Online
            </span>
          ) : (
            <span className="flex items-center gap-1.5 rounded-xl border border-white/[0.06] bg-white/[0.03] px-2.5 py-1 text-xs text-white/35">
              <Clock className="h-3 w-3" />
              {formatLastSeen(profile.lastSeen)}
            </span>
          )}
          {profile.distance != null && (
            <span className="flex items-center gap-1 rounded-xl border border-white/[0.06] bg-white/[0.03] px-2.5 py-1 text-xs text-white/45 tabular-nums">
              <MapPin className="h-3 w-3 text-fuchsia-400/50" />
              {profile.distance < 1 ? `${Math.round(profile.distance * 1000)}m` : `${profile.distance.toFixed(1)} km`}
            </span>
          )}
          {profile.baseRate != null && (
            <span className="flex items-center gap-1 rounded-xl border border-fuchsia-500/15 bg-fuchsia-500/[0.08] px-2.5 py-1 text-xs font-semibold text-fuchsia-300">
              ${profile.baseRate.toLocaleString("es-CL")}
            </span>
          )}
          {profile.serviceCategory && (
            <span className="rounded-xl border border-white/[0.06] bg-white/[0.03] px-2.5 py-1 text-xs text-white/45">
              {profile.serviceCategory}
            </span>
          )}
          {profile.profileType === "PROFESSIONAL" && hasExamsBadge(profile) && (
            <span className="inline-flex items-center gap-1 rounded-xl border border-sky-300/25 bg-sky-500/10 px-2.5 py-1 text-xs font-medium text-sky-200">
              <ShieldCheck className="h-3 w-3" /> Con exámenes
            </span>
          )}
        </div>

        {/* Stats grid */}
        <div className="mt-3.5 grid grid-cols-2 gap-2 px-4">
          {profile.heightCm != null && (
            <div className="rounded-2xl border border-white/[0.05] bg-white/[0.02] p-3">
              <div className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-white/25">
                <Ruler className="h-3 w-3" /> Estatura
              </div>
              <div className="mt-1 text-sm font-bold text-white/75 tracking-tight">{Math.round(profile.heightCm)} cm</div>
            </div>
          )}
          {profile.weightKg != null && (
            <div className="rounded-2xl border border-white/[0.05] bg-white/[0.02] p-3">
              <div className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-white/25">
                <Weight className="h-3 w-3" /> Peso
              </div>
              <div className="mt-1 text-sm font-bold text-white/75 tracking-tight">{Math.round(profile.weightKg)} kg</div>
            </div>
          )}
          {profile.hairColor && (
            <div className="rounded-2xl border border-white/[0.05] bg-white/[0.02] p-3">
              <div className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-white/25">
                <Scissors className="h-3 w-3" /> Cabello
              </div>
              <div className="mt-1 text-sm font-bold text-white/75 tracking-tight">{profile.hairColor}</div>
            </div>
          )}
          {profile.completedServices != null && profile.completedServices > 0 && (
            <div className="rounded-2xl border border-white/[0.05] bg-white/[0.02] p-3">
              <div className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-white/25">
                <CheckCircle className="h-3 w-3" /> Servicios
              </div>
              <div className="mt-1 text-sm font-bold text-white/75 tracking-tight">{profile.completedServices}</div>
            </div>
          )}
        </div>

        {/* Description */}
        {(profile.bio || profile.serviceDescription) && (
          <div className="mt-4 px-4">
            <h4 className="mb-2 text-[10px] font-bold uppercase tracking-wider text-white/25">Descripción</h4>
            <div className="rounded-2xl border border-white/[0.05] bg-white/[0.02] p-3.5">
              <p className="whitespace-pre-line text-[13px] leading-relaxed text-white/50">
                {profile.bio || profile.serviceDescription}
              </p>
            </div>
          </div>
        )}

        {/* Profile tags (user-defined only) */}
        {filterUserTags(profile.profileTags).length > 0 && (
          <div className="mt-4 px-4">
            <h4 className="mb-2 text-[10px] font-bold uppercase tracking-wider text-white/25">Etiquetas</h4>
            <div className="flex flex-wrap gap-1.5">
              {filterUserTags(profile.profileTags).map((tag) => (
                <span key={tag} className="rounded-xl border border-fuchsia-500/15 bg-fuchsia-500/[0.08] px-3 py-1.5 text-[11px] font-medium text-fuchsia-300/80 transition-colors hover:bg-fuchsia-500/15">
                  {tag}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Service tags */}
        {profile.serviceTags && profile.serviceTags.length > 0 && (
          <div className="mt-4 px-4">
            <h4 className="mb-2 text-[10px] font-bold uppercase tracking-wider text-white/25">Servicios</h4>
            <div className="flex flex-wrap gap-1.5">
              {profile.serviceTags.map((tag) => (
                <span key={tag} className="rounded-xl border border-violet-500/15 bg-violet-500/[0.08] px-3 py-1.5 text-[11px] font-medium text-violet-300/80 transition-colors hover:bg-violet-500/15">
                  {tag}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Gallery */}
        {galleryUrls.length > 0 && (
          <div className="mt-4 px-4 pb-4">
            <h4 className="mb-2 text-[10px] font-bold uppercase tracking-wider text-white/25">Galería</h4>
            <div className="grid grid-cols-3 gap-2">
              {galleryUrls.map((url, idx) => (
                <div key={idx} className="aspect-square overflow-hidden rounded-xl bg-[#0a0a10] transition-transform duration-300 hover:scale-[1.03]">
                  <img src={resolveMediaUrl(url) ?? undefined} alt={`Foto ${idx + 1}`} className="h-full w-full object-cover" />
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Action buttons - premium style */}
      <div className="relative shrink-0 border-t border-white/[0.06] bg-[#0d0e17]/90 backdrop-blur-xl p-3 flex gap-2">
        <div className="absolute inset-x-0 -top-px h-px bg-gradient-to-r from-transparent via-fuchsia-500/15 to-transparent" />
        {profile.profileType === "ESTABLISHMENT" ? (
          <Link
            href={ownerHref(profile)}
            className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 py-3 text-sm font-semibold transition-all hover:brightness-110 shadow-[0_4px_16px_rgba(245,158,11,0.2)]"
          >
            <Building2 className="h-4 w-4" /> Reservar
          </Link>
        ) : profile.profileType === "SHOP" ? (
          <Link
            href={ownerHref(profile)}
            className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-rose-500 to-pink-500 py-3 text-sm font-semibold transition-all hover:brightness-110 shadow-[0_4px_16px_rgba(244,63,94,0.2)]"
          >
            <ShoppingBag className="h-4 w-4" /> Visitar Tienda
          </Link>
        ) : (
          <Link
            href={chatHref}
            className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-fuchsia-600 via-violet-600 to-fuchsia-600 bg-[length:200%_100%] py-3 text-sm font-semibold transition-all hover:bg-[position:100%_0] shadow-[0_4px_16px_rgba(168,85,247,0.2)]"
          >
            <MessageCircle className="h-4 w-4" /> Chat
          </Link>
        )}
        {profile.profileType === "PROFESSIONAL" && profile.phone && (
          <a
            href={formatWhatsAppUrl(profile.phone)}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-center gap-2 rounded-xl border border-emerald-500/20 bg-emerald-500/[0.08] px-4 py-3 text-sm font-medium text-emerald-300 transition-all hover:bg-emerald-500/15 hover:border-emerald-500/30"
            title="WhatsApp"
          >
            <Phone className="h-4 w-4" />
          </a>
        )}
        <Link
          href={ownerHref(profile)}
          className="flex flex-1 items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/[0.04] py-3 text-sm font-medium text-white/60 transition-all hover:bg-white/[0.08] hover:text-white/80 hover:border-white/15"
        >
          <Eye className="h-4 w-4" /> Ver Perfil
        </Link>
      </div>
    </div>
  );
}

/* ═══ PAGE ═══ */
export default function ServicesPage() {
  const locationCtx = useContext(LocationFilterContext);
  const effectiveLoc = locationCtx?.effectiveLocation ?? null;
  const { me } = useMe();
  const isAuthed = Boolean(me?.user?.id);

  const [profiles, setProfiles] = useState<ProfileResult[]>([]);
  const [loading, setLoading] = useState(true);
  const [hasLoadedOnce, setHasLoadedOnce] = useState(false);
  const [category, setCategory] = useState<string>("all");
  const [search, setSearch] = useState("");
  const [radiusKm, setRadiusKm] = useState(INITIAL_RADIUS_KM);
  const [showFilters, setShowFilters] = useState(false);
  const [sortBy, setSortBy] = useState<string>("relevance");
  const [previewProfile, setPreviewProfile] = useState<ProfileResult | null>(null);
  const [activeQuickFilters, setActiveQuickFilters] = useState<Set<string>>(new Set());
  const [showMap, setShowMap] = useState(true);
  const [selectedProfile, setSelectedProfile] = useState<ProfileResult | null>(null);
  const [detailGallery, setDetailGallery] = useState<string[]>([]);
  const [isMobileView, setIsMobileView] = useState(false);
  const fetchRef = useRef(0);

  const toggleQuickFilter = (key: string) => {
    setActiveQuickFilters((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  useEffect(() => {
    if (typeof window === "undefined") return;
    const check = () => setIsMobileView(window.innerWidth < 1024);
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  const effectiveLocWithFallback = useMemo<[number, number]>(
    () => effectiveLoc ?? [-33.45, -70.66],
    [effectiveLoc],
  );
  const mapCenter: [number, number] | null = effectiveLocWithFallback;
  const locationLabel = locationCtx?.state.mode === "city"
    ? locationCtx.state.selectedCity?.name ?? null
    : effectiveLoc ? "Tu ubicación" : null;

  useEffect(() => {
    if (typeof window === "undefined") return;
    const query = new URLSearchParams(window.location.search);
    if (query.get("q")) setSearch(query.get("q") || "");
    if (query.get("radiusKm")) setRadiusKm(Number(query.get("radiusKm")) || INITIAL_RADIUS_KM);
    if (query.get("category")) setCategory(query.get("category") || "all");
    if (query.get("sort")) setSortBy(query.get("sort") || "relevance");
  }, []);

  useEffect(() => {
    const myFetch = ++fetchRef.current;
    if (!hasLoadedOnce) setLoading(true);

    const qp = new URLSearchParams();
    if (category !== "all") {
      if (category === "moteles") {
        qp.set("types", "ESTABLISHMENT");
      } else if (category === "sexshop") {
        qp.set("types", "SHOP");
      } else {
        qp.set("types", "PROFESSIONAL");
        const categoryHandledClientSide = new Set(["escort", "videollamada", "videollamadas", "despedida", "despedidas", "masajes", "masajistas"]);
        if (!categoryHandledClientSide.has(category)) {
          qp.set("categorySlug", category);
        }
      }
    } else {
      qp.set("types", "PROFESSIONAL,ESTABLISHMENT,SHOP");
    }
    if (effectiveLocWithFallback) {
      qp.set("lat", String(effectiveLocWithFallback[0]));
      qp.set("lng", String(effectiveLocWithFallback[1]));
    }

    apiFetch<{ profiles: ProfileResult[] }>(`/services?${qp.toString()}`)
      .then((res) => {
        if (myFetch !== fetchRef.current) return;
        setProfiles(res?.profiles || []);
      })
      .catch(() => {
        if (myFetch !== fetchRef.current) return;
        setProfiles((current) => (current.length ? current : []));
      })
      .finally(() => {
        if (myFetch !== fetchRef.current) return;
        setLoading(false);
        setHasLoadedOnce(true);
      });
  }, [effectiveLocWithFallback, category]);

  /* ── Filter + Sort (tier-prioritized) ── */
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return [...profiles]
      .filter((profile) => {
        if (category !== "all") {
          if (category === "moteles" && profile.profileType !== "ESTABLISHMENT") return false;
          if (category === "sexshop" && profile.profileType !== "SHOP") return false;
          if (category !== "moteles" && category !== "sexshop" && !matchesProfessionalCategory(profile, category)) return false;
        }
        if (q) {
          const text = `${profile.displayName || ""} ${profile.username || ""} ${profile.serviceCategory || ""} ${profile.city || ""}`.toLowerCase();
          if (!text.includes(q)) return false;
        }
        if (profile.distance != null && profile.distance > radiusKm) return false;
        if (activeQuickFilters.has("disponible") && !profile.availableNow) return false;
        if (activeQuickFilters.has("maduras") && (profile.age == null || profile.age < 40)) return false;
        if (activeQuickFilters.has("destacada") && profile.userLevel !== "GOLD" && profile.userLevel !== "DIAMOND") return false;
        return true;
      })
      .sort((a, b) => {
        // Always prioritize higher tier
        const tierDiff = tierOrder(a.userLevel) - tierOrder(b.userLevel);
        if (tierDiff !== 0) return tierDiff;

        if (sortBy === "distance") return (a.distance ?? 1e9) - (b.distance ?? 1e9);
        if (sortBy === "available") return Number(Boolean(b.availableNow)) - Number(Boolean(a.availableNow));
        if (sortBy === "newest") return (Date.parse(b.lastSeen || "") || 0) - (Date.parse(a.lastSeen || "") || 0);
        // relevance: online first, then by distance
        if (Boolean(a.availableNow) !== Boolean(b.availableNow))
          return Number(Boolean(b.availableNow)) - Number(Boolean(a.availableNow));
        return (a.distance ?? 1e9) - (b.distance ?? 1e9);
      });
  }, [profiles, radiusKm, search, activeQuickFilters, sortBy]);

  const displayProfiles = useMemo(() => {
    if (filtered.length > 0) return filtered;
    return [...profiles].sort((a, b) => {
      const tierDiff = tierOrder(a.userLevel) - tierOrder(b.userLevel);
      if (tierDiff !== 0) return tierDiff;
      if (Boolean(a.availableNow) !== Boolean(b.availableNow))
        return Number(Boolean(b.availableNow)) - Number(Boolean(a.availableNow));
      return (a.distance ?? 1e9) - (b.distance ?? 1e9);
    });
  }, [filtered, profiles]);

  const isFeaturedProfile = (profile: ProfileResult) => profile.userLevel === "DIAMOND" || profile.userLevel === "GOLD";

  /* ── Separate featured (Diamond/Gold) from standard ── */
  const featuredProfiles = useMemo(
    () => displayProfiles.filter((p) => isFeaturedProfile(p)),
    [displayProfiles],
  );
  const standardProfiles = useMemo(
    () => displayProfiles.filter((p) => !isFeaturedProfile(p)),
    [displayProfiles],
  );

  const isAllCategoryView = category === "all";
  const featuredEscortProfiles = useMemo(
    () => displayProfiles.filter((p) => p.profileType === "PROFESSIONAL" && isFeaturedProfile(p)),
    [displayProfiles],
  );
  const diamondEscortProfiles = useMemo(
    () => featuredEscortProfiles.filter((p) => p.userLevel === "DIAMOND"),
    [featuredEscortProfiles],
  );
  const goldEscortProfiles = useMemo(
    () => featuredEscortProfiles.filter((p) => p.userLevel === "GOLD"),
    [featuredEscortProfiles],
  );
  const escortProfiles = useMemo(
    () => displayProfiles.filter((p) => p.profileType === "PROFESSIONAL" && !isFeaturedProfile(p)),
    [displayProfiles],
  );
  const motelProfiles = useMemo(
    () => displayProfiles.filter((p) => p.profileType === "ESTABLISHMENT"),
    [displayProfiles],
  );
  const sexShopProfiles = useMemo(
    () => displayProfiles.filter((p) => p.profileType === "SHOP"),
    [displayProfiles],
  );

  const handleMarkerSelect = useCallback(
    (marker: MapMarker) => {
      const profile = displayProfiles.find((p) => p.id === marker.id);
      if (profile) setSelectedProfile(profile);
    },
    [displayProfiles],
  );

  const handleMarkerDeselect = useCallback(() => {
    // Don't close on map click - only close via the X button
  }, []);

  /* Gallery fetch for selected profile */
  useEffect(() => {
    if (!selectedProfile) {
      setDetailGallery([]);
      return;
    }
    if (selectedProfile.galleryUrls && selectedProfile.galleryUrls.length > 0) {
      setDetailGallery(selectedProfile.galleryUrls);
      return;
    }
    let cancelled = false;
    apiFetch<{ gallery?: Array<{ url?: string | null }>; profile?: { coverUrl?: string | null; avatarUrl?: string | null } }>(
      `/profiles/${selectedProfile.username}`,
    )
      .then((res) => {
        if (cancelled) return;
        const urls = (res.gallery || []).map((g) => g?.url).filter((u): u is string => Boolean(u));
        const fallback = [res.profile?.coverUrl, res.profile?.avatarUrl].filter((u): u is string => Boolean(u));
        setDetailGallery(urls.length > 0 ? urls : fallback);
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [selectedProfile?.id, selectedProfile?.username]);

  /* Lock body scroll on mobile when profile panel is open */
  useEffect(() => {
    if (typeof document === "undefined") return;
    if (!(isMobileView && selectedProfile)) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = prev; };
  }, [isMobileView, selectedProfile]);

  const markers = useMemo(
    () =>
      displayProfiles
        .filter((p) => Number.isFinite(Number(p.latitude)) && Number.isFinite(Number(p.longitude)))
        .map((p) => ({
          id: p.id,
          name: p.displayName || p.username,
          lat: Number(p.latitude),
          lng: Number(p.longitude),
          realLat: Number(p.realLatitude ?? p.latitude),
          realLng: Number(p.realLongitude ?? p.longitude),
          subtitle: p.serviceCategory || p.city || "Perfil",
          username: p.username,
          href: ownerHref(p),
          avatarUrl: p.avatarUrl,
          age: p.age ?? null,
          heightCm: p.heightCm ?? null,
          hairColor: p.hairColor ?? null,
          weightKg: p.weightKg ?? null,
          coverUrl: p.coverUrl,
          serviceValue: p.baseRate ?? null,
          level: p.userLevel ?? null,
          lastSeen: p.lastSeen ?? null,
          tier: p.availableNow ? "online" : "offline",
          galleryUrls: p.galleryUrls ?? [],
          areaRadiusM: 500,
        })),
    [displayProfiles],
  );

  const activeFilterCount = activeQuickFilters.size + (search ? 1 : 0);

  return (
    <div className="pb-24">
      {/* ── Header ── */}
      <section className="relative border-b border-white/[0.06] bg-[#0a0a12]/80 backdrop-blur-2xl">
        <div className="absolute inset-x-0 bottom-0 h-px bg-gradient-to-r from-transparent via-fuchsia-400/15 to-transparent" />
        <div className="relative mx-auto max-w-6xl px-4 pt-3 pb-2.5">
          {/* Title row */}
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0 flex flex-col sm:flex-row sm:items-center gap-0.5 sm:gap-2.5">
              <h1 className="text-lg font-bold tracking-tight whitespace-nowrap">Cerca tuyo</h1>
              <p className="flex items-center gap-1.5 text-[10px] text-white/35 sm:text-[11px]">
                {locationLabel && (
                  <>
                    <MapPin className="h-2.5 w-2.5 text-fuchsia-400/50" />
                    <span className="text-fuchsia-300/40 font-medium">{locationLabel}</span>
                    <span className="text-white/[0.08]">·</span>
                  </>
                )}
                {!loading && <span>{displayProfiles.length} resultado{displayProfiles.length !== 1 ? "s" : ""}</span>}
                {loading && !hasLoadedOnce && <span>Buscando...</span>}
              </p>
            </div>
            <button
              type="button"
              onClick={() => setShowMap((v) => !v)}
              className={`shrink-0 rounded-full px-3 py-1.5 text-[11px] font-medium inline-flex items-center gap-1.5 transition-all ${showMap ? "bg-fuchsia-500/15 text-fuchsia-300 border border-fuchsia-500/25" : "bg-white/[0.04] text-white/45 border border-white/[0.08] hover:text-white/65 hover:bg-white/[0.07]"}`}
            >
              <MapPin className="h-3 w-3" />
              Mapa
            </button>
          </div>

          {/* Search + Sort + Filter */}
          <div className="mt-2.5 flex gap-1.5">
            <label className="flex flex-1 items-center gap-2.5 rounded-full border border-white/[0.07] bg-white/[0.03] px-3.5 py-2 text-sm focus-within:border-fuchsia-500/20 focus-within:bg-fuchsia-500/[0.02] transition-all">
              <Search className="h-3.5 w-3.5 shrink-0 text-white/25" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Buscar nombre, ciudad..."
                className="w-full bg-transparent text-xs outline-none placeholder:text-white/20"
              />
              {search && (
                <button type="button" onClick={() => setSearch("")} className="text-white/25 hover:text-white/55 transition-colors">
                  <X className="h-3 w-3" />
                </button>
              )}
            </label>

            <div className="relative hidden sm:block">
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value)}
                className="h-full rounded-full border border-white/[0.07] bg-white/[0.03] px-3 pr-7 text-[11px] text-white/50 appearance-none focus:outline-none focus:border-fuchsia-500/20 cursor-pointer transition-all"
              >
                {SORT_OPTIONS.map((opt) => (
                  <option key={opt.key} value={opt.key}>{opt.label}</option>
                ))}
              </select>
              <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 h-3 w-3 text-white/25" />
            </div>

            <button
              type="button"
              onClick={() => setShowFilters((s) => !s)}
              className={`shrink-0 rounded-full px-2.5 py-2 text-[11px] inline-flex items-center gap-1.5 transition-all ${
                showFilters || activeFilterCount > 0
                  ? "border border-fuchsia-500/25 bg-fuchsia-500/[0.08] text-fuchsia-200"
                  : "border border-white/[0.07] bg-white/[0.03] text-white/45 hover:text-white/65"
              }`}
            >
              <SlidersHorizontal className="h-3.5 w-3.5" />
              {activeFilterCount > 0 && (
                <span className="rounded-full bg-fuchsia-500 px-1.5 py-0.5 text-[9px] font-bold leading-none">{activeFilterCount}</span>
              )}
            </button>
          </div>

          {/* Category tabs + Quick filters */}
          <div className="mt-2 -mx-4 px-4 flex items-center gap-1.5 overflow-x-auto scrollbar-none">
            {CATEGORY_TABS.map((tab) => {
              const Icon = tab.icon;
              const isActive = category === tab.key;
              return (
                <button
                  key={tab.key}
                  type="button"
                  onClick={() => setCategory(tab.key)}
                  className={`flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1.5 text-[11px] font-medium transition-all ${
                    isActive
                      ? "bg-fuchsia-500/15 text-fuchsia-200 border border-fuchsia-500/20"
                      : "text-white/40 border border-transparent hover:text-white/60 hover:bg-white/[0.04]"
                  }`}
                >
                  <Icon className="h-3 w-3" />
                  {tab.label}
                </button>
              );
            })}
            <div className="h-4 w-px bg-white/[0.08] mx-0.5 shrink-0" />
            {QUICK_FILTERS.map((f) => {
              const Icon = f.icon;
              const isActive = activeQuickFilters.has(f.key);
              return (
                <button
                  key={f.key}
                  type="button"
                  onClick={() => toggleQuickFilter(f.key)}
                  className={`flex shrink-0 items-center gap-1 rounded-full px-2.5 py-1.5 text-[10px] font-medium transition-all ${
                    isActive ? f.activeColor : "text-white/30 border border-transparent hover:text-white/50 hover:bg-white/[0.03]"
                  }`}
                >
                  <Icon className="h-2.5 w-2.5" />
                  {f.label}
                </button>
              );
            })}
            {activeFilterCount > 0 && (
              <button
                type="button"
                onClick={() => { setActiveQuickFilters(new Set()); setSearch(""); }}
                className="flex shrink-0 items-center gap-1 rounded-full px-2.5 py-1.5 text-[10px] text-white/25 hover:text-white/55 transition-all"
              >
                <X className="h-2.5 w-2.5" /> Limpiar
              </button>
            )}
          </div>

          {/* Expanded filters */}
          {showFilters && (
            <div className="mt-2.5 rounded-2xl border border-white/[0.05] bg-white/[0.02] p-4">
              <div className="sm:hidden mb-3">
                <label className="text-[10px] font-bold uppercase tracking-wider text-white/30 mb-1.5 block">Ordenar por</label>
                <div className="relative">
                  <select
                    value={sortBy}
                    onChange={(e) => setSortBy(e.target.value)}
                    className="w-full rounded-xl border border-white/[0.07] bg-white/[0.03] px-3 py-2.5 text-[11px] text-white/60 appearance-none focus:outline-none focus:border-fuchsia-500/20 cursor-pointer"
                  >
                    {SORT_OPTIONS.map((opt) => (
                      <option key={opt.key} value={opt.key}>{opt.label}</option>
                    ))}
                  </select>
                  <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 h-3 w-3 text-white/25" />
                </div>
              </div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-[10px] font-bold uppercase tracking-wider text-white/30">Radio de búsqueda</label>
                <span className="text-[11px] text-fuchsia-300/70 font-semibold tabular-nums">{radiusKm} km</span>
              </div>
              <input
                type="range"
                min={1}
                max={100}
                value={radiusKm}
                onChange={(e) => setRadiusKm(Number(e.target.value))}
                className="w-full accent-fuchsia-500"
              />
              <div className="flex justify-between text-[9px] text-white/15 mt-1"><span>1 km</span><span>100 km</span></div>
            </div>
          )}
        </div>
      </section>

      <div className="mx-auto max-w-6xl px-4 py-5">
        {/* ── Stories ── */}
        <div className="mb-5">
          <Stories />
        </div>

        {/* ── Map + Desktop Profile Panel ── */}
        {showMap && (
          <div className={`mb-7 ${selectedProfile && !isMobileView ? "flex gap-4" : ""}`}>
            <div className={`overflow-hidden rounded-2xl border border-white/[0.06] shadow-[0_8px_32px_rgba(0,0,0,0.3)] ${selectedProfile && !isMobileView ? "min-w-0 flex-1" : ""}`}>
              <MapboxMap
                userLocation={mapCenter}
                markers={markers}
                height={selectedProfile && !isMobileView ? 520 : 280}
                autoCenterOnDataChange
                showMarkersForArea
                renderHtmlMarkers
                onMarkerSelect={handleMarkerSelect}
                onMarkerDeselect={handleMarkerDeselect}
              />
            </div>
            {/* Desktop side panel */}
            {selectedProfile && !isMobileView && (
              <div className="w-[420px] shrink-0 overflow-hidden rounded-2xl border border-white/[0.06] bg-[#0d0e17] shadow-[0_8px_32px_rgba(0,0,0,0.4)]" style={{ height: 520 }}>
                <ProfileDetailPanel
                  profile={selectedProfile}
                  galleryUrls={detailGallery}
                  onClose={() => setSelectedProfile(null)}
                  isAuthed={isAuthed}
                />
              </div>
            )}
          </div>
        )}

        {/* ── Mobile Bottom Sheet ── */}
        {selectedProfile && isMobileView && (
          <div className="fixed inset-0 z-[100] flex flex-col justify-end" role="dialog" aria-modal>
            <div
              className="absolute inset-0 bg-black/60 backdrop-blur-xl uzeed-animate-fade-in"
              onClick={() => setSelectedProfile(null)}
            />
            <div className="relative flex flex-col rounded-t-[24px] border-t border-white/[0.06] bg-[#0d0e17] uzeed-animate-slide-up shadow-[0_-16px_48px_rgba(0,0,0,0.5)]" style={{ maxHeight: "85vh" }}>
              {/* Drag handle */}
              <div className="flex justify-center py-3">
                <div className="h-1 w-10 rounded-full bg-white/15" />
              </div>
              <div className="flex-1 overflow-hidden">
                <ProfileDetailPanel
                  profile={selectedProfile}
                  galleryUrls={detailGallery}
                  onClose={() => setSelectedProfile(null)}
                  isAuthed={isAuthed}
                />
              </div>
            </div>
          </div>
        )}

        {/* ── Loading ── */}
        {loading && !hasLoadedOnce && (
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="aspect-[3/4] animate-pulse rounded-[18px] border border-white/[0.04] bg-white/[0.02]" />
            ))}
          </div>
        )}

        {/* ── No results ── */}
        {!loading && displayProfiles.length === 0 && (
          <div className="mb-6 rounded-[24px] border border-white/[0.06] bg-white/[0.02] p-12 text-center">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-fuchsia-500/[0.08] border border-fuchsia-500/15">
              <Search className="h-7 w-7 text-fuchsia-400/40" />
            </div>
            <h3 className="text-lg font-bold tracking-tight">No encontramos resultados</h3>
            <p className="mt-1.5 text-sm text-white/40">Intenta ampliar el rango o cambiar la ubicación en el chip del header.</p>
            <button
              type="button"
              onClick={() => { setRadiusKm(100); setActiveQuickFilters(new Set()); setCategory("all"); }}
              className="mt-5 rounded-xl bg-gradient-to-r from-fuchsia-600 via-violet-600 to-fuchsia-600 bg-[length:200%_100%] px-6 py-3 text-sm font-semibold transition-all hover:bg-[position:100%_0] shadow-[0_8px_24px_rgba(168,85,247,0.2)]"
            >
              Ampliar búsqueda
            </button>
          </div>
        )}

        {/* ═══ FEATURED SECTION (Diamond + Gold) ═══ */}
        {!isAllCategoryView && featuredProfiles.length > 0 && (
          <section className="mb-8">
            <div className="mb-4 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-amber-500/10 border border-amber-500/15">
                  <Crown className="h-4 w-4 text-amber-400" />
                </div>
                <div>
                  <h2 className="text-base font-bold tracking-tight">Destacadas</h2>
                  <span className="text-[10px] text-amber-400/60 font-medium uppercase tracking-wider">Premium</span>
                </div>
              </div>
              <Link href="/profesionales" className="group flex items-center gap-1 text-xs text-white/35 hover:text-fuchsia-400 transition-all">
                Ver todas <ChevronRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
              </Link>
            </div>
            <div className="scrollbar-none -mx-4 flex gap-3 overflow-x-auto px-4 pb-2 snap-x snap-mandatory sm:mx-0 sm:grid sm:grid-cols-2 sm:overflow-visible sm:px-0 md:grid-cols-3">
              {featuredProfiles.slice(0, 6).map((p) => (
                <FeaturedCard key={p.id} profile={p} onPreview={setPreviewProfile} isAuthed={isAuthed} />
              ))}
            </div>
          </section>
        )}

        {/* ═══ ALL CATEGORY ORDERED SECTIONS ═══ */}
        {isAllCategoryView && featuredEscortProfiles.length > 0 && (
          <section className="mb-8">
            <div className="mb-4 flex items-center gap-2.5">
              <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-amber-500/10 border border-amber-500/15">
                <Crown className="h-4 w-4 text-amber-400" />
              </div>
              <div>
                <h2 className="text-base font-bold tracking-tight">Escorts destacadas</h2>
                <span className="text-[10px] text-amber-400/60 font-medium uppercase tracking-wider">Premium</span>
              </div>
            </div>

            {diamondEscortProfiles.length > 0 && (
              <div className="mb-6">
                <h3 className="mb-2.5 flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-cyan-300/70">
                  <span className="h-px flex-1 bg-gradient-to-r from-cyan-500/20 to-transparent" />
                  Diamond
                  <span className="h-px flex-1 bg-gradient-to-l from-cyan-500/20 to-transparent" />
                </h3>
                <ScrollableRow>
                  {diamondEscortProfiles.map((p) => (
                    <FeaturedCard key={p.id} profile={p} onPreview={setPreviewProfile} isAuthed={isAuthed} />
                  ))}
                </ScrollableRow>
              </div>
            )}

            {goldEscortProfiles.length > 0 && (
              <div>
                <h3 className="mb-2.5 flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-amber-300/70">
                  <span className="h-px flex-1 bg-gradient-to-r from-amber-500/20 to-transparent" />
                  Gold
                  <span className="h-px flex-1 bg-gradient-to-l from-amber-500/20 to-transparent" />
                </h3>
                <ScrollableRow>
                  {goldEscortProfiles.map((p) => (
                    <FeaturedCard key={p.id} profile={p} onPreview={setPreviewProfile} isAuthed={isAuthed} />
                  ))}
                </ScrollableRow>
              </div>
            )}
          </section>
        )}

        {isAllCategoryView && escortProfiles.length > 0 && (
          <section className="mb-8">
            <div className="mb-4 flex items-center gap-2.5">
              <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-fuchsia-500/10 border border-fuchsia-500/15">
                <Sparkles className="h-3.5 w-3.5 text-fuchsia-300" />
              </div>
              <h2 className="text-base font-bold tracking-tight">Escorts</h2>
            </div>
            <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-4">
              {escortProfiles.map((profile) => (
                <ProfileCard key={profile.id} profile={profile} onPreview={setPreviewProfile} isAuthed={isAuthed} />
              ))}
            </div>
          </section>
        )}

        {isAllCategoryView && motelProfiles.length > 0 && (
          <section className="mb-8">
            <div className="mb-4 flex items-center gap-2.5">
              <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-sky-500/10 border border-sky-500/15">
                <Building2 className="h-3.5 w-3.5 text-sky-300" />
              </div>
              <h2 className="text-base font-bold tracking-tight">Moteles</h2>
            </div>
            <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-4">
              {motelProfiles.map((profile) => (
                <ProfileCard key={profile.id} profile={profile} onPreview={setPreviewProfile} isAuthed={isAuthed} />
              ))}
            </div>
          </section>
        )}

        {isAllCategoryView && sexShopProfiles.length > 0 && (
          <section>
            <div className="mb-4 flex items-center gap-2.5">
              <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-rose-500/10 border border-rose-500/15">
                <ShoppingBag className="h-3.5 w-3.5 text-rose-300" />
              </div>
              <h2 className="text-base font-bold tracking-tight">Sex Shop</h2>
            </div>
            <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-4">
              {sexShopProfiles.map((profile) => (
                <ProfileCard key={profile.id} profile={profile} onPreview={setPreviewProfile} isAuthed={isAuthed} />
              ))}
            </div>
          </section>
        )}

        {/* ═══ ALL PROFILES GRID ═══ */}
        {!isAllCategoryView && standardProfiles.length > 0 && (
          <section>
            <div className="mb-4 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-white/[0.04] border border-white/[0.06]">
                  <Users className="h-3.5 w-3.5 text-white/45" />
                </div>
                <h2 className="text-base font-bold tracking-tight">Todas las experiencias</h2>
              </div>
              {filtered.length === 0 && displayProfiles.length > 0 && (
                <p className="text-[11px] text-white/30">Mostrando todos</p>
              )}
            </div>
            <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-4">
              {standardProfiles.map((profile) => (
                <ProfileCard key={profile.id} profile={profile} onPreview={setPreviewProfile} isAuthed={isAuthed} />
              ))}
            </div>
          </section>
        )}

        {/* ═══ CTA Registration ═══ */}
        {!isAuthed && displayProfiles.length > 0 && (
          <section className="mt-12 relative overflow-hidden rounded-[24px] border border-fuchsia-500/15 bg-gradient-to-br from-fuchsia-600/[0.06] via-violet-600/[0.04] to-transparent p-10 text-center">
            <div className="absolute -top-20 -right-20 h-60 w-60 rounded-full bg-fuchsia-500/[0.06] blur-[80px] pointer-events-none" />
            <div className="absolute -bottom-10 -left-10 h-40 w-40 rounded-full bg-violet-500/[0.05] blur-[60px] pointer-events-none" />
            <div className="relative">
              <h2 className="text-xl font-bold tracking-tight">Crea tu cuenta gratis</h2>
              <p className="mx-auto mt-2.5 max-w-md text-sm text-white/40">
                Regístrate para enviar mensajes, guardar favoritos y descubrir más cerca de ti.
              </p>
              <div className="mt-5 flex flex-col items-center gap-2.5 sm:flex-row sm:justify-center">
                <Link href="/register?type=CLIENT" className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-fuchsia-600 via-violet-600 to-fuchsia-600 bg-[length:200%_100%] px-7 py-3.5 text-sm font-bold transition-all hover:bg-[position:100%_0] shadow-[0_8px_32px_rgba(168,85,247,0.25)]">
                  Registro gratis <ChevronRight className="h-4 w-4" />
                </Link>
                <Link href="/login" className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.03] px-7 py-3.5 text-sm font-medium text-white/60 transition-all hover:bg-white/[0.06] hover:border-white/15">
                  Ya tengo cuenta
                </Link>
              </div>
            </div>
          </section>
        )}
      </div>

      {/* Preview Modal */}
      {previewProfile && (
        <ProfilePreviewModal
          profile={previewProfile}
          onClose={() => setPreviewProfile(null)}
        />
      )}
    </div>
  );
}
