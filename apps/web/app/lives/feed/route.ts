/**
 * Route handler que entrega el feed de cams externas al cliente.
 * Importante: la URL `/api/*` se rewrite-ea al backend Express, por eso
 * este endpoint vive bajo `/lives/feed`, fuera del prefijo `/api`.
 *
 * - Server-side only: toca el wm de afiliado y la IP real del visitante.
 * - Las respuestas del cliente nunca incluyen el wm ni la IP.
 * - Caché: 60s in-memory por país + filtros (lib/chaturbate/cache.ts).
 */

import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

import { fetchExternalCams } from "../../../lib/chaturbate/api";
import type {
  ChaturbateGender,
  ChaturbateRegion,
  LivesFeedResponse,
} from "../../../lib/chaturbate/types";
import { getGeoFromHeaders } from "../../../lib/geo";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const VALID_GENDERS: ReadonlySet<ChaturbateGender> = new Set([
  "f",
  "m",
  "c",
  "t",
  "s",
]);
const VALID_REGIONS: ReadonlySet<ChaturbateRegion> = new Set([
  "northamerica",
  "southamerica",
  "centralamerica",
  "europe_russia",
  "asia",
  "other",
]);

function clampLimit(raw: string | null, fallback: number, max: number): number {
  const n = raw ? parseInt(raw, 10) : NaN;
  if (!Number.isFinite(n) || n <= 0) return fallback;
  return Math.min(n, max);
}

function parseGender(raw: string | null): ChaturbateGender | undefined {
  if (!raw) return undefined;
  const lower = raw.toLowerCase();
  return VALID_GENDERS.has(lower as ChaturbateGender)
    ? (lower as ChaturbateGender)
    : undefined;
}

function parseRegion(raw: string | null): ChaturbateRegion | undefined {
  if (!raw) return undefined;
  const lower = raw.toLowerCase();
  return VALID_REGIONS.has(lower as ChaturbateRegion)
    ? (lower as ChaturbateRegion)
    : undefined;
}

export async function GET(req: NextRequest): Promise<NextResponse<LivesFeedResponse>> {
  const { searchParams } = new URL(req.url);
  const { ip, country } = getGeoFromHeaders(req.headers);

  // Defaults: mujeres latinas en HD, 60 rooms — afinados para audiencia chilena.
  const gender = parseGender(searchParams.get("gender")) ?? "f";
  const region = parseRegion(searchParams.get("region")) ?? "southamerica";
  const hdParam = searchParams.get("hd");
  const hd = hdParam === null ? true : hdParam === "true" || hdParam === "1";
  const limit = clampLimit(searchParams.get("limit"), 60, 120);
  const tag = searchParams.get("tag")?.trim() || undefined;

  const { cams, cached } = await fetchExternalCams({
    clientIp: ip ?? "request_ip",
    countryCode: country ?? "ZZ",
    gender,
    region,
    hd,
    limit,
    tag,
  });

  const body: LivesFeedResponse = {
    cams,
    count: cams.length,
    cached,
    country,
  };

  return NextResponse.json(body, {
    headers: {
      // Compartido entre visitantes del mismo país — coordina con el TTL
      // del cache interno (60s).
      "Cache-Control": "public, max-age=0, s-maxage=60, stale-while-revalidate=120",
    },
  });
}
