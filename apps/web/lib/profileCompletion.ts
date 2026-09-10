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
};

export function requiredProfileFields(state: DashboardFormState): RequiredField[] {
  const photos = state.gallery.filter(
    (g) => String(g.type).toUpperCase() !== "VIDEO",
  ).length;

  return [
    {
      key: "photos",
      label: `Al menos ${MIN_PROFILE_PHOTOS} fotos`,
      tab: "galeria",
      complete: photos >= MIN_PROFILE_PHOTOS,
    },
    { key: "birthdate", label: "Fecha de nacimiento", tab: "perfil", complete: !!state.birthdate },
    { key: "heightCm", label: "Estatura", tab: "perfil", complete: !!state.heightCm },
    { key: "weightKg", label: "Peso", tab: "perfil", complete: !!state.weightKg },
    { key: "measurements", label: "Medidas", tab: "perfil", complete: !!state.measurements.trim() },
    { key: "hairColor", label: "Color de cabello", tab: "perfil", complete: !!state.hairColor.trim() },
    { key: "skinTone", label: "Tono de piel", tab: "perfil", complete: !!state.skinTone.trim() },
    {
      key: "baseRate",
      label: "Tarifa",
      tab: "perfil",
      complete: Number(state.baseRate) > 0,
    },
    {
      key: "serviceTags",
      label: "Servicios que ofreces",
      tab: "perfil",
      complete: state.serviceTags.length > 0,
    },
    { key: "city", label: "Comuna", tab: "ubicacion", complete: !!state.city.trim() },
    { key: "phone", label: "Número de WhatsApp", tab: "perfil", complete: !!state.phone.trim() },
    {
      key: "bio",
      label: "Descripción del perfil",
      tab: "perfil",
      complete: state.bio.trim().length >= MIN_PROFILE_BIO_LENGTH,
    },
  ];
}

export function missingProfileFields(state: DashboardFormState): RequiredField[] {
  return requiredProfileFields(state).filter((f) => !f.complete);
}
