"use client";

type Props = {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  rows?: number;
  hint?: string;
  className?: string;
};

export default function FloatingTextarea({
  label,
  value,
  onChange,
  placeholder,
  rows = 3,
  hint,
  className = "",
}: Props) {
  return (
    <div className={`grid gap-1.5 ${className}`}>
      <label className="text-[11px] font-medium tracking-wide text-white/40 uppercase">
        {label}
      </label>
      <textarea
        className="input-studio resize-none"
        style={{ minHeight: `${rows * 1.75}rem` }}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
      />
      {hint && <span className="text-[11px] text-white/30">{hint}</span>}
    </div>
  );
}
