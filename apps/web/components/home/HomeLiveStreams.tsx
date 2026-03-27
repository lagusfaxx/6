"use client";

import { useContext, useEffect, useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
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

export default function HomeLiveStreams() {
  const [liveStreams, setLiveStreams] = useState<any[]>([]);
  const locationCtx = useContext(LocationFilterContext);
  const location = locationCtx?.effectiveLocation ?? SANTIAGO_FALLBACK;
  const locationKey = `${location[0]}-${location[1]}`;

  useEffect(() => {
    const controller = new AbortController();
    apiFetch<{ streams: any[] }>("/live/active", { signal: controller.signal })
      .then((r) => setLiveStreams(r?.streams ?? []))
      .catch(() => {});
    return () => { controller.abort(); };
  }, [location]);

  if (!liveStreams.length) return null;

  return (
    <>
      <div className="mb-6 h-px bg-gradient-to-r from-transparent via-red-500/[0.1] to-transparent" />
      <motion.section key={`live-${locationKey}`} initial="hidden" whileInView="visible" viewport={{ margin: "-60px" }} variants={stagger} className="mb-10">
        <motion.div variants={cardFade} className="mb-4 flex items-center gap-2">
          <span className="relative flex h-3 w-3">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-400 opacity-75" />
            <span className="relative inline-flex h-3 w-3 rounded-full bg-red-500" />
          </span>
          <h2 className="text-xl font-bold">En Vivo Ahora</h2>
        </motion.div>
        <motion.div variants={cardFade} className="flex gap-3 overflow-x-auto pb-2 scrollbar-none">
          {liveStreams.map((s: any) => (
            <Link key={s.id} href={`/live/${s.id}`} className="group relative flex-shrink-0 w-40">
              <div className="relative aspect-[3/4] overflow-hidden rounded-2xl border border-red-500/25 bg-gradient-to-br from-fuchsia-900/40 to-violet-900/40 shadow-[0_0_24px_rgba(239,68,68,0.1)] group-hover:shadow-[0_0_32px_rgba(239,68,68,0.2)] transition-shadow duration-300">
                {s.host?.avatarUrl ? (
                  <img src={resolveMediaUrl(s.host.avatarUrl) ?? undefined} alt="" className="h-full w-full object-cover opacity-80 group-hover:opacity-100 transition" />
                ) : (
                  <div className="flex h-full w-full items-center justify-center text-3xl font-bold text-white/20">
                    {(s.host?.displayName || "?")[0]}
                  </div>
                )}
                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent" />
                <div className="absolute top-2 left-2 flex items-center gap-1 rounded-full bg-red-600/90 px-2 py-0.5 text-[10px] font-bold text-white">
                  <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-white" /> LIVE
                </div>
                <div className="absolute bottom-2 left-2 right-2">
                  <p className="text-xs font-semibold truncate">{s.host?.displayName || s.host?.username}</p>
                  {s.title && <p className="text-[10px] text-white/50 truncate">{s.title}</p>}
                  <p className="text-[10px] text-white/40 mt-0.5">{s.viewerCount} viendo</p>
                </div>
              </div>
            </Link>
          ))}
        </motion.div>
      </motion.section>
    </>
  );
}
