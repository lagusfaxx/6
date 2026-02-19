"use client";

import { useMemo, useState } from "react";
import { resolveMediaUrl } from "../lib/api";

type MediaItem = { url: string; type: "IMAGE" | "VIDEO" };

export function MediaPreview({
  item,
  alt,
  paywalled,
  className = "",
  muted = true,
  controls = false,
  onToggleMute
}: {
  item: MediaItem | null;
  alt?: string;
  paywalled?: boolean;
  className?: string;
  muted?: boolean;
  controls?: boolean;
  onToggleMute?: () => void;
}) {
  const [broken, setBroken] = useState(false);
  const src = useMemo(() => (item ? resolveMediaUrl(item.url) : null), [item]);

  if (!item || !src || broken) {
    return (
      <div
        className={`relative overflow-hidden rounded-2xl border border-white/10 bg-gradient-to-br from-white/10 via-white/5 to-transparent ${className}`}
      >
        <div className="absolute inset-0 bg-[radial-gradient(800px_420px_at_20%_10%,rgba(168,85,247,0.20),transparent_60%),radial-gradient(700px_380px_at_80%_0%,rgba(14,165,233,0.16),transparent_55%)]" />
        <div className="relative flex h-full w-full items-center justify-center p-6 text-center">
          <div className="max-w-[280px]">
            <div className="text-sm font-semibold text-white">Contenido no disponible</div>
            <div className="mt-1 text-xs text-white/60">Si el problema persiste, vuelve a intentar.</div>
          </div>
        </div>
      </div>
    );
  }

  const overlay = paywalled ? (
    <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/35 text-center">
      <div className="text-sm font-semibold">Contenido exclusivo</div>
      <div className="mt-1 text-xs text-white/70">Suscríbete para desbloquear</div>
    </div>
  ) : null;

  if (item.type === "VIDEO") {
    return (
      <div className={`relative overflow-hidden rounded-2xl border border-white/10 bg-black ${className}`}>
        <video
          src={src}
          className={`h-full w-full object-cover ${paywalled ? "blur-lg scale-105" : ""}`}
          muted={muted}
          playsInline
          loop
          controls={controls && !paywalled}
          onError={() => setBroken(true)}
        />
        {overlay}
        {onToggleMute ? (
          <button
            type="button"
            onClick={onToggleMute}
            className="absolute right-3 top-3 rounded-full border border-white/20 bg-black/40 px-3 py-1 text-[11px] text-white/90"
          >
            {muted ? "Sonido" : "Silenciar"}
          </button>
        ) : null}
      </div>
    );
  }

  return (
    <div className={`relative overflow-hidden rounded-2xl border border-white/10 bg-black/20 ${className}`}>
      <img
        src={src}
        alt={alt || "media"}
        className={`h-full w-full object-cover ${paywalled ? "blur-lg scale-105" : ""}`}
        onError={() => setBroken(true)}
      />
      {overlay}
    </div>
  );
}
