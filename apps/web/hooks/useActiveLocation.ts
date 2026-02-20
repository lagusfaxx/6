"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";

const STORAGE_KEY = "uzeed:activeLocation";
const GPS_STORAGE_KEY = "uzeed:lastLocation";

export type ActiveLocationSource = "gps" | "manual";

export type ActiveLocation = {
  lat: number;
  lng: number;
  label: string;
  source: ActiveLocationSource;
};

export type ActiveLocationContextValue = {
  /** Current GPS coordinates (always tracks real device position) */
  gpsLocation: [number, number] | null;
  /** The active location used for all queries (may be GPS or manual) */
  activeLocation: ActiveLocation | null;
  /** Switch to a manually-chosen city */
  setManualLocation: (lat: number, lng: number, label: string) => void;
  /** Revert to using the real GPS location */
  useGpsLocation: () => void;
  /** Whether location has been resolved at least once */
  resolved: boolean;
};

const SANTIAGO_FALLBACK: [number, number] = [-33.45, -70.66];

function readStored(): ActiveLocation | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as ActiveLocation;
    if (
      !Number.isFinite(parsed?.lat) ||
      !Number.isFinite(parsed?.lng) ||
      !parsed?.source
    )
      return null;
    return parsed;
  } catch {
    return null;
  }
}

function persist(loc: ActiveLocation) {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(loc));
  } catch {
    // ignore
  }
}

function readGpsStored(): [number, number] | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(GPS_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { lat?: number; lng?: number };
    if (!Number.isFinite(parsed?.lat) || !Number.isFinite(parsed?.lng))
      return null;
    return [Number(parsed.lat), Number(parsed.lng)];
  } catch {
    return null;
  }
}

function storeGps(loc: [number, number]) {
  try {
    window.localStorage.setItem(
      GPS_STORAGE_KEY,
      JSON.stringify({ lat: loc[0], lng: loc[1] }),
    );
  } catch {
    // ignore
  }
}

export const ActiveLocationContext =
  createContext<ActiveLocationContextValue | null>(null);

export function useActiveLocation(): ActiveLocationContextValue {
  const ctx = useContext(ActiveLocationContext);
  if (ctx) return ctx;
  // Fallback for when used outside provider (shouldn't happen in normal app)
  return useActiveLocationState();
}

export function useActiveLocationState(): ActiveLocationContextValue {
  const [gpsLocation, setGpsLocation] = useState<[number, number] | null>(
    () => readGpsStored(),
  );
  const [activeLocation, setActiveLocation] = useState<ActiveLocation | null>(
    () => readStored(),
  );
  const [resolved, setResolved] = useState(false);
  const lastGpsRef = useRef<[number, number] | null>(null);

  // Watch GPS
  useEffect(() => {
    if (typeof navigator === "undefined" || !navigator.geolocation) {
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

    const updateGps = (next: [number, number]) => {
      const prev = lastGpsRef.current;
      if (prev) {
        const latDelta = Math.abs(prev[0] - next[0]);
        const lngDelta = Math.abs(prev[1] - next[1]);
        if (latDelta < 0.0005 && lngDelta < 0.0005) {
          handleResolved();
          return;
        }
      }
      lastGpsRef.current = next;
      setGpsLocation(next);
      storeGps(next);

      // If active location is GPS-based, update it too
      setActiveLocation((prev) => {
        if (!prev || prev.source === "gps") {
          const loc: ActiveLocation = {
            lat: next[0],
            lng: next[1],
            label: "Cerca de ti",
            source: "gps",
          };
          persist(loc);
          return loc;
        }
        return prev;
      });

      handleResolved();
    };

    const watchId = navigator.geolocation.watchPosition(
      (pos) => updateGps([pos.coords.latitude, pos.coords.longitude]),
      () => {
        setGpsLocation((prev) => prev || SANTIAGO_FALLBACK);
        setActiveLocation((prev) => {
          if (!prev) {
            const loc: ActiveLocation = {
              lat: SANTIAGO_FALLBACK[0],
              lng: SANTIAGO_FALLBACK[1],
              label: "Santiago",
              source: "gps",
            };
            persist(loc);
            return loc;
          }
          return prev;
        });
        handleResolved();
      },
      { enableHighAccuracy: true, timeout: 6000 },
    );

    navigator.geolocation.getCurrentPosition(
      (pos) => updateGps([pos.coords.latitude, pos.coords.longitude]),
      () => {
        setGpsLocation((prev) => prev || SANTIAGO_FALLBACK);
        setActiveLocation((prev) => {
          if (!prev) {
            const loc: ActiveLocation = {
              lat: SANTIAGO_FALLBACK[0],
              lng: SANTIAGO_FALLBACK[1],
              label: "Santiago",
              source: "gps",
            };
            persist(loc);
            return loc;
          }
          return prev;
        });
        handleResolved();
      },
      { enableHighAccuracy: true, timeout: 6000 },
    );

    return () => navigator.geolocation.clearWatch(watchId);
  }, []);

  const setManualLocation = useCallback(
    (lat: number, lng: number, label: string) => {
      const loc: ActiveLocation = { lat, lng, label, source: "manual" };
      setActiveLocation(loc);
      persist(loc);
    },
    [],
  );

  const useGpsLocation = useCallback(() => {
    const gps = lastGpsRef.current || gpsLocation || SANTIAGO_FALLBACK;
    const loc: ActiveLocation = {
      lat: gps[0],
      lng: gps[1],
      label: "Cerca de ti",
      source: "gps",
    };
    setActiveLocation(loc);
    persist(loc);
  }, [gpsLocation]);

  return {
    gpsLocation,
    activeLocation,
    setManualLocation,
    useGpsLocation,
    resolved,
  };
}
