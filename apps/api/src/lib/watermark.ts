import sharp from "sharp";

/**
 * Watermark builder. Generates a semi-transparent "Uzeed.cl" badge as a PNG
 * buffer sized relative to the target image width. Results are cached per
 * bucketed width to avoid re-rendering the SVG for every upload.
 *
 * Visual: white bold text with a subtle dark stroke + drop shadow, ~18% of
 * the image width, placed with gravity "southeast" by the caller.
 */

const watermarkCache = new Map<number, Promise<Buffer>>();

function buildSvg(width: number, height: number): string {
  const fontSize = Math.round(height * 0.62);
  const strokeW = Math.max(1, Math.round(fontSize / 18));
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
  <defs>
    <filter id="shadow" x="-30%" y="-30%" width="160%" height="160%">
      <feGaussianBlur in="SourceAlpha" stdDeviation="${strokeW * 1.2}"/>
      <feOffset dx="0" dy="${Math.max(1, Math.round(strokeW / 2))}" result="offsetblur"/>
      <feComponentTransfer><feFuncA type="linear" slope="0.65"/></feComponentTransfer>
      <feMerge>
        <feMergeNode/>
        <feMergeNode in="SourceGraphic"/>
      </feMerge>
    </filter>
    <linearGradient id="wmGrad" x1="0%" y1="0%" x2="100%" y2="0%">
      <stop offset="0%" stop-color="#ffffff" stop-opacity="0.95"/>
      <stop offset="100%" stop-color="#f5d7ff" stop-opacity="0.95"/>
    </linearGradient>
  </defs>
  <text
    x="50%" y="50%"
    dominant-baseline="middle"
    text-anchor="middle"
    font-family="'Helvetica Neue', Arial, sans-serif"
    font-weight="900"
    font-size="${fontSize}"
    letter-spacing="${Math.round(fontSize * 0.02)}"
    fill="url(#wmGrad)"
    fill-opacity="0.55"
    stroke="#1a0033"
    stroke-opacity="0.35"
    stroke-width="${strokeW}"
    paint-order="stroke fill"
    filter="url(#shadow)"
  >Uzeed.cl</text>
</svg>`;
}

function bucketWidth(targetWidth: number): number {
  return Math.max(200, Math.round(targetWidth / 100) * 100);
}

/**
 * Build a watermark PNG buffer sized for an image of `targetWidth` px,
 * already padded with transparent space on the right/bottom so it has
 * breathing room from the image edge when composited with
 * `gravity: "southeast"`. Returns a cached Promise when the bucketed
 * width has been seen before.
 */
export function buildWatermark(targetWidth: number): Promise<Buffer> {
  const bucketed = bucketWidth(targetWidth);
  const cached = watermarkCache.get(bucketed);
  if (cached) return cached;

  const width = Math.round(bucketed * 0.22); // ~22% of image width
  const height = Math.round(width / 3.6); // ~3.6:1 aspect ratio
  const margin = Math.max(8, Math.round(bucketed * 0.015));
  const svg = buildSvg(width, height);
  const promise = sharp(Buffer.from(svg))
    .png()
    .toBuffer()
    .then((png) =>
      sharp(png)
        .extend({
          top: 0,
          left: 0,
          right: margin,
          bottom: margin,
          background: { r: 0, g: 0, b: 0, alpha: 0 },
        })
        .png()
        .toBuffer(),
    );
  watermarkCache.set(bucketed, promise);
  // If it fails, drop from cache so we try again next time
  promise.catch(() => watermarkCache.delete(bucketed));
  return promise;
}
