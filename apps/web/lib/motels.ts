import { COMUNAS, distanceKm, getComuna, resolveComuna, type Comuna } from "./comunas";

/**
 * Directorio de moteles: tipos, lectura desde la API (en el servidor, para que
 * Google reciba el HTML con los moteles) y utilidades de precio y comuna.
 */

export type MotelDurationKey = "3H" | "6H" | "NIGHT";

export type DirectoryMotel = {
  id: string;
  slug: string;
  kind: "profile" | "listing";
  name: string;
  city: string | null;
  address: string | null;
  latitude: number | null;
  longitude: number | null;
  coverUrl: string | null;
  photos: string[];
  isOpen: boolean;
  amenities: string[];
  roomAmenities: string[];
  roomsCount: number;
  prices: Record<MotelDurationKey, number | null>;
  promo: { title: string; discountPercent: number | null; discountClp: number | null } | null;
  rating: number | null;
  reviewsCount: number;
  websiteUrl: string | null;
  schedule: string | null;
  updatedAt: string;
};

/** Motel del directorio con su comuna ya resuelta. */
export type MotelWithComuna = DirectoryMotel & {
  comunaSlug: string | null;
  comunaName: string | null;
  region: string | null;
};

export type MotelRoom = {
  id: string;
  name: string;
  description: string | null;
  roomType: string | null;
  amenities: string[];
  photoUrls: string[];
  price3h: number | null;
  price6h: number | null;
  priceNight: number | null;
};

export type MotelPromotion = {
  id: string;
  title: string;
  description: string | null;
  discountPercent: number | null;
  discountClp: number | null;
  roomIds: string[];
  endsAt: string | null;
};

export type MotelDetail = {
  id: string;
  slug: string;
  kind: "profile" | "listing";
  isOwner: boolean;
  name: string;
  city: string | null;
  address: string | null;
  phone: string | null;
  latitude: number | null;
  longitude: number | null;
  coverUrl: string | null;
  avatarUrl: string | null;
  description: string | null;
  schedule: string | null;
  amenities: string[];
  isOpen: boolean;
  isPublished: boolean;
  isVerified: boolean;
  gallery: string[];
  rooms: MotelRoom[];
  promotions: MotelPromotion[];
  rating: number | null;
  reviewsCount: number;
  reviews: { id: string; stars: number; comment: string | null; createdAt: string }[];
  websiteUrl: string | null;
  updatedAt: string;
};

const SITE = "https://uzeed.cl";

function apiBase() {
  return (process.env.NEXT_PUBLIC_API_URL || process.env.API_URL || "https://api.uzeed.cl").replace(/\/+$/, "");
}

export function siteUrl(path: string) {
  return `${SITE}${path}`;
}

export async function fetchMotelDirectory(): Promise<MotelWithComuna[]> {
  try {
    const res = await fetch(`${apiBase()}/motels/directory`, {
      next: { revalidate: 300 },
      headers: { Accept: "application/json" },
    });
    if (!res.ok) return [];
    const data = (await res.json()) as { motels?: DirectoryMotel[] };
    return (data.motels || []).map(withComuna);
  } catch {
    return [];
  }
}

export async function fetchMotelDetail(ref: string): Promise<MotelDetail | null> {
  try {
    const res = await fetch(`${apiBase()}/motels/page/${encodeURIComponent(ref)}`, {
      next: { revalidate: 120 },
      headers: { Accept: "application/json" },
    });
    if (!res.ok) return null;
    const data = (await res.json()) as { motel?: MotelDetail };
    return data.motel || null;
  } catch {
    return null;
  }
}

export function withComuna(m: DirectoryMotel): MotelWithComuna {
  const c = resolveComuna(m.city, m.latitude, m.longitude);
  return { ...m, comunaSlug: c?.slug ?? null, comunaName: c?.name ?? m.city ?? null, region: c?.region ?? null };
}

export function motelHref(m: { slug: string }) {
  return `/motel/${m.slug}`;
}

/** Precio "desde" para la duración pedida; si no la ofrece, la más barata que tenga. */
export function priceFrom(m: Pick<DirectoryMotel, "prices">, duration: MotelDurationKey = "3H") {
  const exact = m.prices[duration];
  if (exact) return { price: exact, duration };
  for (const d of ["3H", "6H", "NIGHT"] as MotelDurationKey[]) {
    if (m.prices[d]) return { price: m.prices[d] as number, duration: d };
  }
  return null;
}

export const DURATION_LABEL: Record<MotelDurationKey, string> = { "3H": "3 horas", "6H": "6 horas", NIGHT: "noche" };
export const DURATION_SHORT: Record<MotelDurationKey, string> = { "3H": "3 h", "6H": "6 h", NIGHT: "noche" };

export function formatClp(value?: number | null) {
  return `$${Math.round(Number(value || 0)).toLocaleString("es-CL")}`;
}

export function promoLabel(p: { discountPercent: number | null; discountClp: number | null }) {
  if (p.discountPercent) return `-${p.discountPercent}%`;
  if (p.discountClp) return `-${formatClp(p.discountClp)}`;
  return "Promo";
}

export function applyPromo(price: number, p?: { discountPercent: number | null; discountClp: number | null } | null) {
  if (!p) return price;
  if (p.discountPercent) return Math.max(0, Math.round(price * (1 - p.discountPercent / 100)));
  if (p.discountClp) return Math.max(0, price - p.discountClp);
  return price;
}

/**
 * Moteles para la landing de una comuna: los de la comuna y, aparte, los más
 * cercanos (hasta 12 km) para que la página nunca quede vacía.
 */
export function motelsForComuna(all: MotelWithComuna[], comuna: Comuna) {
  if (comuna.isMetro) {
    const inside = all.filter((m) => m.region === comuna.region);
    return { inside, nearby: [] as Array<MotelWithComuna & { distanceKm: number }> };
  }
  const inside = all.filter((m) => m.comunaSlug === comuna.slug);
  const nearby = all
    .filter((m) => m.comunaSlug !== comuna.slug && m.latitude != null && m.longitude != null)
    .map((m) => ({ ...m, distanceKm: distanceKm(comuna.lat, comuna.lng, m.latitude as number, m.longitude as number) }))
    .filter((m) => m.distanceKm <= 12)
    .sort((a, b) => a.distanceKm - b.distanceKm)
    .slice(0, 12);
  return { inside, nearby };
}

/** Cantidad de moteles por comuna, para los enlaces "Moteles por comuna". */
export function countByComuna(all: MotelWithComuna[]) {
  const counts = new Map<string, number>();
  for (const m of all) {
    if (m.comunaSlug) counts.set(m.comunaSlug, (counts.get(m.comunaSlug) || 0) + 1);
  }
  return counts;
}

export function comunaForMotel(m: { city: string | null; latitude: number | null; longitude: number | null }) {
  return resolveComuna(m.city, m.latitude, m.longitude);
}

export { COMUNAS, getComuna };
