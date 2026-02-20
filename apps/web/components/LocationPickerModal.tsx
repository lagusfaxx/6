"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { MapPin, Navigation, Search, X } from "lucide-react";
import { useActiveLocation } from "../hooks/useActiveLocation";

type City = {
  name: string;
  lat: number;
  lng: number;
};

const POPULAR_CITIES: City[] = [
  { name: "Santiago", lat: -33.4489, lng: -70.6693 },
  { name: "Valparaíso", lat: -33.0472, lng: -71.6127 },
  { name: "Viña del Mar", lat: -33.0153, lng: -71.5504 },
  { name: "Concepción", lat: -36.8270, lng: -73.0503 },
  { name: "La Serena", lat: -29.9027, lng: -71.2519 },
  { name: "Antofagasta", lat: -23.6509, lng: -70.3975 },
  { name: "Temuco", lat: -38.7359, lng: -72.5904 },
  { name: "Rancagua", lat: -34.1708, lng: -70.7444 },
  { name: "Iquique", lat: -20.2141, lng: -70.1524 },
  { name: "Puerto Montt", lat: -41.4693, lng: -72.9424 },
  { name: "Talca", lat: -35.4264, lng: -71.6554 },
  { name: "Arica", lat: -18.4783, lng: -70.3126 },
];

type SearchResult = {
  name: string;
  lat: number;
  lng: number;
};

type LocationPickerModalProps = {
  isOpen: boolean;
  onClose: () => void;
};

export default function LocationPickerModal({
  isOpen,
  onClose,
}: LocationPickerModalProps) {
  const { activeLocation, setManualLocation, useGpsLocation } =
    useActiveLocation();
  const [search, setSearch] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (isOpen && inputRef.current) {
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [isOpen]);

  // Prevent body scroll when open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [isOpen]);

  const handleSearch = useCallback((query: string) => {
    setSearch(query);
    if (debounceRef.current) clearTimeout(debounceRef.current);

    if (!query.trim()) {
      setResults([]);
      setSearching(false);
      return;
    }

    setSearching(true);
    debounceRef.current = setTimeout(() => {
      // Filter popular cities locally first (fast, no API needed for MVP)
      const q = query
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .toLowerCase();
      const matched = POPULAR_CITIES.filter((c) =>
        c.name
          .normalize("NFD")
          .replace(/[\u0300-\u036f]/g, "")
          .toLowerCase()
          .includes(q),
      );
      setResults(matched);
      setSearching(false);
    }, 200);
  }, []);

  const selectCity = useCallback(
    (city: { name: string; lat: number; lng: number }) => {
      setManualLocation(city.lat, city.lng, city.name);
      setSearch("");
      setResults([]);
      onClose();
    },
    [setManualLocation, onClose],
  );

  const handleUseGps = useCallback(() => {
    useGpsLocation();
    setSearch("");
    setResults([]);
    onClose();
  }, [useGpsLocation, onClose]);

  if (!isOpen) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal / Bottom Sheet */}
      <div className="fixed inset-x-0 bottom-0 z-50 max-h-[85vh] overflow-hidden rounded-t-3xl border-t border-white/10 bg-gradient-to-b from-[#0e0d1ff8] to-[#0a0b1df8] shadow-2xl shadow-purple-500/20 backdrop-blur-xl md:inset-auto md:left-1/2 md:top-1/2 md:w-full md:max-w-md md:-translate-x-1/2 md:-translate-y-1/2 md:rounded-3xl md:border">
        {/* Handle (mobile) */}
        <div className="flex justify-center pt-3 md:hidden">
          <div className="h-1 w-10 rounded-full bg-white/20" />
        </div>

        {/* Header */}
        <div className="flex items-center justify-between border-b border-white/10 px-5 py-4">
          <h2 className="text-lg font-semibold">Cambiar ubicación</h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl p-2 text-white/60 hover:bg-white/10 hover:text-white"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="overflow-y-auto p-5" style={{ maxHeight: "calc(85vh - 80px)" }}>
          {/* Search input */}
          <div className="mb-4 flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2.5">
            <Search className="h-4 w-4 text-white/40" />
            <input
              ref={inputRef}
              type="text"
              value={search}
              onChange={(e) => handleSearch(e.target.value)}
              placeholder="Buscar ciudad..."
              className="w-full bg-transparent text-sm outline-none placeholder:text-white/35"
            />
          </div>

          {/* Search results */}
          {results.length > 0 && (
            <div className="mb-4 space-y-1">
              {results.map((r) => (
                <button
                  key={`${r.name}-${r.lat}`}
                  type="button"
                  onClick={() => selectCity(r)}
                  className="flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left transition-all hover:bg-white/10"
                >
                  <MapPin className="h-4 w-4 text-fuchsia-400" />
                  <span className="text-sm">{r.name}</span>
                </button>
              ))}
            </div>
          )}

          {searching && (
            <div className="mb-4 py-3 text-center text-sm text-white/50">
              Buscando...
            </div>
          )}

          {/* Use GPS button */}
          <button
            type="button"
            onClick={handleUseGps}
            className={`mb-5 flex w-full items-center gap-3 rounded-xl border px-4 py-3.5 text-sm font-medium transition-all ${
              activeLocation?.source === "gps"
                ? "border-fuchsia-400/30 bg-fuchsia-500/10 text-fuchsia-200"
                : "border-white/10 bg-white/[0.04] text-white/80 hover:bg-white/[0.08]"
            }`}
          >
            <Navigation className="h-4 w-4" />
            Usar mi ubicación actual
            {activeLocation?.source === "gps" && (
              <span className="ml-auto text-[10px] text-fuchsia-300">
                Activa
              </span>
            )}
          </button>

          {/* Back to GPS (when manual) */}
          {activeLocation?.source === "manual" && (
            <button
              type="button"
              onClick={handleUseGps}
              className="mb-5 flex w-full items-center justify-center gap-2 rounded-xl border border-purple-400/20 bg-purple-500/10 px-4 py-2.5 text-xs font-medium text-purple-200 transition-all hover:bg-purple-500/20"
            >
              <Navigation className="h-3.5 w-3.5" />
              Volver a mi ubicación
            </button>
          )}

          {/* Popular cities */}
          <div>
            <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-white/40">
              Ciudades populares
            </h3>
            <div className="grid grid-cols-2 gap-2">
              {POPULAR_CITIES.map((city) => {
                const isActive =
                  activeLocation?.source === "manual" &&
                  activeLocation?.label === city.name;
                return (
                  <button
                    key={city.name}
                    type="button"
                    onClick={() => selectCity(city)}
                    className={`rounded-xl border px-3 py-2.5 text-left text-sm transition-all ${
                      isActive
                        ? "border-fuchsia-400/30 bg-fuchsia-500/15 text-fuchsia-200"
                        : "border-white/[0.08] bg-white/[0.03] text-white/70 hover:bg-white/[0.08] hover:text-white"
                    }`}
                  >
                    <MapPin className="mr-1.5 inline h-3 w-3 text-fuchsia-400/60" />
                    {city.name}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
