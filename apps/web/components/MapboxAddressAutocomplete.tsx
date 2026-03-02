"use client";

import { useEffect, useMemo, useState } from "react";

type Suggestion = {
  id: string;
  placeName: string;
  latitude: number;
  longitude: number;
  city: string | null;
};

type Props = {
  label: string;
  value: string;
  placeholder?: string;
  required?: boolean;
  disabled?: boolean;
  onChange: (value: string) => void;
  onSelect: (suggestion: Suggestion) => void;
};

function extractCity(
  context: Array<{ id?: string; text?: string }> | undefined,
) {
  if (!Array.isArray(context)) return null;
  const place = context.find((item) =>
    String(item.id || "").startsWith("place."),
  );
  return place?.text ? String(place.text) : null;
}

export default function MapboxAddressAutocomplete({
  label,
  value,
  placeholder,
  required,
  disabled,
  onChange,
  onSelect,
}: Props) {
  const [items, setItems] = useState<Suggestion[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);

  const token = process.env.NEXT_PUBLIC_MAPBOX_TOKEN || "";
  const canSearch = value.trim().length >= 4 && Boolean(token);

  useEffect(() => {
    if (!canSearch) {
      setItems([]);
      return;
    }

    const ctrl = new AbortController();
    const timer = setTimeout(async () => {
      try {
        setLoading(true);
        const url = `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(
          value.trim(),
        )}.json?access_token=${token}&language=es&autocomplete=true&limit=5&country=CL`;
        const res = await fetch(url, { signal: ctrl.signal });
        if (!res.ok) throw new Error("GEOCODE_FAILED");
        const data = await res.json();
        const next: Suggestion[] = (data?.features || [])
          .map((feature: any) => {
            if (
              !feature?.id ||
              !Array.isArray(feature.center) ||
              feature.center.length < 2
            )
              return null;
            return {
              id: String(feature.id),
              placeName: String(feature.place_name || ""),
              longitude: Number(feature.center[0]),
              latitude: Number(feature.center[1]),
              city: extractCity(feature.context),
            } satisfies Suggestion;
          })
          .filter(Boolean);
        setItems(next as Suggestion[]);
      } catch {
        setItems([]);
      } finally {
        setLoading(false);
      }
    }, 280);

    return () => {
      ctrl.abort();
      clearTimeout(timer);
    };
  }, [canSearch, token, value]);

  const showMenu = useMemo(
    () => open && (loading || items.length > 0),
    [open, loading, items.length],
  );

  return (
    <div className="grid gap-2 relative">
      <label className="text-sm text-white/70">{label}</label>
      <input
        className="input"
        value={value}
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 120)}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        required={required}
        disabled={disabled}
      />
      {showMenu && (
        <div className="absolute left-0 right-0 top-[calc(100%+2px)] z-20 overflow-hidden rounded-xl border border-white/10 bg-[#111325] shadow-2xl">
          {loading ? (
            <div className="px-3 py-2 text-xs text-white/60">
              Buscando direcciones…
            </div>
          ) : (
            items.map((item) => (
              <button
                key={item.id}
                type="button"
                onMouseDown={(e) => {
                  e.preventDefault();
                  onChange(item.placeName);
                  onSelect(item);
                  setOpen(false);
                }}
                className="block w-full border-b border-white/5 px-3 py-2 text-left text-xs text-white/80 last:border-b-0 hover:bg-white/10"
              >
                {item.placeName}
              </button>
            ))
          )}
        </div>
      )}
      {!token && (
        <p className="text-xs text-amber-200/70">
          Configura NEXT_PUBLIC_MAPBOX_TOKEN para habilitar sugerencias de
          dirección.
        </p>
      )}
    </div>
  );
}
