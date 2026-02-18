"use client";

import { memo, useEffect, useMemo, useRef, useState } from "react";
import type mapboxgl from "mapbox-gl";
import { resolveMediaUrl } from "../lib/api";

export type MapMarker = {
  id: string;
  name: string;
  lat: number;
  lng: number;
  subtitle?: string | null;
  locality?: string | null;
  age?: number | null;
  gender?: string | null;
  description?: string | null;
  hairColor?: string | null;
  weightKg?: number | null;
  href?: string | null;
  messageHref?: string | null;
  avatarUrl?: string | null;
  tier?: string | null;
  areaRadiusM?: number | null;
};

type MapboxMapProps = {
  markers: MapMarker[];
  userLocation?: [number, number] | null;
  height?: number;
  className?: string;
  focusMarkerId?: string | null;
  onMarkerFocus?: (id: string) => void;
  rangeKm?: number | null;
  onCenterChange?: (center: { lat: number; lng: number }) => void;
  autoCenterOnDataChange?: boolean;
  showMarkersForArea?: boolean;
  renderHtmlMarkers?: boolean;
};

// Mapbox usa orden [lng, lat]
const DEFAULT_CENTER: [number, number] = [-70.66, -33.45];

function hashString(seed: string) {
  let hash = 0;
  for (let i = 0; i < seed.length; i += 1) {
    hash = (hash << 5) - hash + seed.charCodeAt(i);
    hash |= 0;
  }
  return hash >>> 0;
}

function mulberry32(a: number) {
  return () => {
    let t = (a += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function jitterPoint(lat: number, lng: number, radiusM: number, seed: string) {
  const rand = mulberry32(hashString(seed));
  const distance = radiusM * 0.6 * rand();
  const angle = rand() * Math.PI * 2;
  const earth = 111320;
  const dLat = (distance * Math.cos(angle)) / earth;
  const dLng =
    (distance * Math.sin(angle)) / (earth * Math.cos((lat * Math.PI) / 180));
  return [lat + dLat, lng + dLng] as [number, number];
}

function circleFeature(
  lat: number,
  lng: number,
  radiusM: number,
): GeoJSON.Feature<GeoJSON.Polygon> {
  const steps = 64;
  const earth = 111320;
  const coords = [];
  for (let i = 0; i <= steps; i += 1) {
    const angle = (i / steps) * Math.PI * 2;
    const dLat = (radiusM * Math.cos(angle)) / earth;
    const dLng =
      (radiusM * Math.sin(angle)) / (earth * Math.cos((lat * Math.PI) / 180));
    coords.push([lng + dLng, lat + dLat]);
  }
  return {
    type: "Feature",
    geometry: {
      type: "Polygon",
      coordinates: [coords],
    },
    properties: {},
  };
}

function MapboxMapComponent({
  markers,
  userLocation,
  height = 380,
  className,
  focusMarkerId,
  onMarkerFocus,
  rangeKm,
  onCenterChange,
  autoCenterOnDataChange = true,
  showMarkersForArea = true,
  renderHtmlMarkers = true,
}: MapboxMapProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapboxRef = useRef<typeof mapboxgl | null>(null);
  const mapRef = useRef<mapboxgl.Map | null>(null);
  const markerRefs = useRef<mapboxgl.Marker[]>([]);
  const userMarkerRef = useRef<mapboxgl.Marker | null>(null);
  const didInitialCenterRef = useRef(false);
  const [mapInitialized, setMapInitialized] = useState(false);
  const [mapIdle, setMapIdle] = useState(false);
  const [selectedMarker, setSelectedMarker] = useState<MapMarker | null>(null);
  const [isMobileViewport, setIsMobileViewport] = useState(false);
  const centerChangeHandlerRef = useRef(onCenterChange);

  useEffect(() => {
    centerChangeHandlerRef.current = onCenterChange;
  }, [onCenterChange]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const updateViewport = () => setIsMobileViewport(window.innerWidth <= 768);
    updateViewport();
    window.addEventListener("resize", updateViewport);
    return () => window.removeEventListener("resize", updateViewport);
  }, []);

  const token = process.env.NEXT_PUBLIC_MAPBOX_TOKEN || "";
  const safeMarkers = useMemo(
    () =>
      (markers || [])
        .filter((m) => Number.isFinite(m.lat) && Number.isFinite(m.lng))
        .slice(0, 200),
    [markers],
  );
  const displayMarkers = useMemo(
    () =>
      safeMarkers.map((marker) => {
        const radius = marker.areaRadiusM ?? 0;
        if (!radius)
          return { ...marker, displayLat: marker.lat, displayLng: marker.lng };
        const [jLat, jLng] = jitterPoint(
          marker.lat,
          marker.lng,
          radius,
          `marker:${marker.id}`,
        );
        return { ...marker, displayLat: jLat, displayLng: jLng };
      }),
    [safeMarkers],
  );

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;
    if (!token) return;

    let active = true;

    (async () => {
      const mod = await import("mapbox-gl");
      const mapbox = (mod.default ?? mod) as typeof mapboxgl;
      if (!active || !containerRef.current) return;
      mapboxRef.current = mapbox;
      mapbox.accessToken = token;
      const map = new mapbox.Map({
        container: containerRef.current,
        style: "mapbox://styles/mapbox/dark-v11",
        center: DEFAULT_CENTER,
        zoom: 12,
      });

      map.addControl(
        new mapbox.NavigationControl({ showCompass: false }),
        "top-right",
      );
      mapRef.current = map;
      setMapInitialized(true);
      map.on("movestart", () => setMapIdle(false));
      map.on("zoomstart", () => setMapIdle(false));
      map.on("dragstart", () => setMapIdle(false));
      map.on("idle", () => {
        setMapIdle(true);
        const center = map.getCenter();
        centerChangeHandlerRef.current?.({ lat: center.lat, lng: center.lng });
        try {
          localStorage.setItem(
            "uzeed:lastLocation",
            JSON.stringify({ lat: center.lat, lng: center.lng }),
          );
        } catch {
          // ignore storage issues
        }
      });
      map.on("click", () => setSelectedMarker(null));
    })();

    return () => {
      active = false;
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
    };
  }, [token]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapIdle) return;

    const target =
      userLocation ||
      (displayMarkers[0]
        ? ([displayMarkers[0].displayLat, displayMarkers[0].displayLng] as [
            number,
            number,
          ])
        : DEFAULT_CENTER);
    const zoom = userLocation ? 13 : 11.5;
    const center: [number, number] = [target[1], target[0]];
    const run = () => {
      // Primera vez: sin animación (evita “viaje” visible)
      if (!didInitialCenterRef.current) {
        didInitialCenterRef.current = true;
        map.jumpTo({ center, zoom });
        return;
      }
      if (!autoCenterOnDataChange) return;
      map.flyTo({ center, zoom, essential: true, duration: 600 });
    };
    if (!map.isStyleLoaded()) {
      map.once("load", run);
    } else {
      run();
    }
  }, [userLocation?.[0], userLocation?.[1], displayMarkers, autoCenterOnDataChange]);

  useEffect(() => {
    const map = mapRef.current;
    const mapbox = mapboxRef.current;
    if (!map) return;

    markerRefs.current.forEach((marker) => marker.remove());
    markerRefs.current = [];

    if (!renderHtmlMarkers) return;
    if (!mapbox) return;

    const markersToRender = showMarkersForArea
      ? displayMarkers
      : displayMarkers.filter((m) => (m.areaRadiusM ?? 0) <= 0);

    markersToRender.forEach((marker) => {
      const el = document.createElement("div");
      el.className = "uzeed-map-marker";

      const resolvedAvatar = marker.avatarUrl
        ? resolveMediaUrl(marker.avatarUrl)
        : null;
      if (resolvedAvatar) {
        el.style.backgroundImage = `url(${resolvedAvatar})`;
        el.classList.add("uzeed-map-marker--avatar");
      } else {
        el.classList.add("uzeed-map-marker--incognito");
        el.innerHTML = `
          <svg class="uzeed-map-marker__icon" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path d="M20 21a8 8 0 0 0-16 0" stroke="rgba(255,255,255,0.85)" stroke-width="1.7" stroke-linecap="round" />
            <path d="M12 12a4 4 0 1 0-4-4 4 4 0 0 0 4 4Z" stroke="rgba(255,255,255,0.85)" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" />
            <path d="M4 4l16 16" stroke="rgba(255,255,255,0.45)" stroke-width="1.7" stroke-linecap="round" />
          </svg>
        `;
      }

      const popupContent = document.createElement("div");
      popupContent.className = "uzeed-map-popup";

      const title = document.createElement("div");
      title.className = "uzeed-map-popup__title";
      title.textContent = marker.name;
      popupContent.appendChild(title);

      const metadata = [marker.subtitle, marker.locality]
        .filter(Boolean)
        .join(" · ");
      const tierLabel = marker.tier === "online" ? "Online" : marker.tier === "offline" ? "Offline" : marker.tier;
      if (tierLabel || metadata) {
        const subtitle = document.createElement("div");
        subtitle.className = "uzeed-map-popup__subtitle";
        subtitle.textContent = [tierLabel, metadata]
          .filter(Boolean)
          .join(" · ");
        popupContent.appendChild(subtitle);
      }

      if (marker.age || marker.gender || marker.hairColor || marker.weightKg) {
        const meta = document.createElement("div");
        meta.className = "uzeed-map-popup__meta";
        const genderLabel =
          marker.gender === "FEMALE"
            ? "Mujer"
            : marker.gender === "MALE"
              ? "Hombre"
              : marker.gender
                ? "Otro"
                : "";
        meta.textContent = [
          marker.age ? `${marker.age} años` : null,
          genderLabel,
          marker.hairColor ? `Cabello: ${marker.hairColor}` : null,
          marker.weightKg ? `Peso: ${Math.round(marker.weightKg)} kg` : null,
        ]
          .filter(Boolean)
          .join(" · ");
        popupContent.appendChild(meta);
      }

      if (marker.description) {
        const desc = document.createElement("div");
        desc.className = "uzeed-map-popup__desc";
        desc.textContent = marker.description;
        popupContent.appendChild(desc);
      }

      if (marker.href) {
        const actions = document.createElement("div");
        actions.className = "uzeed-map-popup__actions";
        const profileLink = document.createElement("a");
        profileLink.href = marker.href;
        profileLink.className = "uzeed-map-popup__btn";
        profileLink.textContent = "Ver perfil";
        profileLink.addEventListener("click", (e) => {
          e.preventDefault();
          e.stopPropagation();
          window.location.href = marker.href!;
        });
        actions.appendChild(profileLink);
        if (marker.messageHref) {
          const messageLink = document.createElement("a");
          messageLink.href = marker.messageHref;
          messageLink.className =
            "uzeed-map-popup__btn uzeed-map-popup__btn--ghost";
          messageLink.textContent = "Mensaje";
          messageLink.addEventListener("click", (e) => {
            e.preventDefault();
            e.stopPropagation();
            window.location.href = marker.messageHref!;
          });
          actions.appendChild(messageLink);
        }
        popupContent.appendChild(actions);
      }

      const popup = new mapbox.Popup({
        offset: 12,
        closeButton: false,
      }).setDOMContent(popupContent);

      // Desktop hover
      el.addEventListener("mouseenter", () => {
        popup.setLngLat([marker.displayLng, marker.displayLat]).addTo(map);
      });
      el.addEventListener("mouseleave", () => {
        popup.remove();
      });

      // Mobile/touch: abrir drawer. Desktop: popup sobre marcador.
      el.addEventListener("click", (ev) => {
        ev.stopPropagation();
        if (isMobileViewport) {
          popup.remove();
          setSelectedMarker(marker);
        } else {
          popup.setLngLat([marker.displayLng, marker.displayLat]).addTo(map);
        }
        onMarkerFocus?.(marker.id);
      });

      const markerInstance = new mapbox.Marker(el)
        .setLngLat([marker.displayLng, marker.displayLat])
        .addTo(map);
      markerRefs.current.push(markerInstance);
    });
  }, [displayMarkers, isMobileViewport, onMarkerFocus, showMarkersForArea, renderHtmlMarkers]);


  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const update = () => {
      const sourceId = "uzeed-profile-points";
      const data: GeoJSON.FeatureCollection<GeoJSON.Point> = {
        type: "FeatureCollection",
        features: displayMarkers.map((m) => ({
          type: "Feature",
          geometry: { type: "Point", coordinates: [m.lng, m.lat] },
          properties: { id: m.id, online: m.tier === "online" ? 1 : 0 },
        })),
      };
      const source = map.getSource(sourceId) as mapboxgl.GeoJSONSource | undefined;
      if (!source) {
        map.addSource(sourceId, { type: "geojson", data });
        map.addLayer({
          id: `${sourceId}-circle`,
          type: "circle",
          source: sourceId,
          paint: {
            "circle-color": ["case", ["==", ["get", "online"], 1], "#34d399", "#a855f7"],
            "circle-opacity": 0.85,
            "circle-stroke-color": "rgba(255,255,255,0.8)",
            "circle-stroke-width": 1,
            "circle-radius": ["interpolate", ["linear"], ["zoom"], 8, 3.5, 12, 6, 15, 9],
          },
        });
      } else {
        source.setData(data as any);
      }
    };
    if (!map.isStyleLoaded()) {
      map.once("load", update);
    } else {
      update();
    }
  }, [displayMarkers, mapIdle]);
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const update = () => {
      const sourceId = "uzeed-marker-areas";
      const data: GeoJSON.FeatureCollection<GeoJSON.Polygon> = {
        type: "FeatureCollection",
        features: displayMarkers
          .filter((m) => (m.areaRadiusM ?? 0) > 0)
          .map((m) => circleFeature(m.lat, m.lng, m.areaRadiusM ?? 600)),
      };
      const source = map.getSource(sourceId) as
        | mapboxgl.GeoJSONSource
        | undefined;
      if (!source) {
        map.addSource(sourceId, { type: "geojson", data });
        map.addLayer({
          id: `${sourceId}-fill`,
          type: "fill",
          source: sourceId,
          paint: {
            "fill-color": "rgba(168,85,247,0.18)",
            "fill-outline-color": "rgba(168,85,247,0.35)",
          },
        });
      } else {
        source.setData(data as any);
      }
    };
    if (!map.isStyleLoaded()) {
      map.once("load", update);
    } else {
      update();
    }
  }, [displayMarkers, mapIdle]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapIdle || !userLocation || !rangeKm) return;
    const update = () => {
      const sourceId = "uzeed-user-range";
      const radiusM = Math.max(1, rangeKm) * 1000;
      const data: GeoJSON.FeatureCollection<GeoJSON.Polygon> = {
        type: "FeatureCollection",
        features: [circleFeature(userLocation[0], userLocation[1], radiusM)],
      };
      const source = map.getSource(sourceId) as
        | mapboxgl.GeoJSONSource
        | undefined;
      if (!source) {
        map.addSource(sourceId, { type: "geojson", data });
        map.addLayer({
          id: `${sourceId}-fill`,
          type: "fill",
          source: sourceId,
          paint: {
            "fill-color": "rgba(56,189,248,0.15)",
            "fill-outline-color": "rgba(56,189,248,0.35)",
          },
        });
      } else {
        source.setData(data as any);
      }
    };
    if (!map.isStyleLoaded()) {
      map.once("load", update);
    } else {
      update();
    }
  }, [mapIdle, userLocation?.[0], userLocation?.[1], rangeKm]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !focusMarkerId) return;
    const target = displayMarkers.find((m) => m.id === focusMarkerId);
    if (!target) return;
    map.flyTo({
      center: [target.displayLng, target.displayLat],
      zoom: 13,
      essential: true,
    });
  }, [focusMarkerId, displayMarkers]);

  useEffect(() => {
    const map = mapRef.current;
    const mapbox = mapboxRef.current;
    if (!map || !mapIdle) return;

    if (userMarkerRef.current) {
      userMarkerRef.current.remove();
      userMarkerRef.current = null;
    }

    if (!userLocation) return;
    if (!mapbox) return;

    const el = document.createElement("div");
    el.className = "uzeed-map-marker uzeed-map-marker--user";
    userMarkerRef.current = new mapbox.Marker(el)
      .setLngLat([userLocation[1], userLocation[0]])
      .addTo(map);
  }, [mapInitialized, mapIdle, userLocation?.[0], userLocation?.[1]]);

  if (!token) {
    return (
      <div
        className={`rounded-2xl border border-white/10 bg-white/5 p-4 text-sm text-white/70 ${className || ""}`}
        style={{ height }}
      >
        Configura NEXT_PUBLIC_MAPBOX_TOKEN para ver el mapa.
      </div>
    );
  }

  return (
    <>
      <div ref={containerRef} className={className} style={{ height }} />
      {isMobileViewport && selectedMarker ? (
        <div className="uzeed-map-drawer" role="dialog" aria-label="Detalle de perfil en mapa">
          <div className="uzeed-map-drawer__content">
            <div className="uzeed-map-drawer__header">
              <div className="uzeed-map-drawer__name">{selectedMarker.name}</div>
              <button
                type="button"
                className="uzeed-map-drawer__close"
                onClick={() => setSelectedMarker(null)}
              >
                Cerrar
              </button>
            </div>
            <div className="uzeed-map-drawer__meta">
              {[
                selectedMarker.tier === "online" ? "Online" : "Offline",
                selectedMarker.subtitle,
                selectedMarker.locality,
                selectedMarker.age ? `${selectedMarker.age} años` : null,
                selectedMarker.hairColor ? `Cabello: ${selectedMarker.hairColor}` : null,
                selectedMarker.weightKg ? `Peso: ${Math.round(selectedMarker.weightKg)} kg` : null,
              ]
                .filter(Boolean)
                .join(" · ")}
            </div>
            {selectedMarker.href ? (
              <a className="uzeed-map-drawer__btn" href={selectedMarker.href}>
                Ver perfil
              </a>
            ) : null}
          </div>
        </div>
      ) : null}
    </>
  );
}

const MapboxMap = memo(MapboxMapComponent);

export default MapboxMap;
