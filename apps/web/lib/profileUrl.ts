/**
 * URLs semánticas de perfil.
 *
 * Los perfiles se resuelven por UUID (clave estable en la API), pero la URL
 * pública añade un slug legible `{nombre}-{ciudad}` para keyword-in-URL, CTR y
 * long-tail (nombre artístico + ciudad). El UUID sigue siendo el primer
 * segmento, así que ninguna URL antigua se rompe: /profesional/{uuid} redirige
 * (301) a /profesional/{uuid}/{slug}.
 */

// Rango de marcas diacríticas combinantes (U+0300–U+036F) para quitar tildes/ñ.
const COMBINING_MARKS = new RegExp("[\\u0300-\\u036f]", "g");

export function slugify(input: string): string {
  return input
    .toLowerCase()
    .normalize("NFD")
    .replace(COMBINING_MARKS, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60)
    .replace(/-+$/g, "");
}

/** Slug canónico de un perfil a partir de su nombre y ciudad. Puede ser "". */
export function profileSlug(name?: string | null, city?: string | null): string {
  return slugify([name, city].filter(Boolean).join(" "));
}

/** Ruta canónica de un perfil. Si no hay slug computable, cae a la UUID sola. */
export function profileHref(id: string, name?: string | null, city?: string | null): string {
  const slug = profileSlug(name, city);
  return slug ? `/profesional/${id}/${slug}` : `/profesional/${id}`;
}

/* ─────────────────────────────────────────────────────────────────────────
 * URLs LIMPIAS por username: /{categoria}/{username} (ej: /escort/sofia).
 * El username es único, así que la URL no lleva código. La palabra de categoría
 * (escort/masajista) aporta keyword-in-URL. Las URLs antiguas /profesional/{id}
 * se mantienen y redirigen 301 a la limpia, así no se rompe nada.
 * ──────────────────────────────────────────────────────────────────────── */

/** Palabras de categoría soportadas como segmento raíz de URL de perfil. */
export type ProfileCategoryWord = "escort" | "masajista";

/**
 * Un username sirve para URL limpia solo si ya es URL-safe (minúsculas, dígitos
 * y guiones simples, sin guion al inicio/fin). Los que tienen mayúsculas o
 * espacios ("Coni", "Jhon Jairo JJ") caen a la URL antigua por /profesional.
 */
export function isCleanUsername(username?: string | null): username is string {
  return !!username && /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(username);
}

/** Mapea la categoría de servicio del perfil a la palabra de URL. */
export function categoryWord(serviceCategory?: string | null): ProfileCategoryWord {
  const c = (serviceCategory || "").toLowerCase().normalize("NFD").replace(COMBINING_MARKS, "");
  if (c.includes("masaj")) return "masajista";
  return "escort"; // por defecto para profesionales
}

/**
 * Ruta pública limpia del perfil. Si el username es URL-safe devuelve
 * /{categoria}/{username}; si no, cae a la ruta antigua /profesional/{id}/{slug}
 * (que sigue funcionando). Nunca rompe: siempre hay una URL válida.
 */
export function cleanProfileHref(args: {
  id: string;
  username?: string | null;
  serviceCategory?: string | null;
  name?: string | null;
  city?: string | null;
}): string {
  if (isCleanUsername(args.username)) {
    return `/${categoryWord(args.serviceCategory)}/${args.username}`;
  }
  return profileHref(args.id, args.name, args.city);
}
