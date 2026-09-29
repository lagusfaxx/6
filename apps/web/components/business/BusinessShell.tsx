"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import { ArrowLeft, ExternalLink, LogOut } from "lucide-react";
import { resolveMediaUrl } from "../../lib/api";

export type ShellTab<K extends string> = { key: K; label: string; shortLabel?: string; Icon: LucideIcon; badge?: number };

/**
 * Marco de los paneles de locales y tiendas. Las rutas /dashboard no llevan
 * el menú del sitio, así que el panel trae el suyo: barra lateral en el
 * escritorio y, en el teléfono, cabecera arriba y pestañas abajo como la app.
 */
export default function BusinessShell<K extends string>({
  name,
  avatarUrl,
  kindLabel,
  tabs,
  tab,
  onTab,
  publicHref,
  statusSlot,
  onLogout,
  children,
}: {
  name: string;
  avatarUrl?: string | null;
  kindLabel: string;
  tabs: ShellTab<K>[];
  tab: K;
  onTab: (k: K) => void;
  publicHref?: string | null;
  /** Interruptor "Abierto" u otro estado rápido, siempre a la vista. */
  statusSlot?: ReactNode;
  onLogout?: () => void;
  children: ReactNode;
}) {
  const avatar = resolveMediaUrl(avatarUrl);
  const initial = (name || "?").charAt(0).toUpperCase();

  const avatarEl = (size: string) => (
    <div className={`${size} shrink-0 overflow-hidden rounded-xl border border-white/10 bg-gradient-to-br from-fuchsia-600/40 to-violet-700/40`}>
      {avatar ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={avatar} alt="" className="h-full w-full object-cover" />
      ) : (
        <div className="flex h-full w-full items-center justify-center text-sm font-bold text-white/80">{initial}</div>
      )}
    </div>
  );

  return (
    <div className="studio-bg relative min-h-screen text-white">
      <div className="studio-glow pointer-events-none fixed inset-0" />

      {/* ── Escritorio: barra lateral ── */}
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 flex-col border-r border-white/[0.06] bg-[#08090f]/90 backdrop-blur-2xl lg:flex">
        <div className="flex items-center gap-2 px-5 pt-5">
          <Link href="/" className="flex items-center gap-2 text-white/60 transition hover:text-white" aria-label="Volver a UZEED">
            <ArrowLeft className="h-4 w-4" />
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/brand/isotipo-new.png" alt="" className="h-6 w-6" />
            <span className="text-sm font-semibold">UZEED</span>
          </Link>
        </div>
        <div className="mx-4 mt-5 flex items-center gap-3 rounded-2xl border border-white/[0.06] bg-white/[0.03] p-3">
          {avatarEl("h-10 w-10")}
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold">{name}</p>
            <p className="text-[11px] text-white/40">{kindLabel}</p>
          </div>
        </div>
        {statusSlot && <div className="mx-4 mt-3">{statusSlot}</div>}
        <nav className="mt-4 flex-1 space-y-1 px-3">
          {tabs.map((t) => {
            const active = t.key === tab;
            return (
              <button
                key={t.key}
                onClick={() => onTab(t.key)}
                className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition ${
                  active ? "bg-gradient-to-r from-fuchsia-600/25 to-violet-600/15 text-white" : "text-white/55 hover:bg-white/[0.05] hover:text-white"
                }`}
              >
                <t.Icon className={`h-[18px] w-[18px] ${active ? "text-fuchsia-300" : ""}`} />
                <span className="flex-1 text-left">{t.label}</span>
                {!!t.badge && <span className="rounded-full bg-amber-500 px-1.5 py-0.5 text-[10px] font-bold text-black">{t.badge}</span>}
              </button>
            );
          })}
        </nav>
        <div className="space-y-1 border-t border-white/[0.06] p-3">
          {publicHref && (
            <Link href={publicHref} target="_blank" className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm text-white/55 transition hover:bg-white/[0.05] hover:text-white">
              <ExternalLink className="h-[18px] w-[18px]" /> Ver mi ficha pública
            </Link>
          )}
          {onLogout && (
            <button onClick={onLogout} className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm text-white/40 transition hover:bg-red-500/10 hover:text-red-300">
              <LogOut className="h-[18px] w-[18px]" /> Cerrar sesión
            </button>
          )}
        </div>
      </aside>

      {/* ── Teléfono: cabecera ── */}
      <header className="sticky top-0 z-30 border-b border-white/[0.06] bg-[#070816]/90 backdrop-blur-xl lg:hidden">
        <div className="flex items-center gap-3 px-4 py-2.5">
          <Link href="/" className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl border border-white/10 bg-white/[0.04] text-white/60" aria-label="Volver a UZEED">
            <ArrowLeft className="h-4 w-4" />
          </Link>
          {avatarEl("h-8 w-8")}
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold">{name}</p>
            <p className="text-[10px] text-white/40">{kindLabel}</p>
          </div>
          {publicHref && (
            <Link href={publicHref} className="flex h-8 items-center gap-1.5 rounded-xl border border-white/10 bg-white/[0.04] px-2.5 text-[12px] text-white/70" aria-label="Ver mi ficha pública">
              <ExternalLink className="h-3.5 w-3.5" /> Ficha
            </Link>
          )}
        </div>
      </header>

      <main className="relative z-10 lg:pl-64">
        <div className="mx-auto max-w-5xl px-4 pb-[calc(6rem+env(safe-area-inset-bottom))] pt-5 sm:px-6 lg:px-8 lg:pb-12 lg:pt-8">
          {/* En Inicio el estado ya está en su tarjeta: no se repite arriba. */}
          {statusSlot && tab !== tabs[0]?.key && <div className="mb-4 lg:hidden">{statusSlot}</div>}
          {children}
        </div>
      </main>

      {/* ── Teléfono: pestañas abajo ── */}
      <nav
        className="fixed inset-x-0 bottom-0 z-30 border-t border-white/[0.08] bg-[#08090f]/95 backdrop-blur-2xl lg:hidden"
        style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
      >
        <div className="mx-auto grid max-w-[560px] px-1 py-1" style={{ gridTemplateColumns: `repeat(${tabs.length}, minmax(0, 1fr))` }}>
          {tabs.map((t) => {
            const active = t.key === tab;
            return (
              <button key={t.key} onClick={() => onTab(t.key)} className="relative flex flex-col items-center gap-0.5 rounded-xl py-2 text-[10px]">
                <t.Icon className={`h-5 w-5 ${active ? "text-fuchsia-300" : "text-white/45"}`} />
                <span className={active ? "font-semibold text-white" : "text-white/45"}>{t.shortLabel || t.label}</span>
                {!!t.badge && (
                  <span className="absolute right-[18%] top-1 rounded-full bg-amber-500 px-1.5 text-[9px] font-bold leading-4 text-black">{t.badge}</span>
                )}
              </button>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
