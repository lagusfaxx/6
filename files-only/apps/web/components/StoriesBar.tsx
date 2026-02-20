"use client";

import { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import { X } from "lucide-react";
import { apiFetch, resolveMediaUrl } from "../lib/api";

type Story = {
  id: string;
  mediaUrl: string;
  mediaType: "IMAGE" | "VIDEO";
  profile: {
    id: string;
    username: string;
    displayName: string | null;
    avatarUrl: string | null;
    planTier: string;
  };
  _count: { views: number };
};

export default function StoriesBar({ stories }: { stories: Story[] }) {
  const [activeIndex, setActiveIndex] = useState<number | null>(null);
  const active = useMemo(
    () => (activeIndex != null ? stories[activeIndex] || null : null),
    [activeIndex, stories],
  );

  useEffect(() => {
    if (activeIndex == null) return;
    const story = stories[activeIndex];
    if (!story) return;
    apiFetch(`/stories/${story.id}/view`, { method: "POST" }).catch(() => null);

    const timer = window.setTimeout(() => {
      setActiveIndex((prev) => {
        if (prev == null) return null;
        if (prev >= stories.length - 1) return null;
        return prev + 1;
      });
    }, 3500);
    return () => window.clearTimeout(timer);
  }, [activeIndex, stories]);

  if (!stories.length) return null;

  return (
    <>
      <div className="mb-5 overflow-x-auto">
        <div className="flex gap-3">
          {stories.map((story, i) => (
            <button
              key={story.id}
              type="button"
              className="shrink-0 rounded-2xl border border-white/15 bg-white/5 px-3 py-2 text-left"
              onClick={() => setActiveIndex(i)}
            >
              <div className="text-xs text-white/60">
                {story.profile.displayName || story.profile.username}
              </div>
              <div className="mt-1 text-[11px] text-white/40">
                {story._count.views} vistas
              </div>
            </button>
          ))}
        </div>
      </div>

      {active ? (
        <div className="fixed inset-0 z-[100] bg-black">
          <div className="absolute left-3 right-3 top-3 h-1 rounded-full bg-white/20">
            <div className="h-full w-full animate-[storyProgress_3.5s_linear] rounded-full bg-fuchsia-400" />
          </div>
          <button
            type="button"
            onClick={() => setActiveIndex(null)}
            className="absolute right-3 top-5 rounded-full border border-white/30 bg-black/40 p-2"
          >
            <X className="h-4 w-4" />
          </button>
          <div className="absolute left-3 top-5 text-xs text-white/90">
            {active.profile.displayName || active.profile.username}
          </div>

          <div className="relative h-full w-full">
            {active.mediaType === "VIDEO" ? (
              <video
                src={resolveMediaUrl(active.mediaUrl) ?? undefined}
                className="h-full w-full object-contain"
                autoPlay
                muted
                playsInline
              />
            ) : (
              <Image
                src={
                  resolveMediaUrl(active.mediaUrl) || "/brand/isotipo-new.png"
                }
                alt="Story"
                fill
                className="object-contain"
                sizes="100vw"
                priority
              />
            )}
          </div>
        </div>
      ) : null}

      <style jsx global>{`
        @keyframes storyProgress {
          from {
            width: 0%;
          }
          to {
            width: 100%;
          }
        }
      `}</style>
    </>
  );
}
