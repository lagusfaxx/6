"use client";

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
}: Props) {
  return (
    <div className={`grid gap-1.5 ${className}`}>
      <label className="text-[11px] font-medium tracking-wide text-white/40 uppercase">
        {label}
      </label>
      <input
        className="input-studio"
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
