"use client";

import { useDashboardForm } from "../../../../hooks/useDashboardForm";
import { canOptOut } from "../../../../lib/profileCompletion";

/**
 * "Prefiero no decirlo".
 *
 * Los datos personales suman al anuncio, pero obligar a publicarlos es pedirle
 * a alguien que exponga su cuerpo en números para poder trabajar. Marcarlo
 * cuenta como respuesta: el campo deja de faltar, se borra lo que hubiera
 * escrito y en la ficha pública ese dato no aparece.
 *
 * Sólo se dibuja para las claves que el servidor acepta (OPTOUT_ELIGIBLE_FIELDS):
 * el mayor de 18, las fotos, el WhatsApp, la comuna, la descripción y los
 * servicios no se pueden ocultar, son el anuncio mismo.
 */
export default function UndisclosedToggle({
  fieldKey,
  /** Qué vaciar del formulario al marcarlo. */
  clears = [],
  label = "Prefiero no decirlo",
}: {
  fieldKey: string;
  clears?: string[];
  label?: string;
}) {
  const { state, setField } = useDashboardForm();

  if (!canOptOut(fieldKey)) return null;

  const checked = (state.undisclosedFields ?? []).includes(fieldKey);

  const toggle = () => {
    const current = state.undisclosedFields ?? [];
    if (checked) {
      setField(
        "undisclosedFields",
        current.filter((k) => k !== fieldKey),
      );
      return;
    }
    setField("undisclosedFields", [...current, fieldKey]);
    // Lo que no se muestra tampoco se guarda a medias.
    for (const key of clears.length ? clears : [fieldKey]) {
      setField(key as any, "");
    }
  };

  return (
    <label
      className={`mt-1.5 inline-flex cursor-pointer items-center gap-2 rounded-lg px-1.5 py-1 text-[11px] transition ${
        checked ? "text-white/60" : "text-white/35 hover:text-white/55"
      }`}
    >
      <input
        type="checkbox"
        checked={checked}
        onChange={toggle}
        className="h-3.5 w-3.5 accent-fuchsia-500"
      />
      {label}
    </label>
  );
}
