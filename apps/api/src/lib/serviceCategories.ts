import type { Prisma } from "@prisma/client";

/**
 * Tipos de servicio que puede marcar una profesional. Puede elegir varios
 * (ej. escort + creadora de contenido). Quien marca sólo "contenido" vende
 * contenido y no atiende: no sale en el inicio ni en las secciones de
 * escorts, sólo en /contenido.
 */
export const CONTENT_CATEGORY = "contenido";
export const IN_PERSON_CATEGORIES = ["escort", "masajes", "despedidas", "videollamadas"] as const;
export const SERVICE_CATEGORIES = [...IN_PERSON_CATEGORIES, CONTENT_CATEGORY] as const;

const ALIASES: Record<string, string> = {
  escorts: "escort",
  acompanante: "escort",
  acompanamiento: "escort",
  masaje: "masajes",
  masajista: "masajes",
  despedida: "despedidas",
  videollamada: "videollamadas",
  creadora: CONTENT_CATEGORY,
  "creadora de contenido": CONTENT_CATEGORY,
  creadoras: CONTENT_CATEGORY,
};

function normalize(value: unknown) {
  const v = String(value ?? "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .trim();
  return ALIASES[v] ?? v;
}

/**
 * Lee los tipos de servicio que manda el formulario: arreglo, JSON o texto
 * separado por comas (el registro llega como multipart). Sólo deja valores
 * conocidos, sin repetir. Si no llega ninguno válido usa `primaryCategory`,
 * así los formularios que todavía mandan una sola categoría siguen igual.
 */
export function parseServiceCategories(raw: unknown, primaryCategory?: string | null): string[] {
  let list: unknown[] = [];
  if (Array.isArray(raw)) list = raw;
  else if (typeof raw === "string" && raw.trim()) {
    const text = raw.trim();
    if (text.startsWith("[")) {
      try {
        const parsed = JSON.parse(text);
        if (Array.isArray(parsed)) list = parsed;
      } catch {
        list = [];
      }
    } else list = text.split(",");
  }
  const known = new Set<string>(SERVICE_CATEGORIES);
  const out: string[] = [];
  for (const item of list) {
    const v = normalize(item);
    if (known.has(v) && !out.includes(v)) out.push(v);
  }
  if (!out.length) {
    const p = normalize(primaryCategory);
    if (known.has(p)) out.push(p);
  }
  return out;
}

/**
 * Categoría principal a partir de la lista: la primera presencial que eligió
 * (las secciones de escorts filtran por ella) o "contenido" si sólo vende
 * contenido. `null` si la lista viene vacía.
 */
export function primaryFromServiceCategories(categories: string[]): string | null {
  return categories.find((c) => c !== CONTENT_CATEGORY) ?? categories[0] ?? null;
}

export function isContentOnly(categories: string[] | null | undefined): boolean {
  const list = categories ?? [];
  return list.includes(CONTENT_CATEGORY) && !list.some((c) => c !== CONTENT_CATEGORY);
}

/**
 * Perfiles que atienden (todos menos las que sólo venden contenido). Usa
 * sólo la clave NOT, así se puede esparcir en un where que ya ocupa OR/AND.
 */
export function notContentOnlyWhere(): Prisma.UserWhereInput {
  return {
    NOT: {
      AND: [
        { serviceCategories: { has: CONTENT_CATEGORY } },
        { NOT: { serviceCategories: { hasSome: [...IN_PERSON_CATEGORIES] } } },
      ],
    },
  };
}

/** Creadoras de contenido (sólo contenido o contenido + otros servicios). */
export function contentCreatorWhere(): Prisma.UserWhereInput {
  return { serviceCategories: { has: CONTENT_CATEGORY } };
}

/** Saca del listado a las que sólo venden contenido, como `withActivePlan`. */
export function excludeContentOnly<T extends object>(where: T): T {
  return { AND: [where, notContentOnlyWhere()] } as unknown as T;
}
