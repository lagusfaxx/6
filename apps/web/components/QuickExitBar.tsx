"use client";

import { useState } from "react";
import { Info, LogOut, X } from "lucide-react";
import { useDiscreet } from "./DiscreetProvider";

/**
 * Salida rápida.
 *
 * Separada del disfraz porque resuelve otra cosa: el disfraz es para seguir
 * usando la app en público, esto es para desaparecer de la pantalla ya.
 *
 * Sigue las recomendaciones medidas por Turk y Hutchings (CHI 2023) sobre 727
 * sitios:
 *  - Arriba a la derecha, que fue la posición con mejor localización.
 *  - Dentro de la cabecera fija, porque en 105 de los sitios evaluados el
 *    botón desaparecía al hacer scroll, que es justo cuando hace falta.
 *  - Con texto y no solo un ícono: sus evaluadores no sabían para qué servía
 *    un ícono suelto hasta apretarlo.
 *  - z-index alto para que ningún banner lo tape (falló en 22 sitios).
 *  - Usa location.replace, la única implementación que cumplía todos sus
 *    criterios de seguridad: no deja la página en el historial ni accesible
 *    con el botón atrás.
 */
export default function QuickExitBar() {
  const { discreet, quickExit } = useDiscreet();
  const [showHelp, setShowHelp] = useState(false);

  // Solo aparece en modo discreto: en uso normal sería ruido permanente.
  if (!discreet) return null;

  return (
    <>
      <div className="flex shrink-0 items-center gap-1.5">
        <button
          type="button"
          onClick={() => setShowHelp(true)}
          aria-label="Qué protege el modo discreto"
          className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-white/15 bg-white/[0.06] text-white/60 transition hover:text-white md:h-10 md:w-10"
        >
          <Info className="h-4 w-4" />
        </button>
        <button
          type="button"
          onClick={quickExit}
          className="inline-flex h-9 shrink-0 items-center gap-1.5 rounded-xl border border-white/20 bg-white/[0.10] px-2.5 text-[11px] font-bold text-white transition hover:bg-white/20 md:h-10 md:px-3 md:text-xs"
        >
          <LogOut className="h-3.5 w-3.5" />
          Salir
        </button>
      </div>

      {showHelp && (
        <div
          className="fixed inset-0 z-[101] flex items-center justify-center bg-black/70 px-5"
          onClick={() => setShowHelp(false)}
        >
          <div
            className="w-full max-w-sm rounded-2xl border border-white/10 bg-[#12141a] p-5"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-base font-bold">Modo discreto</h2>
              <button
                type="button"
                onClick={() => setShowHelp(false)}
                aria-label="Cerrar"
                className="rounded-lg p-1.5 text-white/40 hover:text-white"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <p className="text-[13px] font-semibold text-emerald-300">Sí te protege de</p>
            <p className="mt-1 text-[13px] leading-relaxed text-white/60">
              Que alguien al lado vea tu pantalla. Cambian el nombre, los colores,
              los textos y el título de la pestaña, y las fotos salen borrosas
              hasta que tocas una.
            </p>

            <p className="mt-4 text-[13px] font-semibold text-amber-300">No te protege de</p>
            <p className="mt-1 text-[13px] leading-relaxed text-white/60">
              Alguien que toma tu teléfono y revisa el historial del navegador.
              Eso no lo puede borrar ninguna página web. Si necesitas ese nivel,
              usa una ventana de incógnito de tu navegador.
            </p>

            <p className="mt-4 text-[13px] leading-relaxed text-white/40">
              El botón <strong className="text-white/70">Salir</strong> te manda a
              otro sitio al instante y no deja esta página en el historial.
              También puedes pulsar Escape dos veces seguidas.
            </p>

            <button
              type="button"
              onClick={() => setShowHelp(false)}
              className="mt-5 w-full rounded-xl bg-slate-600 px-4 py-2.5 text-sm font-bold text-white transition hover:bg-slate-500"
            >
              Entendido
            </button>
          </div>
        </div>
      )}
    </>
  );
}
