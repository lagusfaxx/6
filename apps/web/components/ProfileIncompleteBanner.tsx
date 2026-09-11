"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { ArrowRight, ChevronDown, EyeOff } from "lucide-react";

import useMe from "../hooks/useMe";

/**
 * Aviso de perfil sin publicar.
 *
 * Al terminar el registro la profesional cae en la pantalla de "registro
 * recibido", que le explica todo esto una vez — y desde ahí navega el sitio
 * como cualquier visitante. Sin este aviso no vuelve a enterarse: su ficha
 * queda incompleta, el perfil no aparece en la app y ella lo cree publicado
 * porque puede entrar y moverse con normalidad.
 *
 * Por eso no se puede cerrar: mientras el anuncio no esté al aire, el aviso
 * viaja con ella. Se pliega a una línea para no estorbar, y desaparece solo
 * cuando la ficha queda completa.
 *
 * A los perfiles que ya estaban publicados antes de la regla
 * (`grandfathered`) no se les habla de bloqueo: a ellos nadie les baja el
 * anuncio, sólo se les recomienda completar.
 */
export default function ProfileIncompleteBanner() {
  const pathname = usePathname() || "/";
  const { me } = useMe();
  const [open, setOpen] = useState(false);

  const completion = me?.user?.profileCompletion;

  // Dentro del estudio sobra: ahí está la lista de requisitos completa.
  if (pathname.startsWith("/dashboard")) return null;
  if (!completion || completion.complete) return null;

  const missing = completion.missing ?? [];
  const grandfathered = completion.grandfathered;

  const title = grandfathered
    ? "Tu ficha está incompleta"
    : "Tu perfil todavía no se ve en la app";

  const detail = grandfathered
    ? `Sigue publicado, pero le faltan ${missing.length} datos que el cliente mira.`
    : `Nadie puede encontrarte hasta completar ${missing.length} dato${missing.length !== 1 ? "s" : ""}.`;

  return (
    <div
      className={`relative mb-4 overflow-hidden rounded-2xl border ${
        grandfathered ? "border-white/10" : "border-amber-500/25"
      } bg-[#0d0e17]/80 backdrop-blur-xl`}
    >
      {/* Filo de color: marca el tono sin teñir toda la franja. */}
      <span
        aria-hidden
        className={`absolute inset-y-0 left-0 w-1 ${
          grandfathered ? "bg-white/20" : "bg-gradient-to-b from-amber-400 to-orange-500"
        }`}
      />

      <div className="flex items-center gap-3 py-3 pl-5 pr-3">
        <span
          className={`hidden h-9 w-9 shrink-0 items-center justify-center rounded-xl sm:flex ${
            grandfathered ? "bg-white/[0.07] text-white/60" : "bg-amber-500/15 text-amber-300"
          }`}
        >
          <EyeOff className="h-4 w-4" />
        </span>

        <div className="min-w-0 flex-1">
          <p className="truncate text-[13px] font-semibold text-white/90">{title}</p>
          <p className="truncate text-[11px] text-white/45">{detail}</p>
        </div>

        <Link
          href="/dashboard/services"
          className="hidden shrink-0 items-center gap-1.5 rounded-xl bg-gradient-to-r from-fuchsia-600 to-violet-600 px-3.5 py-2 text-xs font-semibold text-white shadow-lg shadow-violet-500/20 transition hover:opacity-90 sm:inline-flex"
        >
          Completar
          <ArrowRight className="h-3.5 w-3.5" />
        </Link>

        <button
          type="button"
          onClick={() => setOpen((p) => !p)}
          aria-expanded={open}
          aria-label={open ? "Ocultar lo que falta" : "Ver lo que falta"}
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl text-white/30 transition hover:bg-white/[0.06] hover:text-white/70"
        >
          <ChevronDown className={`h-4 w-4 transition-transform ${open ? "rotate-180" : ""}`} />
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

          {/* En el teléfono el botón de arriba no cabe: acá va entero. */}
          <Link
            href="/dashboard/services"
            className="mt-3 flex items-center justify-center gap-1.5 rounded-xl bg-gradient-to-r from-fuchsia-600 to-violet-600 px-3 py-2.5 text-xs font-semibold text-white shadow-lg shadow-violet-500/20 transition hover:opacity-90 sm:hidden"
          >
            Completar mi ficha
            <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </div>
      )}
    </div>
  );
}
