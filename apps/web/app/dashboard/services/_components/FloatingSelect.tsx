"use client";

import FieldLabel from "./FieldLabel";

type Option = { value: string; label: string };

type Props = {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: Option[];
  placeholder?: string;
  hint?: string;
  className?: string;
  id?: string;
  required?: boolean;
  complete?: boolean;
  optional?: boolean;
};

export default function FloatingSelect({
  label,
  value,
  onChange,
  options,
  placeholder,
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
      <select
        id={id}
        className={`input-studio ${pending ? "input-studio-pending" : ""}`}
        value={value}
        onChange={(e) => onChange(e.target.value)}
      >
        {placeholder && <option value="">{placeholder}</option>}
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
      {hint && <span className="text-[11px] text-white/30">{hint}</span>}
    </div>
  );
}
