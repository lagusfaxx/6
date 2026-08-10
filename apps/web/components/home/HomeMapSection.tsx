"use client";

/**
 * Mapa de cercanía en el home.
 *
 * Es la misma experiencia de /cerca pero recortada a lo esencial: el cliente de
 * este rubro decide por inmediatez, así que lo primero que debe ver es quién
 * está a pocos km y disponible ahora.
 *
 * Coste: mapbox-gl pesa bastante, así que el mapa NO se monta hasta que la
 * sección entra en viewport (IntersectionObserver con margen). Hasta entonces
 * se pinta un placeholder del mismo alto — sin CLS y sin castigar el LCP, que
 * es justo lo que Google mide para el ranking.
 */

import { useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import dynamic from "next/dynamic";
import { apiFetch, resolveMediaUrl } from "../../lib/api";
import { LocationFilterContext } from "../../hooks/useLocationFilter";
import { formatDistance, spreadOverlapping, tierOrder } from "../../lib/mapMarkers";
import type { MapMarker } from "../MapboxMap";
import { LocateFixed, MapPin, Maximize2 } from "lucide-react";

const MapboxMap = dynamic(() => import("../MapboxMap"), { ssr: false });
const ProfilePreviewModal = dynamic(() => import("../ProfilePreviewModal"), { ssr: false });

type NearbyProfile = {
  id: string;
  displayName: string | null;
  username: string;
  avatarUrl: string | null;
  coverUrl: string | null;
  city: string | null;
  latitude: number | null;
  longitude: number | null;
  realLatitude?: number | null;
  realLongitude?: number | null;
  distance: number | null;
  profileType: "PROFESSIONAL" | "ESTABLISHMENT" | "SHOP";
  serviceCategory: string | null;
  availableNow?: boolean;
  lastSeen?: string | null;
  userLevel?: "SILVER" | "GOLD" | "DIAMOND";
  age?: number | null;
  heightCm?: number | null;
  hairColor?: string | null;
  weightKg?: number | null;
  baseRate?: number | null;
  galleryUrls?: string[] | null;
  websiteUrl?: string | null;
  externalOnly?: boolean;
};

const RADIUS_OPTIONS = [5, 10, 25] as const;
const DEFAULT_RADIUS_KM = 10;
const MAX_RADIUS_KM = RADIUS_OPTIONS[RADIUS_OPTIONS.length - 1];
const SANTIAGO_FALLBACK: [number, number] = [-33.45, -70.66];

function ownerHref(p: NearbyProfile) {
  if (p.externalOnly && p.websiteUrl) return p.websiteUrl;
  if (p.profileType === "ESTABLISHMENT") return `/hospedaje/${p.id}`;
  if (p.profileType === "SHOP") return `/sexshop/${p.username}`;
  return `/profesional/${p.id}`;
}

type Props = {
  /**
   * A sangre: el mapa ocupa todo el ancho de la pantalla, sin bordes ni
   * esquinas redondeadas, y más alto. La cabecera y los controles conservan
   * su padding para no quedar pegados al borde.
   */
  fullBleed?: boolean;
};

export default function HomeMapSection({ fullBleed = false }: Props) {
  const locationCtx = useContext(LocationFilterContext);
  const effectiveLoc = locationCtx?.effectiveLocation ?? null;
  const center = useMemo<[number, number]>(
    () => effectiveLoc ?? SANTIAGO_FALLBACK,
    [effectiveLoc],
  );

  const sectionRef = useRef<HTMLElement | null>(null);
  const [visible, setVisible] = useState(false);
  const [profiles, setProfiles] = useState<NearbyProfile[]>([]);
  const [loading, setLoading] = useState(false);
  const [failed, setFailed] = useState(false);
  const [radiusKm, setRadiusKm] = useState<number>(DEFAULT_RADIUS_KM);
  const [focusedId, setFocusedId] = useState<string | null>(null);
  const [preview, setPreview] = useState<NearbyProfile | null>(null);
  const fetchRef = useRef(0);

  const hasToken = Boolean(process.env.NEXT_PUBLIC_MAPBOX_TOKEN);
  /* Ojo: sin ubicación el mapa cae a Santiago. En ese caso NO se puede hablar
     de cercanía — para alguien en Concepción sería falso. */
  const hasLocation = Boolean(effectiveLoc);
  const locationLabel =
    locationCtx?.state.mode === "city"
      ? locationCtx.state.selectedCity?.name ?? null
      : effectiveLoc
        ? "tu ubicación"
        : null;

  /* Monta el mapa recién cuando la sección se acerca al viewport. */
  useEffect(() => {
    const el = sectionRef.current;
    if (!el || visible) return;
    if (typeof IntersectionObserver !== "function") {
      setVisible(true);
      return;
    }
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setVisible(true);
          io.disconnect();
        }
      },
      { rootMargin: "300px" },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [visible]);

  /* Los perfiles se piden solo una vez que la sección es visible. */
  useEffect(() => {
    if (!visible || !hasToken) return;
    const myFetch = ++fetchRef.current;
    setLoading(true);
    setFailed(false);
    const qp = new URLSearchParams();
    qp.set("types", "PROFESSIONAL,ESTABLISHMENT,SHOP");
    qp.set("lat", String(center[0]));
    qp.set("lng", String(center[1]));
    /* Acotar en el servidor al radio más amplio que ofrece la sección. /cerca
       se trae el catálogo entero (take: 300 + establecimientos) y filtra en el
       cliente; en el home eso sería una descarga grande en cada visita. Con el
       tope pedido una sola vez, los chips siguen filtrando sin refetch. */
    qp.set("rangeKm", String(MAX_RADIUS_KM));

    apiFetch<{ profiles: NearbyProfile[] }>(`/services?${qp.toString()}`)
      .then((res) => {
        if (myFetch !== fetchRef.current) return;
        setProfiles(res?.profiles || []);
      })
      .catch(() => {
        if (myFetch !== fetchRef.current) return;
        setFailed(true);
      })
      .finally(() => {
        if (myFetch === fetchRef.current) setLoading(false);
      });
  }, [visible, hasToken, center]);

  const nearby = useMemo(
    () =>
      profiles
        .filter((p) => p.distance != null && Number.isFinite(p.distance) && p.distance <= radiusKm)
        .sort((a, b) => {
          const tierDiff = tierOrder(a.userLevel) - tierOrder(b.userLevel);
          if (tierDiff !== 0) return tierDiff;
          return (a.distance ?? 1e9) - (b.distance ?? 1e9);
        }),
    [profiles, radiusKm],
  );

  const availableCount = useMemo(
    () => nearby.filter((p) => p.availableNow).length,
    [nearby],
  );

  const markers = useMemo(() => {
    const base = nearby
      .filter((p) => Number.isFinite(Number(p.latitude)) && Number.isFinite(Number(p.longitude)))
      .slice(0, 80)
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
        coverUrl: p.coverUrl,
        age: p.age ?? null,
        heightCm: p.heightCm ?? null,
        hairColor: p.hairColor ?? null,
        weightKg: p.weightKg ?? null,
        serviceValue: p.baseRate ?? null,
        level: p.userLevel ?? null,
        lastSeen: p.lastSeen ?? null,
        tier: p.availableNow ? "online" : "offline",
        galleryUrls: p.galleryUrls ?? [],
        areaRadiusM: 400,
      }));
    return spreadOverlapping(base);
  }, [nearby]);

  const handleMarkerSelect = useCallback(
    (marker: MapMarker) => {
      setFocusedId(marker.id);
      const match = profiles.find((p) => p.id === marker.id);
      if (match) setPreview(match);
    },
    [profiles],
  );

  const handleMarkerDeselect = useCallback(() => setFocusedId(null), []);

  /* Sin token de Mapbox no hay nada útil que mostrar: mejor omitir la sección
     que dejar un recuadro de error a la vista del cliente. */
  if (!hasToken) return null;

  const closest = nearby.slice(0, 6);
  const connected =
    availableCount > 0
      ? ` · ${availableCount} conectada${availableCount === 1 ? "" : "s"} ahora`
      : "";

  let statusText: string;
  if (failed) {
    statusText = "No pudimos cargar los perfiles del mapa. Reintenta en unos segundos.";
  } else if (loading && !nearby.length) {
    statusText = "Buscando perfiles…";
  } else if (!hasLocation) {
    // Fallback a Santiago: se dice cuál es la referencia en vez de fingir cercanía.
    statusText =
      nearby.length > 0
        ? `${nearby.length} perfil${nearby.length === 1 ? "" : "es"} en Santiago${connected}. Activa tu ubicación para ver los de tu zona.`
        : "Activa tu ubicación para ver quién está cerca tuyo.";
  } else if (nearby.length > 0) {
    statusText = `${nearby.length} perfil${nearby.length === 1 ? "" : "es"} a menos de ${radiusKm} km${connected}`;
  } else {
    statusText = `Sin perfiles a menos de ${radiusKm} km`;
  }

  return (
    <section ref={sectionRef} className={fullBleed ? "mb-0" : "mb-10"} aria-labelledby="home-map-title">
      <div className={fullBleed ? "mb-3 px-8" : "mb-3"}>
        <div className="flex items-center justify-between gap-3">
          <h2 id="home-map-title" className="min-w-0 truncate text-lg font-bold tracking-tight sm:text-xl">
            Quién está cerca ahora
          </h2>
          <Link
            href="/cerca"
            className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-white/10 px-2.5 py-1.5 text-xs font-semibold text-white/60 transition hover:border-white/25 hover:text-white"
          >
            <Maximize2 className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Mapa completo</span>
            <span className="sm:hidden">Ampliar</span>
          </Link>
        </div>
        <p className="mt-0.5 text-xs text-white/40">{statusText}</p>
      </div>

      {/* Radio + ubicación */}
      <div className={`mb-3 flex flex-wrap items-center gap-1.5 ${fullBleed ? "px-8" : ""}`}>
        {RADIUS_OPTIONS.map((r) => (
          <button
            key={r}
            type="button"
            onClick={() => setRadiusKm(r)}
            aria-pressed={radiusKm === r}
            className={`rounded-lg px-3 py-1.5 text-[11px] font-semibold transition ${
              radiusKm === r
                ? "bg-fuchsia-600 text-white"
                : "border border-white/10 text-white/50 hover:border-white/25 hover:text-white/80"
            }`}
          >
            {r} km
          </button>
        ))}
        {hasLocation ? (
          <span className="ml-1 inline-flex items-center gap-1 text-[11px] text-white/35">
            <MapPin className="h-3 w-3 text-fuchsia-400/70" />
            desde {locationLabel}
          </span>
        ) : (
          <button
            type="button"
            onClick={() => locationCtx?.useCurrentLocation()}
            className="ml-1 inline-flex items-center gap-1.5 rounded-lg border border-sky-400/30 bg-sky-500/15 px-3 py-1.5 text-[11px] font-semibold text-sky-200 transition hover:bg-sky-500/25"
          >
            <LocateFixed className="h-3 w-3" />
            Usar mi ubicación
          </button>
        )}
      </div>

      <div
        className={
          fullBleed
            ? "relative h-[62svh] min-h-[380px] overflow-hidden border-y border-white/10 bg-[#0a0a12] sm:h-[68svh]"
            : "relative h-[340px] overflow-hidden rounded-2xl border border-white/10 bg-[#0a0a12] sm:h-[420px]"
        }
      >
        {visible ? (
          <MapboxMap
            userLocation={center}
            markers={markers}
            fill
            rangeKm={radiusKm}
            autoCenterOnDataChange
            showMarkersForArea
            areaFillOpacity={0.07}
            renderHtmlMarkers
            focusMarkerId={focusedId}
            onMarkerSelect={handleMarkerSelect}
            onMarkerDeselect={handleMarkerDeselect}
          />
        ) : (
          <div className="flex h-full items-center justify-center text-xs text-white/25">
            <MapPin className="mr-1.5 h-4 w-4" />
            Cargando mapa…
          </div>
        )}
      </div>

      {/* Fila de las más cercanas: también sirve como enlaces rastreables. */}
      {closest.length > 0 && (
        <ul className="scrollbar-none -mx-4 mt-3 flex gap-2 overflow-x-auto px-4 sm:mx-0 sm:px-0">
          {closest.map((p) => {
            const img = resolveMediaUrl(p.avatarUrl) ?? resolveMediaUrl(p.coverUrl);
            const dist = formatDistance(p.distance);
            return (
              <li key={p.id} className="shrink-0">
                <Link
                  href={ownerHref(p)}
                  className="flex w-[190px] items-center gap-2.5 rounded-xl border border-white/[0.07] bg-white/[0.02] p-2 transition hover:border-fuchsia-500/25 hover:bg-white/[0.05]"
                >
                  <div className="relative h-11 w-11 shrink-0 overflow-hidden rounded-lg bg-[#0a0a10]">
                    {img ? (
                      <img
                        src={img}
                        alt={p.displayName || p.username}
                        className="h-full w-full object-cover"
                        loading="lazy"
                        decoding="async"
                      />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center">
                        <img src="/brand/isotipo-new.png" alt="" className="h-5 w-5 opacity-20" />
                      </div>
                    )}
                    {p.availableNow && (
                      <span className="absolute bottom-0.5 right-0.5 h-2.5 w-2.5 rounded-full border-2 border-[#0a0a12] bg-emerald-400" />
                    )}
                  </div>
                  <div className="min-w-0">
                    <div className="truncate text-xs font-semibold">
                      {p.displayName || p.username}
                    </div>
                    <div className="mt-0.5 truncate text-[10px] text-white/40">
                      {/* Sin ubicación real la distancia se mide desde Santiago:
                          se muestra la comuna en su lugar. */}
                      {hasLocation && dist ? `a ${dist}` : p.city || "Chile"}
                    </div>
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>
      )}

      {preview && (
        <ProfilePreviewModal profile={preview} onClose={() => setPreview(null)} />
      )}
    </section>
  );
}
