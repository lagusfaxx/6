"use client";

import { useId } from "react";
import FieldLabel from "./FieldLabel";

type Props = {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  rows?: number;
  hint?: string;
  className?: string;
  fieldKey?: string;
  required?: boolean;
  complete?: boolean;
  optional?: boolean;
};

export default function FloatingTextarea({
  label,
  value,
  onChange,
  placeholder,
  rows = 3,
  hint,
  className = "",
  fieldKey,
  required = false,
  complete = false,
  optional = false,
}: Props) {
  const id = useId();
  const pending = required && !complete;

  return (
    <div className={`grid gap-1.5 ${className}`} data-studio-field={fieldKey}>
      <FieldLabel
        label={label}
        required={required}
        complete={complete}
        optional={optional}
        htmlFor={id}
      />
      <textarea
        id={id}
        className={`input-studio resize-none ${pending ? "input-studio-pending" : ""}`}
        style={{ minHeight: `${rows * 1.75}rem` }}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
      />
      {hint && <span className="text-[11px] text-white/30">{hint}</span>}
    </div>
  );
}
