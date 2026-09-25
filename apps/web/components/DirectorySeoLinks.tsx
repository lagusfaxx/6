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
  distance?: number | null;
};

/** Radio de una landing de ciudad: lo que cuenta como "en {ciudad}". */
const CITY_RADIUS_KM = 60;
/** Radio para mostrar las más cercanas cuando la ciudad no tiene perfiles. */
const NEARBY_RADIUS_KM = 200;

type Props = {
  heading: string;
  /** Coordenadas para landing de ciudad. */
  lat?: number;
  lng?: number;
  /** Tag de perfil/servicio para landing de atributo. */
  tag?: string;
  categorySlug?: string;
  entityType?: "professional" | "establishment" | "shop";
  /**
   * Nombre de la ciudad (landing de ciudad). Si no hay perfiles en el radio de
   * la ciudad, se dice así y se listan los más cercanos con su ciudad y
   * distancia reales, en vez de dejar la página vacía (soft 404).
   */
  cityName?: string;
};

/** null = la API falló (distinto de "no hay perfiles"). */
async function fetchProfiles(params: Record<string, string>): Promise<ProfileSummary[] | null> {
  try {
    const qs = new URLSearchParams(params).toString();
    const res = await fetch(`${apiBase()}/directory/search?${qs}`, {
      next: { revalidate: 600 },
      headers: { Accept: "application/json" },
    });
    if (!res.ok) return null;
    const data = await res.json();
    return (data?.results || []).slice(0, 30);
  } catch {
    return null;
  }
}

function cityParams(lat: number, lng: number, radiusKm: number): Record<string, string> {
  return {
    entityType: "professional",
    categorySlug: "escort",
    sort: "featured",
    limit: "30",
    lat: String(lat),
    lng: String(lng),
    radiusKm: String(radiusKm),
  };
}

/**
 * ¿Hay escorts publicadas en la ciudad? Misma consulta que la lista de la
 * landing (el fetch se deduplica), para que el <title> no prometa perfiles que
 * la página no tiene.
 */
export async function cityHasProfiles(lat: number, lng: number): Promise<boolean> {
  const profiles = await fetchProfiles(cityParams(lat, lng, CITY_RADIUS_KM));
  // Si la API falla no cambiamos el título por un error pasajero.
  return profiles === null || profiles.length > 0;
}

export default async function DirectorySeoLinks({
  heading,
  lat,
  lng,
  tag,
  categorySlug = "escort",
  entityType = "professional",
  cityName,
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
    params.radiusKm = String(CITY_RADIUS_KM);
  }
  if (tag) params.profileTags = tag;

  const profiles = await fetchProfiles(params);
  if (profiles === null) return null;
  if (profiles.length === 0) {
    if (cityName && typeof lat === "number" && typeof lng === "number") {
      return <NearbyProfiles cityName={cityName} lat={lat} lng={lng} />;
    }
    return null;
  }

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

/**
 * Ciudad sin perfiles publicados: lo dice tal cual, muestra las escorts más
 * cercanas con su ciudad y distancia reales, e invita a publicar en la ciudad.
 */
async function NearbyProfiles({ cityName, lat, lng }: { cityName: string; lat: number; lng: number }) {
  const nearby = ((await fetchProfiles(cityParams(lat, lng, NEARBY_RADIUS_KM))) ?? [])
    .filter((p) => typeof p.distance === "number")
    .sort((a, b) => (a.distance as number) - (b.distance as number));

  return (
    <section className="max-w-5xl mx-auto px-4 pb-8" aria-label={`Escorts cerca de ${cityName}`}>
      <p className="text-sm text-white/60 mb-4">
        Aún no hay escorts publicadas en {cityName}.
        {nearby.length > 0 ? " Estas son las más cercanas:" : ""}
      </p>
      {nearby.length > 0 && (
        <>
          <h2 className="text-lg font-bold text-white/70 mb-3">Escorts cerca de {cityName}</h2>
          <ul className="flex flex-wrap gap-2 mb-6">
            {nearby.map((p) => (
              <li key={p.id}>
                <Link
                  href={cleanProfileHref({ id: p.id, username: p.username, serviceCategory: p.serviceCategory, name: p.displayName || p.username, city: p.city })}
                  className="inline-block rounded-lg border border-white/10 bg-white/[0.03] px-3 py-1.5 text-sm text-white/60 hover:text-fuchsia-300 hover:border-fuchsia-500/30 transition"
                >
                  {p.displayName || p.username}
                  {p.city ? ` — ${p.city}` : ""}
                  {` (a ${Math.round(p.distance as number)} km)`}
                </Link>
              </li>
            ))}
          </ul>
        </>
      )}
      <p className="text-sm text-white/60">
        ¿Eres escort en {cityName}?{" "}
        <Link href="/publicar-anuncio-escort" className="text-fuchsia-300 hover:underline">
          Publica tu anuncio gratis
        </Link>{" "}
        y aparece primera en esta página.
      </p>
    </section>
  );
}
