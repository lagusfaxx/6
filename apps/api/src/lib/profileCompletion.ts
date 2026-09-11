/**
 * Qué necesita una ficha para estar completa.
 *
 * La ficha pública (apps/web/app/profesional/_components/ProfileDetailView.tsx)
 * muestra foto, datos físicos, tarifa, zona y servicios. Un perfil al que le
 * faltan la mitad de esos campos se ve como un anuncio a medio hacer, y el
 * cliente lo salta. Por eso el perfil no se publica hasta que estén: la
 * exigencia vive acá, en el servidor, y la interfaz sólo la refleja.
 *
 * Los perfiles que ya estaban publicados antes de esta regla no se tocan (ver
 * `profileCompletedAt` en el esquema): esos los completa el equipo desde el
 * panel, que para eso puede editar la ficha entera.
 */

export type ProfileFieldKey =
  | "photos"
  | "birthdate"
  | "heightCm"
  | "weightKg"
  | "measurements"
  | "hairColor"
  | "skinTone"
  | "baseRate"
  | "city"
  | "phone"
  | "bio"
  | "serviceTags";

export type ProfileFieldSpec = {
  key: ProfileFieldKey;
  /** Cómo se llama en la ficha, no cómo se llama la columna. */
  label: string;
  /** Pestaña del estudio donde se completa. */
  tab: "profile" | "photos" | "services" | "location";
};

/**
 * Datos que se pueden dejar en "prefiero no decirlo".
 *
 * Son los personales: suman al anuncio, pero obligar a publicarlos es pedirle
 * a alguien que exponga su cuerpo en números para poder trabajar. Marcarlos
 * cuenta como resuelto y en la ficha pública no aparecen.
 *
 * El resto no está acá y no es por descuido:
 *  - `birthdate` sostiene el mayor de 18, que es legal y no opinable;
 *  - `photos`, `phone` y `city` son el anuncio mismo — sin foto no hay qué
 *    mirar, sin número no hay por dónde escribir y sin comuna no hay cómo
 *    encontrarla;
 *  - `bio` y `serviceTags` son lo que se lee y por lo que se filtra: un perfil
 *    sin ellos no aparece en ninguna búsqueda.
 */
export const OPTOUT_ELIGIBLE_FIELDS: ReadonlySet<string> = new Set([
  "heightCm",
  "weightKg",
  "measurements",
  "hairColor",
  "skinTone",
  "baseRate",
]);

/** Deja sólo las claves que de verdad admiten "prefiero no decirlo". */
export function sanitizeUndisclosedFields(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  const seen = new Set<string>();
  for (const raw of value) {
    const key = String(raw).trim();
    if (OPTOUT_ELIGIBLE_FIELDS.has(key)) seen.add(key);
  }
  return [...seen];
}

export const MIN_PROFILE_PHOTOS = 3;
export const MIN_PROFILE_BIO_LENGTH = 20;

export const REQUIRED_PROFILE_FIELDS: ProfileFieldSpec[] = [
  { key: "photos", label: `Al menos ${MIN_PROFILE_PHOTOS} fotos`, tab: "photos" },
  { key: "birthdate", label: "Fecha de nacimiento", tab: "profile" },
  { key: "heightCm", label: "Estatura", tab: "profile" },
  { key: "weightKg", label: "Peso", tab: "profile" },
  { key: "measurements", label: "Medidas", tab: "profile" },
  { key: "hairColor", label: "Color de cabello", tab: "profile" },
  { key: "skinTone", label: "Tono de piel", tab: "profile" },
  { key: "baseRate", label: "Tarifa", tab: "services" },
  { key: "serviceTags", label: "Servicios que ofreces", tab: "services" },
  { key: "city", label: "Comuna", tab: "location" },
  { key: "phone", label: "Número de WhatsApp", tab: "profile" },
  { key: "bio", label: "Descripción del perfil", tab: "profile" },
];

type ProfileLike = {
  birthdate?: Date | string | null;
  heightCm?: number | null;
  weightKg?: number | null;
  measurements?: string | null;
  hairColor?: string | null;
  skinTone?: string | null;
  baseRate?: number | null;
  city?: string | null;
  phone?: string | null;
  bio?: string | null;
  serviceTags?: string[] | null;
  undisclosedFields?: string[] | null;
};

function filled(value: unknown): boolean {
  if (value === null || value === undefined) return false;
  if (typeof value === "string") return value.trim().length > 0;
  if (typeof value === "number") return Number.isFinite(value) && value > 0;
  if (Array.isArray(value)) return value.length > 0;
  return Boolean(value);
}

/** Campos que le faltan a la ficha para poder publicarse. */
export function missingProfileFields(
  profile: ProfileLike,
  photoCount: number,
): ProfileFieldSpec[] {
  const undisclosed = new Set(sanitizeUndisclosedFields(profile.undisclosedFields));
  return REQUIRED_PROFILE_FIELDS.filter((field) => {
    // "Prefiero no decirlo" es una respuesta: el dato queda resuelto aunque la
    // columna esté vacía.
    if (undisclosed.has(field.key)) return false;
    if (field.key === "photos") return photoCount < MIN_PROFILE_PHOTOS;
    if (field.key === "bio")
      return String(profile.bio ?? "").trim().length < MIN_PROFILE_BIO_LENGTH;
    return !filled((profile as Record<string, unknown>)[field.key]);
  });
}

export function isProfileComplete(profile: ProfileLike, photoCount: number): boolean {
  return missingProfileFields(profile, photoCount).length === 0;
}

/**
 * Qué hacer con la publicación del perfil al guardar.
 *
 * Está aparte y sin dependencias para poder probarla sola: es la regla que
 * decide si un anuncio se ve o no, y equivocarse acá saca perfiles del aire.
 *
 *  - "blocked": pidió publicar con la ficha incompleta → error, no se guarda.
 *  - "hold": nunca estuvo publicado y sigue incompleto → se guarda apagado.
 *  - "publish": la ficha quedó completa por primera vez → se publica.
 *  - "keep": no se toca la publicación (el caso de todos los perfiles que ya
 *    estaban al aire, completos o no).
 */
export type PublicationDecision = "blocked" | "hold" | "publish" | "keep";

export function resolvePublication(input: {
  /** Fecha en que la ficha se completó por primera vez, si ya pasó. */
  profileCompletedAt: Date | string | null | undefined;
  /** Si el perfil está publicado ahora mismo. */
  isActive: boolean;
  /** Lo que pidió la petición: true publicar, false despublicar, undefined nada. */
  requestedActive: boolean | undefined;
  /** Cuántos campos obligatorios faltan después de este guardado. */
  missingCount: number;
}): PublicationDecision {
  const everCompleted = Boolean(input.profileCompletedAt);

  if (input.missingCount > 0) {
    if (input.requestedActive === true) return "blocked";
    // Nunca publicado y todavía incompleto: se guarda, pero apagado. A un
    // perfil que ya está al aire no se le baja el anuncio por esto.
    if (!everCompleted && !input.isActive) return "hold";
    return "keep";
  }

  // Ficha completa. La primera vez además se publica sola, salvo que la
  // petición diga expresamente lo contrario.
  if (!everCompleted && input.requestedActive === undefined) return "publish";
  return "keep";
}
