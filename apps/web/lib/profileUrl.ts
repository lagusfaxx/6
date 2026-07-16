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
