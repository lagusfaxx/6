/*
 * Tipos de servicio de una profesional. Puede marcar varios (ej. escort y
 * creadora de contenido). Quien marca sólo "contenido" vende contenido y no
 * atiende: no sale en el inicio ni en escorts, sólo en /contenido.
 * Misma lista que `SERVICE_CATEGORIES` de la API (lib/serviceCategories.ts).
 */
export const CONTENT_CATEGORY = "contenido";

export const SERVICE_CATEGORY_OPTIONS = [
  { value: "escort", label: "Escort", hint: "Acompañante", emoji: "💋" },
  { value: "masajes", label: "Masajista", hint: "Masajes", emoji: "💆" },
  { value: "despedidas", label: "Despedidas", hint: "De soltero", emoji: "🎉" },
  { value: "videollamadas", label: "Videollamadas", hint: "Solo online", emoji: "📱" },
  { value: CONTENT_CATEGORY, label: "Creadora de contenido", hint: "Fotos y videos", emoji: "📸" },
] as const;

export const SERVICE_CATEGORY_VALUES: string[] = SERVICE_CATEGORY_OPTIONS.map((o) => o.value);

/** Marca o desmarca un tipo, conservando el orden en que se eligieron. */
export function toggleServiceCategory(list: string[], value: string): string[] {
  return list.includes(value) ? list.filter((v) => v !== value) : [...list, value];
}

/**
 * Categoría principal que se manda junto a la lista (las secciones de escorts
 * filtran por ella): la primera presencial elegida, o "contenido" si sólo
 * vende contenido.
 */
export function primaryFromServiceCategories(list: string[]): string {
  return list.find((v) => v !== CONTENT_CATEGORY) ?? list[0] ?? "";
}

export function isContentOnly(list: string[] | null | undefined): boolean {
  const l = list ?? [];
  return l.includes(CONTENT_CATEGORY) && l.every((v) => v === CONTENT_CATEGORY);
}
