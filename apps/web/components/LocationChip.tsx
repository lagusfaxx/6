"use client";

import { MapPin } from "lucide-react";
import { useActiveLocation } from "../hooks/useActiveLocation";

type LocationChipProps = {
  onClick: () => void;
};

export default function LocationChip({ onClick }: LocationChipProps) {
  const { activeLocation } = useActiveLocation();

  const label = activeLocation?.label || "Ubicación";
  const isManual = activeLocation?.source === "manual";

  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex items-center gap-1.5 rounded-full border border-white/20 bg-white/10 px-3 py-1.5 text-xs font-medium text-white/90 transition-all hover:bg-white/20 hover:border-purple-400/40 active:scale-95 backdrop-blur-xl"
      aria-label="Cambiar ubicación"
    >
      <MapPin className="h-3.5 w-3.5 text-fuchsia-400" />
      <span className="max-w-[120px] truncate">{label}</span>
      {isManual && (
        <span className="text-[10px] text-fuchsia-300/80">· Explorando</span>
      )}
      <svg
        className="h-3 w-3 text-white/50"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
        strokeWidth={2}
      >
        <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
      </svg>
    </button>
  );
}
