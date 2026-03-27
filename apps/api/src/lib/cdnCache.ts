import type { Request, Response, NextFunction } from "express";

/**
 * Middleware that sets CDN-friendly Cache-Control headers for public GET
 * responses. Works with Cloudflare, Fastly, or any RFC 7234–compliant CDN.
 *
 * - `s-maxage` controls how long the CDN caches the response (edge).
 * - `max-age=0` ensures browsers always revalidate with the CDN.
 * - `stale-while-revalidate` lets the CDN serve stale content while fetching
 *   a fresh copy in the background (prevents thundering-herd on expiry).
 *
 * @param edgeTtl  Seconds the CDN may cache the response (default 60)
 * @param swr      Seconds the CDN may serve stale while revalidating (default 120)
 */
export function cdnCache(edgeTtl = 60, swr = 120) {
  return (_req: Request, res: Response, next: NextFunction) => {
    res.setHeader(
      "Cache-Control",
      `public, max-age=0, s-maxage=${edgeTtl}, stale-while-revalidate=${swr}`
    );
    res.setHeader("Vary", "Accept, Accept-Encoding");
    next();
  };
}
