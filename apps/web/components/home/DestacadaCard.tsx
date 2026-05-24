"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { resolveMediaUrl } from "../../lib/api";

export type DestacadaCardProfile = {
  id: string;
  displayName: string;
  avatarUrl?: string | null;
  coverUrl?: string | null;
  availableNow?: boolean;
};

export type FeaturedStoryMedia = {
  id: string;
  mediaUrl: string;
  mediaType: "IMAGE" | "VIDEO" | string;
};

type Props = {
  profile: DestacadaCardProfile;
  stories: FeaturedStoryMedia[];
};

const COVER_DURATION_MS = 3000;
const IMAGE_DURATION_MS = 4000;
const VIDEO_FALLBACK_MS = 8000;

type Slide =
  | { kind: "cover"; url: string }
  | { kind: "image"; url: string; storyId: string }
  | { kind: "video"; url: string; storyId: string };

function coverImage(p: DestacadaCardProfile): string {
  return (
    resolveMediaUrl(p.coverUrl) ??
    resolveMediaUrl(p.avatarUrl) ??
    "/brand/isotipo-new.png"
  );
}

function buildSlides(p: DestacadaCardProfile, stories: FeaturedStoryMedia[]): Slide[] {
  const cover: Slide = { kind: "cover", url: coverImage(p) };
  if (!stories?.length) return [cover];

  const mediaSlides: Slide[] = [];
  for (const s of stories) {
    const url = resolveMediaUrl(s.mediaUrl);
    if (!url) continue;
    mediaSlides.push(
      String(s.mediaType).toUpperCase() === "VIDEO"
        ? { kind: "video", url, storyId: s.id }
        : { kind: "image", url, storyId: s.id },
    );
  }
  if (!mediaSlides.length) return [cover];
  return [cover, ...mediaSlides];
}

export default function DestacadaCard({ profile, stories }: Props) {
  const slides = buildSlides(profile, stories);
  const hasRotation = slides.length > 1;

  const [index, setIndex] = useState(0);
  const [inView, setInView] = useState(false);
  const [reduceMotion, setReduceMotion] = useState(false);
  const containerRef = useRef<HTMLAnchorElement | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Respect user prefers-reduced-motion
  useEffect(() => {
    if (typeof window === "undefined" || !window.matchMedia) return;
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setReduceMotion(mq.matches);
    update();
    mq.addEventListener?.("change", update);
    return () => mq.removeEventListener?.("change", update);
  }, []);

  // Observe viewport visibility — only rotate when the card is visible
  useEffect(() => {
    if (!hasRotation) return;
    const node = containerRef.current;
    if (!node || typeof IntersectionObserver === "undefined") {
      setInView(true);
      return;
    }
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) setInView(e.isIntersecting);
      },
      { threshold: 0.4 },
    );
    io.observe(node);
    return () => io.disconnect();
  }, [hasRotation]);

  // Advance slides while in view (paused otherwise)
  useEffect(() => {
    if (!hasRotation || !inView || reduceMotion) {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
      return;
    }
    const current = slides[index];
    // Videos advance via onEnded; we set a safety fallback just in case
    const duration =
      current.kind === "cover"
        ? COVER_DURATION_MS
        : current.kind === "image"
          ? IMAGE_DURATION_MS
          : VIDEO_FALLBACK_MS;
    timerRef.current = setTimeout(() => {
      setIndex((i) => (i + 1) % slides.length);
    }, duration);
    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [index, inView, hasRotation, reduceMotion, slides]);

  // Reset rotation state if the slide list changes (eg stories fetched after mount)
  useEffect(() => {
    setIndex(0);
  }, [stories.length]);

  // Ensure videos play/pause with visibility
  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    if (inView && slides[index]?.kind === "video" && !reduceMotion) {
      v.play().catch(() => {
        // Autoplay blocked — move on
        setIndex((i) => (i + 1) % slides.length);
      });
    } else {
      try {
        v.pause();
      } catch {}
    }
  }, [index, inView, slides, reduceMotion]);

  const current = slides[reduceMotion ? 0 : index] ?? slides[0];
  const fallbackCover = coverImage(profile);

  return (
    <Link
      ref={containerRef}
      href={`/profesional/${profile.id}`}
      className="group relative block overflow-hidden rounded-2xl border border-white/[0.08] bg-[#0c0a14]"
    >
      <div className="relative aspect-[3/4] overflow-hidden">
        {/* Cover image always rendered underneath for instant paint + fallback */}
        <img
          src={fallbackCover}
          alt={profile.displayName}
          className="absolute inset-0 h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.04]"
          loading="lazy"
          decoding="async"
          onError={(e) => {
            (e.currentTarget as HTMLImageElement).src = "/brand/isotipo-new.png";
          }}
        />

        {/* Rotated story media (image or video) on top, fades in/out */}
        {hasRotation && current.kind !== "cover" && (
          <div
            key={`${current.kind}-${(current as any).storyId}`}
            className="absolute inset-0 animate-fade-in"
          >
            {current.kind === "image" ? (
              <img
                src={current.url}
                alt=""
                aria-hidden="true"
                className="h-full w-full object-cover"
                loading="lazy"
                decoding="async"
                onError={() =>
                  setIndex((i) => (i + 1) % slides.length)
                }
              />
            ) : (
              <video
                ref={videoRef}
                src={current.url}
                className="h-full w-full object-cover"
                muted
                playsInline
                preload="metadata"
                onEnded={() =>
                  setIndex((i) => (i + 1) % slides.length)
                }
                onError={() =>
                  setIndex((i) => (i + 1) % slides.length)
                }
              />
            )}
          </div>
        )}

        {profile.availableNow && (
          <span className="absolute left-2.5 top-2.5 inline-flex h-2.5 w-2.5 rounded-full bg-emerald-400 shadow-[0_0_0_3px_rgba(0,0,0,0.45)] z-10" />
        )}

        {/* Tiny progress dots when rotating */}
        {hasRotation && slides.length > 1 && (
          <div className="pointer-events-none absolute left-2 right-2 top-1.5 z-10 flex gap-1">
            {slides.map((_, i) => (
              <span
                key={i}
                className={`h-0.5 flex-1 rounded-full transition-colors ${
                  i === index ? "bg-white/90" : "bg-white/25"
                }`}
              />
            ))}
          </div>
        )}

        <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/85 via-black/20 to-transparent" />
        <div className="absolute inset-x-0 bottom-0 px-3 pb-3 pt-10 text-center">
          <h3 className="truncate text-base font-extrabold uppercase tracking-wide text-white">
            {profile.displayName}
          </h3>
        </div>
      </div>
    </Link>
  );
}
