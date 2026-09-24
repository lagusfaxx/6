import type { HomeCategory, HomeLevel, HomeProfile } from "./ProfileCard";

/** Filtros rápidos del inicio. "all" es sin filtro. */
export type QuickFilter = "all" | "availableNow" | "new" | "exams" | "video";

export type HomeCounts = {
  total: number;
  availableNow: number;
  new: number;
  exams: number;
  video: number;
};

export const EXAMS_TAG = "profesional con examenes";

type Location = {
  coords: [number, number] | null;
  city: string | null;
};

/**
 * Parámetros de /directory/search para una pestaña y un filtro. Las tres
 * secciones del inicio (Diamond, Gold, Silver) y los contadores salen de aquí,
 * así que siempre muestran el mismo universo de perfiles.
 */
export function buildSearchParams(
  category: HomeCategory,
  filter: QuickFilter,
  loc: Location,
  extra: Record<string, string> = {},
): URLSearchParams {
  const params = new URLSearchParams({
    entityType: "professional",
    sort: loc.coords ? "near" : "featured",
  });
  const profileTags: string[] = [];

  if (category === "masajes") {
    params.set("categorySlug", "masajes");
    params.set("gender", "FEMALE");
  } else if (category === "trans") {
    // Hay perfiles trans con categoría "trans" y otros como escort con la
    // etiqueta: la etiqueta es lo que define la pestaña.
    params.set("categorySlug", "escort,trans");
    profileTags.push("trans");
  } else {
    params.set("categorySlug", "escort");
    params.set("gender", "FEMALE");
  }

  if (filter === "availableNow") params.set("availableNow", "true");
  if (filter === "new") params.set("onlyNew", "true");
  if (filter === "video") params.set("withVideo", "true");
  if (filter === "exams") profileTags.push(EXAMS_TAG);
  if (profileTags.length) params.set("profileTags", profileTags.join(","));

  if (loc.coords) {
    params.set("lat", String(loc.coords[0]));
    params.set("lng", String(loc.coords[1]));
    // Radio amplio: en regiones con pocos perfiles igual aparecen los más cercanos.
    params.set("radiusKm", "2000");
  }
  if (loc.city) params.set("city", loc.city);

  for (const [k, v] of Object.entries(extra)) params.set(k, v);
  return params;
}

/** Normaliza un resultado de /directory/search a lo que usa la tarjeta. */
export function toHomeProfile(r: any): HomeProfile {
  const level: HomeLevel =
    r.userLevel === "DIAMOND" || r.userLevel === "GOLD" ? r.userLevel : "SILVER";
  return {
    id: String(r.id),
    displayName: r.displayName || r.username || "Perfil",
    age: typeof r.age === "number" ? r.age : null,
    city: r.city ?? null,
    nearestMetro: r.nearestMetro?.name ? { name: r.nearestMetro.name } : null,
    distance: typeof r.distance === "number" ? r.distance : null,
    availableNow: Boolean(r.availableNow),
    userLevel: level,
    avatarUrl: r.avatarUrl ?? null,
    coverUrl: r.coverUrl ?? null,
    galleryUrls: Array.isArray(r.galleryUrls) ? r.galleryUrls : [],
    profileTags: Array.isArray(r.profileTags) ? r.profileTags : [],
    serviceTags: Array.isArray(r.serviceTags) ? r.serviceTags : [],
    serviceCategory: r.serviceCategory ?? null,
    primaryCategory: r.primaryCategory ?? null,
    isNew: Boolean(r.isNew),
    hasVideo: Boolean(r.hasVideo),
  };
}
