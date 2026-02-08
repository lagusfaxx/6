"use client";

import { resolveMediaUrl } from "../lib/api";

export default function Avatar({
  src,
  alt,
  size = 40,
  className = ""
}: {
  src?: string | null;
  alt?: string;
  size?: number;
  className?: string;
}) {
  const url = resolveMediaUrl(src || null);

  const style: React.CSSProperties = { width: size, height: size };

  return (
    <div
      style={style}
      className={`shrink-0 overflow-hidden rounded-full border border-white/10 bg-gradient-to-br from-white/10 via-white/5 to-transparent ${className}`}
      aria-label={alt || "avatar"}
    >
      {url ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={url} alt={alt || "avatar"} className="h-full w-full object-cover" />
      ) : (
        <div className="flex h-full w-full items-center justify-center">
          <svg width="55%" height="55%" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path
              d="M20 21a8 8 0 0 0-16 0"
              stroke="rgba(255,255,255,0.75)"
              strokeWidth="1.7"
              strokeLinecap="round"
            />
            <path
              d="M12 12a4 4 0 1 0-4-4 4 4 0 0 0 4 4Z"
              stroke="rgba(255,255,255,0.75)"
              strokeWidth="1.7"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <path
              d="M4 4l16 16"
              stroke="rgba(255,255,255,0.35)"
              strokeWidth="1.7"
              strokeLinecap="round"
            />
          </svg>
        </div>
      )}
    </div>
  );
}
