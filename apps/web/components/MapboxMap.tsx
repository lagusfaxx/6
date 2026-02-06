"use client";

import { useEffect, useMemo, useRef } from "react";
import mapboxgl from "mapbox-gl";
import { resolveMediaUrl } from "../lib/api";

export type MapMarker = {
  id: string;
  name: string;
  lat: number;
  lng: number;
  subtitle?: string | null;
  href?: string | null;
  messageHref?: string | null;
  avatarUrl?: string | null;
  tier?: string | null;
};

type MapboxMapProps = {
  markers: MapMarker[];
  userLocation?: [number, number] | null;
  height?: number;
  className?: string;
  focusMarkerId?: string | null;
  onMarkerFocus?: (id: string) => void;
};

const DEFAULT_CENTER: [number, number] = [-33.45, -70.66];

export default function MapboxMap({
  markers,
  userLocation,
  height = 380,
  className,
  focusMarkerId,
  onMarkerFocus
}: MapboxMapProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<mapboxgl.Map | null>(null);
  const markerRefs = useRef<mapboxgl.Marker[]>([]);
  const userMarkerRef = useRef<mapboxgl.Marker | null>(null);

  const token = process.env.NEXT_PUBLIC_MAPBOX_TOKEN || "";
  const safeMarkers = useMemo(
    () => (markers || []).filter((m) => Number.isFinite(m.lat) && Number.isFinite(m.lng)).slice(0, 200),
    [markers]
  );

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;
    if (!token) return;

    mapboxgl.accessToken = token;
    const map = new mapboxgl.Map({
      container: containerRef.current,
      style: "mapbox://styles/mapbox/dark-v11",
      center: DEFAULT_CENTER,
      zoom: 12
    });

    map.addControl(new mapboxgl.NavigationControl({ showCompass: false }), "top-right");
    mapRef.current = map;

    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, [token]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    const target = userLocation || (safeMarkers[0] ? [safeMarkers[0].lat, safeMarkers[0].lng] as [number, number] : DEFAULT_CENTER);
    map.jumpTo({ center: [target[1], target[0]], zoom: userLocation ? 13 : 11.5 });
  }, [userLocation?.[0], userLocation?.[1], safeMarkers]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    markerRefs.current.forEach((marker) => marker.remove());
    markerRefs.current = [];

    safeMarkers.forEach((marker) => {
      const el = document.createElement("div");
      el.className = "uzeed-map-marker";

      if (marker.avatarUrl) {
        const url = resolveMediaUrl(marker.avatarUrl);
        if (url) {
          el.style.backgroundImage = `url(${url})`;
          el.classList.add("uzeed-map-marker--avatar");
        }
      }

      const popupContent = document.createElement("div");
      popupContent.className = "uzeed-map-popup";

      const title = document.createElement("div");
      title.className = "uzeed-map-popup__title";
      title.textContent = marker.name;
      popupContent.appendChild(title);

      if (marker.tier || marker.subtitle) {
        const subtitle = document.createElement("div");
        subtitle.className = "uzeed-map-popup__subtitle";
        subtitle.textContent = [marker.tier, marker.subtitle].filter(Boolean).join(" · ");
        popupContent.appendChild(subtitle);
      }

      if (marker.href) {
        const actions = document.createElement("div");
        actions.className = "uzeed-map-popup__actions";
        const profileLink = document.createElement("a");
        profileLink.href = marker.href;
        profileLink.className = "uzeed-map-popup__btn";
        profileLink.textContent = "Ver perfil";
        actions.appendChild(profileLink);
        if (marker.messageHref) {
          const messageLink = document.createElement("a");
          messageLink.href = marker.messageHref;
          messageLink.className = "uzeed-map-popup__btn uzeed-map-popup__btn--ghost";
          messageLink.textContent = "Mensaje";
          actions.appendChild(messageLink);
        }
        popupContent.appendChild(actions);
      }

      const popup = new mapboxgl.Popup({ offset: 12, closeButton: false }).setDOMContent(popupContent);

      el.addEventListener("mouseenter", () => {
        popup.setLngLat([marker.lng, marker.lat]).addTo(map);
      });
      el.addEventListener("mouseleave", () => {
        popup.remove();
      });
      el.addEventListener("click", () => {
        if (marker.href) {
          window.location.href = marker.href;
        }
        onMarkerFocus?.(marker.id);
      });

      const markerInstance = new mapboxgl.Marker(el).setLngLat([marker.lng, marker.lat]).addTo(map);
      markerRefs.current.push(markerInstance);
    });
  }, [safeMarkers, onMarkerFocus]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !focusMarkerId) return;
    const target = safeMarkers.find((m) => m.id === focusMarkerId);
    if (!target) return;
    map.flyTo({ center: [target.lng, target.lat], zoom: 13, essential: true });
  }, [focusMarkerId, safeMarkers]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    if (userMarkerRef.current) {
      userMarkerRef.current.remove();
      userMarkerRef.current = null;
    }

    if (!userLocation) return;

    const el = document.createElement("div");
    el.className = "uzeed-map-marker uzeed-map-marker--user";
    userMarkerRef.current = new mapboxgl.Marker(el).setLngLat([userLocation[1], userLocation[0]]).addTo(map);
  }, [userLocation?.[0], userLocation?.[1]]);

  if (!token) {
    return (
      <div className={`rounded-2xl border border-white/10 bg-white/5 p-4 text-sm text-white/70 ${className || ""}`} style={{ height }}>
        Configura NEXT_PUBLIC_MAPBOX_TOKEN para ver el mapa.
      </div>
    );
  }

  return <div ref={containerRef} className={className} style={{ height }} />;
}
