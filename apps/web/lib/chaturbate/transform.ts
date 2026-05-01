/**
 * Helpers para normalizar datos del API externo al modelo público de uzeed
 * y para construir URLs de iframe con tracking de fuente.
 */

import type { ChaturbateRoom, ExternalLiveCam } from "./types";

/**
 * Códigos ISO 3166-1 alpha-2 → nombre de país en español.
 * Lista corta priorizando LATAM (mejor conversión de la audiencia chilena)
 * y los principales mercados emisores. Lo demás cae al fallback.
 */
const COUNTRY_NAMES_ES: Record<string, string> = {
  AR: "Argentina",
  BO: "Bolivia",
  BR: "Brasil",
  CL: "Chile",
  CO: "Colombia",
  CR: "Costa Rica",
  CU: "Cuba",
  DO: "República Dominicana",
  EC: "Ecuador",
  GT: "Guatemala",
  HN: "Honduras",
  MX: "México",
  NI: "Nicaragua",
  PA: "Panamá",
  PE: "Perú",
  PR: "Puerto Rico",
  PY: "Paraguay",
  SV: "El Salvador",
  UY: "Uruguay",
  VE: "Venezuela",
  ES: "España",
  US: "Estados Unidos",
  CA: "Canadá",
  GB: "Reino Unido",
  IT: "Italia",
  FR: "Francia",
  DE: "Alemania",
  PT: "Portugal",
  RU: "Rusia",
  UA: "Ucrania",
  RO: "Rumania",
  PL: "Polonia",
  CZ: "República Checa",
  NL: "Países Bajos",
};

const NUMERIC_OR_PUNCT = /[_.\-\d]+/g;

/**
 * Convierte usernames técnicos en algo presentable.
 * Ejemplos:
 *   sample_streamer_22 → "Sample"
 *   maria.lopez23      → "Maria"
 *   xx_paula_xx        → "Paula"
 *   linda              → "Linda"
 */
export function humanizeUsername(username: string): string {
  const trimmed = (username || "").trim();
  if (!trimmed) return "Modelo";

  const tokens = trimmed
    .split(NUMERIC_OR_PUNCT)
    .map((t) => t.trim())
    .filter((t) => t.length >= 2 && /[A-Za-zÀ-ÿ]/.test(t));

  // Tokens "x", "xx", "xxx" se filtran por longitud >= 2 ya, pero hay
  // patrones como "x_paula" donde el primero es vacío luego del split.
  // Tomamos el primer token significativo, si no hay, fallback al input.
  const pick = tokens[0] || trimmed;
  const cleaned = pick.replace(/[^A-Za-zÀ-ÿ]/g, "");
  if (!cleaned) return "Modelo";

  return cleaned[0].toUpperCase() + cleaned.slice(1).toLowerCase();
}

export function countryToSpanish(code: string | null | undefined): string | null {
  if (!code) return null;
  const upper = code.trim().toUpperCase();
  if (!upper) return null;
  return COUNTRY_NAMES_ES[upper] ?? null;
}

/**
 * Recorta una location libre ("Bogotá, Colombia") a un texto corto.
 * Si el formato es "Ciudad, País", deja "Ciudad".
 */
export function shortLocation(location: string | null | undefined): string | null {
  if (!location) return null;
  const trimmed = location.trim();
  if (!trimmed) return null;
  const [first] = trimmed.split(",");
  return first.trim() || null;
}

function pickAge(room: ChaturbateRoom): number | null {
  if (typeof room.display_age === "number" && room.display_age > 0) return room.display_age;
  if (typeof room.age === "number" && room.age > 0) return room.age;
  return null;
}

/**
 * El campo `chat_room_url_revshare` del API a veces apunta a la página
 * pública del modelo (`https://chaturbate.com/<username>/?...`), que tiene
 * `X-Frame-Options: DENY` y no se puede embeber. Para iframe necesitamos
 * el endpoint `/in/?room=<username>&...` (o `/embed/`) — el "tour" de
 * afiliados que sí permite embed.
 *
 * Esta función reescribe el path a `/in/` cuando detecta el formato de
 * página pública, preservando intactos todos los query params (campaign,
 * tour, room, disable_sound, join_overlay, etc.). Si la URL ya viene en
 * un formato embebible la deja igual.
 */
export function toEmbeddableUrl(rawUrl: string, fallbackUsername: string): string {
  if (!rawUrl) return rawUrl;
  try {
    const url = new URL(rawUrl);
    // Paths que ya son embebibles — no tocar.
    if (/^\/(in|embed)\/?$/i.test(url.pathname)) return url.toString();
    // Path de un solo segmento: la página pública del modelo. Reescribir.
    const match = url.pathname.match(/^\/([^/]+)\/?$/);
    if (match) {
      const room = match[1];
      url.pathname = "/in/";
      if (!url.searchParams.has("room")) {
        url.searchParams.set("room", room || fallbackUsername);
      }
    }
    return url.toString();
  } catch {
    return rawUrl;
  }
}

export function toExternalLiveCam(room: ChaturbateRoom): ExternalLiveCam {
  return {
    source: "external",
    username: room.username,
    displayName: humanizeUsername(room.username),
    age: pickAge(room),
    countryCode: room.country ? room.country.toUpperCase() : null,
    countryName: countryToSpanish(room.country),
    location: shortLocation(room.location),
    thumbnailUrl: room.image_url,
    thumbnailUrlSmall: room.image_url_360x270 || room.image_url,
    viewerCount: typeof room.num_users === "number" ? room.num_users : 0,
    isHd: Boolean(room.is_hd),
    isNew: Boolean(room.is_new),
    tags: Array.isArray(room.tags) ? room.tags.slice(0, 6) : [],
    // Normalizamos a un path embebible (/in/?room=...) para evitar el
    // X-Frame-Options: DENY de la página pública.
    embedUrl: toEmbeddableUrl(room.chat_room_url_revshare, room.username),
  };
}

/**
 * Tipos de fuente de tráfico — el tracking se asocia a estas keys
 * y luego se contrasta en el dashboard del programa de afiliados.
 */
export type TrackSource =
  | "live_grid"
  | "home_row"
  | "perfil_reco"
  | "sidebar_reco"
  | "live_cam_page";

const TRACK_PARAM_BY_SOURCE: Record<TrackSource, string> = {
  live_grid: "uzeed_live_grid",
  home_row: "uzeed_home_row",
  perfil_reco: "uzeed_perfil_reco",
  sidebar_reco: "uzeed_sidebar_reco",
  live_cam_page: "uzeed_live_cam_page",
};

export function trackParamFor(source: TrackSource): string {
  return TRACK_PARAM_BY_SOURCE[source];
}

/**
 * Agrega ?track=uzeed_live_<source> al URL del iframe sin pisar otros
 * parámetros (chat_room_url_revshare ya trae wm, tour, campaign, etc.).
 * Devuelve null si la URL es inválida.
 */
export function withTrack(embedUrl: string, source: TrackSource): string | null {
  if (!embedUrl) return null;
  const trackValue = trackParamFor(source);
  try {
    const url = new URL(embedUrl);
    url.searchParams.set("track", trackValue);
    return url.toString();
  } catch {
    // URL relativa o malformada — fallback simple
    const sep = embedUrl.includes("?") ? "&" : "?";
    return `${embedUrl}${sep}track=${encodeURIComponent(trackValue)}`;
  }
}
