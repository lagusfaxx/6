/**
 * Datos en vivo de una landing de comuna (/escorts/{comuna}), calculados en
 * el servidor con los perfiles publicados: cuántas hay, cuántas conectadas,
 * nuevas, rango de edad y de tarifas, servicios más ofrecidos y estaciones de
 * metro con más perfiles.
 *
 * Es el contenido que hace única a cada comuna: dos comunas nunca tienen los
 * mismos números, y Google ve que la página cambia con la oferta real (por
 * eso también va dateModified en el JSON-LD).
 */

import { escortTagSlug } from "./escortTags";
import { GRAN_SANTIAGO } from "./chileGeo";
import { getTagLanding, tagLandingHref } from "./escortSearchLandings";

/**
 * Radio de los datos de una comuna. En el Gran Santiago 60 km cubren toda la
 * ciudad y las 35 comunas mostraban los mismos números y la misma lista
 * (contenido duplicado): ahí se miran 6 km alrededor de la comuna. Santiago
 * (la ciudad entera) mira 20 km, igual que el resto del país.
 */
export function statsRadiusKm(slug: string): number {
  return GRAN_SANTIAGO.has(slug) ? 6 : 20;
}

export type StatsProfile = {
  id: string;
  username?: string;
  displayName?: string | null;
  city?: string | null;
  serviceCategory?: string | null;
  age?: number | null;
  distance?: number | null;
  availableNow?: boolean;
  isNew?: boolean;
  baseRate?: number | null;
  serviceTags?: string[];
  profileTags?: string[];
  nearestMetro?: { name: string; lines: string[] } | null;
};

export type CityStats = {
  /** Perfiles dentro del radio (total que informa la API). */
  total: number;
  /** De esos, los que dicen estar en la comuna misma. */
  inComuna: number;
  availableNow: number;
  isNew: number;
  age: { min: number; max: number; median: number } | null;
  rate: { min: number; median: number; max: number; count: number } | null;
  /** Servicios y atributos más frecuentes, con su landing si existe. */
  topTags: { label: string; count: number; href: string | null }[];
  /** Estaciones de metro más cercanas a los perfiles (Santiago). */
  topMetro: { name: string; lines: string[]; count: number }[];
  /** Perfiles para la lista enriquecida y el ItemList. */
  profiles: StatsProfile[];
  updatedAt: Date;
};

function apiBase(): string {
  return (process.env.NEXT_PUBLIC_API_URL || process.env.API_URL || "https://api.uzeed.cl").replace(/\/+$/, "");
}

function norm(s?: string | null) {
  return String(s || "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function median(xs: number[]) {
  const s = [...xs].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : Math.round((s[m - 1] + s[m]) / 2);
}

/* Los tags se guardan sin tildes ("carinosa", "masaje erotico"). */
const ACCENTS: Record<string, string> = {
  carinosa: "cariñosa",
  erotico: "erótico",
  erotica: "erótica",
  trios: "tríos",
  jovenes: "jóvenes",
  triguena: "trigueña",
  asiatica: "asiática",
  fisico: "físico",
  sumision: "sumisión",
  dominacion: "dominación",
  atencion: "atención",
  tantrico: "tántrico",
  lenceria: "lencería",
};

/** Etiqueta legible de un tag: "masaje erotico" → "Masaje erótico". */
export function tagLabel(t: string) {
  const s = t
    .replace(/-/g, " ")
    .trim()
    .toLowerCase()
    .split(/\s+/)
    .map((w) => ACCENTS[w] ?? w)
    .join(" ");
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function tagHref(t: string): string | null {
  const slug = t.toLowerCase().trim().replace(/\s+/g, "-");
  if (getTagLanding(slug)) return tagLandingHref(slug);
  const known = escortTagSlug(t);
  return known ? `/escorts/${encodeURIComponent(known)}` : null;
}

/**
 * null = la API falló (la página sigue sin el bloque). Se cachea 10 minutos,
 * igual que el resto de las consultas de la landing.
 */
export async function fetchCityStats(
  city: { name: string; lat: number; lng: number },
  radiusKm: number,
): Promise<CityStats | null> {
  try {
    const qs = new URLSearchParams({
      entityType: "professional",
      categorySlug: "escort",
      // Por cercanía: la lista "Escorts en {comuna}" empieza por las de ahí.
      sort: "near",
      limit: "120",
      lat: String(city.lat),
      lng: String(city.lng),
      radiusKm: String(radiusKm),
      city: city.name,
    }).toString();
    const res = await fetch(`${apiBase()}/directory/search?${qs}`, {
      next: { revalidate: 600 },
      headers: { Accept: "application/json" },
    });
    if (!res.ok) return null;
    const data = (await res.json()) as { results?: StatsProfile[]; total?: number };
    const list = (data.results || []).filter((p) => p && p.id);
    return computeCityStats(city.name, list, typeof data.total === "number" ? data.total : list.length);
  } catch {
    return null;
  }
}

export function computeCityStats(cityName: string, list: StatsProfile[], total: number): CityStats {
  const key = norm(cityName);
  const ages = list.map((p) => p.age).filter((a): a is number => typeof a === "number" && a >= 18 && a < 80);
  const rates = list.map((p) => p.baseRate).filter((r): r is number => typeof r === "number" && r >= 5000 && r <= 2_000_000);

  const tagCount = new Map<string, { label: string; count: number }>();
  for (const p of list) {
    const seen = new Set<string>();
    for (const t of [...(p.serviceTags || []), ...(p.profileTags || [])]) {
      const k = norm(t);
      if (!k || seen.has(k)) continue;
      seen.add(k);
      const cur = tagCount.get(k);
      if (cur) cur.count++;
      else tagCount.set(k, { label: t, count: 1 });
    }
  }
  /* Sólo tags que comparten al menos dos perfiles: uno solo no describe la zona. */
  const topTags = [...tagCount.values()]
    .filter((t) => t.count >= 2)
    .sort((a, b) => b.count - a.count)
    .slice(0, 10)
    .map((t) => ({ label: tagLabel(t.label), count: t.count, href: tagHref(t.label) }));

  const metro = new Map<string, { name: string; lines: string[]; count: number }>();
  for (const p of list) {
    const m = p.nearestMetro;
    if (!m?.name) continue;
    const cur = metro.get(m.name);
    if (cur) cur.count++;
    else metro.set(m.name, { name: m.name, lines: m.lines || [], count: 1 });
  }
  const topMetro = [...metro.values()].filter((m) => m.count >= 2).sort((a, b) => b.count - a.count).slice(0, 6);

  return {
    total: Math.max(total, list.length),
    inComuna: key ? list.filter((p) => norm(p.city) === key || norm(p.city).startsWith(`${key} `)).length : 0,
    availableNow: list.filter((p) => p.availableNow).length,
    isNew: list.filter((p) => p.isNew).length,
    age: ages.length >= 3 ? { min: Math.min(...ages), max: Math.max(...ages), median: median(ages) } : null,
    rate: rates.length >= 3 ? { min: Math.min(...rates), median: median(rates), max: Math.max(...rates), count: rates.length } : null,
    topTags,
    topMetro,
    profiles: list.slice(0, 24),
    updatedAt: new Date(),
  };
}

export function clp(n: number) {
  return `$${Math.round(n).toLocaleString("es-CL")}`;
}
