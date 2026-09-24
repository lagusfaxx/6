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
import { apiFetch } from "../../lib/api";
import { LocationFilterContext } from "../../hooks/useLocationFilter";
import { spreadOverlapping, tierOrder } from "../../lib/mapMarkers";
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
  gender?: "MALE" | "FEMALE" | "OTHER" | null;
  age?: number | null;
  heightCm?: number | null;
  hairColor?: string | null;
  weightKg?: number | null;
  baseRate?: number | null;
  galleryUrls?: string[] | null;
  websiteUrl?: string | null;
  externalOnly?: boolean;
};

/* Radio fijo. Ya no hay botones de 5/10/25 km: el mapa trae lo que hay a
   25 km del punto que se está mirando y, si el cliente lo arrastra a otra
   zona, pide los perfiles de esa zona. */
const RADIUS_KM = 25;
/* Distancia que hay que mover el mapa para pedir los perfiles de la zona
   nueva. Menos que el radio, para que no queden huecos en los bordes. */
const REFETCH_KM = 8;
const SANTIAGO_FALLBACK: [number, number] = [-33.45, -70.66];

function distanceKm(a: [number, number], b: [number, number]): number {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b[0] - a[0]);
  const dLng = toRad(b[1] - a[1]);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a[0])) * Math.cos(toRad(b[0])) * Math.sin(dLng / 2) ** 2;
  return 6371 * 2 * Math.asin(Math.sqrt(h));
}

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
  const [focusedId, setFocusedId] = useState<string | null>(null);
  const [preview, setPreview] = useState<NearbyProfile | null>(null);
  const fetchRef = useRef(0);
  /* Centro del último pedido; el mapa pide otra zona al alejarse de él. */
  const lastFetchCenter = useRef<[number, number] | null>(null);

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

  /* Pide los perfiles a RADIUS_KM de un punto. Con replace se empieza de
     cero (cambió la ubicación del cliente); si no, se suman a los que ya
     están, así al arrastrar el mapa no desaparece lo que se vio antes. */
  const loadAround = useCallback(
    (at: [number, number], replace: boolean) => {
      const myFetch = ++fetchRef.current;
      lastFetchCenter.current = at;
      setLoading(true);
      setFailed(false);
      const qp = new URLSearchParams();
      qp.set("types", "PROFESSIONAL,ESTABLISHMENT,SHOP");
      /* El inicio muestra mujeres — igual que el feed, las destacadas y las
         novedades. Los perfiles de hombres tienen su propia entrada ("Ellos").
         Los perfiles sin género declarado siguen contando como mujeres, que
         es la regla del resto del sitio. */
      qp.set("gender", "FEMALE");
      qp.set("lat", String(at[0]));
      qp.set("lng", String(at[1]));
      qp.set("rangeKm", String(RADIUS_KM));

      apiFetch<{ profiles: NearbyProfile[] }>(`/services?${qp.toString()}`)
        .then((res) => {
          if (myFetch !== fetchRef.current) return;
          const incoming = res?.profiles || [];
          setProfiles((prev) => {
            const byId = new Map((replace ? [] : prev).map((p) => [p.id, p]));
            for (const p of incoming) byId.set(p.id, p);
            return [...byId.values()];
          });
        })
        .catch(() => {
          if (myFetch !== fetchRef.current) return;
          setFailed(true);
        })
        .finally(() => {
          if (myFetch === fetchRef.current) setLoading(false);
        });
    },
    [],
  );

  /* Los perfiles se piden recién cuando la sección es visible. */
  useEffect(() => {
    if (!visible || !hasToken) return;
    loadAround(center, true);
  }, [visible, hasToken, center, loadAround]);

  /* El cliente arrastró o hizo zoom hacia otra zona: se piden los perfiles
     de ahí. */
  const handleCenterChange = useCallback(
    ({ lat, lng }: { lat: number; lng: number }) => {
      const last = lastFetchCenter.current;
      if (!last || distanceKm(last, [lat, lng]) < REFETCH_KM) return;
      loadAround([lat, lng], false);
    },
    [loadAround],
  );

  const nearby = useMemo(
    () =>
      profiles
        /* Red de seguridad por si la respuesta trae hombres igual (avisos
           rápidos externos, cachés viejas): el mapa del home no los pinta. */
        .filter((p) => p.gender !== "MALE")
        .filter((p) => Number.isFinite(Number(p.latitude)) && Number.isFinite(Number(p.longitude)))
        .sort((a, b) => tierOrder(a.userLevel) - tierOrder(b.userLevel)),
    [profiles],
  );

  /* Lo que está a RADIUS_KM de la ubicación del cliente, para el texto de
     arriba. Lo que se cargó al arrastrar el mapa a otra zona no cuenta. */
  const aroundUser = useMemo(
    () =>
      nearby.filter(
        (p) =>
          distanceKm(center, [Number(p.latitude), Number(p.longitude)]) <= RADIUS_KM,
      ),
    [nearby, center],
  );

  const availableCount = useMemo(
    () => aroundUser.filter((p) => p.availableNow).length,
    [aroundUser],
  );

  const markers = useMemo(() => {
    const base = nearby
      .filter((p) => Number.isFinite(Number(p.latitude)) && Number.isFinite(Number(p.longitude)))
      .slice(0, 200)
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

  const connected =
    availableCount > 0
      ? ` · ${availableCount} conectada${availableCount === 1 ? "" : "s"} ahora`
      : "";

  let statusText: string;
  if (failed) {
    statusText = "No pudimos cargar los perfiles del mapa. Reintenta en unos segundos.";
  } else if (loading && !profiles.length) {
    statusText = "Buscando perfiles…";
  } else if (!hasLocation) {
    // Fallback a Santiago: se dice cuál es la referencia en vez de fingir cercanía.
    statusText =
      aroundUser.length > 0
        ? `${aroundUser.length} perfil${aroundUser.length === 1 ? "" : "es"} en Santiago${connected}. Activa tu ubicación para ver los de tu zona.`
        : "Activa tu ubicación para ver quién está cerca tuyo.";
  } else if (aroundUser.length > 0) {
    statusText = `${aroundUser.length} perfil${aroundUser.length === 1 ? "" : "es"} a menos de ${RADIUS_KM} km${connected}`;
  } else {
    statusText = `Sin perfiles a menos de ${RADIUS_KM} km. Mueve el mapa para ver otras zonas.`;
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

      {/* Ubicación */}
      <div className={`mb-3 flex flex-wrap items-center gap-1.5 ${fullBleed ? "px-8" : ""}`}>
        {hasLocation ? (
          <span className="inline-flex items-center gap-1 text-[11px] text-white/35">
            <MapPin className="h-3 w-3 text-fuchsia-400/70" />
            desde {locationLabel}
          </span>
        ) : (
          <button
            type="button"
            onClick={() => locationCtx?.useCurrentLocation()}
            className="inline-flex items-center gap-1.5 rounded-lg border border-sky-400/30 bg-sky-500/15 px-3 py-1.5 text-[11px] font-semibold text-sky-200 transition hover:bg-sky-500/25"
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
            autoCenterOnDataChange
            onCenterChange={handleCenterChange}
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

      {preview && (
        <ProfilePreviewModal profile={preview} onClose={() => setPreview(null)} />
      )}
    </section>
  );
}
