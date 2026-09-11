"use client";

import { useId } from "react";
import FieldLabel from "./FieldLabel";

type Props = {
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
  placeholder?: string;
  disabled?: boolean;
  max?: string;
  min?: string;
  hint?: string;
  className?: string;
  /** Clave del requisito: con esto la lista de arriba salta hasta acá. */
  fieldKey?: string;
  /** Obligatorio para publicar (no es el `required` del HTML). */
  required?: boolean;
  complete?: boolean;
  optional?: boolean;
  /** Resuelto con "prefiero no decirlo". */
  undisclosed?: boolean;
};

export default function FloatingInput({
  label,
  value,
  onChange,
  type = "text",
  placeholder,
  disabled,
  max,
  min,
  hint,
  className = "",
  fieldKey,
  required = false,
  complete = false,
  optional = false,
  undisclosed = false,
}: Props) {
  /* El estudio monta este editor dos veces (escritorio y teléfono). Un id fijo
     se repetiría en las dos copias; useId da uno por instancia. */
  const id = useId();
  const pending = required && !complete;

  return (
    <div className={`grid gap-1.5 ${className}`} data-studio-field={fieldKey}>
      <FieldLabel
        label={label}
        required={required}
        complete={complete}
        optional={optional}
        undisclosed={undisclosed}
        htmlFor={id}
      />
      <input
        id={id}
        className={`input-studio ${pending ? "input-studio-pending" : ""}`}
        type={type}
        value={undisclosed ? "" : value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={undisclosed ? "Prefiero no decirlo" : placeholder}
        disabled={disabled || undisclosed}
        max={max}
        min={min}
      />
      {hint && !undisclosed && <span className="text-[11px] text-white/30">{hint}</span>}
    </div>
  );
}
