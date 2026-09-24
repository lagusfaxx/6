"use client";

import Link from "next/link";
import { useRef } from "react";
import { ChevronLeft, ChevronRight, MapPin } from "lucide-react";
import { resolveMediaUrl } from "../../lib/api";

export type NovedadProfile = {
  id: string;
  displayName: string;
  city?: string | null;
  avatarUrl?: string | null;
  coverUrl?: string | null;
  availableNow?: boolean;
};

type Props = {
  profiles: NovedadProfile[];
  ctaHref?: string;
  ctaLabel?: string;
};

function profileImage(p: NovedadProfile) {
  return (
    resolveMediaUrl(p.coverUrl) ??
    resolveMediaUrl(p.avatarUrl) ??
    "/brand/isotipo-new.png"
  );
}

export default function NovedadesCarousel({
  profiles,
  ctaHref = "/escorts?sort=new",
  ctaLabel = "Descubre todas las novedades",
}: Props) {
  const scrollerRef = useRef<HTMLDivElement>(null);

  function scrollBy(dir: 1 | -1) {
    const el = scrollerRef.current;
    if (!el) return;
    const card = el.querySelector<HTMLElement>("[data-novedad-card]");
    const step = card ? card.offsetWidth + 16 : el.clientWidth * 0.85;
    el.scrollBy({ left: dir * step, behavior: "smooth" });
  }

  if (!profiles.length) return null;

  return (
    <section className="mb-8">
      <div className="mb-3 flex items-end justify-between gap-3">
        <h2 className="text-2xl font-extrabold tracking-tight">Novedades</h2>
        <div className="hidden gap-2 sm:flex">
          <button
            type="button"
            aria-label="Anterior"
            onClick={() => scrollBy(-1)}
            className="grid h-9 w-9 place-items-center rounded-full border border-white/[0.08] bg-white/[0.03] text-white/60 transition hover:border-fuchsia-500/30 hover:text-white"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <button
            type="button"
            aria-label="Siguiente"
            onClick={() => scrollBy(1)}
            className="grid h-9 w-9 place-items-center rounded-full border border-white/[0.08] bg-white/[0.03] text-white/60 transition hover:border-fuchsia-500/30 hover:text-white"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      </div>

      <div
        ref={scrollerRef}
        className="scrollbar-none -mx-4 flex snap-x snap-mandatory gap-4 overflow-x-auto px-4 pb-2 sm:mx-0 sm:px-0"
      >
        {profiles.map((p) => (
          <Link
            key={p.id}
            href={`/profesional/${p.id}`}
            data-novedad-card
            className="group relative block w-[88vw] max-w-[420px] shrink-0 snap-start overflow-hidden rounded-3xl border border-white/[0.08] bg-[#0c0a14] sm:w-[60vw] md:w-[420px]"
          >
            <div className="relative aspect-[4/5] overflow-hidden">
              <img
                src={profileImage(p)}
                alt={p.displayName}
                className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.03]"
                loading="lazy"
                decoding="async"
                onError={(e) => {
                  (e.currentTarget as HTMLImageElement).src =
                    "/brand/isotipo-new.png";
                }}
              />
              {p.availableNow && (
                <span className="absolute left-3 top-3 inline-flex h-3 w-3 rounded-full bg-emerald-400 shadow-[0_0_0_3px_rgba(0,0,0,0.45)]" />
              )}
              <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/85 via-black/20 to-transparent" />
              <div className="absolute inset-x-0 bottom-0 px-4 pb-4 pt-16 text-center">
                <h3 className="text-2xl font-extrabold uppercase tracking-wide text-white">
                  {p.displayName}
                </h3>
                <div className="mt-1 text-sm font-semibold text-fuchsia-400">
                  Nueva
                </div>
                {p.city && (
                  <div className="mt-1 inline-flex items-center gap-1 text-sm text-white/70">
                    <MapPin className="h-3.5 w-3.5" />
                    {p.city}
                  </div>
                )}
              </div>
            </div>
          </Link>
        ))}
      </div>

      <div className="mt-4 flex justify-center">
        <Link
          href={ctaHref}
          className="rounded-2xl border border-white/[0.10] bg-white/[0.03] px-5 py-2.5 text-sm font-medium text-white/75 transition hover:border-fuchsia-500/30 hover:bg-white/[0.06] hover:text-white"
        >
          {ctaLabel}
        </Link>
      </div>
    </section>
  );
}
