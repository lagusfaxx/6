"use client";

import Link from "next/link";
import { Crown } from "lucide-react";
import { resolveMediaUrl } from "../../lib/api";

export type DestacadaProfile = {
  id: string;
  displayName: string;
  avatarUrl?: string | null;
  coverUrl?: string | null;
  availableNow?: boolean;
};

type Props = {
  profiles: DestacadaProfile[];
  title?: string;
};

function profileImage(p: DestacadaProfile) {
  return (
    resolveMediaUrl(p.coverUrl) ??
    resolveMediaUrl(p.avatarUrl) ??
    "/brand/isotipo-new.png"
  );
}

export default function DestacadasGrid({
  profiles,
  title = "Destacadas",
}: Props) {
  if (!profiles.length) return null;

  return (
    <section className="mb-8">
      <div className="mb-3 flex items-center gap-2">
        <Crown className="h-5 w-5 text-amber-400" />
        <h2 className="text-2xl font-extrabold tracking-tight">{title}</h2>
      </div>
      <div className="grid grid-cols-2 gap-3">
        {profiles.map((p) => (
          <Link
            key={p.id}
            href={`/profesional/${p.id}`}
            className="group relative block overflow-hidden rounded-2xl border border-white/[0.08] bg-[#0c0a14]"
          >
            <div className="relative aspect-[3/4] overflow-hidden">
              <img
                src={profileImage(p)}
                alt={p.displayName}
                className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.04]"
                loading="lazy"
                decoding="async"
                onError={(e) => {
                  (e.currentTarget as HTMLImageElement).src =
                    "/brand/isotipo-new.png";
                }}
              />
              {p.availableNow && (
                <span className="absolute left-2.5 top-2.5 inline-flex h-2.5 w-2.5 rounded-full bg-emerald-400 shadow-[0_0_0_3px_rgba(0,0,0,0.45)]" />
              )}
              <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/85 via-black/20 to-transparent" />
              <div className="absolute inset-x-0 bottom-0 px-3 pb-3 pt-10 text-center">
                <h3 className="truncate text-base font-extrabold uppercase tracking-wide text-white">
                  {p.displayName}
                </h3>
              </div>
            </div>
          </Link>
        ))}
      </div>
    </section>
  );
}
