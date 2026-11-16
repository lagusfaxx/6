/**
 * Tags de perfil y servicio con landing propia /escorts/{tag} (plantilla).
 * Los usa el sitemap y las landings de comuna, que enlazan los servicios más
 * ofrecidos en la zona a su página.
 */
export const ESCORT_TAGS = [
  // Físico
  "tetona", "culona", "delgada", "fitness", "gordita", "flaca", "curvy",
  // Apariencia
  "rubia", "morena", "pelirroja", "trigueña", "latina", "colombiana", "venezolana",
  // Personalidad
  "sumisa", "dominante", "caliente", "cariñosa", "natural", "discreta",
  // Estilo
  "tatuada", "piercing",
  // Edad
  "maduras", "jovenes",
  // Servicios
  "anal", "trios", "packs", "videollamada",
  "masaje-erotico", "despedidas", "discapacitados", "fetiches",
  "bdsm", "sexo-oral", "lluvia-dorada", "rol", "nuru", "tantra",
  // Disponibilidad
  "disponible-hoy", "24-horas",
  // /escorts/domicilio redirige a /escorts/a-domicilio (landing curada).
];
const TAG_SET = new Set<string>(ESCORT_TAGS);

/** "Sexo Oral" → "sexo-oral" si tiene landing; si no, null. */
export function escortTagSlug(tag: string): string | null {
  const slug = String(tag || "").toLowerCase().trim().replace(/\s+/g, "-");
  if (TAG_SET.has(slug)) return slug;
  const plain = slug.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  return TAG_SET.has(plain) ? plain : null;
}
