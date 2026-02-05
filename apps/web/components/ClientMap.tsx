"use client";

import dynamic from "next/dynamic";
import { useEffect, useMemo, useState } from "react";

export type MarkerItem = {
  id: string;
  name: string;
  lat: number;
  lng: number;
  subtitle?: string | null;
};

export type ClientMapProps = {
  markers: MarkerItem[];
  /**
   * Optional user location [lat, lng]. If provided, the map will center here.
   * This is passed from pages that use navigator.geolocation.
   */
  userLocation?: [number, number] | null;
  className?: string;
  height?: number;
};

const DEFAULT_CENTER: [number, number] = [-33.4489, -70.6693]; // Santiago CL

// Dynamically import react-leaflet components to avoid SSR/prerender issues (Leaflet needs window).
const MapContainer = dynamic(() => import("react-leaflet").then((m) => m.MapContainer), { ssr: false });
const TileLayer = dynamic(() => import("react-leaflet").then((m) => m.TileLayer), { ssr: false });
const Marker = dynamic(() => import("react-leaflet").then((m) => m.Marker), { ssr: false });
const Popup = dynamic(() => import("react-leaflet").then((m) => m.Popup), { ssr: false });

export default function ClientMap({ markers, userLocation, className, height = 360 }: ClientMapProps) {
  const [center, setCenter] = useState<[number, number]>(DEFAULT_CENTER);
  const [icon, setIcon] = useState<any>(null);
  const [mapKey, setMapKey] = useState(0);

  // Create Leaflet icon ONLY in the browser (Leaflet touches window on import).
  useEffect(() => {
    let mounted = true;

    (async () => {
      if (typeof window === "undefined") return;

      const L = await import("leaflet");
      if (!mounted) return;

      const i = new L.Icon({
        iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
        iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
        shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
        iconSize: [25, 41],
        iconAnchor: [12, 41],
        popupAnchor: [1, -34],
        shadowSize: [41, 41],
      });

      setIcon(i);
    })();

    return () => {
      mounted = false;
    };
  }, []);

  const safeMarkers = useMemo(
    () => (markers || []).filter((m) => Number.isFinite(m.lat) && Number.isFinite(m.lng)).slice(0, 200),
    [markers]
  );

  // If userLocation is passed from parent, center the map on it.
  useEffect(() => {
    if (!userLocation) return;
    setCenter(userLocation);
    // Force remount to apply new center reliably.
    setMapKey((k) => k + 1);
  }, [userLocation?.[0], userLocation?.[1]]);

  // Fallback: try to center on user's location (optional) ONLY if userLocation was NOT provided.
  useEffect(() => {
    if (userLocation) return; // parent already handles GPS
    if (typeof window === "undefined") return;
    if (!("geolocation" in navigator)) return;

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const c: [number, number] = [pos.coords.latitude, pos.coords.longitude];
        setCenter(c);
        setMapKey((k) => k + 1);
      },
      () => {
        // ignore (permission denied / unavailable)
      },
      { enableHighAccuracy: true, timeout: 6000 }
    );
  }, [userLocation]);

  // If we still don't have a good center, try to center on first marker.
  useEffect(() => {
    if (userLocation) return;
    if (safeMarkers.length === 0) return;
    // Only update center if it's still default
    // (avoid fighting the GPS effect).
    setCenter((prev) => {
      const isDefault = prev[0] === DEFAULT_CENTER[0] && prev[1] === DEFAULT_CENTER[1];
      if (!isDefault) return prev;
      return [safeMarkers[0].lat, safeMarkers[0].lng];
    });
  }, [safeMarkers, userLocation]);

  return (
    <div className={className} style={{ height }}>
      <MapContainer
        key={mapKey}
        center={center}
        zoom={13}
        style={{ height: "100%", width: "100%" }}
        scrollWheelZoom={true}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        {safeMarkers.map((m) => (
          <Marker key={m.id} position={[m.lat, m.lng]} icon={icon ?? undefined}>
            <Popup>
              <div className="text-sm">
                <div className="font-semibold">{m.name}</div>
                {m.subtitle ? <div className="opacity-80">{m.subtitle}</div> : null}
              </div>
            </Popup>
          </Marker>
        ))}
      </MapContainer>
    </div>
  );
}
