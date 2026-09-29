"use client";

import dynamic from "next/dynamic";
import { useMemo, useState } from "react";
import { BadgePercent, DoorOpen, List, LocateFixed, Map as MapIcon, X } from "lucide-react";
import MotelCard from "./MotelCard";
import { DIRECTORY_AMENITY_FILTERS, amenityIcon, motelHas } from "./amenities";
import { distanceKm } from "../../lib/comunas";
import { motelHref, priceFrom, type MotelDurationKey, type MotelWithComuna } from "../../lib/motels";
import { resolveMediaUrl } from "../../lib/api";

const MapboxMap = dynamic(() => import("../MapboxMap"), { ssr: false });

type Sort = "recommended" | "price" | "rating" | "near";

const DURATIONS: Array<{ key: MotelDurationKey; label: string }> = [
  { key: "3H", label: "3 horas" },
  { key: "6H", label: "6 horas" },
  { key: "NIGHT", label: "Noche" },
];

/**
 * Listado interactivo del directorio. Recibe los moteles ya renderizados en el
 * servidor (el HTML inicial trae todas las tarjetas) y filtra en el navegador.
 */
export default function MotelDirectory({
  motels,
  center,
  emptyTitle = "Todavía no hay moteles publicados aquí",
  emptyText = "Estamos sumando moteles cada semana. Mira los de las comunas cercanas.",
}: {
  motels: MotelWithComuna[];
  /** Centro de la comuna de la landing: ordena por cercanía y muestra la distancia. */
  center?: { lat: number; lng: number } | null;
  emptyTitle?: string;
  emptyText?: string;
}) {
  const [duration, setDuration] = useState<MotelDurationKey>("3H");
  const [filters, setFilters] = useState<string[]>([]);
  const [onlyPromo, setOnlyPromo] = useState(false);
  const [onlyBookable, setOnlyBookable] = useState(false);
  const [sort, setSort] = useState<Sort>(center ? "near" : "recommended");
  const [view, setView] = useState<"list" | "map">("list");
  const [userLoc, setUserLoc] = useState<{ lat: number; lng: number } | null>(null);
  const [locating, setLocating] = useState(false);

  const origin = userLoc || center || null;

  const rows = useMemo(() => {
    const list = motels
      .filter((m) => filters.every((f) => motelHas(m, f)))
      .filter((m) => (onlyPromo ? Boolean(m.promo) : true))
      .filter((m) => (onlyBookable ? m.kind === "profile" && m.isOpen && m.roomsCount > 0 : true))
      .map((m) => ({
        motel: m,
        distance:
          origin && m.latitude != null && m.longitude != null
            ? distanceKm(origin.lat, origin.lng, m.latitude, m.longitude)
            : null,
        price: priceFrom(m, duration)?.price ?? null,
      }));

    const score = (m: MotelWithComuna) =>
      (m.kind === "profile" ? 100 : 0) +
      (m.isOpen ? 20 : 0) +
      (m.roomsCount > 0 ? 20 : 0) +
      (m.promo ? 10 : 0) +
      (m.rating || 0) * 2 +
      Math.min(m.photos.length, 5);

    return list.sort((a, b) => {
      if (sort === "price") return (a.price ?? 1e9) - (b.price ?? 1e9);
      if (sort === "rating") return (b.motel.rating || 0) - (a.motel.rating || 0) || b.motel.reviewsCount - a.motel.reviewsCount;
      if (sort === "near") return (a.distance ?? 1e9) - (b.distance ?? 1e9);
      return score(b.motel) - score(a.motel);
    });
  }, [motels, filters, onlyPromo, onlyBookable, sort, duration, origin]);

  const activeCount = filters.length + (onlyPromo ? 1 : 0) + (onlyBookable ? 1 : 0);

  function toggleFilter(key: string) {
    setFilters((prev) => (prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]));
  }

  function locate() {
    if (!navigator.geolocation) return;
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setUserLoc({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        setSort("near");
        setLocating(false);
      },
      () => setLocating(false),
      { enableHighAccuracy: false, timeout: 8000, maximumAge: 300000 },
    );
  }

  const markers = useMemo(
    () =>
      rows
        .filter((r) => r.motel.latitude != null && r.motel.longitude != null)
        .map(({ motel, price }) => ({
          id: motel.id,
          name: motel.name,
          lat: motel.latitude as number,
          lng: motel.longitude as number,
          subtitle: price ? `desde $${price.toLocaleString("es-CL")}` : motel.comunaName || "",
          href: motelHref(motel),
          coverUrl: resolveMediaUrl(motel.coverUrl),
        })),
    [rows],
  );

  const chipBase = "flex shrink-0 items-center gap-1.5 rounded-full border px-3.5 py-2 text-[13px] font-medium transition";
  const chipOn = "border-fuchsia-400/50 bg-fuchsia-500/15 text-fuchsia-100";
  const chipOff = "border-white/10 bg-white/[0.04] text-white/70 hover:border-white/20 hover:text-white";

  return (
    <div>
      {/* ── Barra de filtros ── */}
      <div className="sticky top-[60px] z-20 -mx-4 border-b border-white/[0.06] bg-[#0d0e1a]/95 px-4 backdrop-blur-xl md:top-[72px]">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-2 py-3">
          <div role="group" aria-label="Duración" className="flex rounded-xl border border-white/10 bg-white/[0.04] p-1">
            {DURATIONS.map((d) => (
              <button
                key={d.key}
                onClick={() => setDuration(d.key)}
                aria-pressed={duration === d.key}
                className={`rounded-lg px-3 py-1.5 text-[13px] font-medium transition ${duration === d.key ? "bg-white text-black" : "text-white/60 hover:text-white"}`}
              >
                {d.label}
              </button>
            ))}
          </div>
          <div className="ml-auto flex items-center gap-2">
            <button
              onClick={locate}
              disabled={locating}
              className={`flex h-9 items-center gap-1.5 rounded-xl border px-3 text-[13px] transition ${userLoc ? chipOn : "border-white/10 bg-white/[0.04] text-white/70 hover:bg-white/10"}`}
            >
              <LocateFixed className="h-4 w-4" />
              <span className="hidden sm:inline">{locating ? "Buscando..." : "Cerca de mí"}</span>
            </button>
            <select
              value={sort}
              onChange={(e) => setSort(e.target.value as Sort)}
              aria-label="Ordenar"
              className="h-9 rounded-xl border border-white/10 bg-white/[0.04] px-3 text-[13px] text-white outline-none focus:border-fuchsia-500/50 [color-scheme:dark]"
            >
              <option value="recommended">Recomendados</option>
              <option value="price">Menor precio</option>
              <option value="rating">Mejor evaluados</option>
              {origin && <option value="near">Más cercanos</option>}
            </select>
            <button
              onClick={() => setView((v) => (v === "list" ? "map" : "list"))}
              className={`flex h-9 items-center gap-1.5 rounded-xl border px-3 text-[13px] transition ${view === "map" ? chipOn : "border-white/10 bg-white/[0.04] text-white/70 hover:bg-white/10"}`}
            >
              {view === "map" ? <List className="h-4 w-4" /> : <MapIcon className="h-4 w-4" />}
              <span className="hidden sm:inline">{view === "map" ? "Lista" : "Mapa"}</span>
            </button>
          </div>
        </div>
        <div className="mx-auto flex max-w-7xl gap-2 overflow-x-auto pb-3 scrollbar-none">
          <button onClick={() => setOnlyBookable((v) => !v)} aria-pressed={onlyBookable} className={`${chipBase} ${onlyBookable ? chipOn : chipOff}`}>
            <DoorOpen className="h-4 w-4" /> Reserva en UZEED
          </button>
          <button onClick={() => setOnlyPromo((v) => !v)} aria-pressed={onlyPromo} className={`${chipBase} ${onlyPromo ? chipOn : chipOff}`}>
            <BadgePercent className="h-4 w-4" /> Con promoción
          </button>
          {DIRECTORY_AMENITY_FILTERS.map((f) => {
            const Icon = amenityIcon(f.key);
            const on = filters.includes(f.key);
            return (
              <button key={f.key} onClick={() => toggleFilter(f.key)} aria-pressed={on} className={`${chipBase} ${on ? chipOn : chipOff}`}>
                <Icon className="h-4 w-4" /> {f.label}
              </button>
            );
          })}
          {activeCount > 0 && (
            <button
              onClick={() => { setFilters([]); setOnlyPromo(false); setOnlyBookable(false); }}
              className={`${chipBase} border-transparent text-white/50 hover:text-white`}
            >
              <X className="h-4 w-4" /> Limpiar
            </button>
          )}
        </div>
      </div>

      <p className="mx-auto mt-4 max-w-7xl text-[13px] text-white/45">
        {rows.length} {rows.length === 1 ? "motel" : "moteles"}
        {activeCount > 0 ? " con esos filtros" : ""}
      </p>

      {/* ── Resultados ── */}
      {view === "map" ? (
        <div className="mx-auto mt-3 h-[65vh] max-w-7xl overflow-hidden rounded-2xl border border-white/[0.08]">
          <MapboxMap markers={markers} fill userLocation={userLoc ? [userLoc.lng, userLoc.lat] : null} />
        </div>
      ) : rows.length ? (
        <div className="mx-auto mt-3 grid max-w-7xl grid-cols-1 gap-x-5 gap-y-8 min-[480px]:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {rows.map(({ motel, distance }, i) => (
            <MotelCard key={motel.id} motel={motel} duration={duration} distanceKm={origin ? distance : null} priority={i < 4} />
          ))}
        </div>
      ) : (
        <div className="mx-auto mt-6 max-w-xl rounded-2xl border border-dashed border-white/10 bg-white/[0.02] px-6 py-12 text-center">
          <p className="font-semibold text-white/80">{motels.length ? "Ningún motel cumple esos filtros" : emptyTitle}</p>
          <p className="mt-1 text-sm text-white/45">{motels.length ? "Prueba quitando alguno." : emptyText}</p>
          {activeCount > 0 && (
            <button
              onClick={() => { setFilters([]); setOnlyPromo(false); setOnlyBookable(false); }}
              className="btn-secondary mt-4 px-4 py-2 text-sm"
            >
              Quitar filtros
            </button>
          )}
        </div>
      )}
    </div>
  );
}
