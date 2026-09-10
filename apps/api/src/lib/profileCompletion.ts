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
  return REQUIRED_PROFILE_FIELDS.filter((field) => {
    if (field.key === "photos") return photoCount < MIN_PROFILE_PHOTOS;
    if (field.key === "bio")
      return String(profile.bio ?? "").trim().length < MIN_PROFILE_BIO_LENGTH;
    return !filled((profile as Record<string, unknown>)[field.key]);
  });
}

export function isProfileComplete(profile: ProfileLike, photoCount: number): boolean {
  return missingProfileFields(profile, photoCount).length === 0;
}
