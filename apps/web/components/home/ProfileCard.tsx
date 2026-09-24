"use client";

/**
 * Tarjeta de perfil del inicio.
 *
 * Lo que decide el contacto en este rubro es nombre, edad, dónde está y si
 * atiende ahora. Por eso nombre y edad van grandes, abajo va la categoría y la
 * comuna con el metro más cercano, y arriba un solo indicador (el punto verde)
 * más una sola etiqueta (plan o "Nueva"). La tarjeta anterior podía juntar
 * siete insignias y la edad quedaba en gris de 11px.
 *
 * El tamaño y el borde dependen del plan: Diamond es la tarjeta más grande y
 * con brillo, Gold lleva borde dorado y Silver es la tarjeta base.
 */

import Link from "next/link";
import { useState, type MouseEvent } from "react";
import { ChevronLeft, ChevronRight, Star } from "lucide-react";
import { resolveMediaUrl } from "../../lib/api";
import { hasVerifiedBadge } from "../../lib/systemBadges";

export type HomeLevel = "DIAMOND" | "GOLD" | "SILVER";

export type HomeProfile = {
  id: string;
  displayName: string;
  age: number | null;
  city: string | null;
  nearestMetro?: { name: string } | null;
  distance?: number | null;
  availableNow: boolean;
  userLevel: HomeLevel;
  avatarUrl: string | null;
  coverUrl: string | null;
  galleryUrls: string[];
  profileTags: string[];
  serviceTags: string[];
  serviceCategory: string | null;
  primaryCategory: string | null;
  isNew: boolean;
  hasVideo: boolean;
};

export type HomeCategory = "escort" | "masajes" | "trans";

const MAX_PHOTOS = 6;

function normalize(s: string | null | undefined): string {
  return String(s ?? "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "");
}

/** Etiqueta corta bajo el nombre ("Escort VIP", "Tántrico", "Madura"). */
export function categoryLabel(p: HomeProfile, category: HomeCategory): string {
  const tags = [...p.profileTags, ...p.serviceTags].map(normalize);
  const paid = p.userLevel === "DIAMOND" || p.userLevel === "GOLD";
  if (category === "trans" || tags.includes("trans")) return paid ? "Trans VIP" : "Trans";
  if (category === "masajes") {
    const text = `${normalize(p.serviceCategory)} ${tags.join(" ")}`;
    if (text.includes("tantr")) return "Tántrico";
    if (text.includes("nuru")) return "Nuru";
    if (text.includes("descontract")) return "Descontracturante";
    return "Masajista";
  }
  if (p.age != null && p.age >= 40) return "Madura";
  return paid ? "Escort VIP" : "Escort";
}

function photos(p: HomeProfile): string[] {
  const list = [p.coverUrl, p.avatarUrl, ...p.galleryUrls]
    .map((u) => resolveMediaUrl(u))
    .filter((u): u is string => Boolean(u));
  const unique = Array.from(new Set(list)).slice(0, MAX_PHOTOS);
  return unique.length ? unique : ["/brand/isotipo-new.png"];
}

const VARIANT = {
  DIAMOND: {
    box: "aspect-[3/4] rounded-xl shadow-[0_0_0_1.5px_rgba(165,180,252,0.75),0_10px_30px_-8px_rgba(165,180,252,0.35)]",
    name: "text-[clamp(24px,2.6vw,32px)]",
  },
  GOLD: {
    box: "aspect-[2/3] rounded-[10px] shadow-[0_0_0_1.5px_rgba(245,196,81,0.7)]",
    name: "text-[clamp(19px,2vw,24px)]",
  },
  SILVER: {
    box: "aspect-[2/3] rounded-lg",
    name: "text-[clamp(19px,2vw,24px)]",
  },
} as const;

function VerifiedCheck() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4 shrink-0" role="img" aria-label="Verificada">
      <path
        fill="#38bdf8"
        d="M12 1.5l2.6 1.9 3.2-.2 1 3.1 2.7 1.8-1 3.1 1 3.1-2.7 1.8-1 3.1-3.2-.2L12 22.5l-2.6-1.9-3.2.2-1-3.1-2.7-1.8 1-3.1-1-3.1 2.7-1.8 1-3.1 3.2.2z"
      />
      <path
        d="m8 12.2 2.7 2.7L16.2 9.4"
        fill="none"
        stroke="#04121c"
        strokeWidth="2.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

type Props = {
  profile: HomeProfile;
  category: HomeCategory;
  isFavorite: boolean;
  onToggleFavorite: (id: string) => void;
  /** La primera fila se pide con prioridad; el resto espera al scroll. */
  eager?: boolean;
};

export default function ProfileCard({
  profile: p,
  category,
  isFavorite,
  onToggleFavorite,
  eager = false,
}: Props) {
  const list = photos(p);
  const [index, setIndex] = useState(0);
  const variant = VARIANT[p.userLevel] ?? VARIANT.SILVER;
  const current = list[Math.min(index, list.length - 1)];

  const step = (delta: number) => (e: MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIndex((i) => (i + delta + list.length) % list.length);
  };

  const tag =
    p.userLevel === "DIAMOND" ? (
      <span className="rounded-[5px] bg-black/55 px-[7px] py-[3px] text-[9.5px] font-extrabold uppercase tracking-[0.06em] text-tier-diamond backdrop-blur-sm">
        ◆ Diamond
      </span>
    ) : p.userLevel === "GOLD" ? (
      <span className="rounded-[5px] bg-black/55 px-[7px] py-[3px] text-[9.5px] font-extrabold uppercase tracking-[0.06em] text-tier-gold backdrop-blur-sm">
        ★ Gold
      </span>
    ) : p.isNew ? (
      <span className="rounded-[5px] bg-black/55 px-[7px] py-[3px] text-[9.5px] font-extrabold uppercase tracking-[0.06em] text-pink-200 backdrop-blur-sm">
        Nueva
      </span>
    ) : null;

  return (
    <article
      className={`group relative isolate max-w-full overflow-hidden bg-uzeed-800 ${variant.box}`}
    >
      <img
        src={current}
        alt={p.displayName}
        className="absolute inset-0 h-full w-full object-cover"
        loading={eager ? "eager" : "lazy"}
        decoding="async"
        onError={(e) => {
          (e.currentTarget as HTMLImageElement).src = "/brand/isotipo-new.png";
        }}
      />

      {/* Marca de agua: la foto copiada a otro sitio sigue diciendo UZEED. */}
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 grid place-items-center overflow-hidden">
        <span className="-rotate-[28deg] whitespace-nowrap text-[clamp(18px,3vw,30px)] font-extrabold tracking-[0.18em] text-white/10">
          UZEED
        </span>
      </div>

      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(to_top,rgba(0,0,0,0.88)_0%,rgba(0,0,0,0.2)_38%,transparent_60%)]" />

      <Link
        href={`/profesional/${p.id}`}
        aria-label={`Ver perfil de ${p.displayName}`}
        className="absolute inset-0 z-[1] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-fuchsia-500"
      />

      {list.length > 1 && (
        <div className="pointer-events-none absolute left-1/2 top-2.5 z-[3] flex -translate-x-1/2 gap-[3px]">
          {list.map((_, i) => (
            <i
              key={i}
              className={`block h-[2.5px] w-3.5 rounded-sm ${i === index ? "bg-white" : "bg-white/35"}`}
            />
          ))}
        </div>
      )}

      <div className="pointer-events-none absolute left-2 top-5 z-[3] flex items-center gap-[5px]">
        {p.availableNow && (
          <span
            title="Disponible ahora"
            className="h-2.5 w-2.5 rounded-full bg-emerald-400 shadow-[0_0_0_3px_rgba(52,211,153,0.25)]"
          />
        )}
        {tag}
      </div>

      <button
        type="button"
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          onToggleFavorite(p.id);
        }}
        aria-label={isFavorite ? "Quitar de favoritas" : "Guardar en favoritas"}
        aria-pressed={isFavorite}
        className="absolute right-1.5 top-1.5 z-[3] grid h-8 w-8 place-items-center rounded-full bg-black/35 transition hover:bg-black/55"
      >
        <Star
          className={`h-[17px] w-[17px] ${isFavorite ? "fill-tier-gold text-tier-gold" : "text-white"}`}
          strokeWidth={2}
        />
      </button>

      {list.length > 1 && (
        <>
          <button
            type="button"
            onClick={step(-1)}
            aria-label="Foto anterior"
            className="absolute left-1.5 top-1/2 z-[3] grid h-[26px] w-[26px] -translate-y-1/2 place-items-center rounded-full bg-black/40 opacity-80 transition-opacity focus-visible:opacity-100 md:opacity-0 md:group-hover:opacity-100"
          >
            <ChevronLeft className="h-[13px] w-[13px] text-white" strokeWidth={2.5} />
          </button>
          <button
            type="button"
            onClick={step(1)}
            aria-label="Foto siguiente"
            className="absolute right-1.5 top-1/2 z-[3] grid h-[26px] w-[26px] -translate-y-1/2 place-items-center rounded-full bg-black/40 opacity-80 transition-opacity focus-visible:opacity-100 md:opacity-0 md:group-hover:opacity-100"
          >
            <ChevronRight className="h-[13px] w-[13px] text-white" strokeWidth={2.5} />
          </button>
        </>
      )}

      <div className="pointer-events-none absolute inset-x-0 bottom-0 z-[2] p-2.5">
        <div className="flex items-center gap-1.5">
          <span className={`truncate font-display font-extrabold uppercase leading-none tracking-[0.01em] ${variant.name}`}>
            {p.displayName}
            {p.age ? <span className="ml-[5px]">{p.age}</span> : null}
          </span>
          {hasVerifiedBadge(p.profileTags) && <VerifiedCheck />}
        </div>
        <div className="mt-1 text-[10.5px] font-extrabold uppercase tracking-[0.08em] text-fuchsia-300">
          {categoryLabel(p, category)}
        </div>
        {(p.city || p.nearestMetro) && (
          <div className="mt-0.5 truncate text-[11.5px] text-white/60">
            {p.city && <b className="font-semibold text-white">{p.city}</b>}
            {p.city && p.nearestMetro ? " · " : null}
            {p.nearestMetro ? `Metro ${p.nearestMetro.name}` : null}
          </div>
        )}
      </div>
    </article>
  );
}
