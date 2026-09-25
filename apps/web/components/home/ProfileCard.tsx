"use client";

/**
 * Tarjeta de perfil del inicio (Diamond, Gold, Novedades y feed).
 *
 * Lo que decide el contacto en este rubro es nombre, edad, dónde está y si
 * atiende ahora. Por eso nombre y edad van grandes, abajo va la categoría y la
 * comuna con el metro más cercano, y arriba un solo indicador (el punto verde)
 * más una sola etiqueta (plan o "Nueva"). Las fotos se pasan con flechas
 * dentro de la tarjeta, la estrella guarda en favoritas y la marca de agua
 * deja la foto firmada si alguien la copia a otro sitio.
 *
 * El plan se ve en la etiqueta de arriba (Diamond, Gold); el borde es el
 * mismo sutil para todas.
 */

import Link from "next/link";
import { useRef, useState, type MouseEvent, type TouchEvent } from "react";
import { ChevronLeft, ChevronRight, Star } from "lucide-react";
import { resolveMediaUrl } from "../../lib/api";
import { hasVerifiedBadge } from "../../lib/systemBadges";
import useFavorites from "../../hooks/useFavorites";

export type HomeLevel = "DIAMOND" | "GOLD" | "SILVER";

export type HomeProfile = {
  id: string;
  displayName: string;
  age: number | null;
  city: string | null;
  nearestMetro: { name: string } | null;
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
  /** Boost "Destacada" vigente. */
  spotlight?: boolean;
};

export type CardStoryMedia = {
  id: string;
  mediaUrl: string;
  mediaType: "IMAGE" | "VIDEO" | string;
};

/** Normaliza lo que devuelve la API (directorio, recientes, novedades). */
export function toHomeProfile(r: any, overrides: Partial<HomeProfile> = {}): HomeProfile {
  const level: HomeLevel =
    r?.userLevel === "DIAMOND" || r?.userLevel === "GOLD" ? r.userLevel : "SILVER";
  return {
    id: String(r.id),
    displayName: r.displayName || r.name || r.username || "Perfil",
    age: typeof r.age === "number" ? r.age : null,
    city: r.city ?? null,
    nearestMetro: r.nearestMetro?.name ? { name: String(r.nearestMetro.name) } : null,
    availableNow: Boolean(r.availableNow),
    userLevel: level,
    avatarUrl: r.avatarUrl ?? null,
    coverUrl: r.coverUrl ?? null,
    galleryUrls: Array.isArray(r.galleryUrls) ? r.galleryUrls : [],
    profileTags: Array.isArray(r.profileTags) ? r.profileTags : [],
    serviceTags: Array.isArray(r.serviceTags) ? r.serviceTags : [],
    serviceCategory: r.serviceCategory ?? null,
    primaryCategory: r.primaryCategory ?? null,
    isNew: Boolean(r.isNew),
    spotlight: r?.boost === "SPOTLIGHT",
    ...overrides,
  };
}

const MAX_SLIDES = 8;

function normalize(s: string | null | undefined): string {
  return String(s ?? "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "");
}

/** Etiqueta corta bajo el nombre ("Escort VIP", "Tántrico", "Madura"). */
export function categoryLabel(p: HomeProfile): string {
  const tags = [...p.profileTags, ...p.serviceTags].map(normalize);
  const paid = p.userLevel === "DIAMOND" || p.userLevel === "GOLD";
  const cat = `${normalize(p.primaryCategory)} ${normalize(p.serviceCategory)}`;
  /* Trans se define por la etiqueta del perfil, igual que el filtro
     /escorts?profileTags=trans. La categoría principal no sirve: hay
     perfiles de mujeres con primaryCategory "trans" cargado por error. */
  if (p.profileTags.map(normalize).includes("trans")) return paid ? "Trans VIP" : "Trans";
  if (cat.includes("masaj")) {
    const text = `${cat} ${tags.join(" ")}`;
    if (text.includes("tantr")) return "Tántrico";
    if (text.includes("nuru")) return "Nuru";
    if (text.includes("descontract")) return "Descontracturante";
    return "Masajista";
  }
  if (p.age != null && p.age >= 40) return "Madura";
  return paid ? "Escort VIP" : "Escort";
}

type Slide = { kind: "image" | "video"; url: string };

function buildSlides(p: HomeProfile, stories: CardStoryMedia[]): Slide[] {
  const slides: Slide[] = [];
  const seen = new Set<string>();
  const push = (kind: Slide["kind"], raw: string | null | undefined) => {
    const url = resolveMediaUrl(raw);
    if (!url || seen.has(url)) return;
    seen.add(url);
    slides.push({ kind, url });
  };
  push("image", p.coverUrl);
  push("image", p.avatarUrl);
  // Las historias destacadas (las que el admin marca para el inicio) van
  // justo después de la portada, como en la tarjeta anterior.
  for (const s of stories) {
    push(String(s.mediaType).toUpperCase() === "VIDEO" ? "video" : "image", s.mediaUrl);
  }
  for (const g of p.galleryUrls) push("image", g);
  const list = slides.slice(0, MAX_SLIDES);
  return list.length ? list : [{ kind: "image", url: "/brand/isotipo-new.png" }];
}

function VerifiedCheck() {
  return (
    <svg viewBox="0 0 24 24" className="h-3.5 w-3.5 shrink-0" role="img" aria-label="Verificada">
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

const TAG_CLASS =
  "rounded-[4px] bg-black/55 px-1.5 py-[2px] text-[8.5px] font-extrabold uppercase tracking-[0.06em] backdrop-blur-sm";

const ARROW_CLASS =
  "absolute top-1/2 z-[3] grid h-8 w-8 -translate-y-1/2 place-items-center rounded-full border border-white/15 bg-black/55 text-white shadow-[0_2px_10px_rgba(0,0,0,0.4)] backdrop-blur-sm transition hover:bg-black/75";

type Props = {
  profile: HomeProfile;
  /** Historias destacadas para el inicio; se suman a las fotos. */
  stories?: CardStoryMedia[];
  /** Proporción de la foto. Diamond usa 3/4; el resto 2/3. */
  aspect?: string;
  /** Nombre grande (tarjetas Diamond de la grilla). */
  large?: boolean;
  /** La primera fila se pide con prioridad; el resto espera al scroll. */
  eager?: boolean;
};

export default function ProfileCard({
  profile: p,
  stories = [],
  aspect = "aspect-[2/3]",
  large = false,
  eager = false,
}: Props) {
  const { favorites, toggle } = useFavorites();
  const isFavorite = favorites.has(p.id);
  const slides = buildSlides(p, stories);
  const [index, setIndex] = useState(0);
  const current = slides[Math.min(index, slides.length - 1)];

  const go = (delta: number) =>
    setIndex((i) => (i + delta + slides.length) % slides.length);
  const step = (delta: number) => (e: MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    go(delta);
  };

  /* Deslizar con el dedo cambia de foto; un gesto más vertical que
     horizontal se deja pasar para no trabar el scroll de la página. */
  const touchStart = useRef<{ x: number; y: number } | null>(null);
  const onTouchStart = (e: TouchEvent) => {
    const t = e.touches[0];
    touchStart.current = { x: t.clientX, y: t.clientY };
  };
  const onTouchEnd = (e: TouchEvent) => {
    const start = touchStart.current;
    touchStart.current = null;
    if (!start || slides.length < 2) return;
    const t = e.changedTouches[0];
    const dx = t.clientX - start.x;
    const dy = t.clientY - start.y;
    if (Math.abs(dx) > 40 && Math.abs(dx) > Math.abs(dy) * 1.5) go(dx < 0 ? 1 : -1);
  };

  const tag =
    p.spotlight ? (
      <span className={`${TAG_CLASS} text-fuchsia-200`}>🔥 Destacada</span>
    ) : p.userLevel === "DIAMOND" ? (
      <span className={`${TAG_CLASS} text-tier-diamond`}>◆ Diamond</span>
    ) : p.userLevel === "GOLD" ? (
      <span className={`${TAG_CLASS} text-tier-gold`}>★ Gold</span>
    ) : p.isNew ? (
      <span className={`${TAG_CLASS} text-pink-200`}>Nueva</span>
    ) : null;

  return (
    <article
      onTouchStart={onTouchStart}
      onTouchEnd={onTouchEnd}
      className={`group relative isolate max-w-full overflow-hidden rounded-2xl border border-white/[0.08] bg-[#0c0a14] ${aspect}`}
    >
      {current.kind === "video" ? (
        <video
          key={current.url}
          src={current.url}
          className="absolute inset-0 h-full w-full object-cover"
          autoPlay
          muted
          loop
          playsInline
          preload="metadata"
        />
      ) : (
        <img
          key={current.url}
          src={current.url}
          alt={p.displayName}
          className="absolute inset-0 h-full w-full object-cover"
          loading={eager ? "eager" : "lazy"}
          decoding="async"
          onError={(e) => {
            (e.currentTarget as HTMLImageElement).src = "/brand/isotipo-new.png";
          }}
        />
      )}

      {/* Marca de agua: la foto copiada a otro sitio sigue diciendo UZEED. */}
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 grid place-items-center overflow-hidden">
        <span className="-rotate-[28deg] whitespace-nowrap text-[clamp(18px,3vw,30px)] font-extrabold tracking-[0.18em] text-white/10">
          UZEED
        </span>
      </div>

      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(to_top,rgba(0,0,0,0.8)_0%,rgba(0,0,0,0.15)_28%,transparent_45%)]" />

      <Link
        href={`/profesional/${p.id}`}
        aria-label={`Ver perfil de ${p.displayName}`}
        className="absolute inset-0 z-[1] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-fuchsia-500"
      />

      {slides.length > 1 && (
        <div className="pointer-events-none absolute left-1/2 top-2 z-[3] flex -translate-x-1/2 gap-[3px]">
          {slides.map((_, i) => (
            <i
              key={i}
              className={`block h-[2px] w-3 rounded-sm ${i === index ? "bg-white" : "bg-white/35"}`}
            />
          ))}
        </div>
      )}

      <div className="pointer-events-none absolute left-2 top-4 z-[3] flex items-center gap-[5px]">
        {p.availableNow && (
          <span
            title="Disponible ahora"
            className="h-2 w-2 rounded-full bg-emerald-400 shadow-[0_0_0_2px_rgba(52,211,153,0.25)]"
          />
        )}
        {tag}
      </div>

      <button
        type="button"
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          toggle(p.id);
        }}
        aria-label={isFavorite ? "Quitar de favoritas" : "Guardar en favoritas"}
        aria-pressed={isFavorite}
        className="absolute right-1.5 top-1.5 z-[3] grid h-7 w-7 place-items-center rounded-full bg-black/40 transition hover:bg-black/60"
      >
        <Star
          className={`h-[15px] w-[15px] ${isFavorite ? "fill-tier-gold text-tier-gold" : "text-white"}`}
          strokeWidth={2}
        />
      </button>

      {slides.length > 1 && (
        <>
          <button
            type="button"
            onClick={step(-1)}
            aria-label="Foto anterior"
            className={`${ARROW_CLASS} left-1.5`}
          >
            <ChevronLeft className="h-4 w-4" strokeWidth={2.5} />
          </button>
          <button
            type="button"
            onClick={step(1)}
            aria-label="Foto siguiente"
            className={`${ARROW_CLASS} right-1.5`}
          >
            <ChevronRight className="h-4 w-4" strokeWidth={2.5} />
          </button>
        </>
      )}

      <div className="pointer-events-none absolute inset-x-0 bottom-0 z-[2] px-2.5 pb-2">
        <div className="flex items-center gap-1">
          <span
            className={`truncate font-display font-bold uppercase leading-none tracking-[0.02em] [text-shadow:0_1px_6px_rgba(0,0,0,0.6)] ${
              large ? "text-[19px]" : "text-[15px]"
            }`}
          >
            {p.displayName}
            {p.age ? <span className="ml-1 font-semibold text-white/85">{p.age}</span> : null}
          </span>
          {hasVerifiedBadge(p.profileTags) && <VerifiedCheck />}
        </div>
        <div className="mt-0.5 text-[8.5px] font-bold uppercase tracking-[0.08em] text-fuchsia-300/90">
          {categoryLabel(p)}
        </div>
        {(p.city || p.nearestMetro) && (
          <div className="mt-px truncate text-[10px] text-white/55">
            {p.city && <b className="font-semibold text-white/85">{p.city}</b>}
            {p.city && p.nearestMetro ? " · " : null}
            {p.nearestMetro ? `Metro ${p.nearestMetro.name}` : null}
          </div>
        )}
      </div>
    </article>
  );
}
