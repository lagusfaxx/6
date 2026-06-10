"use client";

import { memo, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import dynamic from "next/dynamic";
import { apiFetch, resolveMediaUrl } from "../../lib/api";
import { LocationFilterContext } from "../../hooks/useLocationFilter";
import useMe from "../../hooks/useMe";
import { trackAction } from "../../hooks/useAnalytics";
import type { MapMarker } from "../../components/MapboxMap";
import UserLevelBadge from "../../components/UserLevelBadge";
import {
  MapPin,
  Navigation,
  Users,
  Building2,
  ShoppingBag,
  MessageCircle,
  Phone,
  Eye,
  ExternalLink,
  ChevronLeft,
  ChevronRight,
  SlidersHorizontal,
  LocateFixed,
} from "lucide-react";

const MapboxMap = dynamic(() => import("../../components/MapboxMap"), { ssr: false });
const ProfilePreviewModal = dynamic(() => import("../../components/ProfilePreviewModal"), { ssr: false });

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
  isActive: boolean;
  availableNow?: boolean;
  lastSeen?: string | null;
  userLevel?: "SILVER" | "GOLD" | "DIAMOND";
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
  websiteUrl?: string | null;
  externalOnly?: boolean;
};

const RADIUS_OPTIONS = [1, 5, 10, 25, 50] as const;
const DEFAULT_RADIUS_KM = 10;
const MAX_CARDS = 40;

function formatWhatsAppUrl(phone: string) {
  const cleaned = phone.replace(/[^0-9+]/g, "");
  const num = cleaned.startsWith("+") ? cleaned.slice(1) : cleaned;
  return `https://wa.me/${num}`;
}

function ownerHref(profile: ProfileResult) {
  if (profile.externalOnly && profile.websiteUrl) return profile.websiteUrl;
  if (profile.profileType === "ESTABLISHMENT") return `/hospedaje/${profile.id}`;
  if (profile.profileType === "SHOP") return `/sexshop/${profile.username}`;
  return `/profesional/${profile.id}`;
}

function formatDistance(distance: number | null | undefined) {
  if (distance == null || !Number.isFinite(distance)) return null;
  if (distance < 1) return `${Math.round(distance * 1000)} m`;
  return `${distance.toFixed(1)} km`;
}

/* ── Tarjeta horizontal del carrusel ── */
const NearbyCard = memo(function NearbyCard({
  profile,
  isFocused,
  onPreview,
  isAuthed,
}: {
  profile: ProfileResult;
  isFocused: boolean;
  onPreview: (p: ProfileResult) => void;
  isAuthed: boolean;
}) {
  const img = resolveMediaUrl(profile.avatarUrl) ?? resolveMediaUrl(profile.coverUrl);
  const chatHref = isAuthed
    ? `/chat/${profile.userId || profile.id}`
    : `/login?next=${encodeURIComponent(`/chat/${profile.userId || profile.id}`)}`;
  const distanceLabel = formatDistance(profile.distance);

  return (
    <div
      className={`w-[290px] rounded-2xl border p-2.5 backdrop-blur-2xl transition-all duration-300 ${
        isFocused
          ? "border-fuchsia-500/60 bg-[#16101f]/95 shadow-[0_8px_32px_rgba(217,70,239,0.25)]"
          : "border-white/10 bg-[#0c0c14]/90 shadow-[0_8px_24px_rgba(0,0,0,0.45)]"
      }`}
    >
      <div className="flex gap-3">
        <button
          type="button"
          onClick={() => onPreview(profile)}
          className="relative h-[88px] w-[88px] shrink-0 overflow-hidden rounded-xl bg-[#0a0a10]"
        >
          {img ? (
            <img src={img} alt={profile.displayName || profile.username} className="h-full w-full object-cover" />
          ) : (
            <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-fuchsia-900/20 to-violet-900/20">
              <Users className="h-7 w-7 text-white/15" />
            </div>
          )}
          {profile.availableNow && (
            <span className="absolute left-1.5 top-1.5 flex h-2.5 w-2.5">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex h-2.5 w-2.5 rounded-full border border-black/40 bg-emerald-400" />
            </span>
          )}
        </button>

        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => onPreview(profile)}
              className="min-w-0 truncate text-left text-[13px] font-bold tracking-tight"
            >
              {profile.displayName || profile.username}
              {profile.age ? <span className="font-normal text-white/50">, {profile.age}</span> : null}
            </button>
            <UserLevelBadge level={profile.userLevel} className="shrink-0 px-1.5 py-0.5 text-[8px]" />
          </div>

          <div className="mt-1 flex items-baseline gap-1.5">
            {distanceLabel ? (
              <span className="inline-flex items-center gap-1 text-base font-extrabold tabular-nums text-fuchsia-300">
                <MapPin className="h-3.5 w-3.5 text-fuchsia-400/80" />
                {distanceLabel}
              </span>
            ) : (
              <span className="text-[11px] text-white/35">Sin distancia</span>
            )}
            {profile.city && <span className="truncate text-[11px] text-white/35">· {profile.city}</span>}
          </div>

          <div className="mt-2 flex gap-1.5">
            {profile.externalOnly && profile.websiteUrl ? (
              <a
                href={profile.websiteUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex flex-1 items-center justify-center gap-1 rounded-lg bg-gradient-to-r from-amber-500/90 to-orange-500/90 py-1.5 text-[11px] font-semibold transition-all hover:brightness-110"
              >
                <ExternalLink className="h-3 w-3" /> Web
              </a>
            ) : profile.profileType === "ESTABLISHMENT" ? (
              <Link
                href={ownerHref(profile)}
                className="flex flex-1 items-center justify-center gap-1 rounded-lg bg-gradient-to-r from-amber-500/90 to-orange-500/90 py-1.5 text-[11px] font-semibold transition-all hover:brightness-110"
              >
                <Building2 className="h-3 w-3" /> Reservar
              </Link>
            ) : profile.profileType === "SHOP" ? (
              <Link
                href={ownerHref(profile)}
                className="flex flex-1 items-center justify-center gap-1 rounded-lg bg-gradient-to-r from-rose-500/90 to-pink-500/90 py-1.5 text-[11px] font-semibold transition-all hover:brightness-110"
              >
                <ShoppingBag className="h-3 w-3" /> Tienda
              </Link>
            ) : (
              <Link
                href={chatHref}
                className="flex flex-1 items-center justify-center gap-1 rounded-lg bg-gradient-to-r from-fuchsia-600/90 to-violet-600/90 py-1.5 text-[11px] font-semibold transition-all hover:brightness-110"
              >
                <MessageCircle className="h-3 w-3" /> Mensaje
              </Link>
            )}
            {profile.profileType === "PROFESSIONAL" && profile.phone && (
              <a
                href={formatWhatsAppUrl(profile.phone)}
                target="_blank"
                rel="noopener noreferrer"
                onClick={() => trackAction("whatsapp_click", profile.id, { source: "cerca_card", displayName: profile.displayName })}
                className="flex items-center justify-center rounded-lg border border-emerald-500/20 bg-emerald-500/[0.08] px-2.5 py-1.5 text-emerald-300 transition-all hover:bg-emerald-500/15"
                title="WhatsApp"
              >
                <Phone className="h-3 w-3" />
              </a>
            )}
            <Link
              href={ownerHref(profile)}
              className="flex items-center justify-center rounded-lg border border-white/10 bg-white/[0.04] px-2.5 py-1.5 text-white/55 transition-all hover:bg-white/[0.08] hover:text-white/80"
              title="Ver perfil"
            >
              <Eye className="h-3 w-3" />
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
});

/* ═══ PAGE ═══ */
export default function CercaPage() {
  const locationCtx = useContext(LocationFilterContext);
  const effectiveLoc = locationCtx?.effectiveLocation ?? null;
  const { me } = useMe();
  const isAuthed = Boolean(me?.user?.id);

  const [profiles, setProfiles] = useState<ProfileResult[]>([]);
  const [loading, setLoading] = useState(true);
  const [radiusKm, setRadiusKm] = useState<number>(DEFAULT_RADIUS_KM);
  const [focusedId, setFocusedId] = useState<string | null>(null);
  const [previewProfile, setPreviewProfile] = useState<ProfileResult | null>(null);
  const fetchRef = useRef(0);

  const railRef = useRef<HTMLDivElement | null>(null);
  const cardRefs = useRef<Map<string, HTMLDivElement>>(new Map());
  const programmaticUntilRef = useRef(0);
  const scrollDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const effectiveLocWithFallback = useMemo<[number, number]>(
    () => effectiveLoc ?? [-33.45, -70.66],
    [effectiveLoc],
  );
  const locationLabel = locationCtx?.state.mode === "city"
    ? locationCtx.state.selectedCity?.name ?? null
    : effectiveLoc ? "Tu ubicación" : null;

  /* Pedir GPS al entrar: esta página vive de la ubicación real */
  useEffect(() => {
    if (!locationCtx) return;
    if (locationCtx.state.mode !== "gps" || locationCtx.state.gpsLocation) return;
    if (typeof navigator === "undefined" || !navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      (pos) => locationCtx.setGps([pos.coords.latitude, pos.coords.longitude]),
      () => {},
      { enableHighAccuracy: true, timeout: 6000 },
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [locationCtx?.state.mode]);

  useEffect(() => {
    const myFetch = ++fetchRef.current;
    setLoading(true);
    const qp = new URLSearchParams();
    qp.set("types", "PROFESSIONAL,ESTABLISHMENT,SHOP");
    qp.set("lat", String(effectiveLocWithFallback[0]));
    qp.set("lng", String(effectiveLocWithFallback[1]));

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
      });
  }, [effectiveLocWithFallback]);

  /* La promesa de la página: lo más cercano primero, dentro del radio */
  const nearby = useMemo(
    () =>
      profiles
        .filter((p) => p.distance != null && Number.isFinite(p.distance) && p.distance <= radiusKm)
        .sort((a, b) => (a.distance ?? 1e9) - (b.distance ?? 1e9)),
    [profiles, radiusKm],
  );
  const cards = useMemo(() => nearby.slice(0, MAX_CARDS), [nearby]);

  const nextRadius = RADIUS_OPTIONS.find((r) => r > radiusKm) ?? null;

  const markers = useMemo(
    () =>
      nearby
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
    [nearby],
  );

  /* Mapa → carrusel: clic en pin centra la tarjeta */
  const handleMarkerSelect = useCallback((marker: MapMarker) => {
    setFocusedId(marker.id);
    const el = cardRefs.current.get(marker.id);
    const rail = railRef.current;
    if (el && rail) {
      programmaticUntilRef.current = Date.now() + 900;
      rail.scrollTo({
        left: el.offsetLeft + el.offsetWidth / 2 - rail.clientWidth / 2,
        behavior: "smooth",
      });
    }
  }, []);

  const handleMarkerDeselect = useCallback(() => setFocusedId(null), []);

  /* Carrusel → mapa: la tarjeta centrada manda el mapa a su pin */
  const handleRailScroll = useCallback(() => {
    if (Date.now() < programmaticUntilRef.current) return;
    if (scrollDebounceRef.current) clearTimeout(scrollDebounceRef.current);
    scrollDebounceRef.current = setTimeout(() => {
      const rail = railRef.current;
      if (!rail) return;
      const center = rail.scrollLeft + rail.clientWidth / 2;
      let bestId: string | null = null;
      let bestDist = Infinity;
      cardRefs.current.forEach((el, id) => {
        const d = Math.abs(el.offsetLeft + el.offsetWidth / 2 - center);
        if (d < bestDist) {
          bestDist = d;
          bestId = id;
        }
      });
      if (bestId) setFocusedId(bestId);
    }, 150);
  }, []);

  useEffect(() => () => {
    if (scrollDebounceRef.current) clearTimeout(scrollDebounceRef.current);
  }, []);

  const scrollRail = (dir: number) => {
    programmaticUntilRef.current = 0;
    railRef.current?.scrollBy({ left: dir * 300, behavior: "smooth" });
  };

  const setCardRef = useCallback((id: string) => (el: HTMLDivElement | null) => {
    if (el) cardRefs.current.set(id, el);
    else cardRefs.current.delete(id);
  }, []);

  return (
    <div className="relative h-[calc(100svh_-_76px)] w-full overflow-hidden md:h-[calc(100svh_-_90px)] [&_.uzeed-map-recenter-btn]:bottom-[calc(13rem_+_env(safe-area-inset-bottom))] md:[&_.uzeed-map-recenter-btn]:bottom-44">
      {/* ── Mapa a pantalla completa ── */}
      <div className="absolute inset-0">
        <MapboxMap
          userLocation={effectiveLocWithFallback}
          markers={markers}
          fill
          rangeKm={radiusKm}
          autoCenterOnDataChange
          showMarkersForArea
          renderHtmlMarkers
          focusMarkerId={focusedId}
          onMarkerSelect={handleMarkerSelect}
          onMarkerDeselect={handleMarkerDeselect}
        />
      </div>

      {/* ── Controles flotantes (top) ── */}
      <div className="pointer-events-none absolute inset-x-0 top-0 z-20 bg-gradient-to-b from-black/55 via-black/20 to-transparent px-3 pb-8 pt-3">
        <div className="flex items-start justify-between gap-2">
          <div className="pointer-events-auto flex min-w-0 flex-col gap-2">
            {/* Contador + ubicación */}
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-black/60 px-3 py-1.5 text-[11px] font-semibold backdrop-blur-xl">
                <span className="relative flex h-1.5 w-1.5">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-fuchsia-400 opacity-75" />
                  <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-fuchsia-400" />
                </span>
                {loading ? "Buscando..." : `${nearby.length} cerca de ti`}
              </span>
              {locationLabel ? (
                <span className="inline-flex max-w-[140px] items-center gap-1 rounded-full border border-white/10 bg-black/60 px-2.5 py-1.5 text-[10px] text-white/55 backdrop-blur-xl sm:max-w-none">
                  <MapPin className="h-2.5 w-2.5 shrink-0 text-fuchsia-400/70" />
                  <span className="truncate">{locationLabel}</span>
                </span>
              ) : (
                <button
                  type="button"
                  onClick={() => locationCtx?.useCurrentLocation()}
                  className="inline-flex items-center gap-1.5 rounded-full border border-sky-400/30 bg-sky-500/20 px-3 py-1.5 text-[11px] font-semibold text-sky-200 backdrop-blur-xl transition hover:bg-sky-500/30"
                >
                  <LocateFixed className="h-3 w-3" />
                  Activar mi ubicación
                </button>
              )}
            </div>

            {/* Chips de radio */}
            <div className="scrollbar-none -mx-1 flex gap-1.5 overflow-x-auto px-1 pb-0.5">
              {RADIUS_OPTIONS.map((r) => {
                const active = radiusKm === r;
                return (
                  <button
                    key={r}
                    type="button"
                    onClick={() => setRadiusKm(r)}
                    className={`shrink-0 rounded-full px-3 py-1.5 text-[11px] font-semibold backdrop-blur-xl transition-all duration-200 ${
                      active
                        ? "border border-fuchsia-400/50 bg-fuchsia-500/90 text-white shadow-[0_4px_16px_rgba(217,70,239,0.35)]"
                        : "border border-white/10 bg-black/55 text-white/55 hover:bg-black/75 hover:text-white/80"
                    }`}
                  >
                    {r} km
                  </button>
                );
              })}
            </div>
          </div>

          {/* Acceso a Explorar con filtros completos */}
          <Link
            href="/services"
            className="pointer-events-auto mr-11 inline-flex shrink-0 items-center gap-1.5 rounded-full border border-white/10 bg-black/60 px-3 py-1.5 text-[11px] font-semibold text-white/70 backdrop-blur-xl transition hover:bg-black/80 hover:text-white"
          >
            <SlidersHorizontal className="h-3 w-3" />
            <span className="hidden sm:inline">Explorar</span>
          </Link>
        </div>
      </div>

      {/* ── Sin resultados en el radio ── */}
      {!loading && nearby.length === 0 && (
        <div className="absolute inset-x-0 top-1/2 z-20 flex -translate-y-1/2 justify-center px-6">
          <div className="w-full max-w-sm rounded-2xl border border-white/10 bg-[#0c0c14]/95 p-6 text-center shadow-[0_16px_48px_rgba(0,0,0,0.5)] backdrop-blur-2xl">
            <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-xl border border-fuchsia-500/15 bg-fuchsia-500/[0.08]">
              <Navigation className="h-5 w-5 text-fuchsia-400/60" />
            </div>
            <h2 className="text-base font-bold tracking-tight">Nada a menos de {radiusKm} km</h2>
            <p className="mt-1 text-xs text-white/40">
              {nextRadius
                ? "Amplía el radio para descubrir más perfiles a tu alrededor."
                : "Prueba otra ubicación o explora todo el catálogo."}
            </p>
            {nextRadius ? (
              <button
                type="button"
                onClick={() => setRadiusKm(nextRadius)}
                className="mt-4 w-full rounded-xl bg-gradient-to-r from-fuchsia-600 to-violet-600 px-5 py-2.5 text-sm font-semibold transition-all hover:brightness-110 shadow-[0_8px_24px_rgba(168,85,247,0.25)]"
              >
                Ampliar a {nextRadius} km
              </button>
            ) : (
              <Link
                href="/services"
                className="mt-4 block w-full rounded-xl bg-gradient-to-r from-fuchsia-600 to-violet-600 px-5 py-2.5 text-sm font-semibold transition-all hover:brightness-110 shadow-[0_8px_24px_rgba(168,85,247,0.25)]"
              >
                Ir a Explorar
              </Link>
            )}
          </div>
        </div>
      )}

      {/* ── Carrusel inferior sincronizado ── */}
      <div className="absolute inset-x-0 z-20 bottom-[calc(4.75rem_+_env(safe-area-inset-bottom))] md:bottom-4">
        {loading && cards.length === 0 ? (
          <div className="scrollbar-none flex gap-3 overflow-x-auto px-4 pb-1">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="h-[118px] w-[290px] shrink-0 animate-pulse rounded-2xl border border-white/[0.06] bg-[#0c0c14]/80 backdrop-blur-xl" />
            ))}
          </div>
        ) : cards.length > 0 ? (
          <div className="group/rail relative">
            <button
              type="button"
              onClick={() => scrollRail(-1)}
              className="absolute left-2 top-1/2 z-10 hidden h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full border border-white/15 bg-black/70 text-white shadow-lg transition hover:bg-black/90 md:flex"
              aria-label="Anterior"
            >
              <ChevronLeft className="h-5 w-5" />
            </button>
            <div
              ref={railRef}
              onScroll={handleRailScroll}
              className="scrollbar-none flex snap-x snap-mandatory gap-3 overflow-x-auto scroll-px-4 px-4 pb-1"
            >
              {cards.map((p) => (
                <div key={p.id} ref={setCardRef(p.id)} className="shrink-0 snap-center">
                  <NearbyCard
                    profile={p}
                    isFocused={focusedId === p.id}
                    onPreview={setPreviewProfile}
                    isAuthed={isAuthed}
                  />
                </div>
              ))}
              {nearby.length > MAX_CARDS && (
                <Link
                  href="/services?sort=distance"
                  className="flex w-[160px] shrink-0 snap-center flex-col items-center justify-center gap-2 rounded-2xl border border-white/10 bg-[#0c0c14]/90 p-4 text-center backdrop-blur-2xl transition hover:border-fuchsia-500/30"
                >
                  <ChevronRight className="h-5 w-5 text-fuchsia-400" />
                  <span className="text-[11px] font-semibold text-white/70">
                    Ver {nearby.length - MAX_CARDS} más en Explorar
                  </span>
                </Link>
              )}
            </div>
            <button
              type="button"
              onClick={() => scrollRail(1)}
              className="absolute right-2 top-1/2 z-10 hidden h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full border border-white/15 bg-black/70 text-white shadow-lg transition hover:bg-black/90 md:flex"
              aria-label="Siguiente"
            >
              <ChevronRight className="h-5 w-5" />
            </button>
          </div>
        ) : null}
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
