import type { MetadataRoute } from "next";

type ProfessionalItem = {
  id?: string | null;
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

async function getPublicProfessionalIds(): Promise<string[]> {
  const data = await fetchJson<ProfessionalsResponse>(
    `${getApiBaseUrl()}/professionals`,
  );
  if (!data) return [];
  const items = Array.isArray(data.professionals) ? data.professionals : [];
  const ids = items
    .map((item) => item.id || null)
    .filter((id): id is string => Boolean(id && id.trim()));
  return Array.from(new Set(ids));
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

// Ciudades principales para landing pages geo-segmentadas
const CITIES = [
  "santiago", "vina-del-mar", "valparaiso", "concepcion",
  "antofagasta", "temuco", "rancagua", "la-serena",
  "arica", "iquique", "puerto-montt", "talca",
  "chillan", "osorno", "punta-arenas", "copiapo",
  "calama", "los-angeles", "curico", "providencia", "las-condes",
  "nunoa", "maipu", "puente-alto", "san-bernardo",
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
  add("/videochat", "daily", 0.85);
  add("/services", "daily", 0.85);
  add("/premium", "daily", 0.8);

  // ── Landing pages por tag de escort (long-tail SEO) ──
  for (const tag of ESCORT_TAGS) {
    add(`/escorts/${encodeURIComponent(tag)}`, "daily", 0.8);
  }

  // ── Landing pages por ciudad (geo-targeting SEO) ──
  // Solo escorts por ciudad (las más buscadas). Masajistas/moteles por ciudad
  // generaban URLs de bajo valor que Google no indexaba.
  for (const city of CITIES) {
    add(`/escorts?city=${encodeURIComponent(city)}`, "daily", 0.8);
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
  const [professionalIds, forumSlugs, establishmentIds] = await Promise.all([
    getPublicProfessionalIds(),
    getForumCategorySlugs(),
    getEstablishmentIds(),
  ]);

  for (const id of professionalIds.slice(0, 5000)) {
    add(`/profesional/${encodeURIComponent(id)}`, "daily", 0.7);
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
