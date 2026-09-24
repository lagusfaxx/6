"use client";

import Link from "next/link";
import ProfileCard, { type HomeProfile } from "./ProfileCard";
import RowScroller from "./RowScroller";

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
  if (!profiles.length) return null;

  return (
    <section className="mb-8">
      <div className="mb-3 flex items-end justify-between gap-3">
        <h2 className="text-2xl font-extrabold tracking-tight">Novedades</h2>
      </div>

      <RowScroller className="-mx-4 snap-x snap-mandatory gap-4 px-4 pb-2 sm:mx-0 sm:px-0">
        {profiles.map((p) => (
          <div
            key={p.id}
            className="w-[88vw] max-w-[420px] shrink-0 snap-start sm:w-[60vw] md:w-[420px]"
          >
            <ProfileCard profile={p} aspect="aspect-[4/5]" large />
          </div>
        ))}
      </RowScroller>

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
