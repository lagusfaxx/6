"use client";

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
  /** id del control: lo usa la lista de requisitos para saltar hasta acá. */
  id?: string;
  /** Obligatorio para publicar (no es el `required` del HTML). */
  required?: boolean;
  /** Si ese campo obligatorio ya está resuelto. */
  complete?: boolean;
  optional?: boolean;
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
  id,
  required = false,
  complete = false,
  optional = false,
}: Props) {
  const pending = required && !complete;

  return (
    <div className={`grid gap-1.5 ${className}`}>
      <FieldLabel
        label={label}
        required={required}
        complete={complete}
        optional={optional}
        htmlFor={id}
      />
      <input
        id={id}
        className={`input-studio ${pending ? "input-studio-pending" : ""}`}
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        disabled={disabled}
        max={max}
        min={min}
      />
      {hint && <span className="text-[11px] text-white/30">{hint}</span>}
    </div>
  );
}
