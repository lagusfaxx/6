/**
 * Qué necesita una ficha para poder publicarse.
 *
 * Es el espejo de apps/api/src/lib/profileCompletion.ts. La que manda es la del
 * servidor: acá está para poder marcar los campos que faltan mientras la
 * profesional escribe, sin ir y volver a la API en cada tecla. Si se agrega un
 * campo obligatorio hay que agregarlo en los dos lados.
 */

import type { DashboardFormState } from "../hooks/useDashboardForm";

export const MIN_PROFILE_PHOTOS = 3;
export const MIN_PROFILE_BIO_LENGTH = 20;

/** Pestaña del estudio donde se completa cada campo. */
export type StudioTab = "perfil" | "galeria" | "ubicacion";

export type RequiredField = {
  key: string;
  label: string;
  tab: StudioTab;
  complete: boolean;
  /** Resuelto con "prefiero no decirlo" en vez de con un dato. */
  undisclosed: boolean;
};

/**
 * Datos que admiten "prefiero no decirlo" (espejo de OPTOUT_ELIGIBLE_FIELDS en
 * el servidor). Son los personales: obligar a publicarlos es pedirle a alguien
 * que exponga su cuerpo en números para poder trabajar.
 *
 * El resto no está acá a propósito: la fecha de nacimiento sostiene el mayor de
 * 18, y fotos, WhatsApp, comuna, descripción y servicios son el anuncio mismo
 * — sin ellos no hay qué mirar, por dónde escribir ni cómo encontrarla.
 */
export const OPTOUT_ELIGIBLE_FIELDS = [
  "heightCm",
  "weightKg",
  "measurements",
  "hairColor",
  "skinTone",
  "baseRate",
] as const;

export type OptOutField = (typeof OPTOUT_ELIGIBLE_FIELDS)[number];

export function canOptOut(key: string): key is OptOutField {
  return (OPTOUT_ELIGIBLE_FIELDS as readonly string[]).includes(key);
}

export function requiredProfileFields(state: DashboardFormState): RequiredField[] {
  const photos = state.gallery.filter(
    (g) => String(g.type).toUpperCase() !== "VIDEO",
  ).length;
  const undisclosed = new Set<string>(
    (state.undisclosedFields ?? []).filter((k) => canOptOut(k)),
  );

  const field = (
    key: string,
    label: string,
    tab: StudioTab,
    filled: boolean,
  ): RequiredField => {
    const hidden = undisclosed.has(key);
    // "Prefiero no decirlo" es una respuesta: el dato queda resuelto.
    return { key, label, tab, complete: hidden || filled, undisclosed: hidden };
  };

  return [
    field("photos", `Al menos ${MIN_PROFILE_PHOTOS} fotos`, "galeria", photos >= MIN_PROFILE_PHOTOS),
    field("phone", "Número de WhatsApp", "perfil", !!state.phone.trim()),
    field("birthdate", "Fecha de nacimiento", "perfil", !!state.birthdate),
    field("bio", "Descripción del perfil", "perfil", state.bio.trim().length >= MIN_PROFILE_BIO_LENGTH),
    field("heightCm", "Estatura", "perfil", !!state.heightCm),
    field("weightKg", "Peso", "perfil", !!state.weightKg),
    field("measurements", "Medidas", "perfil", !!state.measurements.trim()),
    field("hairColor", "Color de cabello", "perfil", !!state.hairColor.trim()),
    field("skinTone", "Tono de piel", "perfil", !!state.skinTone.trim()),
    field("baseRate", "Tarifa", "perfil", Number(state.baseRate) > 0),
    field("serviceTags", "Servicios que ofreces", "perfil", state.serviceTags.length > 0),
    field("city", "Comuna", "ubicacion", !!state.city.trim()),
  ];
}

export function missingProfileFields(state: DashboardFormState): RequiredField[] {
  return requiredProfileFields(state).filter((f) => !f.complete);
}

/** Los campos obligatorios por clave, para el contador de cada sección. */
export function requiredFieldsByKey(
  state: DashboardFormState,
): Record<string, RequiredField> {
  const map: Record<string, RequiredField> = {};
  for (const f of requiredProfileFields(state)) map[f.key] = f;
  return map;
}

/**
 * Lleva el foco al campo que falta.
 *
 * El estudio monta el editor dos veces — una para el escritorio y otra para el
 * teléfono — y sólo esconde con CSS la que no toca. Buscar por `id` devolvía
 * siempre la primera del documento, la del escritorio: en el teléfono esa está
 * en `display:none`, así que el scroll y el foco no hacían nada y el botón
 * "Completar" parecía roto. Por eso se busca por atributo y se elige la copia
 * que de verdad está en pantalla.
 *
 * La pestaña además se monta con animación, así que el control puede no existir
 * todavía al hacer click: se reintenta unos frames antes de rendirse.
 */
export function focusRequiredField(key: string, attempt = 0): void {
  if (typeof document === "undefined") return;

  const candidates = Array.from(
    document.querySelectorAll<HTMLElement>(`[data-studio-field="${key}"]`),
  );
  // offsetParent nulo = la copia escondida del otro breakpoint.
  const el = candidates.find((n) => n.offsetParent !== null);

  if (!el) {
    if (attempt < 40) {
      requestAnimationFrame(() => focusRequiredField(key, attempt + 1));
    }
    return;
  }

  el.scrollIntoView({ behavior: "smooth", block: "center" });

  /* En el teléfono no se abre el teclado solo: el salto de la pantalla al
     enfocar tapa el campo al que se acaba de llegar. Se marca y se deja que
     ella toque. */
  const coarsePointer =
    typeof window !== "undefined" &&
    typeof window.matchMedia === "function" &&
    window.matchMedia("(pointer: coarse)").matches;

  if (!coarsePointer) {
    const focusable = el.matches("input, select, textarea, button, [tabindex]")
      ? el
      : el.querySelector<HTMLElement>(
          "input:not([type=hidden]), select, textarea, button, [tabindex]",
        );
    focusable?.focus({ preventScroll: true });
  }

  el.classList.remove("studio-field-flash");
  // Reinicia la animación si se vuelve a tocar el mismo campo.
  void el.offsetWidth;
  el.classList.add("studio-field-flash");
  window.setTimeout(() => el.classList.remove("studio-field-flash"), 1800);
}
