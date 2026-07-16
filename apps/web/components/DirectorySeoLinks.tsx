import Link from "next/link";
import { cleanProfileHref } from "../lib/profileUrl";

/**
 * Lista de perfiles renderizada en el SERVIDOR para que Google indexe contenido
 * real (no solo el texto SEO) en las landings de ciudad y de tag. El listado
 * interactivo principal (DirectoryPage) es client-side y llega vacío al
 * crawler; esto garantiza enlaces internos y perfiles rastreables sin depender
 * de la ejecución de JavaScript.
 */

const DEFAULT_API =
  process.env.NEXT_PUBLIC_API_URL || process.env.API_URL || "https://api.uzeed.cl";

function apiBase(): string {
  return DEFAULT_API.replace(/\/+$/, "");
}

type ProfileSummary = {
  id: string;
  username?: string;
  displayName?: string | null;
  city?: string | null;
  serviceCategory?: string | null;
};

type Props = {
  heading: string;
  /** Coordenadas para landing de ciudad. */
  lat?: number;
  lng?: number;
  /** Tag de perfil/servicio para landing de atributo. */
  tag?: string;
  categorySlug?: string;
  entityType?: "professional" | "establishment" | "shop";
};

async function fetchProfiles(params: Record<string, string>): Promise<ProfileSummary[]> {
  try {
    const qs = new URLSearchParams(params).toString();
    const res = await fetch(`${apiBase()}/directory/search?${qs}`, {
      next: { revalidate: 600 },
      headers: { Accept: "application/json" },
    });
    if (!res.ok) return [];
    const data = await res.json();
    return (data?.results || []).slice(0, 30);
  } catch {
    return [];
  }
}

export default async function DirectorySeoLinks({
  heading,
  lat,
  lng,
  tag,
  categorySlug = "escort",
  entityType = "professional",
}: Props) {
  const params: Record<string, string> = {
    entityType,
    categorySlug,
    sort: "featured",
    limit: "30",
  };
  if (typeof lat === "number" && typeof lng === "number") {
    params.lat = String(lat);
    params.lng = String(lng);
    params.radiusKm = "60";
  }
  if (tag) params.profileTags = tag;

  const profiles = await fetchProfiles(params);
  if (profiles.length === 0) return null;

  return (
    <nav className="max-w-5xl mx-auto px-4 pb-8" aria-label={heading}>
      <h2 className="text-lg font-bold text-white/70 mb-3">{heading}</h2>
      <ul className="flex flex-wrap gap-2">
        {profiles.map((p) => (
          <li key={p.id}>
            <Link
              href={cleanProfileHref({ id: p.id, username: p.username, serviceCategory: p.serviceCategory, name: p.displayName || p.username, city: p.city })}
              className="inline-block rounded-lg border border-white/10 bg-white/[0.03] px-3 py-1.5 text-sm text-white/60 hover:text-fuchsia-300 hover:border-fuchsia-500/30 transition"
            >
              {p.displayName || p.username}
              {p.city ? ` — ${p.city}` : ""}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
