/**
 * Helpers para extraer IP real y código de país del visitante a partir
 * de los headers que ya pasan Cloudflare/Traefik en producción.
 *
 * Diseñado para ser llamado desde un Route Handler / Server Component
 * con el objeto `Headers` o `NextRequest`.
 */

const FORWARDED_FOR = "x-forwarded-for";
const REAL_IP = "x-real-ip";
const CF_IP = "cf-connecting-ip";
const CF_COUNTRY = "cf-ipcountry";
const VERCEL_COUNTRY = "x-vercel-ip-country";
const FLY_REGION = "fly-client-ip";

const PRIVATE_IP_RANGES = [
  /^10\./,
  /^192\.168\./,
  /^172\.(1[6-9]|2\d|3[0-1])\./,
  /^127\./,
  /^169\.254\./,
  /^::1$/,
  /^fc00:/i,
  /^fd00:/i,
  /^fe80:/i,
];

function isPrivate(ip: string): boolean {
  return PRIVATE_IP_RANGES.some((re) => re.test(ip));
}

/**
 * Devuelve la IP pública del visitante con la mejor heurística posible.
 * Si no se puede determinar, devuelve `null` y el caller debe pasar
 * "request_ip" al API de chaturbate (su valor especial para usar la
 * IP detectada por su edge).
 */
export function getClientIp(headers: Headers): string | null {
  const cf = headers.get(CF_IP);
  if (cf && !isPrivate(cf)) return cf.trim();

  const real = headers.get(REAL_IP);
  if (real && !isPrivate(real)) return real.trim();

  const fly = headers.get(FLY_REGION);
  if (fly && !isPrivate(fly)) return fly.trim();

  const fwd = headers.get(FORWARDED_FOR);
  if (fwd) {
    // x-forwarded-for: "client, proxy1, proxy2" — el primero es el cliente
    const candidates = fwd
      .split(",")
      .map((p) => p.trim())
      .filter(Boolean);
    for (const ip of candidates) {
      if (!isPrivate(ip)) return ip;
    }
  }

  return null;
}

const VALID_COUNTRY = /^[A-Za-z]{2}$/;

/**
 * Devuelve el código ISO 3166-1 alpha-2 del visitante (mayúsculas) o null
 * si no se puede determinar a partir de los headers del edge.
 */
export function getClientCountry(headers: Headers): string | null {
  const cf = headers.get(CF_COUNTRY);
  if (cf && VALID_COUNTRY.test(cf) && cf.toUpperCase() !== "XX") {
    return cf.toUpperCase();
  }
  const vercel = headers.get(VERCEL_COUNTRY);
  if (vercel && VALID_COUNTRY.test(vercel)) {
    return vercel.toUpperCase();
  }
  return null;
}

export interface GeoInfo {
  ip: string | null;
  country: string | null;
}

export function getGeoFromHeaders(headers: Headers): GeoInfo {
  return {
    ip: getClientIp(headers),
    country: getClientCountry(headers),
  };
}
