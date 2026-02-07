"use client";

import { useEffect, useState } from "react";

const STORAGE_KEY = "uzeed:lastLocation";

type Location = [number, number];

function readStoredLocation(): Location | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { lat?: number; lng?: number };
    if (!Number.isFinite(parsed?.lat) || !Number.isFinite(parsed?.lng)) return null;
    return [Number(parsed.lat), Number(parsed.lng)];
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

  useEffect(() => {
    const stored = readStoredLocation();
    if (stored) setLocation(stored);
  }, []);

  useEffect(() => {
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const next: Location = [pos.coords.latitude, pos.coords.longitude];
        setLocation(next);
        storeLocation(next);
      },
      () => {
        setLocation((prev) => prev || fallback);
      },
      { enableHighAccuracy: true, timeout: 6000 }
    );
  }, [fallback]);

  useEffect(() => {
    if (location) storeLocation(location);
  }, [location]);

  return { location, setLocation };
}
