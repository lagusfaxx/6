"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { AlertTriangle, ArrowRight, ChevronDown, EyeOff } from "lucide-react";

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
  const [open, setOpen] = useState(true);

  const completion = me?.user?.profileCompletion;

  // Dentro del estudio sobra: ahí está la lista de requisitos completa.
  if (pathname.startsWith("/dashboard")) return null;
  if (!completion || completion.complete) return null;

  const missing = completion.missing ?? [];
  const grandfathered = completion.grandfathered;

  const tone = grandfathered
    ? {
        wrap: "border-white/10 bg-white/[0.04]",
        icon: "bg-white/10 text-white/70",
        title: "text-white/85",
      }
    : {
        wrap: "border-amber-500/30 bg-gradient-to-r from-amber-500/[0.12] to-orange-500/[0.06]",
        icon: "bg-amber-500/20 text-amber-300",
        title: "text-amber-100",
      };

  const title = grandfathered
    ? "Tu ficha está incompleta"
    : "Tu perfil todavía no se ve en la app";

  const detail = grandfathered
    ? `Tu perfil sigue publicado, pero le faltan ${missing.length} datos que el cliente mira antes de escribir.`
    : `Nadie puede encontrarte hasta completar ${missing.length} dato${missing.length !== 1 ? "s" : ""} de tu ficha.`;

  return (
    <div className={`mb-4 overflow-hidden rounded-2xl border ${tone.wrap}`}>
      <div className="flex items-center gap-3 px-3 py-2.5 sm:px-4">
        <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-xl ${tone.icon}`}>
          {grandfathered ? <AlertTriangle className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
        </span>

        <div className="min-w-0 flex-1">
          <p className={`truncate text-sm font-semibold ${tone.title}`}>{title}</p>
          <p className="truncate text-[11px] text-white/50">{detail}</p>
        </div>

        <Link
          href="/dashboard/services"
          className="hidden shrink-0 items-center gap-1.5 rounded-xl bg-gradient-to-r from-fuchsia-600 to-violet-600 px-3 py-2 text-xs font-semibold text-white shadow-lg shadow-violet-500/20 transition hover:opacity-90 sm:inline-flex"
        >
          Completar ficha
          <ArrowRight className="h-3.5 w-3.5" />
        </Link>

        <button
          type="button"
          onClick={() => setOpen((p) => !p)}
          aria-expanded={open}
          aria-label={open ? "Ocultar lo que falta" : "Ver lo que falta"}
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl text-white/40 transition hover:bg-white/10 hover:text-white/70"
        >
          <ChevronDown className={`h-4 w-4 transition-transform ${open ? "rotate-180" : ""}`} />
        </button>
      </div>

      {open && (
        <div className="border-t border-white/[0.08] px-3 py-2.5 sm:px-4">
          <div className="flex flex-wrap gap-1.5">
            {missing.map((f) => (
              <span
                key={f.key}
                className="rounded-full bg-white/[0.06] px-2.5 py-1 text-[11px] text-white/60"
              >
                {f.label}
              </span>
            ))}
          </div>

          {/* En el teléfono el botón de arriba no cabe: acá va entero. */}
          <Link
            href="/dashboard/services"
            className="mt-2.5 flex items-center justify-center gap-1.5 rounded-xl bg-gradient-to-r from-fuchsia-600 to-violet-600 px-3 py-2.5 text-xs font-semibold text-white shadow-lg shadow-violet-500/20 transition hover:opacity-90 sm:hidden"
          >
            Completar ficha
            <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </div>
      )}
    </div>
  );
}
