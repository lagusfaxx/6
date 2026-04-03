"use client";

import { type ReactNode, useEffect } from "react";
import {
  LocationFilterContext,
  useLocationFilterState,
} from "../hooks/useLocationFilter";

export default function LocationFilterProvider({ children }: { children: ReactNode }) {
  const value = useLocationFilterState();

  // Request GPS after first paint — deferred so it doesn't block LCP.
  // Children render immediately with no location (showing default/featured
  // content), then re-render with distance once GPS resolves.
  useEffect(() => {
    if (!value.state.gpsLocation && value.state.mode === "gps" && navigator.geolocation) {
      // Wait for idle time or 2s max before requesting GPS
      const request = () => {
        navigator.geolocation.getCurrentPosition(
          (pos) => value.setGps([pos.coords.latitude, pos.coords.longitude]),
          () => {},
          { enableHighAccuracy: false, timeout: 4000 }
        );
      };

      if (typeof requestIdleCallback === "function") {
        const id = requestIdleCallback(request, { timeout: 2000 });
        return () => cancelIdleCallback(id);
      }
      const timer = setTimeout(request, 1000);
      return () => clearTimeout(timer);
    }
  }, []);

  return (
    <LocationFilterContext.Provider value={value}>
      {children}
    </LocationFilterContext.Provider>
  );
}
