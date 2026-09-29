"use client";

import { type ReactNode, useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { AlertTriangle, Check, X } from "lucide-react";

/**
 * Piezas comunes de los paneles de locales y tiendas. Mismo lenguaje visual
 * que el Creator Studio de las profesionales: tarjetas translúcidas, campos
 * `input-studio` y botones con el degradado de la marca.
 */

export function Card({
  title,
  description,
  action,
  children,
  className = "",
}: {
  title?: ReactNode;
  description?: ReactNode;
  action?: ReactNode;
  children?: ReactNode;
  className?: string;
}) {
  return (
    <section className={`editor-card p-5 sm:p-6 ${className}`}>
      {(title || action) && (
        <div className="mb-4 flex items-start justify-between gap-3">
          <div className="min-w-0">
            {title && <h2 className="text-[15px] font-semibold text-white/90">{title}</h2>}
            {description && <p className="mt-0.5 text-[13px] leading-relaxed text-white/45">{description}</p>}
          </div>
          {action && <div className="shrink-0">{action}</div>}
        </div>
      )}
      {children}
    </section>
  );
}

export function Field({ label, hint, children }: { label: string; hint?: ReactNode; children: ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-[12px] font-medium text-white/55">{label}</span>
      {children}
      {hint && <span className="mt-1 block text-[11px] text-white/35">{hint}</span>}
    </label>
  );
}

export function Switch({
  checked,
  onChange,
  label,
  tone = "fuchsia",
  disabled,
}: {
  checked: boolean;
  onChange: (next: boolean) => void;
  label: string;
  tone?: "fuchsia" | "emerald";
  disabled?: boolean;
}) {
  const on = tone === "emerald" ? "bg-emerald-500" : "bg-gradient-to-r from-fuchsia-600 to-violet-600";
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={`relative h-7 w-12 shrink-0 rounded-full transition disabled:opacity-50 ${checked ? on : "bg-white/15"}`}
    >
      <span className={`absolute top-0.5 h-6 w-6 rounded-full bg-white shadow transition-all ${checked ? "left-[22px]" : "left-0.5"}`} />
    </button>
  );
}

export function ChipToggle({ active, onClick, children }: { active: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[13px] transition ${
        active ? "border-fuchsia-400/50 bg-fuchsia-500/15 text-fuchsia-100" : "border-white/10 bg-white/[0.03] text-white/60 hover:border-white/20 hover:text-white"
      }`}
    >
      {active && <Check className="h-3.5 w-3.5" />}
      {children}
    </button>
  );
}

export function Segmented<T extends string>({
  value,
  options,
  onChange,
}: {
  value: T;
  options: Array<{ value: T; label: ReactNode }>;
  onChange: (v: T) => void;
}) {
  return (
    <div className="inline-flex rounded-xl border border-white/10 bg-white/[0.03] p-1">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          onClick={() => onChange(o.value)}
          aria-pressed={value === o.value}
          className={`rounded-lg px-3 py-1.5 text-[13px] font-medium transition ${
            value === o.value ? "bg-gradient-to-r from-fuchsia-600/90 to-violet-600/90 text-white" : "text-white/50 hover:text-white/80"
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function EmptyState({ icon, title, text, action }: { icon: ReactNode; title: string; text?: string; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center rounded-2xl border border-dashed border-white/10 bg-white/[0.015] px-6 py-12 text-center">
      <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-white/[0.05] text-white/35">{icon}</div>
      <p className="font-semibold text-white/80">{title}</p>
      {text && <p className="mt-1 max-w-sm text-[13px] text-white/45">{text}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

export function Stat({ label, value, sub, tone = "white" }: { label: string; value: ReactNode; sub?: ReactNode; tone?: "white" | "amber" | "emerald" | "violet" }) {
  const color = { white: "text-white", amber: "text-amber-300", emerald: "text-emerald-300", violet: "text-violet-300" }[tone];
  return (
    <div className="editor-card p-4">
      <p className="text-[12px] text-white/45">{label}</p>
      <p className={`mt-1 text-2xl font-bold tabular-nums ${color}`}>{value}</p>
      {sub && <p className="mt-0.5 text-[11px] text-white/35">{sub}</p>}
    </div>
  );
}

/** Hoja inferior en el teléfono, ventana centrada en el escritorio. */
export function Modal({
  open,
  title,
  onClose,
  children,
  footer,
}: {
  open: boolean;
  title: string;
  onClose: () => void;
  children: ReactNode;
  footer?: ReactNode;
}) {
  /* Va en un portal al <body>: dentro del panel quedaba debajo del menú
     inferior del teléfono y los botones de guardar no se podían tocar. */
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [open, onClose]);

  if (!open || !mounted) return null;
  return createPortal(
    <div className="fixed inset-0 z-[80] flex items-end justify-center sm:items-center sm:p-6" role="dialog" aria-modal="true" aria-label={title}>
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />
      <div className="relative flex max-h-[92svh] w-full flex-col overflow-hidden rounded-t-3xl border border-white/10 bg-[#11121c] shadow-2xl sm:max-w-2xl sm:rounded-3xl">
        <div className="flex items-center justify-between border-b border-white/[0.06] px-5 py-4">
          <h2 className="text-base font-semibold">{title}</h2>
          <button onClick={onClose} className="rounded-full p-1.5 text-white/50 hover:bg-white/10 hover:text-white" aria-label="Cerrar">
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto px-5 py-5">{children}</div>
        {footer && <div className="border-t border-white/[0.06] bg-[#11121c] px-5 py-4 pb-[calc(1rem+env(safe-area-inset-bottom))] sm:pb-4">{footer}</div>}
      </div>
    </div>,
    document.body,
  );
}

export type ToastState = { text: string; tone: "ok" | "error" } | null;

export function Toast({ toast, onClose }: { toast: ToastState; onClose: () => void }) {
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(onClose, toast.tone === "error" ? 7000 : 3500);
    return () => clearTimeout(t);
  }, [toast, onClose]);
  if (!toast) return null;
  return (
    <div role="status" className="fixed left-1/2 top-4 z-[90] w-[calc(100%-2rem)] max-w-md -translate-x-1/2">
      <div className={`flex items-center gap-3 rounded-2xl border px-4 py-3 shadow-2xl backdrop-blur-xl ${toast.tone === "error" ? "border-red-400/25 bg-[#2a0f16]/95" : "border-white/15 bg-black/90"}`}>
        {toast.tone === "error" ? (
          <AlertTriangle className="h-4 w-4 shrink-0 text-red-300" />
        ) : (
          <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-emerald-500/20"><Check className="h-3 w-3 text-emerald-300" /></span>
        )}
        <span className="flex-1 text-sm text-white/90">{toast.text}</span>
        <button onClick={onClose} className="text-white/40 hover:text-white/80" aria-label="Cerrar"><X className="h-4 w-4" /></button>
      </div>
    </div>
  );
}

export function digitsOnly(value: string) {
  return value.replace(/[^0-9]/g, "");
}

export function formatClp(value?: number | null) {
  return `$${Math.round(Number(value || 0)).toLocaleString("es-CL")}`;
}
