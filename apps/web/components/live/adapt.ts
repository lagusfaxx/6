/**
 * Adaptadores para llevar cualquiera de las dos fuentes (webrtc propio /
 * chaturbate) al modelo único `UnifiedLiveCard` que consumen las cards.
 */

import type { ExternalLiveCam } from "../../lib/chaturbate/types";
import type { UnifiedLiveCard } from "./types";

export interface UzeedLiveStreamLike {
  id: string;
  title: string | null;
  thumbnailUrl: string | null;
  isActive?: boolean;
  viewerCount: number;
  startedAt: string;
  host: {
    id: string;
    displayName: string;
    username: string;
    avatarUrl: string | null;
  };
}

export function adaptUzeedStream(stream: UzeedLiveStreamLike): UnifiedLiveCard {
  const display = stream.host.displayName || stream.host.username || "En vivo";
  return {
    source: "uzeed",
    id: stream.id,
    displayName: display,
    thumbnailUrl: stream.thumbnailUrl ?? stream.host.avatarUrl ?? null,
    avatarUrl: stream.host.avatarUrl ?? null,
    subtitle: stream.title ?? null,
    age: null,
    countryName: null,
    viewerCount: stream.viewerCount,
    isHd: false,
    isNew: false,
    startedAt: stream.startedAt,
    href: `/live/${stream.id}`,
    embedUrl: null,
  };
}

export function adaptExternalCam(cam: ExternalLiveCam): UnifiedLiveCard {
  // Subtítulo legible: "23 años · Colombia" / "Bogotá" / "Colombia"
  const parts: string[] = [];
  if (typeof cam.age === "number") parts.push(`${cam.age} años`);
  if (cam.countryName) parts.push(cam.countryName);
  else if (cam.location) parts.push(cam.location);
  const subtitle = parts.length ? parts.join(" · ") : null;

  return {
    source: "external",
    id: cam.username,
    displayName: cam.displayName,
    thumbnailUrl: cam.thumbnailUrlSmall || cam.thumbnailUrl,
    avatarUrl: null,
    subtitle,
    age: cam.age,
    countryName: cam.countryName,
    viewerCount: cam.viewerCount,
    isHd: cam.isHd,
    isNew: cam.isNew,
    startedAt: null,
    href: `/live/cam/${encodeURIComponent(cam.username)}`,
    embedUrl: cam.embedUrl,
  };
}

/**
 * Mezcla webrtc propios (priorizados) con externos hasta el límite.
 * - webrtc primero, en su orden original
 * - luego externos en su orden original
 * - de-duplica por id (no debería haber colisiones, pero por seguridad)
 */
export function mergeLives(
  uzeed: UnifiedLiveCard[],
  external: UnifiedLiveCard[],
  limit: number,
): UnifiedLiveCard[] {
  const out: UnifiedLiveCard[] = [];
  const seen = new Set<string>();

  for (const item of uzeed) {
    const key = `${item.source}:${item.id}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(item);
    if (out.length >= limit) return out;
  }
  for (const item of external) {
    const key = `${item.source}:${item.id}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(item);
    if (out.length >= limit) return out;
  }
  return out;
}
