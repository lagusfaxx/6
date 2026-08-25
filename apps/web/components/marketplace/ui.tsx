"use client";

import Link from "next/link";
import { ArrowLeft } from "lucide-react";

/**
 * Piezas comunes de las pantallas del marketplace.
 *
 * La regla acá es una sola: la página es una superficie continua. Nada de
 * envolver cada sección en su propio marco con fondo, porque apilados se leen
 * como bloques sueltos en vez de una pantalla. Lo que separa una sección de
 * otra es el espacio y, cuando hace falta, una divisoria de un pixel.
 */

export function PageHeader({
  title,
  subtitle,
  backHref,
  backLabel,
  actions,
}: {
  title: string;
  subtitle?: string;
  backHref?: string;
  backLabel?: string;
  actions?: React.ReactNode;
}) {
  return (
    <>
      {backHref && (
        <Link
          href={backHref}
          className="mb-4 inline-flex items-center gap-1.5 text-sm text-white/45 transition hover:text-white"
        >
          <ArrowLeft className="h-4 w-4" /> {backLabel || "Volver"}
        </Link>
      )}
      <header className="flex flex-wrap items-end justify-between gap-x-4 gap-y-3 border-b border-white/[0.07] pb-4">
        <div className="min-w-0">
          <h1 className="truncate text-xl font-semibold text-white sm:text-2xl">{title}</h1>
          {subtitle && <p className="mt-1 text-sm text-white/45">{subtitle}</p>}
        </div>
        {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
      </header>
    </>
  );
}

/** Título de sección: pequeño y discreto, sin caja alrededor del contenido. */
export function Section({
  title,
  action,
  children,
  className = "",
}: {
  title?: string;
  action?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section className={`mt-8 ${className}`}>
      {(title || action) && (
        <div className="mb-3 flex items-center justify-between gap-3">
          {title && <h2 className="text-sm font-semibold text-white/70">{title}</h2>}
          {action}
        </div>
      )}
      {children}
    </section>
  );
}

/**
 * Cifras en fila, separadas por una línea vertical. Reemplaza a las tarjetas
 * de colores: el dato importa, el envase no.
 */
export function StatRow({
  items,
}: {
  items: Array<{ label: string; value: string; hint?: string; accent?: "positive" | "muted" }>;
}) {
  return (
    <div className="flex flex-wrap gap-x-10 gap-y-4 border-b border-white/[0.07] pb-5">
      {items.map((item) => (
        <div key={item.label} className="min-w-[7rem]">
          <p
            className={`text-2xl font-semibold tabular-nums ${
              item.accent === "positive" ? "text-emerald-300" : item.accent === "muted" ? "text-white/50" : "text-white"
            }`}
          >
            {item.value}
          </p>
          <p className="mt-0.5 text-xs text-white/45">{item.label}</p>
          {item.hint && <p className="text-[11px] text-white/25">{item.hint}</p>}
        </div>
      ))}
    </div>
  );
}

/** Lista separada por divisorias, en vez de una tarjeta por fila. */
export function DividedList({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <div className={`divide-y divide-white/[0.06] ${className}`}>{children}</div>;
}

/** Par etiqueta/valor de una ficha de datos. */
export function Field({ label, value, strong }: { label: string; value: React.ReactNode; strong?: boolean }) {
  return (
    <div className="flex items-baseline justify-between gap-3 py-1.5">
      <span className="text-xs text-white/40">{label}</span>
      <span className={`text-sm ${strong ? "font-semibold text-emerald-300" : "text-white/85"}`}>{value}</span>
    </div>
  );
}

/** Aviso breve. Solo para lo que la persona tiene que hacer o saber ahora. */
export function Notice({
  tone = "info",
  children,
}: {
  tone?: "info" | "warn" | "success" | "error";
  children: React.ReactNode;
}) {
  const tones = {
    info: "border-white/10 bg-white/[0.03] text-white/70",
    warn: "border-amber-500/25 bg-amber-500/[0.07] text-amber-100",
    success: "border-emerald-500/25 bg-emerald-500/[0.07] text-emerald-100",
    error: "border-rose-500/30 bg-rose-500/10 text-rose-200",
  };
  return <div className={`rounded-xl border px-4 py-3 text-sm ${tones[tone]}`}>{children}</div>;
}

/** Pie de página con la letra chica: lo que antes era una caja de viñetas. */
export function FinePrint({ children }: { children: React.ReactNode }) {
  return (
    <p className="mt-10 border-t border-white/[0.07] pt-5 text-xs leading-relaxed text-white/35">{children}</p>
  );
}

export const btn = {
  primary:
    "inline-flex items-center justify-center gap-1.5 rounded-lg bg-gradient-to-r from-fuchsia-500 to-violet-500 px-4 py-2.5 text-sm font-semibold text-white transition hover:brightness-110 disabled:opacity-40",
  quiet:
    "inline-flex items-center justify-center gap-1.5 rounded-lg border border-white/10 px-3 py-2 text-sm text-white/65 transition hover:bg-white/[0.06] hover:text-white disabled:opacity-40",
  ghost:
    "inline-flex items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-sm text-white/55 transition hover:bg-white/[0.06] hover:text-white disabled:opacity-40",
};
