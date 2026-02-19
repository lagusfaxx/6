"use client";

import { memo, useEffect, useMemo, useRef, useState } from "react";
import type mapboxgl from "mapbox-gl";
import { apiFetch, resolveMediaUrl } from "../lib/api";

export type MapMarker = {
  id: string;
  name: string;
  lat: number;
  lng: number;
  displayLat?: number;
  displayLng?: number;
  realLat?: number;
  realLng?: number;
  subtitle?: string | null;
  locality?: string | null;
  age?: number | null;
  gender?: string | null;
  description?: string | null;
  hairColor?: string | null;
  weightKg?: number | null;
  heightCm?: number | null;
  lastSeen?: string | null;
  href?: string | null;
  messageHref?: string | null;
  avatarUrl?: string | null;
  coverUrl?: string | null;
  tier?: string | null;
  level?: string | null;
  username?: string | null;
  areaRadiusM?: number | null;
  serviceValue?: number | null;
  galleryUrls?: string[] | null;
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

function formatLastSeenLabel(lastSeen?: string | null) {
  if (!lastSeen) return "Activa recientemente";
  const diff = Date.now() - Date.parse(lastSeen);
  if (!Number.isFinite(diff) || diff < 0) return "Activa recientemente";
  const minutes = Math.floor(diff / 60000);
  if (minutes < 60) return `Activa hace ${minutes} min`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `Activa hace ${hours} hora${hours === 1 ? "" : "s"}`;
  const days = Math.floor(hours / 24);
  return `Activa hace ${days} día${days === 1 ? "" : "s"}`;
}

function resolveLevelMarkerClass(level?: string | null) {
  if (!level) return "uzeed-map-marker--level-default";
  const normalized = level.toUpperCase();
  if (normalized === "DIAMOND") return "uzeed-map-marker--level-diamond";
  if (normalized === "GOLD") return "uzeed-map-marker--level-gold";
  if (normalized === "SILVER") return "uzeed-map-marker--level-silver";
  return "uzeed-map-marker--level-default";
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
      safeMarkers.map((marker) => ({
        ...marker,
        displayLat: marker.displayLat ?? marker.lat,
        displayLng: marker.displayLng ?? marker.lng,
      })),
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

    const markerQueue = [...displayMarkers];
    let cancelled = false;

    const appendChunk = () => {
      if (cancelled) return;
      const chunk = markerQueue.splice(0, 24);
      chunk.forEach((marker) => {
      const el = document.createElement("div");
      el.className = "uzeed-map-marker";
      el.classList.add(resolveLevelMarkerClass(marker.level));

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

      if (marker.level) {
        const level = document.createElement("div");
        level.className = "uzeed-map-popup__meta";
        level.textContent = `Nivel: ${marker.level}`;
        popupContent.appendChild(level);
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

      el.addEventListener("click", (ev) => {
        ev.stopPropagation();
        popup.remove();
        setSelectedMarker(marker);
        onMarkerFocus?.(marker.id);
      });

        const markerInstance = new mapbox.Marker(el)
          .setLngLat([marker.displayLng ?? marker.lng, marker.displayLat ?? marker.lat])
          .addTo(map);
        markerRefs.current.push(markerInstance);
      });
      if (markerQueue.length > 0) {
        window.requestAnimationFrame(appendChunk);
      }
    };

    window.requestAnimationFrame(appendChunk);
    return () => {
      cancelled = true;
    };
  }, [displayMarkers, isMobileViewport, onMarkerFocus, renderHtmlMarkers, mapInitialized]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const sourceId = "uzeed-marker-areas";
    const layerId = `${sourceId}-fill`;

    if (!showMarkersForArea) {
      if (map.getLayer(layerId)) map.removeLayer(layerId);
      if (map.getSource(sourceId)) map.removeSource(sourceId);
      return;
    }

    const update = () => {
      const data: GeoJSON.FeatureCollection<GeoJSON.Polygon> = {
        type: "FeatureCollection",
        features: displayMarkers
          .filter((m) => (m.areaRadiusM ?? 0) > 0)
          .map((m) => ({
            ...circleFeature(m.realLat ?? m.lat, m.realLng ?? m.lng, m.areaRadiusM ?? 500),
            properties: { id: m.id },
          })),
      };
      const source = map.getSource(sourceId) as
        | mapboxgl.GeoJSONSource
        | undefined;
      if (!source) {
        map.addSource(sourceId, { type: "geojson", data });
        map.addLayer({
          id: layerId,
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
  }, [displayMarkers, mapIdle, showMarkersForArea]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !showMarkersForArea) return;

    const layerId = "uzeed-marker-areas-fill";

    const handleMapClick = (event: mapboxgl.MapMouseEvent) => {
      const feature = map
        .queryRenderedFeatures(event.point, { layers: [layerId] })
        .find((item) => item.properties?.id);
      const markerId = feature?.properties?.id;
      if (!markerId) return;
      const target = displayMarkers.find((marker) => marker.id === markerId);
      if (!target) return;
      setSelectedMarker(target);
      onMarkerFocus?.(target.id);
    };

    const handleMapMove = (event: mapboxgl.MapMouseEvent) => {
      const hovered = map.queryRenderedFeatures(event.point, { layers: [layerId] }).length > 0;
      map.getCanvas().style.cursor = hovered ? "pointer" : "";
    };

    map.on("click", handleMapClick);
    map.on("mousemove", handleMapMove);

    return () => {
      map.off("click", handleMapClick);
      map.off("mousemove", handleMapMove);
      map.getCanvas().style.cursor = "";
    };
  }, [displayMarkers, onMarkerFocus, showMarkersForArea]);

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
      center: [target.displayLng ?? target.lng, target.displayLat ?? target.lat],
      zoom: 13,
      essential: true,
    });
  }, [focusMarkerId, displayMarkers]);



  useEffect(() => {
    if (!selectedMarker) return;
    if ((selectedMarker.galleryUrls?.length ?? 0) > 0) return;
    if (!selectedMarker.username) return;

    let cancelled = false;

    apiFetch<{ gallery?: Array<{ url?: string | null }>; profile?: { coverUrl?: string | null; avatarUrl?: string | null } }>(`/profiles/${selectedMarker.username}`)
      .then((res) => {
        if (cancelled) return;
        const galleryUrls = (res.gallery || [])
          .map((item) => item?.url)
          .filter((url): url is string => Boolean(url));
        const fallback = [res.profile?.coverUrl, res.profile?.avatarUrl]
          .filter((url): url is string => Boolean(url));
        const urls = galleryUrls.length > 0 ? galleryUrls : fallback;
        if (!urls.length) return;
        setSelectedMarker((prev) => (prev && prev.id === selectedMarker.id ? { ...prev, galleryUrls: urls } : prev));
      })
      .catch(() => {
        // ignore gallery fetch failures in map preview
      });

    return () => {
      cancelled = true;
    };
  }, [selectedMarker?.id, selectedMarker?.username, selectedMarker?.galleryUrls]);
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
    <div className="relative isolate">
      <div ref={containerRef} className={className} style={{ height }} />
      {selectedMarker ? (
        <div
          className={isMobileViewport ? "uzeed-map-mobile-overlay" : "uzeed-map-panel"}
          role="dialog"
          aria-label="Detalle de perfil en mapa"
        >
            <div className={isMobileViewport ? "uzeed-map-drawer uzeed-map-drawer--mobile" : "uzeed-map-drawer__content"}>
            <div className="uzeed-map-drawer__cover-wrap">
              {selectedMarker.coverUrl ? (
                <img
                  src={resolveMediaUrl(selectedMarker.coverUrl) ?? undefined}
                  alt={`Portada de ${selectedMarker.name}`}
                  className="uzeed-map-drawer__cover"
                />
              ) : null}
              <button
                type="button"
                className="uzeed-map-drawer__close"
                onClick={() => setSelectedMarker(null)}
              >
                ✕
              </button>
              <div className="uzeed-map-drawer__avatar-overlay">
                <div className="uzeed-map-drawer__avatar-wrap">
                  {selectedMarker.avatarUrl ? (
                    <img
                      src={resolveMediaUrl(selectedMarker.avatarUrl) ?? undefined}
                      alt={selectedMarker.name}
                      className="uzeed-map-drawer__avatar"
                    />
                  ) : null}
                </div>
                <span className={`uzeed-map-drawer__status-dot ${selectedMarker.tier === "online" ? "uzeed-map-drawer__status-dot--online" : ""}`} aria-label={selectedMarker.tier === "online" ? "Online" : "Offline"} role="status" />
              </div>
            </div>
            <div className="uzeed-map-drawer__body">
              <div className="uzeed-map-drawer__name">{selectedMarker.name}</div>
              <div className="uzeed-map-drawer__level">
                {selectedMarker.level ? `Nivel ${selectedMarker.level}` : "Nivel no informado"}
              </div>
              <span className={`uzeed-map-drawer__status-badge ${selectedMarker.tier === "online" ? "uzeed-map-drawer__status-badge--online" : "uzeed-map-drawer__status-badge--offline"}`}>
                {selectedMarker.tier === "online" ? "Online" : formatLastSeenLabel(selectedMarker.lastSeen)}
              </span>
              <div className="uzeed-map-drawer__badges">
                {selectedMarker.age ? <span className="uzeed-map-drawer__badge" aria-label={`Edad: ${selectedMarker.age} años`}><span className="uzeed-map-drawer__badge-label">Edad</span><span className="uzeed-map-drawer__badge-value">{selectedMarker.age} años</span></span> : null}
                {selectedMarker.heightCm ? <span className="uzeed-map-drawer__badge" aria-label={`Estatura: ${Math.round(selectedMarker.heightCm)} cm`}><span className="uzeed-map-drawer__badge-label">Estatura</span><span className="uzeed-map-drawer__badge-value">{Math.round(selectedMarker.heightCm)} cm</span></span> : null}
                {selectedMarker.weightKg ? <span className="uzeed-map-drawer__badge" aria-label={`Peso: ${Math.round(selectedMarker.weightKg)} kg`}><span className="uzeed-map-drawer__badge-label">Peso</span><span className="uzeed-map-drawer__badge-value">{Math.round(selectedMarker.weightKg)} kg</span></span> : null}
                {typeof selectedMarker.serviceValue === "number" ? <span className="uzeed-map-drawer__badge" aria-label={`Precio: $${selectedMarker.serviceValue.toLocaleString("es-CL")}`}><span className="uzeed-map-drawer__badge-label">Precio</span><span className="uzeed-map-drawer__badge-value">${selectedMarker.serviceValue.toLocaleString("es-CL")}</span></span> : null}
              </div>
              {selectedMarker.galleryUrls && selectedMarker.galleryUrls.length > 0 ? (
                <div className="uzeed-map-drawer__gallery" aria-label="Galería del perfil">
                  {selectedMarker.galleryUrls.slice(0, 6).map((url, idx) => (
                    <img
                      key={`${selectedMarker.id}-gallery-${idx}`}
                      src={resolveMediaUrl(url) ?? undefined}
                      alt={`Foto ${idx + 1} de ${selectedMarker.name}`}
                      className="uzeed-map-drawer__gallery-photo"
                    />
                  ))}
                </div>
              ) : null}
              {selectedMarker.href ? (
                <div className="uzeed-map-drawer__cta-wrap">
                  <a className="uzeed-map-drawer__btn" href={selectedMarker.href} aria-label="Ver Perfil Completo">
                    Ver Perfil Completo
                  </a>
                </div>
              ) : null}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

const MapboxMap = memo(MapboxMapComponent);

export default MapboxMap;
