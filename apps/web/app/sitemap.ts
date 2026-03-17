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

async function getPublicProfessionalUsernames(): Promise<string[]> {
  const apiBaseUrl = getApiBaseUrl();
  const endpoint = `${apiBaseUrl}/professionals`;

  try {
    const res = await fetch(endpoint, {
      next: { revalidate: 3600 },
      headers: { Accept: "application/json" },
    });

    if (!res.ok) return [];

    const data = (await res.json()) as ProfessionalsResponse;
    const items = Array.isArray(data.professionals) ? data.professionals : [];

    const usernames = items
      .map((item) => item.username || item.profile?.username || null)
      .filter((username): username is string => Boolean(username && username.trim()))
      .map((username) => username.trim().toLowerCase());

    return Array.from(new Set(usernames));
  } catch {
    return [];
  }
}

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
    urls.set(url, {
      url,
      lastModified: now,
      changeFrequency,
      priority,
    });
  };

  // Rutas públicas estáticas confirmadas en este baseline.
  add("/", "daily", 1);
  add("/services", "daily", 0.8);
  add("/servicios", "weekly", 0.75);
  add("/escorts", "daily", 0.8);
  add("/masajistas", "daily", 0.8);
  add("/moteles", "daily", 0.8);
  add("/hospedajes", "daily", 0.75);
  add("/establecimientos", "daily", 0.75);
  add("/profesionales", "daily", 0.75);
  add("/sexshops", "weekly", 0.7);
  add("/live", "hourly", 0.8);
  add("/foro", "hourly", 0.8);
  add("/hot", "daily", 0.7);
  add("/privacidad", "yearly", 0.4);

  // Auth pages: incluidas con prioridad baja.
  add("/login", "monthly", 0.2);
  add("/register", "monthly", 0.2);
  add("/forgot-password", "yearly", 0.1);

  // Perfiles públicos dinámicos.
  // Canonical: /profile/[username]. /perfil/[username] existe, pero se evita duplicar URLs en sitemap.
  const usernames = await getPublicProfessionalUsernames();
  for (const username of usernames.slice(0, 5000)) {
    add(`/profile/${encodeURIComponent(username)}`, "daily", 0.7);
  }

  // Nota: si el volumen crece más allá de 5k perfiles, considerar sitemap index paginado.
  return Array.from(urls.values());
}
