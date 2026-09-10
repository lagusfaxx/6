"use client";

import { AlertCircle, Check } from "lucide-react";

/**
 * Cabecera de una sección del editor.
 *
 * Cuando la sección tiene campos obligatorios lleva su propio contador: es lo
 * que permite ver, sin abrir nada, cuánto falta de ese bloque.
 */
export default function SectionHeader({
  icon: Icon,
  title,
  subtitle,
  required = 0,
  done = 0,
}: {
  icon: any;
  title: string;
  subtitle?: string;
  required?: number;
  done?: number;
}) {
  const hasRequired = required > 0;
  const complete = hasRequired && done >= required;

  return (
    <div className="mb-3 flex items-start justify-between gap-3">
      <div className="flex items-center gap-2.5">
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl border border-fuchsia-500/20 bg-gradient-to-br from-fuchsia-600/20 to-violet-600/20">
          <Icon className="h-4 w-4 text-fuchsia-400" />
        </div>
        <div>
          <h4 className="text-sm font-semibold text-white/90">{title}</h4>
          {subtitle && <p className="text-[11px] text-white/40">{subtitle}</p>}
        </div>
      </div>

      {hasRequired && (
        <span
          className={`inline-flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-semibold ${
            complete
              ? "bg-emerald-500/15 text-emerald-300"
              : "bg-amber-500/15 text-amber-300"
          }`}
        >
          {complete ? (
            <Check className="h-3 w-3" />
          ) : (
            <AlertCircle className="h-3 w-3" />
          )}
          {done}/{required} obligatorios
        </span>
      )}
    </div>
  );
}
