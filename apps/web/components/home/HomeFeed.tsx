"use client";

/**
 * Cuerpo del home.
 *
 * Antes eran seis bloques apilados (carrusel de novedades + cuatro secciones
 * plegables + grilla de destacadas) antes de llegar al feed real. Cada uno era
 * un riel horizontal distinto sobre el mismo conjunto de perfiles.
 *
 * La evidencia de usabilidad va en contra de eso: en móvil la gente hace
 * scroll, no swipe, y de un carrusel prácticamente solo se ve la primera
 * lámina. Un grid vertical denso de fotos es lo que se escanea bien.
 *
 * Así que el cuerpo queda en dos piezas: una barra de filtros con lo que
 * decide la compra en este rubro (disponibilidad, novedad, exámenes, formato)
 * y el grid infinito. Las secciones que se quitaron no desaparecen como
 * función: cada una es ahora un filtro que lleva al listado completo, con más
 * opciones de las que tenía la sección plegable.
 *
 * Destacadas ya no se renderiza aquí: vive sobre el mapa, en HomeClient, en
 * versión compacta. Tenerla en los dos sitios la duplicaba en pantalla.
 */

import Link from "next/link";
import { Clock, ShieldCheck, Sparkles, Star, Video } from "lucide-react";
import InfiniteFeed from "./InfiniteFeed";

/* Filtros por estado del perfil, no por categoría: la categoría ya vive en el
   hero. Cada uno apunta a un listado que ya existe. */
const FEED_FILTERS = [
  { label: "Disponible ahora", href: "/escorts?availableNow=true", icon: Sparkles },
  { label: "Nuevas", href: "/escorts?sort=new", icon: Clock },
  { label: "Con exámenes", href: "/escorts?profileTags=profesional+con+examenes", icon: ShieldCheck },
  { label: "Videollamada", href: "/videocall", icon: Video },
  { label: "Premium", href: "/premium", icon: Star },
];

export default function HomeFeed() {
  return (
    <>
      <nav
        aria-label="Filtros rápidos"
        className="scrollbar-none -mx-4 mb-6 flex gap-2 overflow-x-auto px-4 sm:mx-0 sm:flex-wrap sm:overflow-visible sm:px-0"
      >
        {FEED_FILTERS.map((f) => (
          <Link
            key={f.href}
            href={f.href}
            className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-white/[0.08] bg-white/[0.02] px-3 py-2 text-xs font-medium text-white/65 transition hover:border-fuchsia-500/30 hover:bg-white/[0.05] hover:text-white"
          >
            <f.icon className="h-3.5 w-3.5 text-white/40" aria-hidden />
            {f.label}
          </Link>
        ))}
      </nav>

      <InfiniteFeed categorySlug="escort,masajes" />
    </>
  );
}
