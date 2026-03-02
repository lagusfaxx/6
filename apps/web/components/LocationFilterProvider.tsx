"use client";

import { type ReactNode, useEffect } from "react";
import {
  LocationFilterContext,
  useLocationFilterState,
} from "../hooks/useLocationFilter";

export default function LocationFilterProvider({ children }: { children: ReactNode }) {
  const value = useLocationFilterState();

  // Auto-request GPS on mount
  useEffect(() => {
    if (!value.state.gpsLocation && value.state.mode === "gps" && navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => value.setGps([pos.coords.latitude, pos.coords.longitude]),
        () => {},
        { enableHighAccuracy: true, timeout: 6000 }
      );
    }
  }, []);

  return (
    <LocationFilterContext.Provider value={value}>
      {children}
    </LocationFilterContext.Provider>
  );
}
