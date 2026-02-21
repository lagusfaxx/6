"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { resolveMediaUrl } from "../lib/api";
import { X } from "lucide-react";

type StoryProfile = {
  id: string;
  displayName: string | null;
  username: string;
  avatarUrl: string | null;
  coverUrl: string | null;
  availableNow?: boolean;
};

type Props = {
  profiles: StoryProfile[];
};

export default function Stories({ profiles }: Props) {
  const [viewingIndex, setViewingIndex] = useState<number | null>(null);
  const [progress, setProgress] = useState(0);

  const viewing = viewingIndex !== null ? profiles[viewingIndex] : null;

  useEffect(() => {
    if (viewingIndex === null) return;
    setProgress(0);
    const start = Date.now();
    const duration = 5000;
    let frame: number;
    const tick = () => {
      const elapsed = Date.now() - start;
      const pct = Math.min(elapsed / duration, 1);
      setProgress(pct);
      if (pct >= 1) {
        // next story or close
        if (viewingIndex < profiles.length - 1) {
          setViewingIndex(viewingIndex + 1);
        } else {
          setViewingIndex(null);
        }
        return;
      }
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [viewingIndex, profiles.length]);

  if (!profiles.length) return null;

  return (
    <>
      {/* Story circles */}
      <div className="scrollbar-none -mx-4 flex gap-3 overflow-x-auto px-4 py-2">
        {profiles.map((p, i) => {
          const avatar = resolveMediaUrl(p.avatarUrl) ?? "/brand/isotipo-new.png";
          return (
            <button
              key={p.id}
              type="button"
              onClick={() => setViewingIndex(i)}
              className="flex shrink-0 flex-col items-center gap-1"
            >
              <div className={`rounded-full p-[2px] ${p.availableNow ? "bg-gradient-to-br from-fuchsia-500 via-pink-500 to-violet-500" : "bg-gradient-to-br from-white/20 to-white/5"}`}>
                <div className="h-16 w-16 overflow-hidden rounded-full border-2 border-[#0e0e12] bg-white/5">
                  <img
                    src={avatar}
                    alt={p.displayName || p.username}
                    className="h-full w-full object-cover"
                    onError={(e) => {
                      (e.currentTarget as HTMLImageElement).src = "/brand/isotipo-new.png";
                    }}
                  />
                </div>
              </div>
              <span className="max-w-[72px] truncate text-[10px] text-white/60">
                {p.displayName || p.username}
              </span>
            </button>
          );
        })}
      </div>

      {/* Story viewer */}
      {viewing && viewingIndex !== null && (
        <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/95">
          {/* Progress bar */}
          <div className="absolute left-0 right-0 top-0 flex gap-1 p-2">
            {profiles.map((_, i) => (
              <div key={i} className="h-0.5 flex-1 overflow-hidden rounded-full bg-white/20">
                <div
                  className="h-full bg-white/80 transition-none"
                  style={{
                    width: i < viewingIndex ? "100%" : i === viewingIndex ? `${progress * 100}%` : "0%",
                  }}
                />
              </div>
            ))}
          </div>

          {/* Header */}
          <div className="absolute left-0 right-0 top-6 flex items-center gap-3 px-4">
            <div className="h-8 w-8 overflow-hidden rounded-full border border-white/20 bg-white/5">
              <img
                src={resolveMediaUrl(viewing.avatarUrl) ?? "/brand/isotipo-new.png"}
                alt=""
                className="h-full w-full object-cover"
              />
            </div>
            <span className="text-sm font-semibold">{viewing.displayName || viewing.username}</span>
            <button
              type="button"
              onClick={() => setViewingIndex(null)}
              className="ml-auto flex h-8 w-8 items-center justify-center rounded-full bg-white/10 text-white/80"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          {/* Story content */}
          <div className="relative h-[80vh] w-full max-w-sm overflow-hidden rounded-2xl">
            <img
              src={resolveMediaUrl(viewing.coverUrl) ?? resolveMediaUrl(viewing.avatarUrl) ?? "/brand/isotipo-new.png"}
              alt=""
              className="h-full w-full object-cover"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />
            <div className="absolute bottom-6 left-4 right-4">
              <Link
                href={`/profesional/${viewing.id}`}
                onClick={() => setViewingIndex(null)}
                className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-fuchsia-600 to-violet-600 px-5 py-3 text-sm font-semibold transition hover:brightness-110"
              >
                Ver perfil
              </Link>
            </div>
          </div>

          {/* Tap zones */}
          <button
            type="button"
            onClick={() => setViewingIndex(Math.max(0, viewingIndex - 1))}
            className="absolute left-0 top-0 h-full w-1/3"
            aria-label="Anterior"
          />
          <button
            type="button"
            onClick={() => {
              if (viewingIndex < profiles.length - 1) {
                setViewingIndex(viewingIndex + 1);
              } else {
                setViewingIndex(null);
              }
            }}
            className="absolute right-0 top-0 h-full w-1/3"
            aria-label="Siguiente"
          />
        </div>
      )}
    </>
  );
}
