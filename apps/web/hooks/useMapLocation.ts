"use client";

import { useEffect, useRef, useState } from "react";

const STORAGE_KEY = "uzeed:lastLocation";

type Location = [number, number];

function readStoredLocation(): Location | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { lat?: number; lng?: number };
    if (!Number.isFinite(parsed?.lat) || !Number.isFinite(parsed?.lng)) return null;
    const lat = Number(parsed.lat);
    const lng = Number(parsed.lng);
    if (lat < -90 || lat > 90 || lng < -180 || lng > 180) return null;
    return [lat, lng];
  } catch {
    return null;
  }
}

function storeLocation(location: Location) {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ lat: location[0], lng: location[1] }));
  } catch {
    // ignore storage issues
  }
}

export function useMapLocation(fallback: Location) {
  const [location, setLocation] = useState<Location | null>(() => readStoredLocation() || fallback);
  const [resolved, setResolved] = useState(false);
  const lastLocationRef = useRef<Location | null>(null);

  useEffect(() => {
    const stored = readStoredLocation();
    if (stored) {
      setLocation(stored);
      lastLocationRef.current = stored;
    }
  }, []);

  useEffect(() => {
    if (!navigator.geolocation) {
      setResolved(true);
      return;
    }
    let settled = false;
    const handleResolved = () => {
      if (!settled) {
        settled = true;
        setResolved(true);
      }
    };
    const updateLocation = (next: Location) => {
      const prev = lastLocationRef.current;
      if (prev) {
        const latDelta = Math.abs(prev[0] - next[0]);
        const lngDelta = Math.abs(prev[1] - next[1]);
        if (latDelta < 0.0005 && lngDelta < 0.0005) {
          handleResolved();
          return;
        }
      }
      lastLocationRef.current = next;
      setLocation(next);
      storeLocation(next);
      handleResolved();
    };
    const watchId = navigator.geolocation.watchPosition(
      (pos) => {
        updateLocation([pos.coords.latitude, pos.coords.longitude]);
      },
      () => {
        setLocation((prev) => prev || fallback);
        handleResolved();
      },
      { enableHighAccuracy: true, timeout: 6000 }
    );
    navigator.geolocation.getCurrentPosition(
      (pos) => updateLocation([pos.coords.latitude, pos.coords.longitude]),
      () => {
        setLocation((prev) => prev || fallback);
        handleResolved();
      },
      { enableHighAccuracy: true, timeout: 6000 }
    );
    return () => navigator.geolocation.clearWatch(watchId);
  }, [fallback]);

  useEffect(() => {
    if (location) storeLocation(location);
  }, [location]);

  return { location, setLocation, resolved };
}
