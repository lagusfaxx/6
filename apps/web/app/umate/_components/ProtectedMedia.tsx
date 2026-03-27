"use client";

import { useCallback, useEffect, useRef, useState } from "react";

type Props = {
  /** The viewer's username — rendered as watermark to deter leaks */
  viewerUsername?: string;
  /** Whether this content should be protected (premium content) */
  enabled?: boolean;
  children: React.ReactNode;
  className?: string;
};

/**
 * Wraps media content with anti-screenshot/screen-recording protection.
 *
 * Measures applied:
 * 1. Diagonal watermark overlay with the viewer's username
 * 2. Disable right-click, drag, long-press on images/videos
 * 3. Blur content when tab loses focus (screen recording detection)
 * 4. CSS user-select: none, -webkit-touch-callout: none
 * 5. Invisible watermark layer that appears in screenshots
 */
export default function ProtectedMedia({
  viewerUsername,
  enabled = true,
  children,
  className = "",
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [blurred, setBlurred] = useState(false);

  // Blur content when page loses visibility (alt-tab, screen recording)
  useEffect(() => {
    if (!enabled) return;

    const handleVisibility = () => {
      if (document.visibilityState === "hidden") {
        setBlurred(true);
      } else {
        // Small delay before unblurring to catch quick screenshot attempts
        setTimeout(() => setBlurred(false), 300);
      }
    };

    const handleBlur = () => setBlurred(true);
    const handleFocus = () => setTimeout(() => setBlurred(false), 200);

    document.addEventListener("visibilitychange", handleVisibility);
    window.addEventListener("blur", handleBlur);
    window.addEventListener("focus", handleFocus);

    return () => {
      document.removeEventListener("visibilitychange", handleVisibility);
      window.removeEventListener("blur", handleBlur);
      window.removeEventListener("focus", handleFocus);
    };
  }, [enabled]);

  // Block right-click and drag on media elements
  const handleContextMenu = useCallback(
    (e: React.MouseEvent) => {
      if (!enabled) return;
      const target = e.target as HTMLElement;
      if (
        target.tagName === "IMG" ||
        target.tagName === "VIDEO" ||
        target.closest("[data-protected]")
      ) {
        e.preventDefault();
      }
    },
    [enabled],
  );

  const handleDragStart = useCallback(
    (e: React.DragEvent) => {
      if (!enabled) return;
      e.preventDefault();
    },
    [enabled],
  );

  if (!enabled) {
    return <div className={className}>{children}</div>;
  }

  const watermarkText = viewerUsername
    ? `@${viewerUsername}`
    : "";

  return (
    <div
      ref={containerRef}
      data-protected
      className={`umate-protected relative ${className}`}
      onContextMenu={handleContextMenu}
      onDragStart={handleDragStart}
      style={{
        WebkitUserSelect: "none",
        userSelect: "none",
        WebkitTouchCallout: "none",
      } as React.CSSProperties}
    >
      {/* Actual content */}
      <div
        className={`transition-all duration-300 ${
          blurred ? "blur-xl scale-105 brightness-50" : ""
        }`}
      >
        {children}
      </div>

      {/* Watermark overlay — visible in screenshots */}
      {watermarkText && (
        <div
          className="pointer-events-none absolute inset-0 z-10 overflow-hidden"
          aria-hidden="true"
        >
          <div className="umate-watermark-grid absolute inset-[-50%] flex flex-wrap items-center justify-center gap-x-16 gap-y-10"
            style={{ transform: "rotate(-25deg)" }}
          >
            {Array.from({ length: 30 }).map((_, i) => (
              <span
                key={i}
                className="whitespace-nowrap text-[11px] font-medium tracking-wider text-white/[0.06]"
              >
                {watermarkText}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Blur overlay message */}
      {blurred && (
        <div className="absolute inset-0 z-20 flex items-center justify-center">
          <div className="rounded-xl bg-black/80 px-6 py-4 text-center backdrop-blur-sm">
            <p className="text-sm font-bold text-white/80">
              Contenido protegido
            </p>
            <p className="mt-1 text-[11px] text-white/40">
              Vuelve a la ventana para ver el contenido
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
