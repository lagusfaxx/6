"use client";

type Option = { value: string; label: string };

type Props = {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: Option[];
  placeholder?: string;
  hint?: string;
  className?: string;
};

export default function FloatingSelect({
  label,
  value,
  onChange,
  options,
  placeholder,
  hint,
  className = "",
}: Props) {
  return (
    <div className={`grid gap-1.5 ${className}`}>
      <label className="text-[11px] font-medium tracking-wide text-white/40 uppercase">
        {label}
      </label>
      <select
        className="input-studio"
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
