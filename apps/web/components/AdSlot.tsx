"use client";

import Image from "next/image";
import { useState } from "react";

type AdItem = {
  id: string;
  imageUrl: string;
  linkUrl?: string | null;
};

function AdCard({ ad, className }: { ad: AdItem; className?: string }) {
  const [failed, setFailed] = useState(false);
  if (failed) {
    return (
      <div
        className={`rounded-2xl border border-white/10 bg-white/5 p-4 text-xs text-white/60 ${className || ""}`}
      >
        Espacio publicitario
      </div>
    );
  }

  return (
    <a
      href={ad.linkUrl || "#"}
      target="_blank"
      rel="noreferrer"
      className={`block overflow-hidden rounded-2xl border border-white/10 bg-white/5 ${className || ""}`}
    >
      <div className="relative h-full min-h-[120px] w-full">
        <Image
          src={ad.imageUrl}
          alt="Publicidad"
          fill
          className="object-cover"
          sizes="(max-width: 768px) 100vw, 320px"
          onError={() => setFailed(true)}
          loading="lazy"
        />
      </div>
    </a>
  );
}

export function RightRailAds({ ads }: { ads: AdItem[] }) {
  if (!ads.length) return null;
  return (
    <aside className="hidden xl:block w-[280px] shrink-0 space-y-3">
      {ads.map((ad) => (
        <AdCard key={ad.id} ad={ad} className="h-[220px]" />
      ))}
    </aside>
  );
}

export function BottomAds({ ads }: { ads: AdItem[] }) {
  if (!ads.length) return null;
  return (
    <div className="mt-8 grid gap-2 sm:grid-cols-2">
      {ads.map((ad) => (
        <AdCard key={ad.id} ad={ad} className="h-[120px]" />
      ))}
    </div>
  );
}
