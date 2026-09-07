"use client";

import { useMemo } from "react";

type WatermarkSize = "sm" | "md" | "lg";

const PRESETS: Record<WatermarkSize, { font: number; gapX: number; gapY: number; opacity: number }> = {
  sm: { font: 10, gapX: 34, gapY: 46, opacity: 0.5 },
  md: { font: 14, gapX: 48, gapY: 62, opacity: 0.55 },
  lg: { font: 18, gapX: 60, gapY: 80, opacity: 0.6 },
};

/**
 * Builds a seamless, tileable SVG (as a data URI) with the watermark text
 * repeated in two staggered rows.
 */
function buildTile(text: string, font: number, gapX: number, gapY: number): { url: string; width: number; height: number } {
  // Rough advance width for a bold sans-serif at this size + letter-spacing.
  const letterSpacing = font * 0.12;
  const textWidth = Math.round(text.length * font * 0.62 + text.length * letterSpacing);
  const width = textWidth + gapX;
  const height = gapY * 2;
  const stroke = Math.max(1, font * 0.16);

  const common =
    `font-family="Helvetica,Arial,system-ui,sans-serif" font-size="${font}" font-weight="700" ` +
    `letter-spacing="${letterSpacing.toFixed(2)}" fill="rgba(255,255,255,0.5)" ` +
    `stroke="rgba(0,0,0,0.35)" stroke-width="${stroke.toFixed(2)}" paint-order="stroke" ` +
    `dominant-baseline="middle"`;

  // Row 1 is drawn twice (at x=0 and x=width) so the horizontal seam is clean;
  // row 2 is offset by half a tile to create the diamond/staggered pattern.
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">` +
    `<text x="0" y="${gapY * 0.5}" ${common}>${text}</text>` +
    `<text x="${-width / 2}" y="${gapY * 1.5}" ${common}>${text}</text>` +
    `<text x="${width / 2}" y="${gapY * 1.5}" ${common}>${text}</text>` +
    `</svg>`;

  return {
    url: `url("data:image/svg+xml,${encodeURIComponent(svg)}")`,
    width,
    height,
  };
}

type Props = {
  /** Density of the pattern. Use "sm" on cards, "md" on galleries, "lg" on the lightbox. */
  size?: WatermarkSize;
  /** Watermark text. Defaults to the UZEED verification mark. */
  text?: string;
  /** Rotation of the pattern, in degrees. */
  angle?: number;
  className?: string;
};

/**
 * Full-surface, repeating watermark for photos of admin-verified profiles.
 *
 * It signals the profile is verified and makes the photo far less useful to
 * anyone who tries to steal it. Rendered as a rotated, oversized layer inside
 * an `overflow-hidden` box so the diagonal tiling has no visible seams.
 *
 * The parent element must be positioned (`relative`) and clip its content.
 */
export default function VerifiedWatermark({
  size = "md",
  text = "UZEED ✓ VERIFICADA",
  angle = -30,
  className = "",
}: Props) {
  const preset = PRESETS[size];
  const tile = useMemo(
    () => buildTile(text, preset.font, preset.gapX, preset.gapY),
    [text, preset.font, preset.gapX, preset.gapY],
  );

  return (
    <div
      aria-hidden="true"
      className={`pointer-events-none absolute inset-0 z-[2] select-none overflow-hidden ${className}`}
    >
      <div
        className="absolute"
        style={{
          top: "-75%",
          left: "-75%",
          width: "250%",
          height: "250%",
          transform: `rotate(${angle}deg)`,
          backgroundImage: tile.url,
          backgroundRepeat: "repeat",
          backgroundSize: `${tile.width}px ${tile.height}px`,
          opacity: preset.opacity,
        }}
      />
    </div>
  );
}
