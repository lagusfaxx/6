/**
 * Wrapper server-side al API público de afiliados de Chaturbate.
 * Nada de este archivo debe importarse desde un componente cliente:
 * el wm de afiliado y la IP del visitante no salen del server.
 */

import {
  buildCacheKey,
  getCached,
  setCached,
  withInflight,
} from "./cache";
import { toExternalLiveCam } from "./transform";
import type {
  ChaturbateApiResponse,
  ChaturbateFetchInput,
  ChaturbateFilters,
  ChaturbateRoom,
  ExternalLiveCam,
} from "./types";

const ENDPOINT = "https://chaturbate.com/api/public/affiliates/onlinerooms/";
const DEFAULT_LIMIT = 60;
const FETCH_TIMEOUT_MS = 5_000;

function affiliateWm(): string {
  const wm = (process.env.CHATURBATE_AFFILIATE_WM || "").trim();
  if (!wm) {
    throw new Error("CHATURBATE_AFFILIATE_WM env var no está definida");
  }
  return wm;
}

function buildUrl(filters: ChaturbateFilters, clientIp: string): string {
  const url = new URL(ENDPOINT);
  url.searchParams.set("wm", affiliateWm());
  url.searchParams.set("client_ip", clientIp || "request_ip");
  url.searchParams.set("format", "json");

  if (filters.gender) url.searchParams.set("gender", filters.gender);
  if (filters.region) url.searchParams.set("region", filters.region);
  if (typeof filters.hd === "boolean") {
    url.searchParams.set("hd", filters.hd ? "true" : "false");
  }
  url.searchParams.set("limit", String(filters.limit ?? DEFAULT_LIMIT));
  if (filters.tag) url.searchParams.set("tag", filters.tag);
  if (filters.excludeGenders && filters.excludeGenders.length > 0) {
    url.searchParams.set("exclude_genders", filters.excludeGenders.join(","));
  }
  return url.toString();
}

function isLikelyChaturbateRoom(value: unknown): value is ChaturbateRoom {
  if (!value || typeof value !== "object") return false;
  const obj = value as Record<string, unknown>;
  return (
    typeof obj.username === "string" &&
    typeof obj.image_url === "string" &&
    typeof obj.chat_room_url_revshare === "string"
  );
}

async function rawFetch(filters: ChaturbateFilters, clientIp: string): Promise<ChaturbateRoom[]> {
  const url = buildUrl(filters, clientIp);
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

  try {
    const res = await fetch(url, {
      method: "GET",
      headers: {
        Accept: "application/json",
        "User-Agent": "uzeed-affiliate-feed/1.0",
      },
      signal: controller.signal,
      // No queremos que Next.js cachee este fetch a nivel de framework:
      // la caché de feeds se administra explícitamente en lib/chaturbate/cache.ts.
      cache: "no-store",
    });

    if (!res.ok) {
      throw new Error(`Chaturbate API HTTP ${res.status}`);
    }

    const json = (await res.json()) as ChaturbateApiResponse | unknown;
    if (!json || typeof json !== "object" || !Array.isArray((json as ChaturbateApiResponse).results)) {
      throw new Error("Respuesta inesperada del API de Chaturbate");
    }
    const results = (json as ChaturbateApiResponse).results;
    return results.filter(isLikelyChaturbateRoom);
  } finally {
    clearTimeout(timeout);
  }
}

export interface FetchExternalCamsResult {
  cams: ExternalLiveCam[];
  cached: boolean;
}

/**
 * Devuelve cams externas tipadas, con caché por país + filtros.
 * Si el fetch externo falla (timeout, red, 5xx), devuelve la última
 * respuesta cacheada aunque esté vencida; si no hay nada, devuelve [].
 */
export async function fetchExternalCams(
  input: ChaturbateFetchInput,
): Promise<FetchExternalCamsResult> {
  const { clientIp, countryCode, ...filters } = input;
  const key = buildCacheKey(countryCode, filters);

  const fresh = getCached(key);
  if (fresh) {
    return { cams: fresh, cached: true };
  }

  try {
    const cams = await withInflight(key, async () => {
      const rooms = await rawFetch(filters, clientIp);
      const mapped = rooms.map(toExternalLiveCam);
      setCached(key, mapped);
      return mapped;
    });
    return { cams, cached: false };
  } catch (err) {
    // Soft-fail: log server-side y devolvemos array vacío en vez de
    // romper la página. La sección /live mostrará solo webrtc o el
    // estado correcto cuando no haya nada.
    console.warn("[chaturbate.fetchExternalCams] fallo del feed externo:", err);
    return { cams: [], cached: false };
  }
}
