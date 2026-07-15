import type { MetadataRoute } from "next";
import { CITY_LANDINGS } from "../lib/cities";
import { profileHref } from "../lib/profileUrl";

type ProfessionalItem = {
  id?: string | null;
  name?: string | null;
  username?: string | null;
  displayName?: string | null;
  locality?: string | null;
  city?: string | null;
  profile?: {
    username?: string | null;
    displayName?: string | null;
  } | null;
  lastSeen?: string | null;
};

type ProfessionalsResponse = {
  professionals?: ProfessionalItem[];
};

type ForumCategory = {
  slug?: string | null;
};

type EstablishmentItem = {
  id?: string | null;
};

const DEFAULT_WEB_URL = "https://uzeed.cl";
const DEFAULT_API_URL = "https://api.uzeed.cl";

function normalizeBaseUrl(url: string): string {
  return url.trim().replace(/\/+$/, "");
}

function getWebBaseUrl(): string {
  const candidate =
    process.env.NEXT_PUBLIC_APP_URL || process.env.APP_URL || DEFAULT_WEB_URL;
  return normalizeBaseUrl(candidate);
}

function getApiBaseUrl(): string {
  const candidate =
    process.env.NEXT_PUBLIC_API_URL || process.env.API_URL || DEFAULT_API_URL;
  return normalizeBaseUrl(candidate);
}

function toAbsoluteUrl(baseUrl: string, path: string): string {
  const cleanPath = path.startsWith("/") ? path : `/${path}`;
  return `${baseUrl}${cleanPath}`;
}

async function fetchJson<T>(url: string): Promise<T | null> {
  try {
    const res = await fetch(url, {
      next: { revalidate: 3600 },
      headers: { Accept: "application/json" },
    });
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  }
}

async function getPublicProfessionalPaths(): Promise<string[]> {
  const data = await fetchJson<ProfessionalsResponse>(
    `${getApiBaseUrl()}/professionals`,
  );
  if (!data) return [];
  const items = Array.isArray(data.professionals) ? data.professionals : [];
  const paths = new Map<string, string>();
  for (const item of items) {
    const id = item.id?.trim();
    if (!id) continue;
    const name =
      item.name || item.displayName || item.profile?.displayName || item.profile?.username || item.username || null;
    const city = item.locality || item.city || null;
    // URL con slug semántico (nombre-ciudad); cae a la UUID si no hay slug.
    paths.set(id, profileHref(id, name, city));
  }
  return Array.from(paths.values());
}

async function getForumCategorySlugs(): Promise<string[]> {
  const data = await fetchJson<ForumCategory[]>(
    `${getApiBaseUrl()}/forum/categories`,
  );
  if (!Array.isArray(data)) return [];
  return data
    .map((c) => c.slug)
    .filter((s): s is string => Boolean(s && s.trim()));
}

async function getEstablishmentIds(): Promise<string[]> {
  const data = await fetchJson<{ establishments?: EstablishmentItem[] }>(
    `${getApiBaseUrl()}/establishments`,
  );
  if (!data) return [];
  const items = Array.isArray(data.establishments)
    ? data.establishments
    : [];
  return items
    .map((e) => e.id)
    .filter((id): id is string => Boolean(id));
}

// Tags de perfil y servicio para generar landing pages /escorts/[tag]
const ESCORT_TAGS = [
  // Físico
  "tetona", "culona", "delgada", "fitness", "gordita", "flaca", "curvy",
  // Apariencia
  "rubia", "morena", "pelirroja", "trigueña", "latina", "colombiana", "venezolana",
  // Personalidad
  "sumisa", "dominante", "caliente", "cariñosa", "natural", "discreta",
  // Estilo
  "tatuada", "piercing",
  // Edad
  "maduras", "jovenes",
  // Servicios
  "anal", "trios", "packs", "videollamada",
  "masaje-erotico", "despedidas", "discapacitados", "fetiches",
  "bdsm", "sexo-oral", "lluvia-dorada", "rol", "nuru", "tantra",
  // Disponibilidad
  "disponible-hoy", "24-horas", "domicilio",
];

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const baseUrl = getWebBaseUrl();
  const now = new Date();
  const urls = new Map<string, MetadataRoute.Sitemap[number]>();

  const add = (
    path: string,
    changeFrequency: MetadataRoute.Sitemap[number]["changeFrequency"],
    priority: number,
  ) => {
    const url = toAbsoluteUrl(baseUrl, path);
    urls.set(url, { url, lastModified: now, changeFrequency, priority });
  };

  // ── Página principal ──
  add("/", "daily", 1.0);

  // ── Directorios principales (alta prioridad - generan tráfico) ──
  // Only canonical URLs — aliases (/servicios, /sexshops, /hospedajes, /hot)
  // are 301-redirected in next.config.mjs and must NOT appear here.
  add("/escorts", "daily", 0.9);
  add("/masajistas", "daily", 0.9);
  add("/moteles", "daily", 0.9);
  add("/hospedaje", "daily", 0.85);
  add("/establecimientos", "daily", 0.85);
  add("/profesionales", "daily", 0.85);
  add("/sexshop", "daily", 0.8);
  add("/services", "daily", 0.85);
  add("/premium", "daily", 0.8);

  // ── Landing pages por tag de escort (long-tail SEO) ──
  for (const tag of ESCORT_TAGS) {
    add(`/escorts/${encodeURIComponent(tag)}`, "daily", 0.8);
  }

  // ── Landing pages por ciudad (geo-targeting SEO) ──
  // URLs LIMPIAS e indexables (/escorts/{ciudad}) con canonical propio y
  // resultados filtrados por ubicación. Antes se emitían como ?city= que
  // Google canonicalizaba a /escorts (duplicado) y no indexaba.
  for (const city of CITY_LANDINGS) {
    add(`/escorts/${city.slug}`, "daily", 0.8);
  }

  // ── Combinaciones tag + ciudad top eliminadas ──
  // Las combinaciones tag+ciudad generaban ~77 URLs de contenido delgado
  // que Google marcaba como "Descubiertas, no indexadas".
  // Se mantienen solo las landing pages por tag y por ciudad por separado.

  // ── Contenido dinámico ──
  add("/live", "always", 0.85);
  add("/foro", "hourly", 0.85);
  // /hot redirects to /premium — excluded from sitemap

  // ── Registro (indexable para captar profesionales) ──
  add("/register", "weekly", 0.7);
  add("/register?type=PROFESSIONAL", "weekly", 0.75);

  // ── Páginas informativas ──
  add("/contacto", "monthly", 0.5);
  add("/terminos", "yearly", 0.3);
  add("/privacidad", "yearly", 0.3);

  // ── Perfiles públicos dinámicos ──
  const [professionalPaths, forumSlugs, establishmentIds] = await Promise.all([
    getPublicProfessionalPaths(),
    getForumCategorySlugs(),
    getEstablishmentIds(),
  ]);

  // URLs con slug semántico (/profesional/{id}/{nombre-ciudad}); ya vienen
  // codificadas desde profileHref.
  for (const path of professionalPaths.slice(0, 5000)) {
    add(path, "daily", 0.7);
  }

  // ── Categorías del foro ──
  for (const slug of forumSlugs) {
    add(`/foro/categoria/${encodeURIComponent(slug)}`, "daily", 0.65);
  }

  // ── Establecimientos ──
  for (const id of establishmentIds.slice(0, 2000)) {
    add(`/establecimiento/${encodeURIComponent(id)}`, "weekly", 0.6);
  }

  return Array.from(urls.values());
}
