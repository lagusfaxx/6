"use client";

import { AlertCircle, Check } from "lucide-react";

/**
 * Etiqueta de un campo del estudio.
 *
 * El estudio tiene campos obligatorios para publicar y campos que sólo suman.
 * Antes eso no se veía en ninguna parte del formulario — vivía sólo en la lista
 * de arriba — así que la persona no tenía forma de saber, mirando el campo, si
 * podía saltárselo. Acá se dice en el campo mismo: "Falta" mientras está vacío,
 * un tic cuando ya está, y "Opcional" en los que de verdad lo son.
 */
export default function FieldLabel({
  label,
  required = false,
  complete = false,
  optional = false,
  htmlFor,
}: {
  label: string;
  required?: boolean;
  complete?: boolean;
  optional?: boolean;
  htmlFor?: string;
}) {
  return (
    <label
      htmlFor={htmlFor}
      className="flex items-center gap-2 text-[11px] font-medium tracking-wide text-white/40 uppercase"
    >
      <span className={required && !complete ? "text-white/70" : undefined}>{label}</span>

      {required && !complete && (
        <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/15 px-1.5 py-0.5 text-[9px] font-semibold normal-case tracking-normal text-amber-300">
          <AlertCircle className="h-2.5 w-2.5" />
          Falta
        </span>
      )}

      {required && complete && (
        <span className="inline-flex h-3.5 w-3.5 items-center justify-center rounded-full bg-emerald-500/15">
          <Check className="h-2.5 w-2.5 text-emerald-400" />
        </span>
      )}

      {optional && (
        <span className="rounded-full bg-white/[0.06] px-1.5 py-0.5 text-[9px] font-medium normal-case tracking-normal text-white/35">
          Opcional
        </span>
      )}
    </label>
  );
}
