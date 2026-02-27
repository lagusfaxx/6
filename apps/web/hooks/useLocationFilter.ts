"use client";

import { createContext, useContext, useState, useEffect, useCallback } from "react";

export type ChileanCity = {
  name: string;
  lat: number;
  lng: number;
  region: string;
};

export const CHILEAN_CITIES: ChileanCity[] = [
  { name: "Santiago", lat: -33.45, lng: -70.66, region: "Metropolitana" },
  { name: "Viña del Mar", lat: -33.02, lng: -71.55, region: "Valparaíso" },
  { name: "Valparaíso", lat: -33.05, lng: -71.62, region: "Valparaíso" },
  { name: "Concepción", lat: -36.83, lng: -73.05, region: "Biobío" },
  { name: "Antofagasta", lat: -23.65, lng: -70.40, region: "Antofagasta" },
  { name: "Temuco", lat: -38.74, lng: -72.60, region: "Araucanía" },
  { name: "Rancagua", lat: -34.17, lng: -70.74, region: "O'Higgins" },
  { name: "La Serena", lat: -29.91, lng: -71.25, region: "Coquimbo" },
  { name: "Arica", lat: -18.47, lng: -70.31, region: "Arica y Parinacota" },
  { name: "Iquique", lat: -20.21, lng: -70.15, region: "Tarapacá" },
  { name: "Puerto Montt", lat: -41.47, lng: -72.94, region: "Los Lagos" },
  { name: "Talca", lat: -35.43, lng: -71.66, region: "Maule" },
  { name: "Chillán", lat: -36.63, lng: -72.10, region: "Ñuble" },
  { name: "Osorno", lat: -40.57, lng: -73.14, region: "Los Lagos" },
  { name: "Punta Arenas", lat: -53.15, lng: -70.92, region: "Magallanes" },
  { name: "Copiapó", lat: -27.37, lng: -70.33, region: "Atacama" },
  { name: "Calama", lat: -22.46, lng: -68.93, region: "Antofagasta" },
  { name: "Los Ángeles", lat: -37.47, lng: -72.35, region: "Biobío" },
  { name: "Curicó", lat: -34.98, lng: -71.24, region: "Maule" },
  { name: "Providencia", lat: -33.43, lng: -70.61, region: "Metropolitana" },
  { name: "Las Condes", lat: -33.41, lng: -70.59, region: "Metropolitana" },
];

export const PROFILE_CATEGORIES = [
  { key: "escort", label: "Escort", icon: "sparkles" },
  { key: "masajes", label: "Masajes", icon: "hand" },
  { key: "moteles", label: "Moteles", icon: "building" },
  { key: "sexshop", label: "Sex Shop", icon: "shopping-bag" },
  { key: "trans", label: "Trans", icon: "heart" },
  { key: "despedidas", label: "Despedidas", icon: "party" },
  { key: "videollamadas", label: "Videollamadas", icon: "video" },
] as const;

export type LocationFilterState = {
  mode: "gps" | "city";
  selectedCity: ChileanCity | null;
  selectedCategory: string | null;
  gpsLocation: [number, number] | null;
};

const LOCATION_STORAGE_KEY = "uzeed:locationFilter";

function readStored(): Partial<LocationFilterState> {
  if (typeof window === "undefined") return {};
  try {
    const raw = localStorage.getItem(LOCATION_STORAGE_KEY);
    if (!raw) return {};
    return JSON.parse(raw);
  } catch {
    return {};
  }
}

function writeStored(state: Partial<LocationFilterState>) {
  try {
    localStorage.setItem(LOCATION_STORAGE_KEY, JSON.stringify(state));
  } catch {
    // ignore
  }
}

export type LocationFilterContextValue = {
  state: LocationFilterState;
  setCity: (city: ChileanCity | null) => void;
  setCategory: (cat: string | null) => void;
  setGps: (loc: [number, number]) => void;
  useCurrentLocation: () => void;
  effectiveLocation: [number, number] | null;
};

export const LocationFilterContext = createContext<LocationFilterContextValue | null>(null);

export function useLocationFilter() {
  const ctx = useContext(LocationFilterContext);
  if (!ctx) throw new Error("useLocationFilter must be within LocationFilterProvider");
  return ctx;
}

export function useLocationFilterState(): LocationFilterContextValue {
  const stored = readStored();
  const [state, setState] = useState<LocationFilterState>({
    mode: (stored.mode as "gps" | "city") || "gps",
    selectedCity: stored.selectedCity || null,
    selectedCategory: stored.selectedCategory || null,
    gpsLocation: stored.gpsLocation || null,
  });

  useEffect(() => {
    const stored = readStored();
    if (stored.mode || stored.selectedCity || stored.gpsLocation) {
      setState(prev => ({
        ...prev,
        mode: (stored.mode as "gps" | "city") || prev.mode,
        selectedCity: stored.selectedCity || prev.selectedCity,
        gpsLocation: stored.gpsLocation || prev.gpsLocation,
      }));
    }
  }, []);

  const setCity = useCallback((city: ChileanCity | null) => {
    setState((prev) => {
      const next = { ...prev, mode: city ? "city" as const : "gps" as const, selectedCity: city };
      writeStored(next);
      return next;
    });
  }, []);

  const setCategory = useCallback((cat: string | null) => {
    setState((prev) => {
      const next = { ...prev, selectedCategory: cat };
      writeStored(next);
      return next;
    });
  }, []);

  const setGps = useCallback((loc: [number, number]) => {
    setState((prev) => {
      const next = { ...prev, gpsLocation: loc };
      writeStored(next);
      return next;
    });
  }, []);

  const useCurrentLocation = useCallback(() => {
    setState((prev) => {
      const next = { ...prev, mode: "gps" as const, selectedCity: null };
      writeStored(next);
      return next;
    });
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => setGps([pos.coords.latitude, pos.coords.longitude]),
        () => {},
        { enableHighAccuracy: true, timeout: 6000 }
      );
    }
  }, [setGps]);

  const effectiveLocation: [number, number] | null =
    state.mode === "city" && state.selectedCity
      ? [state.selectedCity.lat, state.selectedCity.lng]
      : state.gpsLocation;

  return { state, setCity, setCategory, setGps, useCurrentLocation, effectiveLocation };
}
