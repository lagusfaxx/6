import type { MetadataRoute } from "next";

type ProfessionalItem = {
  username?: string | null;
  profile?: {
    username?: string | null;
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

async function getPublicProfessionalUsernames(): Promise<string[]> {
  const data = await fetchJson<ProfessionalsResponse>(
    `${getApiBaseUrl()}/professionals`,
  );
  if (!data) return [];
  const items = Array.isArray(data.professionals) ? data.professionals : [];
  const usernames = items
    .map((item) => item.username || item.profile?.username || null)
    .filter((u): u is string => Boolean(u && u.trim()))
    .map((u) => u.trim().toLowerCase());
  return Array.from(new Set(usernames));
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
  "tetona", "culona", "delgada", "fitness", "gordita",
  // Apariencia
  "rubia", "morena", "pelirroja", "trigueña",
  // Personalidad
  "sumisa", "dominante", "caliente", "cariñosa", "natural",
  // Estilo
  "tatuada", "piercing",
  // Edad
  "maduras",
  // Servicios
  "anal", "trios", "packs", "videollamada",
  "masaje-erotico", "despedidas", "discapacitados", "fetiches",
  "bdsm", "sexo-oral", "lluvia-dorada", "rol",
];

// Ciudades principales para landing pages geo-segmentadas
const CITIES = [
  "santiago", "vina-del-mar", "valparaiso", "concepcion",
  "antofagasta", "temuco", "rancagua", "la-serena",
  "arica", "iquique", "puerto-montt", "talca",
  "chillan", "osorno", "punta-arenas", "copiapo",
  "calama", "los-angeles", "curico", "providencia", "las-condes",
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
  add("/escorts", "daily", 0.9);
  add("/masajistas", "daily", 0.9);
  add("/moteles", "daily", 0.9);
  add("/hospedajes", "daily", 0.85);
  add("/establecimientos", "daily", 0.85);
  add("/profesionales", "daily", 0.85);
  add("/sexshops", "daily", 0.8);
  add("/services", "daily", 0.85);
  add("/servicios", "daily", 0.85);
  add("/premium", "daily", 0.8);

  // ── Landing pages por tag de escort (long-tail SEO) ──
  for (const tag of ESCORT_TAGS) {
    add(`/escorts/${encodeURIComponent(tag)}`, "daily", 0.8);
  }

  // ── Landing pages por ciudad (geo-targeting SEO) ──
  for (const city of CITIES) {
    add(`/escorts?city=${encodeURIComponent(city)}`, "daily", 0.8);
    add(`/masajistas?city=${encodeURIComponent(city)}`, "daily", 0.75);
    add(`/moteles?city=${encodeURIComponent(city)}`, "daily", 0.75);
  }

  // ── Combinaciones tag + ciudad top (máximo impacto long-tail) ──
  const topTags = ["tetona", "culona", "rubia", "morena", "maduras", "anal", "trios"];
  const topCities = ["santiago", "vina-del-mar", "valparaiso", "concepcion", "antofagasta"];
  for (const tag of topTags) {
    for (const city of topCities) {
      add(`/escorts/${encodeURIComponent(tag)}?city=${encodeURIComponent(city)}`, "daily", 0.75);
    }
  }

  // ── Contenido dinámico ──
  add("/live", "always", 0.85);
  add("/foro", "hourly", 0.85);
  add("/hot", "daily", 0.7);

  // ── Páginas informativas ──
  add("/contacto", "monthly", 0.5);
  add("/terminos", "yearly", 0.3);
  add("/privacidad", "yearly", 0.3);

  // ── Perfiles públicos dinámicos ──
  const [usernames, forumSlugs, establishmentIds] = await Promise.all([
    getPublicProfessionalUsernames(),
    getForumCategorySlugs(),
    getEstablishmentIds(),
  ]);

  for (const username of usernames.slice(0, 5000)) {
    add(`/profile/${encodeURIComponent(username)}`, "daily", 0.7);
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
