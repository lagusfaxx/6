"use client";

import { AlertCircle, Check, EyeOff } from "lucide-react";

/**
 * Etiqueta de un campo del estudio.
 *
 * Dice en el campo mismo si es obligatorio para publicar, si ya está resuelto
 * y si se resolvió con "prefiero no decirlo". Antes eso vivía sólo en la lista
 * del encabezado, así que mirando el formulario no había forma de saber cuál
 * se podía saltar.
 */
export default function FieldLabel({
  label,
  required = false,
  complete = false,
  optional = false,
  undisclosed = false,
  htmlFor,
}: {
  label: string;
  required?: boolean;
  complete?: boolean;
  optional?: boolean;
  undisclosed?: boolean;
  htmlFor?: string;
}) {
  return (
    <label
      htmlFor={htmlFor}
      className="flex items-center gap-2 text-[11px] font-medium uppercase tracking-wide text-white/40"
    >
      <span className={required && !complete ? "text-white/70" : undefined}>{label}</span>

      {undisclosed ? (
        <span className="inline-flex items-center gap-1 rounded-full bg-white/[0.07] px-1.5 py-0.5 text-[9px] font-semibold normal-case tracking-normal text-white/45">
          <EyeOff className="h-2.5 w-2.5" />
          Sin mostrar
        </span>
      ) : required && !complete ? (
        <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/15 px-1.5 py-0.5 text-[9px] font-semibold normal-case tracking-normal text-amber-300">
          <AlertCircle className="h-2.5 w-2.5" />
          Falta
        </span>
      ) : required && complete ? (
        <span className="inline-flex h-3.5 w-3.5 items-center justify-center rounded-full bg-emerald-500/15">
          <Check className="h-2.5 w-2.5 text-emerald-400" />
        </span>
      ) : null}

      {optional && (
        <span className="rounded-full bg-white/[0.06] px-1.5 py-0.5 text-[9px] font-medium normal-case tracking-normal text-white/35">
          Opcional
        </span>
      )}
    </label>
  );
}
