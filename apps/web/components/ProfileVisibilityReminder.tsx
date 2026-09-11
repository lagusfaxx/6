"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { ArrowRight, TrendingUp, X } from "lucide-react";

import useMe from "../hooks/useMe";

/**
 * Recordatorio de visibilidad.
 *
 * Nació como aviso de "tu perfil no se publica": cuando la ficha incompleta
 * retenía el anuncio, había que avisarlo en cada pantalla o la profesional no
 * se enteraba nunca. Esa regla se quitó — el perfil sale al aire igual — así
 * que el aviso deja de ser un bloqueo y pasa a ser lo que siempre debió ser:
 * cuántos datos le faltan para aparecer en más búsquedas.
 *
 * Y por eso ahora sí se cierra. Una franja que no se puede cerrar se justifica
 * cuando el anuncio está caído; para un consejo, no: se posterga dos semanas,
 * como el resto de los avisos del sitio.
 */

const STORAGE_KEY = "uzeed:profileVisibility";
const SNOOZE_DAYS = 14;

export default function ProfileVisibilityReminder() {
  const pathname = usePathname() || "/";
  const { me } = useMe();
  const [snoozed, setSnoozed] = useState(true);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) {
        setSnoozed(false);
        return;
      }
      const dismissedAt = new Date(raw).getTime();
      setSnoozed(Date.now() - dismissedAt < SNOOZE_DAYS * 24 * 60 * 60 * 1000);
    } catch {
      // Sin localStorage (modo privado, almacenamiento bloqueado) se muestra.
      setSnoozed(false);
    }
  }, []);

  const completion = me?.user?.profileCompletion;

  // Dentro del estudio sobra: ahí está la lista entera con su puntaje.
  if (pathname.startsWith("/dashboard")) return null;
  if (snoozed) return null;
  if (!completion || completion.complete) return null;

  const missing = completion.missing ?? [];

  const dismiss = () => {
    setSnoozed(true);
    try {
      localStorage.setItem(STORAGE_KEY, new Date().toISOString());
    } catch {
      // Si no se puede guardar, volverá a aparecer: molesta menos que fallar.
    }
  };

  return (
    <div className="relative mb-4 overflow-hidden rounded-2xl border border-fuchsia-500/20 bg-[#0d0e17]/80 backdrop-blur-xl">
      <span
        aria-hidden
        className="absolute inset-y-0 left-0 w-1 bg-gradient-to-b from-fuchsia-500 to-violet-500"
      />

      <div className="flex items-center gap-3 py-3 pl-5 pr-3">
        <span className="hidden h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-fuchsia-500/15 text-fuchsia-300 sm:flex">
          <TrendingUp className="h-4 w-4" />
        </span>

        <button
          type="button"
          onClick={() => setOpen((p) => !p)}
          aria-expanded={open}
          className="min-w-0 flex-1 text-left"
        >
          <p className="truncate text-[13px] font-semibold text-white/90">
            Suma visibilidad a tu perfil
          </p>
          <p className="truncate text-[11px] text-white/45">
            {missing.length} dato{missing.length !== 1 ? "s" : ""} para aparecer en más búsquedas.
          </p>
        </button>

        <Link
          href="/dashboard/services"
          className="hidden shrink-0 items-center gap-1.5 rounded-xl bg-gradient-to-r from-fuchsia-600 to-violet-600 px-3.5 py-2 text-xs font-semibold text-white shadow-lg shadow-violet-500/20 transition hover:opacity-90 sm:inline-flex"
        >
          Mejorar
          <ArrowRight className="h-3.5 w-3.5" />
        </Link>

        <button
          type="button"
          onClick={dismiss}
          aria-label="Ocultar por ahora"
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl text-white/30 transition hover:bg-white/[0.06] hover:text-white/70"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>

      {open && (
        <div className="border-t border-white/[0.06] px-5 py-3">
          <div className="flex flex-wrap gap-1.5">
            {missing.map((f) => (
              <span
                key={f.key}
                className="rounded-full border border-white/[0.08] bg-white/[0.04] px-2.5 py-1 text-[11px] text-white/60"
              >
                {f.label}
              </span>
            ))}
          </div>

          <Link
            href="/dashboard/services"
            className="mt-3 flex items-center justify-center gap-1.5 rounded-xl bg-gradient-to-r from-fuchsia-600 to-violet-600 px-3 py-2.5 text-xs font-semibold text-white shadow-lg shadow-violet-500/20 transition hover:opacity-90 sm:hidden"
          >
            Mejorar mi perfil
            <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </div>
      )}
    </div>
  );
}
