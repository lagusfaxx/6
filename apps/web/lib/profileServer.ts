import type { Metadata } from "next";
import { cleanProfileHref } from "./profileUrl";

/**
 * Resolución server-side de perfiles para las rutas limpias (/escort/{username},
 * /masajista/{username}) y para la ruta legacy /profesional/{id}. Normaliza las
 * dos formas que devuelve la API:
 *  - GET /profiles/{username}  → { profile: { displayName, username, city, serviceCategory, bio, ... } }
 *  - GET /professionals/{id}   → { professional: { name, category, city, description, serviceSummary, username?, ... } }
 */

const DEFAULT_API =
  process.env.NEXT_PUBLIC_API_URL || process.env.API_URL || "https://api.uzeed.cl";

function apiBase(): string {
  return DEFAULT_API.replace(/\/+$/, "");
}

export type ProfileRecord = {
  id: string;
  username: string | null;
  name: string;
  city: string | null;
  serviceCategory: string | null;
  bio: string | null;
  serviceDescription: string | null;
  avatarUrl: string | null;
  heightCm: number | null;
  hairColor: string | null;
  serviceTags: string[];
};

type RawProfile = {
  id?: string;
  username?: string | null;
  displayName?: string | null;
  name?: string | null;
  city?: string | null;
  serviceCategory?: string | null;
  category?: string | null;
  bio?: string | null;
  description?: string | null;
  serviceDescription?: string | null;
  serviceSummary?: string | null;
  avatarUrl?: string | null;
  heightCm?: number | null;
  hairColor?: string | null;
  serviceTags?: string[] | null;
};

function normalize(raw: RawProfile | null | undefined): ProfileRecord | null {
  if (!raw?.id) return null;
  return {
    id: raw.id,
    username: (raw.username || "").trim() || null,
    name: (raw.displayName || raw.name || raw.username || "").trim(),
    city: raw.city ?? null,
    serviceCategory: raw.serviceCategory || raw.category || null,
    bio: raw.bio || raw.description || null,
    serviceDescription: raw.serviceDescription || raw.serviceSummary || null,
    avatarUrl: raw.avatarUrl ?? null,
    heightCm: raw.heightCm ?? null,
    hairColor: raw.hairColor ?? null,
    serviceTags: Array.isArray(raw.serviceTags) ? raw.serviceTags : [],
  };
}

async function fetchJson(path: string): Promise<any | null> {
  try {
    const res = await fetch(`${apiBase()}${path}`, {
      next: { revalidate: 300 },
      headers: { Accept: "application/json" },
    });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

/**
 * Resuelve un perfil por username (rutas limpias). Usa el endpoint del
 * directorio SIN candado de plan (/professionals/by-username); si aún no está
 * desplegado, cae a /profiles/:username (que sí gatilla PLAN_EXPIRED, pero al
 * menos resuelve los perfiles con plan activo). Así ningún orden de despliegue
 * empeora el estado actual.
 */
export async function fetchProfileByUsername(username: string): Promise<ProfileRecord | null> {
  const primary = await fetchJson(`/professionals/by-username/${encodeURIComponent(username)}`);
  const primaryRecord = normalize(primary?.professional ?? primary ?? null);
  if (primaryRecord) return primaryRecord;

  const fallback = await fetchJson(`/profiles/${encodeURIComponent(username)}`);
  return normalize(fallback?.profile ?? fallback ?? null);
}

/** Resuelve un perfil por id (ruta legacy /profesional/{id}). */
export async function fetchProfileById(id: string): Promise<ProfileRecord | null> {
  const data = await fetchJson(`/professionals/${encodeURIComponent(id)}`);
  return normalize(data?.professional ?? data ?? null);
}

/** Construye los metadatos SEO de un perfil dado su record y su URL canónica. */
export function buildProfileMetadata(p: ProfileRecord, canonicalPath: string): Metadata {
  const name = p.name || "Profesional";
  const city = p.city || "Chile";
  const category = (p.serviceCategory || "Escort").trim();
  const title = `${name} — ${category} en ${city}`;
  const brandedTitle = `${title} | UZEED`;
  const description = [
    `Perfil verificado de ${name}, ${category.toLowerCase()} en ${city}.`,
    p.bio ? p.bio.slice(0, 120) : null,
    "Fotos reales, contacto directo y disponibilidad en UZEED.",
  ]
    .filter(Boolean)
    .join(" ")
    .slice(0, 300);

  const images = p.avatarUrl
    ? [{ url: p.avatarUrl, width: 400, height: 400, alt: `${name} - ${category} en ${city}` }]
    : [{ url: "https://uzeed.cl/brand/isotipo-new.png", width: 720, height: 720, alt: "UZEED" }];

  return {
    title,
    description,
    keywords: [
      `${category.toLowerCase()} ${city.toLowerCase()}`,
      `escort ${city.toLowerCase()}`,
      `${name.toLowerCase()} escort`,
      `acompañante ${city.toLowerCase()}`,
      `escorts verificadas ${city.toLowerCase()}`,
    ],
    alternates: { canonical: canonicalPath },
    openGraph: {
      title: brandedTitle,
      description,
      url: `https://uzeed.cl${canonicalPath}`,
      type: "profile",
      images,
    },
    twitter: {
      card: "summary_large_image",
      title: brandedTitle,
      description,
      images: images.map((i) => i.url),
    },
  };
}

/** URL canónica limpia (o legacy si el username no es URL-safe) de un perfil. */
export function canonicalProfilePath(p: ProfileRecord): string {
  return cleanProfileHref({
    id: p.id,
    username: p.username,
    serviceCategory: p.serviceCategory,
    name: p.name,
    city: p.city,
  });
}
