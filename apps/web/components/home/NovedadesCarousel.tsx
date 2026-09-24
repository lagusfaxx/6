"use client";

import Link from "next/link";
import { useRef } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import ProfileCard, { type HomeProfile } from "./ProfileCard";

export type NovedadProfile = HomeProfile;

type Props = {
  profiles: NovedadProfile[];
  ctaHref?: string;
  ctaLabel?: string;
};

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
          <div
            key={p.id}
            data-novedad-card
            className="w-[88vw] max-w-[420px] shrink-0 snap-start sm:w-[60vw] md:w-[420px]"
          >
            <ProfileCard profile={p} aspect="aspect-[4/5]" large />
          </div>
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
