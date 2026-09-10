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
  /** id del control en el DOM, para poder saltar directo a él. */
  anchor: string;
};

/** id del control de un campo obligatorio dentro del estudio. */
export function fieldAnchor(key: string): string {
  return `studio-field-${key}`;
}

export function requiredProfileFields(state: DashboardFormState): RequiredField[] {
  const photos = state.gallery.filter(
    (g) => String(g.type).toUpperCase() !== "VIDEO",
  ).length;

  const field = (
    key: string,
    label: string,
    tab: StudioTab,
    complete: boolean,
  ): RequiredField => ({ key, label, tab, complete, anchor: fieldAnchor(key) });

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

/** Los campos obligatorios de una pestaña, para el contador de cada sección. */
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
 * La pestaña se monta con animación, así que el control puede no existir
 * todavía cuando se hace click en la lista: se reintenta unos frames antes de
 * rendirse. El destello es lo que evita el "¿y dónde quedó?" — sin él, saltar
 * a un formulario largo deja a la persona buscando el campo con la vista.
 */
export function focusRequiredField(anchor: string, attempt = 0): void {
  if (typeof document === "undefined") return;

  const el = document.getElementById(anchor);
  if (!el) {
    if (attempt < 40) {
      requestAnimationFrame(() => focusRequiredField(anchor, attempt + 1));
    }
    return;
  }

  el.scrollIntoView({ behavior: "smooth", block: "center" });
  const focusable = el.matches("input, select, textarea, button, [tabindex]")
    ? el
    : el.querySelector<HTMLElement>("input, select, textarea, button, [tabindex]");
  focusable?.focus({ preventScroll: true });

  el.classList.remove("studio-field-flash");
  // Reinicia la animación si se vuelve a hacer click en el mismo campo.
  void el.offsetWidth;
  el.classList.add("studio-field-flash");
  window.setTimeout(() => el.classList.remove("studio-field-flash"), 1600);
}
