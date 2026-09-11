"use client";

import { useEffect, useState } from "react";
import { Phone, PartyPopper, X } from "lucide-react";

/**
 * Bienvenida de primera vez, al llegar desde el registro.
 *
 * Reemplaza a la pantalla de "registro recibido", que era un desvío: tenía dos
 * botones del mismo peso y quien tocaba "volver al inicio" se iba a navegar el
 * sitio con la ficha a medias y el perfil sin publicar. Ahora el registro
 * entrega directo acá, que es donde se resuelve, y lo que esa pantalla contaba
 * — cuenta creada, verificación por teléfono, perfil todavía sin publicar —
 * se dice arriba de la lista de lo que falta.
 *
 * Se muestra sólo con ?bienvenida=1 y cerrarla limpia el parámetro, así no
 * reaparece al recargar ni al volver más tarde.
 */
export default function StudioWelcome() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    /* Se lee de window en vez de useSearchParams para no obligar a la página
       entera a salir del prerender por un parámetro de un solo uso. */
    try {
      const params = new URLSearchParams(window.location.search);
      setVisible(params.get("bienvenida") === "1");
    } catch {
      setVisible(false);
    }
  }, []);

  if (!visible) return null;

  const dismiss = () => {
    setVisible(false);
    try {
      const url = new URL(window.location.href);
      url.searchParams.delete("bienvenida");
      window.history.replaceState({}, "", url.toString());
    } catch {
      // Si no se puede limpiar la URL, se cierra igual: vuelve sólo si recarga.
    }
  };

  return (
    <div className="relative mb-4 overflow-hidden rounded-2xl border border-fuchsia-500/20 bg-gradient-to-br from-fuchsia-500/[0.10] via-violet-500/[0.04] to-transparent p-4">
      <button
        type="button"
        onClick={dismiss}
        aria-label="Cerrar la bienvenida"
        className="absolute right-2.5 top-2.5 flex h-7 w-7 items-center justify-center rounded-lg text-white/30 transition hover:bg-white/10 hover:text-white/70"
      >
        <X className="h-3.5 w-3.5" />
      </button>

      <div className="flex items-start gap-3 pr-8">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-fuchsia-500/15">
          <PartyPopper className="h-4 w-4 text-fuchsia-300" />
        </span>
        <div className="min-w-0">
          <p className="text-sm font-semibold text-white/90">Tu cuenta está creada</p>
          <p className="mt-1 text-[12px] leading-relaxed text-white/55">
            Te falta la ficha para que tu perfil salga en la app. Abajo está lo
            que queda: lo que no quieras publicar, márcalo como “prefiero no
            decirlo” y también cuenta.
          </p>
          <span className="mt-2.5 inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.05] px-2.5 py-1 text-[11px] text-white/50">
            <Phone className="h-3 w-3" />
            Un administrador verifica tu cuenta por teléfono
          </span>
        </div>
      </div>
    </div>
  );
}
