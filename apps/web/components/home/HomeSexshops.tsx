"use client";

import { useContext, useEffect, useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { ChevronRight, MapPin, ShoppingBag } from "lucide-react";
import { apiFetch, resolveMediaUrl } from "../../lib/api";
import { LocationFilterContext } from "../../hooks/useLocationFilter";

const cardFade = {
  hidden: { opacity: 0, y: 16 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.4, ease: [0.16, 1, 0.3, 1] },
  },
};

const stagger = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.08 } },
};

const SANTIAGO_FALLBACK: [number, number] = [-33.45, -70.66];

export default function HomeSexshops() {
  const [sexshops, setSexshops] = useState<any[]>([]);
  const locationCtx = useContext(LocationFilterContext);
  const location = locationCtx?.effectiveLocation ?? SANTIAGO_FALLBACK;
  const locationKey = `${location[0]}-${location[1]}`;

  useEffect(() => {
    const controller = new AbortController();
    const params = new URLSearchParams({ entityType: "shop", categorySlug: "sexshop", sort: "near", limit: "8" });
    if (location) {
      params.set("lat", String(location[0]));
      params.set("lng", String(location[1]));
      params.set("radiusKm", "100");
    }
    apiFetch<{ results: any[]; total: number }>(
      `/directory/search?${params.toString()}`,
      { signal: controller.signal },
    )
      .then((res) => setSexshops(res?.results ?? []))
      .catch(() => {});
    return () => { controller.abort(); };
  }, [location]);

  if (!sexshops.length) return null;

  return (
    <motion.section key={`sexshop-${locationKey}`} initial="hidden" whileInView="visible" viewport={{ margin: "-60px" }} variants={stagger} className="mb-10">
      <motion.div variants={cardFade} className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <ShoppingBag className="h-4 w-4 text-pink-400" />
          <h2 className="text-xl font-bold tracking-tight">Sex Shop</h2>
        </div>
        <Link href="/sexshop" className="group flex items-center gap-1 text-xs font-medium text-white/40 hover:text-pink-400 transition-colors duration-200">
          Ver todos <ChevronRight className="h-3.5 w-3.5 transition-transform duration-200 group-hover:translate-x-0.5" />
        </Link>
      </motion.div>
      <div className="scrollbar-none -mx-4 flex gap-3 overflow-x-auto px-4 pb-2 snap-x snap-mandatory sm:mx-0 sm:grid sm:grid-cols-2 sm:overflow-visible sm:px-0 md:grid-cols-3 lg:grid-cols-4">
        {sexshops.map((item) => (
          <motion.article key={item.id} variants={cardFade} className="uzeed-premium-card group w-[68vw] shrink-0 snap-start sm:w-auto" style={{ borderColor: "rgba(236,72,153,0.1)" }}>
            <Link href={`/sexshop/${item.username || item.id}`} className="block">
              <div className="uzeed-card-shimmer relative aspect-[4/3] overflow-hidden rounded-[inherit] bg-[#0a0a10]">
                {(item.coverUrl || item.avatarUrl) ? (
                  <img
                    src={resolveMediaUrl(item.coverUrl || item.avatarUrl) ?? undefined}
                    alt={item.displayName}
                    className="uzeed-card-img h-full w-full object-cover"
                    onError={(e) => { (e.currentTarget as HTMLImageElement).src = "/brand/isotipo-new.png"; }}
                  />
                ) : (
                  <div className="flex h-full items-center justify-center"><ShoppingBag className="h-10 w-10 text-white/[0.06]" /></div>
                )}
                {item.distance != null && (
                  <div className="absolute right-2 top-2 z-[3] flex items-center gap-1 rounded-lg border border-white/[0.08] bg-black/40 px-2 py-0.5 text-[10px] text-white/70 backdrop-blur-xl tabular-nums">
                    <MapPin className="h-3 w-3 text-pink-400/60" /> {item.distance.toFixed(1)} km
                  </div>
                )}
                <div className="uzeed-card-gradient-subtle absolute inset-0" />
                <div className="absolute bottom-0 left-0 right-0 p-3 z-[3]">
                  <h3 className="truncate text-sm font-bold">{item.displayName || item.username}</h3>
                  {item.city && <p className="mt-0.5 text-[10px] text-white/40 flex items-center gap-1"><MapPin className="h-2.5 w-2.5 text-pink-400/50" />{item.city}</p>}
                </div>
              </div>
            </Link>
          </motion.article>
        ))}
      </div>
    </motion.section>
  );
}
