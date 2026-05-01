/**
 * Caché de feeds de chaturbate.
 *
 * Implementación in-memory por proceso, con TTL. El proyecto todavía no
 * tiene un cliente de Redis instalado en apps/web; cuando se agregue,
 * basta con reemplazar el backend de este archivo dejando intactas las
 * firmas de `getCached` / `setCached`.
 *
 * - La key incluye el código de país y el hash de filtros: visitantes del
 *   mismo país comparten caché, pero filtros distintos son keys distintas.
 * - El TTL por defecto es 60s (configurable por llamado).
 * - Las entradas vencidas se purgan de forma perezosa al consultar y un
 *   sweep cada N entradas para evitar crecimiento indefinido en producción.
 */

import type { ChaturbateFilters, ExternalLiveCam } from "./types";

interface CacheEntry {
  data: ExternalLiveCam[];
  expiresAt: number;
}

const DEFAULT_TTL_MS = 60_000;
const SWEEP_EVERY = 64;

const store: Map<string, CacheEntry> = new Map();
const inflight: Map<string, Promise<ExternalLiveCam[]>> = new Map();
let writesSinceSweep = 0;

function sweep(now: number): void {
  for (const [key, entry] of store) {
    if (entry.expiresAt <= now) store.delete(key);
  }
}

function stableHash(filters: ChaturbateFilters): string {
  const parts: string[] = [];
  if (filters.gender) parts.push(`g=${filters.gender}`);
  if (filters.region) parts.push(`r=${filters.region}`);
  if (filters.hd) parts.push("hd=1");
  if (typeof filters.limit === "number") parts.push(`l=${filters.limit}`);
  if (filters.tag) parts.push(`t=${filters.tag}`);
  if (filters.excludeGenders && filters.excludeGenders.length > 0) {
    parts.push(`x=${[...filters.excludeGenders].sort().join(",")}`);
  }
  return parts.join("|");
}

export function buildCacheKey(
  countryCode: string | null,
  filters: ChaturbateFilters,
): string {
  const country = (countryCode || "ZZ").toUpperCase();
  return `cb:${country}:${stableHash(filters)}`;
}

export function getCached(key: string): ExternalLiveCam[] | null {
  const entry = store.get(key);
  if (!entry) return null;
  if (entry.expiresAt <= Date.now()) {
    store.delete(key);
    return null;
  }
  return entry.data;
}

export function setCached(
  key: string,
  data: ExternalLiveCam[],
  ttlMs: number = DEFAULT_TTL_MS,
): void {
  store.set(key, { data, expiresAt: Date.now() + ttlMs });
  writesSinceSweep += 1;
  if (writesSinceSweep >= SWEEP_EVERY) {
    writesSinceSweep = 0;
    sweep(Date.now());
  }
}

/**
 * Deduplica fetches en vuelo para una misma key. Si dos requests entran
 * a la vez con la caché vacía, solo uno hace el fetch al API externo.
 */
export async function withInflight(
  key: string,
  loader: () => Promise<ExternalLiveCam[]>,
): Promise<ExternalLiveCam[]> {
  const existing = inflight.get(key);
  if (existing) return existing;

  const promise = loader()
    .then((data) => {
      inflight.delete(key);
      return data;
    })
    .catch((err: unknown) => {
      inflight.delete(key);
      throw err;
    });
  inflight.set(key, promise);
  return promise;
}
