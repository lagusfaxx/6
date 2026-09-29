import Link from "next/link";
import { BadgePercent, MapPin, Star } from "lucide-react";
import { resolveMediaUrl } from "../../lib/api";
import {
  DURATION_SHORT,
  formatClp,
  motelHref,
  priceFrom,
  promoLabel,
  type MotelDurationKey,
  type MotelWithComuna,
} from "../../lib/motels";
import { motelAmenityLabel, roomAmenityLabel } from "./amenities";

/**
 * Tarjeta del directorio de moteles: foto grande arriba y los datos abajo,
 * como un listado de alojamientos. Es un componente de servidor: el HTML llega
 * completo a Google.
 */
export default function MotelCard({
  motel,
  duration = "3H",
  distanceKm,
  priority = false,
}: {
  motel: MotelWithComuna;
  duration?: MotelDurationKey;
  distanceKm?: number | null;
  priority?: boolean;
}) {
  const cover = resolveMediaUrl(motel.coverUrl);
  const from = priceFrom(motel, duration);
  const highlights = [
    ...motel.amenities.slice(0, 2).map(motelAmenityLabel),
    ...motel.roomAmenities.filter((a) => a === "jacuzzi" || a === "sauna").map(roomAmenityLabel),
  ];
  const highlight = Array.from(new Set(highlights)).slice(0, 2).join(" · ");

  return (
    <Link
      href={motelHref(motel)}
      className="group block rounded-2xl focus:outline-none focus-visible:ring-2 focus-visible:ring-fuchsia-500/60"
    >
      <div className="relative aspect-[4/3] overflow-hidden rounded-2xl border border-white/[0.08] bg-[#0a0a10]">
        {cover ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={cover}
            alt={`${motel.name}, motel en ${motel.comunaName || "Chile"}`}
            loading={priority ? "eager" : "lazy"}
            decoding="async"
            className="h-full w-full object-cover transition duration-500 group-hover:scale-[1.04]"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-fuchsia-900/40 via-violet-900/30 to-indigo-900/20">
            <span className="select-none text-5xl font-black tracking-tighter text-white/[0.08]">{motel.name[0]?.toUpperCase()}</span>
          </div>
        )}
        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-black/50 to-transparent" />
        <div className="absolute left-2.5 top-2.5 flex flex-wrap gap-1.5">
          {motel.promo && (
            <span className="inline-flex items-center gap-1 rounded-full bg-fuchsia-600/90 px-2.5 py-1 text-[11px] font-semibold text-white shadow-lg">
              <BadgePercent className="h-3.5 w-3.5" /> {promoLabel(motel.promo)}
            </span>
          )}
          {motel.kind === "profile" && !motel.isOpen && (
            <span className="rounded-full bg-black/70 px-2.5 py-1 text-[11px] font-medium text-white/80 backdrop-blur">Cerrado ahora</span>
          )}
        </div>
        {motel.kind === "profile" && motel.roomsCount > 0 && motel.isOpen && (
          <span className="absolute bottom-2.5 left-2.5 rounded-full bg-emerald-500/90 px-2.5 py-1 text-[11px] font-semibold text-black">
            Reserva en UZEED
          </span>
        )}
      </div>

      <div className="px-0.5 pt-2.5">
        <div className="flex items-start justify-between gap-2">
          <h3 className="min-w-0 truncate text-[15px] font-semibold text-white group-hover:text-fuchsia-200">{motel.name}</h3>
          {motel.rating ? (
            <span className="flex shrink-0 items-center gap-1 text-sm text-white/85">
              <Star className="h-3.5 w-3.5 fill-current text-amber-300" />
              {motel.rating.toFixed(1)}
              <span className="text-white/40">({motel.reviewsCount})</span>
            </span>
          ) : null}
        </div>
        <p className="mt-0.5 flex items-center gap-1 truncate text-[13px] text-white/50">
          <MapPin className="h-3.5 w-3.5 shrink-0" />
          {motel.comunaName || motel.city || "Chile"}
          {distanceKm != null && <span className="text-white/35"> · a {distanceKm < 1 ? "menos de 1" : distanceKm.toFixed(1)} km</span>}
        </p>
        {highlight && <p className="mt-0.5 truncate text-[13px] text-white/40">{highlight}</p>}
        <p className="mt-1.5 text-[14px] text-white/90">
          {from ? (
            <>
              <span className="text-white/45">desde </span>
              <span className="font-semibold">{formatClp(from.price)}</span>
              <span className="text-white/45"> · {DURATION_SHORT[from.duration]}</span>
            </>
          ) : motel.kind === "listing" ? (
            <span className="text-white/45">Tarifas en su sitio web</span>
          ) : (
            <span className="text-white/45">Consultar tarifas</span>
          )}
        </p>
      </div>
    </Link>
  );
}
