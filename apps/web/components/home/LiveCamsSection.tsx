"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ChevronRight, Eye, Plus } from "lucide-react";

type Cam = {
  username: string;
  displayName: string;
  thumbnail: string;
  age: number | null;
  viewers: number;
  isHd: boolean;
};

const TRACK = "uzeed_home_cams_grid";
const WHITELABEL_BASE = "https://live.uzeed.cl";
const REFRESH_MS = 60_000;

function formatViewers(n: number): string {
  if (n >= 1000) {
    const k = n / 1000;
    return k >= 10 ? `${Math.round(k)}k` : `${k.toFixed(1)}k`;
  }
  return String(n);
}

function camHref(username: string): string {
  return `${WHITELABEL_BASE}/${encodeURIComponent(username)}/?track=${TRACK}`;
}

function bustCache(url: string, tick: number): string {
  return `${url}${url.includes("?") ? "&" : "?"}_t=${tick}`;
}

export default function LiveCamsSection() {
  const [cams, setCams] = useState<Cam[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    let cancelled = false;
    const controller = new AbortController();

    async function load() {
      try {
        const res = await fetch("/live-feed", {
          cache: "no-store",
          signal: controller.signal,
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        if (cancelled) return;
        const list: Cam[] = Array.isArray(data?.cams) ? data.cams : [];
        if (list.length === 0) {
          setFailed(true);
          return;
        }
        setCams(list);
        setTick((t) => t + 1);
        setFailed(false);
      } catch (err: any) {
        if (err?.name === "AbortError") return;
        if (!cancelled) setFailed(true);
      }
    }

    load();
    const id = setInterval(load, REFRESH_MS);
    return () => {
      cancelled = true;
      controller.abort();
      clearInterval(id);
    };
  }, []);

  if (failed || !cams || cams.length === 0) return null;

  return (
    <section className="mb-8">
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <span className="relative flex h-3 w-3">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-400 opacity-75" />
            <span className="relative inline-flex h-3 w-3 rounded-full bg-red-500" />
          </span>
          <h2 className="text-xl font-bold tracking-tight">Cams en Vivo</h2>
        </div>
        <Link
          href="/live"
          className="group flex items-center gap-1 text-xs font-medium text-white/40 transition-colors duration-200 hover:text-fuchsia-300"
        >
          Ver más
          <ChevronRight className="h-3.5 w-3.5 transition-transform duration-200 group-hover:translate-x-0.5" />
        </Link>
      </div>

      <div className="scrollbar-none -mx-4 flex gap-2.5 overflow-x-auto px-4 pb-2 snap-x snap-mandatory [scroll-padding-left:1rem] sm:mx-0 sm:grid sm:grid-cols-4 sm:overflow-visible sm:px-0 lg:grid-cols-5 xl:grid-cols-6">
        {cams.map((cam) => (
          <a
            key={cam.username}
            href={camHref(cam.username)}
            target="_blank"
            rel="noopener noreferrer sponsored"
            className="group relative w-[38vw] shrink-0 snap-start sm:w-auto"
          >
            <div className="relative aspect-[3/4] overflow-hidden rounded-2xl border border-white/[0.06] bg-[#0a0a10] transition-all duration-300 group-hover:-translate-y-0.5 group-hover:border-red-500/30 group-hover:shadow-[0_8px_28px_rgba(239,68,68,0.15)]">
              <img
                src={bustCache(cam.thumbnail, tick)}
                alt={cam.displayName}
                className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.04]"
                loading="lazy"
                decoding="async"
                referrerPolicy="no-referrer"
              />
              <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/85 via-black/15 to-transparent" />

              <div className="absolute left-2 top-2 flex items-center gap-1 rounded-md bg-red-600 px-1.5 py-0.5 shadow-md">
                <span className="relative flex h-1.5 w-1.5">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-white opacity-75" />
                  <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-white" />
                </span>
                <span className="text-[9px] font-bold tracking-wide text-white">EN VIVO</span>
              </div>

              {cam.isHd && (
                <div className="absolute right-2 top-2 rounded-md border border-fuchsia-300/30 bg-black/60 px-1.5 py-0.5 backdrop-blur-sm">
                  <span className="text-[9px] font-bold tracking-wide text-fuchsia-200">HD</span>
                </div>
              )}

              <div className="absolute right-2 bottom-2 flex items-center gap-1 rounded-md bg-black/70 px-1.5 py-0.5 backdrop-blur-sm">
                <Eye className="h-2.5 w-2.5 text-white/85" />
                <span className="text-[10px] font-semibold tabular-nums text-white">
                  {formatViewers(cam.viewers)}
                </span>
              </div>

              <div className="absolute inset-x-0 bottom-0 p-2.5">
                <div className="flex items-baseline gap-1.5">
                  <h3 className="truncate text-xs font-bold text-white">{cam.displayName}</h3>
                  {cam.age != null && (
                    <span className="text-[10px] font-medium tabular-nums text-white/55">{cam.age}</span>
                  )}
                </div>
              </div>
            </div>
          </a>
        ))}

        <Link
          href="/live"
          className="group relative w-[38vw] shrink-0 snap-start sm:w-auto"
        >
          <div className="flex aspect-[3/4] w-full flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-violet-400/40 bg-violet-500/[0.04] px-3 text-center transition-all duration-300 group-hover:-translate-y-0.5 group-hover:border-violet-300/70 group-hover:bg-violet-500/[0.10] group-hover:shadow-[0_8px_28px_rgba(139,92,246,0.18)]">
            <div className="flex h-10 w-10 items-center justify-center rounded-full border border-violet-400/30 bg-violet-500/15 transition-transform duration-300 group-hover:scale-110">
              <Plus className="h-5 w-5 text-violet-200" />
            </div>
            <span className="text-xs font-bold leading-tight text-violet-100">
              Ver todas las cams
            </span>
            <span className="text-[10px] text-violet-300/70">Miles disponibles</span>
          </div>
        </Link>
      </div>
    </section>
  );
}
